import { escapeHtml } from '../../public/js/lib/util.js';
import { icone, linkWhatsAppSimples } from '../lib/html.js';

export function paginas(ctx) {
  const { base, config, categorias } = ctx;
  const cats = categorias.map((c) => `<a class="chip" href="${base}categoria/${c.id}/">${icone(c.icone)}<span>${escapeHtml(c.nome)}</span></a>`).join('');
  const naoEncontrada = `<section class="container pagina-erro" data-pagina-404>
  <p class="eyebrow">Erro 404</p>
  <h1>Página não encontrada</h1>
  <p>O endereço pode ter mudado ou o produto saiu do catálogo. Busque pelo código ou navegue pelas categorias.</p>
  <form class="hero__busca hero__busca--compacta" role="search" action="${base}catalogo/" method="get">
    <label class="sr-only" for="q-404">Buscar</label>${icone('search')}
    <input id="q-404" name="q" type="search" placeholder="Código, referência ou nome…" maxlength="80">
    <button type="submit" class="btn btn--primario">Buscar</button>
  </form>
  <div class="chips chips--grande">${cats}</div>
  <p><a class="btn btn--contorno" href="${base}">${icone('home')} Voltar ao início</a></p>
</section>`;
  const offline = `<section class="container pagina-erro">
  <p class="eyebrow">Sem conexão</p>
  <h1>${icone('wifi-off', 'icone icone--grande')} Você está offline</h1>
  <p>Esta página ainda não foi salva no seu aparelho. As páginas que você já visitou continuam disponíveis, e o seu orçamento fica guardado no navegador.</p>
  <p><a class="btn btn--primario" href="${base}">${icone('home')} Ir para o início</a> <a class="btn btn--contorno" href="${base}orcamento/">${icone('orcamento')} Meu orçamento</a></p>
  <p class="ajuda">Sem internet você ainda pode ligar para o atendimento: ${escapeHtml(config.whatsapp.exibicao)}. <a href="${linkWhatsAppSimples(config)}" rel="noopener">WhatsApp</a></p>
</section>`;
  return [
    { caminho: '404.html', prioridade: null, html: { titulo: 'Página não encontrada', caminho: '404.html', classe: 'pagina-404', corpo: naoEncontrada, noindex: true } },
    { caminho: 'offline.html', prioridade: null, html: { titulo: 'Você está offline', caminho: 'offline.html', classe: 'pagina-offline', corpo: offline, noindex: true } },
  ];
}
