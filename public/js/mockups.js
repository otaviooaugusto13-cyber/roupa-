/* Mockups em SVG das peças (fallback das fotos, "GIF" de caimento e peça do Provador IA).
   Um desenho por `type` do produto. Tudo em um quadro de 400 x 480. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HOOD_BODY = 'M138 74 L72 98 L34 330 L80 340 L108 176 L106 440 C170 452 230 452 294 440 L292 176 L320 340 L366 330 L328 98 L262 74 Z';
const HOOD_CAP = 'M138 74 C128 18 272 18 262 74 C246 100 154 100 138 74 Z';

/* body: contorno | hood: capuz (opcional, com deslocamento y) | tag: marca na frente | art: [cx, cy, escala] arte das costas */
const TYPES = {
  tee:        { body: 'M140 52 C160 74 240 74 260 52 L330 80 L372 160 L320 184 L300 152 L302 430 C240 442 160 442 98 430 L100 152 L80 184 L28 160 L70 80 Z', tag: [246, 150], art: [200, 250, 1] },
  tank:       { body: 'M146 56 L172 56 C182 110 218 110 228 56 L254 56 C262 110 262 140 270 176 L276 432 C220 444 180 444 124 432 L130 176 C138 140 138 110 146 56 Z', tag: [226, 170], art: [200, 260, 0.8] },
  tankdeep:   { body: 'M150 56 L174 56 C184 112 216 112 226 56 L250 56 C256 120 252 150 262 190 L270 432 C220 444 180 444 130 432 L138 190 C148 150 144 120 150 56 Z', tag: [222, 180], art: [200, 260, 0.75] },
  longsleeve: { body: 'M140 52 C160 74 240 74 260 52 L330 80 L378 340 L330 352 L300 170 L302 430 C240 442 160 442 98 430 L100 170 L70 352 L22 340 L70 80 Z', tag: [246, 150], art: [200, 250, 1] },
  crop:       { body: 'M140 150 C160 172 240 172 260 150 L330 176 L368 244 L318 266 L300 236 L302 360 C240 372 160 372 98 360 L100 236 L82 266 L32 244 L70 176 Z', tag: [246, 232], art: [200, 300, 0.7] },
  hoodie:     { body: HOOD_BODY, hood: [HOOD_CAP, 0], tag: [246, 150], art: [200, 250, 1] },
  crophood:   { body: 'M138 120 L72 144 L34 330 L80 340 L108 222 L106 386 C170 398 230 398 294 386 L292 222 L320 340 L366 330 L328 144 L262 120 Z', hood: [HOOD_CAP, 46], tag: [246, 200], art: [200, 290, 0.8] },
  jacket:     { body: HOOD_BODY, tag: [246, 150], art: [200, 250, 0.8] },
  bra:        { body: 'M120 170 C150 140 170 120 176 96 L196 96 C198 140 202 140 204 96 L224 96 C230 120 250 140 280 170 C292 230 262 268 200 266 C138 268 108 230 120 170 Z', tag: [200, 232], art: null },
  shorts:     { body: 'M102 150 L298 150 L322 336 L216 350 L200 236 L184 350 L78 336 Z', tag: [124, 182], art: [200, 240, 0.55] },
  pants:      { body: 'M114 66 L286 66 L308 220 L302 440 L222 440 L204 240 L196 240 L178 440 L98 440 L92 220 Z', tag: [140, 110], art: [200, 150, 0.55] },
  jogger:     { body: 'M118 66 L282 66 L304 220 L274 440 L226 440 L204 244 L196 244 L174 440 L126 440 L96 220 Z', tag: [140, 110], art: [200, 150, 0.55] },
  legging:    { body: 'M132 66 L268 66 L274 220 L252 440 L218 440 L202 250 L198 250 L182 440 L148 440 L126 220 Z', tag: [150, 106], art: [200, 150, 0.5] },
};

