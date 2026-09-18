import { escapeHtml, plural } from '../../public/js/lib/util.js';
import { gradeProdutos } from '../../public/js/lib/card.js';
import { breadcrumb, chip, barraListagem, faixaWhatsApp } from '../lib/html.js';
import { jsonLd, ldBreadcrumb } from '../lib/seo.js';

export function paginas(ctx) {
  const { base, config, produtos, montadoras, totais, urlAbs } = ctx;
  const chips = montadoras.map((m) => chip({ url: `${base}catalogo/?m=${m.id}`, rotulo: m.nome, total: m.total })).join('');
  const corpo = `<section class="pagina-cabecalho">
  <div class="container">
    ${breadcrumb(ctx, [{ nome: 'Catálogo', url: `${base}catalogo/` }])}
    <h1>Catálogo completo</h1>
    <p>${plural(totais.produtos, 'produto', 'produtos')} do ${escapeHtml(config.edicao.toLowerCase())}. Filtre por categoria ou montadora, ou busque por código, referência e modelo.</p>
  </div>
</section>
<section class="container listagem" data-listagem data-escopo="catalogo">
  ${barraListagem(ctx, { comCategoria: true })}
  <div class="filtros-linha">
    <p class="filtros-linha__rotulo">Montadora:</p>
    <div class="chips" data-chips-montadora>${chip({ url: `${base}catalogo/`, rotulo: 'Todas', ativo: true })}${chips}</div>
  </div>
  <p class="resultado" data-resultado aria-live="polite">${plural(totais.produtos, 'produto', 'produtos')}</p>
  <div class="grade" data-grade>${gradeProdutos(produtos, { base })}</div>
  <p class="listagem__vazio" data-vazio hidden>Nenhum produto encontrado. Tente outro termo, um código ou navegue pelas categorias.</p>
  <div class="listagem__mais"><button type="button" class="btn btn--contorno" data-mostrar-mais hidden>Mostrar mais</button></div>
</section>
${faixaWhatsApp(ctx, 'Não achou a peça?')}`;

  return [{
    caminho: 'catalogo/',
    prioridade: 0.9,
    freq: 'weekly',
    html: {
      titulo: 'Catálogo completo',
      descricao: `Todos os ${totais.produtos} produtos do ${config.edicao}: botões de vidro, chicotes, máquinas de vidro, LED, conectores, ferramentas, estribos, automotivo, relés e baterias. Busque por código ou referência.`,
      caminho: 'catalogo/',
      classe: 'pagina-catalogo',
      corpo,
      scripts: ['catalogo.js'],
      jsonld: [jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, { nome: 'Catálogo', url: urlAbs('catalogo/') }]))],
    },
  }];
}
