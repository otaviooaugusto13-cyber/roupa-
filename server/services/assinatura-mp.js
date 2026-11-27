import crypto from 'node:crypto';

/**
 * Valida o header x-signature do webhook.
 * Template (docs MP): id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;  -> HMAC-SHA256 hex com a assinatura secreta.
 * Se algum valor não vier na notificação, o par correspondente é omitido do template.
 */
export function assinaturaValida({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !secret) return false;
  let ts, v1;
  for (const parte of String(xSignature).split(',')) {
    const [k, v] = parte.split('=').map((s) => s?.trim());
    if (k === 'ts') ts = v; else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1) return false;
  let manifest = '';
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(esperado, 'hex'), b = Buffer.from(v1, 'hex');
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}