/* Detalhes de costura/acabamento por tipo (traço escuro semitransparente). */
function detalhes(p, t, front) {
  const k = 'stroke="#000" stroke-opacity=".28" fill="none"';
  switch (p.type) {
    case 'tee': return `<path d="M140 52 C160 80 240 80 260 52" ${k} stroke-width="7"/>`;
    case 'tank': case 'tankdeep': return `<path d="M172 56 C182 110 218 110 228 56" ${k} stroke-width="6"/><path d="M${p.type === 'tank' ? '130 176 L124 432' : '138 190 L130 432'}" ${k} stroke-width="3"/>`;
    case 'longsleeve': return `<path d="M140 52 C160 80 240 80 260 52" ${k} stroke-width="7"/><path d="M26 336 L74 348 M374 336 L326 348" stroke="${p.ink}" stroke-width="6" stroke-opacity=".8" fill="none"/>`;
    case 'crop': return `<path d="M140 150 C160 178 240 178 260 150" ${k} stroke-width="7"/><path d="M100 350 C160 364 240 364 300 350" ${k} stroke-width="8"/>`;
    case 'hoodie': return (front ? `<path d="M140 330 L260 330 L276 402 L124 402 Z" ${k} stroke-width="2"/>` : '')
      + (!p.crew && front ? `<path d="M184 92 v70 M216 92 v70" stroke="${p.ink}" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/>` : '')
      + `<path d="M108 420 C170 432 230 432 292 420" ${k} stroke-width="10"/>` + (p.crew ? `<path d="M150 74 C168 96 232 96 250 74" ${k} stroke-width="10"/>` : '');
    case 'crophood': return (front ? `<path d="M184 138 v62 M216 138 v62" stroke="${p.ink}" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/><path d="M130 296 L270 296 L280 350 L120 350 Z" ${k} stroke-width="2"/>` : '')
      + `<path d="M106 372 C170 384 230 384 294 372" ${k} stroke-width="10"/>`;
    case 'jacket': return `<path d="M150 74 C168 98 232 98 250 74" ${k} stroke-width="10"/>${front ? `<path d="M200 92 V440" stroke="${p.ink}" stroke-width="3" opacity=".8" fill="none"/><path d="M124 340 V398 M276 340 V398" ${k} stroke-width="3"/>` : ''}<path d="M44 300 L76 308 M356 300 L324 308" stroke="${p.ink}" stroke-width="5" opacity=".75" fill="none"/>`;
    case 'bra': return `<path d="M176 96 C170 130 150 150 128 168 M224 96 C230 130 250 150 272 168" ${k} stroke-width="4"/><path d="M130 240 C170 258 230 258 270 240" ${k} stroke-width="5"/>`;
    case 'shorts': return `<path d="M102 162 L298 162" ${k} stroke-width="9"/><path d="M200 162 L200 236" ${k} stroke-width="3"/>${front ? `<path d="M186 166 v36 M214 166 v36" stroke="${p.ink}" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/>` : ''}<path d="M84 322 L204 338 M316 322 L196 338" ${k} stroke-width="6"/>`;
    case 'pants': return `<path d="M112 84 L288 84" ${k} stroke-width="9"/><path d="M200 84 L200 240" ${k} stroke-width="3"/>${front ? `<path d="M104 250 h50 v62 h-50 z M246 250 h50 v62 h-50 z" ${k} stroke-width="3"/>` : ''}<path d="M100 424 L178 424 M222 424 L300 424" ${k} stroke-width="6"/>`;
    case 'jogger': return `<path d="M116 84 L284 84" ${k} stroke-width="9"/>${front ? `<path d="M186 88 v34 M214 88 v34" stroke="${p.ink}" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/>` : ''}<path d="M128 422 L174 422 M226 422 L272 422" ${k} stroke-width="12"/>`;
    case 'legging': return `<path d="M130 84 L270 84" ${k} stroke-width="9"/><path d="M148 100 C140 220 160 340 164 430 M252 100 C260 220 240 340 236 430" ${k} stroke-width="2"/>`;
    default: return '';
  }
}

/** Desenha a peça. Devolve { defs, svg, body } (body = contorno, usado como clipPath). */
export function garment(p, view, uid, brand) {
  const t = TYPES[p.type] || TYPES.tee;
  const front = view === 'front';
  const defs = `<linearGradient id="sh${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
    <pattern id="kn${uid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="none"/><path d="M0 0v6" stroke="#000" stroke-opacity=".08" stroke-width="2"/></pattern>`;

  let capuz = '';
  if (t.hood && !(p.type === 'hoodie' && p.crew)) {
    const [cap, dy] = t.hood;
    capuz = `<g transform="translate(0 ${dy})"><path d="${cap}" fill="${p.color}"/><path d="${cap}" fill="#000" opacity=".28"/></g>`;
  }
  const folds = (['bra', 'shorts', 'pants', 'jogger', 'legging', 'tank', 'tankdeep'].includes(p.type)) ? ''
    : `<path d="M150 200 C170 260 160 340 170 420 M250 210 C236 270 246 350 236 420" stroke="#000" stroke-opacity=".10" stroke-width="6" fill="none"/>`;

  let print;
  if (front || !t.art) {
    const [tx, ty] = t.tag;
    print = `<g fill="${p.ink}"><circle cx="${tx}" cy="${ty}" r="7"/><text x="${tx + 12}" y="${ty + 5}" font-family="Arial Black,Arial,sans-serif" font-size="13" font-weight="900" letter-spacing="1">${esc(brand)}</text></g>`;
  } else {
    const [cx, cy, s] = t.art;
    const fs = p.word.length > 6 ? 34 : 46;
    print = `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-200 -250)"><circle cx="200" cy="250" r="78" fill="none" stroke="${p.ink}" stroke-width="2" opacity=".55"/><circle cx="200" cy="250" r="56" fill="none" stroke="${p.ink}" stroke-width="1.5" opacity=".35"/>
      <path d="M118 250 h20 l8 -18 l10 36 l10 -48 l10 60 l10 -40 l8 22 l8 -12 l8 0 h90" fill="none" stroke="${p.ink}" stroke-width="3" opacity=".9"/>
      <text x="200" y="${fs > 40 ? 222 : 216}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${fs}" fill="${p.ink}" letter-spacing="-1">${esc(p.word)}</text>
      <text x="200" y="320" text-anchor="middle" font-family="Courier New,monospace" font-size="11" fill="${p.ink}" opacity=".8" letter-spacing="3">${esc(brand)} // DROP 07</text></g>`;
  }
  return {
    defs,
    body: t.body,
    svg: `${capuz}<path d="${t.body}" fill="${p.color}"/>${detalhes(p, t, front)}${folds}${print}<path d="${t.body}" fill="url(#kn${uid})"/><path d="${t.body}" fill="url(#sh${uid})"/>`,
  };
}

let n = 0;
/** SVG completo, só a peça (fundo transparente) — usado como sobreposição no Provador IA. */
export function pecaSVG(p, view, brand) {
  const g = garment(p, view, 'z' + (n++), brand);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>${g.defs}</defs>${g.svg}</svg>`;
}
