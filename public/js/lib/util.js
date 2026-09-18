// Utilitários isomórficos: usados pelo gerador (Node) e pelo navegador.
// Não dependem de DOM nem de APIs do Node.

/** Remove acentos, baixa caixa e normaliza espaços. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens alfanuméricos (sem acento) de um texto. "T-Cross 2P" -> ["t","cross","2p"] */
export function tokens(texto) {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Tokens com hífens internos colapsados: "T-Cross CR-V" -> ["tcross","crv"] */
export function tokensCompactos(texto) {
  return normalizar(texto).replace(/([a-z0-9])-([a-z0-9])/g, '$1$2').split(/[^a-z0-9]+/).filter(Boolean);
}

/** Versão compacta só com letras e números: "FA01-A43" -> "fa01a43" */
export function compactar(texto) {
  return normalizar(texto).replace(/[^a-z0-9]/g, '');
}

/** Slug para URLs: "Máq. de vidro" -> "maq-de-vidro" */
export function slug(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

const MAPA_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para HTML (conteúdo e atributos com aspas duplas). */
export function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => MAPA_HTML[c]);
}

/** Junta segmentos de URL garantindo uma única barra entre eles. */
export function juntarUrl(...partes) {
  return partes
    .filter((p) => p !== undefined && p !== null && p !== '')
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(':/', '://');
}

/** "1 produto" / "12 produtos" */
export function plural(n, singular, pluralForma) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('pt-BR')} ${v === 1 ? singular : pluralForma}`;
}

/** Primeira letra maiúscula. */
export function capitalizar(texto) {
  const t = String(texto ?? '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Limita um texto a N caracteres, terminando com reticências. */
export function truncar(texto, max = 160) {
  const t = String(texto ?? '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Converte "64041" ou "66025-3" em algo seguro para usar como id de elemento. */
export function idSeguro(texto) {
  return String(texto ?? '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Valida um código de produto do catálogo (5-6 dígitos, sufixo opcional -N ou letra). */
export function codigoValido(codigo) {
  return /^\d{4,7}(?:-\d{1,2})?[a-z]?$/i.test(String(codigo ?? ''));
}
