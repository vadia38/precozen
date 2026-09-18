// Comportamentos comuns a todas as páginas: tema, menus, orçamento (badge e botões "adicionar"),
// sugestões da busca do topo, zoom de foto, copiar/compartilhar e registro do service worker.
import { escapeHtml, codigoValido } from './lib/util.js';
import { CHAVE_ORCAMENTO, ITENS_MAXIMOS, qtdValida, limparCliente } from './lib/orcamento.js';
import { criarIndice, sugerir } from './lib/busca.js';

export const BASE = document.documentElement.dataset.base || '/';
document.documentElement.classList.add('js-ativo');

/* ---------------- Toasts ---------------- */
export function toast(mensagem, opcoes = {}) {
  const host = document.querySelector('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast${opcoes.erro ? ' toast--erro' : ''}`;
  const acao = opcoes.acao ? `<a href="${escapeHtml(opcoes.acao.href)}">${escapeHtml(opcoes.acao.rotulo)}</a>` : '';
  el.innerHTML = `<span>${escapeHtml(mensagem)}</span>${acao}`;
  host.appendChild(el);
  setTimeout(() => el.remove(), opcoes.duracao || 3500);
}

/* ---------------- Dados (API) ---------------- */
let promessaProdutos = null;
export function carregarProdutos() {
  if (!promessaProdutos) {
    promessaProdutos = fetch(`${BASE}api/produtos.json`, { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j) => {
        const produtos = Array.isArray(j.produtos) ? j.produtos : [];
        return { produtos, mapa: new Map(produtos.map((p) => [p.codigo, p])), indice: criarIndice(produtos) };
      })
      .catch((e) => { promessaProdutos = null; throw e; });
  }
  return promessaProdutos;
}

/* ---------------- Orçamento (armazenamento) ---------------- */
function vazio() { return { itens: [], cliente: limparCliente({}), atualizadoEm: null }; }

function sanearItem(i) {
  if (!i || !codigoValido(i.codigo)) return null;
  const arquivoOk = typeof i.imagem === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(i.imagem);
  return {
    codigo: String(i.codigo),
    qtd: qtdValida(i.qtd),
    nome: String(i.nome ?? '').slice(0, 140) || String(i.codigo),
    ref: i.ref ? String(i.ref).slice(0, 40) : null,
    imagem: arquivoOk ? i.imagem : null,
    categoriaNome: String(i.categoriaNome ?? '').slice(0, 60),
  };
}

function sanear(d) {
  if (!d || typeof d !== 'object') return vazio();
  const itens = [];
  const vistos = new Set();
  for (const i of Array.isArray(d.itens) ? d.itens : []) {
    const s = sanearItem(i);
    if (s && !vistos.has(s.codigo)) { vistos.add(s.codigo); itens.push(s); }
    if (itens.length >= ITENS_MAXIMOS) break;
  }
  return { itens, cliente: limparCliente(d.cliente || {}), atualizadoEm: typeof d.atualizadoEm === 'string' ? d.atualizadoEm : null };
}

function ler() {
  try { return sanear(JSON.parse(localStorage.getItem(CHAVE_ORCAMENTO) || 'null')); } catch { return vazio(); }
}
function gravar(d) {
  d.atualizadoEm = new Date().toISOString();
  try { localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify(d)); } catch { toast('Não foi possível salvar o orçamento neste navegador.', { erro: true }); }
  document.dispatchEvent(new CustomEvent('orcamento:mudou', { detail: d }));
  atualizarBadge(d);
}

export const orcamento = {
  ler,
  adicionar(produto, qtd = 1) {
    const d = ler();
    const existente = d.itens.find((i) => i.codigo === produto.codigo);
    if (existente) existente.qtd = qtdValida(existente.qtd + qtdValida(qtd));
    else {
      if (d.itens.length >= ITENS_MAXIMOS) { toast(`Limite de ${ITENS_MAXIMOS} itens por orçamento.`, { erro: true }); return d; }
      d.itens.push(sanearItem({ ...produto, qtd }));
    }
    gravar(d);
    return d;
  },
  definirQtd(codigo, qtd) {
    const d = ler();
    const it = d.itens.find((i) => i.codigo === codigo);
    if (it) { it.qtd = qtdValida(qtd); gravar(d); }
    return d;
  },
  remover(codigo) { const d = ler(); d.itens = d.itens.filter((i) => i.codigo !== codigo); gravar(d); return d; },
  limpar() { const d = ler(); d.itens = []; gravar(d); return d; },
  substituir(itens) { const d = ler(); d.itens = sanear({ itens }).itens; gravar(d); return d; },
  mesclar(itens) {
    const d = ler();
    for (const novo of sanear({ itens }).itens) {
      const ex = d.itens.find((i) => i.codigo === novo.codigo);
      if (ex) ex.qtd = qtdValida(ex.qtd + novo.qtd);
      else if (d.itens.length < ITENS_MAXIMOS) d.itens.push(novo);
    }
    gravar(d);
    return d;
  },
  salvarCliente(cliente) { const d = ler(); d.cliente = limparCliente(cliente); gravar(d); return d; },
};

