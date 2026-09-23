// Conformidade de estampas e listagens: marcas registradas, termos proibidos/sensíveis e limites de caracteres.
import path from 'node:path';
import { RAIZ_CENTRAL, lerJson } from '../core/arquivos.js';
import { normalizar } from '../core/util.js';
import { LIMITES_MERCH, LIMITES_AMAZON } from './especificacoes.js';

let cache;
export function listas() {
  if (!cache) {
    const d = lerJson(path.join(RAIZ_CENTRAL, 'data', 'palavras-proibidas.json'));
    cache = Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, v.map(normalizar)]));
  }
  return cache;
}

function contem(texto, termo) {
  const t = ` ${normalizar(texto).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return t.includes(` ${termo.replace(/[^\p{L}\p{N}]+/gu, ' ')} `);
}

/** Verifica um texto livre. Devolve { erros, avisos, ok }. */
export function verificarTexto(texto, { contexto = 'texto' } = {}) {
  const l = listas();
  const erros = [];
  const avisos = [];
  for (const m of l.marcas) if (contem(texto, m)) erros.push(`${contexto}: possível marca registrada "${m}"`);
  for (const o of l.ofensivos) if (contem(texto, o)) erros.push(`${contexto}: termo ofensivo "${o}"`);
  for (const t of l.termos) if (contem(texto, t)) avisos.push(`${contexto}: termo desaconselhado "${t}"`);
  for (const s of l.sensiveis) if (contem(texto, s)) avisos.push(`${contexto}: tema sensível "${s}" (a Amazon costuma recusar)`);
  return { erros, avisos, ok: erros.length === 0 };
}

function limite(valor, max, rotulo, erros) {
  const n = String(valor ?? '').length;
  if (n > max) erros.push(`${rotulo} com ${n} caracteres (máximo ${max})`);
}

/** Listagem Merch by Amazon: marca (50), título (60), 2 bullets (256), descrição (2000). */
export function verificarListagemMerch({ marca = '', titulo = '', bullets = [], descricao = '', estampa = '' }) {
  const erros = [];
  const avisos = [];
  limite(marca, LIMITES_MERCH.marca, 'marca', erros);
  limite(titulo, LIMITES_MERCH.titulo, 'título', erros);
  if (bullets.length > LIMITES_MERCH.bullets) erros.push(`${bullets.length} bullets (máximo ${LIMITES_MERCH.bullets})`);
  bullets.forEach((b, i) => limite(b, LIMITES_MERCH.bullet, `bullet ${i + 1}`, erros));
  limite(descricao, LIMITES_MERCH.descricao, 'descrição', erros);
  if (!titulo) erros.push('título vazio');
  if (/\b(camiseta|t-shirt|shirt|tee)\b/i.test(marca)) avisos.push('marca não deve conter o tipo de produto');
  for (const [rotulo, txt] of [['marca', marca], ['título', titulo], ['bullets', bullets.join(' ')], ['descrição', descricao], ['estampa', estampa]]) {
    const r = verificarTexto(txt, { contexto: rotulo });
    erros.push(...r.erros); avisos.push(...r.avisos);
  }
  return { erros, avisos, ok: erros.length === 0 };
}

/** Listagem de produto na Amazon (Seller Central): título (200), 5 bullets (250), descrição (2000). */
export function verificarListagemAmazon({ titulo = '', bullets = [], descricao = '', palavrasChave = [] }) {
  const erros = [];
  const avisos = [];
  limite(titulo, LIMITES_AMAZON.titulo, 'título', erros);
  if (bullets.length > LIMITES_AMAZON.bullets) erros.push(`${bullets.length} bullets (máximo ${LIMITES_AMAZON.bullets})`);
  bullets.forEach((b, i) => limite(b, LIMITES_AMAZON.bullet, `bullet ${i + 1}`, erros));
  limite(descricao, LIMITES_AMAZON.descricao, 'descrição', erros);
  const bytes = Buffer.byteLength(palavrasChave.join(' '), 'utf8');
  if (bytes > LIMITES_AMAZON.palavrasChaveBytes) avisos.push(`palavras-chave com ${bytes} bytes (limite ${LIMITES_AMAZON.palavrasChaveBytes})`);
  if (/[!$?]{2,}|[A-Z]{12,}/.test(titulo)) avisos.push('título com pontuação repetida ou caixa alta em excesso');
  for (const [rotulo, txt] of [['título', titulo], ['bullets', bullets.join(' ')], ['descrição', descricao]]) {
    const r = verificarTexto(txt, { contexto: rotulo });
    erros.push(...r.erros); avisos.push(...r.avisos);
  }
  return { erros, avisos, ok: erros.length === 0 };
}
