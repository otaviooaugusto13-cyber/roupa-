import { carregarProdutos, carregarConfig } from './api.js';
import { criarCheckout } from './checkout.js';
import { htmlCalculadoraFrete, ligarCalculadoraFrete } from './frete.js';
import { garment as garmentBase } from './mockups.js';
import { MENU, SUBS, EXTRAS, CAT_LABEL, GENDER_LABEL, parseFilter, matchesFilter, subsDaAba } from './catalogo.js';
import { criarProvador } from './provador.js';

/* =========================================================
   CONFIGURAÇÃO — troque aqui o nome da marca e os produtos
   ========================================================= */
const BRAND = 'NØX';
const CFG = await carregarConfig();            // valores de negócio vêm do servidor (.env)
const FREE_SHIP = CFG.freteGratisCents / 100;   // frete grátis a partir de (R$)
const INSTALLMENTS = CFG.maxParcelas;           // parcelas sem juros
const PIX_OFF = CFG.pixDescontoPercent / 100;   // desconto no Pix
const SIZES = ['PP','P','M','G','GG','XGG'];

/* PRODUCTS vem da API (/api/products) com fallback em js/produtos-exemplo.js */
const PRODUCTS = await carregarProdutos();

const EDITORIAL = [
  { id:'voltage', view:'detail', eyebrow:'Tecido', title:'Peso que você sente', word:'240G',
    text:'Algodão peruano de fibra longa, penteado e pré-encolhido. Encorpado no corpo, macio na pele, sem perder o caimento depois da lavagem.',
    specs:[['240','g/m²'],['30/1','Fio penteado'],['2,5','cm de gola']] },
  { id:'night-shift', view:'back', eyebrow:'Construção', title:'Feito para a madrugada', word:'NIGHT', flip:true,
    text:'Moletom três cabos com interior felpado, capuz em forro duplo e punhos que não laceiam. A peça que você não tira até o sol nascer.',
    specs:[['420','g/m²'],['3','Cabos'],['2x','Capuz forrado']] },
  { id:'static-bloom', view:'back', eyebrow:'Estampa', title:'Silk que tem relevo', word:'BLOOM',
    text:'Arte floral distorcida em silk de alta densidade, aplicada camada por camada. Passe a mão: a estampa tem volume.',
    specs:[['6','Camadas'],['300','Peças'],['Nº','Numerada']] },
];

/* ========================================================= */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const byId = (id) => PRODUCTS.find(p => p.id === id);
const brl = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
const money = (v) => brl.format(v);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const IC = {
  arrow:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
  check:'<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  plus:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>',
  minus:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  trash:'<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  truck:'<svg class="i" viewBox="0 0 24 24"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
  ruler:'<svg class="i" viewBox="0 0 24 24"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/></svg>',
  bag:'<svg class="i" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  zap:'<svg class="i" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  sparkle:'<svg class="i" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  down:'<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  swap:'<svg class="i" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>',
};

