// Busca, filtros e ordenação nas páginas de listagem (catálogo, categoria, montadora).
import { BASE, carregarProdutos, toast } from './app.js';
import { buscar } from './lib/busca.js';
import { cardProduto } from './lib/card.js';
import { plural } from './lib/util.js';

const raiz = document.querySelector('[data-listagem]');
if (raiz) iniciar(raiz);

function iniciar(raiz) {
  const escopo = raiz.dataset.escopo;
  const fixo = { categoria: raiz.dataset.categoria || null, subgrupo: raiz.dataset.subgrupo || null, montadora: raiz.dataset.montadora || null };
  const el = {
    busca: raiz.querySelector('[data-filtro-busca]'),
    categoria: raiz.querySelector('[data-filtro-categoria]'),
    ordem: raiz.querySelector('[data-filtro-ordem]'),
    chips: raiz.querySelector('[data-chips-montadora]'),
    chipsModelo: raiz.querySelector('[data-chips-modelo]'),
    // Na página de montadora as seções têm grades próprias; a busca usa a grade dedicada.
    grade: raiz.querySelector('[data-grade-busca]') || raiz.querySelector('[data-grade]'),
    secoes: raiz.querySelector('[data-secoes]'),
    resultado: raiz.querySelector('[data-resultado]'),
    vazio: raiz.querySelector('[data-vazio]'),
    mais: raiz.querySelector('[data-mostrar-mais]'),
    form: raiz.querySelector('[data-barra-listagem]'),
    visual: [...raiz.querySelectorAll('[data-visual]')],
  };
  const LOTE = 96;
  const estado = { q: '', c: fixo.categoria, m: fixo.montadora, ord: '', limite: LOTE };
  let dados = null;
  let aliases = null;
  let interagiu = false;
  let timer = null;

  // Estado inicial pela URL
  const url = new URL(location.href);
  estado.q = (url.searchParams.get('q') || '').slice(0, 80);
  estado.ord = ['nome', 'codigo'].includes(url.searchParams.get('ord')) ? url.searchParams.get('ord') : '';
  if (escopo === 'catalogo') {
    estado.c = url.searchParams.get('c') || null;
    estado.m = url.searchParams.get('m') || null;
  } else if (escopo === 'categoria') {
    estado.m = url.searchParams.get('m') || null;
  }
  if (el.busca) el.busca.value = estado.q;
  if (el.ordem) el.ordem.value = estado.ord;
  if (el.categoria && estado.c) el.categoria.value = estado.c;

  // Visual (grade/lista) persistido
  let visual = 'grade';
  try { visual = localStorage.getItem('luretec.visual') === 'lista' ? 'lista' : 'grade'; } catch { /* ignora */ }
  aplicarVisual(visual);

  function aplicarVisual(v) {
    visual = v;
    for (const g of raiz.querySelectorAll('.grade')) g.classList.toggle('grade--lista', v === 'lista');
    for (const b of el.visual) b.setAttribute('aria-pressed', String(b.dataset.visual === v));
    try { localStorage.setItem('luretec.visual', v); } catch { /* ignora */ }
  }

  async function garantirDados() {
    if (!dados) {
      dados = await carregarProdutos();
      // Aliases de categoria (links antigos: ?c=maq)
      if (escopo === 'catalogo' && estado.c && !dados.produtos.some((p) => p.categoria === estado.c)) {
        try {
          const cats = (await fetch(`${BASE}api/categorias.json`).then((r) => r.json())).categorias || [];
          aliases = new Map(cats.flatMap((c) => (c.alias || []).map((a) => [a, c.id])));
          if (aliases.has(estado.c)) estado.c = aliases.get(estado.c);
          if (el.categoria) el.categoria.value = estado.c || '';
        } catch { /* mantém */ }
      }
    }
    return dados;
  }

  function sincronizarUrl() {
    const u = new URL(location.href);
    const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('q', estado.q);
    set('ord', estado.ord);
    if (escopo === 'catalogo') set('c', estado.c);
    if (escopo !== 'montadora') set('m', estado.m);
    history.replaceState(null, '', u);
  }

  function atualizarChips() {
    if (!el.chips) return;
    for (const a of el.chips.querySelectorAll('.chip')) {
      const href = new URL(a.getAttribute('href'), location.href);
      if (href.pathname !== location.pathname) continue; // chips de subgrupo navegam para outra página
      const m = href.searchParams.get('m');
      const ativo = (m || null) === (estado.m || null);
      a.classList.toggle('chip--ativo', ativo);
      if (ativo) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
  }

  async function render(anunciar = true) {
    let d;
    try { d = await garantirDados(); } catch { toast('Não foi possível carregar o catálogo para filtrar. Verifique a conexão.', { erro: true }); return; }
    const filtros = { categoria: estado.c || fixo.categoria || undefined, subgrupo: fixo.subgrupo || undefined, montadora: estado.m || fixo.montadora || undefined, ordem: estado.ord || undefined };
    const lista = buscar(d.indice, estado.q, filtros);
    const semFiltro = !estado.q && !estado.ord && (escopo !== 'catalogo' || !estado.c) && !(estado.m && !fixo.montadora);

    if (escopo === 'montadora' && el.secoes) {
      // Sem termo: mostra as seções por categoria (HTML original). Com termo: grade única de resultados.
      el.secoes.hidden = !semFiltro;
      el.grade.hidden = semFiltro;
      if (semFiltro) { el.resultado.textContent = plural(lista.length, 'produto', 'produtos'); el.vazio.hidden = true; sincronizarUrl(); return; }
    }
    const visiveis = lista.slice(0, estado.limite);
    el.grade.innerHTML = visiveis.map((p) => cardProduto(p, { base: BASE })).join('');
    el.grade.classList.toggle('grade--lista', visual === 'lista');
    el.vazio.hidden = lista.length > 0;
    if (el.mais) el.mais.hidden = lista.length <= estado.limite;
    if (anunciar) {
      const termo = estado.q ? ` para “${estado.q}”` : '';
      el.resultado.textContent = `${plural(lista.length, 'produto', 'produtos')}${termo}${lista.length > estado.limite ? ` · mostrando ${estado.limite}` : ''}`;
    }
    atualizarChips();
    sincronizarUrl();
  }

  function agendar() {
    interagiu = true;
    estado.limite = LOTE;
    clearTimeout(timer);
    timer = setTimeout(() => render(), 160);
  }

  el.busca?.addEventListener('input', () => { estado.q = el.busca.value.trim().slice(0, 80); agendar(); });
  el.form?.addEventListener('submit', (e) => { e.preventDefault(); estado.q = (el.busca?.value || '').trim().slice(0, 80); clearTimeout(timer); estado.limite = LOTE; render(); });
  el.ordem?.addEventListener('change', () => { estado.ord = el.ordem.value; agendar(); });
  el.categoria?.addEventListener('change', () => { estado.c = el.categoria.value || null; agendar(); });
  el.chips?.addEventListener('click', (e) => {
    const a = e.target.closest('.chip');
    if (!a) return;
    const href = new URL(a.getAttribute('href'), location.href);
    if (href.pathname !== location.pathname) return; // deixa navegar (subgrupo)
    e.preventDefault();
    estado.m = href.searchParams.get('m') || null;
    agendar();
  });
  el.chipsModelo?.addEventListener('click', (e) => {
    const a = e.target.closest('.chip');
    if (!a) return;
    e.preventDefault();
    const href = new URL(a.getAttribute('href'), location.href);
    estado.q = href.searchParams.get('q') || '';
    if (el.busca) el.busca.value = estado.q;
    agendar();
    el.busca?.focus();
  });
  el.mais?.addEventListener('click', () => { estado.limite += LOTE; render(false); });
  for (const b of el.visual) b.addEventListener('click', () => aplicarVisual(b.dataset.visual));

  // Se a URL já traz filtros, aplica de imediato; senão, pré-carrega os dados em segundo plano.
  const temFiltroInicial = estado.q || estado.ord || (escopo === 'catalogo' && (estado.c || estado.m)) || (escopo === 'categoria' && estado.m);
  if (temFiltroInicial) render();
  else garantirDados().catch(() => {});
}
