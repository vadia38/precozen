// Renderização de SVG/HTML em PNG e PDF usando o que estiver instalado: Chromium/Chrome (headless), rsvg-convert, ImageMagick ou Inkscape.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { segredo } from '../core/config.js';

const CANDIDATOS_CHROMIUM = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge', '/opt/pw-browsers/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'];

function existeNoPath(cmd) {
  if (cmd.includes(path.sep) || cmd.includes('/')) return fs.existsSync(cmd) ? cmd : null;
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) for (const ext of exts) { const p = path.join(dir, cmd + ext); if (fs.existsSync(p)) return p; }
  return null;
}

let cacheRenderizador;
/** Detecta o renderizador disponível: { tipo: 'chromium'|'rsvg'|'magick'|'inkscape', bin } ou null. */
export function detectarRenderizador(preferido = 'auto') {
  if (cacheRenderizador !== undefined && preferido === 'auto') return cacheRenderizador;
  const ordem = preferido === 'auto' ? ['chromium', 'rsvg', 'magick', 'inkscape'] : [preferido];
  const custom = segredo('PRECOZEN_CHROMIUM');
  for (const tipo of ordem) {
    if (tipo === 'chromium') {
      for (const c of [custom, ...CANDIDATOS_CHROMIUM].filter(Boolean)) { const bin = existeNoPath(c); if (bin) { cacheRenderizador = { tipo, bin }; return cacheRenderizador; } }
    } else if (tipo === 'rsvg') { const bin = existeNoPath('rsvg-convert'); if (bin) { cacheRenderizador = { tipo, bin }; return cacheRenderizador; } }
    else if (tipo === 'magick') { const bin = existeNoPath('magick') || existeNoPath('convert'); if (bin) { cacheRenderizador = { tipo, bin }; return cacheRenderizador; } }
    else if (tipo === 'inkscape') { const bin = existeNoPath('inkscape'); if (bin) { cacheRenderizador = { tipo, bin }; return cacheRenderizador; } }
  }
  if (preferido === 'auto') cacheRenderizador = null;
  return null;
}

function tmp(ext) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-render-')), `arquivo${ext}`);
}

function chromium(bin, args, timeoutMs = 120000) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-chromium-'));
  try {
    execFileSync(bin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions', '--disable-sync', '--no-default-browser-check', `--user-data-dir=${perfil}`, ...args], { stdio: ['ignore', 'ignore', 'pipe'], timeout: timeoutMs });
  } finally {
    fs.rmSync(perfil, { recursive: true, force: true });
  }
}

/**
 * SVG (string ou caminho) → PNG. opcoes: { largura, altura, transparente=true, renderizador='auto', escala=1 }
 */
export function svgParaPng(svg, destino, { largura, altura, transparente = true, renderizador = 'auto' } = {}) {
  const r = detectarRenderizador(renderizador);
  if (!r) throw new Error('nenhum renderizador encontrado: instale o Chromium/Chrome (ou defina PRECOZEN_CHROMIUM), rsvg-convert, ImageMagick ou Inkscape');
  const conteudo = fs.existsSync(String(svg)) && /\.svg$/i.test(String(svg)) ? fs.readFileSync(svg, 'utf8') : String(svg);
  const m = conteudo.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const W = Math.round(largura || (m ? Number(m[1]) : 1000));
  const H = Math.round(altura || (m ? Number(m[2]) : 1000));
  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
  if (r.tipo === 'chromium') {
    const html = tmp('.html');
    fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${transparente ? 'transparent' : '#fff'};overflow:hidden}svg{display:block;width:${W}px;height:${H}px}</style></head><body>${conteudo.replace(/^<\?xml[^>]*>\s*/, '')}</body></html>`);
    chromium(r.bin, [`--window-size=${W},${H}`, '--force-device-scale-factor=1', `--default-background-color=${transparente ? '00000000' : 'FFFFFFFF'}`, `--screenshot=${path.resolve(destino)}`, `file://${html}`]);
    fs.rmSync(path.dirname(html), { recursive: true, force: true });
  } else {
    const svgTmp = tmp('.svg');
    fs.writeFileSync(svgTmp, conteudo);
    if (r.tipo === 'rsvg') execFileSync(r.bin, ['-w', String(W), '-h', String(H), ...(transparente ? [] : ['-b', 'white']), '-o', path.resolve(destino), svgTmp], { stdio: 'pipe', timeout: 120000 });
    else if (r.tipo === 'magick') execFileSync(r.bin, ['-background', transparente ? 'none' : 'white', '-density', '96', svgTmp, '-resize', `${W}x${H}!`, path.resolve(destino)], { stdio: 'pipe', timeout: 120000 });
    else execFileSync(r.bin, [svgTmp, '--export-type=png', `--export-filename=${path.resolve(destino)}`, '-w', String(W), '-h', String(H), ...(transparente ? [] : ['--export-background=#ffffff'])], { stdio: 'pipe', timeout: 180000 });
    fs.rmSync(path.dirname(svgTmp), { recursive: true, force: true });
  }
  if (!fs.existsSync(destino)) throw new Error(`o renderizador ${r.tipo} não gerou ${destino}`);
  return { destino: path.resolve(destino), largura: W, altura: H, renderizador: r.tipo };
}

/** HTML (caminho ou string com @page) → PDF via Chromium. */
export function htmlParaPdf(html, destino, { renderizador = 'auto' } = {}) {
  const r = detectarRenderizador(renderizador === 'auto' ? 'chromium' : renderizador);
  if (!r || r.tipo !== 'chromium') throw new Error('gerar PDF exige Chromium/Chrome (defina PRECOZEN_CHROMIUM com o caminho do executável)');
  let arquivo = String(html);
  let temporario = null;
  if (!(fs.existsSync(arquivo) && /\.html?$/i.test(arquivo))) { temporario = tmp('.html'); fs.writeFileSync(temporario, arquivo); arquivo = temporario; }
  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
  chromium(r.bin, ['--no-pdf-header-footer', `--print-to-pdf=${path.resolve(destino)}`, `file://${path.resolve(arquivo)}`]);
  if (temporario) fs.rmSync(path.dirname(temporario), { recursive: true, force: true });
  if (!fs.existsSync(destino)) throw new Error('o Chromium não gerou o PDF');
  return { destino: path.resolve(destino), renderizador: 'chromium' };
}

/** Lê dimensões de um PNG (IHDR). */
export function dimensoesPng(caminho) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(caminho, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), colorType: fs.readFileSync(caminho)[25] };
}
