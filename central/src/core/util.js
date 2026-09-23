// Utilitários de texto, número e data usados por todos os módulos. Sem dependências de DOM ou de rede.

/** Remove acentos, baixa caixa e normaliza espaços. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug para URLs e nomes de arquivo: "Máquina de vidro" -> "maquina-de-vidro". */
export function slug(texto, max = 80) {
  const s = normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s.slice(0, max).replace(/-+$/, '')) || 'item';
}

const MAPA_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para HTML (conteúdo e atributos com aspas duplas). */
export function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => MAPA_HTML[c]);
}

/** Escapa texto para XML/SVG. */
export const escapeXml = escapeHtml;

/** Limita um texto a N caracteres, terminando com reticências. */
export function truncar(texto, max = 160) {
  const t = String(texto ?? '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** "1 produto" / "12 produtos" */
export function plural(n, singular, pluralForma) {
  const v = Number(n) || 0;
  return `${formatarNumero(v)} ${v === 1 ? singular : pluralForma}`;
}

export function capitalizar(texto) {
  const t = String(texto ?? '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Primeira letra de cada palavra em maiúscula (para títulos curtos). */
export function tituloCaso(texto) {
  return String(texto ?? '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, sep, l) => sep + l.toUpperCase());
}

export function formatarNumero(n, casas = 0) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarMoeda(valor, moeda = 'BRL') {
  const v = Number(valor) || 0;
  const locale = moeda === 'BRL' ? 'pt-BR' : 'en-US';
  return v.toLocaleString(locale, { style: 'currency', currency: moeda, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatarPct(fracao, casas = 1) {
  return `${formatarNumero((Number(fracao) || 0) * 100, casas)}%`;
}

export function arredondar(n, casas = 2) {
  const f = 10 ** casas;
  return Math.round((Number(n) || 0) * f) / f;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

/** Converte "1.234,56", "R$ 99,90", "99.90" ou 99.9 em número (ou null). */
export function paraNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let s = String(valor ?? '').trim().replace(/[^\d,.\-]/g, '');
  if (!s) return null;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (temVirgula) s = s.replace(',', '.');
  else if (temPonto && /\.\d{3}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function paraInteiro(valor) {
  const n = paraNumero(valor);
  return n === null ? null : Math.round(n);
}

/** Verdadeiro para "sim", "1", "true", "x", "yes". */
export function paraBooleano(valor) {
  return /^(1|s|sim|true|x|yes|y|verdadeiro)$/i.test(String(valor ?? '').trim());
}

/** Data ISO (AAAA-MM-DD). */
export function dataIso(data = new Date()) {
  return new Date(data).toISOString().slice(0, 10);
}

/** Data por extenso em pt-BR: "23 de setembro de 2026". */
export function dataExtenso(data = new Date()) {
  const d = new Date(data);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Converte segundos/minutos em texto legível. */
export function duracao(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}

/** Divide uma lista de valores separados por vírgula ou ponto e vírgula, ignorando vazios. */
export function lista(valor) {
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean);
  const s = String(valor ?? '');
  const sep = /[;\n]/.test(s) ? /[;\n]/ : /,/; // ponto e vírgula/linha têm prioridade: vírgulas podem ser decimais ("5,5 L")
  return s.split(sep).map((v) => v.trim()).filter(Boolean);
}

/** Quebra um texto em linhas de no máximo `max` caracteres, respeitando palavras. */
export function quebrarLinhas(texto, max = 40) {
  const linhas = [];
  for (const paragrafo of String(texto ?? '').split(/\n/)) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      if (!atual) atual = palavra;
      else if ((atual + ' ' + palavra).length <= max) atual += ' ' + palavra;
      else { linhas.push(atual); atual = palavra; }
      while (atual.length > max) { linhas.push(atual.slice(0, max)); atual = atual.slice(max); }
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Conta palavras de um texto. */
export function contarPalavras(texto) {
  return String(texto ?? '').split(/\s+/).filter((p) => /\p{L}|\p{N}/u.test(p)).length;
}

/** Junta as partes de uma URL com uma única barra. */
export function juntarUrl(...partes) {
  return partes
    .filter((p) => p !== undefined && p !== null && p !== '')
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(':/', '://');
}

/** Garante que uma URL é http(s) simples; devolve null caso contrário. */
export function urlSegura(url) {
  const u = String(url ?? '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(u)) return null;
  try { return new URL(u).href; } catch { return null; }
}

/** Identificador curto e estável a partir de um texto (hash FNV-1a em base36). */
export function idCurto(texto, tamanho = 8) {
  let h = 0x811c9dc5;
  const s = String(texto ?? '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let out = h.toString(36);
  let h2 = h;
  while (out.length < tamanho) { h2 = Math.imul(h2 ^ (h2 >>> 13), 0x5bd1e995) >>> 0; out += h2.toString(36); }
  return out.slice(0, tamanho);
}

/** Ordena por uma ou mais chaves: ordenarPor(lista, ['-score', 'nome']). */
export function ordenarPor(itens, chaves) {
  const regras = [].concat(chaves).map((k) => (k.startsWith('-') ? [k.slice(1), -1] : [k, 1]));
  return [...itens].sort((a, b) => {
    for (const [k, dir] of regras) {
      const va = a[k]; const vb = b[k];
      if (va === vb) continue;
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR') * dir;
    }
    return 0;
  });
}

/** Agrupa itens por chave. */
export function agrupar(itens, chave) {
  const m = new Map();
  for (const it of itens) {
    const k = typeof chave === 'function' ? chave(it) : it[chave];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

export function soma(itens, chave) {
  return itens.reduce((acc, it) => acc + (Number(typeof chave === 'function' ? chave(it) : it[chave]) || 0), 0);
}

export function media(itens, chave) {
  return itens.length ? soma(itens, chave) / itens.length : 0;
}
