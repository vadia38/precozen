// Layout, ícones e componentes de HTML do gerador.
import { escapeHtml, plural } from '../../public/js/lib/util.js';

// Ícones em traço (24x24). Sem emoji: consistência visual e acessibilidade.
export const ICONES = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  orcamento: '<path d="M9 3h6v2H9zM7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1"/><path d="M9 12h6M9 16h4"/>',
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M9.5 8.5c.3-.5.7-.5 1-.5l.8 1.8-.6.8c.5 1 1.5 2 2.5 2.5l.8-.6 1.8.8c0 .3 0 .7-.5 1-.7.6-1.6.6-2.5.2A8 8 0 0 1 9.3 11c-.4-.9-.4-1.8.2-2.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  printer: '<path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3"/><rect x="7" y="14" width="10" height="7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alerta: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  home: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
  pdf: '<path d="M6 3h8l5 5v13H6zM14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  caixa: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  'wifi-off': '<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01M3 3l18 18"/>',
  // Categorias
  botao: '<rect x="3" y="7" width="18" height="10" rx="2"/><rect x="7" y="10" width="4" height="4" rx="1"/><path d="M14 12h4"/>',
  ventilador: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 2-7 4-7s2 3-1 6M14 12c4 0 7 2 7 4s-3 2-6-1M12 14c0 4-2 7-4 7s-2-3 1-6M10 12c-4 0-7-2-7-4s3-2 6 1"/>',
  chicote: '<rect x="2" y="9" width="5" height="6" rx="1"/><rect x="17" y="9" width="5" height="6" rx="1"/><path d="M7 12c3 0 3-3 6-3s2 3 4 3"/>',
  led: '<path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.8-1.5 1.8-1.5 3.5h-4c0-1.7-.7-2.7-1.5-3.5z"/>',
  maquina: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 16 18 8M12 7v4M10 9l2-2 2 2M12 17v-4M10 15l2 2 2-2"/>',
  conector: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  ferramenta: '<path d="M21 6.5a4.5 4.5 0 0 1-6 4.2L8 17.7 6.3 16 13.3 9a4.5 4.5 0 0 1 5.4-5.8L16 5.9l2.1 2.1z"/><path d="m4 20 2-2"/>',
  estribo: '<path d="M5 5h14v8H5zM3 17h18M6 13v4M18 13v4"/>',
  carro: '<path d="M4 16 5.6 10.4A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.4L20 16v4h-2.5v-2h-11v2H4z"/><path d="M7.5 15.5h.01M16.5 15.5h.01"/>',
  rele: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v4M12 3v4M15 3v4M9 17v4M12 17v4M15 17v4M3 9h4M3 12h4M3 15h4M17 9h4M17 12h4M17 15h4"/>',
  bateria: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M19 10h2v4h-2M7 12h6"/>',
};

export function sprite() {
  const simbolos = Object.entries(ICONES)
    .map(([id, conteudo]) => `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${conteudo}</symbol>`)
    .join('');
  return `<svg class="sprite" aria-hidden="true" focusable="false">${simbolos}</svg>`;
}

export function icone(nome, classe = 'icone') {
  if (!ICONES[nome]) throw new Error(`ícone desconhecido: ${nome}`);
  return `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#i-${nome}"></use></svg>`;
}

/**
 * Política de segurança de conteúdo. Sem scripts nem estilos inline: tudo vem do próprio site.
 * A mesma política vai nos cabeçalhos HTTP (public/_headers e deploy/nginx.conf).
 */
