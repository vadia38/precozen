// Estampas tipográficas para Merch by Amazon (PNG transparente 4500×5400): layouts empilhado, arco, selo e minimal.
import { documentoSvg, textoSvg, ajustarTamanho, fonteEmbutida, medirTexto } from '../core/svg.js';
import { escapeXml, normalizar } from '../core/util.js';
import { produtoMerch } from './especificacoes.js';
import { paleta as obterPaleta, textoLegivel } from './paletas.js';

export const LAYOUTS = ['empilhado', 'arco', 'selo', 'minimal'];

/**
 * gerarCamiseta({ texto, subtexto, layout, paleta, produto, corCamisa: 'escura'|'clara', fontes: [{caminho, familia}], familia, margem })
 * Devolve { svg, spec, cores, avisos }.
 */
export function gerarCamiseta({ texto, subtexto = '', layout = 'empilhado', paleta = 'noite', produto = 'camiseta', corCamisa = 'escura', fontes = [], familia = 'DejaVu Sans, Arial Black, Impact, Arial, sans-serif', margem = 0.08, caixaAlta = true } = {}) {
  if (!texto) throw new Error('informe o texto da estampa');
  if (!LAYOUTS.includes(layout)) throw new Error(`layout desconhecido: ${layout} (opções: ${LAYOUTS.join(', ')})`);
  const spec = produtoMerch(produto);
  const p = obterPaleta(paleta);
  const W = spec.largura; const H = spec.altura;
  // Sobre camisa escura, texto principal claro; sobre clara, escuro. O acento da paleta colore detalhes.
  const corTexto = corCamisa === 'clara' ? (textoLegivel('#FFFFFF') === '#111111' ? p.fundo === '#FFFFFF' ? '#111111' : p.fundo : '#111111') : (textoLegivel('#222222') === '#FFFFFF' ? '#FFFFFF' : '#FFFFFF');
  const corAcento = p.acento;
  const corSec = corCamisa === 'clara' ? p.secundaria : p.acento;
  const css = fontes.map((f) => fonteEmbutida(f.caminho, f.familia || 'FonteEstampa', { peso: f.peso })).join('\n');
  const fam = fontes.length ? `${fontes[0].familia || 'FonteEstampa'}, ${familia}` : familia;
  const areaW = W * (1 - 2 * margem); const areaH = H * (1 - 2 * margem);
  const cx = W / 2; const cy = H / 2;
  const T = caixaAlta ? String(texto).toUpperCase() : String(texto);
  const partes = [];
  const avisos = [];
  const linhas = T.split(/\s*\|\s*|\n/).map((l) => l.trim()).filter(Boolean);
  if (layout === 'empilhado') {
    // cada linha ocupa a largura total; altura total limitada
    const tamanhos = linhas.map((l) => ajustarTamanho(l, areaW, { max: areaH / linhas.length / 1.05, min: 40, fator: 0.62 }));
    const alturaTotal = tamanhos.reduce((s, t) => s + t * 1.02, 0);
    let y = cy - alturaTotal / 2;
    linhas.forEach((l, i) => {
      y += tamanhos[i] * 1.02;
      partes.push(`<text x="${cx}" y="${(y - tamanhos[i] * 0.12).toFixed(1)}" text-anchor="middle" font-family="${escapeXml(fam)}" font-weight="900" font-size="${tamanhos[i]}" fill="${i % 2 === 1 ? corAcento : corTexto}" textLength="${areaW}" lengthAdjust="spacingAndGlyphs">${escapeXml(l)}</text>`);
    });
    if (subtexto) partes.push(textoSvg([subtexto], { x: cx, y: y + 200, tamanho: 130, 'font-family': fam, 'font-weight': '600', fill: corSec, 'letter-spacing': 24 }));
  } else if (layout === 'arco') {
    const raio = areaW * 0.52;
    const tam = Math.min(420, ajustarTamanho(linhas[0], raio * 2.6, { max: 420, min: 120, fator: 0.62 }));
    partes.push(`<defs><path id="arco" d="M ${cx - raio} ${cy} A ${raio} ${raio} 0 0 1 ${cx + raio} ${cy}"/></defs>`);
    partes.push(`<text font-family="${escapeXml(fam)}" font-weight="900" font-size="${tam}" fill="${corTexto}" letter-spacing="10"><textPath href="#arco" startOffset="50%" text-anchor="middle">${escapeXml(linhas[0])}</textPath></text>`);
    if (linhas[1]) partes.push(textoSvg([linhas[1]], { x: cx, y: cy + 120, tamanho: Math.min(520, ajustarTamanho(linhas[1], areaW * 0.8, { max: 520, min: 120, fator: 0.62 })), 'font-family': fam, 'font-weight': '900', fill: corAcento }));
    partes.push(`<line x1="${cx - areaW * 0.3}" y1="${cy + 300}" x2="${cx + areaW * 0.3}" y2="${cy + 300}" stroke="${corSec}" stroke-width="28" stroke-linecap="round"/>`);
    if (subtexto) partes.push(textoSvg([subtexto], { x: cx, y: cy + 460, tamanho: 150, 'font-family': fam, 'font-weight': '600', fill: corTexto, 'letter-spacing': 20 }));
  } else if (layout === 'selo') {
    const R = Math.min(areaW, areaH) * 0.42;
    partes.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${corTexto}" stroke-width="60"/>`);
    partes.push(`<circle cx="${cx}" cy="${cy}" r="${R - 130}" fill="none" stroke="${corAcento}" stroke-width="18" stroke-dasharray="50 40"/>`);
    partes.push(`<defs><path id="anel" d="M ${cx} ${cy + R - 250} m -${R - 250} 0 a ${R - 250} ${R - 250} 0 1 1 ${2 * (R - 250)} 0 a ${R - 250} ${R - 250} 0 1 1 -${2 * (R - 250)} 0"/></defs>`);
    const anel = subtexto ? `${subtexto} • ${subtexto} • ` : `${linhas[0]} • ${linhas[0]} • `;
    partes.push(`<text font-family="${escapeXml(fam)}" font-weight="700" font-size="150" fill="${corTexto}" letter-spacing="18"><textPath href="#anel" startOffset="0">${escapeXml(anel.toUpperCase())}</textPath></text>`);
    const centro = subtexto ? linhas : linhas.slice(1).length ? linhas.slice(1) : linhas;
    const tamC = Math.min(400, ajustarTamanho(centro.reduce((a, b) => (a.length > b.length ? a : b)), (R - 420) * 2, { max: 400, min: 100, fator: 0.62 }));
    partes.push(textoSvg(centro, { x: cx, y: cy, tamanho: tamC, alturaLinha: 1.1, 'font-family': fam, 'font-weight': '900', fill: corAcento }));
    partes.push(`<polygon points="${cx},${cy - R + 70} ${cx + 45},${cy - R + 160} ${cx - 45},${cy - R + 160}" fill="${corAcento}"/>`);
  } else if (layout === 'minimal') {
    const tam = Math.min(360, ajustarTamanho(linhas[0], areaW * 0.9, { max: 360, min: 80, fator: 0.6 }));
    partes.push(textoSvg([linhas[0]], { x: cx, y: cy - 40, tamanho: tam, 'font-family': fam, 'font-weight': '400', fill: corTexto, 'letter-spacing': 30 }));
    partes.push(`<line x1="${cx - 400}" y1="${cy + 120}" x2="${cx + 400}" y2="${cy + 120}" stroke="${corAcento}" stroke-width="14" stroke-linecap="round"/>`);
    if (subtexto || linhas[1]) partes.push(textoSvg([subtexto || linhas[1]], { x: cx, y: cy + 300, tamanho: 120, 'font-family': fam, 'font-weight': '600', fill: corSec, 'letter-spacing': 40 }));
  }
  const maior = linhas.reduce((a, b) => (a.length > b.length ? a : b), '');
  if (medirTexto(maior, 100, 0.62) > 0 && maior.length > 22) avisos.push('linha longa: divida o texto com "|" para empilhar');
  const svg = documentoSvg({ largura: W, altura: H, conteudo: partes.join('\n'), css, titulo: `Estampa — ${texto}`, desc: `${spec.nome} ${W}×${H} px, fundo transparente` });
  return { svg, spec, cores: { texto: corTexto, acento: corAcento, secundaria: corSec }, avisos, layout, linhas };
}

