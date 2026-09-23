// Montagem de um livro KDP: páginas iniciais + interior escolhido + paridade/mínimo de páginas + manifesto, metadados e capa.
import path from 'node:path';
import { workspace, gravarBinario, gravarJson, gravarTexto, nomeSeguro } from '../core/arquivos.js';
import { slug, dataIso } from '../core/util.js';
import { log } from '../core/log.js';
import { DocumentoPdf } from './pdf.js';
import { localizarFonte } from './fonte-ttf.js';
import { paginaInterior, validarPaginas, larguraLombada, dimensoesCapa, papel as obterPapel } from './especificacoes.js';
import { gerarMetadadosTemplate, validarMetadados } from './metadados.js';
import { areaUtil } from './interiores/comum.js';
import * as pautado from './interiores/pautado.js';
import * as pontilhado from './interiores/pontilhado.js';
import * as quadriculado from './interiores/quadriculado.js';
import * as planner from './interiores/planner.js';
import * as habitos from './interiores/habitos.js';
import * as cacaPalavras from './interiores/caca-palavras.js';
import * as sudoku from './interiores/sudoku.js';
import * as labirinto from './interiores/labirinto.js';
import * as texto from './interiores/texto.js';
import * as imagens from './interiores/imagens.js';
import { gerarCapa } from '../design/capa.js';

export const INTERIORES = { pautado, pontilhado, quadriculado, planner, habitos, 'caca-palavras': cacaPalavras, sudoku, labirinto, texto, imagens };

export function interior(tipo) {
  const i = INTERIORES[tipo];
  if (!i) throw new Error(`tipo de livro desconhecido: ${tipo} (opções: ${Object.keys(INTERIORES).join(', ')})`);
  return i;
}

/** Registra as fontes do documento: configuradas em precozen.config.json (kdp.fonte) ou detectadas no sistema. */
export function registrarFontes(doc, config, { familia = 'sans' } = {}) {
  const cfg = config?.kdp || {};
  const f = localizarFonte(familia, { regular: cfg.fonte, negrito: cfg.fonteNegrito });
  if (f) {
    doc.registrarFonte('regular', f.regular).registrarFonte('negrito', f.negrito);
    return { embutida: true, ...f };
  }
  log.aviso('nenhuma fonte TrueType encontrada: usando Helvetica sem embutir (a KDP exige fontes embutidas — configure kdp.fonte com o caminho de um .ttf)');
  doc.registrarFonte('regular', 'Helvetica').registrarFonte('negrito', 'Helvetica-Bold');
  return { embutida: false };
}

function paginasIniciais(doc, spec, { titulo, subtitulo, autor, ano, comoUsar }) {
  // 1: folha de rosto
  let n = 1;
  const pg = doc.novaPagina();
  const a = areaUtil(spec, n);
  const tam = Math.min(30, a.largura / Math.max(8, titulo.length) * 1.9 + 8);
  const linhas = doc.quebrar(titulo, 'negrito', tam, a.largura);
  linhas.forEach((l, i) => pg.texto(l, a.x + a.largura / 2, a.y + a.altura * 0.38 + i * tam * 1.15, { fonte: 'negrito', tamanho: tam, alinhamento: 'centro' }));
  if (subtitulo) pg.paragrafo(subtitulo, a.x, a.y + a.altura * 0.38 + linhas.length * tam * 1.15 + 6, a.largura, { tamanho: 12, alinhamento: 'centro', cor: '#444' });
  if (autor) pg.texto(autor, a.x + a.largura / 2, a.y + a.altura * 0.85, { tamanho: 13, alinhamento: 'centro' });
  pg.linha(a.x + a.largura * 0.3, a.y + a.altura * 0.3, a.x + a.largura * 0.7, a.y + a.altura * 0.3, { espessura: 1, cor: '#999' });
  // 2: créditos / pertence a
  n++;
  const pg2 = doc.novaPagina();
  const a2 = areaUtil(spec, n);
  pg2.paragrafo(`© ${ano} ${autor || ''}. Todos os direitos reservados.\nNenhuma parte deste livro pode ser reproduzida sem autorização, exceto trechos curtos para resenhas.`, a2.x, a2.base - 60, a2.largura, { tamanho: 8.5, cor: '#555', entrelinha: 1.35 });
  pg2.texto('Este livro pertence a:', a2.x, a2.y + a2.altura * 0.35, { fonte: 'negrito', tamanho: 12 });
  pg2.linha(a2.x, a2.y + a2.altura * 0.35 + 24, a2.direita, a2.y + a2.altura * 0.35 + 24, { espessura: 0.6, cor: '#777' });
  if (comoUsar) {
    n++;
    const pg3 = doc.novaPagina();
    const a3 = areaUtil(spec, n);
    pg3.texto('Como usar este livro', a3.x, a3.y + 20, { fonte: 'negrito', tamanho: 16 });
    pg3.paragrafo(comoUsar, a3.x, a3.y + 40, a3.largura, { tamanho: 11, entrelinha: 1.5 });
    n++;
    doc.novaPagina(); // verso em branco para o interior começar em página ímpar
  }
  return n;
}

