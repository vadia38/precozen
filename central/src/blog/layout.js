// Layout do blog: documento HTML, cabeçalho, rodapé, cards e componentes reutilizados pelas páginas.
import { escapeHtml, formatarMoeda, formatarNumero, dataExtenso, truncar } from '../core/util.js';

export const ICONES = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3L2.8 9.7l6.4-.9z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  alerta: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
};

export function sprite() {
  return `<svg class="sprite" aria-hidden="true" focusable="false">${Object.entries(ICONES).map(([id, c]) => `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c}</symbol>`).join('')}</svg>`;
}

export function icone(nome, classe = 'icone') {
  if (!ICONES[nome]) throw new Error(`ícone desconhecido: ${nome}`);
  return `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#i-${nome}"></use></svg>`;
}

/** CSP restrita; com AdSense configurado, libera os domínios necessários. */
export function politicaCsp(config) {
  const ads = config.blog?.anuncios?.adsense;
  const scripts = ["'self'"];
  const frames = ["'none'"];
  const conexoes = ["'self'"];
  const imagens = ["'self'", 'data:', 'https:'];
  if (ads) {
    scripts.push('https://pagead2.googlesyndication.com', 'https://googleads.g.doubleclick.net', 'https://tpc.googlesyndication.com', 'https://www.googletagservices.com', 'https://adservice.google.com', 'https://fundingchoicesmessages.google.com');
    frames.splice(0, 1, 'https://googleads.g.doubleclick.net', 'https://tpc.googlesyndication.com', 'https://www.google.com');
    conexoes.push('https://pagead2.googlesyndication.com', 'https://googleads.g.doubleclick.net', 'https://ep1.adtrafficquality.google');
  }
  return [`default-src 'self'`, `img-src ${imagens.join(' ')}`, `script-src ${scripts.join(' ')}`, `style-src 'self'`, `font-src 'self'`, `connect-src ${conexoes.join(' ')}`, `frame-src ${frames.join(' ')}`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`].join('; ');
}

function cabecalho(ctx) {
  const { base, config, blog } = ctx;
  const cats = blog.categorias.slice(0, 7).map((c) => `<li><a href="${base}${c.url}">${escapeHtml(c.nome)}<small>${c.total}</small></a></li>`).join('');
  return `<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="container topo__inner">
    <a class="marca" href="${base}" aria-label="${escapeHtml(config.marca.nome)} — início"><span class="marca__logo" aria-hidden="true">${escapeHtml(config.marca.nome[0])}</span><span class="marca__texto"><strong>${escapeHtml(config.marca.nome)}</strong><small>${escapeHtml(config.marca.slogan)}</small></span></a>
    <nav class="nav" aria-label="Principal">
      <a href="${base}comparativos/">Comparativos</a>
      <div class="nav__grupo"><button type="button" class="nav__botao" aria-expanded="false" aria-controls="menu-categorias" data-menu="menu-categorias">Categorias</button><div id="menu-categorias" class="menu-categorias" hidden><ul>${cats}</ul></div></div>
      <a href="${base}sobre/">Sobre</a>
    </nav>
    <form class="busca-topo" role="search" action="${base}busca/" method="get"><label class="sr-only" for="q-topo">Buscar análises</label><input id="q-topo" name="q" type="search" placeholder="Buscar produto ou categoria…" autocomplete="off" maxlength="80"><button type="submit" class="btn-icone" aria-label="Buscar">${icone('search')}</button></form>
    <div class="topo__acoes"><button type="button" class="btn-icone" data-tema aria-label="Alternar tema claro/escuro">${icone('sun', 'icone icone--sol')}${icone('moon', 'icone icone--lua')}</button><button type="button" class="btn-icone nav-toggle" aria-expanded="false" aria-controls="menu-mobile" aria-label="Abrir menu" data-menu="menu-mobile">${icone('menu')}</button></div>
  </div>
  <div id="menu-mobile" class="menu-mobile" hidden><nav class="container" aria-label="Menu"><a href="${base}comparativos/">Comparativos</a><a href="${base}sobre/">Sobre</a><p class="menu-mobile__titulo">Categorias</p><ul>${cats}</ul></nav></div>
</header>`;
}

function rodape(ctx) {
  const { base, config, blog } = ctx;
  const paginas = blog.paginas.filter((p) => p.menu).map((p) => `<li><a href="${base}${p.url}">${escapeHtml(p.titulo)}</a></li>`).join('');
  const cats = blog.categorias.map((c) => `<li><a href="${base}${c.url}">${escapeHtml(c.nome)}</a></li>`).join('');
  return `<footer class="rodape">
  <div class="container rodape__grid">
    <div class="rodape__marca"><p><strong>${escapeHtml(config.marca.nome)}</strong><br>${escapeHtml(config.marca.descricao)}</p><p class="rodape__divulgacao">${escapeHtml(config.blog.divulgacao)}</p></div>
    <nav class="rodape__col" aria-label="Categorias"><h2>Categorias</h2><ul>${cats}</ul></nav>
    <nav class="rodape__col" aria-label="Institucional"><h2>Institucional</h2><ul>${paginas}<li><a href="${base}feed.xml">${icone('rss')} Feed RSS</a></li></ul></nav>
  </div>
  <div class="container rodape__base"><p>© ${config.marca.ano || new Date().getUTCFullYear()} ${escapeHtml(config.marca.nome)}. Os preços e a disponibilidade dos produtos podem mudar sem aviso.</p></div>
</footer>`;
}

/** Documento HTML completo. pagina: { titulo, tituloCompleto, descricao, caminho, corpo, classe, ogImagem, ogTipo, jsonld:[], noindex } */
export function layout(ctx, pagina) {
  const { base, config, ver, urlAbs } = ctx;
  const titulo = pagina.tituloCompleto || (pagina.titulo ? `${pagina.titulo} · ${config.marca.nome}` : `${config.marca.nome} — ${config.marca.slogan}`);
  const descricao = pagina.descricao || config.marca.descricao;
  const canonical = urlAbs(pagina.caminho || '');
  const ads = config.blog?.anuncios?.adsense;
  return `<!doctype html>
<html lang="${escapeHtml(config.marca.idioma)}" data-base="${escapeHtml(base)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${politicaCsp(config)}">
<title>${escapeHtml(titulo)}</title>
<meta name="description" content="${escapeHtml(descricao)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${pagina.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="${escapeHtml(config.marca.tema.corPrimaria)}">
<meta name="color-scheme" content="light dark">
<meta property="og:site_name" content="${escapeHtml(config.marca.nome)}">
<meta property="og:type" content="${pagina.ogTipo || 'website'}">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descricao)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${pagina.ogImagem ? `<meta property="og:image" content="${escapeHtml(pagina.ogImagem)}">` : ''}
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="${pagina.ogImagem ? 'summary_large_image' : 'summary'}">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.marca.nome)}" href="${base}feed.xml">
<link rel="stylesheet" href="${base}css/blog.css?v=${ver}">
<link rel="stylesheet" href="${base}css/tema.css?v=${ver}">
<script src="${base}js/tema.js?v=${ver}"></script>
${ads ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(ads)}" crossorigin="anonymous"></script>` : ''}
${(pagina.jsonld || []).join('\n')}
</head>
<body class="${escapeHtml(pagina.classe || '')}">
${sprite()}
${cabecalho(ctx)}
<main id="conteudo" tabindex="-1">
${pagina.corpo}
</main>
${rodape(ctx)}
<script type="module" src="${base}js/blog.js?v=${ver}"></script>
</body>
</html>
`;
}

export function breadcrumb(ctx, itens) {
  const partes = [{ nome: 'Início', url: ctx.base }, ...itens];
  return `<nav class="trilha" aria-label="Você está aqui"><ol>${partes.map((it, i) => (i === partes.length - 1 ? `<li aria-current="page">${escapeHtml(it.nome)}</li>` : `<li><a href="${escapeHtml(it.url)}">${escapeHtml(it.nome)}</a></li>`)).join('')}</ol></nav>`;
}

export function nota(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  return `<span class="nota" aria-label="Nota ${formatarNumero(valor, 1)} de 10">${icone('star')}<strong>${formatarNumero(valor, 1)}</strong><small>/10</small></span>`;
}

export function cardPost(ctx, p, { destaque = false } = {}) {
  const { base } = ctx;
  const img = p.imagem ? `<img src="${escapeHtml(p.imagem)}" alt="" loading="lazy" decoding="async">` : `<span class="card__placeholder" aria-hidden="true">${escapeHtml(p.categoriaNome.slice(0, 2).toUpperCase())}</span>`;
  return `<article class="card${destaque ? ' card--destaque' : ''}">
  <a class="card__foto" href="${base}${p.url}" tabindex="-1" aria-hidden="true">${img}</a>
  <div class="card__corpo">
    <p class="eyebrow"><a href="${base}categoria/${escapeHtml(p.categoria)}/">${escapeHtml(p.categoriaNome)}</a>${p.tipo === 'comparativo' ? ' · Comparativo' : ''}</p>
    <h3><a href="${base}${p.url}">${escapeHtml(p.titulo)}</a></h3>
    <p class="card__desc">${escapeHtml(truncar(p.descricao, 140))}</p>
    <p class="card__meta">${p.tipo === 'review' && p.nota !== '' ? nota(p.nota) : ''}${p.preco ? `<span class="preco">${formatarMoeda(p.preco, p.moeda || 'BRL')}</span>` : ''}<time datetime="${escapeHtml(p.data)}">${dataExtenso(p.data)}</time><span>${p.minutos} min</span></p>
  </div>
