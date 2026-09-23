// Interações do blog: tema, menus e busca no cliente (sem dependências, compatível com a CSP).
const base = document.documentElement.getAttribute('data-base') || '/';

function tema() {
  const botao = document.querySelector('[data-tema]');
  if (!botao) return;
  botao.addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    const novo = atual === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.setAttribute('data-tema', novo);
    try { localStorage.setItem('tema', novo); } catch { /* ignora */ }
  });
}

function menus() {
  for (const botao of document.querySelectorAll('[data-menu]')) {
    const alvo = document.getElementById(botao.getAttribute('data-menu'));
    if (!alvo) continue;
    botao.addEventListener('click', () => {
      const aberto = !alvo.hidden;
      alvo.hidden = aberto;
      botao.setAttribute('aria-expanded', String(!aberto));
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const botao of document.querySelectorAll('[data-menu][aria-expanded="true"]')) { const alvo = document.getElementById(botao.getAttribute('data-menu')); if (alvo) alvo.hidden = true; botao.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('click', (e) => {
    for (const botao of document.querySelectorAll('[data-menu][aria-expanded="true"]')) {
      const alvo = document.getElementById(botao.getAttribute('data-menu'));
      if (alvo && !alvo.contains(e.target) && !botao.contains(e.target)) { alvo.hidden = true; botao.setAttribute('aria-expanded', 'false'); }
    }
  });
}

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function esc(t) { return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

async function busca() {
  const form = document.querySelector('[data-busca]');
  const grade = document.querySelector('[data-busca-resultados]');
  const status = document.querySelector('[data-busca-status]');
  if (!form || !grade) return;
  const input = form.querySelector('input[name="q"]');
  const q0 = new URLSearchParams(location.search).get('q') || '';
  input.value = q0;
  let posts = [];
  try { posts = (await (await fetch(`${base}api/posts.json`)).json()).posts; } catch { status.textContent = 'Não foi possível carregar a busca.'; return; }
  const render = (termo) => {
    const t = normalizar(termo).trim();
    const toks = t.split(/\s+/).filter(Boolean);
    const achados = toks.length ? posts.filter((p) => { const alvo = normalizar(`${p.titulo} ${p.descricao} ${p.categoriaNome} ${(p.tags || []).join(' ')} ${p.produtoNome || ''} ${p.marca || ''}`); return toks.every((k) => alvo.includes(k)); }) : posts.slice(0, 12);
    status.textContent = toks.length ? `${achados.length} resultado${achados.length === 1 ? '' : 's'} para “${termo}”` : 'Digite para buscar. Últimas publicações:';
    grade.innerHTML = achados.map((p) => `<article class="card"><div class="card__corpo"><p class="eyebrow">${esc(p.categoriaNome)}${p.tipo === 'comparativo' ? ' · Comparativo' : ''}</p><h3><a href="${esc(p.url)}">${esc(p.titulo)}</a></h3><p class="card__desc">${esc(p.descricao)}</p><p class="card__meta">${p.nota !== null && p.nota !== undefined && p.nota !== '' ? `<span class="nota"><strong>${Number(p.nota).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><small>/10</small></span>` : ''}<time datetime="${esc(p.data)}">${esc(p.data)}</time></p></div></article>`).join('');
  };
  render(q0);
  input.addEventListener('input', () => render(input.value));
  form.addEventListener('submit', (e) => { e.preventDefault(); render(input.value); history.replaceState(null, '', `?q=${encodeURIComponent(input.value)}`); });
}

tema();
menus();
busca();
