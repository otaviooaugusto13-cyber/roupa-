// Consulta de endereço pelo CEP (ViaCEP: GET https://viacep.com.br/ws/{cep}/json/ — CEP inexistente volta { "erro": true }).
import { Router } from 'express';

const router = Router();
const cache = new Map(); // CEP muda raramente: cache de 24h
const DIA = 24 * 3600_000;

router.get('/:cep', async (req, res) => {
  const cep = String(req.params.cep).replace(/\D/g, '');
  if (cep.length !== 8) return res.status(400).json({ erro: 'CEP inválido.' });
  const hit = cache.get(cep);
  if (hit && Date.now() - hit.em < DIA) return hit.dados ? res.json(hit.dados) : res.status(404).json({ erro: 'CEP não encontrado.' });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.erro) { cache.set(cep, { em: Date.now(), dados: null }); return res.status(404).json({ erro: 'CEP não encontrado.' }); }
    const dados = { cep, logradouro: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', uf: d.uf || '' };
    cache.set(cep, { em: Date.now(), dados });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    res.json(dados);
  } catch (e) {
    console.error('[cep] ViaCEP falhou:', e.message);
    // O cliente ainda pode preencher o endereço à mão
    res.status(502).json({ erro: 'Não foi possível buscar o endereço agora. Preencha manualmente.' });
  }
});
export default router;