export function politicaCsp() {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Cabeçalho do site. */
function cabecalho(ctx) {
  const { base, config, categorias } = ctx;
  const cats = categorias.map((c) => `<li><a href="${base}categoria/${c.id}/">${icone(c.icone)}<span>${escapeHtml(c.nome)}</span><small>${c.total}</small></a></li>`).join('');
  return `<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="container topo__inner">
    <a class="marca" href="${base}" aria-label="${escapeHtml(config.nome)} — página inicial">
      <img src="${base}img/logo.png" alt="" width="46" height="32" decoding="async">
      <span class="marca__texto"><strong>${escapeHtml(config.nome)}</strong><small>${escapeHtml(config.edicao)}</small></span>
    </a>
    <form class="busca-topo" role="search" action="${base}catalogo/" method="get" data-busca-topo>
      <label class="sr-only" for="q-topo">Buscar no catálogo</label>
      <input id="q-topo" name="q" type="search" placeholder="Código, referência ou modelo…" autocomplete="off" spellcheck="false" maxlength="80" aria-autocomplete="list" aria-controls="sugestoes-topo" aria-expanded="false">
      <button type="submit" class="busca-topo__botao" aria-label="Buscar">${icone('search')}</button>
      <div id="sugestoes-topo" class="sugestoes" hidden></div>
    </form>
    <nav class="nav" aria-label="Principal">
      <a href="${base}catalogo/">Catálogo</a>
      <div class="nav__grupo">
        <button type="button" class="nav__botao" aria-expanded="false" aria-controls="menu-categorias" data-menu="menu-categorias">Categorias ${icone('chevron-down')}</button>
        <div id="menu-categorias" class="menu-categorias" hidden><ul>${cats}</ul></div>
      </div>
      <a href="${base}montadoras/">Montadoras</a>
      <a href="${base}sobre/">Sobre</a>
    </nav>
    <div class="topo__acoes">
      <button type="button" class="btn-icone" data-tema aria-label="Alternar tema claro/escuro" title="Tema">${icone('sun', 'icone icone--sol')}${icone('moon', 'icone icone--lua')}</button>
      <a class="btn-orcamento" href="${base}orcamento/" aria-label="Meu orçamento">${icone('orcamento')}<span class="btn-orcamento__rotulo">Orçamento</span><span class="badge" data-badge-orcamento hidden>0</span></a>
      <button type="button" class="btn-icone nav-toggle" aria-expanded="false" aria-controls="menu-mobile" aria-label="Abrir menu" data-menu="menu-mobile">${icone('menu')}</button>
    </div>
  </div>
  <div id="menu-mobile" class="menu-mobile" hidden>
    <nav class="container" aria-label="Menu">
      <a href="${base}catalogo/">${icone('grid')} Catálogo completo</a>
      <a href="${base}montadoras/">${icone('carro')} Montadoras</a>
      <a href="${base}orcamento/">${icone('orcamento')} Meu orçamento</a>
      <a href="${base}sobre/">${icone('info')} Sobre e contato</a>
      <p class="menu-mobile__titulo">Categorias</p>
      <ul class="menu-mobile__cats">${cats}</ul>
    </nav>
  </div>
</header>`;
}

function rodape(ctx) {
  const { base, config, categorias, totais } = ctx;
  const cats = categorias.map((c) => `<li><a href="${base}categoria/${c.id}/">${escapeHtml(c.nome)}</a></li>`).join('');
  return `<footer class="rodape">
  <div class="container rodape__grid">
    <div class="rodape__marca">
      <img src="${base}img/logo.png" alt="" width="70" height="49" loading="lazy" decoding="async">
      <p><strong>${escapeHtml(config.nome)}</strong><br>${escapeHtml(config.slogan)}</p>
      <p class="rodape__stats">${plural(totais.produtos, 'produto', 'produtos')} · ${plural(totais.categorias, 'categoria', 'categorias')} · ${plural(totais.montadoras, 'montadora', 'montadoras')}</p>
      <a class="btn btn--whatsapp" href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener">${icone('whatsapp')} WhatsApp ${escapeHtml(config.whatsapp.exibicao)}</a>
    </div>
    <nav class="rodape__col" aria-label="Categorias"><h2>Categorias</h2><ul>${cats}</ul></nav>
    <nav class="rodape__col" aria-label="Navegação"><h2>Navegação</h2><ul>
      <li><a href="${base}catalogo/">Catálogo completo</a></li>
      <li><a href="${base}montadoras/">Por montadora</a></li>
      <li><a href="${base}orcamento/">Meu orçamento</a></li>
      <li><a href="${base}sobre/">Sobre e contato</a></li>
      <li><a href="${base}${escapeHtml(config.pdf.arquivo)}" download>Catálogo em PDF (${escapeHtml(config.pdf.tamanho)})</a></li>
      <li><a href="${base}api/produtos.json">Dados abertos (JSON)</a></li>
    </ul></nav>
    <div class="rodape__col"><h2>Atendimento</h2><ul>
      <li><a href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener">WhatsApp ${escapeHtml(config.whatsapp.exibicao)}</a></li>
      <li><a href="${escapeHtml(config.siteOficial)}" target="_blank" rel="noopener">${escapeHtml(config.siteOficial.replace(/^https?:\/\//, ''))}</a></li>
      <li><a href="${escapeHtml(config.orcamentoOficial)}" target="_blank" rel="noopener">Orçamento no site oficial</a></li>
    </ul></div>
  </div>
  <div class="container rodape__base">
    <p>${escapeHtml(config.avisos)}</p>
    <p>© ${config.ano} ${escapeHtml(config.nome)} · ${escapeHtml(config.edicao)}</p>
  </div>
</footer>`;
}

export function linkWhatsAppSimples(config, texto) {
  const msg = texto || config.whatsapp.saudacao || '';
  return `https://wa.me/${config.whatsapp.numero}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

/**
 * Documento HTML completo.
 * pagina: { titulo, descricao, caminho, corpo, classe, ogImagem, ogTipo, jsonld:[], scripts:[], noindex, tituloCompleto }
 */
export function layout(ctx, pagina) {
  const { base, config, ver, urlAbs } = ctx;
  const titulo = pagina.tituloCompleto || (pagina.titulo ? `${pagina.titulo} · ${config.titulo}` : config.titulo);
  const descricao = pagina.descricao || config.descricao;
  const canonical = urlAbs(pagina.caminho || '');
  const ogImagem = pagina.ogImagem || urlAbs('img/og.png');
  const scripts = ['app.js', ...(pagina.scripts || [])].map((s) => `<script type="module" src="${base}js/${s}?v=${ver}"></script>`).join('\n');
  const jsonld = (pagina.jsonld || []).join('\n');
  return `<!doctype html>
<html lang="${escapeHtml(config.idioma)}" data-base="${escapeHtml(base)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${politicaCsp()}">
<title>${escapeHtml(titulo)}</title>
<meta name="description" content="${escapeHtml(descricao)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${pagina.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="${escapeHtml(config.tema.corPrimaria)}">
<meta name="color-scheme" content="light dark">
<meta name="application-name" content="${escapeHtml(config.titulo)}">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(config.nome)}">
<meta name="mobile-web-app-capable" content="yes">
<meta property="og:site_name" content="${escapeHtml(config.titulo)}">
<meta property="og:type" content="${pagina.ogTipo || 'website'}">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descricao)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(ogImagem)}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="${pagina.ogImagem ? 'summary' : 'summary_large_image'}">
<link rel="icon" href="${base}img/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${base}img/icons/favicon-64.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="${base}img/icons/apple-touch-icon.png">
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="stylesheet" href="${base}css/site.css?v=${ver}">
<script src="${base}js/tema.js?v=${ver}"></script>
${jsonld}
</head>
<body class="${escapeHtml(pagina.classe || '')}">
${sprite()}
${cabecalho(ctx)}
<main id="conteudo" tabindex="-1">
${pagina.corpo}
</main>
${rodape(ctx)}
<div class="toasts" aria-live="polite" aria-atomic="true" data-toasts></div>
<div class="modal" data-modal hidden role="dialog" aria-modal="true" aria-label="Imagem ampliada"><button type="button" class="modal__fechar btn-icone" data-modal-fechar aria-label="Fechar">${icone('x')}</button><div class="modal__conteudo" data-modal-conteudo></div></div>
${scripts}
</body>
</html>
`;
}

/** Trilha de navegação. itens: [{nome, url}] — o último é a página atual. */
export function breadcrumb(ctx, itens) {
  const partes = [{ nome: 'Início', url: ctx.base }, ...itens];
  const lis = partes
    .map((it, i) => {
      const ultimo = i === partes.length - 1;
      return ultimo
        ? `<li aria-current="page">${escapeHtml(it.nome)}</li>`
        : `<li><a href="${escapeHtml(it.url)}">${escapeHtml(it.nome)}</a>${icone('chevron-right', 'icone icone--sep')}</li>`;
    })
    .join('');
  return `<nav class="trilha" aria-label="Você está aqui"><ol>${lis}</ol></nav>`;
}

/** Chip de filtro (link). */
export function chip({ url, rotulo, total, ativo = false, icone: nomeIcone }) {
  const cls = `chip${ativo ? ' chip--ativo' : ''}`;
  const n = total !== undefined ? `<small>${total}</small>` : '';
  const ic = nomeIcone ? icone(nomeIcone) : '';
  return `<a class="${cls}" href="${escapeHtml(url)}"${ativo ? ' aria-current="true"' : ''}>${ic}<span>${escapeHtml(rotulo)}</span>${n}</a>`;
}

/** Faixa de chamada para o WhatsApp usada em várias páginas. */
export function faixaWhatsApp(ctx, texto = 'Precisa de ajuda para encontrar uma peça?') {
  const { config } = ctx;
  return `<section class="faixa-zap" aria-labelledby="faixa-zap-titulo">
  <div class="container faixa-zap__inner">
    <div><h2 id="faixa-zap-titulo">${escapeHtml(texto)}</h2><p>Fale com o atendimento pelo WhatsApp ${escapeHtml(config.whatsapp.exibicao)} ou monte seu orçamento online.</p></div>
    <div class="faixa-zap__acoes">
      <a class="btn btn--whatsapp" href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener">${icone('whatsapp')} Chamar no WhatsApp</a>
      <a class="btn btn--contorno-claro" href="${ctx.base}orcamento/">${icone('orcamento')} Meu orçamento</a>
    </div>
  </div>
