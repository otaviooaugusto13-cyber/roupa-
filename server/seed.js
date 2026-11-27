// Importa os 8 produtos de exemplo (public/js/produtos-exemplo.js) para o Firestore.
//
// Uso:
//   npm run seed:dry   -> só mostra o que seria gravado (não precisa de credenciais)
//   npm run seed       -> grava no Firestore (produtos + variantes)
//   npm run seed -- --force   -> sobrescreve também as variantes/estoque já existentes
//
// É idempotente: o ID do documento é o slug. Sem --force, variantes que já existem NÃO são tocadas,
// então rodar de novo não zera o estoque que você ajustou.
import 'dotenv/config';
import { PRODUTOS_EXEMPLO } from '../public/js/produtos-exemplo.js';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const TAMANHOS = ['P', 'M', 'G', 'GG', 'XGG'];
// TODO: o dono define o estoque inicial real de cada tamanho. 10 é só um valor provisório de teste.
const ESTOQUE_INICIAL = 10;
// TODO: pesos/dimensões provisórios para o frete (Melhor Envio). Meça as peças embaladas e troque.
const EMBALAGEM = {
  tee:    { weightGrams: 350, dimensions: { lengthCm: 30, widthCm: 25, heightCm: 4 } },
  hoodie: { weightGrams: 800, dimensions: { lengthCm: 35, widthCm: 30, heightCm: 8 } },
};

/** Converte o formato legado do index.html para o modelo do Firestore (seção 4). */
export function paraProdutoFirestore(p, posicao) {
  return {
    slug: p.id,
    name: p.name,
    category: p.cat,                       // camisetas | moletons
    type: p.type,                          // tee | hoodie
    collection: p.col || '',
    badge: p.badge || '',                  // new | ltd | ''
    priceCents: Math.round(p.price * 100), // dinheiro SEMPRE em centavos inteiros
    compareAtCents: null,
    fit: p.fit,
    description: p.desc,
    features: p.feats,
    images: {
      front: p.photos.front,
      back: p.photos.back,
      detail: '',       // TODO: foto de detalhe (enviar pelo painel admin)
      garmentFlat: '',  // TODO: peça reta em fundo limpo — necessária para o provador virtual
    },
    gifUrl: p.gif || '',
    active: true,
    dropId: null,
    position: posicao, // ordem original da vitrine (campo extra, evita índice composto no Firestore)
    // Campos extras: dados do mockup SVG que o front gera quando a foto falha
    mockup: { color: p.color, ink: p.ink, word: p.word, bg: p.bg, crew: !!p.crew },
  };
}

export function paraVariantes(p) {
  const emb = EMBALAGEM[p.type];
  return TAMANHOS.map((size) => ({
    size,
    sku: `${p.id}-${size}`.toUpperCase(),
    stock: (p.soldout || []).includes(size) ? 0 : ESTOQUE_INICIAL, // esgotados do site atual ficam com 0
    reserved: 0,
    weightGrams: emb.weightGrams,
    dimensions: emb.dimensions,
  }));
}

async function main() {
  if (DRY) {
    for (const [i, p] of PRODUTOS_EXEMPLO.entries()) {
      const prod = paraProdutoFirestore(p, i);
      const vars = paraVariantes(p);
      console.log(`${prod.slug.padEnd(14)} R$ ${(prod.priceCents / 100).toFixed(2).padStart(7)}  estoque: ` +
        vars.map((v) => `${v.size}=${v.stock}`).join(' '));
    }
    console.log(`\n[dry-run] ${PRODUTOS_EXEMPLO.length} produtos / ${PRODUTOS_EXEMPLO.length * TAMANHOS.length} variantes. Nada foi gravado.`);
    return;
  }

  // import dinâmico: o dry-run funciona sem credenciais do Firebase
  const { db } = await import('./firebase.js');
  const { FieldValue } = await import('firebase-admin/firestore');

  for (const [i, p] of PRODUTOS_EXEMPLO.entries()) {
    const ref = db.collection('products').doc(p.id);
    const existe = (await ref.get()).exists;
    const dados = paraProdutoFirestore(p, i);
    // merge: atualiza dados do produto sem apagar campos que o painel admin venha a preencher
    await ref.set({ ...dados, ...(existe ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });

    let criadas = 0;
    for (const v of paraVariantes(p)) {
      const vref = ref.collection('variants').doc(v.size);
      if (!FORCE && (await vref.get()).exists) continue; // preserva estoque já ajustado
      await vref.set(v);
      criadas++;
    }
    console.log(`✔ ${p.id} (${existe ? 'atualizado' : 'criado'}, ${criadas} variantes gravadas)`);
  }
  console.log('\nSeed concluído.');
}

main().catch((e) => { console.error('Falha no seed:', e.message); process.exit(1); });
