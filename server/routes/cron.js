// Endpoint para o Cron Job do Render (ou qualquer agendador): POST /api/cron/expirar com o header x-cron-secret.
// Útil porque no plano gratuito o Web Service "dorme" e o job interno não roda.
import { Router } from 'express';
import crypto from 'node:crypto';
import { varrerVencidas } from '../services/pedidos.js';

const router = Router();
router.post('/expirar', async (req, res, next) => {
  try {
    const esperado = process.env.CRON_SECRET || '';
    const recebido = String(req.get('x-cron-secret') || '');
    const a = Buffer.from(esperado), b = Buffer.from(recebido);
    if (!esperado || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(401);
    res.json(await varrerVencidas());
  } catch (e) { next(e); }
});
export default router;
