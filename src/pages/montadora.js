import { escapeHtml, plural } from '../../public/js/lib/util.js';
import { gradeProdutos } from '../../public/js/lib/card.js';
import { icone, breadcrumb, chip, barraListagem, faixaWhatsApp, tituloSecao } from '../lib/html.js';
import { jsonLd, ldBreadcrumb } from '../lib/seo.js';

function indice(ctx) {
  const { base, config, montadoras, urlAbs } = ctx;
  const tiles = montadoras
    .map((m) => `<a class="tile tile--montadora" href="${base}montadora/${m.id}/">
      <span class="tile__icone">${icone('carro')}</span>
      <span class="tile__texto"><strong>${escapeHtml(m.nome)}</strong><span>${escapeHtml(m.categorias.map((c) => `${c.nome} (${c.total})`).join(' · '))}</span>${m.modelos.length ? `<span class="tile__modelos">${escapeHtml(m.modelos.slice(0, 8).join(', '))}${m.modelos.length > 8 ? '…' : ''}</span>` : ''}</span>
      <span class="tile__total">${plural(m.total, 'item', 'itens')} ${icone('arrow-right')}</span>
    </a>`)
    .join('\n');
  const corpo = `<section class="pagina-cabecalho">
  <div class="container">
    ${breadcrumb(ctx, [{ nome: 'Montadoras', url: `${base}montadoras/` }])}
    <h1>Peças por montadora</h1>
    <p>Botões, máquinas de vidro, chicotes e acessórios agrupados pelo veículo. As aplicações são identificadas pelo nome do produto; confirme a compatibilidade com o atendimento.</p>
  </div>
</section>
<section class="secao container"><div class="tiles">${tiles}</div></section>
${faixaWhatsApp(ctx, 'Não encontrou o seu veículo?')}`;
  return {
    caminho: 'montadoras/',
    prioridade: 0.8,
    freq: 'weekly',
    html: {
      titulo: 'Peças por montadora',
      descricao: `Peças elétricas por montadora: ${montadoras.map((m) => m.nome).join(', ')}. Botões de vidro, máquinas de vidro, chicotes e acessórios do ${config.edicao}.`,
      caminho: 'montadoras/',
      classe: 'pagina-montadoras',
      corpo,
      jsonld: [jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, { nome: 'Montadoras', url: urlAbs('montadoras/') }]))],
    },
  };
}

function paginaMontadora(ctx, m) {
  const { base, config, categorias, produtos, urlAbs } = ctx;
  const itens = produtos.filter((p) => p.montadoras.includes(m.id));
  const caminho = `montadora/${m.id}/`;
  const modelos = m.modelos.map((mod) => chip({ url: `${base}montadora/${m.id}/?q=${encodeURIComponent(mod)}`, rotulo: mod })).join('');
  const secoes = categorias
    .map((c) => ({ c, itens: itens.filter((p) => p.categoria === c.id) }))
    .filter((s) => s.itens.length)
    .map((s) => `<section class="secao secao--compacta" data-secao-categoria="${s.c.id}">
  ${tituloSecao(`${s.c.nome}`, { sub: plural(s.itens.length, 'produto', 'produtos'), url: `${base}categoria/${s.c.id}/`, rotuloUrl: `Ver categoria` })}
  <div class="grade" data-grade>${gradeProdutos(s.itens, { base })}</div>
</section>`)
    .join('\n');
  const corpo = `<section class="pagina-cabecalho">
  <div class="container pagina-cabecalho__inner">
    <div>
      ${breadcrumb(ctx, [{ nome: 'Montadoras', url: `${base}montadoras/` }, { nome: m.nome, url: `${base}${caminho}` }])}
      <p class="eyebrow">Montadora</p>
      <h1>${escapeHtml(m.nome)}</h1>
      <p>${plural(m.total, 'produto', 'produtos')} em ${plural(m.categorias.length, 'categoria', 'categorias')}.${m.modelos.length ? ` Modelos citados: ${escapeHtml(m.modelos.join(', '))}.` : ''}</p>
    </div>
    <span class="pagina-cabecalho__icone" aria-hidden="true">${icone('carro')}</span>
  </div>
</section>
<section class="container listagem listagem--secoes" data-listagem data-escopo="montadora" data-montadora="${m.id}">
  ${modelos ? `<div class="filtros-linha"><p class="filtros-linha__rotulo">Modelos:</p><div class="chips" data-chips-modelo>${modelos}</div></div>` : ''}
  ${barraListagem(ctx, { action: `${base}${caminho}`, placeholder: `Buscar em ${m.nome}…` })}
  <p class="resultado" data-resultado aria-live="polite">${plural(itens.length, 'produto', 'produtos')}</p>
  <div data-secoes>${secoes}</div>
  <div class="grade" data-grade-busca hidden></div>
  <p class="listagem__vazio" data-vazio hidden>Nenhum produto encontrado para ${escapeHtml(m.nome)} com esse termo. <a href="${base}catalogo/">Buscar em todo o catálogo</a>.</p>
</section>
${faixaWhatsApp(ctx, `Precisa de outra peça para ${m.nome}?`)}`;
  return {
    caminho,
    prioridade: 0.7,
    freq: 'weekly',
    html: {
      titulo: `Peças para ${m.nome}`,
      descricao: `${m.total} peças elétricas para ${m.nome}: ${m.categorias.map((c) => c.nome.toLowerCase()).join(', ')}.${m.modelos.length ? ` Modelos: ${m.modelos.slice(0, 12).join(', ')}.` : ''} Orçamento pelo WhatsApp ${config.whatsapp.exibicao}.`,
      caminho,
      classe: 'pagina-montadora',
      corpo,
      scripts: ['catalogo.js'],
      jsonld: [jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, { nome: 'Montadoras', url: urlAbs('montadoras/') }, { nome: m.nome, url: urlAbs(caminho) }]))],
    },
  };
}

export function paginas(ctx) {
  return [indice(ctx), ...ctx.montadoras.map((m) => paginaMontadora(ctx, m))];
}
