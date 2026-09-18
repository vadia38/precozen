import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { construir, normalizarBase, normalizarUrl, lerArgs } from '../src/build.js';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'luretec-build-'));
let resumo;

before(() => { resumo = construir({ out, base: '/precozen/', url: 'https://exemplo.test/', data: '2026-09-18T00:00:00.000Z' }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

const ler = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');

test('normalizarBase, normalizarUrl e lerArgs', () => {
  assert.equal(normalizarBase(''), '/');
  assert.equal(normalizarBase('precozen'), '/precozen/');
  assert.equal(normalizarBase('/a//b'), '/a/b/');
  assert.throws(() => normalizarBase('/x y/'));
  assert.throws(() => normalizarBase('/../x/'));
  assert.throws(() => normalizarBase('/"><script>/'));
  assert.equal(normalizarUrl('https://catalogo.exemplo.com.br/'), 'https://catalogo.exemplo.com.br');
  assert.equal(normalizarUrl('http://localhost:4173'), 'http://localhost:4173');
  assert.throws(() => normalizarUrl('javascript:alert(1)'));
  assert.throws(() => normalizarUrl('https://exemplo.com/"onmouseover="x'));
  assert.deepEqual(lerArgs(['--base', '/x/', '--flag', '--out', 'dist2']), { base: '/x/', flag: true, out: 'dist2' });
});

test('gera todas as páginas esperadas', () => {
  assert.ok(resumo.paginas > 500, `só ${resumo.paginas} páginas`);
  for (const f of ['index.html', 'catalogo/index.html', 'categoria/botoes/index.html', 'categoria/botoes/vw/index.html', 'montadoras/index.html', 'montadora/vw/index.html', 'produto/64041/index.html', 'produto/66025-3/index.html', 'orcamento/index.html', 'sobre/index.html', '404.html', 'offline.html', 'sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js', 'api/produtos.json', 'api/categorias.json', 'api/montadoras.json', 'api/produtos.csv', 'img/produtos/64041.jpg', 'css/site.css', 'js/app.js', 'downloads/catalogo-luretec-2026.pdf']) {
    assert.ok(fs.existsSync(path.join(out, f)), `faltando ${f}`);
  }
});

test('HTML usa o base path, escapa conteúdo e não vaza placeholders', () => {
  const home = ler('index.html');
  assert.match(home, /<html lang="pt-BR" data-base="\/precozen\/">/);
  assert.match(home, /href="\/precozen\/css\/site\.css\?v=[a-f0-9]{10}"/);
  assert.match(home, /<link rel="canonical" href="https:\/\/exemplo\.test\/precozen\/">/);
  assert.doesNotMatch(home, /undefined|\[object Object\]|NaN/);
  const produto = ler('produto/64041/index.html');
  assert.match(produto, /<h1>Botão de vidro Uno simples 96\/97 - Âmbar<\/h1>/);
  assert.match(produto, /"@type":"Product"/);
  assert.match(produto, /og:image" content="https:\/\/exemplo\.test\/precozen\/img\/produtos\/64041\.jpg"/);
  const palheta = ler('produto/61068/index.html');
  assert.match(palheta, /Palheta 19&quot;/);
  assert.doesNotMatch(palheta, /Palheta 19"<\/h1>/);
  assert.doesNotMatch(ler('sw.js'), /__VERSAO__|__BASE__|__PRECACHE__/);
});

test('sitemap, robots, manifest e API são consistentes', () => {
  const sitemap = ler('sitemap.xml');
  const urls = sitemap.match(/<loc>/g).length;
  assert.ok(urls >= 481 + 11 + 3, `sitemap com ${urls} urls`);
  assert.doesNotMatch(sitemap, /orcamento\//);
  assert.match(ler('robots.txt'), /Sitemap: https:\/\/exemplo\.test\/precozen\/sitemap\.xml/);
  const manifest = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(manifest.scope, '/precozen/');
  const api = JSON.parse(ler('api/produtos.json'));
  assert.equal(api.total, 481);
  assert.equal(api.produtos[0].url, '/precozen/produto/64041/');
  assert.ok(api.produtos.every((p) => !('custo' in p) && !('preco' in p)), 'API não deve expor preço/custo');
  const csv = ler('api/produtos.csv');
  assert.equal(csv.split('\n').length, 481 + 2);
  assert.match(csv, /^﻿codigo;referencia;nome/);
});

test('orçamento é noindex e páginas de erro existem com base correto', () => {
  assert.match(ler('orcamento/index.html'), /<meta name="robots" content="noindex, follow">/);
  assert.match(ler('404.html'), /href="\/precozen\/catalogo\/"/);
});
