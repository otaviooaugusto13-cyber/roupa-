// Catálogo público: lista de produtos e produto por slug.
import { Router } from 'express';
import { db } from '../firebase.js';

const router = Router();
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG'];
const CACHE_MS = 60_000;      // cache em memória: evita ler o Firestore a cada visita
const MAX_EXIBIDO = 9;        // não expõe o estoque exato ao público
let cache = { em: 0, dados: null };

/** Monta o produto público. sizes = quantidade DISPONÍVEL (estoque - reservado), limitada a MAX_EXIBIDO. */
function paraPublico(doc, variantes) {
  const d = doc.data();
  const sizes = {};
  for (const t of TAMANHOS) {
    const v = variantes.find((x) => x.size === t);
    if (v) sizes[t] = Math.min(Math.max((v.stock || 0) - (v.reserved || 0), 0), MAX_EXIBIDO);
  }
  return {
    slug: d.slug, name: d.name, category: d.category, type: d.type, gender: d.gender || 'u', sub: d.sub || '', collection: d.collection || '',
    badge: d.badge || '', priceCents: d.priceCents, compareAtCents: d.compareAtCents ?? null,
    fit: d.fit, description: d.description, features: d.features || [],
    images: d.images || {}, gifUrl: d.gifUrl || '', mockup: d.mockup || null,
    dropId: d.dropId ?? null, position: d.position ?? 0, sizes,
  };
}

async function carregarCatalogo() {
  if (cache.dados && Date.now() - cache.em < CACHE_MS) return cache.dados;
  const [prods, vars] = await Promise.all([
    db.collection('products').where('active', '==', true).get(),
    db.collectionGroup('variants').get(), // 1 consulta só, em vez de N+1
  ]);
  const porProduto = new Map();
  for (const v of vars.docs) {
    const pid = v.ref.parent.parent.id;
    if (!porProduto.has(pid)) porProduto.set(pid, []);
    porProduto.get(pid).push(v.data());
  }
  const dados = prods.docs
    .map((p) => paraPublico(p, porProduto.get(p.id) || []))
    .sort((a, b) => a.position - b.position); // ordena em memória: evita índice composto no Firestore
  cache = { em: Date.now(), dados };
  return dados;
}

router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ products: await carregarCatalogo() });
  } catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const p = (await carregarCatalogo()).find((x) => x.slug === req.params.slug);
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json({ product: p });
  } catch (e) { next(e); }
});

/** Limpa o cache (será chamado pelo painel admin e pelo webhook de pagamento nas próximas fases). */
export function invalidarCacheCatalogo() { cache = { em: 0, dados: null }; }

export default router;
