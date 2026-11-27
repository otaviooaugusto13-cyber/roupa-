// Configurações públicas para o front (nenhum segredo aqui; a Public Key do MP é feita para ser pública).
import { Router } from 'express';
import { CFG } from '../config.js';

const router = Router();
router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    mpPublicKey: CFG.mpPublicKey, freteGratisCents: CFG.freteGratisCents, pixDescontoPercent: CFG.pixDescontoPercent,
    maxParcelas: CFG.maxParcelas, reservaMin: CFG.reservaMin,
  });
});
export default router;
