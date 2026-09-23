// Cliente HTTP mínimo sobre fetch: timeout, novas tentativas com espera exponencial e JSON.
export class ErroHttp extends Error {
  constructor(mensagem, { status, corpo, url } = {}) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.corpo = corpo;
    this.url = url;
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * requisitar(url, { metodo, cabecalhos, corpo, timeoutMs, tentativas, fetchImpl })
 * Devolve { status, cabecalhos, texto, json } — json só quando o content-type for JSON.
 */
export async function requisitar(url, opcoes = {}) {
  const { metodo = 'GET', cabecalhos = {}, corpo, timeoutMs = 20000, tentativas = 3, fetchImpl = globalThis.fetch } = opcoes;
  if (typeof fetchImpl !== 'function') throw new Error('fetch indisponível (use Node 20+)');
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetchImpl(url, {
        method: metodo,
        headers: { 'user-agent': 'precozen-central/0.1 (+https://github.com/vadia38/precozen)', accept: 'application/json, text/plain;q=0.8, */*;q=0.5', ...cabecalhos },
        body: corpo,
        signal: ctrl.signal,
      });
      const texto = await resp.text();
      const tipo = resp.headers.get('content-type') || '';
      let json;
      if (/json/i.test(tipo)) { try { json = JSON.parse(texto); } catch { json = undefined; } }
      if (resp.status === 429 || resp.status >= 500) {
        ultimoErro = new ErroHttp(`HTTP ${resp.status} em ${url}`, { status: resp.status, corpo: texto.slice(0, 500), url });
        if (tentativa < tentativas) { await esperar(500 * 2 ** (tentativa - 1)); continue; }
        throw ultimoErro;
      }
      if (!resp.ok) throw new ErroHttp(`HTTP ${resp.status} em ${url}: ${texto.slice(0, 300)}`, { status: resp.status, corpo: texto.slice(0, 500), url });
      return { status: resp.status, cabecalhos: resp.headers, texto, json };
    } catch (e) {
      ultimoErro = e;
      const rede = e.name === 'AbortError' || e.name === 'TypeError' || /ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/.test(String(e.message));
      if (rede && tentativa < tentativas) { await esperar(500 * 2 ** (tentativa - 1)); continue; }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro;
}

export async function obterJson(url, opcoes) {
  const r = await requisitar(url, opcoes);
  if (r.json === undefined) throw new ErroHttp(`resposta não é JSON: ${url}`, { status: r.status, corpo: r.texto.slice(0, 300), url });
  return r.json;
}

export async function enviarJson(url, dados, opcoes = {}) {
  return obterJson(url, { ...opcoes, metodo: opcoes.metodo || 'POST', corpo: JSON.stringify(dados), cabecalhos: { 'content-type': 'application/json; charset=utf-8', ...(opcoes.cabecalhos || {}) } });
}
