// Normaliza registros brutos (CSV, JSON ou APIs) para o modelo de produto do sistema.
import { paraNumero, paraInteiro, lista, normalizar, slug, dataIso, urlSegura } from '../core/util.js';
import { resolverCategoria, nomeCategoria, taxaComissao, montarLink, urlProduto, moedaPrograma, programas } from './programas.js';
import { resolverVendas } from './estimativas.js';

/** Aliases de colunas aceitos na importação (todos em minúsculas, sem acento, com _). */
const ALIASES = {
  identificador: ['id', 'asin', 'codigo', 'sku', 'identificador', 'item_id', 'produto_id', 'mlb', 'itemid'],
  programa: ['programa', 'program', 'loja', 'marketplace', 'fonte'],
  nome: ['nome', 'titulo', 'produto', 'title', 'name', 'descricao_curta'],
  marca: ['marca', 'brand', 'fabricante'],
  categoria: ['categoria', 'category', 'departamento', 'nicho'],
  preco: ['preco', 'price', 'valor', 'preco_r', 'preco_atual'],
  precoAntigo: ['preco_antigo', 'preco_de', 'preco_original', 'list_price', 'de'],
  comissao: ['comissao', 'commission', 'taxa', 'comissao_pct', 'porcentagem'],
  bsr: ['bsr', 'ranking', 'rank', 'sales_rank', 'posicao_vendas', 'best_seller_rank'],
  vendasMes: ['vendas', 'vendas_mes', 'vendas_mensais', 'sales', 'monthly_sales', 'unidades_mes'],
  totalVendido: ['total_vendido', 'vendidos', 'sold_quantity', 'sold'],
  criadoEm: ['criado_em', 'date_created', 'data_criacao', 'desde'],
  avaliacao: ['avaliacao', 'nota', 'rating', 'estrelas', 'stars', 'avaliacao_media'],
  numAvaliacoes: ['avaliacoes', 'num_avaliacoes', 'reviews', 'qtd_avaliacoes', 'review_count', 'n_avaliacoes', 'opinioes'],
  tendencia: ['tendencia', 'trend'],
  url: ['url', 'pagina', 'product_url'],
  link: ['link', 'link_afiliado', 'affiliate_link', 'hotlink', 'short_link'],
  imagem: ['imagem', 'image', 'foto', 'image_url'],
  descricao: ['descricao', 'description', 'resumo', 'sobre'],
  pros: ['pros', 'pontos_fortes', 'vantagens'],
  contras: ['contras', 'pontos_fracos', 'desvantagens', 'atencao'],
  atributos: ['atributos', 'especificacoes', 'ficha', 'specs', 'caracteristicas'],
  palavrasChave: ['palavras_chave', 'keywords', 'tags'],
  publico: ['publico', 'para_quem', 'indicado_para'],
};

function pegar(linha, campo) {
  for (const alias of ALIASES[campo]) {
    if (linha[alias] !== undefined && linha[alias] !== null && String(linha[alias]).trim() !== '') return linha[alias];
  }
  const direto = linha[campo];
  return direto !== undefined && direto !== null && String(direto).trim() !== '' ? direto : undefined;
}

