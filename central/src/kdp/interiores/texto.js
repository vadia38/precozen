// Livro de texto: diagrama um manuscrito Markdown (ou JSON gerado pela IA) em capítulos, com sumário, cabeçalho e numeração.
import fs from 'node:fs';
import { areaUtil, numeroPagina, cabecalho } from './comum.js';

export const id = 'texto';
export const nome = 'Livro de texto';
export const descricao = 'Diagrama um manuscrito em Markdown (# capítulo, ## seção, parágrafos, listas) com sumário e cabeçalhos';
export const opcoes = { manuscrito: 'arquivo .md ou .json (manuscrito da IA)', tamanhoFonte: 'pt (padrão 11)', entrelinha: 'padrão 1.45' };

/** Converte Markdown simples em blocos: {tipo: 'capitulo'|'secao'|'paragrafo'|'item'|'citacao', texto} */
export function analisarManuscrito(md) {
  const blocos = [];
  let par = [];
  const fechar = () => { if (par.length) { blocos.push({ tipo: 'paragrafo', texto: par.join(' ') }); par = []; } };
  for (const linhaBruta of String(md).replace(/\r\n?/g, '\n').split('\n')) {
    const l = linhaBruta.trimEnd();
    if (!l.trim()) { fechar(); continue; }
    let m;
    if ((m = l.match(/^#\s+(.+)/))) { fechar(); blocos.push({ tipo: 'capitulo', texto: m[1].trim() }); }
    else if ((m = l.match(/^#{2,3}\s+(.+)/))) { fechar(); blocos.push({ tipo: 'secao', texto: m[1].trim() }); }
    else if ((m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)/))) { fechar(); blocos.push({ tipo: 'item', texto: m[1].trim() }); }
    else if ((m = l.match(/^>\s?(.+)/))) { fechar(); blocos.push({ tipo: 'citacao', texto: m[1].trim() }); }
    else par.push(l.trim());
  }
  fechar();
  return blocos.map((b) => ({ ...b, texto: b.texto.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*]+)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') }));
}

export function manuscritoDeJson(json) {
  const partes = [];
  if (json.introducao) partes.push('# Introdução', '', json.introducao, '');
  for (const c of json.capitulos || []) partes.push(`# ${c.titulo}`, '', c.texto, '');
  if (json.conclusao) partes.push('# Conclusão', '', json.conclusao, '');
  return partes.join('\n');
}

export function carregarManuscrito(caminho) {
  if (!caminho || !fs.existsSync(caminho)) throw new Error(`manuscrito não encontrado: ${caminho}`);
  const txt = fs.readFileSync(caminho, 'utf8');
  if (/\.json$/i.test(caminho)) return manuscritoDeJson(JSON.parse(txt));
  return txt;
}

export function gerar(doc, spec, { manuscrito, texto, tamanhoFonte = 11, entrelinha = 1.45, titulo = '', sumario = true, numerar = true } = {}) {
  const md = texto ?? carregarManuscrito(manuscrito);
  const blocos = analisarManuscrito(md);
  if (!blocos.length) throw new Error('manuscrito vazio');
  const passo = tamanhoFonte * entrelinha;
  const a1 = areaUtil(spec, 1);
  const larguraTexto = a1.largura;
  // 1) Quebra tudo em linhas com tipo e tamanho
  const linhas = []; // { texto, fonte, tamanho, espacoAntes, recuo, quebraPagina, capitulo }
  let cap = 0;
  for (const b of blocos) {
    if (b.tipo === 'capitulo') {
      cap++;
      const ls = doc.quebrar(b.texto, 'negrito', tamanhoFonte * 2, larguraTexto);
      ls.forEach((t, i) => linhas.push({ texto: t, fonte: 'negrito', tamanho: tamanhoFonte * 2, espacoAntes: i === 0 ? passo * 4 : 0, quebraPagina: i === 0, capitulo: i === 0 ? { numero: cap, titulo: b.texto } : null, passo: tamanhoFonte * 2 * 1.2 }));
      linhas.push({ texto: '', passo: passo * 1.5 });
    } else if (b.tipo === 'secao') {
      const ls = doc.quebrar(b.texto, 'negrito', tamanhoFonte * 1.3, larguraTexto);
      ls.forEach((t, i) => linhas.push({ texto: t, fonte: 'negrito', tamanho: tamanhoFonte * 1.3, espacoAntes: i === 0 ? passo * 1.2 : 0, passo: tamanhoFonte * 1.3 * 1.25, manterComProximo: true }));
      linhas.push({ texto: '', passo: passo * 0.4 });
    } else if (b.tipo === 'item') {
      const ls = doc.quebrar(b.texto, 'regular', tamanhoFonte, larguraTexto - 16);
      ls.forEach((t, i) => linhas.push({ texto: t, fonte: 'regular', tamanho: tamanhoFonte, recuo: 16, marcador: i === 0, passo }));
      linhas.push({ texto: '', passo: passo * 0.3 });
    } else if (b.tipo === 'citacao') {
      const ls = doc.quebrar(b.texto, 'regular', tamanhoFonte, larguraTexto - 40);
      ls.forEach((t) => linhas.push({ texto: t, fonte: 'regular', tamanho: tamanhoFonte, recuo: 20, citacao: true, passo }));
      linhas.push({ texto: '', passo: passo * 0.8 });
    } else {
      const ls = doc.quebrar(b.texto, 'regular', tamanhoFonte, larguraTexto);
      ls.forEach((t) => linhas.push({ texto: t, fonte: 'regular', tamanho: tamanhoFonte, passo }));
      linhas.push({ texto: '', passo: passo * 0.7 });
    }
  }
  // 2) Pagina
  const paginas = [];
  let atual = { linhas: [], y: 0 };
  const alturaUtil = a1.altura;
  const novaPagina = () => { atual = { linhas: [], y: 0 }; paginas.push(atual); };
  novaPagina();
  const capitulos = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.quebraPagina && atual.linhas.length) { novaPagina(); }
    if (l.capitulo) { if (paginas.length % 2 === 0) { novaPagina(); } capitulos.push({ ...l.capitulo, pagina: paginas.length }); }
    const espaco = atual.linhas.length ? (l.espacoAntes || 0) : 0;
    const altura = espaco + l.passo;
    // viúvas: se for título de seção e não couber mais duas linhas, quebra
    const precisa = l.manterComProximo ? altura + 2 * passo : altura;
    if (atual.y + precisa > alturaUtil && atual.linhas.length) { novaPagina(); }
    atual.linhas.push({ ...l, y: atual.y + (atual.linhas.length ? espaco : 0) + l.passo * 0.8 });
    atual.y += (atual.linhas.length > 1 ? espaco : 0) + l.passo;
  }
  // 3) Sumário (reserva páginas no início; capítulos deslocam)
  const linhasSumario = sumario ? capitulos.length + 2 : 0;
  const paginasSumario = sumario ? Math.max(1, Math.ceil(linhasSumario / Math.floor(alturaUtil / (passo * 1.3)))) : 0;
  const deslocamento = paginasSumario % 2 === 0 ? paginasSumario : paginasSumario + 1; // capítulos começam em página ímpar
  let n = 0;
  if (sumario) {
    for (let s = 0; s < deslocamento; s++) {
      n++;
      const pg = doc.novaPagina();
      const a = areaUtil(spec, n);
      if (s === 0) {
        pg.texto('Sumário', a.x, a.y + tamanhoFonte * 2, { fonte: 'negrito', tamanho: tamanhoFonte * 1.8 });
        let y = a.y + tamanhoFonte * 2 + passo * 2;
        for (const c of capitulos) {
          if (y > a.base) break;
          const num = String(c.pagina + deslocamento);
          pg.texto(c.titulo, a.x, y, { tamanho: tamanhoFonte });
          pg.texto(num, a.direita, y, { tamanho: tamanhoFonte, alinhamento: 'direita' });
          const wT = doc.medir(c.titulo, 'regular', tamanhoFonte); const wN = doc.medir(num, 'regular', tamanhoFonte);
          if (a.direita - wN - 6 > a.x + wT + 6) pg.linha(a.x + wT + 6, y - 1, a.direita - wN - 6, y - 1, { espessura: 0.3, cor: '#999', tracejado: [1, 2] });
          y += passo * 1.3;
        }
      }
    }
  }
  for (const p of paginas) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const temCapitulo = p.linhas.some((l) => l.capitulo);
    const vazia = !p.linhas.some((l) => l.texto);
    if (vazia) continue; // página em branco (verso antes de capítulo): sem cabeçalho nem número
    if (!temCapitulo && titulo) cabecalho(pg, a, titulo);
    for (const l of p.linhas) {
      if (!l.texto) continue;
      const x = a.x + (l.recuo || 0);
      if (l.marcador) pg.circulo(a.x + 5, a.y + l.y - l.tamanho * 0.3, 1.6, { preenchimento: '#111' });
      if (l.citacao) pg.linha(a.x + 8, a.y + l.y - l.tamanho, a.x + 8, a.y + l.y + 3, { espessura: 1.2, cor: '#999' });
      pg.texto(l.texto, x, a.y + l.y, { fonte: l.fonte, tamanho: l.tamanho, cor: '#111' });
    }
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas: n, capitulos: capitulos.map((c) => ({ ...c, pagina: c.pagina + deslocamento })), palavras: blocos.reduce((s, b) => s + b.texto.split(/\s+/).length, 0) };
}
