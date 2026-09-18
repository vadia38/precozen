import { escapeHtml } from '../../public/js/lib/util.js';
import { gradeProdutos } from '../../public/js/lib/card.js';
import { icone, breadcrumb, chip, faixaWhatsApp, tituloSecao, linkWhatsAppSimples } from '../lib/html.js';
import { jsonLd, ldBreadcrumb, ldProduto, descricaoProduto } from '../lib/seo.js';

const ROTULOS = {
  lado: 'Lado', posicao: 'Posição', tipo: 'Tipo', pinos: 'Pinos', portas: 'Portas', motor: 'Motor', voltagem: 'Tensão',
  potencia: 'Potência', corrente: 'Corrente', temperaturaCor: 'Temperatura de cor', medida: 'Medida', comprimento: 'Comprimento', polegadas: 'Tamanho', cor: 'Cor',
};

/** Produtos relacionados: mesma categoria, priorizando subgrupo, modelos e montadoras em comum. */
export function relacionados(p, produtos, limite = 8) {
  const pontuar = (o) => {
    let s = 0;
    if (p.subgrupo && o.subgrupo === p.subgrupo) s += 3;
    s += o.modelos.filter((m) => p.modelos.includes(m)).length * 2;
    s += o.montadoras.filter((m) => p.montadoras.includes(m)).length;
    return s;
  };
  return produtos
    .filter((o) => o.codigo !== p.codigo && o.categoria === p.categoria)
    .map((o) => ({ o, s: pontuar(o), d: Math.abs((o.ordem || 0) - (p.ordem || 0)) }))
    .sort((a, b) => b.s - a.s || a.d - b.d)
    .slice(0, limite)
    .map((r) => r.o);
}

