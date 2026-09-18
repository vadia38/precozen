import { escapeHtml } from '../../public/js/lib/util.js';
import { icone, breadcrumb, linkWhatsAppSimples } from '../lib/html.js';

export function paginas(ctx) {
  const { base, config } = ctx;
  const corpo = `<section class="container orcamento" data-orcamento data-whatsapp="${config.whatsapp.numero}">
  ${breadcrumb(ctx, [{ nome: 'Meu orçamento', url: `${base}orcamento/` }])}
  <div class="orcamento__topo">
    <div>
      <h1>Meu orçamento</h1>
      <p>Os itens ficam salvos neste navegador. Revise as quantidades, preencha seus dados e envie a lista pelo WhatsApp: o atendimento responde com preços, prazos e disponibilidade.</p>
    </div>
    <a class="btn btn--contorno" href="${base}catalogo/">${icone('plus')} Adicionar mais itens</a>
  </div>
  <div class="aviso aviso--info" data-orcamento-compartilhado hidden>
    ${icone('share')}
    <div><strong>Você abriu uma lista compartilhada.</strong> <span data-compartilhado-resumo></span></div>
    <div class="aviso__acoes"><button type="button" class="btn btn--pequeno btn--primario" data-compartilhado-usar>Usar esta lista</button><button type="button" class="btn btn--pequeno btn--contorno" data-compartilhado-mesclar>Juntar com a minha</button><button type="button" class="btn btn--pequeno btn--contorno" data-compartilhado-ignorar>Ignorar</button></div>
  </div>
  <div class="orcamento__grid">
    <section class="orcamento__itens" aria-labelledby="titulo-itens">
      <div class="orcamento__cabecalho"><h2 id="titulo-itens">Itens <span class="badge badge--neutra" data-orcamento-contagem>0</span></h2><button type="button" class="btn btn--pequeno btn--perigo-contorno" data-limpar hidden>${icone('trash')} Limpar tudo</button></div>
      <div data-orcamento-lista>
        <p class="orcamento__vazio">Seu orçamento está vazio. Adicione itens pelo botão <strong>Orçamento</strong> nos produtos.<br><a class="btn btn--primario" href="${base}catalogo/">${icone('grid')} Explorar o catálogo</a></p>
      </div>
    </section>
    <aside class="orcamento__lateral" aria-labelledby="titulo-dados">
      <form class="orcamento__form" data-orcamento-form novalidate>
        <h2 id="titulo-dados">Seus dados</h2>
        <p class="ajuda">Opcionais, mas agilizam o atendimento. Ficam salvos só neste navegador.</p>
        <label class="campo"><span>Nome</span><input type="text" name="nome" maxlength="80" autocomplete="name"></label>
        <label class="campo"><span>Empresa</span><input type="text" name="empresa" maxlength="80" autocomplete="organization"></label>
        <label class="campo"><span>Telefone</span><input type="tel" name="telefone" maxlength="30" autocomplete="tel" inputmode="tel"></label>
        <label class="campo"><span>Cidade / UF</span><input type="text" name="cidade" maxlength="60" autocomplete="address-level2"></label>
        <label class="campo"><span>Observações</span><textarea name="observacoes" rows="3" maxlength="500" placeholder="Prazo, forma de entrega, referência de peça original…"></textarea></label>
        <div class="orcamento__botoes">
          <a class="btn btn--whatsapp btn--grande" href="${linkWhatsAppSimples(config)}" target="_blank" rel="noopener" data-enviar-whatsapp aria-disabled="true">${icone('whatsapp')} Enviar pelo WhatsApp</a>
          <button type="button" class="btn btn--contorno" data-copiar-texto disabled>${icone('copy')} Copiar texto</button>
          <button type="button" class="btn btn--contorno" data-imprimir disabled>${icone('printer')} Imprimir / PDF</button>
          <button type="button" class="btn btn--contorno" data-compartilhar-lista disabled>${icone('share')} Copiar link da lista</button>
        </div>
        <p class="ajuda">O catálogo não exibe preços. Os valores são informados pelo atendimento no retorno do orçamento.</p>
      </form>
    </aside>
  </div>
  <noscript><p class="aviso aviso--alerta">O orçamento online precisa de JavaScript. Você também pode enviar sua lista direto pelo <a href="${linkWhatsAppSimples(config)}">WhatsApp ${escapeHtml(config.whatsapp.exibicao)}</a>.</p></noscript>
  <section class="orcamento__impressao" data-impressao hidden aria-hidden="true"></section>
</section>`;
  return [{
    caminho: 'orcamento/',
    prioridade: null,
    html: {
      titulo: 'Meu orçamento',
      descricao: `Monte sua lista de peças e envie pelo WhatsApp ${config.whatsapp.exibicao}.`,
      caminho: 'orcamento/',
      classe: 'pagina-orcamento',
      corpo,
      scripts: ['orcamento.js'],
      noindex: true,
    },
  }];
}
