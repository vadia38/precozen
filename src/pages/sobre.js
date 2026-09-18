import { escapeHtml, plural } from '../../public/js/lib/util.js';
import { icone, breadcrumb, faixaWhatsApp, linkWhatsAppSimples, tituloSecao } from '../lib/html.js';
import { jsonLd, ldBreadcrumb } from '../lib/seo.js';

export function paginas(ctx) {
  const { base, config, categorias, totais, urlAbs, dataIso } = ctx;
  const paragrafos = config.sobre.paragrafos.map((t) => `<p>${escapeHtml(t)}</p>`).join('');
  const passos = (config.comoFunciona || []).map((p, i) => `<li><span class="passo__num">${i + 1}</span><h3>${escapeHtml(p.titulo)}</h3><p>${escapeHtml(p.texto)}</p></li>`).join('');
  const linhas = categorias.map((c) => `<li><a href="${base}categoria/${c.id}/">${icone(c.icone)} ${escapeHtml(c.nome)}</a><span>${escapeHtml(c.descricao)}</span><strong>${c.total}</strong></li>`).join('');
  const data = new Date(dataIso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const corpo = `<section class="pagina-cabecalho">
  <div class="container">
    ${breadcrumb(ctx, [{ nome: 'Sobre', url: `${base}sobre/` }])}
    <h1>${escapeHtml(config.sobre.titulo)}</h1>
    <p>${escapeHtml(config.slogan)}</p>
  </div>
</section>
<section class="container secao sobre">
  <div class="sobre__grid">
    <article class="prosa">${paragrafos}</article>
    <aside class="cartao contato">
      <h2>Atendimento</h2>
      <a class="btn btn--whatsapp btn--grande" href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener">${icone('whatsapp')} WhatsApp ${escapeHtml(config.whatsapp.exibicao)}</a>
      <ul class="contato__lista">
        <li>${icone('external')}<a href="${escapeHtml(config.siteOficial)}" target="_blank" rel="noopener">${escapeHtml(config.siteOficial.replace(/^https?:\/\//, ''))}</a></li>
        <li>${icone('orcamento')}<a href="${escapeHtml(config.orcamentoOficial)}" target="_blank" rel="noopener">Orçamento no site oficial</a></li>
        <li>${icone('pdf')}<a href="${base}${escapeHtml(config.pdf.arquivo)}" download>Catálogo em PDF (${escapeHtml(config.pdf.tamanho)}, ${config.pdf.paginas} páginas)</a></li>
      </ul>
    </aside>
  </div>
</section>
<section class="container secao" aria-labelledby="como-pedir">
  ${tituloSecao('Como pedir um orçamento', { id: 'como-pedir' })}
  <ol class="passos">${passos}</ol>
</section>
<section class="container secao" aria-labelledby="linhas">
  ${tituloSecao('O que você encontra', { id: 'linhas', sub: `${plural(totais.produtos, 'produto', 'produtos')} em ${plural(totais.categorias, 'categoria', 'categorias')}, na mesma ordem do catálogo impresso.` })}
  <ul class="lista-categorias">${linhas}</ul>
</section>
<section class="container secao" aria-labelledby="dados">
  ${tituloSecao('Sobre este catálogo online', { id: 'dados' })}
  <div class="prosa">
    <p>Este site é gerado a partir do catálogo geral ${config.ano} e atualizado em ${escapeHtml(data)}. Funciona em qualquer celular ou computador, pode ser instalado como aplicativo e continua abrindo sem internet depois da primeira visita.</p>
    <p>Para integrações e planilhas, os dados estão disponíveis em <a href="${base}api/produtos.json">JSON</a> e <a href="${base}api/produtos.csv">CSV</a>. ${escapeHtml(config.avisos)}</p>
  </div>
</section>
${faixaWhatsApp(ctx)}`;
  return [{
    caminho: 'sobre/',
    prioridade: 0.5,
    freq: 'monthly',
    html: {
      titulo: 'Sobre e contato',
      descricao: `${config.sobre.paragrafos[0]} Atendimento pelo WhatsApp ${config.whatsapp.exibicao}.`,
      caminho: 'sobre/',
      classe: 'pagina-sobre',
      corpo,
      jsonld: [jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, { nome: 'Sobre', url: urlAbs('sobre/') }]))],
    },
  }];
}
