// Servidor Express: API + arquivos estáticos do front.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import productsRouter from './routes/products.js';
import configRouter from './routes/config.js';
import cepRouter from './routes/cep.js';
import shippingRouter from './routes/shipping.js';
import checkoutRouter from './routes/checkout.js';
import ordersRouter from './routes/orders.js';
import webhooksRouter from './routes/webhooks.js';
import cronRouter from './routes/cron.js';
import { ErroNegocio } from './config.js';
import { iniciarJobExpiracao } from './services/pedidos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do proxy do Render: necessário para o rate limit ver o IP real

app.use(helmet({
  // reportOnly: só avisa no console do navegador, sem bloquear. Depois de testar tudo, troque para false (modo bloqueio).
  contentSecurityPolicy: {
    useDefaults: false,
    reportOnly: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://sdk.mercadopago.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://firebasestorage.googleapis.com', 'https://storage.googleapis.com', 'https://http2.mlstatic.com'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'", 'https://api.mercadopago.com', 'https://*.mercadopago.com', 'https://*.mercadolibre.com', 'https://*.mercadolivre.com.br'],
      frameSrc: ['https://*.mercadopago.com', 'https://*.mercadopago.com.br', 'https://*.mercadolibre.com', 'https://*.mercadolivre.com.br'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '100kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const limite = (limit) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, message: { erro: 'Muitas requisições. Aguarde um instante.' } });
app.use('/api/config', limite(60), configRouter);
app.use('/api/products', limite(120), productsRouter);
app.use('/api/cep', limite(40), cepRouter);
app.use('/api/shipping', limite(30), shippingRouter);
app.use('/api/checkout', limite(10), checkoutRouter);
app.use('/api/orders', limite(60), ordersRouter);   // o front consulta o status do Pix a cada poucos segundos
app.use('/api/webhooks', webhooksRouter);           // sem rate limit: quem chama é o Mercado Pago (assinatura validada)
app.use('/api/cron', limite(10), cronRouter);
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

app.use(express.static(publicDir, { extensions: ['html'], maxAge: '5m' }));

// Tratador de erros: não vaza detalhes internos para o cliente
app.use((err, _req, res, _next) => {
  if (err instanceof ErroNegocio) return res.status(err.status).json({ erro: err.message, ...err.extra });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  console.error('[erro]', err);
  res.status(500).json({ erro: 'Erro interno. Tente novamente em instantes.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loja rodando em http://localhost:${PORT}`);
  iniciarJobExpiracao(); // libera reservas vencidas a cada 60 s (além do endpoint /api/cron/expirar e da checagem ao consultar o pedido)
});
