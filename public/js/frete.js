/* Máscaras, validações e a calculadora de frete ("Calcule o prazo") usada na página do produto. */
import { postJSON } from './api.js';

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
export const mascaraCep = (v) => { const d = soDigitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
export const mascaraCpf = (v) => { const d = soDigitos(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); };
export const mascaraTel = (v) => { const d = soDigitos(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
export function cpfValido(cpf) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export const prazoTexto = (o) => (o.deliveryDays ? `${o.deliveryDays} ${o.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}` : 'prazo a confirmar');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function htmlCalculadoraFrete() {
  return `<div class="calc" id="calc">
    <label for="calc-cep" class="calc-l">Calcule o prazo</label>
    <div class="calc-row">
      <input id="calc-cep" inputmode="numeric" maxlength="9" placeholder="00000-000" autocomplete="postal-code" aria-describedby="calc-out">
      <button type="button" class="btn btn-line" id="calc-ok">Calcular</button>
    </div>
    <div class="calc-out" id="calc-out" aria-live="polite"></div>
  </div>`;
}

/** Liga a calculadora. getItem() devolve { slug, size } (usa o tamanho escolhido ou o primeiro disponível). */
export function ligarCalculadoraFrete(raiz, getItem, money) {
  const cep = raiz.querySelector('#calc-cep'), out = raiz.querySelector('#calc-out'), ok = raiz.querySelector('#calc-ok');
  if (!cep) return;
  let seq = 0;
  async function calcular() {
    const c = soDigitos(cep.value);
    if (c.length !== 8) { out.innerHTML = '<span class="calc-err">Digite os 8 números do CEP.</span>'; return; }
    const meu = ++seq;
    out.textContent = 'Calculando…'; ok.disabled = true;
    try {
      const it = getItem();
      const r = await postJSON('/api/shipping/quote', { cep: c, items: [{ slug: it.slug, size: it.size, qty: 1 }] });
      if (meu !== seq) return;
      out.innerHTML = r.options.map((o) => `<div class="opt-row"><span><b>${esc(o.name)}</b> · ${prazoTexto(o)}</span><span>${money(o.priceCents / 100)}</span></div>`).join('')
        + `<p class="calc-note">Frete grátis nas compras acima de ${money(r.freteGratisCents / 100)} (opção mais barata).</p>`;
    } catch (e) { if (meu === seq) out.innerHTML = `<span class="calc-err">${esc(e.message)}</span>`; }
    finally { ok.disabled = false; }
  }
  cep.addEventListener('input', () => { cep.value = mascaraCep(cep.value); if (soDigitos(cep.value).length === 8) calcular(); });
  ok.addEventListener('click', calcular);
  cep.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); calcular(); } });
}
