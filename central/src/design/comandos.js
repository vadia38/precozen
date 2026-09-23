// Comandos do módulo design: camiseta, capa, listagem, ideias, conformidade, render, especificacoes, paletas.
import fs from 'node:fs';
import path from 'node:path';
import { opcao } from '../core/cli.js';
import { log, tabela } from '../core/log.js';
import { lista, slug, formatarNumero } from '../core/util.js';
import { workspace, gravarTexto, gravarJson, nomeSeguro } from '../core/arquivos.js';
import { gerarCamiseta, textosMerch, LAYOUTS } from './camiseta.js';
import { gerarCapa } from './capa.js';
import { gerarInfografico, gerarBannerAPlus, gerarImagemPrincipal, textosListagem } from './listagem.js';
import { verificarTexto, verificarListagemMerch, verificarListagemAmazon } from './conformidade.js';
import { svgParaPng, htmlParaPdf, detectarRenderizador, dimensoesPng } from './render.js';
import { MERCH, IMAGENS_AMAZON } from './especificacoes.js';
import { PALETAS } from './paletas.js';
import { localizarFonte } from '../kdp/fonte-ttf.js';

const flag = (args, nome, padrao) => (args[nome] === undefined ? padrao : args[nome] !== false && args[nome] !== 'nao' && args[nome] !== 'false');

function fontesConfig(config) {
  const cfg = config?.design || {};
  const lista = (cfg.fontes || []).filter((c) => fs.existsSync(c)).map((c) => ({ caminho: c, familia: 'FonteEstampa' }));
  if (lista.length) return lista;
  const f = localizarFonte('sans', { regular: config?.kdp?.fonte });
  return f ? [{ caminho: f.negrito, familia: 'FonteEstampa', peso: 'bold' }] : [];
}

function exportar({ svg, html }, pasta, nomeBase, { png, pdf, largura, altura, transparente, renderizador }) {
  const arquivos = { svg: gravarTexto(path.join(pasta, `${nomeBase}.svg`), svg) };
  if (html) arquivos.html = gravarTexto(path.join(pasta, `${nomeBase}.html`), html);
  if (png) {
    const r = svgParaPng(svg, path.join(pasta, `${nomeBase}.png`), { largura, altura, transparente, renderizador });
    arquivos.png = r.destino;
    const d = dimensoesPng(r.destino);
    log.info(`PNG ${d.largura}×${d.altura} (${d.colorType === 6 ? 'RGBA' : 'RGB'}) via ${r.renderizador}`);
  }
  if (pdf && html) { arquivos.pdf = htmlParaPdf(arquivos.html, path.join(pasta, `${nomeBase}.pdf`), { renderizador }).destino; log.info(`PDF: ${arquivos.pdf}`); }
  return arquivos;
}

