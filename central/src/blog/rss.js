// Feed RSS 2.0 com os últimos posts.
import { escapeHtml } from '../core/util.js';

const rfc822 = (iso) => new Date(`${iso}T12:00:00Z`).toUTCString();

export function feedRss({ config, posts, urlAbs, maximo = 20 }) {
  const itens = posts.slice(0, maximo).map((p) => `  <item>
    <title>${escapeHtml(p.titulo)}</title>
    <link>${escapeHtml(urlAbs(p.url))}</link>
    <guid isPermaLink="true">${escapeHtml(urlAbs(p.url))}</guid>
    <pubDate>${rfc822(p.data)}</pubDate>
    <category>${escapeHtml(p.categoriaNome)}</category>
    <description>${escapeHtml(p.descricao)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeHtml(config.marca.nome)}</title>
  <link>${escapeHtml(urlAbs(''))}</link>
  <atom:link href="${escapeHtml(urlAbs('feed.xml'))}" rel="self" type="application/rss+xml"/>
  <description>${escapeHtml(config.marca.descricao)}</description>
  <language>${escapeHtml(config.marca.idioma.toLowerCase())}</language>
${itens}
</channel>
</rss>
`;
}
