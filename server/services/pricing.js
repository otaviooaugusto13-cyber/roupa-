// Monta o pedido SEMPRE a partir dos preços do banco (o navegador só diz o que quer comprar).
import { db } from '../firebase.js';
import { CFG, ErroNegocio } from '../config.js';
import { cotarFrete } from './frete.js';

/** Carrega produto + variante de cada item, valida e junta linhas repetidas. */
export async function carregarLinhas(items) {
  const mapa = new Map();
  for (const i of items) {
    const k = `${i.slug}|${i.size}`;
    mapa.set(k, { ...i, qty: Math.min((mapa.get(k)?.qty || 0) + i.qty, CFG.maxQtdPorItem) });
  }
  const unicos = [...mapa.values()];
  const slugs = [...new Set(unicos.map((l) => l.slug))];
  const prods = new Map((await db.getAll(...slugs.map((s) => db.collection('products').doc(s)))).map((s) => [s.id, s]));
  const vars = await db.getAll(...unicos.map((l) => db.collection('products').doc(l.slug).collection('variants').doc(l.size)));

  return unicos.map((l, i) => {
    const p = prods.get(l.slug);
    if (!p?.exists || !p.data().active) throw new ErroNegocio(409, 'Um dos produtos do carrinho não está mais disponível.', { slug: l.slug });
    const v = vars[i];
    if (!v.exists) throw new ErroNegocio(409, `O tamanho ${l.size} de ${p.data().name} não está disponível.`, { slug: l.slug });
    const vd = v.data();
    return {
      slug: l.slug, size: l.size, qty: l.qty, nome: p.data().name, unitCents: p.data().priceCents,
      weightGrams: vd.weightGrams, dimensions: vd.dimensions,
    };
  });
}

/** Cotação para a calculadora de frete (página do produto e checkout). */
export async function cotar({ items, cep }) {
  const linhas = await carregarLinhas(items);
  const subtotalCents = linhas.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const opcoes = await cotarFrete({ cepDestino: cep, linhas, subtotalCents });
  return { linhas, subtotalCents, opcoes };
}

/** Totais do pedido para um método de pagamento. */
export async function montarPedido({ items, cep, shipServiceId, metodo }) {
  const { linhas, subtotalCents, opcoes } = await cotar({ items, cep });
  const frete = opcoes.find((o) => o.id === String(shipServiceId));
  if (!frete) throw new ErroNegocio(409, 'A opção de frete escolhida não está mais disponível. Escolha o frete novamente.', { codigo: 'FRETE' });
  const descontoCents = metodo === 'pix' ? Math.round((subtotalCents * CFG.pixDescontoPercent) / 100) : 0;
  const totalCents = subtotalCents - descontoCents + frete.chargeCents;
  return {
    linhas, subtotalCents, descontoCents, shippingCents: frete.chargeCents, totalCents,
    frete: { id: frete.id, name: frete.name, company: frete.company, deliveryDays: frete.deliveryDays, priceCents: frete.priceCents, free: frete.free },
    itens: linhas.map((l) => ({ productId: l.slug, name: l.nome, size: l.size, qty: l.qty, unitCents: l.unitCents })),
  };
}
