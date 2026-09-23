// SEO do blog: sitemap, robots e JSON-LD (WebSite, Organization, Article, Product/Review, Breadcrumb, ItemList).
import { escapeHtml } from '../core/util.js';

export function sitemap(urls, dataIso) {
  const linhas = urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc><lastmod>${u.lastmod || dataIso}</lastmod><changefreq>${u.freq || 'weekly'}</changefreq><priority>${u.prioridade ?? 0.5}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${linhas.join('\n')}\n</urlset>\n`;
}

export function robots(urlSitemap) {
  return `User-agent: *\nAllow: /\nDisallow: /busca/\n\nSitemap: ${urlSitemap}\n`;
}

export function jsonLd(objeto) {
  const json = JSON.stringify(objeto).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
  return `<script type="application/ld+json">${json}</script>`;
}

export function ldSite(config, urlAbs) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: config.marca.nome, url: urlAbs(''), inLanguage: config.marca.idioma, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${urlAbs('busca/')}?q={termo}` }, 'query-input': 'required name=termo' } };
}

export function ldOrganizacao(config, urlAbs) {
  return { '@context': 'https://schema.org', '@type': 'Organization', name: config.marca.nome, url: urlAbs(''), logo: urlAbs('favicon.svg'), ...(config.marca.email ? { email: config.marca.email } : {}) };
}

export function ldBreadcrumb(itens) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: itens.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url })) };
}

export function ldArtigo(post, config, urlAbs) {
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline: post.titulo, description: post.descricao, datePublished: post.data, dateModified: post.atualizado || post.data,
    inLanguage: config.marca.idioma, mainEntityOfPage: urlAbs(post.url), wordCount: post.palavras,
    author: { '@type': 'Organization', name: post.autor || config.marca.autor || config.marca.nome }, publisher: { '@type': 'Organization', name: config.marca.nome, logo: { '@type': 'ImageObject', url: urlAbs('favicon.svg') } },
    ...(post.imagem ? { image: post.imagem } : {}), ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  };
}

/** Product + Review com a nota editorial (0–10). Não copia notas do marketplace como AggregateRating. */
export function ldReviewProduto(post, config, urlAbs) {
  if (post.tipo !== 'review' || !post.produtoNome) return null;
  const produto = { '@type': 'Product', name: post.produtoNome, ...(post.marca ? { brand: { '@type': 'Brand', name: post.marca } } : {}), ...(post.imagem ? { image: post.imagem } : {}) };
  if (post.preco) produto.offers = { '@type': 'Offer', price: Number(post.preco), priceCurrency: post.moeda || 'BRL', url: post.url ? urlAbs(post.url) : undefined, availability: 'https://schema.org/InStock' };
  return {
    '@context': 'https://schema.org', '@type': 'Review', itemReviewed: produto, name: post.titulo, datePublished: post.data,
    author: { '@type': 'Organization', name: post.autor || config.marca.autor || config.marca.nome }, publisher: { '@type': 'Organization', name: config.marca.nome },
    ...(post.nota !== undefined && post.nota !== '' ? { reviewRating: { '@type': 'Rating', ratingValue: Number(post.nota), bestRating: 10, worstRating: 0 } } : {}),
    ...(post.pros?.length ? { positiveNotes: { '@type': 'ItemList', itemListElement: post.pros.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p })) } } : {}),
    ...(post.contras?.length ? { negativeNotes: { '@type': 'ItemList', itemListElement: post.contras.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p })) } } : {}),
  };
}

export function ldListaPosts(posts, urlAbs) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: urlAbs(p.url), name: p.titulo })) };
}