export function atualizarBadge(d = ler()) {
  for (const b of document.querySelectorAll('[data-badge-orcamento]')) {
    const n = d.itens.length;
    b.textContent = String(n);
    b.hidden = n === 0;
  }
}

/** Extrai os dados de um produto a partir do DOM (card ou página do produto). */
function produtoDoDom(botao) {
  const card = botao.closest('.card');
  if (card) {
    const img = card.querySelector('.card__foto img');
    return {
      codigo: card.dataset.codigo,
      nome: card.querySelector('.card__titulo')?.textContent.trim(),
      ref: card.querySelector('.card__ref')?.textContent.replace(/^REF\.\s*/, '').trim() || null,
      imagem: img ? img.getAttribute('src').split('/').pop() : null,
      categoriaNome: card.querySelector('.card__meta')?.textContent.trim() || '',
    };
  }
  const pagina = botao.closest('[data-produto]');
  if (pagina) {
    const img = pagina.querySelector('.produto__zoom img');
    return {
      codigo: pagina.dataset.produto,
      nome: pagina.querySelector('h1')?.textContent.trim(),
      ref: pagina.querySelector('.produto__ids .ref')?.textContent.replace(/^REF\.\s*/, '').trim() || null,
      imagem: img ? img.getAttribute('src').split('/').pop() : null,
      categoriaNome: pagina.querySelector('.produto__categoria a')?.textContent.trim() || '',
    };
  }
  return null;
}

async function aoAdicionar(botao) {
  const codigo = botao.dataset.adicionar;
  let produto = produtoDoDom(botao);
  if (!produto || !produto.nome) {
    try { produto = (await carregarProdutos()).mapa.get(codigo); } catch { produto = null; }
    if (produto) produto = { codigo: produto.codigo, nome: produto.nome, ref: produto.ref, imagem: produto.imagem?.arquivo || null, categoriaNome: produto.categoriaNome };
  }
  if (!produto) { toast('Não foi possível adicionar este item.', { erro: true }); return; }
  let qtd = 1;
  if (botao.hasAttribute('data-usa-qtd')) {
    const campo = botao.closest('[data-produto]')?.querySelector('[data-qtd]') || document.querySelector('[data-qtd]');
    if (campo) qtd = qtdValida(campo.value);
  }
  orcamento.adicionar(produto, qtd);
  const original = botao.innerHTML;
  botao.classList.add('btn--ok');
  botao.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#i-check"></use></svg><span>Adicionado</span>';
  setTimeout(() => { botao.classList.remove('btn--ok'); botao.innerHTML = original; }, 1600);
  toast(`${codigo} adicionado ao orçamento${qtd > 1 ? ` (×${qtd})` : ''}.`, { acao: { rotulo: 'Ver orçamento', href: `${BASE}orcamento/` } });
}

/* ---------------- Tema ---------------- */
function temaAtual() {
  const t = document.documentElement.getAttribute('data-tema');
  if (t === 'claro' || t === 'escuro') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}
function alternarTema() {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  document.documentElement.setAttribute('data-tema', novo);
  try { localStorage.setItem('luretec.tema', novo); } catch { /* ignora */ }
}

