// Gerador do blog estático: conteúdo → HTML, feed, sitemap, robots, API de posts e assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ_CENTRAL, workspace, gravarTexto, limparDir, listarArquivos } from '../core/arquivos.js';
import { dataIso, escapeHtml } from '../core/util.js';
import { carregarBlog, DIR_CONTEUDO } from './conteudo.js';
import { layout } from './layout.js';
import { todasPaginas } from './paginas.js';
import { sitemap, robots } from './seo.js';
import { feedRss } from './rss.js';

export function normalizarBase(base) {
  let b = String(base || '/').trim();
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  b = b.replace(/\/{2,}/g, '/');
  if (!/^[a-zA-Z0-9_\/-]+$/.test(b) || b.includes('..')) throw new Error(`base path inválido: "${base}"`);
  return b;
}

export function normalizarUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(u)) throw new Error(`URL do site inválida: "${url}"`);
  return u;
}

function versao(arquivos) {
  const h = crypto.createHash('sha1');
  for (const f of arquivos) if (fs.existsSync(f)) h.update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 10);
}

function favicon(config) {
  const { corPrimaria, corAcento } = config.marca.tema;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${corPrimaria}"/><text x="32" y="44" font-family="system-ui, Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${corAcento}">${escapeHtml(config.marca.nome[0].toUpperCase())}</text></svg>\n`;
}

/**
 * Constrói o blog. opcoes: { config, out, base, url, data, dirPosts, dirPaginas, rascunhos }
 */
export function construirBlog(opcoes = {}) {
  const inicio = Date.now();
  const { config } = opcoes;
  if (!config) throw new Error('config obrigatória');
  const base = normalizarBase(opcoes.base || process.env.BASE_PATH_BLOG || config.marca.basePath || '/');
  const url = normalizarUrl(opcoes.url || process.env.SITE_URL_BLOG || config.marca.url);
  const out = path.resolve(opcoes.out || workspace('blog', 'dist'));
  const hoje = opcoes.data ? new Date(opcoes.data) : new Date();
  const blog = carregarBlog({ dirPosts: opcoes.dirPosts, dirPaginas: opcoes.dirPaginas, rascunhos: Boolean(opcoes.rascunhos) });
  if (blog.erros.length) {
    const e = new Error(`conteúdo inválido:\n - ${blog.erros.join('\n - ')}`);
    e.erros = blog.erros;
    throw e;
  }
  const templates = path.join(RAIZ_CENTRAL, 'templates');
  const ver = versao([path.join(templates, 'blog.css'), path.join(templates, 'blog.js'), path.join(templates, 'tema.js'), config._arquivo].filter(Boolean));
  const urlAbs = (rel = '') => `${url}${base}${String(rel).replace(/^\/+/, '')}`;
  const ctx = { config, blog, base, url, ver, urlAbs, dataIso: dataIso(hoje) };

  limparDir(out);
  fs.mkdirSync(path.join(out, 'css'), { recursive: true });
  fs.mkdirSync(path.join(out, 'js'), { recursive: true });
  fs.copyFileSync(path.join(templates, 'blog.css'), path.join(out, 'css', 'blog.css'));
  fs.copyFileSync(path.join(templates, 'blog.js'), path.join(out, 'js', 'blog.js'));
  fs.copyFileSync(path.join(templates, 'tema.js'), path.join(out, 'js', 'tema.js'));
  const dirImg = path.join(DIR_CONTEUDO, 'img');
  if (fs.existsSync(dirImg)) fs.cpSync(dirImg, path.join(out, 'img'), { recursive: true });
  gravarTexto(path.join(out, 'favicon.svg'), favicon(config));
  gravarTexto(path.join(out, 'css', 'tema.css'), `:root{--cor-primaria:${config.marca.tema.corPrimaria};--cor-acento:${config.marca.tema.corAcento}}\n`);

  const paginas = todasPaginas(ctx);
  const vistos = new Set();
  for (const pg of paginas) {
    if (vistos.has(pg.caminho)) throw new Error(`caminho duplicado: ${pg.caminho}`);
    vistos.add(pg.caminho);
    const destino = pg.caminho.endsWith('.html') ? path.join(out, pg.caminho) : path.join(out, pg.caminho, 'index.html');
    gravarTexto(destino, layout(ctx, pg.html));
  }
  const indexaveis = paginas.filter((p) => p.prioridade !== null && p.prioridade !== undefined && !p.html.noindex).map((p) => ({ loc: urlAbs(p.caminho), prioridade: p.prioridade, freq: p.freq, lastmod: p.lastmod }));
  gravarTexto(path.join(out, 'sitemap.xml'), sitemap(indexaveis, ctx.dataIso));
  gravarTexto(path.join(out, 'robots.txt'), robots(urlAbs('sitemap.xml')));
  gravarTexto(path.join(out, 'feed.xml'), feedRss({ config, posts: blog.posts, urlAbs }));
  gravarTexto(path.join(out, 'api', 'posts.json'), JSON.stringify({ geradoEm: ctx.dataIso, total: blog.posts.length, posts: blog.posts.map((p) => ({ titulo: p.titulo, slug: p.slug, url: `${base}${p.url}`, tipo: p.tipo, categoria: p.categoria, categoriaNome: p.categoriaNome, descricao: p.descricao, data: p.data, nota: p.nota ?? null, preco: p.preco || null, moeda: p.moeda || 'BRL', imagem: p.imagem || null, tags: p.tags, minutos: p.minutos, produtoNome: p.produtoNome || null, marca: p.marca || null })) }));
  gravarTexto(path.join(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/css/*\n  Cache-Control: public, max-age=31536000, immutable\n/js/*\n  Cache-Control: public, max-age=31536000, immutable\n# Pré-visualização em workers.dev fora dos buscadores (o domínio próprio é indexado normalmente)\nhttps://:worker.:subdomain.workers.dev/*\n  X-Robots-Tag: noindex\n`);
  return { paginas: paginas.length, posts: blog.posts.length, categorias: blog.categorias.length, base, url, versao: ver, saida: out, ms: Date.now() - inicio };
}

export function listarSaida(out) {
  return listarArquivos(out).map((f) => path.relative(out, f));
}
