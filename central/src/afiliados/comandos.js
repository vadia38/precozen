// Comandos do módulo afiliados: importar, analisar, reviews, comparativos, programas, fontes.
import { opcao } from '../core/cli.js';
import { log, tabela } from '../core/log.js';
import { formatarMoeda, formatarNumero, truncar } from '../core/util.js';
import { FONTES } from './fontes/index.js';
import { importarDeFonte, carregarProdutos } from './importar.js';
import { analisar } from './analisar.js';
import { gerarReviews } from './reviews.js';
import { gerarComparativos } from './comparativos.js';
import { programas, categoriasCanonicas } from './programas.js';

export const comandos = {
  importar: {
    descricao: 'Importa produtos de um arquivo (CSV/JSON) ou de uma fonte online e mescla na base local',
    opcoes: { arquivo: 'caminho do CSV/JSON (fonte "arquivo")', fonte: 'arquivo | amazon-paapi | mercadolivre | shopee | hotmart', palavras: 'termo de busca (fontes online)', programa: 'programa padrão dos registros (amazon-br, mercado-livre, ...)', paginas: 'páginas a buscar (online)', substituir: 'apaga a base antes de importar', dias: 'janela em dias (hotmart)' },
    async executar(args, { config }) {
      const nomeFonte = opcao(args, 'fonte', args.arquivo ? 'arquivo' : 'arquivo');
      const opcoes = { arquivo: opcao(args, 'arquivo'), palavras: opcao(args, 'palavras'), programa: opcao(args, 'programa', 'amazon-br'), paginas: opcao(args, 'paginas', 1, 'inteiro'), limite: opcao(args, 'limite', 50, 'inteiro'), substituir: opcao(args, 'substituir', false, 'flag'), dias: opcao(args, 'dias', 30, 'inteiro'), indice: opcao(args, 'indice', 'All') };
      const r = await importarDeFonte(nomeFonte, opcoes, { config });
      for (const a of r.avisos.slice(0, 15)) log.aviso(a);
      if (r.avisos.length > 15) log.aviso(`… e mais ${r.avisos.length - 15} avisos`);
      return { resumo: `${r.registros} registros lidos de ${nomeFonte}: ${r.novos} novos, ${r.atualizados} atualizados, ${r.ignorados} ignorados · base com ${r.total} produtos` };
    },
  },
  analisar: {
    descricao: 'Pontua os produtos (comissão × demanda × qualidade × preço × tendência) e gera o ranking em JSON, CSV e Markdown',
    opcoes: { top: 'limita o ranking aos N melhores', minScore: 'score mínimo (0–100)', programa: 'filtra por programa', categoria: 'filtra por categoria canônica', minPreco: 'preço mínimo', maxPreco: 'preço máximo' },
    async executar(args, { config }) {
      const filtros = { top: opcao(args, 'top', 0, 'inteiro') || undefined, minScore: opcao(args, 'minScore', 0, 'numero') || undefined, programa: opcao(args, 'programa'), categoria: opcao(args, 'categoria'), minPreco: opcao(args, 'minPreco', 0, 'numero') || undefined, maxPreco: opcao(args, 'maxPreco', 0, 'numero') || undefined };
      const { ranking, arquivos } = analisar({ config, filtros });
      log.titulo('Ranking (top 20)');
      tabela(ranking.produtos.slice(0, 20), [
        { chave: (p) => p.pontuacao.posicao, rotulo: '#', alinhar: 'direita' },
        { chave: (p) => truncar(p.nome, 48), rotulo: 'Produto' },
        { chave: 'programa', rotulo: 'Programa' },
        { chave: (p) => (p.preco ? formatarMoeda(p.preco, p.moeda) : '—'), rotulo: 'Preço', alinhar: 'direita' },
        { chave: (p) => `${formatarMoeda(p.comissaoValor, p.moeda)} (${formatarNumero(p.comissaoTaxa * 100, 1)}%)`, rotulo: 'Comissão', alinhar: 'direita' },
        { chave: (p) => (p.vendasMes === null ? '—' : `${formatarNumero(p.vendasMes)}${p.vendasFonte.startsWith('estimado') ? '*' : ''}`), rotulo: 'Vendas/mês', alinhar: 'direita' },
        { chave: (p) => `${p.pontuacao.score}${p.pontuacao.parcial ? '†' : ''}`, rotulo: 'Score', alinhar: 'direita' },
        { chave: (p) => p.pontuacao.classe, rotulo: 'Classe' },
        { chave: (p) => formatarMoeda(p.pontuacao.epc100, p.moeda), rotulo: 'Ganho/100 cliques', alinhar: 'direita' },
      ]);
      log.info(`\n* estimativa por ranking/histórico · † score parcial (sem demanda)\nArquivos: ${Object.values(arquivos).join(', ')}`);
      const c = ranking.resumo.porClasse;
      return { resumo: `${ranking.resumo.total} produtos pontuados · ouro ${c.ouro || 0} · prata ${c.prata || 0} · bronze ${c.bronze || 0} · descartar ${c.descartar || 0}` };
    },
  },
  reviews: {
    descricao: 'Gera análises (Markdown) para os melhores produtos do ranking em central/conteudo/posts',
    opcoes: { top: 'quantidade de produtos (padrão 10)', id: 'ids específicos, separados por vírgula', classes: 'classes aceitas (padrão ouro,prata)', forcar: 'sobrescreve posts existentes', ia: 'reescreve as seções com IA (Claude) — precisa de ANTHROPIC_API_KEY' },
    async executar(args, { config }) {
      const r = await gerarReviews({ config, top: opcao(args, 'top', 10, 'inteiro'), ids: opcao(args, 'id', null, 'lista') || undefined, classes: opcao(args, 'classes', ['ouro', 'prata'], 'lista'), forcar: opcao(args, 'forcar', false, 'flag'), ia: opcao(args, 'ia', false, 'flag') });
      for (const g of r.gerados) log.passo(`gerado ${g}`);
      for (const p of r.pulados) log.info(`  já existia (use --forcar): ${p}`);
      return { resumo: `${r.gerados.length} análises geradas, ${r.pulados.length} mantidas em ${r.dir}` };
    },
  },
  comparativos: {
    descricao: 'Gera posts "Os N melhores <categoria> de <ano>" para categorias com produtos suficientes',
    opcoes: { minimo: 'mínimo de produtos por categoria (padrão 3)', forcar: 'sobrescreve posts existentes' },
    async executar(args, { config }) {
      const r = gerarComparativos({ config, minimo: opcao(args, 'minimo', 3, 'inteiro'), forcar: opcao(args, 'forcar', false, 'flag') });
      for (const g of r.gerados) log.passo(`gerado ${g}`);
      return { resumo: `${r.gerados.length} comparativos gerados, ${r.pulados.length} mantidos` };
    },
  },
  programas: {
    descricao: 'Lista os programas de afiliados e as taxas de comissão de referência por categoria',
    async executar() {
      const cats = categoriasCanonicas();
      for (const [id, p] of Object.entries(programas())) {
        log.titulo(`${id} — ${p.nome} (${p.moeda}) · padrão ${formatarNumero(p.padrao * 100, 1)}% · cookie ${p.cookieDias} dia(s)`);
        const linhas = Object.entries(p.categorias || {}).map(([c, t]) => `${cats[c]?.nome || c} ${formatarNumero(t * 100, 1)}%`);
        log.info(linhas.length ? `  ${linhas.join(' · ')}` : '  comissão definida por produto (informe a coluna comissao)');
        if (p.observacaoLink) log.info(`  ${p.observacaoLink}`);
      }
      log.info('\nValores de referência (data/programas.json). Confira nas tabelas oficiais e ajuste.');
      return { resumo: `${Object.keys(programas()).length} programas · ${carregarProdutos().length} produtos na base` };
    },
  },
  fontes: {
    descricao: 'Lista as fontes de importação disponíveis',
    async executar() {
      for (const [id, f] of Object.entries(FONTES)) log.info(`  ${id.padEnd(14)} ${f.descricao}`);
      return { resumo: `${Object.keys(FONTES).length} fontes` };
    },
  },
};