/* ---------- Mockups em SVG (fallback das fotos e "GIF" de caimento) ---------- */
const garment = (p, view, uid) => garmentBase(p, view, uid, BRAND);
let uidN = 0;
function mockURI(p, view){
  const g = garment(p, view === 'detail' ? 'back' : view, 'm' + (uidN++));
  const vb = view === 'detail' ? '70 120 260 312' : '0 0 400 480';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></radialGradient>${g.defs}</defs><rect x="0" y="0" width="400" height="480" fill="url(#bg)"/><ellipse cx="200" cy="458" rx="150" ry="12" fill="#000" opacity=".35"/>${g.svg}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function motionSVG(p){
  const u = 'a' + (uidN++);
  const g = garment(p, 'back', u);
  return `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${g.defs}<clipPath id="cl${u}"><path d="${g.body}"/></clipPath><linearGradient id="sn${u}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g class="sway">${g.svg}<g clip-path="url(#cl${u})"><rect class="shine" x="60" y="0" width="140" height="480" fill="url(#sn${u})" transform="translate(-420 0)"/></g>
    <circle class="pulse" cx="200" cy="250" r="86" fill="none" stroke="${p.ink}" stroke-width="2"/></g></svg>`;
}
function motionBlock(p, cap=true){
  const media = p.gif ? `<img src="${esc(p.gif)}" alt="" data-gif="${p.id}">` : motionSVG(p);
  return `<div class="motion">${media}${cap ? `<div class="cap"><span class="rec">Caimento</span><span>${esc(p.fit)} · ${esc(p.name.split(' ')[0])}</span></div>` : ''}</div>`;
}
function img(p, view, cls='', lazy=true){
  const src = view === 'detail' ? (p.photos.detail || p.photos.back) : p.photos[view];
  return `<img class="${cls}" src="${esc(src || mockURI(p, view))}" data-mock="${p.id}|${view}" alt="${esc(p.name)} — ${view === 'front' ? 'frente' : view === 'back' ? 'costas' : 'detalhe'}" ${lazy ? 'loading="lazy"' : ''} decoding="async" draggable="false">`;
}
// Foto falhou (URL quebrada, offline ou bloqueada) → troca pelo mockup gerado.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  if (t.dataset.mock && !t.dataset.fb) {
    t.dataset.fb = '1';
    const [id, view] = t.dataset.mock.split('|');
    const p = byId(id);
    if (p) { t.src = mockURI(p, view); if (view === 'detail') t.style.objectPosition = 'center'; }
  } else if (t.dataset.gif) {
    const p = byId(t.dataset.gif);
    if (p) t.outerHTML = motionSVG(p);
  }
}, true);

/* ---------- Estado ---------- */
let cart = store.get('nox-cart', []).filter(i => byId(i.id) && SIZES.includes(i.size));
let filter = { tab:'todos', sub:'' };
let pdp = { id:null, size:null, view:0 };
let lastFocus = null;

/* ---------- Tema ---------- */
const root = document.documentElement;
const mq = window.matchMedia('(prefers-color-scheme: light)');
function isDark(){ const t = root.dataset.theme; return t ? t === 'dark' : !mq.matches; }
function syncToggle(){ const b = $('#btn-theme'); const d = isDark(); b.setAttribute('aria-pressed', String(d)); b.setAttribute('aria-label', d ? 'Mudar para modo claro' : 'Mudar para modo escuro'); }
const savedTheme = store.get('nox-theme', null);
if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;
syncToggle();
mq.addEventListener?.('change', syncToggle);
$('#btn-theme').addEventListener('click', () => { const next = isDark() ? 'light' : 'dark'; root.dataset.theme = next; store.set('nox-theme', next); syncToggle(); });

/* ---------- Marca ---------- */
$$('.brand-name').forEach(el => el.textContent = BRAND);

/* ---------- Menu: mega-menu (desktop) e sanfona (mobile) ---------- */
const subsComProduto = (tab, g) => g.subs.filter(k => PRODUCTS.some(p => matchesFilter(p, { tab, sub:k })));
$('#nav').innerHTML = MENU.map(m => {
  if (m.groups) {
    const cols = m.groups.map(g => { const subs = subsComProduto(m.id, g); return subs.length ? `<div class="mm-col"><h4>${esc(g.title)}</h4>${subs.map(k => `<a href="#vitrine" data-filter="${m.id}:${k}">${esc(SUBS[k])}</a>`).join('')}</div>` : ''; }).join('');
    return `<div class="nav-item"><a href="#vitrine" class="nav-top" data-filter="${m.id}">${esc(m.label)} ${IC.down}</a><div class="mega"><div class="mega-in">${cols}<a class="mm-all" href="#vitrine" data-filter="${m.id}">Ver tudo em ${esc(m.label)} ${IC.arrow}</a></div></div></div>`;
  }
  if (m.tryon) return `<div class="nav-item"><button class="nav-top" data-tryon="">${esc(m.label)} <span class="ia">IA</span></button></div>`;
  return `<div class="nav-item"><a class="nav-top" href="${m.href}">${esc(m.label)}</a></div>`;
}).join('');
$('#mnav-list').innerHTML = MENU.map(m => {
  if (m.groups) return `<div class="acc"><button class="acc-h" data-acc aria-expanded="false">${esc(m.label)} ${IC.down}</button><div class="acc-b" hidden>${m.groups.map(g => { const subs = subsComProduto(m.id, g); return subs.length ? `<h4>${esc(g.title)}</h4>${subs.map(k => `<a href="#vitrine" data-filter="${m.id}:${k}" data-close="mnav">${esc(SUBS[k])}</a>`).join('')}` : ''; }).join('')}<a href="#vitrine" data-filter="${m.id}" data-close="mnav" class="all">Ver tudo ${IC.arrow}</a></div></div>`;
  if (m.tryon) return `<button class="acc-h" data-tryon="" data-close="mnav">${esc(m.label)} <span class="ia">IA</span></button>`;
  return `<a href="${m.href}" data-close="mnav">${esc(m.label)} ${IC.arrow}</a>`;
}).join('');