</article>`;
}

export function gradePosts(ctx, posts, opcoes) {
  return `<div class="grade">${posts.map((p) => cardPost(ctx, p, opcoes)).join('\n')}</div>`;
}

/** Caixa do produto analisado (preço, nota, CTA com link de afiliado). */
export function caixaProduto(p) {
  if (p.tipo !== 'review') return '';
  const cta = p.link ? `<a class="botao botao--primario" href="${escapeHtml(p.link)}" rel="sponsored nofollow noopener" target="_blank">Ver preço atual ${icone('external')}</a>` : '';
  const img = p.imagem ? `<img src="${escapeHtml(p.imagem)}" alt="${escapeHtml(p.produtoNome || '')}" loading="lazy" decoding="async">` : '';
  return `<aside class="produto-box" aria-label="Resumo do produto">
  ${img ? `<div class="produto-box__foto">${img}</div>` : ''}
  <div class="produto-box__info">
    <p class="produto-box__nome">${escapeHtml(p.produtoNome || p.titulo)}</p>
    <p class="produto-box__linha">${nota(p.nota)}${p.avaliacao ? `<span class="avaliacao">${formatarNumero(p.avaliacao, 1)}★ · ${formatarNumero(p.numAvaliacoes)} avaliações</span>` : ''}</p>
    ${p.preco ? `<p class="produto-box__preco">${formatarMoeda(p.preco, p.moeda || 'BRL')}<small>preço consultado em ${dataExtenso(p.atualizado || p.data)}</small></p>` : ''}
    ${cta}
  </div>
</aside>`;
}

export function sumario(titulos) {
  if (!titulos || titulos.length < 3) return '';
  return `<nav class="sumario" aria-label="Neste artigo"><p>Neste artigo</p><ol>${titulos.map((t) => `<li><a href="#${t.id}">${escapeHtml(t.texto)}</a></li>`).join('')}</ol></nav>`;
}

export function tituloSecao(titulo, { sub, url, rotuloUrl, id } = {}) {
  const link = url ? `<a class="link-seta" href="${escapeHtml(url)}">${escapeHtml(rotuloUrl || 'Ver todos')} ${icone('arrow-right')}</a>` : '';
  return `<div class="secao__cabecalho"><div><h2${id ? ` id="${id}"` : ''}>${escapeHtml(titulo)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</div>${link}</div>`;
}
