// Testes do núcleo de estoque. Rodar:  npm test
//  - sem emulador: usa o Firestore falso em memória (fake-firestore.js)
//  - com emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test  (Firestore de verdade)
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServicoEstoque, EstoqueInsuficienteError } from '../services/stock-core.js';

async function ambiente() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ projectId: 'demo-loja' });
    return { db: getFirestore(), FieldValue, Timestamp };
  }
  const { criarFakeDb, FieldValue, Timestamp } = await import('./fake-firestore.js');
  return { db: criarFakeDb().db, FieldValue, Timestamp };
}

const uid = () => Math.random().toString(36).slice(2, 10);
async function preparar(estoqueInicial) {
  const amb = await ambiente();
  const slug = 'peca-' + uid();
  await amb.db.collection('products').doc(slug).collection('variants').doc('M').set({ size: 'M', stock: estoqueInicial, reserved: 0 });
  const svc = criarServicoEstoque(amb);
  const variante = async () => (await amb.db.collection('products').doc(slug).collection('variants').doc('M').get()).data();
  const comprar = (qty = 1, total = 10000) => {
    const orderId = 'ord-' + uid() + uid();
    const linhas = [{ slug, size: 'M', qty, nome: 'Peça Teste' }];
    const pedido = { items: [{ productId: slug, size: 'M', qty, unitCents: total }], totalCents: total, paymentMethod: 'pix' };
    return { orderId, p: svc.criarPedidoComReserva({ orderId, linhas, pedido, reservaMs: 900000 }) };
  };
  return { svc, variante, comprar, amb, slug };
}

test('DUAS compras simultâneas da última peça: só uma passa', async () => {
  const { variante, comprar } = await preparar(1);
  const r = await Promise.allSettled([comprar().p, comprar().p]);
  const ok = r.filter((x) => x.status === 'fulfilled');
  const falha = r.filter((x) => x.status === 'rejected');
  assert.equal(ok.length, 1, 'exatamente uma compra deve passar');
  assert.equal(falha.length, 1);
  assert.ok(falha[0].reason instanceof EstoqueInsuficienteError);
  assert.match(falha[0].reason.message, /O tamanho M de Peça Teste acabou enquanto você comprava/);
  assert.deepEqual([(await variante()).stock, (await variante()).reserved], [1, 1]);
});

test('20 compras simultâneas com 3 peças: exatamente 3 passam, nunca vende a mais', async () => {
  const { variante, comprar } = await preparar(3);
  const r = await Promise.allSettled(Array.from({ length: 20 }, () => comprar().p));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 3);
  assert.equal((await variante()).reserved, 3);
});

test('pagamento aprovado baixa stock e reserved; notificação repetida não duplica', async () => {
  const { svc, variante, comprar } = await preparar(2);
  const { orderId, p } = comprar(1); await p;
  const a = await svc.confirmarPagamento({ orderId, paymentId: 777, valorPagoCents: 10000 });
  const b = await svc.confirmarPagamento({ orderId, paymentId: 777, valorPagoCents: 10000 });
  assert.equal(a.resultado, 'pago');
  assert.equal(b.resultado, 'duplicado');
  const v = await variante();
  assert.deepEqual([v.stock, v.reserved], [1, 0]);
});

test('webhook repetido EM PARALELO também não duplica a baixa', async () => {
  const { svc, variante, comprar } = await preparar(5);
  const { orderId, p } = comprar(2); await p;
  const r = await Promise.all(Array.from({ length: 5 }, () => svc.confirmarPagamento({ orderId, paymentId: 888, valorPagoCents: 10000 })));
  assert.equal(r.filter((x) => x.resultado === 'pago').length, 1);
  const v = await variante();
  assert.deepEqual([v.stock, v.reserved], [3, 0]);
});

test('liberar reserva devolve o estoque e é idempotente', async () => {
  const { svc, variante, comprar } = await preparar(1);
  const { orderId, p } = comprar(1); await p;
  assert.equal((await svc.liberarReserva({ orderId, novoStatus: 'expired' })).resultado, 'liberado');
  assert.equal((await svc.liberarReserva({ orderId, novoStatus: 'expired' })).resultado, 'ignorado');
  assert.equal((await variante()).reserved, 0);
  assert.equal(await comprar().p.then(() => 'ok'), 'ok'); // a peça voltou a ficar disponível
});

test('Pix pago DEPOIS de expirar: vende se ainda há estoque', async () => {
  const { svc, variante, comprar } = await preparar(2);
  const { orderId, p } = comprar(1); await p;
  await svc.liberarReserva({ orderId, novoStatus: 'expired' });
  const r = await svc.confirmarPagamento({ orderId, paymentId: 901, valorPagoCents: 10000 });
  assert.equal(r.resultado, 'pago_atrasado');
  assert.deepEqual([(await variante()).stock, (await variante()).reserved], [1, 0]);
});

test('Pix pago DEPOIS de expirar e SEM estoque: manda reembolsar, não vende', async () => {
  const { svc, variante, comprar } = await preparar(1);
  const a = comprar(1); await a.p;
  await svc.liberarReserva({ orderId: a.orderId, novoStatus: 'expired' });
  await comprar(1).p; // outra pessoa leva a última peça
  const r = await svc.confirmarPagamento({ orderId: a.orderId, paymentId: 902, valorPagoCents: 10000 });
  assert.equal(r.resultado, 'precisa_reembolso');
  assert.deepEqual([(await variante()).stock, (await variante()).reserved], [1, 1]); // nada foi baixado
});

test('valor pago diferente do pedido não libera a entrega', async () => {
  const { svc, variante, comprar } = await preparar(1);
  const { orderId, p } = comprar(1, 10000); await p;
  const r = await svc.confirmarPagamento({ orderId, paymentId: 903, valorPagoCents: 100 });
  assert.equal(r.resultado, 'precisa_reembolso');
  assert.deepEqual([(await variante()).stock, (await variante()).reserved], [1, 0]);
});

test('varredura encontra reservas vencidas', async () => {
  const amb = await ambiente();
  let agora = Date.now();
  const svc = criarServicoEstoque({ ...amb, agora: () => agora });
  const slug = 'peca-' + uid();
  await amb.db.collection('products').doc(slug).collection('variants').doc('M').set({ size: 'M', stock: 1, reserved: 0 });
  const orderId = 'ord-' + uid() + uid();
  await svc.criarPedidoComReserva({ orderId, linhas: [{ slug, size: 'M', qty: 1, nome: 'x' }], pedido: { items: [{ productId: slug, size: 'M', qty: 1 }], totalCents: 1 }, reservaMs: 900000 });
  assert.ok(!(await svc.listarVencidas()).includes(orderId));
  agora += 16 * 60 * 1000;
  assert.ok((await svc.listarVencidas()).includes(orderId));
});
