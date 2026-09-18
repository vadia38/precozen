#!/usr/bin/env node
// Servidor de desenvolvimento: gera o site, serve a pasta dist e reconstrói ao salvar arquivos.
// Uso: node scripts/dev.js [--port 4173] [--no-watch] [--base /]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { construir, lerArgs, normalizarBase } from '../src/build.js';
import { RAIZ } from '../src/lib/data.js';

const args = lerArgs(process.argv.slice(2));
const porta = Number(args.port || process.env.PORT || 4173);
const base = normalizarBase(args.base || process.env.BASE_PATH || '/');
const dist = path.join(RAIZ, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};

function rebuild() {
  try {
    const r = construir({ base, url: `http://localhost:${porta}`, out: dist });
    console.log(`[build] ${r.paginas} páginas em ${r.ms} ms`);
  } catch (e) {
    console.error(`[build] falhou: ${e.message}`);
  }
}

rebuild();

if (!args['no-watch']) {
  let timer = null;
  const agendar = (evento, arquivo) => {
    clearTimeout(timer);
    timer = setTimeout(() => { console.log(`[watch] ${arquivo || evento}`); rebuild(); }, 200);
  };
  for (const dir of ['src', 'public', 'data']) {
    try { fs.watch(path.join(RAIZ, dir), { recursive: true }, agendar); } catch (e) { console.warn(`[watch] não foi possível observar ${dir}: ${e.message}`); }
  }
  try { fs.watch(path.join(RAIZ, 'site.config.json'), agendar); } catch { /* opcional */ }
}

const servidor = http.createServer((req, res) => {
  let caminho;
  try {
    caminho = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    res.writeHead(400); res.end('Requisição inválida'); return;
  }
  if (!caminho.startsWith(base)) { res.writeHead(302, { Location: base }); res.end(); return; }
  caminho = caminho.slice(base.length);
  const arquivoBase = path.resolve(dist, `.${path.sep}${caminho}`);
  let arquivo = arquivoBase;
  const relativo = path.relative(dist, arquivo);
  if (relativo.startsWith('..') || path.isAbsolute(relativo) || caminho.includes('\0')) { res.writeHead(403); res.end('Proibido'); return; }
  if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
  if (!fs.existsSync(arquivo)) {
    res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(fs.existsSync(path.join(dist, '404.html')) ? fs.readFileSync(path.join(dist, '404.html')) : 'Não encontrado');
    return;
  }
  const ext = path.extname(arquivo).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(arquivo).pipe(res);
});

servidor.listen(porta, () => console.log(`Servindo dist em http://localhost:${porta}${base}`));