/** Textos de listagem Merch (template, sem IA) a partir da ideia. */
export function textosMerch({ texto, subtexto = '', nicho = '', marca = '', idioma = 'pt-BR' }) {
  const frase = String(texto).replace(/\s*\|\s*/g, ' ');
  const en = idioma.startsWith('en');
  const marcaFinal = marca || (en ? `${frase.split(' ').slice(0, 2).join(' ')} Tees` : `${frase.split(' ').slice(0, 2).join(' ')} Estampas`);
  const nichoNoTitulo = nicho && !normalizar(frase).includes(normalizar(nicho)) ? ` ${nicho}` : '';
  const cortar = (t, max) => (t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, ''));
  const titulo = en ? cortar(`${frase}${nichoNoTitulo} Funny Gift T-Shirt`, 60) : cortar(`Camiseta ${frase}${nichoNoTitulo} Presente Divertido`, 60);
  const bullets = en
    ? [`${frase}${subtexto ? ` - ${subtexto}` : ''}. Perfect gift idea${nicho ? ` for ${nicho} lovers` : ''}, birthdays, holidays and everyday wear.`, 'Lightweight, classic fit, double-needle sleeve and bottom hem. Printed on demand with eco-friendly inks.']
    : [`${frase}${subtexto ? ` - ${subtexto}` : ''}. Ideia de presente${nicho ? ` para quem ama ${nicho}` : ''}, aniversário, datas especiais e uso diário.`, 'Leve, modelagem clássica, costura dupla nas mangas e na barra. Estampa impressa sob demanda com tintas ecológicas.'];
  const descricao = en
    ? `${frase}${subtexto ? ` — ${subtexto}` : ''}. A ${nicho || 'fun'} design for people who like to wear what they love. Great as a gift for friends and family.`
    : `${frase}${subtexto ? ` — ${subtexto}` : ''}. Uma estampa ${nicho ? `para quem curte ${nicho}` : 'divertida'} e quer vestir o que gosta. Ótima opção de presente para amigos e família.`;
  return { marca: marcaFinal.slice(0, 50), titulo: titulo.slice(0, 60), bullets: bullets.map((b) => b.slice(0, 256)), descricao: descricao.slice(0, 2000), palavrasChave: [frase.toLowerCase(), nicho.toLowerCase(), en ? 'funny shirt' : 'camiseta divertida', en ? 'gift idea' : 'ideia de presente'].filter(Boolean) };
}
