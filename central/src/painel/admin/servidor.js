// Servidor do painel administrativo: autenticação por token + cookie de sessão, API JSON, interface estática,
// pré-visualização do blog, arquivos da pasta de trabalho e fluxo de eventos (SSE) das tarefas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ_CENTRAL, workspace, caminhoSeguro } from '../../core/arquivos.js';
import { carregarConfig, segredo } from '../../core/config.js';
import { log } from '../../core/log.js';
import { Sessoes, gerarToken, lerCookies, verificarOrigem, NOME_COOKIE, nomeDoHost } from './sessao.js';
import { FilaTarefas } from './tarefas.js';
import { rotas, compilarRotas, encontrarRota, ErroHttp } from './api.js';

const DIR_UI = path.join(RAIZ_CENTRAL, 'templates', 'admin');
const DIR_TEMPLATES = path.join(RAIZ_CENTRAL, 'templates');
const LIMITE_CORPO = 40 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.gif': 'image/gif',
};
const CSP_PAINEL = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const CSP_PREVIEW = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
const CSP_ARQUIVO = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'self'";
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

function json(res, status, dados, cabecalhos = {}) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo), ...cabecalhos });
  res.end(corpo);
}

function textoResp(res, status, txt, tipo = 'text/plain; charset=utf-8', cabecalhos = {}) {
  res.writeHead(status, { 'Content-Type': tipo, ...cabecalhos });
  res.end(txt);
}

function lerCorpo(req, limite = LIMITE_CORPO) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (p) => { total += p.length; if (total > limite) { reject(new ErroHttp(413, 'corpo grande demais')); req.destroy(); return; } partes.push(p); });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function servirArquivo(res, arquivo, { csp, disposicao } = {}) {
  const ext = path.extname(arquivo).toLowerCase();
  const cabecalhos = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (csp && (ext === '.html' || ext === '.svg' || ext === '.xml' || ext === '.pdf')) cabecalhos['Content-Security-Policy'] = csp;
  if (disposicao) cabecalhos['Content-Disposition'] = disposicao;
  const st = fs.statSync(arquivo);
  cabecalhos['Content-Length'] = st.size;
  res.writeHead(200, cabecalhos);
  fs.createReadStream(arquivo).pipe(res);
}

/** Resolve um caminho de URL dentro de uma raiz; devolve null fora dela ou quando não existe. */
function resolverEstatico(raiz, rel) {
  if (rel.includes('\0')) return null;
  let arquivo;
  try { arquivo = caminhoSeguro(raiz, `.${path.sep}${rel}`); } catch { return null; }
  if (!fs.existsSync(arquivo)) return null;
  if (fs.statSync(arquivo).isDirectory()) { arquivo = path.join(arquivo, 'index.html'); if (!fs.existsSync(arquivo)) return null; }
  return arquivo;
}

export function abrirNavegador(url) {
  try {
    const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
    const p = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' });
    p.on('error', () => {});
    p.unref();
  } catch { /* sem navegador */ }
}

/**
 * Sobe o painel administrativo. Devolve { servidor, porta, host, url, token, tokenGerado, fila, sessoes, fechar(), encerrado }.
 * Sem token explícito ou PRECOZEN_PAINEL_TOKEN, um token aleatório é gerado por execução (e só vale no localhost).
 */
