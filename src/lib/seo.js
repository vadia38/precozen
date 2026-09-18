// Sitemap, robots e dados estruturados (JSON-LD).
import { escapeHtml } from '../../public/js/lib/util.js';

export function sitemap(urls, dataIso) {
  const linhas = urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc><lastmod>${dataIso}</lastmod><changefreq>${u.freq || 'weekly'}</changefreq><priority>${u.prioridade ?? 0.5}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${linhas.join('\n')}\n</urlset>\n`;
}

export function robots(urlSitemap) {
  return `User-agent: *\nAllow: /\nDisallow: /orcamento/\n\nSitemap: ${urlSitemap}\n`;
}

/** Serializa JSON-LD com escape seguro para dentro de <script>. */
export function jsonLd(objeto) {
  const json = JSON.stringify(objeto).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
  return `<script type="application/ld+json">${json}</script>`;
}

export function ldOrganizacao(config, urlAbsoluta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.nome,
    url: config.siteOficial || urlAbsoluta(''),
    logo: urlAbsoluta('img/logo.png'),
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', telephone: `+${config.whatsapp.numero}`, availableLanguage: 'Portuguese' }],
  };
}

export function ldSite(config, urlAbsoluta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.titulo,
    url: urlAbsoluta(''),
    inLanguage: config.idioma,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${urlAbsoluta('catalogo/')}?q={termo}` },
      'query-input': 'required name=termo',
    },
  };
}

export function ldBreadcrumb(itens) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url })),
  };
}

export function ldProduto(p, config, urlAbsoluta) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nome,
    sku: p.codigo,
    category: p.categoriaNome,
    url: urlAbsoluta(`produto/${encodeURIComponent(p.codigo)}/`),
    description: descricaoProduto(p, config),
  };
  if (p.ref) ld.mpn = p.ref;
  if (p.imagem) ld.image = urlAbsoluta(`img/produtos/${p.imagem.arquivo}`);
  if (p.modelos.length) ld.isAccessoryOrSparePartFor = p.modelos.map((m) => ({ '@type': 'Product', name: m }));
  return ld;
}

export function descricaoProduto(p, config) {
  const partes = [`${p.nome} — código ${p.codigo}`];
  if (p.ref) partes.push(`referência ${p.ref}`);
  partes.push(`categoria ${p.categoriaNome}`);
  if (p.montadorasNome.length) partes.push(`para ${p.montadorasNome.join(', ')}`);
  return `${partes.join(', ')}. Peça o orçamento pelo WhatsApp ${config.whatsapp.exibicao}.`;
}
