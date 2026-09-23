import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-blog-'));
process.env.PRECOZEN_WORKSPACE = ws;
const { carregarConfig } = await import('../src/core/config.js');
const { markdownParaHtml, markdownParaTexto, tempoLeitura } = await import('../src/blog/markdown.js');
const { construirBlog, normalizarBase } = await import('../src/blog/build.js');
const { carregarBlog, validarPost } = await import('../src/blog/conteudo.js');
const { politicaCsp } = await import('../src/blog/layout.js');
const { serializar } = await import('../src/core/frontmatter.js');

const config = carregarConfig();
after(() => fs.rmSync(ws, { recursive: true, force: true }));

test('markdown: elementos suportados, escape e links de afiliado', () => {
  const md = '# Título <b>\n\nParágrafo com **negrito**, *itálico* e `código`. Link [oferta](https://x.com/a?b=1){:afiliado .botao} e [interno](/post/x/) e [ruim](javascript:alert(1)).\n\n> Citação\n\n- item 1\n- item 2\n\n1. um\n2. dois\n\n| A | B |\n|---|---:|\n| 1 | 2 |\n\n---\n\n```\ncode <x>\n```\n';
  const { html, titulos } = markdownParaHtml(md);
  assert.match(html, /<h1 id="titulo-b">Título &lt;b&gt;<\/h1>/);
  assert.match(html, /<strong>negrito<\/strong>/);
  assert.match(html, /<em>itálico<\/em>/);
  assert.match(html, /<code>código<\/code>/);
  assert.match(html, /<a href="https:\/\/x.com\/a\?b=1" class="botao link-afiliado" rel="sponsored nofollow noopener" target="_blank">oferta<\/a>/);
  assert.match(html, /<a href="\/post\/x\/">interno<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<blockquote><p>Citação<\/p><\/blockquote>/);
  assert.match(html, /<ul><li>item 1<\/li><li>item 2<\/li><\/ul>/);
  assert.match(html, /<ol><li>um<\/li><li>dois<\/li><\/ol>/);
  assert.match(html, /<th style="text-align:right">B<\/th>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<pre><code>code &lt;x&gt;<\/code><\/pre>/);
  assert.deepEqual(titulos.map((t) => t.texto), ['Título <b>']);
  assert.equal(markdownParaTexto('**a** [b](c)'), 'a b');
  assert.equal(tempoLeitura('palavra '.repeat(450)), 2);
});

test('validação de posts', () => {
  assert.deepEqual(validarPost({ titulo: 'x', slug: 'ok-1', data: '2026-01-01' }, 'a.md'), []);
  assert.ok(validarPost({ titulo: 'x', slug: 'Ruim Slug', data: '01/01/2026', link: 'ftp://x', nota: 12 }, 'a.md').length >= 4);
  assert.equal(normalizarBase('blog'), '/blog/');
  assert.throws(() => normalizarBase('/../x'));
});

test('build do blog com conteúdo próprio e CSP', () => {
  const posts = path.join(ws, 'posts');
  const paginas = path.join(ws, 'paginas');
  fs.mkdirSync(posts); fs.mkdirSync(paginas);
  fs.writeFileSync(path.join(posts, 'a.md'), serializar({ titulo: 'Review A', slug: 'review-a', tipo: 'review', data: '2026-09-01', categoria: 'cozinha', categoriaNome: 'Cozinha', produto: 'amazon-br:X', produtoNome: 'Produto A', marca: 'Marca', nota: 8.7, preco: 199.9, moeda: 'BRL', link: 'https://www.amazon.com.br/dp/X?tag=t', tags: ['a'], pros: ['bom'], contras: ['caro'] }, '## Seção 1\n\nTexto [oferta](https://www.amazon.com.br/dp/X?tag=t){:afiliado}\n\n## Seção 2\n\nMais\n\n## Seção 3\n\nFim'));
  fs.writeFileSync(path.join(posts, 'b.md'), serializar({ titulo: 'Melhores de Cozinha', slug: 'melhores-cozinha', tipo: 'comparativo', data: '2026-09-02', categoria: 'cozinha', categoriaNome: 'Cozinha', produtos: ['amazon-br:X'] }, 'Comparativo'));
  fs.writeFileSync(path.join(posts, 'rascunho.md'), serializar({ titulo: 'Rascunho', slug: 'rascunho', data: '2026-09-03', rascunho: true }, 'x'));
  fs.writeFileSync(path.join(paginas, 'sobre.md'), serializar({ titulo: 'Sobre' }, 'Quem somos'));
  const out = path.join(ws, 'dist');
  const r = construirBlog({ config, out, base: '/blog/', url: 'https://exemplo.test', data: '2026-09-23', dirPosts: posts, dirPaginas: paginas });
  assert.equal(r.posts, 2);
  const ler = (f) => fs.readFileSync(path.join(out, f), 'utf8');
  const home = ler('index.html');
  assert.match(home, /<html lang="pt-BR" data-base="\/blog\/">/);
  assert.match(home, /Content-Security-Policy/);
  assert.doesNotMatch(home, /undefined|NaN|\[object Object\]/);
  const post = ler('post/review-a/index.html');
  assert.match(post, /"@type":"Review"/);
  assert.match(post, /"ratingValue":8.7/);
  assert.match(post, /rel="sponsored nofollow noopener"/);
  assert.match(post, /class="sumario"/);
  assert.match(post, /<link rel="canonical" href="https:\/\/exemplo.test\/blog\/post\/review-a\/">/);
  assert.doesNotMatch(post, /Rascunho/);
  assert.match(ler('sitemap.xml'), /post\/review-a\//);
  assert.doesNotMatch(ler('sitemap.xml'), /busca\//);
  assert.match(ler('feed.xml'), /<item>/);
  assert.match(ler('robots.txt'), /Sitemap: https:\/\/exemplo.test\/blog\/sitemap.xml/);
  const api = JSON.parse(ler('api/posts.json'));
  assert.equal(api.total, 2);
  assert.ok(fs.existsSync(path.join(out, 'categoria/cozinha/index.html')));
  assert.ok(fs.existsSync(path.join(out, 'sobre/index.html')));
  assert.ok(fs.existsSync(path.join(out, 'css/tema.css')));
  assert.match(ler('busca/index.html'), /noindex/);
  assert.match(ler('_headers'), /workers\.dev\/\*\n\s+X-Robots-Tag: noindex/);
  assert.match(politicaCsp(config), /script-src 'self'; /);
  assert.match(politicaCsp({ ...config, blog: { ...config.blog, anuncios: { adsense: 'ca-pub-1' } } }), /googlesyndication/);
});

test('conteúdo real do repositório é válido', () => {
  const blog = carregarBlog();
  assert.deepEqual(blog.erros, []);
  assert.ok(blog.paginas.some((p) => p.slug === 'divulgacao'));
});
