// Card de produto. Isomórfico: o gerador renderiza o HTML inicial e o navegador
// re-renderiza os resultados da busca com a mesma função.
import { escapeHtml } from './util.js';

/**
 * @param {object} p produto enriquecido (dist/api/produtos.json)
 * @param {object} opcoes { base: '/', lazy: true, prioridade: false }
 */
export function cardProduto(p, opcoes = {}) {
  const base = opcoes.base ?? '/';
  const lazy = opcoes.lazy ?? true;
  const url = `${base}produto/${encodeURIComponent(p.codigo)}/`;
  const img = p.imagem;
  const imagem = img
    ? `<img src="${base}img/produtos/${escapeHtml(img.arquivo)}" alt="${escapeHtml(p.nome)}" width="${img.largura}" height="${img.altura}" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>`
    : `<span class="card__sem-foto" aria-hidden="true">Sem foto</span>`;
  const ref = p.ref ? `<span class="card__ref">REF. ${escapeHtml(p.ref)}</span>` : '';
  const montadora = p.montadorasNome && p.montadorasNome.length
    ? `<span class="card__meta">${escapeHtml(p.montadorasNome.slice(0, 2).join(' · '))}</span>`
    : `<span class="card__meta">${escapeHtml(p.categoriaNome || '')}</span>`;
  return `<article class="card" data-codigo="${escapeHtml(p.codigo)}">
  <a class="card__foto" href="${url}" tabindex="-1" aria-hidden="true">${imagem}</a>
  <div class="card__corpo">
    <span class="codigo">${escapeHtml(p.codigo)}</span>
    <h3 class="card__titulo"><a href="${url}">${escapeHtml(p.nome)}</a></h3>
    <div class="card__linha">${ref}${montadora}</div>
  </div>
  <div class="card__acoes">
    <button type="button" class="btn btn--pequeno btn--contorno" data-adicionar="${escapeHtml(p.codigo)}" aria-label="Adicionar ${escapeHtml(p.codigo)} ao orçamento">
      <svg class="icone" aria-hidden="true"><use href="#i-plus"></use></svg><span>Orçamento</span>
    </button>
  </div>
</article>`;
}

/** Grade de cards. */
export function gradeProdutos(produtos, opcoes = {}) {
  return produtos.map((p, i) => cardProduto(p, { ...opcoes, lazy: opcoes.lazy ?? i > 7 })).join('\n');
}
