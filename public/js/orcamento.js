// Página "Meu orçamento": lista de itens, dados do cliente, envio por WhatsApp, cópia, impressão e link compartilhável.
import { BASE, orcamento, carregarProdutos, toast, copiar } from './app.js';
import { escapeHtml, plural, codigoValido } from './lib/util.js';
import { montarMensagem, linkWhatsApp, serializarItens, parseItens, totalUnidades, qtdValida, limparCliente } from './lib/orcamento.js';

const raiz = document.querySelector('[data-orcamento]');
if (raiz) iniciar(raiz);

function iniciar(raiz) {
  const numero = raiz.dataset.whatsapp;
  const el = {
    lista: raiz.querySelector('[data-orcamento-lista]'),
    contagem: raiz.querySelector('[data-orcamento-contagem]'),
    limpar: raiz.querySelector('[data-limpar]'),
    form: raiz.querySelector('[data-orcamento-form]'),
    zap: raiz.querySelector('[data-enviar-whatsapp]'),
    copiarTexto: raiz.querySelector('[data-copiar-texto]'),
    imprimir: raiz.querySelector('[data-imprimir]'),
    compartilhar: raiz.querySelector('[data-compartilhar-lista]'),
    impressao: raiz.querySelector('[data-impressao]'),
    banner: raiz.querySelector('[data-orcamento-compartilhado]'),
    bannerResumo: raiz.querySelector('[data-compartilhado-resumo]'),
  };
  const vazioHtml = el.lista.innerHTML;
  let compartilhados = null;

  const urlLista = (itens) => `${location.origin}${BASE}orcamento/?itens=${encodeURIComponent(serializarItens(itens))}`;

  function lerCliente() {
    const f = new FormData(el.form);
    return limparCliente({ nome: f.get('nome'), empresa: f.get('empresa'), telefone: f.get('telefone'), cidade: f.get('cidade'), observacoes: f.get('observacoes') });
  }

  function preencherCliente(c) {
    for (const [k, v] of Object.entries(c)) { const campo = el.form.elements[k]; if (campo) campo.value = v || ''; }
  }

  function itemHtml(i) {
    const img = i.imagem ? `<img src="${BASE}img/produtos/${escapeHtml(i.imagem)}" alt="" loading="lazy" width="88" height="66">` : '';
    const url = `${BASE}produto/${encodeURIComponent(i.codigo)}/`;
    return `<li class="item-orc" data-item="${escapeHtml(i.codigo)}">
      <a class="item-orc__foto" href="${url}" tabindex="-1" aria-hidden="true">${img}</a>
      <div class="item-orc__info">
        <a href="${url}">${escapeHtml(i.nome)}</a>
        <div class="item-orc__meta"><span class="codigo">${escapeHtml(i.codigo)}</span>${i.ref ? `<span class="ref">REF. ${escapeHtml(i.ref)}</span>` : ''}${i.categoriaNome ? `<span>${escapeHtml(i.categoriaNome)}</span>` : ''}</div>
      </div>
      <div class="item-orc__acoes">
        <div class="qtd" role="group" aria-label="Quantidade de ${escapeHtml(i.codigo)}">
          <button type="button" class="btn-icone" data-menos aria-label="Diminuir"><svg class="icone" aria-hidden="true"><use href="#i-minus"></use></svg></button>
          <input type="number" inputmode="numeric" min="1" max="9999" value="${i.qtd}" data-qtd-item aria-label="Quantidade">
          <button type="button" class="btn-icone" data-mais aria-label="Aumentar"><svg class="icone" aria-hidden="true"><use href="#i-plus"></use></svg></button>
        </div>
        <button type="button" class="btn-icone item-orc__remover" data-remover aria-label="Remover ${escapeHtml(i.codigo)}"><svg class="icone" aria-hidden="true"><use href="#i-trash"></use></svg></button>
      </div>
    </li>`;
  }

  function render(d = orcamento.ler()) {
    const n = d.itens.length;
    el.contagem.textContent = String(n);
    el.limpar.hidden = n === 0;
    el.lista.innerHTML = n ? `<ul class="itens-orc">${d.itens.map(itemHtml).join('')}</ul><p class="ajuda">${plural(n, 'item', 'itens')} · ${plural(totalUnidades(d.itens), 'unidade', 'unidades')}</p>` : vazioHtml;
    const texto = montarMensagem({ itens: d.itens, cliente: d.cliente, urlCompartilhar: n ? urlLista(d.itens) : '' });
    el.zap.href = linkWhatsApp(numero, n ? texto : 'Olá! Vim pelo catálogo online da Luretec e gostaria de um orçamento.');
    el.zap.setAttribute('aria-disabled', String(n === 0));
    for (const b of [el.copiarTexto, el.imprimir, el.compartilhar]) b.disabled = n === 0;
    document.title = n ? `Meu orçamento (${n}) · Catálogo Luretec 2026` : 'Meu orçamento · Catálogo Luretec 2026';
  }

  el.lista.addEventListener('click', (e) => {
    const li = e.target.closest('[data-item]');
    if (!li) return;
    const codigo = li.dataset.item;
    const campo = li.querySelector('[data-qtd-item]');
    if (e.target.closest('[data-menos]')) orcamento.definirQtd(codigo, qtdValida(campo.value) - 1 || 1);
    else if (e.target.closest('[data-mais]')) orcamento.definirQtd(codigo, qtdValida(campo.value) + 1);
    else if (e.target.closest('[data-remover]')) { orcamento.remover(codigo); toast(`${codigo} removido.`); }
  });
  el.lista.addEventListener('change', (e) => {
    const campo = e.target.closest('[data-qtd-item]');
    if (campo) orcamento.definirQtd(campo.closest('[data-item]').dataset.item, campo.value);
  });
  el.limpar.addEventListener('click', () => {
    if (window.confirm('Remover todos os itens do orçamento?')) { orcamento.limpar(); toast('Orçamento limpo.'); }
  });

  let timerCliente = null;
  el.form.addEventListener('input', () => { clearTimeout(timerCliente); timerCliente = setTimeout(() => orcamento.salvarCliente(lerCliente()), 300); });
  el.form.addEventListener('submit', (e) => e.preventDefault());

  el.copiarTexto.addEventListener('click', () => {
    const d = orcamento.ler();
    copiar(montarMensagem({ itens: d.itens, cliente: d.cliente, urlCompartilhar: urlLista(d.itens) }), 'Texto do orçamento copiado!');
  });
  el.compartilhar.addEventListener('click', () => copiar(urlLista(orcamento.ler().itens), 'Link da lista copiado! Quem abrir pode importar os itens.'));
  el.imprimir.addEventListener('click', () => {
    const d = orcamento.ler();
    const c = d.cliente;
    const dados = [c.nome, c.empresa, c.telefone, c.cidade].filter(Boolean).map(escapeHtml).join(' · ');
    el.impressao.innerHTML = `<h1>Orçamento — Catálogo Luretec 2026</h1>
      <p>${dados ? `Cliente: ${dados}<br>` : ''}Data: ${escapeHtml(new Date().toLocaleDateString('pt-BR'))} · ${plural(d.itens.length, 'item', 'itens')}</p>
      <table><thead><tr><th>#</th><th>Foto</th><th>Código</th><th>Produto</th><th>Ref.</th><th>Qtd.</th></tr></thead><tbody>
      ${d.itens.map((i, k) => `<tr><td>${k + 1}</td><td>${i.imagem ? `<img src="${BASE}img/produtos/${escapeHtml(i.imagem)}" alt="">` : ''}</td><td>${escapeHtml(i.codigo)}</td><td>${escapeHtml(i.nome)}</td><td>${escapeHtml(i.ref || '')}</td><td>${i.qtd}</td></tr>`).join('')}
      </tbody></table>${c.observacoes ? `<p>Obs.: ${escapeHtml(c.observacoes)}</p>` : ''}<p>WhatsApp +55 11 97383-1508 · ${escapeHtml(location.origin + BASE)}</p>`;
    el.impressao.hidden = false;
    el.impressao.removeAttribute('aria-hidden');
    window.print();
    setTimeout(() => { el.impressao.hidden = true; el.impressao.setAttribute('aria-hidden', 'true'); }, 500);
  });

  document.addEventListener('orcamento:mudou', (e) => render(e.detail));

  // Links antigos (?p=CODIGO) e listas compartilhadas (?itens=...)
  async function tratarParametros() {
    const url = new URL(location.href);
    const p = url.searchParams.get('p');
    const itensParam = url.searchParams.get('itens');
    if (!p && !itensParam) return;
    let dados = null;
    try { dados = await carregarProdutos(); } catch { toast('Não foi possível carregar os dados dos produtos.', { erro: true }); }
    const resolver = (codigo, qtd) => {
      const prod = dados?.mapa.get(codigo);
      return { codigo, qtd, nome: prod?.nome || codigo, ref: prod?.ref || null, imagem: prod?.imagem?.arquivo || null, categoriaNome: prod?.categoriaNome || '' };
    };
    if (p && codigoValido(p)) {
      orcamento.adicionar(resolver(p, 1), 1);
      toast(`${p} adicionado ao orçamento.`);
    }
    if (itensParam) {
      const lista = parseItens(itensParam).filter((i) => !dados || dados.mapa.has(i.codigo)).map((i) => resolver(i.codigo, i.qtd));
      if (lista.length) {
        compartilhados = lista;
        el.bannerResumo.textContent = `${plural(lista.length, 'item', 'itens')}: ${lista.slice(0, 5).map((i) => i.codigo).join(', ')}${lista.length > 5 ? '…' : ''}.`;
        el.banner.hidden = false;
      } else toast('A lista compartilhada não tem itens válidos.', { erro: true });
    }
    url.searchParams.delete('p');
    url.searchParams.delete('itens');
    history.replaceState(null, '', url);
  }
  raiz.querySelector('[data-compartilhado-usar]')?.addEventListener('click', () => { if (compartilhados) { orcamento.substituir(compartilhados); el.banner.hidden = true; toast('Lista importada.'); } });
  raiz.querySelector('[data-compartilhado-mesclar]')?.addEventListener('click', () => { if (compartilhados) { orcamento.mesclar(compartilhados); el.banner.hidden = true; toast('Itens juntados ao seu orçamento.'); } });
  raiz.querySelector('[data-compartilhado-ignorar]')?.addEventListener('click', () => { el.banner.hidden = true; compartilhados = null; });

  const inicial = orcamento.ler();
  preencherCliente(inicial.cliente);
  render(inicial);
  tratarParametros();
}
