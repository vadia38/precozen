// Comandos do módulo kdp: livro, tipos, trims, preco, metadados, nicho, manuscrito (IA).
import path from 'node:path';
import { opcao } from '../core/cli.js';
import { log, tabela } from '../core/log.js';
import { formatarMoeda, formatarNumero, lista } from '../core/util.js';
import { RAIZ_CENTRAL, workspace, gravarJson, gravarTexto, nomeSeguro } from '../core/arquivos.js';
import { gerarLivro, INTERIORES } from './livro.js';
import { listarTrims, dimensoesCapa, larguraLombada } from './especificacoes.js';
import { royaltyPaperback, royaltyEbook, sugerirPrecos, custoImpressao, TABELAS } from './royalties.js';
import { gerarMetadadosTemplate, validarMetadados, tiposDisponiveis } from './metadados.js';
import { analisarNichosDeArquivo } from './nicho.js';

const flag = (args, nome, padrao) => (args[nome] === undefined ? padrao : args[nome] !== false && args[nome] !== 'nao' && args[nome] !== 'não' && args[nome] !== 'false' && args[nome] !== '0');

export const comandos = {
  livro: {
    descricao: 'Gera um livro pronto para o KDP: interior em PDF (fontes embutidas), metadados, manifesto e capa (SVG/HTML)',
    opcoes: { tipo: `${Object.keys(INTERIORES).join(' | ')}`, titulo: 'título do livro', subtitulo: 'subtítulo', autor: 'autor (padrão: kdp.autor da config)', trim: 'tamanho de corte (padrão 6x9; veja kdp trims)', papel: 'branco | creme | cor-padrao | cor-premium', paginas: 'meta de páginas (par, ≥ 24)', sangria: 'interior com sangria (imagens até a borda)', tema: 'tema (caça-palavras) ou assunto', palavras: 'palavras próprias para caça-palavras (vírgula)', quantidade: 'nº de puzzles/labirintos', dificuldade: 'nível (sudoku/labirinto/caça-palavras)', porPagina: 'puzzles por página', inicio: 'AAAA-MM (planner/hábitos)', meses: 'meses (planner/hábitos)', manuscrito: 'arquivo .md/.json (tipo texto)', pasta: 'pasta de imagens (tipo imagens)', versoBranco: 'verso em branco (imagens)', paleta: 'paleta da capa', estilo: 'bloco | faixa | minimal | circulo', semente: 'semente para reproduzir o mesmo livro', saida: 'pasta de saída', capa: 'gera capa (padrão sim)' },
    async executar(args, { config }) {
      const r = gerarLivro({
        config, tipo: opcao(args, 'tipo', 'pautado'), titulo: opcao(args, 'titulo'), subtitulo: opcao(args, 'subtitulo', ''), autor: opcao(args, 'autor'), trim: opcao(args, 'trim'), papel: opcao(args, 'papel'),
        paginas: opcao(args, 'paginas', 0, 'inteiro') || undefined, sangria: flag(args, 'sangria', false), tema: opcao(args, 'tema'), palavras: args.palavras ? lista(opcao(args, 'palavras')) : undefined,
        quantidade: opcao(args, 'quantidade', 0, 'inteiro') || undefined, dificuldade: opcao(args, 'dificuldade'), porPagina: opcao(args, 'porPagina', 0, 'inteiro') || undefined, inicio: opcao(args, 'inicio'), meses: opcao(args, 'meses', 0, 'inteiro') || undefined,
        manuscrito: opcao(args, 'manuscrito'), pasta: opcao(args, 'pasta'), versoBranco: flag(args, 'versoBranco', false), paleta: opcao(args, 'paleta'), estilo: opcao(args, 'estilo'), semente: opcao(args, 'semente'), saida: opcao(args, 'saida'), capa: flag(args, 'capa', true),
        tamanho: opcao(args, 'tamanho', 0, 'inteiro') || undefined, porPuzzle: opcao(args, 'porPuzzle', 0, 'inteiro') || undefined, espacamento: opcao(args, 'espacamento', 0, 'numero') || undefined, habitos: opcao(args, 'habitos', 0, 'inteiro') || undefined, publico: opcao(args, 'publico'),
      });
      for (const a of r.avisos) log.aviso(a);
      log.info(`Interior: ${r.arquivos.interior} (${formatarNumero(r.tamanhoPdf / 1024)} KB, fonte ${r.fontes.embutida ? 'embutida' : 'NÃO embutida'})`);
      if (r.capa) log.info(`Capa: ${r.arquivos.capaSvg} · ${r.capa.larguraPol}" × ${r.capa.alturaPol}" · lombada ${r.capa.lombadaPol}"${r.capa.textoNaLombada ? '' : ' (sem texto na lombada: menos de 79 páginas)'} · PDF da capa: precozen design render --arquivo ${r.arquivos.capaHtml} --pdf`);
      log.info(`Metadados: ${r.arquivos.metadados}`);
      return { resumo: `"${r.titulo}" · ${r.paginas} páginas · ${r.trim} · ${r.papel} · pasta ${r.pasta}` };
    },
  },
  tipos: {
    descricao: 'Lista os tipos de livro disponíveis e suas opções',
    async executar() {
      for (const [id, m] of Object.entries(INTERIORES)) {
        log.titulo(`${id} — ${m.nome}`);
        log.info(`  ${m.descricao}`);
        for (const [k, v] of Object.entries(m.opcoes || {})) log.info(`    --${k.padEnd(14)} ${v}`);
      }
      return { resumo: `${Object.keys(INTERIORES).length} tipos` };
    },
  },
  trims: {
    descricao: 'Lista os tamanhos de corte aceitos pela KDP',
    async executar() {
      tabela(listarTrims(), [{ chave: 'id', rotulo: 'Trim' }, { chave: 'polegadas', rotulo: 'Polegadas' }, { chave: 'mm', rotulo: 'Milímetros' }]);
      return { resumo: `${listarTrims().length} tamanhos` };
    },
  },
  preco: {
    descricao: 'Calcula custo de impressão, royalty e preços sugeridos (paperback) ou royalty de eBook',
    opcoes: { paginas: 'páginas do paperback', preco: 'preço de lista', tinta: 'pb | cor-padrao | cor-premium', marketplace: 'amazon.com | amazon.co.uk | amazon.de (paperback) / + amazon.com.br (ebook)', ebook: 'calcula eBook em vez de paperback', mb: 'tamanho do eBook em MB', papel: 'branco | creme (para a lombada)' },
    async executar(args) {
      const marketplace = opcao(args, 'marketplace', 'amazon.com');
      if (flag(args, 'ebook', false)) {
        const preco = opcao(args, 'preco', 9.99, 'numero');
        const r = royaltyEbook({ preco, tamanhoMb: opcao(args, 'mb', 1, 'numero'), marketplace });
        log.info(`eBook ${formatarMoeda(preco, r.moeda)} em ${marketplace}: opção ${r.opcao}% · entrega ${formatarMoeda(r.entrega, r.moeda)} · royalty ${formatarMoeda(r.royalty, r.moeda)} por venda${r.dentroFaixa70 ? '' : ` (fora da faixa de 70%: ${r.faixa70.join('–')})`}`);
        return { resumo: `royalty ${formatarMoeda(r.royalty, r.moeda)}` };
      }
      const paginas = opcao(args, 'paginas', 120, 'inteiro');
      const tinta = opcao(args, 'tinta', 'pb');
      const preco = opcao(args, 'preco', 0, 'numero');
      const sugestoes = sugerirPrecos({ paginas, tinta, marketplace });
      log.titulo(`Paperback · ${paginas} páginas · ${tinta} · ${marketplace} (tabela ${TABELAS.verificadoEm})`);
      if (preco) { const r = royaltyPaperback({ precoLista: preco, paginas, tinta, marketplace }); log.info(`Preço ${formatarMoeda(preco, r.moeda)}: custo de impressão ${formatarMoeda(r.custo, r.moeda)} · royalty ${formatarMoeda(r.royalty, r.moeda)} (${formatarNumero(r.margem * 100)}%) · preço mínimo ${formatarMoeda(r.precoMinimo, r.moeda)}${r.viavel ? '' : ' · INVIÁVEL'}`); }
      tabela(sugestoes, [{ chave: (s) => formatarMoeda(s.meta, s.moeda), rotulo: 'Meta de royalty' }, { chave: (s) => formatarMoeda(s.preco, s.moeda), rotulo: 'Preço de lista', alinhar: 'direita' }, { chave: (s) => formatarMoeda(s.royalty, s.moeda), rotulo: 'Royalty real', alinhar: 'direita' }]);
      log.info(`Lombada: ${larguraLombada(paginas, opcao(args, 'papel', 'branco'))}" · ${TABELAS.observacao}`);
      const custo = custoImpressao({ paginas, tinta, marketplace });
      return { resumo: `custo de impressão ${formatarMoeda(custo.custo, custo.moeda)} por exemplar` };
    },
  },
  metadados: {
    descricao: 'Gera e valida título, subtítulo, descrição, 7 palavras-chave e categorias (template ou --ia)',
    opcoes: { tipo: 'tipo de livro', tema: 'tema/assunto', titulo: 'título', subtitulo: 'subtítulo', autor: 'autor', paginas: 'páginas', trim: 'trim', publico: 'público-alvo', ia: 'gera com Claude', saida: 'arquivo JSON de saída' },
    async executar(args, { config }) {
      const base = { tipo: opcao(args, 'tipo', 'pautado'), tema: opcao(args, 'tema', ''), titulo: opcao(args, 'titulo'), subtitulo: opcao(args, 'subtitulo'), autor: opcao(args, 'autor', config.kdp?.autor), paginas: opcao(args, 'paginas', 0, 'inteiro') || undefined, trim: opcao(args, 'trim', config.kdp?.trimPadrao), publico: opcao(args, 'publico'), idioma: config.kdp?.idioma || 'pt-BR' };
      let meta = gerarMetadadosTemplate(base);
      if (flag(args, 'ia', false)) {
        const { gerar } = await import('../ia/cliente.js');
        const { SISTEMA_EDITOR, ESQUEMA_METADADOS_KDP, promptMetadadosKdp } = await import('../ia/prompts.js');
        const r = await gerar({ sistema: SISTEMA_EDITOR, usuario: promptMetadadosKdp({ ...base, marketplace: config.kdp?.marketplacePadrao }), esquema: ESQUEMA_METADADOS_KDP, config });
        meta = { ...meta, ...r.json, autor: base.autor, gerador: `ia:${r.modelo}` };
      }
      const v = validarMetadados(meta);
      for (const e of v.erros) log.erro(e);
      for (const a of v.avisos) log.aviso(a);
      const saida = opcao(args, 'saida') || workspace('kdp', `metadados-${nomeSeguro(meta.slug || 'livro')}.json`);
      gravarJson(saida, { ...meta, validacao: v });
      log.info(`Título: ${meta.titulo}\nSubtítulo: ${meta.subtitulo}\nPalavras-chave: ${meta.palavrasChave.join(' | ')}\nCategorias: ${meta.categorias.join(' | ')}`);
      return { resumo: `metadados ${v.valido ? 'válidos' : 'com erros'} em ${saida}` };
    },
  },
  nicho: {
    descricao: 'Pontua nichos/palavras-chave (CSV com termo, buscas_mes, resultados, preco_medio, bsr_medio_top)',
    opcoes: { arquivo: 'CSV/JSON (padrão: data/nichos-exemplo.csv)' },
    async executar(args) {
      const arquivo = opcao(args, 'arquivo', path.join(RAIZ_CENTRAL, 'data', 'nichos-exemplo.csv'));
      const lista = analisarNichosDeArquivo(arquivo);
      tabela(lista, [{ chave: 'posicao', rotulo: '#', alinhar: 'direita' }, { chave: 'termo', rotulo: 'Termo' }, { chave: (n) => formatarNumero(n.buscasMes), rotulo: 'Buscas/mês', alinhar: 'direita' }, { chave: (n) => formatarNumero(n.resultados), rotulo: 'Resultados', alinhar: 'direita' }, { chave: (n) => (n.precoMedio ? formatarMoeda(n.precoMedio, 'USD') : '—'), rotulo: 'Preço médio', alinhar: 'direita' }, { chave: 'score', rotulo: 'Score', alinhar: 'direita' }, { chave: 'classe', rotulo: 'Classe' }]);
      const saida = gravarJson(workspace('kdp', 'nichos.json'), { geradoEm: new Date().toISOString().slice(0, 10), nichos: lista });
      return { resumo: `${lista.length} nichos pontuados · ${saida}` };
    },
  },
  manuscrito: {
    descricao: 'Escreve um manuscrito de não ficção com IA (Claude) e salva em Markdown + JSON para o tipo "texto"',
    opcoes: { tema: 'tema do livro', publico: 'público-alvo', capitulos: 'quantidade (padrão 8)', palavras: 'palavras por capítulo (padrão 1200)', tom: 'tom do texto', instrucoes: 'instruções extras', saida: 'pasta de saída' },
    async executar(args, { config }) {
      const tema = opcao(args, 'tema');
      if (!tema) throw new Error('informe --tema');
      const { gerar } = await import('../ia/cliente.js');
      const { SISTEMA_EDITOR, ESQUEMA_MANUSCRITO, promptManuscrito } = await import('../ia/prompts.js');
      const { manuscritoDeJson } = await import('./interiores/texto.js');
      const capitulos = opcao(args, 'capitulos', 8, 'inteiro');
      const palavrasPorCapitulo = opcao(args, 'palavras', 1200, 'inteiro');
      log.passo(`escrevendo ${capitulos} capítulos de ~${palavrasPorCapitulo} palavras (pode levar alguns minutos)…`);
      const r = await gerar({ sistema: SISTEMA_EDITOR, usuario: promptManuscrito({ tema, publico: opcao(args, 'publico'), capitulos, palavrasPorCapitulo, tom: opcao(args, 'tom', 'prático e acessível'), instrucoes: opcao(args, 'instrucoes', ''), idioma: config.kdp?.idioma || 'pt-BR' }), esquema: ESQUEMA_MANUSCRITO, config, maxTokens: Math.min(128000, 4000 + capitulos * palavrasPorCapitulo * 2) });
      const dir = opcao(args, 'saida') || workspace('kdp', 'manuscritos');
      const base = nomeSeguro(tema.toLowerCase().replace(/\s+/g, '-').slice(0, 50));
      const json = gravarJson(path.join(dir, `${base}.json`), r.json);
      const md = gravarTexto(path.join(dir, `${base}.md`), manuscritoDeJson(r.json));
      log.info(`Manuscrito: ${md}\nJSON: ${json}\nGere o livro: precozen kdp livro --tipo texto --manuscrito ${md} --titulo "${r.json.titulo}"`);
      return { resumo: `${r.json.capitulos.length} capítulos · modelo ${r.modelo} · ${r.uso?.output_tokens ?? '?'} tokens de saída` };
    },
  },
};