const COMO_USAR = {
  'caca-palavras': 'Cada página traz uma grade e a lista de palavras escondidas. As palavras podem aparecer na horizontal, vertical e diagonal, em qualquer sentido. Acentos e espaços foram removidos das palavras na grade. As soluções ficam no final do livro.',
  sudoku: 'Preencha cada linha, cada coluna e cada bloco 3×3 com os números de 1 a 9, sem repetir. Todos os jogos têm solução única e os níveis vão do fácil ao especialista. As soluções ficam no final do livro.',
  labirinto: 'Entre pela seta no canto superior esquerdo e encontre a saída no canto inferior direito. Os labirintos ficam maiores e mais difíceis ao longo do livro. As soluções ficam no final.',
  planner: 'Comece pelas metas do período. Cada mês tem um calendário com os feriados nacionais e espaço para prioridades; as páginas semanais trazem um bloco por dia e uma área de notas.',
  habitos: 'Escreva até 12 hábitos na coluna da esquerda e marque cada dia em que cumpriu. No fim do mês, use a área de reflexão para registrar o que funcionou.',
};

/**
 * Gera o livro. opcoes: { tipo, titulo, subtitulo, autor, trim, papel, sangria, paginas (alvo), semente, saida, capa, paleta, estilo, ...opções do interior }
 */
