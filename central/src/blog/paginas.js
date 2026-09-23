// Páginas do blog: início, post, categoria, comparativos, busca, páginas fixas e 404.
import { escapeHtml, formatarNumero, dataExtenso, plural } from '../core/util.js';
import { breadcrumb, gradePosts, caixaProduto, sumario, tituloSecao, icone } from './layout.js';
import { jsonLd, ldSite, ldOrganizacao, ldBreadcrumb, ldArtigo, ldReviewProduto, ldListaPosts } from './seo.js';

export function paginaInicio(ctx) {
  const { base, config, blog, urlAbs } = ctx;
  const ultimos = blog.posts.slice(0, config.blog.postsPorPagina || 12);
  const comparativos = blog.posts.filter((p) => p.tipo === 'comparativo').slice(0, 3);
  const destaque = blog.posts.find((p) => p.tipo === 'review') || blog.posts[0];
  const corpo = `<section class="hero"><div class="container hero__inner">
  <p class="eyebrow">Análises independentes</p>
  <h1>${escapeHtml(config.marca.slogan)}</h1>
  <p class="hero__sub">${escapeHtml(config.marca.descricao)}</p>
  <form class="hero__busca" role="search" action="${base}busca/" method="get"><label class="sr-only" for="q-hero">Buscar</label>${icone('search')}<input id="q-hero" name="q" type="search" placeholder="Ex.: air fryer, cadeira ergonômica, fone bluetooth…" maxlength="80" autocomplete="off"><button type="submit" class="botao botao--primario">Buscar</button></form>
  <div class="hero__chips">${blog.categorias.slice(0, 8).map((c) => `<a class="chip" href="${base}${c.url}">${escapeHtml(c.nome)}<small>${c.total}</small></a>`).join('')}</div>
</div></section>
${destaque ? `<section class="secao container">${tituloSecao('Em destaque')}${gradePosts(ctx, [destaque], { destaque: true })}</section>` : ''}
<section class="secao container">${tituloSecao('Últimas análises', { sub: `${plural(blog.posts.length, 'artigo publicado', 'artigos publicados')}` })}${gradePosts(ctx, ultimos)}</section>
${comparativos.length ? `<section class="secao secao--suave"><div class="container">${tituloSecao('Comparativos', { url: `${base}comparativos/`, rotuloUrl: 'Todos os comparativos', sub: 'Os melhores de cada categoria, lado a lado.' })}${gradePosts(ctx, comparativos)}</div></section>` : ''}
<section class="secao container metodologia"><h2>Como avaliamos</h2><p>${escapeHtml(config.blog.metodologia)}</p><p>${escapeHtml(config.blog.divulgacao)} <a href="${base}divulgacao/">Saiba mais</a>.</p></section>`;
  return { caminho: '', prioridade: 1, freq: 'daily', html: { titulo: null, tituloCompleto: `${config.marca.nome} — ${config.marca.slogan}`, descricao: config.marca.descricao, caminho: '', corpo, classe: 'pagina-inicio', jsonld: [jsonLd(ldSite(config, urlAbs)), jsonLd(ldOrganizacao(config, urlAbs))] } };
}

export function paginaPost(ctx, p) {
  const { base, config, blog, urlAbs } = ctx;
  const relacionados = blog.posts.filter((o) => o.slug !== p.slug && o.categoria === p.categoria).slice(0, 3);
  const relacionadosFinal = relacionados.length ? relacionados : blog.posts.filter((o) => o.slug !== p.slug).slice(0, 3);
  const corpo = `<article class="post">
  <header class="post__cabecalho container">
    ${breadcrumb(ctx, [{ nome: p.categoriaNome, url: `${base}categoria/${p.categoria}/` }, { nome: p.titulo }])}
    <p class="eyebrow">${p.tipo === 'comparativo' ? 'Comparativo' : p.tipo === 'review' ? 'Análise' : 'Artigo'} · ${escapeHtml(p.categoriaNome)}</p>
    <h1>${escapeHtml(p.titulo)}</h1>
    <p class="post__meta"><span>Por ${escapeHtml(p.autor || config.marca.autor)}</span><time datetime="${escapeHtml(p.data)}">${dataExtenso(p.data)}</time>${p.atualizado && p.atualizado !== p.data ? `<span>atualizado em ${dataExtenso(p.atualizado)}</span>` : ''}<span>${icone('clock')} ${p.minutos} min de leitura</span></p>
  </header>
  <div class="container post__grade">
    <div class="post__conteudo">
      ${caixaProduto(p)}
      ${sumario(p.titulos)}
      <div class="prosa">${p.html}</div>
      <p class="post__tags">${(p.tags || []).map((t) => `<span class="tag">${icone('tag')}${escapeHtml(t)}</span>`).join('')}</p>
      <div class="aviso-afiliado"><p>${escapeHtml(config.blog.divulgacao)} <a href="${base}divulgacao/">Entenda como funciona</a>.</p></div>
    </div>
    <aside class="post__lateral">
      <div class="lateral__bloco"><h2>Sobre o ${escapeHtml(config.marca.nome)}</h2><p>${escapeHtml(config.blog.metodologia)}</p></div>
      ${relacionadosFinal.length ? `<div class="lateral__bloco"><h2>Leia também</h2><ul class="lista-links">${relacionadosFinal.map((o) => `<li><a href="${base}${o.url}">${escapeHtml(o.titulo)}</a></li>`).join('')}</ul></div>` : ''}
    </aside>
  </div>
</article>
${relacionadosFinal.length ? `<section class="secao secao--suave"><div class="container">${tituloSecao('Relacionados')}${gradePosts(ctx, relacionadosFinal)}</div></section>` : ''}`;
  const jsonld = [jsonLd(ldArtigo(p, config, urlAbs)), jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, { nome: p.categoriaNome, url: urlAbs(`categoria/${p.categoria}/`) }, { nome: p.titulo, url: urlAbs(p.url) }]))];
  const review = ldReviewProduto(p, config, urlAbs);
  if (review) jsonld.push(jsonLd(review));
  return { caminho: p.url, prioridade: 0.8, freq: 'weekly', lastmod: p.atualizado || p.data, html: { titulo: p.titulo, descricao: p.descricao, caminho: p.url, corpo, classe: `pagina-post tipo-${p.tipo}`, ogTipo: 'article', ogImagem: p.imagem || undefined, jsonld } };
}

