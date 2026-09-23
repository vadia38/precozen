// Mercado Livre: API pública de busca (sites/MLB/search) + detalhes e avaliações quando disponíveis.
// Os links de afiliado do programa do ML são gerados no painel; aqui vem o permalink do anúncio.
import { segredo } from '../../core/config.js';
import { obterJson } from '../../core/http.js';

export const nome = 'mercadolivre';
export const descricao = 'Busca pública do Mercado Livre (MLB); token opcional em MERCADOLIVRE_ACCESS_TOKEN';

const API = 'https://api.mercadolibre.com';

export function converterResultado(r, categoriaNome) {
  return {
    programa: 'mercado-livre',
    id: r.id,
    nome: r.title,
    marca: (r.attributes || []).find((a) => a.id === 'BRAND')?.value_name || '',
    categoria: categoriaNome || r.category_id || '',
    preco: r.price ?? '',
    preco_antigo: r.original_price ?? '',
    total_vendido: r.sold_quantity ?? '',
    date_created: r.date_created || '',
    avaliacao: r.reviews?.rating_average ?? '',
    avaliacoes: r.reviews?.total ?? '',
    imagem: r.thumbnail ? String(r.thumbnail).replace('-I.jpg', '-O.jpg').replace('http://', 'https://') : '',
    url: r.permalink || '',
    link: '',
    atributos: (r.attributes || []).filter((a) => a.value_name && a.id !== 'BRAND').slice(0, 8).map((a) => `${a.name}=${a.value_name}`).join('; '),
  };
}

function cabecalhos(deps) {
  const token = deps.token || segredo('MERCADOLIVRE_ACCESS_TOKEN');
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** buscar({ palavras, limite=50, site='MLB' }) */
export async function buscar(opcoes = {}, deps = {}) {
  const { palavras, limite = 50, site = 'MLB', detalhes = true } = opcoes;
  if (!palavras) throw new Error('informe --palavras "termo de busca"');
  const url = `${API}/sites/${encodeURIComponent(site)}/search?q=${encodeURIComponent(palavras)}&limit=${Math.min(50, limite)}&sort=relevance`;
  const dados = await obterJson(url, { cabecalhos: cabecalhos(deps), fetchImpl: deps.fetchImpl });
  const categorias = new Map();
  const resultados = dados.results || [];
  for (const r of resultados) {
    if (r.category_id && !categorias.has(r.category_id)) {
      try {
        const cat = await obterJson(`${API}/categories/${encodeURIComponent(r.category_id)}`, { cabecalhos: cabecalhos(deps), fetchImpl: deps.fetchImpl, tentativas: 1 });
        categorias.set(r.category_id, cat.path_from_root?.[1]?.name || cat.name || '');
      } catch { categorias.set(r.category_id, ''); }
    }
  }
  const registros = [];
  for (const r of resultados) {
    const reg = converterResultado(r, categorias.get(r.category_id));
    if (detalhes) {
      try {
        const rev = await obterJson(`${API}/reviews/item/${encodeURIComponent(r.id)}`, { cabecalhos: cabecalhos(deps), fetchImpl: deps.fetchImpl, tentativas: 1, timeoutMs: 8000 });
        if (rev.rating_average) reg.avaliacao = rev.rating_average;
        if (rev.paging?.total ?? rev.total) reg.avaliacoes = rev.paging?.total ?? rev.total;
      } catch { /* avaliações podem exigir autenticação */ }
    }
    registros.push(reg);
  }
  return registros;
}