/* ---------- Hero ---------- */
$('#hero-tee').innerHTML = motionSVG(byId('voltage') || PRODUCTS.find(p => p.type === 'tee') || PRODUCTS[0]);
const hv = $('#hero-video');
if (hv.dataset.src) { hv.hidden = false; hv.src = hv.dataset.src; hv.addEventListener('error', () => { hv.hidden = true; }); }
const tick = `FRETE GRÁTIS ACIMA DE ${money(FREE_SHIP)} <i>✦</i> ${INSTALLMENTS}X SEM JUROS <i>✦</i> ${Math.round(PIX_OFF*100)}% OFF NO PIX <i>✦</i> POSTAGEM EM 24H <i>✦</i> DROP 07 · 300 PEÇAS <i>✦</i> `;
$('#ticker').innerHTML = `<span>${tick}</span><span>${tick}</span>`;

/* ---------- Card ---------- */
const catLabel = CAT_LABEL;
const subLabel = (p) => SUBS[p.sub] || catLabel[p.cat] || '';
function card(p){
  const badge = p.badge === 'new' ? '<span class="badge">Novo</span>' : p.badge === 'ltd' ? '<span class="badge ltd">Drop limitado</span>' : '';
  return `<article class="card" data-id="${p.id}">
    <button class="card-media" data-open="${p.id}" aria-label="Ver ${esc(p.name)}">
      ${img(p,'front')}${img(p,'back','alt')}${badge}
      <span class="quick">Ver produto ${IC.arrow}</span>
    </button>
    <div class="card-info">
      <h3>${esc(p.name)}</h3>
      <p class="price">${money(p.price)}</p>
      <p class="meta">${esc(subLabel(p))} · ${esc(p.fit)}</p>
      <p class="inst">${INSTALLMENTS}x ${money(p.price / INSTALLMENTS)}</p>
    </div>
  </article>`;
}

