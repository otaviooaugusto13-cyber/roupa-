// Webhook do Mercado Pago. Regras: (1) validar assinatura, (2) nunca confiar no corpo — buscar o pagamento na API,
// (3) idempotência (stock-core.confirmarPagamento usa payments/{id}), (4) responder 200 só depois de processar.
import { Router } from 'express';
import { assinaturaValida } from '../services/mercadopago.js';
import { processarPagamentoMP } from '../services/pedidos.js';

const router = Router();

router.post('/mercadopago', async (req, res) => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) { console.error('[webhook] MP_WEBHOOK_SECRET ausente: notificação recusada.'); return res.sendStatus(500); }

  const dataId = req.query['data.id'] ?? req.body?.data?.id;
  const ok = assinaturaValida({ xSignature: req.get('x-signature'), xRequestId: req.get('x-request-id'), dataId, secret });
  if (!ok) { console.warn('[webhook] assinatura inválida'); return res.sendStatus(401); }

  const tipo = req.query.type ?? req.body?.type ?? req.query.topic;
  if (tipo !== 'payment' || !dataId) return res.sendStatus(200); // outros tópicos: ignora

  try {
    const r = await processarPagamentoMP(dataId);
    console.log('[webhook] pagamento', dataId, '->', r.resultado);
    res.sendStatus(200);
  } catch (e) {
    if (e?.status === 404) { console.warn('[webhook] pagamento não encontrado (simulação?):', dataId); return res.sendStatus(200); }
    console.error('[webhook] erro ao processar', dataId, e?.message);
    res.sendStatus(500); // o Mercado Pago tenta de novo
  }
});
export default router;
