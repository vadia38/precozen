// Programas de afiliados: taxas de comissão de referência, categorias canônicas e montagem de links.
import path from 'node:path';
import { RAIZ_CENTRAL, lerJson } from '../core/arquivos.js';
import { normalizar, slug, urlSegura } from '../core/util.js';

let cacheProgramas;
let cacheCategorias;

export function programas() {
  if (!cacheProgramas) {
    const dados = lerJson(path.join(RAIZ_CENTRAL, 'data', 'programas.json'));
    cacheProgramas = Object.fromEntries(Object.entries(dados).filter(([k]) => !k.startsWith('_')));
  }
  return cacheProgramas;
}

export function categoriasCanonicas() {
  if (!cacheCategorias) {
    const dados = lerJson(path.join(RAIZ_CENTRAL, 'data', 'categorias-afiliados.json'));
    cacheCategorias = Object.fromEntries(Object.entries(dados).filter(([k]) => !k.startsWith('_')));
  }
  return cacheCategorias;
}

/** Resolve uma categoria livre ("Fone de ouvido bluetooth", "Casa & Cozinha") para o id canônico. */
export function resolverCategoria(texto) {
  const cats = categoriasCanonicas();
  const n = normalizar(texto);
  if (!n) return 'outros';
  if (cats[n]) return n;
  const s = slug(n);
  if (cats[s]) return s;
  for (const [id, c] of Object.entries(cats)) {
    if (c.sinonimos.some((sin) => n === normalizar(sin))) return id;
  }
  // Casamento parcial: sinônimo contido no texto (o mais longo vence)
  let melhor = null;
  for (const [id, c] of Object.entries(cats)) {
    for (const sin of c.sinonimos) {
      const ns = normalizar(sin);
      if (ns.length >= 3 && n.includes(ns) && (!melhor || ns.length > melhor.tam)) melhor = { id, tam: ns.length };
    }
  }
  return melhor ? melhor.id : 'outros';
}

export function nomeCategoria(id) {
  return categoriasCanonicas()[id]?.nome || id;
}

/** Taxa de comissão (fração) para um produto: a informada, senão a da categoria no programa, senão o padrão. */
export function taxaComissao(programaId, categoriaId, informada) {
  if (informada !== null && informada !== undefined && Number.isFinite(Number(informada))) {
    let t = Number(informada);
    if (t > 1) t /= 100; // aceita "8" ou "8%" como 8%
    return Math.max(0, Math.min(1, t));
  }
  const p = programas()[programaId];
  if (!p) return 0.05;
  return p.categorias?.[categoriaId] ?? p.padrao ?? 0.05;
}

/** Monta o link de afiliado quando o programa permite (Amazon por ASIN + tag; Magalu por slug + loja). */
export function montarLink(programaId, identificador, configProgramas = {}, linkInformado) {
  const seguro = urlSegura(linkInformado);
  if (seguro) return seguro;
  const p = programas()[programaId];
  const cfg = configProgramas[programaId] || {};
  if (!p || !p.link || !identificador) return null;
  const id = String(identificador).trim();
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) return null;
  let url = p.link.replace('{id}', encodeURIComponent(id));
  if (url.includes('{tag}')) { if (!cfg.tag) return null; url = url.replace('{tag}', encodeURIComponent(cfg.tag)); }
  if (url.includes('{loja}')) { if (!cfg.loja) return null; url = url.replace('{loja}', encodeURIComponent(cfg.loja)); }
  return url;
}

/** URL "limpa" do produto (sem tag), para citação e para o JSON-LD. */
export function urlProduto(programaId, identificador, urlInformada) {
  const seguro = urlSegura(urlInformada);
  if (seguro) return seguro;
  const p = programas()[programaId];
  if (!p || !identificador) return null;
  if (programaId.startsWith('amazon')) return `https://${p.dominio}/dp/${encodeURIComponent(identificador)}`;
  return null;
}

export function moedaPrograma(programaId) {
  return programas()[programaId]?.moeda || 'BRL';
}