export const comandos = {
  camiseta: {
    descricao: 'Cria uma estampa tipográfica (SVG + PNG transparente no tamanho Merch) e os textos da listagem',
    opcoes: { texto: 'frase principal (use | para quebrar linhas)', subtexto: 'linha secundária', layout: LAYOUTS.join(' | '), paleta: `paleta (${Object.keys(PALETAS).join(', ')})`, produto: Object.keys(MERCH).join(' | '), corCamisa: 'escura | clara', nicho: 'nicho para os textos da listagem', marca: 'marca da listagem', idioma: 'pt-BR | en-US', png: 'gera PNG (padrão sim)', saida: 'pasta de saída' },
    async executar(args, { config }) {
      const texto = opcao(args, 'texto');
      if (!texto) throw new Error('informe --texto "Frase da estampa"');
      const idioma = opcao(args, 'idioma', 'pt-BR');
      const r = gerarCamiseta({ texto, subtexto: opcao(args, 'subtexto', ''), layout: opcao(args, 'layout', 'empilhado'), paleta: opcao(args, 'paleta', config.design?.paletaPadrao || 'noite'), produto: opcao(args, 'produto', 'camiseta'), corCamisa: opcao(args, 'corCamisa', 'escura'), fontes: fontesConfig(config) });
      const textos = textosMerch({ texto, subtexto: opcao(args, 'subtexto', ''), nicho: opcao(args, 'nicho', ''), marca: opcao(args, 'marca', config.design?.marca || ''), idioma });
      const conf = verificarListagemMerch({ ...textos, estampa: texto });
      for (const a of r.avisos) log.aviso(a);
      for (const e of conf.erros) log.erro(e);
      for (const a of conf.avisos) log.aviso(a);
      const pasta = opcao(args, 'saida') || workspace('design', 'camisetas', nomeSeguro(slug(texto, 40)));
      const arquivos = exportar(r, pasta, 'estampa', { png: flag(args, 'png', true), largura: r.spec.largura, altura: r.spec.altura, transparente: true, renderizador: config.design?.renderizador || 'auto' });
      arquivos.listagem = gravarJson(path.join(pasta, 'listagem.json'), { ...textos, conformidade: conf, produto: r.spec, layout: r.layout, paleta: opcao(args, 'paleta', 'noite') });
      log.info(`Marca: ${textos.marca}\nTítulo: ${textos.titulo}\nBullets: ${textos.bullets.join(' | ')}`);
      return { resumo: `estampa ${r.spec.largura}×${r.spec.altura} em ${pasta}${conf.ok ? '' : ' · ATENÇÃO: conformidade com erros'}` };
    },
  },
  capa: {
    descricao: 'Cria a capa completa KDP (verso + lombada + frente) em SVG, HTML e opcionalmente PNG/PDF',
    opcoes: { trim: 'tamanho de corte (padrão 6x9)', paginas: 'páginas do interior', papel: 'branco | creme | cor-padrao | cor-premium', titulo: 'título', subtitulo: 'subtítulo', autor: 'autor', contracapa: 'texto da contracapa', paleta: 'paleta', estilo: 'bloco | faixa | minimal | circulo', selo: 'texto curto no selo', guias: 'desenha guias de sangria/lombada (não imprimir)', png: 'gera PNG', pdf: 'gera PDF (Chromium)', saida: 'pasta' },
    async executar(args, { config }) {
      const titulo = opcao(args, 'titulo', 'Título do livro');
      const r = gerarCapa({ trim: opcao(args, 'trim', config.kdp?.trimPadrao || '6x9'), paginas: opcao(args, 'paginas', 120, 'inteiro'), papel: opcao(args, 'papel', config.kdp?.papelPadrao || 'branco'), titulo, subtitulo: opcao(args, 'subtitulo', ''), autor: opcao(args, 'autor', config.kdp?.autor || ''), textoContracapa: opcao(args, 'contracapa', ''), paleta: opcao(args, 'paleta', config.design?.paletaPadrao || 'noite'), estilo: opcao(args, 'estilo', 'bloco'), selo: opcao(args, 'selo', ''), guias: flag(args, 'guias', false), fontes: fontesConfig(config) });
      const pasta = opcao(args, 'saida') || workspace('design', 'capas', nomeSeguro(slug(titulo, 40)));
      const arquivos = exportar(r, pasta, 'capa', { png: flag(args, 'png', false), pdf: flag(args, 'pdf', false), largura: r.dims.px300.largura, altura: r.dims.px300.altura, transparente: false, renderizador: config.design?.renderizador || 'auto' });
      log.info(`Capa ${r.dims.larguraPol}" × ${r.dims.alturaPol}" (${r.dims.px300.largura}×${r.dims.px300.altura} px a 300 dpi) · lombada ${r.dims.lombadaPol}"${r.dims.textoNaLombada ? '' : ' (sem texto: < 79 páginas)'}`);
      return { resumo: `capa em ${arquivos.svg}${arquivos.pdf ? ` e ${arquivos.pdf}` : ''}` };
    },
  },
  listagem: {
    descricao: 'Gera imagens de listagem (principal, infográfico 2000×2000, banner A+) e textos para um produto',
    opcoes: { nome: 'nome do produto', marca: 'marca', categoria: 'categoria', beneficios: 'lista separada por ; (até 5)', atributos: 'chave=valor; chave=valor', publico: 'público', imagem: 'foto do produto (PNG/JPG) para embutir', paleta: 'paleta', selo: 'selo curto', png: 'gera PNGs', ia: 'textos com Claude', saida: 'pasta' },
    async executar(args, { config }) {
      const nome = opcao(args, 'nome');
      if (!nome) throw new Error('informe --nome "Produto"');
      const beneficios = lista(opcao(args, 'beneficios', ''));
      const atributos = Object.fromEntries(lista(opcao(args, 'atributos', '')).map((par) => par.split('=').map((s) => s.trim())).filter((p) => p.length === 2));
      let textos = textosListagem({ nome, marca: opcao(args, 'marca', ''), categoria: opcao(args, 'categoria', ''), beneficios, atributos, publico: opcao(args, 'publico', '') });
      if (flag(args, 'ia', false)) {
        const { gerar } = await import('../ia/cliente.js');
        const { SISTEMA_EDITOR, ESQUEMA_LISTAGEM, promptListagem } = await import('../ia/prompts.js');
        const r = await gerar({ sistema: SISTEMA_EDITOR, usuario: promptListagem({ nome, marca: opcao(args, 'marca', ''), categoria: opcao(args, 'categoria', ''), beneficios, atributos, publico: opcao(args, 'publico', ''), idioma: 'pt-BR' }), esquema: ESQUEMA_LISTAGEM, config });
        textos = { ...r.json, gerador: `ia:${r.modelo}` };
      }
      const conf = verificarListagemAmazon(textos);
      for (const e of conf.erros) log.erro(e);
      for (const a of conf.avisos) log.aviso(a);
      const pasta = opcao(args, 'saida') || workspace('design', 'listagens', nomeSeguro(slug(nome, 40)));
      const fontes = fontesConfig(config);
      const paleta = opcao(args, 'paleta', 'papel');
      const imagem = opcao(args, 'imagem');
      const png = flag(args, 'png', false);
      const rend = config.design?.renderizador || 'auto';
      const principal = gerarImagemPrincipal({ imagem });
      const info = gerarInfografico({ titulo: nome, destaques: textos.chamadas?.length ? textos.chamadas : beneficios, imagem, paleta, selo: opcao(args, 'selo', ''), fontes });
      const banner = gerarBannerAPlus({ titulo: nome, texto: textos.descricao, paleta, imagem, fontes });
      const arquivos = {
        principal: exportar(principal, pasta, 'principal', { png, largura: 2000, altura: 2000, transparente: false, renderizador: rend }),
        infografico: exportar(info, pasta, 'infografico', { png, largura: 2000, altura: 2000, transparente: false, renderizador: rend }),
        banner: exportar(banner, pasta, 'banner-a-plus', { png, largura: 970, altura: 600, transparente: false, renderizador: rend }),
      };
      arquivos.textos = gravarJson(path.join(pasta, 'textos.json'), { ...textos, conformidade: conf });
      log.info(`Título: ${textos.titulo}\nBullets:\n - ${textos.bullets.join('\n - ')}`);
      return { resumo: `3 imagens + textos em ${pasta}` };
    },
  },
  ideias: {
    descricao: 'Gera ideias de estampas por nicho (template ou --ia) e salva em JSON para produzir depois',
    opcoes: { nicho: 'nicho (ex.: café, professores, corrida)', quantidade: 'quantas (padrão 10)', idioma: 'pt-BR | en-US', ia: 'usa Claude', produzir: 'gera as estampas (SVG/PNG) de cada ideia' },
    async executar(args, { config }) {
      const nicho = opcao(args, 'nicho');
      if (!nicho) throw new Error('informe --nicho');
      const quantidade = opcao(args, 'quantidade', 10, 'inteiro');
      const idioma = opcao(args, 'idioma', 'pt-BR');
      let ideias;
      if (flag(args, 'ia', false)) {
        const { gerar } = await import('../ia/cliente.js');
        const { SISTEMA_EDITOR, ESQUEMA_IDEIAS_CAMISETA, promptIdeiasCamiseta } = await import('../ia/prompts.js');
        const r = await gerar({ sistema: SISTEMA_EDITOR, usuario: promptIdeiasCamiseta({ nicho, quantidade, idioma }), esquema: ESQUEMA_IDEIAS_CAMISETA, config });
        ideias = r.json.ideias;
      } else {
        const en = idioma.startsWith('en');
        const moldes = en
          ? [['Powered by {n}', 'since forever', 'minimal'], ['{n} | mode | on', '', 'empilhado'], ['World’s okayest | {n} lover', '', 'empilhado'], ['Eat · Sleep | {n} · Repeat', '', 'empilhado'], ['{n} club', 'est. today', 'selo'], ['Keep calm | and {n}', '', 'empilhado'], ['{n} is my | cardio', '', 'empilhado'], ['Certified | {n} addict', '', 'selo'], ['{n}', 'therapy', 'arco'], ['Life is short | {n} more', '', 'empilhado']]
          : [['Movido a {n}', 'desde sempre', 'minimal'], ['Modo {n} | ativado', '', 'empilhado'], ['Amante de {n} | em tempo integral', '', 'empilhado'], ['Comer · Dormir | {n} · Repetir', '', 'empilhado'], ['Clube do {n}', 'fundado hoje', 'selo'], ['Mantenha a calma | e {n}', '', 'empilhado'], ['{n} é a minha | terapia', '', 'empilhado'], ['Viciado em | {n}', 'certificado', 'selo'], ['{n}', 'todo dia', 'arco'], ['A vida é curta | {n} mais', '', 'empilhado']];
        ideias = moldes.slice(0, quantidade).map(([t, s, l], i) => ({ texto: t.replace(/\{n\}/g, nicho), subtexto: s, estilo: l, paleta: Object.keys(PALETAS)[i % Object.keys(PALETAS).length], ...textosMerch({ texto: t.replace(/\{n\}/g, nicho), subtexto: s, nicho, idioma }) }));
      }
      const pasta = workspace('design', 'ideias');
      const arquivo = gravarJson(path.join(pasta, `${nomeSeguro(slug(nicho, 30))}.json`), { nicho, idioma, geradoEm: new Date().toISOString().slice(0, 10), ideias });
      tabela(ideias, [{ chave: (i) => i.texto.replace(/\s*\|\s*/g, ' / '), rotulo: 'Estampa' }, { chave: 'estilo', rotulo: 'Layout' }, { chave: 'paleta', rotulo: 'Paleta' }, { chave: (i) => (verificarTexto(`${i.texto} ${i.titulo}`).ok ? 'ok' : 'REVISAR'), rotulo: 'Conformidade' }]);
      let produzidas = 0;
      if (flag(args, 'produzir', false)) {
        for (const i of ideias) {
          const r = gerarCamiseta({ texto: i.texto, subtexto: i.subtexto, layout: LAYOUTS.includes(i.estilo) ? i.estilo : 'empilhado', paleta: PALETAS[i.paleta] ? i.paleta : 'noite', fontes: fontesConfig(config) });
          exportar(r, workspace('design', 'camisetas', nomeSeguro(slug(i.texto, 40))), 'estampa', { png: true, largura: r.spec.largura, altura: r.spec.altura, transparente: true, renderizador: config.design?.renderizador || 'auto' });
          produzidas++;
        }
      }
      return { resumo: `${ideias.length} ideias em ${arquivo}${produzidas ? ` · ${produzidas} estampas geradas` : ''}` };
    },
  },
  conformidade: {
    descricao: 'Verifica um texto (estampa, título, descrição) contra marcas registradas, termos proibidos e limites',
    opcoes: { texto: 'texto a verificar', titulo: 'título de listagem Merch', marca: 'marca', descricao: 'descrição' },
    async executar(args) {
      const r = args.titulo || args.marca ? verificarListagemMerch({ marca: opcao(args, 'marca', ''), titulo: opcao(args, 'titulo', ''), descricao: opcao(args, 'descricao', ''), estampa: opcao(args, 'texto', '') }) : verificarTexto(opcao(args, 'texto', ''));
      for (const e of r.erros) log.erro(e);
      for (const a of r.avisos) log.aviso(a);
      if (r.ok && !r.avisos.length) log.ok('nenhum problema encontrado (a lista é inicial: pesquise marcas no INPI/USPTO antes de publicar)');
      return { resumo: r.ok ? 'sem erros' : `${r.erros.length} erro(s)` };
    },
  },
  render: {
    descricao: 'Converte um SVG em PNG ou um HTML em PDF com o renderizador disponível',
    opcoes: { arquivo: 'arquivo .svg ou .html', png: 'gera PNG', pdf: 'gera PDF (só HTML, exige Chromium)', largura: 'largura em px', altura: 'altura em px', saida: 'arquivo de saída' },
    async executar(args, { config }) {
      const arquivo = opcao(args, 'arquivo');
      if (!arquivo || !fs.existsSync(arquivo)) throw new Error('informe --arquivo existente');
      const rend = config.design?.renderizador || 'auto';
      if (flag(args, 'pdf', false) || /\.html?$/i.test(arquivo)) {
        const r = htmlParaPdf(arquivo, opcao(args, 'saida') || arquivo.replace(/\.html?$/i, '.pdf'), { renderizador: rend });
        return { resumo: `PDF em ${r.destino}` };
      }
      const r = svgParaPng(arquivo, opcao(args, 'saida') || arquivo.replace(/\.svg$/i, '.png'), { largura: opcao(args, 'largura', 0, 'inteiro') || undefined, altura: opcao(args, 'altura', 0, 'inteiro') || undefined, transparente: flag(args, 'transparente', true), renderizador: rend });
      return { resumo: `PNG ${r.largura}×${r.altura} em ${r.destino} (${r.renderizador})` };
    },
  },
  especificacoes: {
    descricao: 'Mostra as especificações de arquivos Merch, imagens de listagem e o renderizador detectado',
    async executar() {
      log.titulo('Merch by Amazon');
      tabela(Object.entries(MERCH).map(([id, m]) => ({ id, ...m })), [{ chave: 'id', rotulo: 'Produto' }, { chave: 'nome', rotulo: 'Nome' }, { chave: (m) => `${m.largura}×${m.altura}`, rotulo: 'Pixels' }, { chave: 'polegadas', rotulo: 'Polegadas' }, { chave: 'formato', rotulo: 'Formato' }]);
      log.titulo('Imagens de listagem Amazon');
      tabela(Object.entries(IMAGENS_AMAZON).map(([id, m]) => ({ id, ...m })), [{ chave: 'id', rotulo: 'Tipo' }, { chave: 'nome', rotulo: 'Nome' }, { chave: (m) => `${m.largura}×${m.altura}`, rotulo: 'Pixels' }, { chave: (m) => m.observacao || '', rotulo: 'Observação' }]);
      const r = detectarRenderizador();
      log.info(`\nRenderizador: ${r ? `${r.tipo} (${r.bin})` : 'nenhum — instale Chromium/Chrome, rsvg-convert, ImageMagick ou Inkscape para gerar PNG/PDF'}`);
      return { resumo: `${Object.keys(MERCH).length} produtos Merch · ${Object.keys(IMAGENS_AMAZON).length} tipos de imagem` };
    },
  },
  paletas: {
    descricao: 'Lista as paletas de cores disponíveis',
    async executar() {
      tabela(Object.entries(PALETAS).map(([id, p]) => ({ id, ...p })), [{ chave: 'id', rotulo: 'Paleta' }, { chave: 'nome', rotulo: 'Nome' }, { chave: 'fundo', rotulo: 'Fundo' }, { chave: 'texto', rotulo: 'Texto' }, { chave: 'acento', rotulo: 'Acento' }, { chave: 'secundaria', rotulo: 'Secundária' }]);
      return { resumo: `${Object.keys(PALETAS).length} paletas` };
    },
  },
};
