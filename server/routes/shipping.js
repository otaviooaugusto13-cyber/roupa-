import { Router } from 'express';
import { cotar } from '../services/pricing.js';
import { CFG, ErroNegocio } from '../config.js';
import { soDigitos } from '../middleware/validacao.js';

const router = Router();

// POST /api/shipping/quote  { cep, items:[{slug,size,qty}] }
router.post('/quote', async (req, res, next) => {
  try {
    const cep = soDigitos(req.body?.cep);
    if (cep.length !== 8) throw new ErroNegocio(400, 'CEP inválido.');
    const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 20).map((i) => ({ slug: String(i?.slug), size: i?.size, qty: Math.min(Math.max(parseInt(i?.qty) || 1, 1), CFG.maxQtdPorItem) }));
    if (!items.length || items.some((i) => !CFG.tamanhos.includes(i.size) || !/^[a-z0-9-]{1,80}$/.test(i.slug))) throw new ErroNegocio(400, 'Itens inválidos.');
    const { subtotalCents, opcoes } = await cotar({ items, cep });
    res.json({ subtotalCents, freteGratisCents: CFG.freteGratisCents, options: opcoes });
  } catch (e) { next(e); }
});
export default router;
