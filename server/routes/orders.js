// Acompanhamento público do pedido pelo ID (ID aleatório = só quem fez o pedido conhece).
import { Router } from 'express';
import { db } from '../firebase.js';
import { encerrarPendente, visaoPublica } from '../services/pedidos.js';

const router = Router();
const ID = /^[A-Za-z0-9-]{16,64}$/;

async function carregar(req, res) {
  if (!ID.test(req.params.id)) { res.status(404).json({ erro: 'Pedido não encontrado.' }); return null; }
  const ref = db.collection('orders').doc(req.params.id);
  let s = await ref.get();
  if (!s.exists) { res.status(404).json({ erro: 'Pedido não encontrado.' }); return null; }
  // Verificação "preguiçosa": se a reserva venceu e o job ainda não passou (ex.: servidor dormindo), expira agora.
  const o = s.data();
  if (o.status === 'pending' && o.expiresAt && o.expiresAt.toMillis() <= Date.now()) {
    await encerrarPendente(s.id).catch((e) => console.error('[orders] expirar:', e.message));
    s = await ref.get();
  }
  return s;
}

router.get('/:id', async (req, res, next) => {
  try {
    const s = await carregar(req, res); if (!s) return;
    res.set('Cache-Control', 'no-store');
    res.json({ order: visaoPublica(s.id, s.data()) });
  } catch (e) { next(e); }
});

// Cliente desistiu do Pix (ou vai refazer o pedido): libera a reserva e cancela o Pix no Mercado Pago.
router.post('/:id/cancelar', async (req, res, next) => {
  try {
    const s = await carregar(req, res); if (!s) return;
    const o = s.data();
    if (o.status === 'pending' && o.paymentMethod === 'pix') await encerrarPendente(s.id, { novoStatus: 'canceled', nota: 'Cancelado pelo cliente' });
    const atual = (await db.collection('orders').doc(s.id).get()).data();
    res.json({ order: visaoPublica(s.id, atual) });
  } catch (e) { next(e); }
});
export default router;
