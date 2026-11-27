// E-mail transacional. Provedor atual: Resend (POST https://api.resend.com/emails com Bearer).
// TODO: o dono ainda não escolheu o provedor (Resend, SendGrid ou Brevo). Para trocar, só altere enviarEmail().
// Sem EMAIL_API_KEY, apenas registra no console (útil em desenvolvimento).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const LOJA = process.env.LOJA_NOME || 'NØX'; // TODO: nome definitivo da marca

export async function enviarEmail({ para, assunto, html }) {
  const chave = process.env.EMAIL_API_KEY, from = process.env.EMAIL_FROM;
  if (!chave || !from) { console.log(`[email] (sem EMAIL_API_KEY/EMAIL_FROM) para=${para} assunto="${assunto}"`); return { simulado: true }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [para], subject: assunto, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export function enviarConfirmacaoPedido(o) {
  const linhas = o.items.map((i) => `<tr><td style="padding:6px 0">${i.qty}× ${esc(i.name)} · ${esc(i.size)}</td><td style="text-align:right">${brl(i.unitCents * i.qty)}</td></tr>`).join('');
  const a = o.address || {};
  const html = `<div style="font-family:Arial,sans-serif;background:#09090B;color:#FAFAFA;padding:28px;max-width:560px;margin:auto;border-radius:16px">
    <h1 style="letter-spacing:-.02em;text-transform:uppercase;margin:0 0 4px">${esc(LOJA)}</h1>
    <p style="color:#A855F7;margin:0 0 20px;font-family:monospace">PEDIDO #${o.number} · PAGAMENTO APROVADO</p>
    <p>Valeu, ${esc(o.customer.nome.split(' ')[0])}! Recebemos o seu pagamento e já estamos separando o seu pedido.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${linhas}
      <tr><td style="padding-top:10px;color:#A1A1AA">Frete (${esc(o.shippingService?.name || '')})</td><td style="text-align:right;padding-top:10px">${o.shippingCents ? brl(o.shippingCents) : 'Grátis'}</td></tr>
      ${o.discountCents ? `<tr><td style="color:#A1A1AA">Desconto Pix</td><td style="text-align:right">−${brl(o.discountCents)}</td></tr>` : ''}
      <tr><td style="padding-top:10px"><b>Total</b></td><td style="text-align:right;padding-top:10px"><b>${brl(o.totalCents)}</b></td></tr></table>
    <p style="font-size:13px;color:#A1A1AA">Entrega em: ${esc(a.logradouro)}, ${esc(a.numero)}${a.complemento ? ' - ' + esc(a.complemento) : ''} · ${esc(a.bairro)} · ${esc(a.cidade)}/${esc(a.uf)}<br>Assim que o pedido for postado, você recebe o código de rastreio por e-mail.</p></div>`;
  return enviarEmail({ para: o.customer.email, assunto: `Pedido #${o.number} confirmado — ${LOJA}`, html });
}
