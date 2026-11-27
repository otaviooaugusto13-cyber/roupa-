// Integração com o Mercado Pago (Checkout Transparente via Payments API).
// Docs consultadas: SDK Node (MercadoPagoConfig + Payment), POST /v1/payments, PUT /v1/payments/{id} (cancelar),
// POST /v1/payments/{id}/refunds (reembolso total = corpo vazio) e validação do header x-signature.
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { CFG } from '../config.js';

const API = 'https://api.mercadopago.com';
let _client;
function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN ausente no .env (use a credencial de TESTE no sandbox).');
  return (_client ??= new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } }));
}

export const reais = (cents) => Number((cents / 100).toFixed(2));

/** Data de expiração do Pix no formato do MP, com offset de Brasília (-03:00; o Brasil não tem horário de verão). */
function dataExpiracao(minutos) {
  const d = new Date(Date.now() + minutos * 60_000 - 3 * 3600_000);
  return d.toISOString().replace('Z', '-03:00');
}

function pagadorBase(pedido) {
  const [primeiro, ...resto] = pedido.customer.nome.split(/\s+/);
  return {
    email: pedido.customer.email, first_name: primeiro, last_name: resto.join(' '),
    identification: { type: 'CPF', number: pedido.customer.cpf },
  };
}
const itensInfo = (pedido) => pedido.items.map((i) => ({
  id: `${i.productId}-${i.size}`, title: `${i.name} (${i.size})`, quantity: i.qty, unit_price: reais(i.unitCents),
}));
const urlNotificacao = () => (CFG.publicUrl.startsWith('https://') ? `${CFG.publicUrl}/api/webhooks/mercadopago` : undefined);

/** Cria o pagamento Pix. A chave de idempotência evita cobrança duplicada em reenvio. */
export async function criarPix(orderId, pedido) {
  const body = {
    transaction_amount: reais(pedido.totalCents),
    description: `Pedido #${pedido.number}`,
    payment_method_id: 'pix',
    date_of_expiration: dataExpiracao(CFG.pixExpiraMpMin),
    external_reference: orderId,
    payer: pagadorBase(pedido),
    additional_info: { items: itensInfo(pedido) },
    ...(urlNotificacao() ? { notification_url: urlNotificacao() } : {}),
  };
  return new Payment(client()).create({ body, requestOptions: { idempotencyKey: `${orderId}-pix` } });
}

/** Cria o pagamento com cartão a partir do token gerado no navegador (os dados do cartão nunca chegam aqui). */
export async function criarCartao(orderId, pedido, card) {
  const body = {
    transaction_amount: reais(pedido.totalCents),
    token: card.token,
    description: `Pedido #${pedido.number}`,
    installments: card.installments,
    payment_method_id: card.paymentMethodId,
    ...(card.issuerId ? { issuer_id: Number(card.issuerId) } : {}),
    external_reference: orderId,
    payer: { email: pedido.customer.email, identification: { type: 'CPF', number: pedido.customer.cpf } },
    additional_info: { items: itensInfo(pedido) },
    ...(urlNotificacao() ? { notification_url: urlNotificacao() } : {}),
  };
  return new Payment(client()).create({ body, requestOptions: { idempotencyKey: `${orderId}-card` } });
}

/** Consulta o pagamento na API (fonte da verdade; nunca confie só no corpo do webhook). */
export const buscarPagamento = (id) => new Payment(client()).get({ id });

async function chamar(metodo, caminho, corpo, idem) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json',
      ...(idem ? { 'X-Idempotency-Key': idem } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const txt = await r.text();
  if (!r.ok) { const e = new Error(`MP ${metodo} ${caminho} -> ${r.status}: ${txt.slice(0, 300)}`); e.status = r.status; throw e; }
  return txt ? JSON.parse(txt) : {};
}

/** Cancela pagamento pendente/em análise (só vale para status pending, in_process ou authorized). */
export const cancelarPagamento = (id) => chamar('PUT', `/v1/payments/${id}`, { status: 'cancelled' });

/** Reembolso TOTAL (corpo vazio = total). */
export const reembolsarTotal = (id, chaveIdem) => chamar('POST', `/v1/payments/${id}/refunds`, undefined, chaveIdem);

export { assinaturaValida } from './assinatura-mp.js';
