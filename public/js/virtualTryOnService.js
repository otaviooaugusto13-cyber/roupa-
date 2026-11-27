/* Camada de serviço do Provador Virtual com IA.

   HOJE: simula o processamento (etapas + atraso) e devolve só os parâmetros de posicionamento da peça,
   que o front usa para sobrepor a peça na foto (modo 2D). Nenhuma imagem sai do navegador.

   DEPOIS: troque o corpo de `gerarProvaVirtual` pela chamada real. Regras importantes:
   - NUNCA coloque chave de API (Replicate, Gemini...) no front. Crie uma rota no servidor
     (ex.: POST /api/tryon em server/routes/tryon.js) que guarda a chave no .env e repassa o pedido.
   - Envie a foto da pessoa e a foto da peça reta (`images.garmentFlat` no Firestore; ainda vazia, ver README).
   - O resultado volta como `imageUrl`; o front já sabe mostrar `imageUrl` no lugar da sobreposição.
   - Gere um aviso de consentimento antes do upload (LGPD: foto de pessoa é dado pessoal) e apague a imagem depois.

   Contrato (não mude, o front depende dele):
     entrada:  { fotoDataUrl: string, produto: { id, name, type, garmentFlatUrl? }, tamanho: string, onEtapa?: (texto, pct) => void }
     saída:    { modo: 'simulado' | 'ia', imageUrl: string | null, ajuste: { x, y, escala } }   // x,y em % do quadro; escala 1 = tamanho base
*/

export const ETAPAS = [
  'Enviando a foto',
  'Detectando a pose do corpo',
  'Separando a roupa atual',
  'Ajustando o caimento da peça',
  'Finalizando a imagem',
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Posição inicial da peça no quadro, por tipo (em % da largura/altura da foto). */
const AJUSTE_BASE = {
  tee:        { x: 50, y: 44, escala: 0.62 },
  tank:       { x: 50, y: 44, escala: 0.50 },
  tankdeep:   { x: 50, y: 44, escala: 0.50 },
  longsleeve: { x: 50, y: 46, escala: 0.66 },
  crop:       { x: 50, y: 33, escala: 0.60 },
  hoodie:     { x: 50, y: 42, escala: 0.72 },
  crophood:   { x: 50, y: 33, escala: 0.66 },
  jacket:     { x: 50, y: 44, escala: 0.72 },
  bra:        { x: 50, y: 41, escala: 0.50 },
  shorts:     { x: 50, y: 68, escala: 0.56 },
  pants:      { x: 50, y: 76, escala: 0.58 },
  jogger:     { x: 50, y: 76, escala: 0.58 },
  legging:    { x: 50, y: 75, escala: 0.56 },
};
/** Posição inicial da peça por tipo (compartilhada com o palco 3D). */
export const ajusteBase = (tipo) => ({ ...(AJUSTE_BASE[tipo] || AJUSTE_BASE.tee) });
/** Quanto a peça "enche" o corpo em cada tamanho (P mais justo, GG mais largo). */
export const FATOR_TAMANHO = { PP: 0.88, P: 0.94, M: 1, G: 1.06, GG: 1.13, XGG: 1.2 };

export async function gerarProvaVirtual({ fotoDataUrl, produto, tamanho = 'M', onEtapa }) {
  if (!fotoDataUrl) throw new Error('Envie uma foto para provar a peça.');

  /* ---------------------------------------------------------------
     TODO (API real) — exemplo com rota própria no servidor:

     const r = await fetch('/api/tryon', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ foto: fotoDataUrl, produtoSlug: produto.id, tamanho }),
     });
     if (!r.ok) throw new Error((await r.json()).erro || 'Não foi possível gerar a prova agora.');
     const { imageUrl } = await r.json();
     return { modo: 'ia', imageUrl, ajuste: AJUSTE_BASE[produto.type] };

     No servidor, a rota chama o provedor (ex.: Replicate com o modelo IDM-VTON, ou a Gemini API de imagem),
     espera o resultado e devolve a URL. Provedores levam de 10 a 60 s: use polling ou webhook.
     --------------------------------------------------------------- */

  // Simulação: percorre as etapas com atraso curto para o cliente ver o "processamento".
  for (let i = 0; i < ETAPAS.length; i++) {
    onEtapa?.(ETAPAS[i], Math.round(((i + 1) / ETAPAS.length) * 100));
    await espera(420 + Math.random() * 260);
  }
  const base = AJUSTE_BASE[produto.type] || AJUSTE_BASE.tee;
  return { modo: 'simulado', imageUrl: null, ajuste: { ...base, escala: +(base.escala * (FATOR_TAMANHO[tamanho] || 1)).toFixed(3) } };
}

/** Tamanho sugerido a partir de altura (cm) e peso (kg) do avatar. Heurística simples, só para a demonstração. */
export function sugerirTamanho(alturaCm, pesoKg) {
  const imc = pesoKg / Math.pow(alturaCm / 100, 2);
  let i = imc < 18.5 ? 0 : imc < 21 ? 1 : imc < 24 ? 2 : imc < 27 ? 3 : imc < 31 ? 4 : 5;
  if (alturaCm >= 188) i = Math.min(5, i + 1);
  return ['PP', 'P', 'M', 'G', 'GG', 'XGG'][i];
}
