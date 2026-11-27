// Orquestra pagamento <-> estoque <-> e-mail. Toda decisão de status passa pelas transações de stock-core.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { estoque } from './stock.js';
import * as mp from './mercadopago.js';
import { enviarConfirmacaoPedido } from './email.js';

const orderRef = (id) => db.collection('orders').doc(id);
const ANALISE_MS = 10 * 60_000; // cartão "em análise": revisita a cada 10 min em vez de expirar

/** Visão pública de um pedido (sem CPF, endereço ou outros dados pessoais). */
export function visaoPublica(id, o) {
  const pendentePix = o.status === 'pending' && o.paymentMethod === 'pix' && o.pix;
  return {
    id, number: o.number, status: o.status, paymentMethod: o.paymentMethod, totalCents: o.totalCents,
    expiresAt: o.expiresAt?.toMillis?.() ?? null, agora: Date.now(),
    ...(pendentePix ? { pix: { qrCode: o.pix.qrCode, qrCodeBase64: o.pix.qrCodeBase64 } } : {}),
  };
}

async function notificarPago(orderId) {
  try { const s = await orderRef(orderId).get(); await enviarConfirmacaoPedido(s.data()); }
  catch (e) { console.error('[email] falha ao enviar confirmação do pedido', orderId, e.message); }
}

async function reembolsarPedido(orderId, paymentId) {
  try {
    await mp.reembolsarTotal(paymentId, `${orderId}-refund`);
    await orderRef(orderId).update({ status: 'refunded', updatedAt: Timestamp.now(), statusNote: 'Reembolsado automaticamente (pagamento não pôde ser atendido).' });
    // TODO: avisar o cliente por e-mail sobre o reembolso automático.
  } catch (e) {
    console.error('[ALERTA] reembolso automático FALHOU — fazer manualmente no painel do Mercado Pago. Pedido', orderId, 'pagamento', paymentId, e.message);
  }
}

/**
 * Processa um pagamento a partir do ID: busca na API do MP (fonte da verdade) e aplica o status.
 * É idempotente: pode ser chamado N vezes para o mesmo pagamento.
 */
export async function processarPagamentoMP(paymentId) {
  const pay = await mp.buscarPagamento(paymentId);
  const orderId = pay.external_reference;
  if (!orderId) return { resultado: 'sem_referencia' };
  const status = pay.status;

  if (status === 'approved') {
    const r = await estoque.confirmarPagamento({
      orderId, paymentId: pay.id, valorPagoCents: Math.round(Number(pay.transaction_amount) * 100), mpStatusDetail: pay.status_detail,
    });
    if (r.resultado === 'pago' || r.resultado === 'pago_atrasado') await notificarPago(orderId);
    if (r.resultado === 'precisa_reembolso') await reembolsarPedido(orderId, pay.id);
    return r;
  }
  if (status === 'rejected') return estoque.liberarReserva({ orderId, novoStatus: 'canceled', nota: `Pagamento recusado (${pay.status_detail || 'sem detalhe'})` });
  if (status === 'cancelled') return estoque.liberarReserva({ orderId, novoStatus: 'expired', nota: 'Pagamento cancelado/expirado no Mercado Pago' });
  if (status === 'refunded' || status === 'charged_back') {
    // TODO (Fase painel): devolver estoque manualmente conforme a peça volte ou não.
    await orderRef(orderId).update({ status: 'refunded', mpStatus: status, updatedAt: Timestamp.now(), statusNote: status === 'charged_back' ? 'Chargeback' : 'Reembolsado' });
    return { resultado: 'estornado' };
  }
  // pending / in_process / authorized: só registra o status
  await orderRef(orderId).update({ mpStatus: status, mpStatusDetail: pay.status_detail || null, updatedAt: Timestamp.now() }).catch(() => {});
  return { resultado: 'aguardando', status };
}

/**
 * Encerra um pedido pendente (reserva vencida ou cancelamento pedido pelo cliente).
 * Antes de liberar o estoque, confere no MP: pagamento aprovado vira venda; cartão em análise espera.
 */
export async function encerrarPendente(orderId, { novoStatus = 'expired', nota = 'Reserva expirada' } = {}) {
  const s = await orderRef(orderId).get();
  const o = s.exists ? s.data() : null;
  if (!o || o.status !== 'pending') return { resultado: 'ignorado' };

  if (o.mpPaymentId) {
    let pay = await mp.buscarPagamento(o.mpPaymentId);
    if (pay.status === 'approved') return processarPagamentoMP(o.mpPaymentId);
    if (pay.status === 'in_process' || pay.status === 'authorized') {
      await estoque.estenderReserva(orderId, ANALISE_MS);
      return { resultado: 'em_analise' };
    }
    if (pay.status === 'pending') {
      try { await mp.cancelarPagamento(o.mpPaymentId); }
      catch (e) {
        // pode ter sido pago no instante entre a consulta e o cancelamento
        pay = await mp.buscarPagamento(o.mpPaymentId);
        if (pay.status === 'approved') return processarPagamentoMP(o.mpPaymentId);
        console.error('[pedidos] não foi possível cancelar o Pix no MP', o.mpPaymentId, e.message);
      }
    }
  }
  return estoque.liberarReserva({ orderId, novoStatus, nota });
}

/** Libera reservas vencidas (chamado pelo job periódico, pelo checkout e pelo endpoint de cron). */
export async function varrerVencidas() {
  const ids = await estoque.listarVencidas();
  let n = 0;
  for (const id of ids) {
    try { const r = await encerrarPendente(id); if (r.resultado === 'liberado') n++; }
    catch (e) { console.error('[job] erro ao expirar pedido', id, e.message); }
  }
  return { verificados: ids.length, liberados: n };
}

export function iniciarJobExpiracao(intervaloMs = 60_000) {
  const t = setInterval(() => varrerVencidas().catch((e) => console.error('[job] varredura falhou:', e.message)), intervaloMs);
  t.unref?.();
  return t;
}