function paginaProduto(ctx, p, anterior, proximo) {
  const { base, config, categorias, produtos, urlAbs } = ctx;
  const cat = categorias.find((c) => c.id === p.categoria);
  const sub = cat?.subgrupos.find((s) => s.id === p.subgrupo);
  const caminho = `produto/${encodeURIComponent(p.codigo)}/`;
  const trilha = [{ nome: 'Catálogo', url: `${base}catalogo/` }, { nome: cat.nome, url: `${base}categoria/${cat.id}/` }];
  if (sub) trilha.push({ nome: sub.nome, url: `${base}categoria/${cat.id}/${sub.id}/` });
  trilha.push({ nome: p.codigo, url: `${base}${caminho}` });

  const foto = p.imagem
    ? `<button type="button" class="produto__zoom" data-zoom="${base}img/produtos/${escapeHtml(p.imagem.arquivo)}" aria-label="Ampliar foto de ${escapeHtml(p.nome)}">
        <img src="${base}img/produtos/${escapeHtml(p.imagem.arquivo)}" alt="${escapeHtml(p.nome)}" width="${p.imagem.largura}" height="${p.imagem.altura}" fetchpriority="high" decoding="async">
        <span class="produto__zoom-dica">${icone('zoom')} Ampliar</span>
      </button>`
    : `<div class="produto__sem-foto">Sem foto</div>`;

  const montadoras = p.montadoras.map((id, i) => chip({ url: `${base}montadora/${id}/`, rotulo: p.montadorasNome[i], icone: 'carro' })).join('');
  const modelos = p.modelos.map((m) => chip({ url: `${base}catalogo/?q=${encodeURIComponent(m)}`, rotulo: m })).join('');
  const atributos = Object.entries(p.atributos)
    .filter(([k]) => ROTULOS[k])
    .map(([k, v]) => `<div><dt>${ROTULOS[k]}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');
  const tags = p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const textoZap = `${config.whatsapp.saudacao} Item: ${p.codigo} — ${p.nome}${p.ref ? ` (REF. ${p.ref})` : ''}.`;
  const rel = relacionados(p, produtos);

  const corpo = `<section class="container produto" data-produto="${escapeHtml(p.codigo)}">
  ${breadcrumb(ctx, trilha)}
  <div class="produto__grid">
    <div class="produto__foto">${foto}<p class="produto__aviso">${escapeHtml(config.avisos)}</p></div>
    <div class="produto__info">
      <div class="produto__ids"><span class="codigo codigo--grande">${escapeHtml(p.codigo)}</span>${p.ref ? `<span class="ref">REF. ${escapeHtml(p.ref)}</span>` : ''}</div>
      <h1>${escapeHtml(p.nome)}</h1>
      <p class="produto__categoria">${icone(cat.icone)} <a href="${base}categoria/${cat.id}/">${escapeHtml(cat.nome)}</a>${sub ? ` <span aria-hidden="true">›</span> <a href="${base}categoria/${cat.id}/${sub.id}/">${escapeHtml(sub.nome)}</a>` : ''}</p>
      ${montadoras || modelos || tags ? `<div class="produto__aplicacao"><h2 class="rotulo">Aplicação</h2><div class="chips">${montadoras}${modelos}${tags}</div></div>` : ''}
      ${atributos ? `<dl class="produto__atributos">${atributos}</dl>` : ''}
      <div class="produto__acoes">
        <div class="qtd" role="group" aria-label="Quantidade">
          <button type="button" class="btn-icone" data-qtd-menos aria-label="Diminuir quantidade">${icone('minus')}</button>
          <label class="sr-only" for="qtd-produto">Quantidade</label>
          <input id="qtd-produto" type="number" inputmode="numeric" min="1" max="9999" value="1" data-qtd>
          <button type="button" class="btn-icone" data-qtd-mais aria-label="Aumentar quantidade">${icone('plus')}</button>
        </div>
        <button type="button" class="btn btn--primario btn--grande" data-adicionar="${escapeHtml(p.codigo)}" data-usa-qtd>${icone('orcamento')} Adicionar ao orçamento</button>
      </div>
      <div class="produto__util">
        <a class="btn btn--whatsapp" href="${linkWhatsAppSimples(config, textoZap)}" target="_blank" rel="noopener">${icone('whatsapp')} Pedir orçamento deste item</a>
        <button type="button" class="btn btn--contorno" data-copiar-link>${icone('copy')} Copiar link</button>
        <button type="button" class="btn btn--contorno" data-compartilhar hidden>${icone('share')} Compartilhar</button>
        ${p.pagina ? `<a class="btn btn--contorno" href="${base}${escapeHtml(config.pdf.arquivo)}#page=${Number(p.pagina)}" target="_blank" rel="noopener">${icone('pdf')} Ver no PDF (pág. ${p.pagina})</a>` : ''}
      </div>
      <p class="produto__ajuda">${icone('info')} Dúvida sobre a aplicação? Envie a foto da peça original pelo WhatsApp e o atendimento confere a compatibilidade.</p>
    </div>
  </div>
  <nav class="produto__nav" aria-label="Navegar no catálogo">
    ${anterior ? `<a href="${base}produto/${encodeURIComponent(anterior.codigo)}/" rel="prev">${icone('chevron-left')}<span><small>Anterior</small>${escapeHtml(anterior.codigo)} · ${escapeHtml(anterior.nome)}</span></a>` : '<span></span>'}
    ${proximo ? `<a href="${base}produto/${encodeURIComponent(proximo.codigo)}/" rel="next"><span><small>Próximo</small>${escapeHtml(proximo.codigo)} · ${escapeHtml(proximo.nome)}</span>${icone('chevron-right')}</a>` : '<span></span>'}
  </nav>
</section>
${rel.length ? `<section class="secao container" aria-labelledby="relacionados">
  ${tituloSecao('Produtos relacionados', { id: 'relacionados', url: `${base}categoria/${cat.id}/`, rotuloUrl: `Ver ${cat.nome}` })}
  <div class="grade">${gradeProdutos(rel, { base })}</div>
</section>` : ''}
${faixaWhatsApp(ctx)}`;

  const tituloPagina = `${p.codigo} · ${p.nome}`;
  return {
    caminho,
    prioridade: 0.6,
    freq: 'monthly',
    html: {
      titulo: tituloPagina,
      descricao: descricaoProduto(p, config),
      caminho,
      classe: 'pagina-produto',
      corpo,
      scripts: ['produto.js'],
      ogImagem: p.imagem ? urlAbs(`img/produtos/${p.imagem.arquivo}`) : undefined,
      jsonld: [
        jsonLd(ldProduto(p, config, urlAbs)),
        jsonLd(ldBreadcrumb([{ nome: 'Início', url: urlAbs('') }, ...trilha.map((t) => ({ nome: t.nome, url: urlAbs(t.url.slice(base.length)) }))])),
      ],
    },
  };
}

export function paginas(ctx) {
  const lista = [...ctx.produtos].sort((a, b) => a.ordem - b.ordem);
  return lista.map((p, i) => paginaProduto(ctx, p, lista[i - 1], lista[i + 1]));
}
