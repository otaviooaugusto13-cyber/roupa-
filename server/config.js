// Configurações de negócio (todas ajustáveis por variável de ambiente).
const num = (v, padrao) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : padrao);

export const CFG = {
  freteGratisCents: num(process.env.FRETE_GRATIS_CENTS, 39900), // frete grátis a partir de R$ 399,00
  pixDescontoPercent: num(process.env.PIX_DESCONTO_PERCENT, 5), // desconto no Pix (%)
  maxParcelas: num(process.env.MAX_PARCELAS, 6),                // parcelas máximas no cartão
  reservaMin: num(process.env.RESERVA_MIN, 15),                 // minutos de reserva de estoque
  // O Mercado Pago só aceita expiração de Pix entre 30 min e 30 dias (documentação atual).
  // A tela do cliente conta 15 min; passado isso cancelamos o Pix no MP e liberamos o estoque.
  pixExpiraMpMin: Math.max(30, num(process.env.PIX_EXPIRA_MP_MIN, 30)),
  maxQtdPorItem: 10,
  cepOrigem: (process.env.CEP_ORIGEM || '').replace(/\D/g, ''),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  mpPublicKey: process.env.MP_PUBLIC_KEY || '',
  tamanhos: ['P', 'M', 'G', 'GG', 'XGG'],
};

/** Erro de regra de negócio com status HTTP e mensagem segura para mostrar ao cliente. */
export class ErroNegocio extends Error {
  constructor(status, mensagem, extra = {}) { super(mensagem); this.status = status; this.extra = extra; }
}
