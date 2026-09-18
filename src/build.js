#!/usr/bin/env node
// Gerador do site estático. Uso: node src/build.js [--base /] [--url https://…] [--out dist]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { carregarDados, RAIZ } from './lib/data.js';
import { layout } from './lib/html.js';
import { sitemap, robots } from './lib/seo.js';
import * as home from './pages/home.js';
import * as catalogo from './pages/catalogo.js';
import * as categoria from './pages/categoria.js';
import * as montadora from './pages/montadora.js';
import * as produto from './pages/produto.js';
import * as orcamento from './pages/orcamento.js';
import * as sobre from './pages/sobre.js';
import * as erros from './pages/erros.js';

export function lerArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const chave = a.slice(2);
      const valor = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[chave] = valor;
    }
  }
  return args;
}

export function normalizarBase(base) {
  let b = String(base || '/').trim();
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  b = b.replace(/\/{2,}/g, '/');
  if (!/^[a-zA-Z0-9_\/-]+$/.test(b) || b.includes('..')) throw new Error(`base path inválido: "${base}" (use só letras, números, "-" e "_")`);
  return b;
}

export function normalizarUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(u)) throw new Error(`URL do site inválida: "${url}" (ex.: https://catalogo.exemplo.com.br)`);
  return u;
}

function listarArquivos(dir) {
  const saida = [];
  if (!fs.existsSync(dir)) return saida;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) saida.push(...listarArquivos(p));
    else saida.push(p);
  }
  return saida.sort();
}

function versaoAssets() {
  const h = crypto.createHash('sha1');
  const alvos = [
    ...listarArquivos(path.join(RAIZ, 'public', 'css')),
    ...listarArquivos(path.join(RAIZ, 'public', 'js')),
    path.join(RAIZ, 'public', 'sw.js'),
    ...listarArquivos(path.join(RAIZ, 'data')),
    path.join(RAIZ, 'site.config.json'),
  ];
  for (const f of alvos) if (fs.existsSync(f)) h.update(f).update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 10);
}

