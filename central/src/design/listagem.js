// Imagens e textos para listagens na Amazon: imagem principal, infográfico 2000×2000, banner A+ e textos por template.
import fs from 'node:fs';
import path from 'node:path';
import { documentoSvg, textoSvg, quebrarParaLargura, ajustarTamanho, fonteEmbutida } from '../core/svg.js';
import { escapeXml } from '../core/util.js';
import { imagemAmazon } from './especificacoes.js';
import { paleta as obterPaleta, textoLegivel, clarear } from './paletas.js';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function imagemEmbutida(caminho) {
  if (!caminho) return null;
  const ext = path.extname(caminho).toLowerCase();
  if (!MIME[ext] || !fs.existsSync(caminho)) throw new Error(`imagem inválida ou inexistente: ${caminho}`);
  return `data:${MIME[ext]};base64,${fs.readFileSync(caminho).toString('base64')}`;
}

/** Imagem principal: fundo branco puro, produto ocupando ~85% do quadro (sem texto). */
export function gerarImagemPrincipal({ imagem, tamanho = 2000 } = {}) {
  const spec = imagemAmazon('principal');
  const W = tamanho; const H = tamanho;
  const dado = imagemEmbutida(imagem);
  const ocup = spec.ocupacao;
  const conteudo = dado
    ? `<image href="${dado}" x="${(W * (1 - ocup)) / 2}" y="${(H * (1 - ocup)) / 2}" width="${W * ocup}" height="${H * ocup}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${(W * (1 - ocup)) / 2}" y="${(H * (1 - ocup)) / 2}" width="${W * ocup}" height="${H * ocup}" fill="none" stroke="#cccccc" stroke-width="6" stroke-dasharray="30 20"/><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="sans-serif" font-size="70" fill="#999">área do produto (85%)</text>`;
  return { svg: documentoSvg({ largura: W, altura: H, conteudo, fundo: '#FFFFFF', titulo: 'Imagem principal' }), spec };
}

/** Infográfico 2000×2000: imagem do produto à esquerda, título e até 5 destaques à direita. */
export function gerarInfografico({ titulo, destaques = [], imagem, paleta = 'papel', selo = '', fontes = [], familia = 'DejaVu Sans, Arial, sans-serif', tamanho = 2000 } = {}) {
  const p = obterPaleta(paleta);
  const W = tamanho; const H = tamanho;
  const css = fontes.map((f) => fonteEmbutida(f.caminho, f.familia || 'FonteListagem')).join('\n');
  const fam = fontes.length ? `${fontes[0].familia || 'FonteListagem'}, ${familia}` : familia;
  const corTexto = textoLegivel(p.fundo);
  const dado = imagemEmbutida(imagem);
  const partes = [];
  partes.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${p.fundo}"/>`);
  partes.push(`<rect x="0" y="0" width="${W * 0.46}" height="${H}" fill="${clarear(p.fundo, 0.35)}"/>`);
  if (dado) partes.push(`<image href="${dado}" x="${W * 0.04}" y="${H * 0.12}" width="${W * 0.38}" height="${H * 0.76}" preserveAspectRatio="xMidYMid meet"/>`);
  else partes.push(`<rect x="${W * 0.06}" y="${H * 0.2}" width="${W * 0.34}" height="${H * 0.6}" rx="40" fill="none" stroke="${p.secundaria}" stroke-width="8" stroke-dasharray="30 20"/>`);
  const xT = W * 0.5; const larguraTexto = W * 0.46;
  const tamT = Math.min(120, ajustarTamanho(titulo, larguraTexto * 2.1, { max: 120, min: 60 }));
  const linhasT = quebrarParaLargura(titulo, tamT, larguraTexto);
  linhasT.forEach((l, i) => partes.push(`<text x="${xT}" y="${H * 0.12 + i * tamT * 1.15}" font-family="${escapeXml(fam)}" font-size="${tamT}" font-weight="800" fill="${corTexto}">${escapeXml(l)}</text>`));
  let y = H * 0.12 + linhasT.length * tamT * 1.15 + 80;
  for (const d of destaques.slice(0, 5)) {
    const linhas = quebrarParaLargura(d, 56, larguraTexto - 110).slice(0, 2);
    partes.push(`<circle cx="${xT + 34}" cy="${y - 18}" r="34" fill="${p.acento}"/><path d="M ${xT + 18} ${y - 18} l 12 12 l 22 -26" fill="none" stroke="${textoLegivel(p.acento)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`);
    linhas.forEach((l, i) => partes.push(`<text x="${xT + 100}" y="${y + i * 66}" font-family="${escapeXml(fam)}" font-size="56" fill="${corTexto}">${escapeXml(l)}</text>`));
    y += linhas.length * 66 + 50;
  }
  if (selo) {
    partes.push(`<circle cx="${W * 0.88}" cy="${H * 0.88}" r="150" fill="${p.acento}"/>`);
    partes.push(textoSvg(quebrarParaLargura(selo, 44, 240), { x: W * 0.88, y: H * 0.88, tamanho: 44, 'font-family': fam, 'font-weight': '800', fill: textoLegivel(p.acento) }));
  }
  return { svg: documentoSvg({ largura: W, altura: H, conteudo: partes.join('\n'), css, titulo: `Infográfico — ${titulo}` }), spec: imagemAmazon('secundaria') };
}