/** "cor=preto; potencia=1200W" ou objeto → { cor: 'preto', potencia: '1200W' } */
export function lerAtributos(valor) {
  if (!valor) return {};
  if (typeof valor === 'object' && !Array.isArray(valor)) return Object.fromEntries(Object.entries(valor).map(([k, v]) => [String(k).trim(), String(v).trim()]).filter(([k, v]) => k && v));
  const out = {};
  for (const par of String(valor).split(/[;|\n]/)) {
    const m = par.match(/^\s*([^=:]+?)\s*[=:]\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function limparTexto(v, max = 2000) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Converte um registro bruto no modelo interno. `padroes` traz programa padrão e configurações.
 * Devolve { produto, avisos } — produto é null quando não dá para aproveitar o registro.
 */
export function normalizarProduto(bruto, { programaPadrao = 'amazon-br', configAfiliados = {}, hoje = new Date() } = {}) {
  const avisos = [];
  const linha = Object.fromEntries(Object.entries(bruto || {}).map(([k, v]) => [normalizar(k).replace(/[^a-z0-9]+/g, '_'), v]));
  const nome = limparTexto(pegar(linha, 'nome'), 200);
  if (!nome) return { produto: null, avisos: ['registro sem nome'] };
  let programa = slug(pegar(linha, 'programa') || programaPadrao);
  if (!programas()[programa]) {
    const alias = { amazon: 'amazon-br', 'amazon_br': 'amazon-br', 'amazon-com-br': 'amazon-br', ml: 'mercado-livre', mercadolivre: 'mercado-livre', 'mercado-libre': 'mercado-livre', magazine: 'magalu', 'magazine-luiza': 'magalu' }[programa];
    if (alias) programa = alias;
    else { avisos.push(`programa desconhecido "${programa}", usando ${programaPadrao}`); programa = programaPadrao; }
  }
  const identificador = limparTexto(pegar(linha, 'identificador'), 80) || null;
  const categoriaTexto = limparTexto(pegar(linha, 'categoria'), 80) || 'outros';
  const categoria = resolverCategoria(categoriaTexto);
  const preco = paraNumero(pegar(linha, 'preco'));
  if (preco === null || preco <= 0) avisos.push(`${nome}: sem preço válido`);
  const precoAntigo = paraNumero(pegar(linha, 'precoAntigo'));
  const comissaoInformada = paraNumero(pegar(linha, 'comissao'));
  const comissaoTaxa = taxaComissao(programa, categoria, comissaoInformada);
  const bsr = paraInteiro(pegar(linha, 'bsr'));
  const avaliacao = paraNumero(pegar(linha, 'avaliacao'));
  const numAvaliacoes = paraInteiro(pegar(linha, 'numAvaliacoes'));
  const tendenciaBruta = paraNumero(pegar(linha, 'tendencia'));
  const link = montarLink(programa, identificador, configAfiliados.programas || {}, pegar(linha, 'link'));
  const url = urlProduto(programa, identificador, pegar(linha, 'url'));
  if (!link) avisos.push(`${nome}: sem link de afiliado (informe a coluna link${programa.startsWith('amazon') ? ' ou configure a tag do programa' : ''})`);
  const base = {
    id: `${programa}:${identificador || slug(nome, 40)}`,
    programa,
    identificador,
    nome,
    marca: limparTexto(pegar(linha, 'marca'), 80) || null,
    categoria,
    categoriaNome: nomeCategoria(categoria),
    categoriaOriginal: categoriaTexto,
    preco: preco !== null && preco > 0 ? preco : null,
    precoAntigo: precoAntigo && preco && precoAntigo > preco ? precoAntigo : null,
    moeda: moedaPrograma(programa),
    comissaoTaxa,
    comissaoInformada: comissaoInformada !== null,
    bsr: bsr && bsr > 0 ? bsr : null,
    vendasMes: paraNumero(pegar(linha, 'vendasMes')),
    totalVendido: paraNumero(pegar(linha, 'totalVendido')),
    criadoEm: pegar(linha, 'criadoEm') || null,
    avaliacao: avaliacao !== null && avaliacao >= 0 && avaliacao <= 5 ? avaliacao : (avaliacao !== null && avaliacao > 5 && avaliacao <= 10 ? avaliacao / 2 : null),
    numAvaliacoes: numAvaliacoes && numAvaliacoes > 0 ? numAvaliacoes : 0,
    tendencia: tendenciaBruta === null ? null : Math.max(-1, Math.min(1, Math.abs(tendenciaBruta) > 1 ? tendenciaBruta / 100 : tendenciaBruta)),
    url,
    link,
    imagem: urlSegura(pegar(linha, 'imagem')),
    descricao: limparTexto(pegar(linha, 'descricao'), 3000) || null,
    pros: lista(pegar(linha, 'pros')).map((p) => limparTexto(p, 200)),
    contras: lista(pegar(linha, 'contras')).map((p) => limparTexto(p, 200)),
    atributos: lerAtributos(pegar(linha, 'atributos')),
    palavrasChave: lista(pegar(linha, 'palavrasChave')).map((p) => limparTexto(p, 60)),
    publico: limparTexto(pegar(linha, 'publico'), 200) || null,
    atualizadoEm: dataIso(hoje),
  };
  const vendas = resolverVendas(base, configAfiliados.estimativas || {});
  base.vendasMes = vendas.vendasMes === null ? null : Math.round(vendas.vendasMes * 10) / 10;
  base.vendasFonte = vendas.fonte;
  return { produto: base, avisos };
}