export function paginaCategoria(ctx, c) {
  const { base, config, urlAbs } = ctx;
  const corpo = `<section class="cabecalho-pagina"><div class="container">${breadcrumb(ctx, [{ nome: c.nome }])}<p class="eyebrow">Categoria</p><h1>${escapeHtml(c.nome)}</h1><p>${plural(c.total, 'análise', 'análises')} sobre ${escapeHtml(c.nome.toLowerCase())}.</p></div></section>
<section class="secao container">${gradePosts(ctx, c.posts)}</section>`;
  return { caminho: c.url, prioridade: 0.6, freq: 'weekly', html: { titulo: `${c.nome} — análises e comparativos`, descricao: `Análises, comparativos e guias de compra de ${c.nome.toLowerCase()} no ${config.marca.nome}.`, caminho: c.url, corpo, classe: 'pagina-categoria', jsonld: [jsonLd(ldListaPosts(c.posts, urlAbs))] } };
}

export function paginaComparativos(ctx) {
  const { blog, config, urlAbs } = ctx;
  const lista = blog.posts.filter((p) => p.tipo === 'comparativo');
  const corpo = `<section class="cabecalho-pagina"><div class="container">${breadcrumb(ctx, [{ nome: 'Comparativos' }])}<h1>Comparativos</h1><p>Os melhores produtos de cada categoria, lado a lado, com preço, avaliações e nota.</p></div></section>
<section class="secao container">${lista.length ? gradePosts(ctx, lista) : '<p class="vazio">Ainda não há comparativos publicados.</p>'}</section>`;
  return { caminho: 'comparativos/', prioridade: 0.7, freq: 'weekly', html: { titulo: 'Comparativos', descricao: `Comparativos dos melhores produtos por categoria no ${config.marca.nome}.`, caminho: 'comparativos/', corpo, classe: 'pagina-comparativos', jsonld: [jsonLd(ldListaPosts(lista, urlAbs))] } };
}

export function paginaBusca(ctx) {
  const { base } = ctx;
  const corpo = `<section class="cabecalho-pagina"><div class="container">${breadcrumb(ctx, [{ nome: 'Busca' }])}<h1>Buscar</h1>
<form class="hero__busca" role="search" action="${base}busca/" method="get" data-busca><label class="sr-only" for="q">Buscar</label>${icone('search')}<input id="q" name="q" type="search" placeholder="Produto, marca ou categoria" maxlength="80" autocomplete="off"><button type="submit" class="botao botao--primario">Buscar</button></form>
<p class="busca__status" data-busca-status aria-live="polite"></p></div></section>
<section class="secao container"><div class="grade" data-busca-resultados></div><noscript><p>A busca precisa de JavaScript. Navegue pelas <a href="${base}">categorias</a>.</p></noscript></section>`;
  return { caminho: 'busca/', prioridade: null, html: { titulo: 'Busca', descricao: 'Busque análises e comparativos.', caminho: 'busca/', corpo, classe: 'pagina-busca', noindex: true } };
}

export function paginaFixa(ctx, pg) {
  const corpo = `<section class="cabecalho-pagina"><div class="container">${breadcrumb(ctx, [{ nome: pg.titulo }])}<h1>${escapeHtml(pg.titulo)}</h1></div></section>
<section class="secao container container--estreito"><div class="prosa">${pg.html}</div></section>`;
  return { caminho: pg.url, prioridade: pg.noindex ? null : 0.4, freq: 'monthly', html: { titulo: pg.titulo, descricao: pg.descricao || `${pg.titulo} — ${ctx.config.marca.nome}`, caminho: pg.url, corpo, classe: 'pagina-fixa', noindex: pg.noindex } };
}

export function pagina404(ctx) {
  const { base } = ctx;
  const corpo = `<section class="secao container container--estreito centro"><h1>Página não encontrada</h1><p>O endereço pode ter mudado. Tente a <a href="${base}busca/">busca</a> ou volte ao <a href="${base}">início</a>.</p></section>`;
  return { caminho: '404.html', prioridade: null, html: { titulo: 'Página não encontrada', caminho: '404.html', corpo, classe: 'pagina-erro', noindex: true } };
}

export function todasPaginas(ctx) {
  const { blog } = ctx;
  return [
    paginaInicio(ctx),
    ...blog.posts.map((p) => paginaPost(ctx, p)),
    ...blog.categorias.map((c) => paginaCategoria(ctx, c)),
    paginaComparativos(ctx),
    paginaBusca(ctx),
    ...blog.paginas.map((pg) => paginaFixa(ctx, pg)),
    pagina404(ctx),
  ];
}