function csv(produtos, urlAbs) {
  const cab = ['codigo', 'referencia', 'nome', 'categoria', 'subgrupo', 'montadoras', 'modelos', 'imagem', 'pagina_pdf', 'url'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = produtos.map((p) => [
    p.codigo, p.ref || '', p.nome, p.categoriaNome, p.subgrupoNome || '', p.montadorasNome.join(', '), p.modelos.join(', '),
    p.imagem ? urlAbs(`img/produtos/${p.imagem.arquivo}`) : '', p.pagina || '', urlAbs(`produto/${encodeURIComponent(p.codigo)}/`),
  ].map(esc).join(';'));
  return `﻿${cab.join(';')}\n${linhas.join('\n')}\n`;
}

function manifest(ctx) {
  const { base, config } = ctx;
  return JSON.stringify({
    name: config.titulo,
    short_name: config.nome,
    description: config.descricao,
    lang: config.idioma,
    start_url: `${base}?utm_source=pwa`,
    scope: base,
    id: base,
    display: 'standalone',
    orientation: 'any',
    background_color: config.tema.corPrimaria,
    theme_color: config.tema.corPrimaria,
    categories: ['shopping', 'business'],
    icons: [
      { src: `${base}img/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}img/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}img/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Catálogo completo', url: `${base}catalogo/`, icons: [{ src: `${base}img/icons/icon-192.png`, sizes: '192x192' }] },
      { name: 'Meu orçamento', url: `${base}orcamento/`, icons: [{ src: `${base}img/icons/icon-192.png`, sizes: '192x192' }] },
    ],
  }, null, 2);
}

export function construir(opcoes = {}) {
  const inicio = Date.now();
  const dados = carregarDados();
  const { config } = dados;
  const base = normalizarBase(opcoes.base || process.env.BASE_PATH || config.basePath || '/');
  const url = normalizarUrl(opcoes.url || process.env.SITE_URL || config.url);
  const out = path.resolve(RAIZ, opcoes.out || process.env.OUT_DIR || 'dist');
  const ver = versaoAssets();
  const dataIso = (opcoes.data || new Date().toISOString()).slice(0, 10);
  const urlAbs = (rel = '') => `${url}${base}${String(rel).replace(/^\/+/, '')}`;
  const ctx = { ...dados, base, url, ver, urlAbs, dataIso };

  // Limpa e copia assets estáticos
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(RAIZ, 'public'), out, { recursive: true });

  // Páginas
  const paginas = [
    ...home.paginas(ctx), ...catalogo.paginas(ctx), ...categoria.paginas(ctx), ...montadora.paginas(ctx),
    ...produto.paginas(ctx), ...orcamento.paginas(ctx), ...sobre.paginas(ctx), ...erros.paginas(ctx),
  ];
  const vistos = new Set();
  for (const pg of paginas) {
    if (vistos.has(pg.caminho)) throw new Error(`caminho duplicado: ${pg.caminho}`);
    vistos.add(pg.caminho);
    const html = layout(ctx, pg.html);
    const destino = pg.caminho.endsWith('.html') ? path.join(out, pg.caminho) : path.join(out, pg.caminho, 'index.html');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
  }

  // API pública (dados abertos)
  const api = path.join(out, 'api');
  fs.mkdirSync(api, { recursive: true });
  const produtosApi = dados.produtos.map((p) => ({ ...p, url: `${base}produto/${encodeURIComponent(p.codigo)}/`, imagem: p.imagem ? { ...p.imagem, url: `${base}img/produtos/${p.imagem.arquivo}` } : null }));
  fs.writeFileSync(path.join(api, 'produtos.json'), JSON.stringify({ geradoEm: dataIso, versao: ver, total: produtosApi.length, produtos: produtosApi }));
  fs.writeFileSync(path.join(api, 'categorias.json'), JSON.stringify({ geradoEm: dataIso, categorias: dados.categorias }));
  fs.writeFileSync(path.join(api, 'montadoras.json'), JSON.stringify({ geradoEm: dataIso, montadoras: dados.montadoras }));
  fs.writeFileSync(path.join(api, 'produtos.csv'), csv(dados.produtos, urlAbs));

  // SEO e PWA
  const indexaveis = paginas.filter((p) => p.prioridade !== null && !p.html.noindex).map((p) => ({ loc: urlAbs(p.caminho), prioridade: p.prioridade, freq: p.freq }));
  fs.writeFileSync(path.join(out, 'sitemap.xml'), sitemap(indexaveis, dataIso));
  fs.writeFileSync(path.join(out, 'robots.txt'), robots(urlAbs('sitemap.xml')));
  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), manifest(ctx));
  const precache = [base, `${base}catalogo/`, `${base}orcamento/`, `${base}offline.html`, `${base}css/site.css`, `${base}js/app.js`, `${base}js/catalogo.js`, `${base}js/produto.js`, `${base}js/orcamento.js`,
    `${base}js/lib/util.js`, `${base}js/lib/busca.js`, `${base}js/lib/card.js`, `${base}js/lib/orcamento.js`, `${base}img/logo.png`, `${base}img/icons/icon-192.png`, `${base}api/produtos.json`];
  const sw = fs.readFileSync(path.join(RAIZ, 'public', 'sw.js'), 'utf8')
    .replaceAll('__VERSAO__', ver).replaceAll('__BASE__', base).replaceAll('__PRECACHE__', JSON.stringify(precache));
  fs.writeFileSync(path.join(out, 'sw.js'), sw);

  const resumo = { paginas: paginas.length, produtos: dados.produtos.length, base, url, versao: ver, saida: out, ms: Date.now() - inicio };
  return resumo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = lerArgs(process.argv.slice(2));
  try {
    const r = construir(args);
    console.log(`✔ ${r.paginas} páginas (${r.produtos} produtos) geradas em ${r.saida} · base ${r.base} · ${r.url} · v${r.versao} · ${r.ms} ms`);
  } catch (e) {
    console.error(`✖ build falhou: ${e.message}`);
    process.exit(1);
  }
}
