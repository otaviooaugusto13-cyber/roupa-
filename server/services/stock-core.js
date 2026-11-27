// Núcleo de estoque: reserva, venda e liberação, SEMPRE dentro de transações do Firestore.
// Recebe o banco por parâmetro para poder ser testado com um Firestore falso (ver server/tests).
//
// Modelo: variants.stock = unidades físicas; variants.reserved = unidades seguradas por pedidos pendentes.
// Disponível = stock - reserved.  Cada pedido pendente tem 1 doc em reservations/{orderId}.
export class EstoqueInsuficienteError extends Error {
  constructor(faltas) {
    const f = faltas[0];
    super(faltas.length === 1
      ? `O tamanho ${f.size} de ${f.nome} acabou enquanto você comprava.`
      : 'Alguns itens acabaram enquanto você comprava.');
    this.codigo = 'ESTOQUE';
    this.faltas = faltas;
  }
}

export function criarServicoEstoque({ db, FieldValue, Timestamp, agora = () => Date.now() }) {
  const varRef = (slug, size) => db.collection('products').doc(slug).collection('variants').doc(size);
  const orderRef = (id) => db.collection('orders').doc(id);
  const resRef = (id) => db.collection('reservations').doc(id);
  const payRef = (id) => db.collection('payments').doc(String(id));
  const counterRef = db.collection('counters').doc('orders');
  const ts = (ms = agora()) => Timestamp.fromMillis(ms);

  /** Confere estoque, reserva e cria o pedido (status pending) numa transação só. */
  async function criarPedidoComReserva({ orderId, linhas, pedido, reservaMs }) {
    return db.runTransaction(async (tx) => {
      const oRef = orderRef(orderId);
      const [oSnap, cSnap, ...vSnaps] = await tx.getAll(oRef, counterRef, ...linhas.map((l) => varRef(l.slug, l.size)));
      if (oSnap.exists) return { duplicado: true, order: { id: orderId, ...oSnap.data() } };

      const faltas = [];
      linhas.forEach((l, i) => {
        const v = vSnaps[i].exists ? vSnaps[i].data() : null;
        const disponivel = v ? (v.stock || 0) - (v.reserved || 0) : 0;
        if (disponivel < l.qty) faltas.push({ slug: l.slug, size: l.size, nome: l.nome, disponivel: Math.max(disponivel, 0), pedido: l.qty });
      });
      if (faltas.length) throw new EstoqueInsuficienteError(faltas);

      const numero = (cSnap.exists ? cSnap.data().last : 1000) + 1;
      const expiresAt = ts(agora() + reservaMs);
      linhas.forEach((l) => tx.update(varRef(l.slug, l.size), { reserved: FieldValue.increment(l.qty) }));
      tx.set(counterRef, { last: numero });
      const order = { ...pedido, number: numero, status: 'pending', expiresAt, createdAt: ts(), updatedAt: ts() };
      tx.set(oRef, order);
      tx.set(resRef(orderId), { orderId, items: linhas.map((l) => ({ slug: l.slug, size: l.size, qty: l.qty })), expiresAt });
      return { duplicado: false, order: { id: orderId, ...order } };
    });
  }

  /**
   * Pagamento aprovado: baixa stock E reserved na mesma transação.
   * Idempotente pelo id do pagamento (payments/{paymentId}).
   * Resultados: pago | pago_atrasado | precisa_reembolso | duplicado | ja_pago | pedido_inexistente
   */
  async function confirmarPagamento({ orderId, paymentId, valorPagoCents, mpStatusDetail }) {
    return db.runTransaction(async (tx) => {
      const oRef = orderRef(orderId);
      const [oSnap, pSnap, rSnap] = await tx.getAll(oRef, payRef(paymentId), resRef(orderId));
      if (!oSnap.exists) return { resultado: 'pedido_inexistente' };
      const o = oSnap.data();
      if (pSnap.exists && pSnap.data().processed === 'approved') return { resultado: 'duplicado' };
      if (o.status === 'paid') { tx.set(payRef(paymentId), { orderId, processed: 'approved', at: ts() }, { merge: true }); return { resultado: 'ja_pago' }; }

      const vSnaps = await tx.getAll(...o.items.map((i) => varRef(i.productId, i.size)));
      const temReserva = rSnap.exists;
      const divergente = valorPagoCents !== o.totalCents;
      const base = { mpPaymentId: String(paymentId), mpStatus: 'approved', mpStatusDetail: mpStatusDetail || null, updatedAt: ts() };
      let resultado;

      if (divergente) {
        // Valor pago diferente do pedido: não entrega; devolve a reserva (se houver) e manda reembolsar.
        if (temReserva) { o.items.forEach((i) => tx.update(varRef(i.productId, i.size), { reserved: FieldValue.increment(-i.qty) })); tx.delete(resRef(orderId)); }
        tx.update(oRef, { ...base, status: 'refund_pending', statusNote: 'Valor pago diferente do valor do pedido.' });
        resultado = 'precisa_reembolso';
      } else if (temReserva) {
        o.items.forEach((i) => tx.update(varRef(i.productId, i.size), { stock: FieldValue.increment(-i.qty), reserved: FieldValue.increment(-i.qty) }));
        tx.delete(resRef(orderId));
        tx.update(oRef, { ...base, status: 'paid', paidAt: ts() });
        resultado = 'pago';
      } else {
        // Reserva já foi liberada (pedido expirou) mas o pagamento chegou: tenta vender direto.
        const cabe = o.items.every((i, k) => { const v = vSnaps[k].exists ? vSnaps[k].data() : null; return v && (v.stock || 0) - (v.reserved || 0) >= i.qty; });
        if (cabe) {
          o.items.forEach((i) => tx.update(varRef(i.productId, i.size), { stock: FieldValue.increment(-i.qty) }));
          tx.update(oRef, { ...base, status: 'paid', paidAt: ts(), statusNote: 'Pagamento recebido após a reserva expirar; estoque ainda disponível.' });
          resultado = 'pago_atrasado';
        } else {
          tx.update(oRef, { ...base, status: 'refund_pending', statusNote: 'Pagamento recebido após a reserva expirar e sem estoque.' });
          resultado = 'precisa_reembolso';
        }
      }
      tx.set(payRef(paymentId), { orderId, processed: 'approved', amountCents: valorPagoCents, at: ts() }, { merge: true });
      return { resultado };
    });
  }

  /** Libera a reserva de um pedido pendente (expirado, recusado ou cancelado). Só age se status === pending. */
  async function liberarReserva({ orderId, novoStatus, nota }) {
    return db.runTransaction(async (tx) => {
      const oRef = orderRef(orderId);
      const [oSnap, rSnap] = await tx.getAll(oRef, resRef(orderId));
      if (!oSnap.exists) return { resultado: 'inexistente' };
      const o = oSnap.data();
      if (o.status !== 'pending') return { resultado: 'ignorado', status: o.status };
      if (rSnap.exists) {
        o.items.forEach((i) => tx.update(varRef(i.productId, i.size), { reserved: FieldValue.increment(-i.qty) }));
        tx.delete(resRef(orderId));
      }
      tx.update(oRef, { status: novoStatus, statusNote: nota || null, updatedAt: ts() });
      return { resultado: 'liberado' };
    });
  }

  /** IDs de pedidos cuja reserva já venceu (a reserva é apagada ao confirmar/liberar, então só sobram as pendentes). */
  async function listarVencidas(limite = 25) {
    const snap = await db.collection('reservations').where('expiresAt', '<=', ts()).limit(limite).get();
    return snap.docs.map((d) => d.id);
  }

  /** Prorroga a reserva (usado quando o cartão está "em análise" no emissor). */
  async function estenderReserva(orderId, ms) {
    const novo = ts(agora() + ms);
    await Promise.all([resRef(orderId).update({ expiresAt: novo }), orderRef(orderId).update({ expiresAt: novo, updatedAt: ts() })]);
  }

  return { criarPedidoComReserva, confirmarPagamento, liberarReserva, listarVencidas, estenderReserva, refs: { varRef, orderRef, resRef, payRef } };
}
