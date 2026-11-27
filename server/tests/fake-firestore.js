// Firestore falso em memória, só para testes locais sem emulador.
// Reproduz o que importa para o estoque: transações com controle otimista de concorrência
// (se um documento lido mudou antes do commit, a transação é repetida, como no Firestore real).
export class Timestamp {
  constructor(ms) { this.ms = ms; }
  static fromMillis(ms) { return new Timestamp(ms); }
  static now() { return new Timestamp(Date.now()); }
  toMillis() { return this.ms; }
}
export const FieldValue = {
  increment: (n) => ({ __inc: n }),
  serverTimestamp: () => Timestamp.now(),
};

export function criarFakeDb() {
  const store = new Map(); // caminho -> { data, version }
  const tick = () => new Promise((r) => setImmediate(r)); // força intercalação entre transações

  const aplicar = (atual, patch, merge) => {
    const base = merge ? { ...(atual || {}) } : { ...(atual || {}) };
    for (const [k, v] of Object.entries(patch)) base[k] = v && v.__inc !== undefined ? (Number(base[k]) || 0) + v.__inc : v;
    return base;
  };
  const snap = (path) => {
    const r = store.get(path);
    return { exists: !!r, id: path.split('/').pop(), ref: ref(path), data: () => (r ? { ...r.data } : undefined), _v: r ? r.version : 0 };
  };
  const gravar = (path, op, data, merge) => {
    const r = store.get(path);
    if (op === 'delete') { store.delete(path); return; }
    if (op === 'update' && !r) throw new Error('NOT_FOUND: ' + path);
    const dados = op === 'set' && !merge ? aplicar({}, data) : aplicar(r?.data, data);
    store.set(path, { data: dados, version: (r?.version || 0) + 1 });
  };
  function ref(path) {
    return {
      path, id: path.split('/').pop(),
      collection: (nome) => colecao(`${path}/${nome}`),
      get: async () => snap(path),
      set: async (d, o) => gravar(path, 'set', d, o?.merge),
      update: async (d) => gravar(path, 'update', d),
    };
  }
  function colecao(path) {
    return {
      doc: (id) => ref(`${path}/${id}`),
      where: (campo, op, valor) => ({
        limit: (n) => ({
          get: async () => {
            const docs = [...store.keys()].filter((k) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
              .map(snap).filter((s) => { const v = s.data()[campo]; const a = v?.toMillis ? v.toMillis() : v; const b = valor?.toMillis ? valor.toMillis() : valor; return op === '<=' ? a <= b : a === b; }).slice(0, n);
            return { docs };
          },
        }),
      }),
    };
  }

  const db = {
    collection: (nome) => colecao(nome),
    async runTransaction(fn) {
      for (let tentativa = 0; tentativa < 8; tentativa++) {
        const lidos = new Map(); const escritas = [];
        const tx = {
          async getAll(...refs) { await tick(); return refs.map((r) => { const s = snap(r.path); lidos.set(r.path, s._v); return s; }); },
          async get(r) { return (await tx.getAll(r))[0]; },
          set: (r, d, o) => escritas.push(['set', r.path, d, o?.merge]),
          update: (r, d) => escritas.push(['update', r.path, d]),
          delete: (r) => escritas.push(['delete', r.path]),
        };
        const resultado = await fn(tx);
        await tick();
        // commit atômico: se algum doc lido mudou, repete
        const conflito = [...lidos].some(([p, v]) => (store.get(p)?.version || 0) !== v);
        if (conflito) continue;
        escritas.forEach(([op, p, d, m]) => gravar(p, op, d, m));
        return resultado;
      }
      throw new Error('Transação abortada após várias tentativas');
    },
  };
  return { db, store };
}