/** Banner A+ padrão 970×600 com título e texto curto. */
export function gerarBannerAPlus({ titulo, texto = '', paleta = 'noite', imagem, fontes = [], familia = 'DejaVu Sans, Arial, sans-serif' } = {}) {
  const spec = imagemAmazon('a-plus-padrao');
  const p = obterPaleta(paleta);
  const css = fontes.map((f) => fonteEmbutida(f.caminho, f.familia || 'FonteListagem')).join('\n');
  const fam = fontes.length ? `${fontes[0].familia || 'FonteListagem'}, ${familia}` : familia;
  const corTexto = textoLegivel(p.fundo);
  const dado = imagemEmbutida(imagem);
  const partes = [`<rect width="${spec.largura}" height="${spec.altura}" fill="${p.fundo}"/>`];
  if (dado) partes.push(`<image href="${dado}" x="600" y="40" width="330" height="520" preserveAspectRatio="xMidYMid meet"/>`);
  const tamT = Math.min(64, ajustarTamanho(titulo, 1100, { max: 64, min: 36 }));
  quebrarParaLargura(titulo, tamT, 540).forEach((l, i) => partes.push(`<text x="60" y="${140 + i * tamT * 1.15}" font-family="${escapeXml(fam)}" font-size="${tamT}" font-weight="800" fill="${corTexto}">${escapeXml(l)}</text>`));
  quebrarParaLargura(texto, 28, 520).slice(0, 6).forEach((l, i) => partes.push(`<text x="60" y="${330 + i * 40}" font-family="${escapeXml(fam)}" font-size="28" fill="${corTexto}" opacity="0.9">${escapeXml(l)}</text>`));
  partes.push(`<rect x="60" y="${spec.altura - 70}" width="220" height="14" fill="${p.acento}"/>`);
  return { svg: documentoSvg({ largura: spec.largura, altura: spec.altura, conteudo: partes.join('\n'), css, titulo: `A+ — ${titulo}` }), spec };
}

/** Textos de listagem Amazon (template, sem IA). */
export function textosListagem({ nome, marca = '', categoria = '', beneficios = [], atributos = {}, publico = '' }) {
  const titulo = [marca, nome, ...Object.entries(atributos).slice(0, 3).map(([k, v]) => `${v}`)].filter(Boolean).join(' ').slice(0, 200);
  const bullets = beneficios.slice(0, 5).map((b) => { const [cab, ...resto] = String(b).split(/[:—-]/); return resto.length ? `${cab.trim().toUpperCase()}: ${resto.join('-').trim()}` : `${b[0].toUpperCase()}${b.slice(1)}`; }).map((b) => b.slice(0, 250));
  for (const [k, v] of Object.entries(atributos)) { if (bullets.length >= 5) break; const txt = `${k.toUpperCase()}: ${v}`; if (!bullets.some((b) => b.toLowerCase().includes(String(v).toLowerCase()))) bullets.push(txt); }
  const descricao = `${nome}${marca ? ` da ${marca}` : ''}${categoria ? `, ${categoria.toLowerCase()}` : ''}${publico ? ` para ${publico}` : ''}. ${beneficios.slice(0, 3).join('. ')}${beneficios.length ? '.' : ''} ${Object.entries(atributos).map(([k, v]) => `${k}: ${v}`).join('; ')}.`.replace(/\s+/g, ' ').trim().slice(0, 2000);
  const palavrasChave = [...new Set([nome, categoria, publico, ...beneficios.map((b) => b.split(' ').slice(0, 3).join(' '))].filter(Boolean).map((k) => k.toLowerCase()))].slice(0, 12);
  const chamadas = beneficios.slice(0, 5).map((b) => b.split(/[:,;.]/)[0].split(' ').slice(0, 5).join(' '));
  return { titulo, bullets, descricao, palavrasChave, chamadas };
}
