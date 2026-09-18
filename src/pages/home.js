import { escapeHtml, plural } from '../../public/js/lib/util.js';
import { gradeProdutos } from '../../public/js/lib/card.js';
import { icone, chip, faixaWhatsApp, tituloSecao, linkWhatsAppSimples } from '../lib/html.js';
import { jsonLd, ldOrganizacao, ldSite } from '../lib/seo.js';

const BUSCAS_FREQUENTES = ['Botão Gol', 'Máquina de vidro Palio', 'Chicote Onix', 'LED H4', 'Relé 12V', 'Alicate RJ45', 'Estribo Hilux'];

export function paginas(ctx) {
  const { base, config, categorias, montadoras, produtos, totais, urlAbs } = ctx;
  const destaques = (config.destaques || []).map((c) => produtos.find((p) => p.codigo === c)).filter(Boolean);
  const nomesCategorias = categorias.map((c) => c.nome.toLowerCase());

  const hero = `<section class="hero">
  <div class="container hero__inner">
    <p class="eyebrow">${escapeHtml(config.edicao)}</p>
    <h1>Componentes elétricos automotivos, conectores e ferramentas em um só catálogo</h1>
    <p class="hero__sub">${plural(totais.produtos, 'produto', 'produtos')} em ${plural(totais.categorias, 'categoria', 'categorias')}: ${escapeHtml(nomesCategorias.slice(0, 8).join(', '))} e mais. Encontre pelo código, referência ou modelo do veículo e envie o orçamento pelo WhatsApp.</p>
    <form class="hero__busca" role="search" action="${base}catalogo/" method="get">
      <label class="sr-only" for="q-hero">Buscar no catálogo</label>
      ${icone('search')}
      <input id="q-hero" name="q" type="search" placeholder="Ex.: 64041, FA01A43, botão Palio, máquina de vidro Gol…" autocomplete="off" maxlength="80">
      <button type="submit" class="btn btn--primario">Buscar</button>
    </form>
    <div class="hero__atalhos"><span>Buscas frequentes:</span>${BUSCAS_FREQUENTES.map((b) => `<a href="${base}catalogo/?q=${encodeURIComponent(b)}">${escapeHtml(b)}</a>`).join('')}</div>
    <dl class="hero__stats">
      <div><dt>Produtos</dt><dd>${totais.produtos}</dd></div>
      <div><dt>Categorias</dt><dd>${totais.categorias}</dd></div>
      <div><dt>Montadoras</dt><dd>${totais.montadoras}</dd></div>
      <div><dt>Orçamento</dt><dd>WhatsApp</dd></div>
    </dl>
  </div>
</section>`;

  const tilesCategorias = categorias
    .map((c) => `<a class="tile tile--${escapeHtml(c.cor)}" href="${base}categoria/${c.id}/">
      <span class="tile__icone">${icone(c.icone)}</span>
      <span class="tile__texto"><strong>${escapeHtml(c.nome)}</strong><span>${escapeHtml(c.descricao)}</span></span>
      <span class="tile__total">${plural(c.total, 'item', 'itens')} ${icone('arrow-right')}</span>
    </a>`)
    .join('\n');

  const secCategorias = `<section class="secao container" aria-labelledby="categorias">
  ${tituloSecao('Categorias', { id: 'categorias', sub: 'Navegue pelo catálogo do mesmo jeito que no PDF: 11 categorias numeradas.' })}
  <div class="tiles">${tilesCategorias}</div>
</section>`;

  const secDestaques = destaques.length
    ? `<section class="secao container" aria-labelledby="destaques">
  ${tituloSecao('Destaques do catálogo', { id: 'destaques', url: `${base}catalogo/`, rotuloUrl: 'Ver catálogo completo', sub: 'Itens representativos de cada linha.' })}
  <div class="grade grade--destaques">${gradeProdutos(destaques, { base, lazy: false })}</div>
</section>`
    : '';

  const chipsMontadoras = montadoras.map((m) => chip({ url: `${base}montadora/${m.id}/`, rotulo: m.nome, total: m.total })).join('');
  const secMontadoras = `<section class="secao secao--suave" aria-labelledby="montadoras">
  <div class="container">
    ${tituloSecao('Busca por montadora', { id: 'montadoras', url: `${base}montadoras/`, rotuloUrl: 'Todas as montadoras', sub: 'Botões, máquinas de vidro, chicotes e acessórios agrupados pelo veículo.' })}
    <div class="chips chips--grande">${chipsMontadoras}</div>
  </div>
</section>`;

  const passos = (config.comoFunciona || [])
    .map((p, i) => `<li><span class="passo__num">${i + 1}</span><h3>${escapeHtml(p.titulo)}</h3><p>${escapeHtml(p.texto)}</p></li>`)
    .join('');
  const secComoFunciona = `<section class="secao container" aria-labelledby="como-funciona">
  ${tituloSecao('Como pedir um orçamento', { id: 'como-funciona' })}
  <ol class="passos">${passos}</ol>
  <div class="secao__acoes">
    <a class="btn btn--primario" href="${base}catalogo/">${icone('grid')} Explorar o catálogo</a>
    <a class="btn btn--whatsapp" href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener">${icone('whatsapp')} Falar no WhatsApp</a>
    <a class="btn btn--contorno" href="${base}${escapeHtml(config.pdf.arquivo)}" download>${icone('download')} Baixar PDF (${escapeHtml(config.pdf.tamanho)})</a>
  </div>
</section>`;

  const secSobre = `<section class="secao secao--suave" aria-labelledby="sobre">
  <div class="container sobre-teaser">
    <div>
      ${tituloSecao(config.sobre.titulo, { id: 'sobre', url: `${base}sobre/`, rotuloUrl: 'Saiba mais' })}
      <p>${escapeHtml(config.sobre.paragrafos[0])}</p>
    </div>
    <ul class="lista-check">
      <li>${icone('check')} Busca por código, referência e modelo</li>
      <li>${icone('check')} Orçamento salvo no navegador, enviado pelo WhatsApp</li>
      <li>${icone('check')} Funciona offline depois da primeira visita (PWA)</li>
      <li>${icone('check')} Dados abertos em JSON e CSV para integração</li>
    </ul>
  </div>
</section>`;

  const corpo = [hero, secCategorias, secDestaques, secMontadoras, secComoFunciona, secSobre, faixaWhatsApp(ctx)].join('\n');
  return [{
    caminho: '',
    prioridade: 1,
    freq: 'weekly',
    html: {
      tituloCompleto: `${config.titulo} — ${config.slogan}`,
      descricao: config.descricao,
      caminho: '',
      classe: 'pagina-home',
      corpo,
      jsonld: [jsonLd(ldOrganizacao(config, urlAbs)), jsonLd(ldSite(config, urlAbs))],
    },
  }];
}