/* ---------- Carrossel ---------- */
const track = $('#track');
const carItems = [...PRODUCTS].sort((a,b) => (b.badge === 'new') - (a.badge === 'new'));
track.innerHTML = carItems.map(card).join('');
const dotsEl = $('#dots');
function pages(){ return Math.max(1, Math.ceil((track.scrollWidth - 4) / track.clientWidth)); }
function curPage(){ const max = track.scrollWidth - track.clientWidth; if (max <= 0) return 0; if (track.scrollLeft >= max - 4) return pages() - 1; return Math.round(track.scrollLeft / track.clientWidth); }
function buildDots(){
  const n = pages();
  dotsEl.innerHTML = Array.from({length:n}, (_, i) => `<button role="tab" aria-label="Página ${i+1}" data-page="${i}"></button>`).join('');
  dotsEl.hidden = n < 2;
  syncCar();
}
function syncCar(){
  const c = curPage();
  $$('button', dotsEl).forEach((d, i) => { d.classList.toggle('on', i === c); d.setAttribute('aria-selected', String(i === c)); });
  $('#car-prev').disabled = track.scrollLeft <= 4;
  $('#car-next').disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
}
dotsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) track.scrollTo({ left: +b.dataset.page * track.clientWidth, behavior:'smooth' }); });
$('#car-prev').addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * .9, behavior:'smooth' }));
$('#car-next').addEventListener('click', () => track.scrollBy({ left: track.clientWidth * .9, behavior:'smooth' }));
let st;
track.addEventListener('scroll', () => { cancelAnimationFrame(st); st = requestAnimationFrame(syncCar); }, { passive:true });
// arrastar com mouse (no touch o scroll nativo já faz swipe)
let drag = null, moved = false;
track.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  drag = { x: e.clientX, left: track.scrollLeft }; moved = false;
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('drag'); }
  if (moved) track.scrollLeft = drag.left - dx;
});
window.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  if (moved) {
    track.classList.remove('drag');
    const w = track.querySelector('.card')?.getBoundingClientRect().width || 300;
    track.scrollTo({ left: Math.round(track.scrollLeft / (w + 18)) * (w + 18), behavior:'smooth' });
  }
});
track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
window.addEventListener('resize', () => { buildDots(); });
buildDots();

/* ---------- Editorial ---------- */
// Telas editoriais de produtos desativados são omitidas (o texto é específico de cada peça).
$('#editorial').innerHTML = EDITORIAL.filter(ed => byId(ed.id)).map(ed => {
  const p = byId(ed.id);
  return `<section class="ed${ed.flip ? ' flip' : ''}" style="--ed-bg:${p.bg[1]}" aria-label="${esc(ed.title)}">
    <div class="ed-word" aria-hidden="true">${esc(ed.word)}</div>
    <div class="ed-media">${img(p, ed.view, '', true)}</div>
    <div class="ed-copy">
      <span class="eyebrow">${esc(ed.eyebrow)} · ${esc(p.name)}</span>
      <h2>${esc(ed.title)}</h2>
      <p>${esc(ed.text)}</p>
      <div class="specs">${ed.specs.map(s => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('')}</div>
      <button class="btn btn-line" data-open="${p.id}">Ver produto · ${money(p.price)} ${IC.arrow}</button>
    </div>
  </section>`;
}).join('');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const parallax = $$('.ed-media img');
let pt;
function runParallax(){
  if (reduce.matches) return;
  const vh = window.innerHeight;
  parallax.forEach(im => {
    const r = im.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const prog = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
    im.style.transform = `translate3d(0, ${(prog * -8).toFixed(2)}%, 0)`;
  });
}
window.addEventListener('scroll', () => { cancelAnimationFrame(pt); pt = requestAnimationFrame(runParallax); }, { passive:true });
runParallax();

