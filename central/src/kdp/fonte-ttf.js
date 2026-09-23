// Leitor mínimo de TrueType (.ttf): métricas, mapa de caracteres → glifos e descritor para embutir em PDF.
import fs from 'node:fs';
import path from 'node:path';

const CAMINHOS_FONTES = [
  '/usr/share/fonts', '/usr/local/share/fonts', `${process.env.HOME || ''}/.fonts`, `${process.env.HOME || ''}/.local/share/fonts`,
  '/Library/Fonts', '/System/Library/Fonts', `${process.env.HOME || ''}/Library/Fonts`, 'C:\\Windows\\Fonts', `${process.env.LOCALAPPDATA || ''}\\Microsoft\\Windows\\Fonts`,
];

/** Candidatas por papel: [regular, negrito]. A primeira encontrada vence. */
export const FAMILIAS_PADRAO = {
  sans: [['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'], ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'], ['Arial.ttf', 'Arial Bold.ttf'], ['arial.ttf', 'arialbd.ttf'], ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'], ['FreeSans.ttf', 'FreeSansBold.ttf'], ['Helvetica.ttf', 'Helvetica-Bold.ttf']],
  serif: [['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf'], ['LiberationSerif-Regular.ttf', 'LiberationSerif-Bold.ttf'], ['Times New Roman.ttf', 'Times New Roman Bold.ttf'], ['times.ttf', 'timesbd.ttf'], ['NotoSerif-Regular.ttf', 'NotoSerif-Bold.ttf'], ['FreeSerif.ttf', 'FreeSerifBold.ttf'], ['Georgia.ttf', 'Georgia Bold.ttf']],
  mono: [['DejaVuSansMono.ttf', 'DejaVuSansMono-Bold.ttf'], ['LiberationMono-Regular.ttf', 'LiberationMono-Bold.ttf'], ['Courier New.ttf', 'Courier New Bold.ttf'], ['cour.ttf', 'courbd.ttf']],
};

function listarTtf(dir, saida, profundidade = 0) {
  if (!dir || !fs.existsSync(dir) || profundidade > 4) return;
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarTtf(p, saida, profundidade + 1);
    else if (/\.ttf$/i.test(e.name)) saida.set(e.name.toLowerCase(), p);
  }
}

let indiceFontes;
/** Índice nome-de-arquivo → caminho das fontes .ttf do sistema. */
export function fontesDoSistema() {
  if (!indiceFontes) {
    indiceFontes = new Map();
    for (const dir of CAMINHOS_FONTES) listarTtf(dir, indiceFontes);
  }
  return indiceFontes;
}

/** Encontra um par [regular, negrito] de uma família (sans, serif, mono) ou por caminho explícito. */
export function localizarFonte(preferencia = 'sans', { regular, negrito } = {}) {
  if (regular && fs.existsSync(regular)) return { regular, negrito: negrito && fs.existsSync(negrito) ? negrito : regular, origem: 'configurada' };
  const idx = fontesDoSistema();
  for (const [r, b] of FAMILIAS_PADRAO[preferencia] || FAMILIAS_PADRAO.sans) {
    const pr = idx.get(r.toLowerCase());
    if (pr) return { regular: pr, negrito: idx.get(b.toLowerCase()) || pr, origem: 'sistema' };
  }
  return null;
}

/** Lê um .ttf e devolve métricas e mapeamentos. */
export function lerTtf(caminho) {
  const buf = fs.readFileSync(caminho);
  const tabelas = new Map();
  const numTabelas = buf.readUInt16BE(4);
  for (let i = 0; i < numTabelas; i++) {
    const off = 12 + i * 16;
    tabelas.set(buf.toString('ascii', off, off + 4), { offset: buf.readUInt32BE(off + 8), tamanho: buf.readUInt32BE(off + 12) });
  }
  const t = (nome) => { const x = tabelas.get(nome); if (!x) throw new Error(`fonte ${path.basename(caminho)} sem tabela ${nome}`); return x; };
  const head = t('head');
  const unitsPerEm = buf.readUInt16BE(head.offset + 18);
  const bbox = [buf.readInt16BE(head.offset + 36), buf.readInt16BE(head.offset + 38), buf.readInt16BE(head.offset + 40), buf.readInt16BE(head.offset + 42)];
  const hhea = t('hhea');
  const ascender = buf.readInt16BE(hhea.offset + 4);
  const descender = buf.readInt16BE(hhea.offset + 6);
  const numMetricas = buf.readUInt16BE(hhea.offset + 34);
  const maxp = t('maxp');
  const numGlifos = buf.readUInt16BE(maxp.offset + 4);
  const hmtx = t('hmtx');
  const larguras = new Array(numGlifos);
  let ultima = 0;
  for (let g = 0; g < numGlifos; g++) {
    if (g < numMetricas) ultima = buf.readUInt16BE(hmtx.offset + g * 4);
    larguras[g] = ultima;
  }
  let capHeight = Math.round(ascender * 0.7);
  let italico = 0;
  let pesoClasse = 400;
  let fsType = 0;
  if (tabelas.has('OS/2')) {
    const os2 = tabelas.get('OS/2');
    const versao = buf.readUInt16BE(os2.offset);
    pesoClasse = buf.readUInt16BE(os2.offset + 4);
    fsType = buf.readUInt16BE(os2.offset + 8);
    if (versao >= 2 && os2.tamanho >= 90) capHeight = buf.readInt16BE(os2.offset + 88) || capHeight;
  }
  if (tabelas.has('post')) italico = buf.readInt32BE(tabelas.get('post').offset + 4) / 65536;
  const cmap = lerCmap(buf, t('cmap').offset);
  const nomeBruto = lerNome(buf, tabelas.get('name')) || path.basename(caminho, '.ttf');
  const nome = nomeBruto.replace(/[^A-Za-z0-9-]/g, '') || path.basename(caminho, '.ttf').replace(/[^A-Za-z0-9-]/g, '') || 'Fonte';
  return { caminho, dados: buf, unitsPerEm, bbox, ascender, descender, capHeight, italico, pesoClasse, fsType, numGlifos, larguras, cmap, nome };
}

