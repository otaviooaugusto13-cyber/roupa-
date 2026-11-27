/* Camada de acesso à API da loja.
   Converte o formato do Firestore (centavos, variants) para o formato que o front já usa. */
import { PRODUTOS_EXEMPLO } from './produtos-exemplo.js';

/** Converte um produto da API (/api/products) para o formato legado usado em main.js. */
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG'];
/* Cores do mockup SVG para produtos cadastrados sem esses dados (o desenho aparece quando falta foto). */
const MOCKUP_PADRAO = { color: '#141417', ink: '#A855F7', bg: ['#1d1b24', '#0c0c10'] };

export function deApi(d) {
  const sizes = d.sizes || {};
  const m = d.mockup || {};
  return {
    id: d.slug,
    name: d.name,
    cat: d.category,
    type: d.type,
    gender: d.gender || 'u',
    sub: d.sub || '',
    crew: !!d.mockup?.crew,
    col: d.collection || '',
    badge: d.badge || '',
    price: d.priceCents / 100,
    compareAt: d.compareAtCents ? d.compareAtCents / 100 : null,
    // cores do mockup SVG (usado quando a foto falha)
    color: m.color || MOCKUP_PADRAO.color,
    ink: m.ink || MOCKUP_PADRAO.ink,
    word: m.word || String(d.name || '').split(' ')[0].toUpperCase().slice(0, 10),
    bg: m.bg?.length === 2 ? m.bg : MOCKUP_PADRAO.bg,
    // tamanho sem variante ou sem estoque disponível = esgotado (riscado)
    soldout: TAMANHOS.filter((tam) => !(sizes[tam] > 0)),
    fit: d.fit,
    desc: d.description,
    feats: d.features || [],
    photos: {
      front: d.images?.front, back: d.images?.back,
      ...(d.images?.detail ? { detail: d.images.detail } : {}),
    },
    gif: d.gifUrl || '',
  };
}

/** Busca os produtos na API. Se falhar (API fora do ar, abrindo via file://), usa os dados de exemplo. */
export async function carregarProdutos() {
  try {
    const r = await fetch('/api/products', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const { products } = await r.json();
    if (!Array.isArray(products) || !products.length) throw new Error('catálogo vazio');
    return products.map(deApi);
  } catch (e) {
    console.warn('[loja] API de produtos indisponível — usando dados de exemplo.', e);
    return PRODUTOS_EXEMPLO;
  }
}

/* ---------- Helpers de requisição ---------- */
export class ErroApi extends Error {
  constructor(mensagem, status, data) { super(mensagem); this.status = status; this.data = data; }
}
async function pedir(url, init) {
  let r;
  try { r = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) }, signal: AbortSignal.timeout(20000) }); }
  catch { throw new ErroApi('Sem conexão com o servidor. Verifique sua internet e tente de novo.', undefined, null); }
  let data = null;
  try { data = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) throw new ErroApi(data?.erro || 'Algo deu errado. Tente novamente.', r.status, data);
  return data;
}
export const getJSON = (url) => pedir(url);
export const postJSON = (url, corpo) => pedir(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo ?? {}) });

/** Configurações de negócio vindas do servidor (frete grátis, desconto do Pix, parcelas, Public Key do MP). */
const CONFIG_PADRAO = { mpPublicKey: '', freteGratisCents: 39900, pixDescontoPercent: 5, maxParcelas: 6, reservaMin: 15 };
export async function carregarConfig() {
  try { return { ...CONFIG_PADRAO, ...(await getJSON('/api/config')) }; }
  catch { return CONFIG_PADRAO; }
}