/* ---------- Vitrine ---------- */
const TABS = [['todos','Todos'], ['lancamentos','Lançamentos'], ['masculino','Masculino'], ['feminino','Feminino'], ['treino','Treino'], ...EXTRAS];
function renderChips(){
  $('#chips').innerHTML = TABS.map(([k, l]) => `<button class="chip" data-chip="${k}" aria-pressed="${k === filter.tab}">${l}</button>`).join('');
  const subs = subsDaAba(filter.tab, PRODUCTS), sc = $('#subchips');
  sc.hidden = !subs.length;
  sc.innerHTML = subs.length
    ? `<button class="chip sm" data-chip="${filter.tab}" aria-pressed="${!filter.sub}">Todas</button>` + subs.map(k => `<button class="chip sm" data-chip="${filter.tab}:${k}" aria-pressed="${filter.sub === k}">${esc(SUBS[k])}</button>`).join('')
    : '';
}
const motionTxt = (p) => p.type === 'tee' ? `${esc(p.name)} em movimento: ombro caído, barra reta e tecido que não cola no corpo.` : `${esc(p.name)} em movimento: caimento e tecido em detalhe.`;
function renderGrid(){
  const list = PRODUCTS.filter(p => matchesFilter(p, filter));
  const html = list.map(card);
  // Slots de GIF/movimento entre os produtos
  if (list.length > 2) {
    const m = list.find(p => p.type === 'tee') || list[0];
    html.splice(2, 0, `<div class="motion-cell">${motionBlock(m)}<p>${motionTxt(m)}</p></div>`);
  }
  if (list.length > 6) {
    const h = list.find(p => p.type === 'hoodie') || list[1];
    html.splice(7, 0, `<div class="motion-cell">${motionBlock(h)}<p>${h.type === 'hoodie' ? `${esc(h.name)}: capuz estruturado que mantém a forma.` : motionTxt(h)}</p></div>`);
  }
  $('#grid').innerHTML = html.join('') || '<div class="empty">Nenhuma peça nesta categoria agora. O próximo drop sai em breve.</div>';
  $('#grid-count').textContent = `${list.length} ${list.length === 1 ? 'peça' : 'peças'}`;
  renderChips();
}
function setFilter(spec){
  filter = parseFilter(spec); renderGrid();
  $(`#chips [data-chip="${filter.tab}"]`)?.scrollIntoView({ block:'nearest', inline:'center' });
}
['#chips', '#subchips'].forEach(sel => $(sel).addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) setFilter(c.dataset.chip); }));
renderGrid();

/* ---------- Overlays ---------- */
function openOv(id){
  lastFocus = document.activeElement;
  const el = document.getElementById(id);
  el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
  root.classList.add('lock');
  setTimeout(() => { (el.querySelector('input:not([type=hidden]), [autofocus]') || el.querySelector('button.x, .ibtn, button'))?.focus({ preventScroll:true }); }, 60);
}
function closeOv(id){
  const el = document.getElementById(id);
  if (!el.classList.contains('open')) return;
  el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
  if (!$$('.ov.open, .mnav.open').length) root.classList.remove('lock');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll:true });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $$('.ov.open, .mnav.open');
  if (open.length) closeOv(open[open.length - 1].id);
});
$('#btn-menu').addEventListener('click', () => openOv('mnav'));
$('#btn-cart').addEventListener('click', () => { renderCart(); openOv('cart'); });
$('#btn-search').addEventListener('click', () => { renderSearch(''); $('#q').value = ''; openOv('srch'); });