export async function iniciarAdmin({ porta = 4200, host = '127.0.0.1', token, configArquivo, silencioso = false } = {}) {
  const tokenAmbiente = segredo('PRECOZEN_PAINEL_TOKEN');
  const tokenFinal = token || tokenAmbiente || gerarToken();
  const tokenGerado = !token && !tokenAmbiente;
  if (!LOOPBACK.has(host) && tokenGerado) throw new Error('para expor o painel fora do localhost, defina PRECOZEN_PAINEL_TOKEN (um token longo e aleatório) em central/.env — e proteja o acesso com HTTPS/túnel');
  const sessoes = new Sessoes({ token: tokenFinal });
  const fila = new FilaTarefas();
  const hostsPermitidos = new Set([...LOOPBACK, host, ...String(process.env.PRECOZEN_PAINEL_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)]);
  const aceitarIps = !LOOPBACK.has(host);
  const compiladas = compilarRotas(rotas);
  const config = () => carregarConfig({ arquivo: configArquivo });
  const configArquivoFn = () => configArquivo || process.env.PRECOZEN_CONFIG || path.join(RAIZ_CENTRAL, 'precozen.config.json');
  const clientesSse = new Set();

  const escreverSse = (res, msg) => { if (res.destroyed || res.writableEnded) { clientesSse.delete(res); return; } try { res.write(msg); } catch { clientesSse.delete(res); } };
  const enviarSse = (evento, dados) => { const msg = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`; for (const res of clientesSse) escreverSse(res, msg); };
  fila.on('tarefa', (t) => enviarSse('tarefa', t));
  fila.on('log', (l) => enviarSse('log', l));
  const batimento = setInterval(() => { for (const res of clientesSse) escreverSse(res, ': ping\n\n'); }, 20_000);
  batimento.unref();

  async function tratar(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    let url;
    try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); } catch { return textoResp(res, 400, 'Requisição inválida'); }
    const caminho = decodeURIComponent(url.pathname);
    const motivo = verificarOrigem(req, { hostsPermitidos, aceitarIps });
    if (motivo) return caminho.startsWith('/api/') ? json(res, 403, { ok: false, erro: motivo }) : textoResp(res, 403, `Acesso negado: ${motivo}`);
    const origemCliente = req.socket.remoteAddress || 'desconhecida';
    const cookies = lerCookies(req.headers.cookie);
    const idSessao = cookies[NOME_COOKIE];
    const autenticado = sessoes.validar(idSessao);

    // Login pela URL (link impresso no terminal) e sessão
    if (caminho === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      const t = url.searchParams.get('token');
      if (t !== null) {
        const r = sessoes.autenticar(t, origemCliente);
        if (!r.ok) return textoResp(res, r.bloqueado ? 429 : 403, r.bloqueado ? 'Muitas tentativas. Aguarde um minuto.' : 'Token inválido.');
        res.writeHead(302, { Location: '/', 'Set-Cookie': sessoes.cookie(r.id) });
        return res.end();
      }
      res.setHeader('Content-Security-Policy', CSP_PAINEL);
      res.setHeader('X-Frame-Options', 'DENY');
      return servirArquivo(res, path.join(DIR_UI, 'index.html'));
    }
    if (caminho === '/api/sessao') {
      if (req.method === 'GET') return json(res, 200, { ok: true, autenticado, marca: null });
      if (req.method === 'POST') {
        let corpo = {};
        try { corpo = JSON.parse((await lerCorpo(req, 64 * 1024)).toString('utf8') || '{}'); } catch { return json(res, 400, { ok: false, erro: 'JSON inválido' }); }
        const r = sessoes.autenticar(typeof corpo.token === 'string' ? corpo.token : '', origemCliente);
        if (!r.ok) return json(res, r.bloqueado ? 429 : 401, { ok: false, erro: r.bloqueado ? 'muitas tentativas: aguarde um minuto' : 'token inválido' });
        return json(res, 200, { ok: true, autenticado: true }, { 'Set-Cookie': sessoes.cookie(r.id) });
      }
      if (req.method === 'DELETE') { sessoes.remover(idSessao); return json(res, 200, { ok: true, autenticado: false }, { 'Set-Cookie': sessoes.cookieLimpo() }); }
      return json(res, 405, { ok: false, erro: 'método não permitido' });
    }
    // Interface (arquivos estáticos do painel; sem dados sensíveis)
    if ((req.method === 'GET' || req.method === 'HEAD') && /^\/(admin\.js|admin\.css|painel\.css)$/.test(caminho)) {
      const arquivo = caminho === '/painel.css' ? path.join(DIR_TEMPLATES, 'painel.css') : path.join(DIR_UI, caminho.slice(1));
      return fs.existsSync(arquivo) ? servirArquivo(res, arquivo) : textoResp(res, 404, 'Não encontrado');
    }
    if (!autenticado) {
      if (caminho.startsWith('/api/')) return json(res, 401, { ok: false, erro: 'não autenticado', autenticado: false });
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    // Fluxo de eventos das tarefas
    if (caminho === '/api/tarefas/stream' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`retry: 2000\n\n`);
      res.write(`event: estado\ndata: ${JSON.stringify({ tarefas: fila.listar(), ativa: fila.ativa() })}\n\n`);
      res.on('error', () => clientesSse.delete(res));
      clientesSse.add(res);
      req.on('close', () => clientesSse.delete(res));
      return undefined;
    }
    // API JSON
    if (caminho.startsWith('/api/')) {
      const rota = encontrarRota(compiladas, req.method, caminho);
      if (!rota) return json(res, 404, { ok: false, erro: `rota não encontrada: ${req.method} ${caminho}` });
      let corpo = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const bruto = await lerCorpo(req);
        if (bruto.length) { try { corpo = JSON.parse(bruto.toString('utf8')); } catch { return json(res, 400, { ok: false, erro: 'JSON inválido' }); } }
      }
      const ctx = { req, res, params: rota.params, query: url.searchParams, corpo, config, configArquivo: configArquivoFn, fila, sessoes, host: req.headers.host, porta: servidorInfo.porta };
      const resultado = await rota.handler(ctx);
      return json(res, 200, { ok: true, ...(resultado || {}) });
    }
    // Pré-visualização do blog e arquivos da pasta de trabalho
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (caminho.startsWith('/preview/') || caminho === '/preview') {
        if (caminho === '/preview') { res.writeHead(302, { Location: '/preview/' }); return res.end(); }
        const raiz = workspace('blog', 'preview');
        const arquivo = resolverEstatico(raiz, caminho.slice('/preview/'.length));
        if (arquivo) return servirArquivo(res, arquivo, { csp: CSP_PREVIEW });
        const p404 = path.join(raiz, '404.html');
        res.writeHead(404, { 'Content-Type': MIME['.html'], 'Content-Security-Policy': CSP_PREVIEW });
        return res.end(fs.existsSync(p404) ? fs.readFileSync(p404) : 'Pré-visualização não gerada. Use "Pré-visualizar" na tela Blog.');
      }
      if (caminho.startsWith('/arquivo/')) {
        const arquivo = resolverEstatico(workspace(), caminho.slice('/arquivo/'.length));
        if (!arquivo) return textoResp(res, 404, 'Arquivo não encontrado');
        return servirArquivo(res, arquivo, { csp: CSP_ARQUIVO, disposicao: url.searchParams.has('baixar') ? `attachment; filename="${path.basename(arquivo).replace(/[^\w.-]+/g, '_')}"` : 'inline' });
      }
    }
    return caminho.startsWith('/api/') ? json(res, 404, { ok: false, erro: 'não encontrado' }) : textoResp(res, 404, 'Não encontrado');
  }

  const servidor = http.createServer((req, res) => {
    tratar(req, res).catch((e) => {
      if (res.headersSent) { try { res.end(); } catch { /* já fechado */ } return; }
      if (e instanceof ErroHttp) return json(res, e.status, { ok: false, erro: e.message, ...e.extras });
      if (e && /caminho fora da pasta permitida/.test(e.message)) return json(res, 400, { ok: false, erro: e.message });
      if (!silencioso) log.erro(`[painel] ${e.stack || e.message}`);
      return json(res, 500, { ok: false, erro: e.message || 'erro interno' });
    });
  });
  servidor.keepAliveTimeout = 65_000;
  const servidorInfo = { porta };
  await new Promise((resolve, reject) => { servidor.once('error', reject); servidor.listen(porta, host, () => { servidor.off('error', reject); resolve(); }); });
  servidorInfo.porta = servidor.address().port;
  const hostUrl = host.includes(':') ? `[${host}]` : host;
  const url = `http://${hostUrl}:${servidorInfo.porta}`;
  let resolverEncerrado;
  const encerrado = new Promise((resolve) => { resolverEncerrado = resolve; });
  const fechar = () => new Promise((resolve) => {
    clearInterval(batimento);
    for (const res of clientesSse) { try { res.end(); } catch { /* já fechado */ } }
    clientesSse.clear();
    servidor.close(() => { resolverEncerrado(); resolve(); });
    servidor.closeAllConnections?.();
  });
  return { servidor, porta: servidorInfo.porta, host, url, token: tokenFinal, tokenGerado, fila, sessoes, fechar, encerrado, nomeHost: nomeDoHost(host) };
}
