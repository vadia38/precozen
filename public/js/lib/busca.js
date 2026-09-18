// Busca e filtragem do catálogo. Isomórfico (Node e navegador).
import { normalizar, tokens, tokensCompactos, compactar } from './util.js';

/**
 * Cria o índice de busca a partir dos produtos enriquecidos (dist/api/produtos.json).
 * Cada entrada guarda formas normalizadas para pontuar rapidamente.
 */
export function criarIndice(produtos) {
  return produtos.map((p) => {
    const codigo = compactar(p.codigo);
    const ref = compactar(p.ref || '');
    const nome = normalizar(p.nome);
    const extras = [
      p.categoriaNome,
      p.subgrupoNome,
      ...(p.montadorasNome || []),
      ...(p.modelos || []),
      ...Object.values(p.atributos || {}),
      ...(p.tags || []),
    ].filter(Boolean).join(' ');
    const texto = `${nome} ${normalizar(extras)}`;
    const toks = new Set([...tokens(texto), ...tokensCompactos(texto)]);
    return { p, codigo, codigoBase: codigo.split('-')[0], ref, nome, texto, toks };
  });
}

function pontuarTexto(entrada, q, qTokens) {
  let pontos = 0;
  for (const t of qTokens) {
    if (entrada.toks.has(t)) {
      pontos += 40;
    } else if (t.length >= 2 && [...entrada.toks].some((k) => k.startsWith(t))) {
      pontos += 22;
    } else if (t.length >= 3 && entrada.texto.includes(t)) {
      pontos += 10;
    } else {
      return -1; // todos os termos precisam bater
    }
  }
  if (entrada.nome.startsWith(q)) pontos += 30;
  else if (entrada.nome.includes(q)) pontos += 15;
  return pontos;
}

/**
 * Pontua uma entrada do índice para a consulta. Retorna -1 quando não bate.
 * Prioridade: código exato > código por prefixo > referência > texto.
 */
export function pontuar(entrada, consulta) {
  const q = normalizar(consulta);
  if (!q) return 0;
  const qc = compactar(q);
  const qTokens = tokens(q);
  if (qc && (entrada.codigo === qc || entrada.codigo === q)) return 1000;
  if (qc && qc.length >= 4 && (entrada.codigoBase === qc || entrada.codigo.startsWith(qc))) return 800;
  if (entrada.ref && qc && entrada.ref === qc) return 700;
  if (entrada.ref && qc.length >= 3 && entrada.ref.startsWith(qc)) return 600;
  if (entrada.ref && qc.length >= 4 && entrada.ref.includes(qc)) return 500;
  return pontuarTexto(entrada, q, qTokens);
}

/**
 * Executa a busca com filtros e ordenação.
 * @param {Array} indice  saída de criarIndice
 * @param {string} consulta texto digitado
 * @param {object} opcoes  { categoria, subgrupo, montadora, ordem: 'relevancia'|'catalogo'|'nome'|'codigo' }
 * @returns {Array} produtos ordenados
 */
export function buscar(indice, consulta = '', opcoes = {}) {
  const { categoria, subgrupo, montadora } = opcoes;
  const temConsulta = normalizar(consulta).length > 0;
  const ordem = opcoes.ordem || (temConsulta ? 'relevancia' : 'catalogo');
  const resultados = [];
  for (const e of indice) {
    const p = e.p;
    if (categoria && p.categoria !== categoria) continue;
    if (subgrupo && p.subgrupo !== subgrupo) continue;
    if (montadora && !(p.montadoras || []).includes(montadora)) continue;
    const pontos = temConsulta ? pontuar(e, consulta) : 0;
    if (pontos < 0) continue;
    resultados.push({ p, pontos });
  }
  const porNome = (a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR', { sensitivity: 'base' });
  const porCodigo = (a, b) => a.p.codigo.localeCompare(b.p.codigo, 'pt-BR', { numeric: true });
  const porCatalogo = (a, b) => (a.p.ordem || 0) - (b.p.ordem || 0);
  const comparadores = {
    relevancia: (a, b) => b.pontos - a.pontos || porCatalogo(a, b),
    catalogo: porCatalogo,
    nome: porNome,
    codigo: porCodigo,
  };
  resultados.sort(comparadores[ordem] || comparadores.catalogo);
  return resultados.map((r) => r.p);
}

/** Sugestões rápidas (até N) para o campo de busca do topo. */
export function sugerir(indice, consulta, limite = 6) {
  if (!normalizar(consulta)) return [];
  return buscar(indice, consulta, { ordem: 'relevancia' }).slice(0, limite);
}
