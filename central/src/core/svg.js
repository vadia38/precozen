// Helpers para montar SVG: documento, texto com quebra, fontes embutidas e medidas aproximadas.
import fs from 'node:fs';
import path from 'node:path';
import { escapeXml, quebrarLinhas } from './util.js';

/** Largura aproximada de um texto (em px) para uma fonte sem métricas: média de 0,55 em por caractere. */
export function medirTexto(texto, tamanho, fator = 0.55) {
  let w = 0;
  for (const ch of String(texto ?? '')) {
    if (/[ilj.,'!|:;I]/.test(ch)) w += 0.3;
    else if (/[mwMW]/.test(ch)) w += 0.85;
    else if (/[A-Z0-9]/.test(ch)) w += 0.68;
    else if (ch === ' ') w += 0.3;
    else w += fator;
  }
  return w * tamanho;
}

/** Tamanho de fonte que faz `texto` caber em `larguraMax` (limitado a `max`). */
export function ajustarTamanho(texto, larguraMax, { max = 400, min = 12, fator } = {}) {
  const w = medirTexto(texto, 100, fator);
  if (!w) return max;
  return Math.max(min, Math.min(max, Math.floor((larguraMax / w) * 100)));
}

/** Quebra o texto em linhas que caibam em `larguraMax` no tamanho dado. */
export function quebrarParaLargura(texto, tamanho, larguraMax, fator) {
  const maxChars = Math.max(1, Math.floor(larguraMax / (tamanho * (fator || 0.55))));
  return quebrarLinhas(texto, maxChars);
}

export function atributos(obj = {}) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
}

/** <text> com várias linhas (tspan). */
export function textoSvg(linhas, { x, y, tamanho, alturaLinha = 1.15, ancora = 'middle', ...resto }) {
  const ls = [].concat(linhas);
  const passo = tamanho * alturaLinha;
  const inicio = y - ((ls.length - 1) * passo) / 2;
  const tspans = ls.map((l, i) => `<tspan x="${x}" y="${(inicio + i * passo).toFixed(2)}">${escapeXml(l)}</tspan>`).join('');
  return `<text${atributos({ 'font-size': tamanho, 'text-anchor': ancora, ...resto })}>${tspans}</text>`;
}

const MIME_FONTE = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

/** Regra @font-face com a fonte embutida em base64 (o SVG fica autossuficiente). */
export function fonteEmbutida(caminho, familia, { peso = 'normal', estilo = 'normal' } = {}) {
  const ext = path.extname(caminho).toLowerCase();
  const mime = MIME_FONTE[ext];
  if (!mime) throw new Error(`formato de fonte não suportado: ${ext}`);
  const b64 = fs.readFileSync(caminho).toString('base64');
  const formato = ext === '.ttf' ? 'truetype' : ext === '.otf' ? 'opentype' : ext.slice(1);
  return `@font-face{font-family:"${familia}";font-weight:${peso};font-style:${estilo};src:url(data:${mime};base64,${b64}) format("${formato}")}`;
}

/** Documento SVG completo. */
export function documentoSvg({ largura, altura, conteudo, fundo, css = '', titulo, desc, unidades = '' }) {
  const bg = fundo ? `<rect width="100%" height="100%" fill="${escapeXml(fundo)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${largura}${unidades}" height="${altura}${unidades}" viewBox="0 0 ${largura} ${altura}">
${titulo ? `<title>${escapeXml(titulo)}</title>` : ''}${desc ? `<desc>${escapeXml(desc)}</desc>` : ''}
${css ? `<defs><style>${css}</style></defs>` : ''}
${bg}
${conteudo}
</svg>
`;
}

/** Converte polegadas em pixels na resolução dada. */
export const polParaPx = (pol, dpi = 300) => Math.round(pol * dpi);
export const mmParaPol = (mm) => mm / 25.4;
export const polParaPt = (pol) => pol * 72;
