import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { assinaturaValida } from '../services/assinatura-mp.js';
import { cpfValido, validarCheckout } from '../middleware/validacao.js';

// ---------- assinatura do webhook (template do Mercado Pago) ----------
const assina = (secret, { dataId, reqId, ts }) => crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest('hex');

test('webhook: assinatura correta é aceita (data.id em maiúsculas vira minúsculas no template)', () => {
  const secret = 'segredo-teste', ts = '1742505638683', reqId = '2066ca19-c6f1-498a-be75-1923005edd06';
  const v1 = assina(secret, { dataId: 'abc123', reqId, ts });
  assert.equal(assinaturaValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId: 'ABC123', secret }), true);
});
test('webhook: assinatura adulterada, segredo errado ou ausente são recusados', () => {
  const secret = 's', ts = '1', reqId = 'r';
  const v1 = assina(secret, { dataId: '10', reqId, ts });
  assert.equal(assinaturaValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId: '11', secret }), false); // outro data.id
  assert.equal(assinaturaValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId: '10', secret: 'outro' }), false);
  assert.equal(assinaturaValida({ xSignature: `ts=${ts},v1=zzzz`, xRequestId: reqId, dataId: '10', secret }), false);
  assert.equal(assinaturaValida({ xSignature: undefined, xRequestId: reqId, dataId: '10', secret }), false);
  assert.equal(assinaturaValida({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId: '10', secret: '' }), false);
});

// ---------- validação ----------
test('CPF: válidos e inválidos', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('529.982.247-24'), false);
  assert.equal(cpfValido('123'), false);
});
const base = () => ({
  key: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', items: [{ slug: 'voltage', size: 'M', qty: 1 }], paymentMethod: 'pix', shipServiceId: 1,
  customer: { nome: 'Maria Silva', email: 'maria@exemplo.com', cpf: '52998224725', telefone: '(19) 99999-0000' },
  address: { cep: '13970-000', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Itapira', uf: 'sp' },
});
test('checkout: corpo válido passa e normaliza', () => {
  const r = validarCheckout(base());
  assert.ok(r.dados); assert.equal(r.dados.address.cep, '13970000'); assert.equal(r.dados.address.uf, 'SP');
});
test('checkout: bloqueia quantidade absurda, tamanho falso, parcela > máximo e chave curta', () => {
  let b = base(); b.items[0].qty = 999; assert.equal(validarCheckout(b).campo, 'items');
  b = base(); b.items[0].size = 'XL'; assert.equal(validarCheckout(b).campo, 'items');
  b = base(); b.paymentMethod = 'card'; b.card = { token: 't', paymentMethodId: 'visa', installments: 12 }; assert.equal(validarCheckout(b).campo, 'cartao');
  b = base(); b.key = 'curta'; assert.equal(validarCheckout(b).campo, 'key');
});

// ---------- frete (fetch simulado) ----------
test('frete: ignora serviços com erro; acima de R$399 a opção mais barata é grátis e as outras cobram a diferença', async () => {
  process.env.MELHOR_ENVIO_TOKEN = 'x';
  (await import('../config.js')).CFG.cepOrigem = '13970000'; // config.js lê o ambiente ao ser importado
  const chamadas = [];
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url, init });
    return { ok: true, json: async () => ([
      { id: 1, name: 'PAC', price: '25.00', delivery_time: 8, company: { name: 'Correios' } },
      { id: 2, name: 'SEDEX', price: '40.00', delivery_time: 3, company: { name: 'Correios' } },
      { id: 3, name: 'Jadlog', error: 'Serviço indisponível', company: { name: 'Jadlog' } },
    ]) };
  };
  const { cotarFrete } = await import('../services/frete.js');
  const linha = { slug: 'voltage', size: 'M', qty: 2, unitCents: 20000, weightGrams: 350, dimensions: { lengthCm: 30, widthCm: 25, heightCm: 4 } };

  const abaixo = await cotarFrete({ cepDestino: '01001000', linhas: [linha], subtotalCents: 10000 });
  assert.deepEqual(abaixo.map((o) => [o.id, o.chargeCents, o.free]), [['1', 2500, false], ['2', 4000, false]]);

  const acima = await cotarFrete({ cepDestino: '01001001', linhas: [linha], subtotalCents: 40000 });
  assert.deepEqual(acima.map((o) => [o.id, o.chargeCents, o.free]), [['1', 0, true], ['2', 1500, false]]);

  const corpo = JSON.parse(chamadas[0].init.body);
  assert.equal(corpo.products[0].weight, 0.35);               // gramas -> kg
  assert.equal(corpo.products[0].insurance_value, 200);       // centavos -> reais
  assert.equal(corpo.from.postal_code, '13970000');
  assert.match(chamadas[0].init.headers['User-Agent'], /./);  // obrigatório no Melhor Envio
  assert.match(chamadas[0].url, /\/api\/v2\/me\/shipment\/calculate$/);
});
