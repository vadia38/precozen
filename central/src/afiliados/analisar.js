// Análise: pontua a base de produtos, gera o ranking (JSON/CSV/Markdown) e resume por classe e categoria.
import { workspace, lerJson, gravarJson, gravarTexto } from '../core/arquivos.js';
import { paraCsv } from '../core/csv.js';
import { formatarMoeda, formatarNumero, dataIso } from '../core/util.js';
import { carregarProdutos } from './importar.js';
import { classificarLista } from './pontuacao.js';

export const caminhoRanking = () => workspace('afiliados', 'ranking.json');

export function carregarRanking() {
  return lerJson(caminhoRanking(), null);
}

export function filtrarProdutos(produtos, filtros = {}) {
  return produtos.filter((p) => {
    if (filtros.programa && p.programa !== filtros.programa) return false;
    if (filtros.categoria && p.categoria !== filtros.categoria) return false;
    if (filtros.minPreco && (p.preco || 0) < filtros.minPreco) return false;
    if (filtros.maxPreco && (p.preco || 0) > filtros.maxPreco) return false;
    return true;
  });
}

export function relatorioMarkdown(ranking, { titulo = 'Ranking de produtos para afiliados', hoje = new Date() } = {}) {
  const l = [`# ${titulo}`, '', `Gerado em ${dataIso(hoje)} · ${ranking.resumo.total} produtos · ouro ${ranking.resumo.porClasse.ouro || 0} · prata ${ranking.resumo.porClasse.prata || 0} · bronze ${ranking.resumo.porClasse.bronze || 0} · descartar ${ranking.resumo.porClasse.descartar || 0}`, ''];
  l.push('## Top produtos', '', '| # | Produto | Programa | Categoria | Preço | Comissão | Vendas/mês | Nota | Score | Classe | Ganho/100 cliques |', '|---|---|---|---|---:|---:|---:|---:|---:|---|---:|');
  for (const p of ranking.produtos.slice(0, 50)) {
    l.push(`| ${p.pontuacao.posicao} | ${p.nome.replace(/\|/g, '/')} | ${p.programa} | ${p.categoriaNome} | ${p.preco ? formatarMoeda(p.preco, p.moeda) : '—'} | ${formatarMoeda(p.comissaoValor, p.moeda)} (${formatarNumero(p.comissaoTaxa * 100, 1)}%) | ${p.vendasMes === null ? '—' : `${formatarNumero(p.vendasMes)}${p.vendasFonte.startsWith('estimado') ? '*' : ''}`} | ${p.avaliacao ? `${formatarNumero(p.avaliacao, 1)} (${formatarNumero(p.numAvaliacoes)})` : '—'} | ${p.pontuacao.score}${p.pontuacao.parcial ? '†' : ''} | ${p.pontuacao.classe} | ${formatarMoeda(p.pontuacao.epc100, p.moeda)} |`);
  }
  l.push('', '\\* estimativa a partir do ranking/histórico de vendas · † score parcial (sem dado de demanda)', '');
  l.push('## Categorias', '', '| Categoria | Produtos | Score médio | Ganho médio/100 cliques |', '|---|---:|---:|---:|');
  for (const c of ranking.resumo.porCategoria) l.push(`| ${c.categoriaNome} | ${c.total} | ${c.scoreMedio} | ${formatarMoeda(c.epcMedio)} |`);
  l.push('', '## Como ler', '', '- **Score** (0–100) combina comissão por venda, demanda (vendas/mês), qualidade (nota e volume de avaliações), faixa de preço e tendência, com os pesos de `precozen.config.json`.', '- **Ganho/100 cliques** = preço × comissão × conversão esperada × 100. É a métrica para comparar produtos entre programas.', '- Classes: ouro (analise primeiro), prata (boa aposta), bronze (só se faltar conteúdo na categoria), descartar.', '');
  return l.join('\n');
}

/**
 * Pontua e grava o ranking. filtros: { programa, categoria, minPreco, maxPreco, minScore, top }
 */
export function analisar({ config, filtros = {}, produtos, gravar = true, hoje = new Date() } = {}) {
  const base = produtos || carregarProdutos();
  if (!base.length) throw new Error('nenhum produto importado ainda (use: precozen afiliados importar --arquivo produtos.csv)');
  const filtrados = filtrarProdutos(base, filtros);
  const ranking = classificarLista(filtrados, config?.afiliados?.pontuacao);
  if (filtros.minScore) ranking.produtos = ranking.produtos.filter((p) => p.pontuacao.score >= filtros.minScore);
  if (filtros.top) ranking.produtos = ranking.produtos.slice(0, filtros.top);
  ranking.geradoEm = dataIso(hoje);
  ranking.filtros = filtros;
  const arquivos = {};
  if (gravar) {
    arquivos.json = gravarJson(caminhoRanking(), ranking);
    arquivos.csv = gravarTexto(workspace('afiliados', 'ranking.csv'), paraCsv(ranking.produtos.map((p) => ({
      posicao: p.pontuacao.posicao, id: p.id, programa: p.programa, nome: p.nome, categoria: p.categoriaNome, preco: p.preco ?? '', moeda: p.moeda,
      comissao_pct: Math.round(p.comissaoTaxa * 1000) / 10, comissao_valor: p.comissaoValor, vendas_mes: p.vendasMes ?? '', vendas_fonte: p.vendasFonte,
      avaliacao: p.avaliacao ?? '', avaliacoes: p.numAvaliacoes, score: p.pontuacao.score, classe: p.pontuacao.classe, ganho_100_cliques: p.pontuacao.epc100,
      receita_potencial_mes: p.pontuacao.receitaPotencialMes ?? '', link: p.link || '',
    }))));
    arquivos.md = gravarTexto(workspace('afiliados', 'ranking.md'), relatorioMarkdown(ranking, { hoje }));
  }
  return { ranking, arquivos };
}
