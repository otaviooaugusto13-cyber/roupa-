// Validações de entrada do checkout (nada que vem do navegador é confiável).
import { CFG } from '../config.js';

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

export function cpfValido(cpf) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHAVE = /^[A-Za-z0-9-]{16,64}$/;
const texto = (v, max = 120) => String(v ?? '').trim().slice(0, max);

/** Valida e normaliza o corpo de POST /api/checkout. Retorna { dados } ou { erro, campo }. */
export function validarCheckout(b = {}) {
  const falha = (campo, erro) => ({ campo, erro });

  if (!CHAVE.test(String(b.key ?? ''))) return falha('key', 'Requisição inválida. Recarregue a página.');

  const itens = Array.isArray(b.items) ? b.items : [];
  if (!itens.length || itens.length > 20) return falha('items', 'Seu carrinho está vazio.');
  const items = [];
  for (const i of itens) {
    const qty = Number(i?.qty);
    if (!CFG.tamanhos.includes(i?.size) || !Number.isInteger(qty) || qty < 1 || qty > CFG.maxQtdPorItem || !/^[a-z0-9-]{1,80}$/.test(String(i?.slug)))
      return falha('items', 'Há um item inválido no carrinho.');
    items.push({ slug: String(i.slug), size: i.size, qty });
  }

  const c = b.customer || {};
  const nome = texto(c.nome, 100);
  if (nome.split(/\s+/).filter(Boolean).length < 2) return falha('nome', 'Informe nome e sobrenome.');
  const email = texto(c.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return falha('email', 'E-mail inválido.');
  if (!cpfValido(c.cpf)) return falha('cpf', 'CPF inválido.');
  const telefone = soDigitos(c.telefone);
  if (telefone.length < 10 || telefone.length > 11) return falha('telefone', 'Telefone inválido (com DDD).');

  const a = b.address || {};
  const cep = soDigitos(a.cep);
  const uf = texto(a.uf, 2).toUpperCase();
  const address = {
    cep, uf, logradouro: texto(a.logradouro), numero: texto(a.numero, 20), complemento: texto(a.complemento, 60),
    bairro: texto(a.bairro, 80), cidade: texto(a.cidade, 80),
  };
  if (cep.length !== 8) return falha('cep', 'CEP inválido.');
  if (!address.logradouro) return falha('logradouro', 'Informe a rua.');
  if (!address.numero) return falha('numero', 'Informe o número (ou S/N).');
  if (!address.bairro) return falha('bairro', 'Informe o bairro.');
  if (!address.cidade || uf.length !== 2) return falha('cidade', 'Informe cidade e UF.');

  if (b.shipServiceId === undefined || b.shipServiceId === null || b.shipServiceId === '') return falha('frete', 'Escolha uma opção de frete.');

  const paymentMethod = b.paymentMethod;
  if (paymentMethod !== 'pix' && paymentMethod !== 'card') return falha('pagamento', 'Escolha a forma de pagamento.');

  let card = null;
  if (paymentMethod === 'card') {
    const k = b.card || {};
    const installments = Number(k.installments);
    if (!k.token || typeof k.token !== 'string' || !k.paymentMethodId) return falha('cartao', 'Confira os dados do cartão.');
    if (!Number.isInteger(installments) || installments < 1 || installments > CFG.maxParcelas)
      return falha('cartao', `Parcelamento em até ${CFG.maxParcelas}x.`);
    card = {
      token: String(k.token), installments, paymentMethodId: texto(k.paymentMethodId, 30),
      issuerId: k.issuerId ? texto(k.issuerId, 20) : undefined,
    };
  }

  return {
    dados: {
      key: b.key, items, paymentMethod, card, shipServiceId: String(b.shipServiceId),
      customer: { nome, email, cpf: soDigitos(c.cpf), telefone }, address,
    },
  };
}
