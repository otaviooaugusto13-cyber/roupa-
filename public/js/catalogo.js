/* Taxonomia da loja: abas do menu, grupos de subcategorias e regra de filtro.
   Cada produto tem: gender ('m' | 'f' | 'u'), cat (grupo) e sub (subcategoria).
   Unissex ('u') aparece em Masculino e em Feminino. */

export const SUBS = {
  oversized:               'Camisetas Oversized',
  basica:                  'Camisetas Básicas / Slim',
  'regata-machao':         'Regata Machão',
  'regata-cavada':         'Regata Cavada',
  'manga-longa':           'Camisas Manga Longa',
  cropped:                 'Croppeds',
  canguru:                 'Moletom Canguru',
  careca:                  'Moletom Careca',
  'moletom-fem-oversized': 'Moletom Oversized',
  'moletom-fem-cropped':   'Moletom Cropped',
  'corta-vento':           'Corta-Vento / Jaquetas',
  dryfit:                  'Camisetas Dry-Fit',
  'regata-treino':         'Regatas de Treino',
  'short-treino':          'Shorts / Bermudas de Treino',
  legging:                 'Leggings',
  top:                     'Tops',
  cargo:                   'Calças Cargo',
  jogger:                  'Calças Jogger',
  'short-street':          'Shorts Streetwear',
};

const CAMISAS_M = ['oversized', 'basica', 'regata-machao', 'regata-cavada', 'manga-longa'];
const CAMISAS_F = ['oversized', 'basica', 'manga-longa', 'cropped'];

/* Abas principais. `groups` alimenta o dropdown (desktop) e a sanfona (mobile). */
export const MENU = [
  { id: 'lancamentos', label: 'Lançamentos', href: '#lancamentos' },
  { id: 'masculino', label: 'Masculino', groups: [
    { title: 'Camisas & Partes de Cima', subs: CAMISAS_M },
    { title: 'Moletons & Casacos', subs: ['canguru', 'careca', 'corta-vento'] },
    { title: 'Partes de Baixo', subs: ['cargo', 'jogger', 'short-street'] },
  ] },
  { id: 'feminino', label: 'Feminino', groups: [
    { title: 'Camisas & Partes de Cima', subs: CAMISAS_F },
    { title: 'Moletons & Casacos', subs: ['moletom-fem-oversized', 'moletom-fem-cropped', 'corta-vento'] },
    { title: 'Partes de Baixo', subs: ['cargo', 'jogger'] },
  ] },
  { id: 'treino', label: 'Roupas de Treino', groups: [
    { title: 'Performance', subs: ['dryfit', 'regata-treino', 'short-treino', 'legging', 'top'] },
  ] },
  { id: 'provador', label: 'Provador IA', tryon: true },
];

/** Filtros extras da vitrine (chips). */
export const EXTRAS = [['colecoes', 'Coleções'], ['limitados', 'Drop limitado']];

/** "masculino:canguru" → { tab:'masculino', sub:'canguru' }; "todos" → { tab:'todos', sub:'' } */
export function parseFilter(spec) {
  const [tab, sub = ''] = String(spec || 'todos').split(':');
  return { tab, sub };
}

/** Regra única de filtro, usada pela vitrine e pelos chips. */
export function matchesFilter(p, { tab, sub }) {
  let ok;
  switch (tab) {
    case 'lancamentos': ok = p.badge === 'new'; break;
    case 'masculino':   ok = p.gender === 'm' || p.gender === 'u'; break;
    case 'feminino':    ok = p.gender === 'f' || p.gender === 'u'; break;
    case 'treino':      ok = p.cat === 'treino'; break;
    case 'camisetas':   ok = p.cat === 'camisetas'; break;   // links antigos (rodapé)
    case 'moletons':    ok = p.cat === 'moletons'; break;
    case 'colecoes':    ok = !!p.col; break;
    case 'limitados':   ok = p.badge === 'ltd'; break;
    default:            ok = true;
  }
  return ok && (!sub || p.sub === sub);
}

/** Subcategorias que realmente têm produtos na aba (evita chip que leva a vitrine vazia). */
export function subsDaAba(tab, products) {
  const m = MENU.find((x) => x.id === tab);
  if (!m?.groups) return [];
  const todas = [...new Set(m.groups.flatMap((g) => g.subs))];
  return todas.filter((s) => products.some((p) => matchesFilter(p, { tab, sub: s })));
}

export const CAT_LABEL = { camisetas: 'Parte de cima', moletons: 'Moletom / Casaco', treino: 'Treino', baixo: 'Parte de baixo' };
export const GENDER_LABEL = { m: 'Masculino', f: 'Feminino', u: 'Unissex' };
