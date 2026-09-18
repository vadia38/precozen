import { escapeHtml, plural } from '../../public/js/lib/util.js';
import { gradeProdutos } from '../../public/js/lib/card.js';
import { icone, breadcrumb, chip, barraListagem, faixaWhatsApp, tituloSecao } from '../lib/html.js';
import { jsonLd, ldBreadcrumb } from '../lib/seo.js';

function paginaCategoria(ctx, cat, sub) {
  const { base, config, categorias, produtos, urlAbs } = ctx;
  const itens = produtos.filter((p) => p.categoria === cat.id && (!sub || p.subgrupo === sub.id));
  const caminho = sub ? `categoria/${cat.id}/${sub.id}/` : `categoria/${cat.id}/`;
  const titulo = sub ? `${cat.nome} ${sub.nome}` : cat.nome;

  let chips = '';
  if (cat.subgrupos.length) {
    chips = [chip({ url: `${base}categoria/${cat.id}/`, rotulo: 'Todos', total: cat.total, ativo: !sub }),
      ...cat.subgrupos.map((s) => chip({ url: `${base}categoria/${cat.id}/${s.id}/`, rotulo: s.nome, total: s.total, ativo: sub?.id === s.id }))].join('');
  } else if (cat.montadoras.length >= 2) {
    chips = [chip({ url: `${base}categoria/${cat.id}/`, rotulo: 'Todas', ativo: true }),
      ...cat.montadoras.map((m) => chip({ url: `${base}categoria/${cat.id}/?m=${m.id}`, rotulo: m.nome, total: m.total }))].join('');
  }
  const rotuloChips = cat.subgrupos.length ? 'Montadora' : 'Aplicação';
  const outras = categorias.filter((c) => c.id !== cat.id).map((c) => chip({ url: `${base}categoria/${c.id}/`, rotulo: c.nome, total: c.total, icone: c.icone })).join('');
  const trilha = [{ nome: 'Catálogo', url: `${base}catalogo/` }, { nome: cat.nome, url: `${base}categoria/${cat.id}/` }];
  if (sub) trilha.push({ nome: sub.nome, url: `${base}${caminho}` });

  const corpo = `<section class="pagina-cabecalho pagina-cabecalho--categoria tile--${escapeHtml(cat.cor)}">
  <div class="container pagina-cabecalho__inner">
    <div>
      ${breadcrumb(ctx, trilha)}
      <p class="eyebrow">Categoria ${String(cat.numero).padStart(2, '0')}</p>
      <h1>${escapeHtml(titulo)}</h1>
      <p>${escapeHtml(cat.descricao)}. ${plural(itens.length, 'produto', 'produtos')}${sub ? ` para ${escapeHtml(sub.nome)}` : ''}.</p>
    </div>
    <span class="pagina-cabecalho__icone" aria-hidden="true">${icone(cat.icone)}</span>
  </div>
</section>
<section class="container listagem" data-listagem data-escopo="categoria" data-categoria="${cat.id}"${sub ? ` data-subgrupo="${sub.id}"` : ''}>
  ${chips ? `<div class="filtros-linha"><p class="filtros-linha__rotulo">${rotuloChips}:</p><div class="chips" data-chips-montadora>${chips}</div></div>` : ''}
  ${barraListagem(ctx, { action: `${base}${caminho}`, placeholder: `Buscar em ${cat.nome}…` })}
  <p class="resultado" data-resultado aria-live="polite">${plural(itens.length, 'produto', 'produtos')}</p>
  <div class="grade" data-grade>${gradeProdutos(itens, { base })}</div>
  <p class="listagem__vazio" data-vazio hidden>Nenhum produto encontrado nesta categoria com esse filtro. <a href="${base}catalogo/">Buscar em todo o catálogo</a>.</p>
  <div class="listagem__mais"><button type="button" class="btn btn--contorno" data-mostrar-mais hidden>Mostrar mais</button></div>
</section>
<section class="secao container">
  ${tituloSecao('Outras categorias')}
  <div class="chips chips--grande">${outras}</div>
</section>
${faixaWhatsApp(ctx)}`;

  const descricao = sub
    ? `${cat.nome} ${sub.nome}: ${itens.length} produtos (${cat.descricao.toLowerCase()}). Códigos, referências e fotos. Orçamento pelo WhatsApp ${config.whatsapp.exibicao}.`
    : `${cat.descricao}. ${itens.length} produtos no ${config.edicao} com código, referência e foto. Orçamento pelo WhatsApp ${config.whatsapp.exibicao}.`;
  return {
    caminho,
    prioridade: sub ? 0.7 : 0.8,
    freq: 'weekly',
    html: {
      titulo,
      descricao,
      caminho,
      classe: 'pagina-categoria',
      corpo,
      scripts: ['catalogo.js'],
      jsonld: [jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, ...trilha.map((t) => ({ nome: t.nome, url: urlAbs(t.url.slice(base.length)) }))]))],
    },
  };
}

export function paginas(ctx) {
  const saida = [];
  for (const cat of ctx.categorias) {
    saida.push(paginaCategoria(ctx, cat, null));
    for (const sub of cat.subgrupos) saida.push(paginaCategoria(ctx, cat, sub));
  }
  return saida;
}
