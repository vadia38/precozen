// Sessões do painel administrativo: token de acesso, cookie de sessão, limite de tentativas e verificações anti-CSRF.
import crypto from 'node:crypto';
import net from 'node:net';

export const NOME_COOKIE = 'precozen_painel';
const DURACAO_PADRAO = 12 * 60 * 60 * 1000;

export function gerarToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function resumo(v) {
  return crypto.createHash('sha256').update(String(v)).digest();
}

/** Comparação em tempo constante (compara os hashes, para tamanhos diferentes não vazarem). */
export function igualSeguro(a, b) {
  return crypto.timingSafeEqual(resumo(a), resumo(b));
}

export function lerCookies(cabecalho) {
  const out = {};
  for (const par of String(cabecalho || '').split(';')) {
    const i = par.indexOf('=');
    if (i < 0) continue;
    const k = par.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(par.slice(i + 1).trim()); } catch { out[k] = par.slice(i + 1).trim(); }
  }
  return out;
}

export class Sessoes {
  constructor({ token, duracaoMs = DURACAO_PADRAO, maxTentativas = 10, janelaMs = 60_000 } = {}) {
    if (!token || String(token).length < 16) throw new Error('o token do painel precisa ter pelo menos 16 caracteres');
    this.token = String(token);
    this.duracaoMs = duracaoMs;
    this.maxTentativas = maxTentativas;
    this.janelaMs = janelaMs;
    this.sessoes = new Map();
    this.tentativas = new Map();
  }

  tokenValido(candidato) {
    return typeof candidato === 'string' && candidato.length > 0 && igualSeguro(candidato, this.token);
  }

  bloqueado(origem) {
    const t = this.tentativas.get(origem);
    if (!t) return false;
    if (Date.now() - t.inicio > this.janelaMs) { this.tentativas.delete(origem); return false; }
    return t.n >= this.maxTentativas;
  }

  registrarFalha(origem) {
    const agora = Date.now();
    const t = this.tentativas.get(origem);
    if (!t || agora - t.inicio > this.janelaMs) this.tentativas.set(origem, { inicio: agora, n: 1 });
    else t.n++;
  }

  /** Troca um token pela sessão. Devolve { ok, id } ou { ok: false, bloqueado }. */
  autenticar(candidato, origem = 'local') {
    if (this.bloqueado(origem)) return { ok: false, bloqueado: true };
    if (!this.tokenValido(candidato)) { this.registrarFalha(origem); return { ok: false, bloqueado: this.bloqueado(origem) }; }
    this.tentativas.delete(origem);
    return { ok: true, id: this.criar() };
  }

  criar() {
    const id = gerarToken(32);
    this.sessoes.set(id, { criadoEm: Date.now(), ultimoUso: Date.now() });
    return id;
  }

  validar(id) {
    if (!id || typeof id !== 'string') return false;
    const s = this.sessoes.get(id);
    if (!s) return false;
    if (Date.now() - s.ultimoUso > this.duracaoMs) { this.sessoes.delete(id); return false; }
    s.ultimoUso = Date.now();
    return true;
  }

  remover(id) {
    this.sessoes.delete(id);
  }

  cookie(id) {
    return `${NOME_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(this.duracaoMs / 1000)}`;
  }

  cookieLimpo() {
    return `${NOME_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  }
}

/** Nome do host sem porta nem colchetes de IPv6. */
export function nomeDoHost(host) {
  const h = String(host || '').trim().toLowerCase();
  const m = h.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (m) return m[1];
  return h.replace(/:\d+$/, '');
}

/**
 * Verificações contra DNS rebinding e CSRF. Devolve null quando a requisição pode seguir, ou o motivo da recusa.
 * `aceitarIps` libera qualquer IP literal no Host (para acesso na rede local); nomes de domínio só os da lista.
 * Requisições que alteram estado precisam do cabeçalho X-Precozen-Painel (não é enviado por formulários de outros sites)
 * e, quando o navegador informa Origin/Sec-Fetch-Site, eles precisam apontar para o próprio painel.
 */
export function verificarOrigem(req, { hostsPermitidos, aceitarIps = false }) {
  const host = String(req.headers.host || '').toLowerCase();
  const nome = nomeDoHost(host);
  if (!hostsPermitidos.has(nome) && !(aceitarIps && net.isIP(nome))) return `host não permitido: ${host || '(vazio)'}`;
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return null;
  if (req.headers['x-precozen-painel'] !== '1') return 'cabeçalho X-Precozen-Painel ausente';
  const origem = req.headers.origin;
  if (origem && origem !== 'null') {
    try { if (new URL(origem).host.toLowerCase() !== host) return `origem não permitida: ${origem}`; } catch { return 'origem inválida'; }
  } else if (origem === 'null') return 'origem opaca não permitida';
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return `requisição de outro site (${site})`;
  return null;
}
