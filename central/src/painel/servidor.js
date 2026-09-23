// Servidor estático local (sem dependências) com observação de pastas e reconstrução por callback.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../core/log.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

/**
 * Serve `pasta` em http://localhost:porta. opcoes: { porta, observar: [dirs], aoMudar(), base }
 * Devolve uma promessa que só resolve quando o servidor fecha (Ctrl+C).
 */
export function servirPasta(pasta, { porta = 4180, observar = [], aoMudar, base = '/' } = {}) {
  const raiz = path.resolve(pasta);
  const servidor = http.createServer((req, res) => {
    let caminho;
    try { caminho = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname); } catch { res.writeHead(400); res.end('Requisição inválida'); return; }
    if (!caminho.startsWith(base)) { res.writeHead(302, { Location: base }); res.end(); return; }
    caminho = caminho.slice(base.length);
    let arquivo = path.resolve(raiz, `.${path.sep}${caminho}`);
    const rel = path.relative(raiz, arquivo);
    if (rel.startsWith('..') || path.isAbsolute(rel) || caminho.includes('\0')) { res.writeHead(403); res.end('Proibido'); return; }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
    if (!fs.existsSync(arquivo)) {
      const p404 = path.join(raiz, '404.html');
      res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(fs.existsSync(p404) ? fs.readFileSync(p404) : 'Não encontrado');
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(arquivo).pipe(res);
  });
  if (aoMudar && observar.length) {
    let timer = null;
    for (const dir of observar) {
      try { fs.watch(dir, { recursive: true }, (evento, arquivo) => { clearTimeout(timer); timer = setTimeout(() => { log.info(`[watch] ${arquivo || evento}`); aoMudar(); }, 250); }); } catch (e) { log.aviso(`não foi possível observar ${dir}: ${e.message}`); }
    }
  }
  return new Promise((resolve) => {
    servidor.listen(porta, () => log.info(`Servindo ${raiz} em http://localhost:${porta}${base} (Ctrl+C para sair)`));
    servidor.on('close', resolve);
    process.on('SIGINT', () => { servidor.close(); resolve(); });
  });
}