export function gerarLivro({ config, tipo = 'pautado', titulo, subtitulo = '', autor, trim, papel, sangria = false, paginas, semente, saida, capa = true, paleta, estilo, tema, comoUsar = true, metadados, ...resto } = {}) {
  const inicio = Date.now();
  const cfg = config?.kdp || {};
  const mod = interior(tipo);
  const trimId = trim || cfg.trimPadrao || '6x9';
  const papelId = papel || cfg.papelPadrao || 'branco';
  const tinta = obterPapel(papelId).tinta;
  const autorFinal = autor || cfg.autor || '';
  const tituloFinal = titulo || (tema ? `${mod.nome}: ${tema}` : mod.nome);
  const ano = new Date().getUTCFullYear();
  const alvo = paginas || (['pautado', 'pontilhado', 'quadriculado'].includes(tipo) ? 120 : null);
  const doc = new DocumentoPdf({ titulo: tituloFinal, autor: autorFinal, assunto: subtitulo, palavrasChave: `${mod.nome}, ${tema || ''}`.trim() });
  const fontes = registrarFontes(doc, config, { familia: tipo === 'texto' ? 'serif' : 'sans' });
  const spec = paginaInterior(trimId, { sangria, paginas: alvo || 200 });
  doc.larguraPadrao = spec.largura; doc.alturaPadrao = spec.altura;
  const iniciais = paginasIniciais(doc, spec, { titulo: tituloFinal, subtitulo, autor: autorFinal, ano, comoUsar: comoUsar ? COMO_USAR[tipo] : null });
  const opcoesInterior = { ...resto, semente: semente || slug(tituloFinal), tema, titulo: tipo === 'texto' ? tituloFinal : mod.nome };
  if (alvo && ['pautado', 'pontilhado', 'quadriculado'].includes(tipo)) opcoesInterior.paginas = Math.max(1, alvo - iniciais);
  if (alvo && ['caca-palavras', 'sudoku', 'labirinto'].includes(tipo) && !resto.quantidade) {
    // estima a quantidade para bater a meta de páginas: puzzles 1/pág (ou 2) + soluções 4-6/pág
    const porPagina = Number(resto.porPagina) || 1;
    const solPorPagina = tipo === 'caca-palavras' ? 4 : 6;
    opcoesInterior.quantidade = Math.max(4, Math.floor(((alvo - iniciais) * porPagina * solPorPagina) / (solPorPagina + porPagina)));
  }
  const resultado = mod.gerar(doc, spec, opcoesInterior);
  // Paridade e mínimo
  while (doc.totalPaginas < 24 || doc.totalPaginas % 2 !== 0) doc.novaPagina();
  const total = doc.totalPaginas;
  const errosPaginas = validarPaginas(total, tinta);
  const pdf = doc.gerar();
  const dir = saida ? path.resolve(saida) : workspace('kdp', nomeSeguro(slug(tituloFinal, 60)));
  const arquivos = { interior: gravarBinario(path.join(dir, 'interior.pdf'), pdf) };
  const meta = { ...gerarMetadadosTemplate({ tipo, tema, titulo: tituloFinal, subtitulo, autor: autorFinal, paginas: total, trim: trimId, quantidade: resultado.puzzles || resultado.labirintos, idioma: cfg.idioma || 'pt-BR', publico: resto.publico }), ...(metadados || {}) };
  const validacao = validarMetadados(meta);
  arquivos.metadados = gravarJson(path.join(dir, 'metadados.json'), { ...meta, validacao });
  const dimsCapa = dimensoesCapa(trimId, total, papelId);
  let capaInfo = null;
  if (capa) {
    const c = gerarCapa({ trim: trimId, paginas: total, papel: papelId, titulo: tituloFinal, subtitulo, autor: autorFinal, textoContracapa: meta.textoContracapa || meta.descricaoHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600), paleta: paleta || config?.design?.paletaPadrao || 'noite', estilo: estilo || 'bloco', fontes: fontes.embutida ? [{ caminho: fontes.regular, familia: 'FonteCapa' }] : [] });
    arquivos.capaSvg = gravarTexto(path.join(dir, 'capa.svg'), c.svg);
    arquivos.capaHtml = gravarTexto(path.join(dir, 'capa.html'), c.html);
    capaInfo = { larguraPol: c.dims.larguraPol, alturaPol: c.dims.alturaPol, lombadaPol: c.dims.lombadaPol, px300: c.dims.px300, textoNaLombada: c.dims.textoNaLombada };
  }
  const manifesto = {
    geradoEm: dataIso(), tipo, titulo: tituloFinal, subtitulo, autor: autorFinal, trim: trimId, papel: papelId, tinta, sangria, paginas: total, paginasIniciais: iniciais,
    lombadaPol: larguraLombada(total, papelId), capa: capaInfo, fontes: { embutida: fontes.embutida, regular: fontes.regular || 'Helvetica', negrito: fontes.negrito || 'Helvetica-Bold' },
    interior: resultado, avisos: [...errosPaginas, ...validacao.avisos], tamanhoPdf: pdf.length, pasta: dir, arquivos, ms: Date.now() - inicio,
  };
  arquivos.manifesto = gravarJson(path.join(dir, 'manifesto.json'), manifesto);
  return manifesto;
}
