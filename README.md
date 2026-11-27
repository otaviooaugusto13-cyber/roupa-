# Loja streetwear — Fases 1 e 2 (catálogo, pagamento, estoque e frete)

## O que já funciona
- Front separado em `public/index.html`, `public/css/style.css` e `public/js/` (módulos ES). Visual idêntico ao original.
- Servidor Express (`server/index.js`) serve o front e a API `GET /api/products` e `GET /api/products/:slug`.
- Produtos e estoque por tamanho vêm do Firestore (`products` + subcoleção `variants`). Dinheiro em centavos.
- Se a API estiver fora do ar, o front usa `public/js/produtos-exemplo.js` como fallback (a loja nunca fica em branco).
- `server/seed.js` importa os 8 produtos de exemplo para o Firestore.
- `firestore.rules` nega todo acesso direto do navegador ao banco.

## Rodar no Windows (VS Code)
1. `npm install`
2. Copie `.env.example` para `.env` e preencha as 4 variáveis do Firebase (Console Firebase > Configurações do projeto > Contas de serviço > Gerar nova chave privada).
3. `npm run seed:dry` (confere o que será gravado) e depois `npm run seed`.
4. `npm run dev` e abra http://localhost:3000

## Deploy no Render (Web Service)
- Build Command: `npm install` — Start Command: `npm start`
- Cadastre no painel do Render as mesmas variáveis do `.env`. Mantenha a chave privada com os `\n` literais.
- Publique também as regras: `firebase deploy --only firestore:rules` (ou cole `firestore.rules` no Console).

## Atualizar o projeto
Extraia o zip sobre a pasta e rode `git add . && git commit -m "..." && git push origin main`.

## Pendências (marcadas com TODO no código)
- Estoque inicial: o seed usa 10 por tamanho (esgotados do site atual ficam em 0). Defina o real.
- Peso e dimensões de embalagem no seed são **provisórios** — meça as peças para o cálculo de frete.
- Fotos `detail` e `garmentFlat` (esta última é obrigatória para o provador virtual): ficam vazias até o painel admin.
- CSP está em modo `reportOnly`; depois de testar no navegador, troque para bloqueio em `server/index.js`.
- Os textos das 3 telas editoriais (`EDITORIAL`) e o nome da marca (`BRAND`) ainda estão fixos em `public/js/main.js`.

## Campos que acrescentei ao modelo da seção 4
- `products.position` (ordem da vitrine, evita índice composto no Firestore).
- `products.mockup {color, ink, word, bg, crew}` (dados do mockup SVG que o front gera quando uma foto falha).

---
# Fase 2 — Pagamento, estoque e frete

## Como funciona
1. Cliente preenche dados e CEP. O servidor busca o endereço (ViaCEP) e cota o frete (Melhor Envio) com peso/dimensões das variantes.
2. `POST /api/checkout`: recalcula TUDO no servidor (preços do banco, frete, desconto Pix), e numa **transação do Firestore** confere `stock - reserved` e incrementa `reserved`. Se faltar: *"O tamanho M de X acabou enquanto você comprava."*
3. Cria o pagamento no Mercado Pago: Pix (QR + copia e cola) ou cartão (token gerado nos iframes do MP; o cartão nunca passa pelo servidor).
4. **Webhook** valida a assinatura, busca o pagamento na API do MP e, se aprovado, baixa `stock` e `reserved` na mesma transação, marca `paid` e envia o e-mail. Notificação repetida não duplica nada (idempotência por `payments/{id}`).
5. Reserva vencida (15 min), recusa ou cancelamento: libera o estoque e marca `expired`/`canceled`. Roda por job interno (60 s), pelo endpoint `/api/cron/expirar` e ao consultar o pedido.

## Configurar o Mercado Pago (sandbox)
1. Painel Mercado Pago Developers > Suas integrações > crie a aplicação (Checkout Transparente / API de pagamentos).
2. Credenciais **de teste**: `MP_ACCESS_TOKEN` e `MP_PUBLIC_KEY` no `.env`.
3. Webhooks: URL `https://SEU-SITE.onrender.com/api/webhooks/mercadopago`, evento **Pagamentos**; copie a assinatura secreta para `MP_WEBHOOK_SECRET`. (O MP exige HTTPS: em desenvolvimento local use um túnel como ngrok e ponha a URL em `PUBLIC_URL`.)
4. Use as contas e cartões de teste do painel (seção "Test accounts"/"Test cards").
5. **Parcelas sem juros:** quem decide é a configuração de parcelamento da sua conta Mercado Pago, não a API. Confira lá; o site só exibe até `MAX_PARCELAS`.

## Melhor Envio
`MELHOR_ENVIO_TOKEN`, `CEP_ORIGEM`, `MELHOR_ENVIO_USER_AGENT` (com e-mail) e `MELHOR_ENVIO_URL` (sandbox ou produção).

## Render
- Variáveis de ambiente iguais ao `.env`. Crie um **Cron Job** (a cada 5 min) chamando `POST /api/cron/expirar` com o header `x-cron-secret: <CRON_SECRET>` (no plano gratuito o serviço dorme e o job interno para).

## Testes
`npm test` roda 15 testes (estoque, concorrência, webhook, CPF, frete). Sem emulador usa um Firestore falso em memória; para testar no Firestore de verdade: `npm run test:emulador` (precisa do Firebase CLI + Java).

## Regras que defini (confirme)
- **Pix:** o MP só aceita expiração ≥ 30 min. O cliente vê 15 min; ao vencer, cancelamos o Pix no MP. Se um Pix for pago mesmo assim, o sistema tenta vender (se ainda há estoque) ou **reembolsa automaticamente**.
- **Desconto Pix:** 5% sobre os produtos (não sobre o frete).
- **Frete grátis (≥ R$ 399):** a opção mais barata fica grátis; as demais cobram só a diferença.
- Cartão "em análise": a reserva é prorrogada de 10 em 10 min até o emissor decidir.
- Estorno/chargeback: marca o pedido como `refunded`; devolver o estoque fica manual (painel, Fase 3).

## Pendências da Fase 2
- Etiqueta de frete e código de rastreio: vão no painel admin (Fase 3).
- E-mail ao cliente quando o reembolso automático acontece (marcado com TODO).
- Provedor de e-mail: implementei Resend; troque em `server/services/email.js` se preferir SendGrid/Brevo.
- Conferir no sandbox os campos da resposta do Melhor Envio (`price`, `custom_price`, `delivery_time`, `error`).
