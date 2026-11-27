// Cotação de frete (Melhor Envio). Docs: POST /api/v2/me/shipment/calculate com Bearer + User-Agent obrigatório.
import { CFG, ErroNegocio } from '../config.js';

const BASE = (process.env.MELHOR_ENVIO_URL || 'https://melhorenvio.com.br').replace(/\/$/, '');
const CACHE_MS = 5 * 60_000;
const cache = new Map();

/**
 * @param linhas [{slug,size,qty,unitCents,weightGrams,dimensions:{lengthCm,widthCm,heightCm}}]
 * @returns opções ordenadas por preço: { id, name, company, priceCents, chargeCents, free, deliveryDays, deliveryMin, deliveryMax }
 *   chargeCents = quanto o cliente paga. Acima do mínimo, a opção MAIS BARATA fica grátis; as demais cobram só a diferença.
 */
export async function cotarFrete({ cepDestino, linhas, subtotalCents }) {
  if (!process.env.MELHOR_ENVIO_TOKEN) throw new ErroNegocio(503, 'Cálculo de frete indisponível no momento.');
  if (CFG.cepOrigem.length !== 8) throw new ErroNegocio(503, 'Cálculo de frete indisponível no momento.');

  const products = linhas.map((l) => {
    const d = l.dimensions;
    if (!l.weightGrams || !d?.widthCm || !d?.heightCm || !d?.lengthCm) {
      console.error('[frete] variante sem peso/dimensões:', l.slug, l.size);
      throw new ErroNegocio(503, 'Cálculo de frete indisponível para este produto.');
    }
    return {
      id: `${l.slug}-${l.size}`, width: d.widthCm, height: d.heightCm, length: d.lengthCm,
      weight: l.weightGrams / 1000, insurance_value: l.unitCents / 100, quantity: l.qty,
    };
  });
  const chave = JSON.stringify([cepDestino, products]);
  let opcoes = cache.get(chave);
  if (!opcoes || Date.now() - opcoes.em > CACHE_MS) {
    opcoes = { em: Date.now(), lista: await consultar({ from: { postal_code: CFG.cepOrigem }, to: { postal_code: cepDestino }, products, options: { receipt: false, own_hand: false } }) };
    cache.set(chave, opcoes);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
  }
  const lista = opcoes.lista;
  if (!lista.length) throw new ErroNegocio(422, 'Nenhuma transportadora atende este CEP para os itens do carrinho.');
  const maisBarato = lista[0].priceCents;
  const gratis = subtotalCents >= CFG.freteGratisCents;
  return lista.map((o) => ({ ...o, free: gratis && o.priceCents === maisBarato, chargeCents: gratis ? Math.max(0, o.priceCents - maisBarato) : o.priceCents }));
}

async function consultar(payload) {
  let r;
  try {
    r = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        // O Melhor Envio exige nome da aplicação + e-mail de contato técnico
        'User-Agent': process.env.MELHOR_ENVIO_USER_AGENT || 'Loja (TODO-preencher-email@dominio.com)',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('[frete] falha de rede:', e.message);
    throw new ErroNegocio(502, 'Não foi possível calcular o frete agora. Tente novamente em instantes.');
  }
  if (!r.ok) {
    console.error('[frete] Melhor Envio respondeu', r.status, (await r.text()).slice(0, 300));
    throw new ErroNegocio(r.status === 422 ? 422 : 502, r.status === 422 ? 'Não foi possível calcular o frete para este CEP.' : 'Não foi possível calcular o frete agora. Tente novamente em instantes.');
  }
  const dados = await r.json();
  return (Array.isArray(dados) ? dados : [])
    .filter((o) => o && !o.error && Number(o.custom_price ?? o.price) > 0)
    .map((o) => {
      const faixa = o.custom_delivery_range || o.delivery_range || {};
      return {
        id: String(o.id), name: o.name, company: o.company?.name || '',
        priceCents: Math.round(Number(o.custom_price ?? o.price) * 100),
        deliveryDays: Number(o.custom_delivery_time ?? o.delivery_time) || null,
        deliveryMin: faixa.min ?? null, deliveryMax: faixa.max ?? null,
      };
    })
    .sort((a, b) => a.priceCents - b.priceCents);
}
