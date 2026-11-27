/* Estúdio de Prova Virtual: upload de foto ou avatar, modo 2D (sobreposição + antes/depois) e modo 3D (palco giratório).
   A parte de IA fica toda em virtualTryOnService.js; aqui é só interface. */
import { gerarProvaVirtual, sugerirTamanho, ajusteBase, FATOR_TAMANHO } from './virtualTryOnService.js';
import { pecaSVG } from './mockups.js';

const MAX_MB = 8;

export function criarProvador({ $, $$, esc, money, IC, openOv, closeOv, byId, PRODUCTS, SIZES, BRAND, adicionar, comprarAgora }) {
  const root = $('#tryon-body');
  const S = {
    id: null, size: 'M', modo: '2d', fonte: 'avatar',          // fonte: 'foto' | 'avatar'
    foto: null,                                                  // dataURL da foto enviada
    altura: 175, peso: 72,
    ajuste: { x: 50, y: 40, escala: .62 }, resultado: null, comparar: 50, vestido: false,
    rot: -20, zoom: 1, auto: true, processando: false,
  };
  let raf = 0, ultimo = 0;

  const prod = () => byId(S.id);
  const disponivel = (t) => !prod().soldout.includes(t);

  /* ---------- Render ---------- */
  function render() {
    const p = prod();
    root.innerHTML = `
      <div class="ty-stage-col">
        <div class="ty-modes" role="tablist" aria-label="Modo de visualização">
          <button role="tab" data-ty-modo="2d" aria-selected="${S.modo === '2d'}">Modo 2D · na sua foto</button>
          <button role="tab" data-ty-modo="3d" aria-selected="${S.modo === '3d'}">Modo 3D · giro 360°</button>
        </div>
        <div class="ty-stage" id="ty-stage">${S.modo === '2d' ? palco2D() : palco3D()}</div>
        ${S.modo === '2d' ? controles2D() : controles3D()}
      </div>
      <div class="ty-side">
        <div><span class="eyebrow">Provador IA</span><h2 id="ty-title">${esc(p.name)}</h2><p class="ty-sub">${money(p.price)} · ${esc(p.fit)}</p></div>
        <label class="ty-field"><span>Peça</span>
          <select id="ty-prod">${PRODUCTS.map(x => `<option value="${esc(x.id)}" ${x.id === S.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <div class="ty-field"><span>Tamanho</span>
          <div class="ty-sizes" role="group" aria-label="Tamanho">${SIZES.map(t => `<button class="size" data-ty-size="${t}" aria-pressed="${t === S.size}" ${disponivel(t) ? '' : `disabled aria-label="${t} esgotado"`}>${t}</button>`).join('')}</div>
          <small id="ty-fit">${textoCaimento()}</small></div>
        <div class="ty-field"><span>Sobre você</span>
          <div class="ty-src" role="group" aria-label="Foto ou avatar">
            <button data-ty-fonte="foto" aria-pressed="${S.fonte === 'foto'}">Minha foto</button>
            <button data-ty-fonte="avatar" aria-pressed="${S.fonte === 'avatar'}">Avatar 3D</button></div>
          ${S.fonte === 'foto' ? dropzone() : sliders()}
        </div>
        <button class="btn btn-neon" id="ty-go" ${S.processando ? 'disabled' : ''}>${IC.sparkle} ${S.modo === '2d' ? 'Vestir com IA' : 'Atualizar prova'}</button>
        <p class="ty-note">Prévia simulada: o resultado final com IA real será conectado depois. Sua foto não sai do seu navegador.</p>
        <div class="buy">
          <button class="btn btn-line" data-ty-add>${IC.bag} Adicionar ao carrinho</button>
          <button class="btn btn-neon" data-ty-buy>${IC.zap} Comprar agora</button>
        </div>
      </div>`;
    if (S.modo === '3d') iniciarGiro(); else cancelAnimationFrame(raf);
  }

  const dropzone = () => `
    <label class="ty-drop" id="ty-drop" tabindex="0">
      <input type="file" id="ty-file" accept="image/jpeg,image/png,image/webp" hidden>
      ${S.foto ? `<img src="${S.foto}" alt="Foto enviada"><span>Trocar foto</span>` : `${IC.sparkle}<b>Arraste uma foto ou toque para escolher</b><span>Corpo inteiro, de frente, boa luz. JPG, PNG ou WEBP até ${MAX_MB} MB.</span>`}
    </label><small class="ty-err" id="ty-err" role="alert"></small>`;
  const sliders = () => `
    <div class="ty-sl"><label for="ty-alt">Altura <b id="ty-alt-v">${S.altura} cm</b></label><input id="ty-alt" type="range" min="150" max="200" value="${S.altura}"></div>
    <div class="ty-sl"><label for="ty-peso">Peso / biotipo <b id="ty-peso-v">${S.peso} kg</b></label><input id="ty-peso" type="range" min="45" max="130" value="${S.peso}"></div>`;

  function textoCaimento() {
    const rec = sugerirTamanho(S.altura, S.peso), i = SIZES.indexOf(S.size), r = SIZES.indexOf(rec);
    const f = i < r ? 'mais justo' : i > r ? 'mais folgado' : 'no ponto certo';
    return S.fonte === 'avatar' ? `Para ${S.altura} cm e ${S.peso} kg sugerimos ${rec}. O ${S.size} fica ${f}.` : `Tamanho ${S.size}: a peça aparece ${i <= 1 ? 'mais justa' : i >= 4 ? 'mais larga' : 'regular'} na foto.`;
  }

  /* ---------- Modo 2D ---------- */
  function fundoFoto() {
    if (S.foto && S.fonte === 'foto') return `<img class="ty-photo" src="${S.foto}" alt="Sua foto">`;
    return silhueta(); // sem foto: usa o avatar como base para a demonstração
  }
  function silhueta() {
    const w = 1 + (S.peso - 72) / 160, h = S.altura / 175;
    return `<svg class="ty-photo ty-avatar" viewBox="0 0 400 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id="avg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--surface-2)"/><stop offset="1" stop-color="var(--surface)"/></linearGradient></defs>
      <g transform="translate(200 476) scale(${(w * .98).toFixed(3)} ${(h * .98).toFixed(3)}) translate(-200 -476)" fill="url(#avg)" stroke="var(--line)" stroke-width="2" stroke-linejoin="round">
        <circle cx="200" cy="62" r="32"/><rect x="188" y="90" width="24" height="26" rx="8"/>
        <path d="M148 114 H252 Q282 118 284 150 L292 290 Q292 300 282 300 H262 L258 214 L252 336 H148 L142 214 L138 300 H118 Q108 300 108 290 L116 150 Q118 118 148 114 Z"/>
        <path d="M150 330 H198 L192 468 Q192 474 184 474 H158 Q150 474 150 468 Z"/>
        <path d="M202 330 H250 L248 468 Q248 474 240 474 H216 Q208 474 208 468 Z"/></g></svg>`;
  }
  function palco2D() {
    const a = S.ajuste, p = prod();
    const peca = `<div class="ty-garment" style="left:${a.x}%;top:${a.y}%;width:${(a.escala * 100).toFixed(1)}%">${resultadoIA() ? '' : pecaSVG(p, 'front', BRAND)}</div>`;
    const base = fundoFoto();
    if (!S.vestido) return `<div class="ty-frame">${base}<span class="ty-tag">Antes</span></div>`;
    return `<div class="ty-frame" id="ty-frame">
      <div class="ty-layer">${base}</div>
      <div class="ty-layer ty-after" style="clip-path:inset(0 0 0 ${S.comparar}%)">${resultadoIA() ? `<img class="ty-photo" src="${esc(S.resultado.imageUrl)}" alt="Resultado">` : base + peca}</div>
      <div class="ty-cmp" style="left:${S.comparar}%"><i></i></div>
      <span class="ty-tag l">Antes</span><span class="ty-tag r">Depois</span></div>`;
  }
  const resultadoIA = () => S.resultado?.imageUrl;
  function controles2D() {
    const a = S.ajuste;
    return `<div class="ty-ctl ${S.vestido ? '' : 'off'}">
      <div class="ty-sl"><label for="ty-esc">Escala <b id="ty-esc-v">${Math.round(a.escala * 100)}%</b></label><input id="ty-esc" type="range" min="25" max="130" value="${Math.round(a.escala * 100)}"></div>
      <div class="ty-sl"><label for="ty-x">Posição horizontal</label><input id="ty-x" type="range" min="20" max="80" value="${a.x}"></div>
      <div class="ty-sl"><label for="ty-y">Posição vertical</label><input id="ty-y" type="range" min="15" max="90" value="${a.y}"></div>
      <div class="ty-sl"><label for="ty-cmp">Antes / Depois</label><input id="ty-cmp" type="range" min="0" max="100" value="${S.comparar}"></div></div>
      <div class="ty-prog" id="ty-prog" hidden><i></i><span></span></div>`;
  }

  /* ---------- Modo 3D (CSS 3D, sem biblioteca) ---------- */
  function palco3D() {
    const p = prod(), f = FATOR_TAMANHO[S.size] || 1, rec = FATOR_TAMANHO[sugerirTamanho(S.altura, S.peso)] || 1;
    const folga = Math.max(.9, Math.min(1.3, f / rec));           // >1 folgado, <1 justo
    const w = 1 + (S.peso - 72) / 160, ab = ajusteBase(p.type);
    const camadas = Array.from({ length: 7 }, (_, i) => `<div class="ty3-slab" style="transform:translateZ(${(i - 3) * 3}px)">${pecaSVG(p, 'front', BRAND)}</div>`).join('');
    return `<div class="ty3" id="ty3">
      <div class="ty3-floor"></div>
      <div class="ty3-world" id="ty3-world" style="transform:scale(${S.zoom}) rotateY(${S.rot}deg)">
        <div class="ty3-body">${silhueta()}</div>
        <div class="ty3-wear" style="left:${ab.x}%;top:${ab.y}%;width:${(ab.escala * 100).toFixed(1)}%;transform:translate(-50%,-50%) scaleX(${(w * folga).toFixed(3)})">
          <div class="ty3-face front">${camadas}</div>
          <div class="ty3-face back">${pecaSVG(p, 'back', BRAND)}</div>
        </div>
      </div>
      <span class="ty-tag l">${S.size} · ${folga > 1.02 ? 'mais folgado' : folga < .98 ? 'mais justo' : 'ajuste ideal'}</span></div>`;
  }
  function controles3D() {
    return `<div class="ty-ctl">
      <div class="ty-sl"><label for="ty-rot">Rotação 360° <b id="ty-rot-v">${Math.round(((S.rot % 360) + 360) % 360)}°</b></label><input id="ty-rot" type="range" min="0" max="359" value="${Math.round(((S.rot % 360) + 360) % 360)}"></div>
      <div class="ty-sl"><label for="ty-zoom">Zoom no tecido <b id="ty-zoom-v">${S.zoom.toFixed(1)}x</b></label><input id="ty-zoom" type="range" min="10" max="30" value="${S.zoom * 10}"></div>
      <label class="ty-chk"><input type="checkbox" id="ty-auto" ${S.auto ? 'checked' : ''}> Girar sozinho</label></div>`;
  }
  function aplicarGiro() {
    const w = $('#ty3-world'); if (!w) return;
    w.style.transform = `scale(${S.zoom}) rotateY(${S.rot}deg)`;
    const r = $('#ty-rot'); if (r) { const v = Math.round(((S.rot % 360) + 360) % 360); r.value = v; $('#ty-rot-v').textContent = v + '°'; }
  }
  function iniciarGiro() {
    cancelAnimationFrame(raf); ultimo = 0;
    const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const passo = (t) => {
      if (!$('#ty3')) return;
      if (S.auto && !reduz && ultimo) { S.rot += (t - ultimo) * 0.03; aplicarGiro(); }
      ultimo = t; raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
  }

  /* ---------- Ações ---------- */
  function lerArquivo(file) {
    const err = $('#ty-err'); if (err) err.textContent = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { if (err) err.textContent = 'Use uma imagem JPG, PNG ou WEBP.'; return; }
    if (file.size > MAX_MB * 1024 * 1024) { if (err) err.textContent = `A foto passa de ${MAX_MB} MB. Escolha uma menor.`; return; }
    const r = new FileReader();
    r.onload = () => { S.foto = r.result; S.vestido = false; S.resultado = null; render(); };
    r.onerror = () => { if (err) err.textContent = 'Não consegui abrir essa foto. Tente outra.'; };
    r.readAsDataURL(file);
  }
  async function vestir() {
    if (S.processando) return;
    if (S.modo === '3d') { render(); return; }
    if (S.fonte === 'foto' && !S.foto) { const e = $('#ty-err'); if (e) e.textContent = 'Envie uma foto antes de vestir a peça.'; return; }
    S.processando = true; $('#ty-go').disabled = true;
    const prog = $('#ty-prog'); prog.hidden = false;
    try {
      const p = prod();
      const r = await gerarProvaVirtual({
        fotoDataUrl: S.fonte === 'foto' ? S.foto : 'avatar', produto: { id: p.id, name: p.name, type: p.type }, tamanho: S.size,
        onEtapa: (txt, pct) => { prog.querySelector('span').textContent = txt + '…'; prog.querySelector('i').style.width = pct + '%'; },
      });
      S.resultado = r; S.ajuste = r.ajuste; S.vestido = true; S.comparar = 50;
    } catch (e) {
      const m = e?.message || 'Não foi possível gerar a prova agora.'; prog.querySelector('span').textContent = m;
      S.processando = false; $('#ty-go').disabled = false; return;
    }
    S.processando = false; render();
  }

  /* ---------- Eventos (delegação no corpo do modal) ---------- */
  root.addEventListener('click', (e) => {
    const m = e.target.closest('[data-ty-modo]'); if (m) { S.modo = m.dataset.tyModo; render(); return; }
    const t = e.target.closest('[data-ty-size]'); if (t && !t.disabled) { S.size = t.dataset.tySize; S.vestido = false; S.resultado = null; render(); return; }
    const f = e.target.closest('[data-ty-fonte]'); if (f) { S.fonte = f.dataset.tyFonte; S.vestido = false; S.resultado = null; render(); return; }
    if (e.target.closest('#ty-go')) { vestir(); return; }
    if (e.target.closest('[data-ty-add]')) { adicionar(S.id, S.size); return; }
    if (e.target.closest('[data-ty-buy]')) { comprarAgora(S.id, S.size); }
  });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'ty-prod') {
      S.id = e.target.value; if (prod().soldout.includes(S.size)) S.size = SIZES.find(t => !prod().soldout.includes(t)) || 'M';
      S.vestido = false; S.resultado = null; render();
    }
    if (e.target.id === 'ty-file') lerArquivo(e.target.files[0]);
    if (e.target.id === 'ty-auto') S.auto = e.target.checked;
  });
  root.addEventListener('input', (e) => {
    const id = e.target.id, v = +e.target.value;
    if (id === 'ty-alt' || id === 'ty-peso') {
      if (id === 'ty-alt') { S.altura = v; $('#ty-alt-v').textContent = v + ' cm'; } else { S.peso = v; $('#ty-peso-v').textContent = v + ' kg'; }
      $('#ty-fit').textContent = textoCaimento();
      if (S.modo === '2d' && !S.vestido) $('#ty-stage').innerHTML = palco2D();
      return;
    }
    if (['ty-esc', 'ty-x', 'ty-y'].includes(id)) {
      if (id === 'ty-esc') { S.ajuste.escala = v / 100; $('#ty-esc-v').textContent = v + '%'; } else if (id === 'ty-x') S.ajuste.x = v; else S.ajuste.y = v;
      const g = $('.ty-garment'); if (g) { g.style.left = S.ajuste.x + '%'; g.style.top = S.ajuste.y + '%'; g.style.width = (S.ajuste.escala * 100).toFixed(1) + '%'; }
    } else if (id === 'ty-cmp') {
      S.comparar = v; const a = $('.ty-after'), c = $('.ty-cmp'); if (a) a.style.clipPath = `inset(0 0 0 ${v}%)`; if (c) c.style.left = v + '%';
    } else if (id === 'ty-rot') { S.rot = v; S.auto = false; const k = $('#ty-auto'); if (k) k.checked = false; aplicarGiro(); }
    else if (id === 'ty-zoom') { S.zoom = v / 10; $('#ty-zoom-v').textContent = S.zoom.toFixed(1) + 'x'; aplicarGiro(); }
  });
  // arrastar e soltar a foto
  root.addEventListener('dragover', (e) => { if (e.target.closest('#ty-drop')) { e.preventDefault(); e.target.closest('#ty-drop').classList.add('over'); } });
  root.addEventListener('dragleave', (e) => e.target.closest('#ty-drop')?.classList.remove('over'));
  root.addEventListener('drop', (e) => { if (e.target.closest('#ty-drop')) { e.preventDefault(); lerArquivo(e.dataTransfer.files[0]); } });
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'ty-drop') { e.preventDefault(); $('#ty-file').click(); } });
  // girar o palco 3D arrastando
  let arr = null;
  root.addEventListener('pointerdown', (e) => { const st = e.target.closest('#ty3'); if (st) { arr = { x: e.clientX, rot: S.rot }; S.auto = false; const k = $('#ty-auto'); if (k) k.checked = false; st.setPointerCapture?.(e.pointerId); } });
  root.addEventListener('pointermove', (e) => { if (arr) { S.rot = arr.rot + (e.clientX - arr.x) * 0.6; aplicarGiro(); } });
  ['pointerup', 'pointercancel'].forEach(n => root.addEventListener(n, () => { arr = null; }));
  // fechar o modal para a animação
  new MutationObserver(() => { if (!$('#tryon').classList.contains('open')) cancelAnimationFrame(raf); }).observe($('#tryon'), { attributes: true, attributeFilter: ['class'] });

  return {
    abrir(id, size) {
      const alvo = id && byId(id) ? id : (S.id && byId(S.id) ? S.id : PRODUCTS[0].id);
      if (alvo !== S.id) { S.vestido = false; S.resultado = null; }
      S.id = alvo;
      const p = prod();
      S.size = size && SIZES.includes(size) && !p.soldout.includes(size) ? size : (p.soldout.includes(S.size) ? (SIZES.find(t => !p.soldout.includes(t)) || 'M') : S.size);
      if (!S.vestido) S.ajuste = ajusteBase(p.type);
      render(); openOv('tryon');
    },
  };
}
