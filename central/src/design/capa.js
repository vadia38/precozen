// Capa completa para KDP (verso + lombada + frente) em SVG a 300 dpi, com zonas, guias opcionais e texto seguro.
import { dimensoesCapa } from '../kdp/especificacoes.js';
import { documentoSvg, textoSvg, quebrarParaLargura, ajustarTamanho, fonteEmbutida } from '../core/svg.js';
import { escapeXml } from '../core/util.js';
import { paleta as obterPaleta, textoLegivel, escurecer, clarear } from './paletas.js';

const DPI = 300;

/**
 * Gera a capa. opcoes: { trim, paginas, papel, titulo, subtitulo, autor, textoContracapa, paleta, estilo, guias, fontes: [{caminho, familia}], familia }
 * Devolve { svg, html, dims } — html é a versão pronta para imprimir em PDF no tamanho exato.
 */
export function gerarCapa({ trim = '6x9', paginas = 120, papel = 'branco', titulo = 'Título', subtitulo = '', autor = '', textoContracapa = '', paleta = 'noite', estilo = 'bloco', guias = false, fontes = [], familia = 'DejaVu Sans, Arial, Helvetica, sans-serif', selo = '' } = {}) {
  const d = dimensoesCapa(trim, paginas, papel);
  const p = obterPaleta(paleta);
  const W = d.px300.largura; const H = d.px300.altura;
  const px = (pol) => pol * DPI;
  const sang = px(d.sangria);
  const verso = { x: px(d.zonas.verso.x), w: px(d.zonas.verso.largura) };
  const lomb = { x: px(d.zonas.lombada.x), w: px(d.zonas.lombada.largura) };
  const frente = { x: px(d.zonas.frente.x), w: px(d.zonas.frente.largura) };
  const seg = px(d.margemSegura);
  const textoCor = textoLegivel(p.fundo);
  const css = fontes.map((f) => fonteEmbutida(f.caminho, f.familia || 'FonteCapa', { peso: f.peso })).join('\n');
  const fam = fontes.length ? `${fontes[0].familia || 'FonteCapa'}, ${familia}` : familia;
  const partes = [];
  // Fundo e decoração por estilo
  partes.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${p.fundo}"/>`);
  if (estilo === 'bloco') {
    partes.push(`<rect x="${frente.x + seg}" y="${sang + seg}" width="${frente.w - 2 * seg}" height="${H * 0.52}" rx="${px(0.12)}" fill="${p.secundaria}"/>`);
    partes.push(`<rect x="${frente.x + seg}" y="${H - sang - seg - px(0.35)}" width="${frente.w - 2 * seg}" height="${px(0.12)}" fill="${p.acento}"/>`);
  } else if (estilo === 'faixa') {
    partes.push(`<rect x="${frente.x}" y="${H * 0.36}" width="${frente.w}" height="${H * 0.3}" fill="${p.acento}"/>`);
    partes.push(`<rect x="${verso.x}" y="${H * 0.36}" width="${verso.w}" height="${H * 0.3}" fill="${escurecer(p.fundo, 0.25)}"/>`);
  } else if (estilo === 'minimal') {
    partes.push(`<line x1="${frente.x + seg + px(0.3)}" y1="${H * 0.5}" x2="${frente.x + frente.w - seg - px(0.3)}" y2="${H * 0.5}" stroke="${p.acento}" stroke-width="${px(0.03)}"/>`);
  } else if (estilo === 'circulo') {
    partes.push(`<circle cx="${frente.x + frente.w / 2}" cy="${H * 0.42}" r="${frente.w * 0.34}" fill="${p.acento}" opacity="0.95"/>`);
    partes.push(`<circle cx="${frente.x + frente.w * 0.78}" cy="${H * 0.7}" r="${frente.w * 0.12}" fill="${p.secundaria}"/>`);
  }
  // Lombada
  partes.push(`<rect x="${lomb.x}" y="0" width="${lomb.w}" height="${H}" fill="${escurecer(p.fundo, 0.18)}"/>`);
  // Título na frente
  const larguraTitulo = frente.w - 2 * seg - px(0.3);
  const corTituloBloco = estilo === 'bloco' ? textoLegivel(p.secundaria) : estilo === 'faixa' ? textoLegivel(p.acento) : textoCor;
  const tamTitulo = Math.min(px(0.85), ajustarTamanho(titulo, larguraTitulo * 1.9, { max: px(1.1), min: px(0.3) }));
  const linhasTitulo = quebrarParaLargura(titulo, tamTitulo, larguraTitulo);
  const yTitulo = estilo === 'faixa' ? H * 0.51 : estilo === 'circulo' ? H * 0.42 : sang + seg + H * 0.26;
  partes.push(textoSvg(linhasTitulo, { x: frente.x + frente.w / 2, y: yTitulo, tamanho: tamTitulo, alturaLinha: 1.08, 'font-family': fam, 'font-weight': '700', fill: corTituloBloco }));
  if (subtitulo) {
    const tamSub = Math.min(px(0.3), ajustarTamanho(subtitulo, larguraTitulo * 2.2, { max: px(0.3), min: px(0.16) }));
    const linhasSub = quebrarParaLargura(subtitulo, tamSub, larguraTitulo);
    const ySub = yTitulo + (linhasTitulo.length * tamTitulo * 1.08) / 2 + tamSub * 1.6;
    partes.push(textoSvg(linhasSub, { x: frente.x + frente.w / 2, y: ySub, tamanho: tamSub, 'font-family': fam, 'font-weight': '400', fill: corTituloBloco, opacity: 0.92 }));
  }
  if (autor) partes.push(textoSvg([autor], { x: frente.x + frente.w / 2, y: H - sang - seg - px(0.55), tamanho: px(0.26), 'font-family': fam, 'font-weight': '600', fill: textoCor }));
  if (selo) {
    partes.push(`<circle cx="${frente.x + frente.w - seg - px(0.6)}" cy="${sang + seg + px(0.6)}" r="${px(0.5)}" fill="${p.acento}"/>`);
    partes.push(textoSvg(quebrarParaLargura(selo, px(0.14), px(0.8)), { x: frente.x + frente.w - seg - px(0.6), y: sang + seg + px(0.6), tamanho: px(0.14), 'font-family': fam, 'font-weight': '700', fill: textoLegivel(p.acento) }));
  }
  // Lombada (texto só com páginas suficientes)
  if (d.textoNaLombada && titulo) {
    const tamLomb = Math.min(lomb.w * 0.55, px(0.28));
    const textoLomb = autor ? `${titulo}   ·   ${autor}` : titulo;
    partes.push(`<text transform="translate(${lomb.x + lomb.w / 2 + tamLomb * 0.35}, ${H / 2}) rotate(90)" text-anchor="middle" font-family="${escapeXml(fam)}" font-size="${tamLomb}" font-weight="700" fill="${textoLegivel(escurecer(p.fundo, 0.18))}">${escapeXml(textoLomb)}</text>`);
  }
  // Contracapa: texto e área do código de barras
  const larguraContra = verso.w - 2 * seg - px(0.3);
  if (textoContracapa) {
    const tamC = px(0.2);
    const linhas = quebrarParaLargura(textoContracapa, tamC, larguraContra).slice(0, 26);
    const yC = sang + seg + px(0.6);
    partes.push(`<text x="${verso.x + seg + px(0.15)}" y="${yC}" font-family="${escapeXml(fam)}" font-size="${tamC}" fill="${estilo === 'faixa' ? textoCor : textoCor}">${linhas.map((l, i) => `<tspan x="${verso.x + seg + px(0.15)}" y="${(yC + i * tamC * 1.35).toFixed(1)}">${escapeXml(l)}</tspan>`).join('')}</text>`);
  }
  const cb = d.zonas.codigoBarras;
  partes.push(`<rect x="${verso.x + verso.w - seg - px(cb.largura)}" y="${H - sang - seg - px(cb.altura)}" width="${px(cb.largura)}" height="${px(cb.altura)}" fill="#FFFFFF"/>`);
  if (guias) {
    partes.push(`<rect x="${sang}" y="${sang}" width="${W - 2 * sang}" height="${H - 2 * sang}" fill="none" stroke="#FF00FF" stroke-width="3" stroke-dasharray="20 12"/>`);
    partes.push(`<rect x="${sang + seg}" y="${sang + seg}" width="${verso.w - 2 * seg}" height="${H - 2 * sang - 2 * seg}" fill="none" stroke="#00AAFF" stroke-width="3" stroke-dasharray="12 12"/>`);
    partes.push(`<rect x="${frente.x + seg}" y="${sang + seg}" width="${frente.w - 2 * seg}" height="${H - 2 * sang - 2 * seg}" fill="none" stroke="#00AAFF" stroke-width="3" stroke-dasharray="12 12"/>`);
    partes.push(`<line x1="${lomb.x}" y1="0" x2="${lomb.x}" y2="${H}" stroke="#FF00FF" stroke-width="3"/><line x1="${lomb.x + lomb.w}" y1="0" x2="${lomb.x + lomb.w}" y2="${H}" stroke="#FF00FF" stroke-width="3"/>`);
    partes.push(`<text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-family="monospace" font-size="28" fill="#FF00FF">${escapeXml(`${d.larguraPol}" × ${d.alturaPol}" · lombada ${d.lombadaPol}" · ${paginas} páginas · papel ${papel} · sangria 0,125" (guias: não imprimir)`)}</text>`);
  }
  const svg = documentoSvg({ largura: W, altura: H, conteudo: partes.join('\n'), css, titulo: `Capa — ${titulo}`, desc: `Capa completa KDP ${trim}, ${paginas} páginas, papel ${papel}` });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(titulo)}</title><style>@page{size:${d.larguraPol}in ${d.alturaPol}in;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${d.larguraPol}in;height:${d.alturaPol}in}</style></head><body>${svg.replace(/^<\?xml[^>]*>\s*/, '')}</body></html>`;
  return { svg, html, dims: d, paleta: p };
}