</section>`;
}

/** Barra de ferramentas das listagens (busca, ordenação, visual). */
export function barraListagem(ctx, opcoes = {}) {
  const { categorias } = ctx;
  const selectCategoria = opcoes.comCategoria
    ? `<label class="campo campo--select"><span>Categoria</span><select name="c" data-filtro-categoria><option value="">Todas</option>${categorias.map((c) => `<option value="${c.id}"${opcoes.categoria === c.id ? ' selected' : ''}>${escapeHtml(c.nome)} (${c.total})</option>`).join('')}</select></label>`
    : '';
  return `<form class="barra" role="search" data-barra-listagem method="get" action="${escapeHtml(opcoes.action || `${ctx.base}catalogo/`)}">
  <label class="campo campo--busca"><span class="sr-only">Buscar</span>${icone('search')}<input type="search" name="q" value="${escapeHtml(opcoes.q || '')}" placeholder="${escapeHtml(opcoes.placeholder || 'Buscar por código, referência ou nome…')}" autocomplete="off" maxlength="80" data-filtro-busca></label>
  ${selectCategoria}
  <label class="campo campo--select"><span>Ordenar</span><select name="ord" data-filtro-ordem>
    <option value="">Relevância / catálogo</option>
    <option value="nome">Nome (A–Z)</option>
    <option value="codigo">Código</option>
  </select></label>
  <div class="barra__visual" role="group" aria-label="Modo de exibição">
    <button type="button" class="btn-icone" data-visual="grade" aria-pressed="true" aria-label="Ver em grade">${icone('grid')}</button>
    <button type="button" class="btn-icone" data-visual="lista" aria-pressed="false" aria-label="Ver em lista">${icone('list')}</button>
  </div>
  <button type="submit" class="btn btn--pequeno barra__enviar">Filtrar</button>
</form>`;
}

/** Cabeçalho de seção com título e link opcional. */
export function tituloSecao(titulo, { sub, url, rotuloUrl, id } = {}) {
  const link = url ? `<a class="link-seta" href="${escapeHtml(url)}">${escapeHtml(rotuloUrl || 'Ver todos')} ${icone('arrow-right')}</a>` : '';
  return `<div class="secao__cabecalho"><div><h2${id ? ` id="${id}"` : ''}>${escapeHtml(titulo)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</div>${link}</div>`;
}
