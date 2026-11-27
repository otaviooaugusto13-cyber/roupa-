/* Checkout real: dados -> endereço (ViaCEP) -> frete (Melhor Envio) -> Pix ou cartão (Mercado Pago).
   Os dados do cartão são digitados dentro de iframes do Mercado Pago: nunca passam pelo nosso servidor. */
import { getJSON, postJSON } from './api.js';
import { mascaraCep, mascaraCpf, mascaraTel, soDigitos, cpfValido, prazoTexto } from './frete.js';

const PEND = 'nox-pedido-pendente';
const novaChave = () => (crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12).padEnd(10, '0'));

export function criarCheckout({ $, esc, money, IC, openOv, getCart, byId, limparCarrinho, cfg }) {
  const brl = (c) => money(c / 100);
  const corpo = $('#co-body');
  const X = `<button class="x" data-close="co" aria-label="Fechar"><svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  const S = { metodo: 'pix', key: null, enviando: false, mpOk: false,
    f: { nome: '', email: '', cpf: '', telefone: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
    frete: { opcoes: [], id: null, carregando: false, erro: '' } };
  let timers = [], cardForm = null, mpScript = null, seqCep = 0;
  const parar = () => { timers.forEach(clearInterval); timers = []; };
  const pendente = { ler: () => { try { return localStorage.getItem(PEND); } catch { return null; } },
    gravar: (id) => { try { localStorage.setItem(PEND, id); } catch {} }, limpar: () => { try { localStorage.removeItem(PEND); } catch {} } };

  /* ---------- números ---------- */
  const itens = () => getCart().map((i) => ({ slug: i.id, size: i.size, qty: i.qty }));
  const subtotal = () => getCart().reduce((a, i) => a + Math.round(byId(i.id).price * 100) * i.qty, 0);
  const opcao = () => S.frete.opcoes.find((o) => o.id === S.frete.id);
  function resumo() {
    const sub = subtotal(), o = opcao();
    const desc = S.metodo === 'pix' ? Math.round((sub * cfg.pixDescontoPercent) / 100) : 0;
    return { sub, desc, frete: o ? o.chargeCents : null, total: sub - desc + (o ? o.chargeCents : 0) };
  }
  function htmlResumo() {
    const r = resumo();
    const linhas = getCart().map((i) => { const p = byId(i.id); return `<div class="row"><span>${i.qty}× ${esc(p.name)} · ${i.size}</span><span>${money(p.price * i.qty)}</span></div>`; }).join('');
    return `${linhas}
      <div class="row"><span>Frete</span><span>${r.frete === null ? 'informe o CEP' : r.frete ? brl(r.frete) : 'Grátis'}</span></div>
      ${r.desc ? `<div class="row"><span>Desconto Pix (${cfg.pixDescontoPercent}%)</span><span>−${brl(r.desc)}</span></div>` : ''}
      <div class="row tot"><span>Total</span><span>${brl(r.total)}</span></div>`;
  }
  function atualizarResumo() {
    $('#co-lines').innerHTML = htmlResumo();
    const b = $('#co-submit'); if (b && !S.enviando) b.textContent = `Pagar ${brl(resumo().total)}`;
  }

  /* ---------- formulário ---------- */
  const campo = (id, rotulo, extra = '', cls = '') =>
    `<label class="${cls}" for="co-${id}">${rotulo}<input id="co-${id}" value="${esc(S.f[id])}" ${extra}></label>`;
  function renderForm() {
    corpo.innerHTML = `${X}
      <h3 id="co-title">Finalizar compra</h3>
      <div class="co-lines" id="co-lines"></div>
      <form id="form-checkout" novalidate>
        <h4 class="co-sec">Seus dados</h4>
        <div class="fields">
          ${campo('nome', 'Nome completo', 'autocomplete="name" placeholder="Nome e sobrenome"', 'full')}
          ${campo('email', 'E-mail', 'type="email" autocomplete="email" placeholder="seu@email.com"')}
          ${campo('telefone', 'Telefone', 'inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000"')}
          ${campo('cpf', 'CPF', 'inputmode="numeric" maxlength="14" placeholder="000.000.000-00"', 'full')}
        </div>
        <h4 class="co-sec">Entrega</h4>
        <div class="fields">
          ${campo('cep', 'CEP', 'inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="00000-000"', 'full')}
          ${campo('logradouro', 'Rua', 'autocomplete="address-line1"', 'full')}
          ${campo('numero', 'Número', 'autocomplete="address-line2"')}
          ${campo('complemento', 'Complemento', 'placeholder="Opcional"')}
          ${campo('bairro', 'Bairro')}
          ${campo('cidade', 'Cidade')}
          ${campo('uf', 'UF', 'maxlength="2" style="text-transform:uppercase"')}
        </div>
        <div class="ship-opts" id="co-ship" aria-live="polite"></div>
        <h4 class="co-sec">Pagamento</h4>
        <div class="pay" role="group" aria-label="Forma de pagamento">
          <button type="button" data-pay="pix" aria-pressed="${S.metodo === 'pix'}">Pix · ${cfg.pixDescontoPercent}% off</button>
          <button type="button" data-pay="card" aria-pressed="${S.metodo === 'card'}">Cartão · até ${cfg.maxParcelas}x</button>
        </div>
        <div id="co-card" ${S.metodo === 'card' ? '' : 'hidden'}></div>
        <p class="co-err" id="co-err" role="alert"></p>
        <button class="btn btn-neon" type="submit" id="co-submit">Pagar</button>
      </form>`;
    atualizarResumo(); renderFrete();
    if (S.metodo === 'card') montarCartao();
  }
  const erro = (msg, id) => { const e = $('#co-err'); if (e) e.textContent = msg || ''; if (id) $('#co-' + id)?.focus(); };
  const ocupado = (b) => { S.enviando = b; const s = $('#co-submit'); if (s) { s.disabled = b; s.textContent = b ? 'Processando…' : `Pagar ${brl(resumo().total)}`; } };

  /* ---------- CEP e frete ---------- */
  async function buscarCep() {
    const meu = ++seqCep, cep = soDigitos(S.f.cep);
    S.frete = { opcoes: [], id: null, carregando: true, erro: '' }; renderFrete(); atualizarResumo();
    try {
      const a = await getJSON(`/api/cep/${cep}`);
      if (meu !== seqCep) return;
      for (const k of ['logradouro', 'bairro', 'cidade', 'uf']) { S.f[k] = a[k] || S.f[k]; const el = $('#co-' + k); if (el) el.value = S.f[k]; }
      $('#co-numero')?.focus();
    } catch (e) { if (meu === seqCep) erro(e.message); }   // ainda dá para preencher à mão e cotar o frete
    if (meu === seqCep) cotar(meu);
  }
  async function cotar(meu = seqCep) {
    try {
      const r = await postJSON('/api/shipping/quote', { cep: soDigitos(S.f.cep), items: itens() });
      if (meu !== seqCep) return;
      const antigo = S.frete.id;
      S.frete = { opcoes: r.options, id: r.options.some((o) => o.id === antigo) ? antigo : r.options[0]?.id ?? null, carregando: false, erro: '' };
    } catch (e) { if (meu !== seqCep) return; S.frete = { opcoes: [], id: null, carregando: false, erro: e.message }; }
    renderFrete(); atualizarResumo(); if (S.metodo === 'card') montarCartao();
  }
  function renderFrete() {
    const el = $('#co-ship'); if (!el) return;
    const f = S.frete;
    if (f.carregando) { el.innerHTML = '<p class="co-hint">Calculando frete…</p>'; return; }
    if (f.erro) { el.innerHTML = `<p class="co-err">${esc(f.erro)}</p>`; return; }
    if (!f.opcoes.length) { el.innerHTML = '<p class="co-hint">Informe o CEP para ver as opções de frete.</p>'; return; }
    el.innerHTML = f.opcoes.map((o) => `<label class="opt"><input type="radio" name="frete" value="${esc(o.id)}" ${o.id === f.id ? 'checked' : ''}>
      <span class="opt-t"><b>${esc(o.name)}</b><small>${esc(o.company)} · ${prazoTexto(o)}</small></span>
      <span class="opt-p">${o.chargeCents ? brl(o.chargeCents) : 'Grátis'}</span></label>`).join('');
  }

  /* ---------- cartão (formulário seguro do Mercado Pago) ---------- */
  function carregarMP() {
    if (window.MercadoPago) return Promise.resolve();
    return (mpScript ??= new Promise((ok, falha) => {
      const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2'; s.onload = ok;
      s.onerror = () => { mpScript = null; falha(new Error('Não foi possível carregar o formulário de cartão.')); };
      document.head.appendChild(s);
    }));
  }
  function desmontarCartao() { try { cardForm?.unmount?.(); } catch {} cardForm = null; }
  async function montarCartao() {
    const box = $('#co-card'); if (!box) return;
    desmontarCartao();
    if (!cfg.mpPublicKey) { box.innerHTML = '<p class="co-err">Pagamento com cartão indisponível no momento. Use o Pix.</p>'; return; }   // TODO: MP_PUBLIC_KEY no .env
    if (!opcao()) { box.innerHTML = '<p class="co-hint">Escolha o frete acima para liberar o pagamento com cartão.</p>'; return; }
    box.innerHTML = `<div class="fields">
      <label class="full">Número do cartão<div class="mp-field" id="form-checkout__cardNumber"></div></label>
      <label>Validade<div class="mp-field" id="form-checkout__expirationDate"></div></label>
      <label>Código (CVV)<div class="mp-field" id="form-checkout__securityCode"></div></label>
      <label class="full" for="form-checkout__cardholderName">Nome no cartão<input id="form-checkout__cardholderName" autocomplete="cc-name"></label>
      <label class="full" id="lbl-issuer" hidden>Banco emissor<select id="form-checkout__issuer"></select></label>
      <label class="full">Parcelas<select id="form-checkout__installments"></select></label>
      <div hidden><select id="form-checkout__identificationType"></select><input id="form-checkout__identificationNumber" value="${soDigitos(S.f.cpf)}"><input id="form-checkout__cardholderEmail" value="${esc(S.f.email)}"></div>
    </div>`;
    try {
      await carregarMP();
      if (!$('#co-card') || S.metodo !== 'card') return;
      const mp = new window.MercadoPago(cfg.mpPublicKey, { locale: 'pt-BR' });
      cardForm = mp.cardForm({
        amount: (resumo().total / 100).toFixed(2), iframe: true,
        form: {
          id: 'form-checkout',
          cardNumber: { id: 'form-checkout__cardNumber', placeholder: '0000 0000 0000 0000' },
          expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
          securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
          cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Como está no cartão' },
          issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emissor' },
          installments: { id: 'form-checkout__installments', placeholder: 'Parcelas' },
          identificationType: { id: 'form-checkout__identificationType' },
          identificationNumber: { id: 'form-checkout__identificationNumber' },
          cardholderEmail: { id: 'form-checkout__cardholderEmail' },
        },
        callbacks: {
          onFormMounted: (e) => { if (e) { console.warn('[mp] formulário:', e); erro('Não foi possível carregar o formulário de cartão. Use o Pix ou recarregue a página.'); } },
          onSubmit: (ev) => {
            ev.preventDefault();
            const d = cardForm.getCardFormData();
            enviar({ token: d.token, installments: Number(d.installments) || 1, paymentMethodId: d.paymentMethodId, issuerId: d.issuerId });
          },
        },
      });
      limitarParcelas();
    } catch (e) { const b = $('#co-card'); if (b) b.innerHTML = `<p class="co-err">${esc(e.message)}</p>`; }
  }
  /** O MP lista as parcelas conforme a conta; escondemos as acima do nosso máximo (o servidor também recusa). */
  function limitarParcelas() {
    const inst = $('#form-checkout__installments'), iss = $('#form-checkout__issuer');
    if (inst) new MutationObserver(() => [...inst.options].forEach((o) => { if (Number(o.value) > cfg.maxParcelas) o.remove(); })).observe(inst, { childList: true });
    if (iss) new MutationObserver(() => { $('#lbl-issuer').hidden = iss.options.length < 2; }).observe(iss, { childList: true });
  }
  const sincronizarCartao = () => {
    const c = $('#form-checkout__identificationNumber'), e = $('#form-checkout__cardholderEmail');
    if (c) c.value = soDigitos(S.f.cpf); if (e) e.value = S.f.email;
  };

  /* ---------- envio ---------- */
  function validar() {
    const f = S.f;
    if (f.nome.trim().split(/\s+/).filter(Boolean).length < 2) return ['Informe nome e sobrenome.', 'nome'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return ['E-mail inválido.', 'email'];
    if (soDigitos(f.telefone).length < 10) return ['Telefone inválido (com DDD).', 'telefone'];
    if (!cpfValido(f.cpf)) return ['CPF inválido.', 'cpf'];
    if (soDigitos(f.cep).length !== 8) return ['CEP inválido.', 'cep'];
    if (!f.logradouro.trim()) return ['Informe a rua.', 'logradouro'];
    if (!f.numero.trim()) return ['Informe o número (ou S/N).', 'numero'];
    if (!f.bairro.trim()) return ['Informe o bairro.', 'bairro'];
    if (!f.cidade.trim() || f.uf.trim().length !== 2) return ['Informe cidade e UF.', 'cidade'];
    if (!S.frete.id) return ['Escolha uma opção de frete.', null];
    return null;
  }
  async function enviar(card) {
    if (S.enviando) return;
    const v = validar(); if (v) return erro(v[0], v[1]);
    erro(''); ocupado(true);
    try {
      const f = S.f;
      const { order } = await postJSON('/api/checkout', {
        key: S.key, items: itens(), paymentMethod: S.metodo, shipServiceId: S.frete.id, ...(card ? { card } : {}),
        customer: { nome: f.nome.trim(), email: f.email.trim(), cpf: soDigitos(f.cpf), telefone: soDigitos(f.telefone) },
        address: { cep: soDigitos(f.cep), logradouro: f.logradouro.trim(), numero: f.numero.trim(), complemento: f.complemento.trim(), bairro: f.bairro.trim(), cidade: f.cidade.trim(), uf: f.uf.trim().toUpperCase() },
      });
      ocupado(false); mostrar(order);
    } catch (e) {
      ocupado(false);
      // O servidor respondeu (pedido não ficou ativo): nova chave. Sem resposta (rede): mantém a chave para o reenvio ser idempotente.
      if (e.status) S.key = novaChave();
      erro(e.data?.codigo === 'ESTOQUE' ? `${e.message} Ajuste o carrinho e tente de novo.` : e.message);
      if (e.data?.codigo === 'FRETE') cotar();
    }
  }

  /* ---------- telas de resultado ---------- */
  function mostrar(o) {
    parar(); desmontarCartao();
    if (o.status === 'paid') return telaPago(o);
    if (o.status === 'pending' && o.paymentMethod === 'pix' && o.pix) { pendente.gravar(o.id); return telaPix(o); }
    if (o.status === 'pending') { pendente.gravar(o.id); return telaAnalise(o); }
    return telaFalha();
  }
  function telaPago(o) {
    parar(); pendente.limpar(); limparCarrinho();
    corpo.innerHTML = `${X}<div class="done"><div class="ok">${IC.check}</div><h3 id="co-title">Pagamento aprovado</h3>
      <p class="note">Pedido <code>#${o.number}</code> confirmado. Enviamos os detalhes para o seu e-mail.</p>
      <button class="btn btn-neon" data-close="co">Continuar comprando</button></div>`;
  }
  function telaFalha(msg = 'Não foi possível concluir o pagamento.') {
    parar(); pendente.limpar();
    corpo.innerHTML = `${X}<div class="done"><h3 id="co-title">Pedido não concluído</h3><p class="note">${esc(msg)}</p>
      <button class="btn btn-neon" id="co-retry">Tentar novamente</button></div>`;
  }
  function telaAnalise(o) {
    corpo.innerHTML = `${X}<div class="done"><h3 id="co-title">Pagamento em análise</h3>
      <p class="note">Seu banco está analisando o pagamento do pedido <code>#${o.number}</code>. Esta tela atualiza sozinha; você também receberá um e-mail.</p>
      <p class="pix-wait" aria-live="polite" id="co-live">Aguardando confirmação…</p></div>`;
    acompanhar(o.id);
  }
  function telaPix(o) {
    const qr = String(o.pix.qrCodeBase64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    corpo.innerHTML = `${X}
      <h3 id="co-title">Pague com Pix</h3>
      <p class="note">Pedido <code>#${o.number}</code> · ${brl(o.totalCents)}. Abra o app do seu banco, escaneie o QR Code ou use o código.</p>
      <div class="pix-qr"><img alt="QR Code do Pix" width="220" height="220" src="data:image/png;base64,${qr}"></div>
      <p class="pix-timer">Expira em <b id="pix-t">--:--</b></p>
      <label class="pix-code" for="pix-code">Pix copia e cola<input id="pix-code" readonly value="${esc(o.pix.qrCode)}"></label>
      <button class="btn btn-neon" id="pix-copy" type="button">Copiar código</button>
      <p class="pix-wait" aria-live="polite" id="co-live">Aguardando pagamento…</p>
      <button class="btn-link" id="pix-cancel" type="button">Cancelar e voltar</button>`;
    const delta = (o.agora || Date.now()) - Date.now();
    const tick = () => {
      const resta = Math.max(0, Math.floor(((o.expiresAt || 0) - (Date.now() + delta)) / 1000));
      const t = $('#pix-t'); if (t) t.textContent = `${String(Math.floor(resta / 60)).padStart(2, '0')}:${String(resta % 60).padStart(2, '0')}`;
      if (resta === 0) verificar(o.id);   // o servidor expira o pedido e liberta o estoque
    };
    tick(); timers.push(setInterval(tick, 1000));
    acompanhar(o.id);
  }
  async function verificar(id) {
    try {
      const { order } = await getJSON(`/api/orders/${id}`);
      if (order.status === 'paid') telaPago(order);
      else if (order.status !== 'pending') { parar(); pendente.limpar(); corpo.innerHTML = `${X}<div class="done"><h3 id="co-title">${order.status === 'expired' ? 'Pix expirado' : 'Pedido cancelado'}</h3>
        <p class="note">O tempo para pagar acabou e a reserva dos itens foi liberada. Seu carrinho continua salvo.</p><button class="btn btn-neon" id="co-retry">Gerar novo pedido</button></div>`; }
    } catch { /* falha momentânea de rede: tenta no próximo ciclo */ }
  }
  const acompanhar = (id) => timers.push(setInterval(() => verificar(id), 4000));

  /* ---------- eventos (delegados: o corpo é recriado a cada tela) ---------- */
  const MASCARAS = { cep: mascaraCep, cpf: mascaraCpf, telefone: mascaraTel };
  corpo.addEventListener('input', (e) => {
    const k = e.target.id?.startsWith('co-') ? e.target.id.slice(3) : null;
    if (!k || !(k in S.f)) return;
    if (MASCARAS[k]) e.target.value = MASCARAS[k](e.target.value);
    if (k === 'uf') e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    S.f[k] = e.target.value;
    if (k === 'cpf' || k === 'email') sincronizarCartao();
    if (k === 'cep') { if (soDigitos(e.target.value).length === 8) buscarCep(); else { seqCep++; S.frete = { opcoes: [], id: null, carregando: false, erro: '' }; renderFrete(); atualizarResumo(); } }
  });
  corpo.addEventListener('change', (e) => {
    if (e.target.name !== 'frete') return;
    S.frete.id = e.target.value; atualizarResumo(); if (S.metodo === 'card') montarCartao();
  });
  corpo.addEventListener('click', async (e) => {
    const pay = e.target.closest('[data-pay]');
    if (pay) {
      S.metodo = pay.dataset.pay;
      corpo.querySelectorAll('[data-pay]').forEach((b) => b.setAttribute('aria-pressed', String(b === pay)));
      $('#co-card').hidden = S.metodo !== 'card'; atualizarResumo();
      if (S.metodo === 'card') montarCartao(); else desmontarCartao();
      return;
    }
    if (e.target.closest('#pix-copy')) {
      const el = $('#pix-code'), b = $('#pix-copy');
      try { await navigator.clipboard.writeText(el.value); } catch { el.select(); document.execCommand('copy'); }
      b.textContent = 'Copiado!'; setTimeout(() => { if (b.isConnected) b.textContent = 'Copiar código'; }, 2000);
    }
    if (e.target.closest('#pix-cancel')) {
      const id = pendente.ler(); parar();
      if (id) { try { await postJSON(`/api/orders/${id}/cancelar`); } catch { /* o pedido expira sozinho */ } }
      pendente.limpar(); abrir();
    }
    if (e.target.closest('#co-retry')) abrir();
  });
  corpo.addEventListener('submit', (e) => { e.preventDefault(); if (S.metodo === 'pix') enviar(); /* cartão: quem envia é o onSubmit do CardForm */ });

  // Fechou o checkout: para os cronômetros (o pedido pendente continua guardado e é retomado ao reabrir).
  new MutationObserver(() => { if ($('#co').getAttribute('aria-hidden') === 'true') { parar(); desmontarCartao(); } })
    .observe($('#co'), { attributes: true, attributeFilter: ['aria-hidden'] });

  async function abrir() {
    if (!getCart().length) return;
    parar();
    const id = pendente.ler();
    if (id) {   // há um Pix em aberto: retoma em vez de reservar o estoque duas vezes
      try {
        const { order } = await getJSON(`/api/orders/${id}`);
        if (order.status === 'pending') { mostrar(order); openOv('co'); return; }
        if (order.status === 'paid') { telaPago(order); openOv('co'); return; }
      } catch { /* pedido inexistente: segue para um novo checkout */ }
      pendente.limpar();
    }
    S.key = novaChave(); S.enviando = false;
    S.frete = { opcoes: [], id: null, carregando: false, erro: '' };
    renderForm(); openOv('co');
    if (soDigitos(S.f.cep).length === 8) cotar();
  }
  return { abrir };
}