function lerNome(buf, tabela) {
  if (!tabela) return null;
  try {
    const count = buf.readUInt16BE(tabela.offset + 2);
    const stringOffset = buf.readUInt16BE(tabela.offset + 4);
    const candidatos = {};
    for (let i = 0; i < count; i++) {
      const rec = tabela.offset + 6 + i * 12;
      const platform = buf.readUInt16BE(rec);
      const nameId = buf.readUInt16BE(rec + 6);
      const len = buf.readUInt16BE(rec + 8);
      const off = buf.readUInt16BE(rec + 10);
      if (nameId !== 6 && nameId !== 4) continue; // 6 = nome PostScript, 4 = nome completo
      const inicio = tabela.offset + stringOffset + off;
      if (inicio + len > buf.length) continue;
      let s;
      if (platform === 3 || platform === 0) {
        const codigos = [];
        for (let k = 0; k + 1 < len; k += 2) codigos.push(buf.readUInt16BE(inicio + k));
        s = String.fromCharCode(...codigos);
      } else s = buf.toString('latin1', inicio, inicio + len);
      s = s.replace(/\0/g, '').trim();
      if (s && !candidatos[nameId]) candidatos[nameId] = s;
    }
    return candidatos[6] || candidatos[4] || null;
  } catch { return null; }
}

function lerCmap(buf, base) {
  const num = buf.readUInt16BE(base + 2);
  let melhor = null;
  for (let i = 0; i < num; i++) {
    const rec = base + 4 + i * 8;
    const plat = buf.readUInt16BE(rec);
    const enc = buf.readUInt16BE(rec + 2);
    const off = buf.readUInt32BE(rec + 4);
    const formato = buf.readUInt16BE(base + off);
    const prioridade = plat === 3 && enc === 10 && formato === 12 ? 3 : plat === 3 && enc === 1 && formato === 4 ? 2 : plat === 0 && (formato === 4 || formato === 12) ? 1 : 0;
    if (prioridade && (!melhor || prioridade > melhor.prioridade)) melhor = { prioridade, off: base + off, formato };
  }
  const mapa = new Map();
  if (!melhor) return mapa;
  if (melhor.formato === 4) {
    const o = melhor.off;
    const segX2 = buf.readUInt16BE(o + 6);
    const seg = segX2 / 2;
    const ends = o + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const rangeOffs = deltas + segX2;
    for (let s = 0; s < seg; s++) {
      const end = buf.readUInt16BE(ends + s * 2);
      const start = buf.readUInt16BE(starts + s * 2);
      const delta = buf.readInt16BE(deltas + s * 2);
      const ro = buf.readUInt16BE(rangeOffs + s * 2);
      if (start === 0xffff) continue;
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          const addr = rangeOffs + s * 2 + ro + (c - start) * 2;
          if (addr + 1 >= buf.length) continue;
          g = buf.readUInt16BE(addr);
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g) mapa.set(c, g);
      }
    }
  } else if (melhor.formato === 12) {
    const o = melhor.off;
    const grupos = buf.readUInt32BE(o + 12);
    for (let i = 0; i < grupos; i++) {
      const g = o + 16 + i * 12;
      const inicio = buf.readUInt32BE(g);
      const fim = buf.readUInt32BE(g + 4);
      const glifo = buf.readUInt32BE(g + 8);
      for (let c = inicio; c <= fim && c - inicio < 65536; c++) mapa.set(c, glifo + (c - inicio));
    }
  }
  return mapa;
}

/** Largura de um texto em pontos para a fonte e o tamanho dados. */
export function medirTtf(fonte, texto, tamanho) {
  let w = 0;
  for (const ch of String(texto ?? '')) {
    const g = fonte.cmap.get(ch.codePointAt(0)) ?? fonte.cmap.get(63) ?? 0;
    w += fonte.larguras[g] ?? 0;
  }
  return (w / fonte.unitsPerEm) * tamanho;
}
