// POST /api/checkout — cria o pedido, reserva o estoque e inicia o pagamento (Pix ou cartão).
import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { CFG, ErroNegocio } from '../config.js';
import { validarCheckout } from '../middleware/validacao.js';
import { montarPedido } from '../services/pricing.js';
import { estoque, EstoqueInsuficienteError } from '../services/stock.js';
import * as mp from '../services/mercadopago.js';
import { processarPagamentoMP, varrerVencidas, visaoPublica } from '../services/pedidos.js';

const router = Router();

const RECUSA = {
  cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
  cc_rejected_call_for_authorize: 'Seu banco pediu autorização. Ligue para o emissor ou use outro cartão.',
  cc_rejected_card_disabled: 'Cartão desabilitado. Ligue para o emissor ou use outro cartão.',
};
const msgRecusa = (detalhe) => RECUSA[detalhe] || 'Pagamento recusado. Tente outro cartão ou pague com Pix.';

router.post('/', async (req, res, next) => {
  try {
    const v = validarCheckout(req.body);
    if (v.erro) return res.status(400).json({ erro: v.erro, campo: v.campo });
    const d = v.dados;
    const orderId = d.key;

    // Reenvio do mesmo checkout (duplo clique, rede lenta): devolve o pedido que já existe
    const existente = await db.collection('orders').doc(orderId).get();
    if (existente.exists) return res.json({ order: visaoPublica(orderId, existente.data()) });

    // Libera reservas vencidas antes de conferir estoque (importante em drop: a "última peça" pode estar presa)
    await varrerVencidas().catch(() => {});

    const calc = await montarPedido({ items: d.items, cep: d.address.cep, shipServiceId: d.shipServiceId, metodo: d.paymentMethod });
    const pedido = {
      customer: d.customer, address: d.address, items: calc.itens,
      subtotalCents: calc.subtotalCents, shippingCents: calc.shippingCents, discountCents: calc.descontoCents, totalCents: calc.totalCents,
      shippingService: calc.frete, paymentMethod: d.paymentMethod, installments: d.card?.installments ?? 1,
      mpPaymentId: null, trackingCode: null,
    };

    let criado;
    try {
      criado = await estoque.criarPedidoComReserva({ orderId, linhas: calc.linhas, pedido, reservaMs: CFG.reservaMin * 60_000 });
    } catch (e) {
      if (e instanceof EstoqueInsuficienteError) return res.status(409).json({ erro: e.message, codigo: 'ESTOQUE', faltas: e.faltas });
      throw e;
    }
    if (criado.duplicado) return res.json({ order: visaoPublica(orderId, criado.order) });
    const ref = db.collection('orders').doc(orderId);

    // Cria o pagamento no Mercado Pago. Se falhar, devolve a reserva.
    let pay;
    try {
      pay = d.paymentMethod === 'pix' ? await mp.criarPix(orderId, criado.order) : await mp.criarCartao(orderId, criado.order, d.card);
    } catch (e) {
      console.error('[checkout] Mercado Pago falhou:', e?.message, JSON.stringify(e?.cause ?? e?.error ?? '').slice(0, 400));
      await estoque.liberarReserva({ orderId, novoStatus: 'canceled', nota: 'Falha ao criar o pagamento' }).catch(() => {});
      const cartaoInvalido = d.paymentMethod === 'card' && e?.status === 400;
      return res.status(cartaoInvalido ? 400 : 502).json({
        erro: cartaoInvalido ? 'Não foi possível processar o cartão. Confira os dados e tente novamente.' : 'Não foi possível iniciar o pagamento. Tente novamente em instantes.',
      });
    }

    const td = pay.point_of_interaction?.transaction_data;
    await ref.update({
      mpPaymentId: String(pay.id), mpStatus: pay.status, mpStatusDetail: pay.status_detail || null, updatedAt: Timestamp.now(),
      ...(td ? { pix: { qrCode: td.qr_code, qrCodeBase64: td.qr_code_base64, ticketUrl: td.ticket_url || null } } : {}),
    });

    if (pay.status === 'approved') await processarPagamentoMP(pay.id);
    else if (pay.status === 'rejected') {
      await estoque.liberarReserva({ orderId, novoStatus: 'canceled', nota: `Pagamento recusado (${pay.status_detail})` });
      return res.status(402).json({ erro: msgRecusa(pay.status_detail), codigo: pay.status_detail });
    }

    res.status(201).json({ order: visaoPublica(orderId, (await ref.get()).data()) });
  } catch (e) { next(e); }
});

export default router;