/* ---------------- Menus ---------------- */
function configurarMenus() {
  const botoes = [...document.querySelectorAll('[data-menu]')];
  const fechar = (excecao) => {
    for (const b of botoes) {
      if (b === excecao) continue;
      const alvo = document.getElementById(b.dataset.menu);
      if (alvo) alvo.hidden = true;
      b.setAttribute('aria-expanded', 'false');
    }
  };
  for (const b of botoes) {
    b.addEventListener('click', () => {
      const alvo = document.getElementById(b.dataset.menu);
      if (!alvo) return;
      const abrir = alvo.hidden;
      fechar(b);
      alvo.hidden = !abrir;
      b.setAttribute('aria-expanded', String(abrir));
      if (abrir) alvo.querySelector('a, button')?.focus({ preventScroll: true });
    });
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-menu], .menu-categorias, .menu-mobile')) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}

/* ---------------- Sugestões da busca do topo ---------------- */
function configurarSugestoes() {
  const form = document.querySelector('[data-busca-topo]');
  if (!form) return;
  const input = form.querySelector('input');
  const painel = form.querySelector('.sugestoes');
  let ativo = -1;
  let timer = null;
  const fechar = () => { painel.hidden = true; painel.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); ativo = -1; };
  const render = (lista, termo) => {
    if (!lista.length) { fechar(); return; }
    painel.innerHTML = lista.map((p) => {
      const img = p.imagem ? `<img src="${BASE}img/produtos/${escapeHtml(p.imagem.arquivo)}" alt="" width="44" height="33" loading="lazy">` : '';
      return `<a class="sugestoes__item" role="option" href="${BASE}produto/${encodeURIComponent(p.codigo)}/">${img}<span><strong class="codigo">${escapeHtml(p.codigo)}</strong> ${escapeHtml(p.nome)}</span></a>`;
    }).join('') + `<a class="sugestoes__rodape" href="${BASE}catalogo/?q=${encodeURIComponent(termo)}">Ver todos os resultados para “${escapeHtml(termo)}”</a>`;
    painel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    ativo = -1;
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const termo = input.value.trim();
    if (termo.length < 2) { fechar(); return; }
    timer = setTimeout(async () => {
      try { render(sugerir((await carregarProdutos()).indice, termo, 6), termo); } catch { fechar(); }
    }, 140);
  });
  input.addEventListener('keydown', (e) => {
    const itens = [...painel.querySelectorAll('a')];
    if (painel.hidden || !itens.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ativo = e.key === 'ArrowDown' ? (ativo + 1) % itens.length : (ativo - 1 + itens.length) % itens.length;
      itens.forEach((a, i) => a.setAttribute('aria-selected', String(i === ativo)));
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      itens[ativo].click();
    } else if (e.key === 'Escape') fechar();
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) fechar(); });
  form.addEventListener('submit', (e) => { if (!input.value.trim()) e.preventDefault(); });
}

/* ---------------- Modal de imagem ---------------- */
function configurarModal() {
  const modal = document.querySelector('[data-modal]');
  if (!modal) return;
  const conteudo = modal.querySelector('[data-modal-conteudo]');
  let origem = null;
  const fechar = () => { modal.hidden = true; conteudo.innerHTML = ''; origem?.focus(); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) {
      origem = b;
      const src = b.dataset.zoom;
      if (!/^[a-zA-Z0-9/._-]+$/.test(src)) return;
      conteudo.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(b.querySelector('img')?.alt || '')}">`;
      modal.hidden = false;
      modal.querySelector('[data-modal-fechar]').focus();
      return;
    }
    if (e.target.closest('[data-modal-fechar]') || e.target === modal) fechar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) fechar(); });
}

/* ---------------- Copiar / compartilhar ---------------- */
export async function copiar(texto, mensagem = 'Copiado!') {
  try {
    await navigator.clipboard.writeText(texto);
    toast(mensagem);
    return true;
  } catch {
    toast('Não foi possível copiar automaticamente.', { erro: true });
    return false;
  }
}

function configurarCompartilhar() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-copiar-link]')) copiar(location.href, 'Link copiado!');
    const share = e.target.closest('[data-compartilhar]');
    if (share && navigator.share) navigator.share({ title: document.title, url: location.href }).catch(() => {});
  });
  if (navigator.share) for (const b of document.querySelectorAll('[data-compartilhar]')) b.hidden = false;
}

/* ---------------- Compatibilidade com links antigos ---------------- */
function compatLinksAntigos() {
  const url = new URL(location.href);
  const p = url.searchParams.get('p');
  const naPaginaOrcamento = /\/orcamento\/?$/.test(url.pathname);
  if (p && codigoValido(p) && !naPaginaOrcamento && !document.querySelector('[data-produto]')) {
    location.replace(`${BASE}produto/${encodeURIComponent(p)}/`);
  }
}

/* ---------------- Service worker ---------------- */
function registrarSw() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Nova versão do catálogo disponível.', { acao: { rotulo: 'Atualizar', href: '#atualizar' }, duracao: 10000 });
          }
        });
      });
      // Só recarrega quando o usuário pediu a atualização; na primeira instalação (clients.claim)
      // o controllerchange também dispara e não deve interromper a navegação.
      let atualizacaoPedida = false;
      document.addEventListener('click', (e) => {
        if (e.target.closest('a[href="#atualizar"]')) { e.preventDefault(); atualizacaoPedida = true; reg.waiting?.postMessage('SKIP_WAITING'); }
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (atualizacaoPedida) location.reload(); });
    } catch { /* sem SW: o site funciona normalmente */ }
  });
}

/* ---------------- Inicialização ---------------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-adicionar]');
  if (b) { e.preventDefault(); aoAdicionar(b); }
  if (e.target.closest('[data-tema]')) alternarTema();
});
configurarMenus();
configurarSugestoes();
configurarModal();
configurarCompartilhar();
compatLinksAntigos();
atualizarBadge();
registrarSw();
if ('requestIdleCallback' in window) requestIdleCallback(() => carregarProdutos().catch(() => {}));