/* ---------- PDP ---------- */
const VIEWS = [['front','Frente'],['back','Costas'],['detail','Detalhe'],['motion','Caimento']];
function openPDP(id){
  const p = byId(id); if (!p) return;
  pdp = { id, size:null, view:0 };
  $('#thumbs').innerHTML = VIEWS.map(([v, l], i) => `<button class="thumb" data-view="${i}" aria-pressed="${i === 0}" aria-label="${l}">${v === 'motion' ? motionBlock(p, false) : img(p, v, '', false)}<span class="tag">${l}</span></button>`).join('');
  setView(0);
  const badge = p.badge === 'new' ? 'Novo' : p.badge === 'ltd' ? 'Drop limitado' : (p.col ? 'Coleção ' + p.col : subLabel(p));
  $('#pdp-info').innerHTML = `
    <div><span class="eyebrow">${esc(badge)}${p.col && p.badge ? ' · Coleção ' + esc(p.col) : ''}</span><h2 id="pdp-title">${esc(p.name)}</h2></div>
    <div class="pr">
      <span class="big">${money(p.price)}</span>
      <span class="sub">ou ${INSTALLMENTS}x de ${money(p.price / INSTALLMENTS)} sem juros</span>
      <span class="sub"><span class="pix">${money(p.price * (1 - PIX_OFF))} no Pix</span> (${Math.round(PIX_OFF*100)}% off)</span>
    </div>
    <p class="desc">${esc(p.desc)}</p>
    <ul class="feats">${p.feats.map(f => `<li>${IC.check}<span>${esc(f)}</span></li>`).join('')}</ul>
    <div>
      <div class="sz-head"><b>Tamanho</b><button class="guide-btn" id="guide-btn" aria-expanded="false" aria-controls="guide">${IC.ruler} Guia de medidas</button></div>
      <div class="sizes" id="sizes" role="group" aria-label="Tamanho">${SIZES.map(s => {
        const out = p.soldout.includes(s);
        return `<button class="size" data-size="${s}" aria-pressed="false" ${out ? 'disabled aria-label="' + s + ' esgotado" title="Esgotado"' : ''}>${s}</button>`;
      }).join('')}</div>
      <div class="sz-msg" id="sz-msg">${p.soldout.length ? 'Tamanhos riscados estão esgotados.' : 'Todos os tamanhos disponíveis.'}</div>
      <div class="guide" id="guide" hidden>${guideTable(p)}</div>
    </div>
    <button class="btn btn-neon tryon-btn" data-tryon="${esc(p.id)}">${IC.sparkle} Provar no corpo com IA (2D / 3D)</button>
    <div class="buy">
      <button class="btn btn-line" id="add">${IC.bag} Adicionar ao carrinho</button>
      <button class="btn btn-neon" id="buy-now">${IC.zap} Comprar agora</button>
    </div>
    ${htmlCalculadoraFrete()}`;
  ligarCalculadoraFrete($('#pdp-info'), () => ({ slug: p.id, size: pdp.size || SIZES.find((t) => !p.soldout.includes(t)) || 'M' }), money);
  $('#pdp .dialog').scrollTop = 0;
  if (!$('#pdp').classList.contains('open')) openOv('pdp');
}
function guideTable(p){
  const hood = ['hoodie','crophood','jacket'].includes(p.type);
  const bottom = ['shorts','pants','jogger','legging'].includes(p.type);
  const rows = hood ? [[59,68,59],[62,70,60],[65,72,62],[68,74,64],[71,76,66],[74,78,68]]
    : bottom ? SIZES.map((_, i) => [34 + i * 2, 48 + i * 2, (p.type === 'shorts' ? 44 : 96) + i * 2])
    : [[55,70,22],[58,72,23],[61,74,24],[64,76,25],[67,78,26],[70,80,27]];
  const heads = hood ? ['Largura','Comprimento','Manga'] : bottom ? ['Cintura (meia)','Quadril (meia)','Comprimento'] : ['Largura','Comprimento','Manga curta'];
  return `<table><thead><tr><th>Tam.</th>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${SIZES.map((s, i) => `<tr><td>${s}</td>${rows[i].map(v => `<td>${v} cm</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p>Medidas da peça aberta, em cm (±1,5). Modelagem ${esc(String(p.fit).toLowerCase())}: se prefere ajustado, escolha um tamanho abaixo.</p>`;
}
function setView(i){
  const p = byId(pdp.id); pdp.view = i;
  const [v] = VIEWS[i];
  $('#gal-main').innerHTML = v === 'motion' ? motionBlock(p) : img(p, v, '', false);
  $$('#thumbs .thumb').forEach((t, k) => t.setAttribute('aria-pressed', String(k === i)));
}
$('#thumbs').addEventListener('click', (e) => { const t = e.target.closest('[data-view]'); if (t) setView(+t.dataset.view); });
$('#pdp-info').addEventListener('click', (e) => {
  const s = e.target.closest('[data-size]');
  if (s && !s.disabled) {
    pdp.size = s.dataset.size;
    $$('#sizes .size').forEach(b => b.setAttribute('aria-pressed', String(b === s)));
    const m = $('#sz-msg'); m.classList.remove('err'); m.textContent = `Tamanho ${pdp.size} selecionado.`;
    return;
  }
  if (e.target.closest('#guide-btn')) {
    const g = $('#guide'), b = $('#guide-btn'); g.hidden = !g.hidden; b.setAttribute('aria-expanded', String(!g.hidden));
    return;
  }
  if (e.target.closest('#add')) { if (needSize()) return; addToCart(pdp.id, pdp.size); closeOv('pdp'); renderCart(); setTimeout(() => openOv('cart'), 120); return; }
  if (e.target.closest('#buy-now')) { if (needSize()) return; addToCart(pdp.id, pdp.size); closeOv('pdp'); setTimeout(openCheckout, 120); }
});
function needSize(){
  if (pdp.size) return false;
  const m = $('#sz-msg'), g = $('#sizes');
  m.textContent = 'Escolha um tamanho para continuar.'; m.classList.add('err');
  g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
  return true;
}

/* ---------- Carrinho ---------- */
function save(){ store.set('nox-cart', cart); }
function totals(){
  const qty = cart.reduce((a, i) => a + i.qty, 0);
  const sub = cart.reduce((a, i) => a + byId(i.id).price * i.qty, 0);
  return { qty, sub, total: sub };   // o frete é calculado de verdade no checkout (Melhor Envio)
}
function addToCart(id, size){
  const f = cart.find(i => i.id === id && i.size === size);
  if (f) f.qty = Math.min(f.qty + 1, 10); else cart.push({ id, size, qty:1 });
  save(); updateCount(true);
  toast(`${byId(id).name} (${size}) no carrinho`);
}
function updateCount(bump){
  const { qty } = totals(); const c = $('#cart-count');
  c.textContent = qty; c.classList.toggle('on', qty > 0);
  $('#btn-cart').setAttribute('aria-label', `Abrir carrinho, ${qty} ${qty === 1 ? 'item' : 'itens'}`);
  if (bump) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
}
function renderCart(){
  const t = totals();
  $('#cart-n').textContent = t.qty ? `(${t.qty})` : '';
  if (!cart.length) {
    $('#items').innerHTML = `<div class="cart-empty">${IC.bag}<p>Seu carrinho está vazio.</p><a href="#vitrine" class="btn btn-neon" data-close="cart">Ver a vitrine</a></div>`;
    $('#cart-foot').hidden = true;
    return;
  }
  $('#cart-foot').hidden = false;
  $('#items').innerHTML = cart.map((i, k) => { const p = byId(i.id); return `
    <div class="item">
      <button class="th" data-open="${p.id}" aria-label="Ver ${esc(p.name)}">${img(p, 'front', '', false)}</button>
      <div><h4>${esc(p.name)}</h4><p class="sm">Tam. ${i.size} · ${money(p.price)}</p>
        <div class="qty"><button data-dec="${k}" aria-label="Diminuir quantidade">${IC.minus}</button><span>${i.qty}</span><button data-inc="${k}" aria-label="Aumentar quantidade">${IC.plus}</button></div></div>
      <div class="rt"><button class="rm" data-rm="${k}" aria-label="Remover ${esc(p.name)}">${IC.trash}</button><b>${money(p.price * i.qty)}</b></div>
    </div>`; }).join('');
  $('#cart-foot').innerHTML = `
    <div class="row tot"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="row"><span>Frete</span><span>Calculado no checkout</span></div>
    <div class="row"><span>ou ${INSTALLMENTS}x de ${money(t.total / INSTALLMENTS)}</span><span>${money(t.total * (1 - PIX_OFF))} no Pix</span></div>
    <button class="btn btn-neon" id="checkout">Finalizar compra ${IC.arrow}</button>`;
}
$('#items').addEventListener('click', (e) => {
  const d = e.target.closest('[data-dec]'), n = e.target.closest('[data-inc]'), r = e.target.closest('[data-rm]');
  if (d) { const i = cart[+d.dataset.dec]; i.qty--; if (i.qty < 1) cart.splice(+d.dataset.dec, 1); }
  else if (n) { const i = cart[+n.dataset.inc]; i.qty = Math.min(i.qty + 1, 10); }
  else if (r) { cart.splice(+r.dataset.rm, 1); }
  else return;
  save(); updateCount(false); renderCart();
});
$('#cart-foot').addEventListener('click', (e) => { if (e.target.closest('#checkout')) { closeOv('cart'); setTimeout(openCheckout, 120); } });

/* ---------- Checkout (real: ver js/checkout.js) ---------- */
const checkout = criarCheckout({
  $, esc, money, IC, openOv, byId, cfg: CFG,
  getCart: () => cart,
  limparCarrinho: () => { cart = []; save(); updateCount(false); renderCart(); },
});
function openCheckout(){ checkout.abrir(); }

/* ---------- Provador IA (js/provador.js + js/virtualTryOnService.js) ---------- */
const tryon = criarProvador({
  $, $$, esc, money, IC, openOv, closeOv, byId, PRODUCTS, SIZES, BRAND,
  adicionar: (id, size) => { addToCart(id, size); closeOv('tryon'); closeOv('pdp'); renderCart(); setTimeout(() => openOv('cart'), 120); },
  comprarAgora: (id, size) => { addToCart(id, size); closeOv('tryon'); closeOv('pdp'); setTimeout(openCheckout, 120); },
});

/* ---------- Busca ---------- */
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function renderSearch(q){
  const n = norm(q.trim());
  const list = n ? PRODUCTS.filter(p => norm(`${p.name} ${p.cat} ${SUBS[p.sub] || ''} ${GENDER_LABEL[p.gender] || ''} ${p.fit} ${p.col} ${p.desc}`).includes(n)) : PRODUCTS.slice(0, 4);
  $('#results').innerHTML = (n ? '' : '<p class="hint" style="grid-column:1/-1;margin:0">Mais procurados</p>') + (list.length ? list.map(p => `<button class="res" data-open="${p.id}"><span class="th">${img(p,'front','',false)}</span><span><b>${esc(p.name)}</b><span>${esc(subLabel(p))} · ${money(p.price)}</span></span></button>`).join('') : `<p class="hint">Nada encontrado para “${esc(q)}”. Tente “moletom”, “legging” ou “oversized”.</p>`);
}
$('#q').addEventListener('input', (e) => renderSearch(e.target.value));

/* ---------- Delegação global ---------- */
document.addEventListener('click', (e) => {
  const op = e.target.closest('[data-open]');
  if (op) { e.preventDefault(); $$('.ov.open').forEach(o => { if (o.id !== 'pdp') closeOv(o.id); }); openPDP(op.dataset.open); return; }
  const ac = e.target.closest('[data-acc]');
  if (ac) { const b = ac.nextElementSibling; b.hidden = !b.hidden; ac.setAttribute('aria-expanded', String(!b.hidden)); return; }
  const ty = e.target.closest('[data-tryon]');
  if (ty) { e.preventDefault(); $$('.mnav.open').forEach(o => closeOv(o.id)); $$('.ov.open').forEach(o => { if (o.id !== 'pdp' && o.id !== 'tryon') closeOv(o.id); }); tryon.abrir(ty.dataset.tryon || null, ty.dataset.tryon ? pdp.size : null); return; }
  const fl = e.target.closest('[data-filter]');
  if (fl) { setFilter(fl.dataset.filter); const it = fl.closest('.nav-item'); if (it) { it.classList.add('shut'); setTimeout(() => it.classList.remove('shut'), 500); } }
  const gd = e.target.closest('[data-guide]');
  if (gd) { e.preventDefault(); openPDP(PRODUCTS[0].id); setTimeout(() => $('#guide-btn')?.click(), 80); return; }
  const cl = e.target.closest('[data-close]');
  if (cl) closeOv(cl.dataset.close);
});
$('#news').addEventListener('submit', (e) => { e.preventDefault(); toast('Pronto! Você vai receber o aviso do próximo drop.'); e.target.reset(); });

/* ---------- Toast ---------- */
let tt;
function toast(msg){ $('#toast-msg').textContent = msg; const t = $('#toast'); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }

updateCount(false);
renderCart();
