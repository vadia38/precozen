/* Painel administrativo Precozen — interface (sem dependências). Fala com a API local em /api. */
(() => {
  'use strict';

  // ---------- utilitários de DOM ----------
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'readOnly', 'required', 'multiple', 'open', 'indeterminate']);
  function anexar(pai, filhos) {
    for (const f of filhos) {
      if (f === null || f === undefined || f === false) continue;
      if (Array.isArray(f)) { anexar(pai, f); continue; }
      pai.append(f instanceof Node ? f : document.createTextNode(String(f)));
    }
  }
  function preencher(pai, ...filhos) { pai.replaceChildren(); anexar(pai, filhos); return pai; }
  function juntar(pai, ...filhos) { anexar(pai, filhos); return pai; }
  function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'for') e.htmlFor = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) e[k] = v;
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    anexar(e, filhos);
    return e;
  }
  const btn = (rotulo, props = {}, classe = '') => el('button', { type: 'button', ...props, class: `btn ${classe} ${props.class || ''}`.trim() }, rotulo);
  const link = (rotulo, href, props = {}) => el('a', { href, ...props }, rotulo);
  const chip = (texto, tipo) => el('span', { class: `chip chip--${tipo}` }, texto);
  const muted = (t) => el('span', { class: 'muted' }, t);
  const cartao = (titulo, ...filhos) => el('section', { class: 'cartao' }, titulo ? el('h2', {}, ...(Array.isArray(titulo) ? titulo : [titulo])) : null, ...filhos);
  const alerta = (conteudo, tipo = '') => el('div', { class: `alerta${tipo ? ` alerta--${tipo}` : ''}` }, ...(Array.isArray(conteudo) ? conteudo : [conteudo]));
  const vazio = (t) => el('p', { class: 'vazio-cartao' }, t);
  const tile = (label, valor, delta, extra = '') => el('div', { class: `tile ${extra}` }, el('p', { class: 'tile__label' }, label), el('p', { class: 'tile__value' }, valor), delta ? el('p', { class: 'tile__delta' }, delta) : null);

  const fmt = {
    num: (v, casas = 0) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(Number(v))),
    moeda: (v, moeda = 'BRL') => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(Number(v))),
    pct: (f, casas = 1) => (f === null || f === undefined ? '—' : `${fmt.num(Number(f) * 100, casas)}%`),
    data: (iso) => { if (!iso) return '—'; if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/'); const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); },
    tamanho: (b) => (b === null || b === undefined ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`),
    duracao: (ini, fim) => { if (!ini) return '—'; const ms = (fim ? new Date(fim) : new Date()) - new Date(ini); return ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`; },
  };
  const ESTADO_TAREFA = { fila: 'na fila', executando: 'executando', cancelando: 'cancelando', ok: 'concluída', erro: 'falhou', cancelada: 'cancelada' };

  // ---------- estado ----------
  const app = { catalogo: null, tarefas: new Map(), logs: new Map(), aoConcluir: new Map(), gavetaTarefa: null, gavetaManual: false, pagina: null, atualizarPagina: null, sse: null };

  // ---------- API ----------
  async function api(caminho, { metodo = 'GET', corpo } = {}) {
    const r = await fetch(caminho, { method: metodo, headers: { 'X-Precozen-Painel': '1', ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, credentials: 'same-origin' });
    let dados = null;
    try { dados = await r.json(); } catch { dados = { ok: false, erro: `resposta inválida do servidor (${r.status})` }; }
    if (r.status === 401) { mostrarLogin(); throw new Error('sessão expirada: entre de novo'); }
    if (!r.ok || dados.ok === false) { const e = new Error(dados.erro || `erro ${r.status}`); e.erros = dados.erros || []; e.status = r.status; throw e; }
    return dados;
  }

  // ---------- toasts, modal ----------
  function toast(mensagem, tipo = '') {
    const t = el('div', { class: `toast${tipo ? ` toast--${tipo}` : ''}` }, el('span', {}, mensagem), el('button', { type: 'button', 'aria-label': 'Fechar', onClick: () => t.remove() }, '✕'));
    $('#toasts').append(t);
    setTimeout(() => t.remove(), tipo === 'erro' ? 9000 : 5000);
  }
  function abrirModal({ titulo, descricao, conteudo }) {
    const m = $('#modal');
    preencher($('#modal-conteudo'), el('h2', {}, titulo), descricao ? el('p', { class: 'descricao' }, descricao) : null, conteudo);
    if (!m.open) m.showModal();
  }
  function fecharModal() { const m = $('#modal'); if (m.open) m.close(); }
  function confirmar(mensagem, rotulo = 'Confirmar') {
    return new Promise((resolve) => {
      const fechar = (v) => { fecharModal(); resolve(v); };
      abrirModal({ titulo: 'Confirmação', conteudo: el('div', { class: 'form' }, el('p', {}, mensagem), el('div', { class: 'form__rodape' }, btn('Cancelar', { onClick: () => fechar(false) }), btn(rotulo, { onClick: () => fechar(true) }, 'btn--perigo'))) });
    });
  }

  // ---------- formulários ----------
  function valorPadrao(campo) {
    if (campo.padrao !== undefined) return campo.padrao;
    if (campo.padraoDe && app.catalogo?.config) { const v = campo.padraoDe.split('.').reduce((o, k) => (o ? o[k] : undefined), app.catalogo.config); if (v !== undefined && v !== null) return v; }
    return campo.tipo === 'booleano' ? false : '';
  }
  function lerControle({ campo, controle }) {
    if (campo.tipo === 'booleano') return controle.checked;
    if (campo.tipo === 'numero' || campo.tipo === 'inteiro') return controle.value === '' ? '' : Number(controle.value);
    return controle.value;
  }
  function criarFormulario({ campos, valores = {}, aoEnviar, rotuloEnviar = 'Executar', extraRodape = [], colunas = true, rodape = true }) {
    const form = el('form', { class: `form${colunas ? ' form--colunas' : ''}`, novalidate: true });
    const controles = new Map();
    const erro = el('p', { class: 'form__erro', hidden: true });
    for (const campo of campos) {
      if (campo.tipo === 'secao') { form.append(el('p', { class: 'form__secao' }, campo.rotulo)); continue; }
      const inicial = valores[campo.nome] !== undefined ? valores[campo.nome] : valorPadrao(campo);
      let controle;
      if (campo.tipo === 'booleano') controle = el('input', { type: 'checkbox', name: campo.nome, checked: Boolean(inicial) });
      else if (campo.tipo === 'escolha') {
        const temVazio = !campo.obrigatorio || campo.opcional;
        controle = el('select', { name: campo.nome }, temVazio ? el('option', { value: '' }, campo.rotuloVazio || '— padrão —') : null, ...(campo.opcoes || []).map((o) => el('option', { value: o.valor, selected: String(o.valor) === String(inicial) }, o.rotulo)));
      } else if (campo.tipo === 'textoLongo') controle = el('textarea', { name: campo.nome, rows: campo.linhas || 4, class: campo.mono ? 'mono' : undefined, placeholder: campo.placeholder }, inicial === undefined || inicial === null ? '' : String(inicial));
      else controle = el('input', { type: campo.tipo === 'numero' || campo.tipo === 'inteiro' ? 'number' : campo.tipo === 'mes' ? 'month' : campo.tipo === 'senha' ? 'password' : campo.tipo === 'data' ? 'date' : campo.tipo === 'cor' ? 'color' : 'text', name: campo.nome, value: inicial === undefined || inicial === null ? '' : String(inicial), placeholder: campo.placeholder, step: campo.tipo === 'numero' ? 'any' : undefined, min: campo.min, max: campo.max, autocomplete: 'off', spellcheck: campo.tipo === 'texto' ? undefined : 'false' });
      const wrapper = campo.tipo === 'booleano'
        ? el('label', { class: `campo campo--check${campo.largo ? ' campo--largo' : ''}` }, controle, el('span', {}, campo.rotulo), campo.ajuda ? el('span', { class: 'ajuda' }, campo.ajuda) : null)
        : el('label', { class: `campo${campo.largo || campo.tipo === 'textoLongo' ? ' campo--largo' : ''}` }, el('span', {}, campo.rotulo + (campo.obrigatorio ? ' *' : '')), controle, campo.ajuda ? el('span', { class: 'ajuda' }, campo.ajuda) : null);
      controles.set(campo.nome, { campo, controle, wrapper });
      form.append(wrapper);
    }
    const atualizarVisibilidade = () => {
      for (const { campo, wrapper } of controles.values()) {
        if (!campo.quando) continue;
        const dep = controles.get(campo.quando.campo);
        wrapper.hidden = !dep || !campo.quando.valores.includes(String(lerControle(dep)));
      }
    };
    form.addEventListener('change', atualizarVisibilidade);
    atualizarVisibilidade();
    const ler = () => { const out = {}; for (const [nome, c] of controles) { if (c.wrapper.hidden) continue; const v = lerControle(c); if (v === '' || v === undefined) continue; out[nome] = v; } return out; };
    const botao = el('button', { class: 'btn btn--primario', type: 'submit' }, rotuloEnviar);
    if (rodape) form.append(erro, el('div', { class: 'form__rodape' }, ...extraRodape, botao));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      erro.hidden = true; botao.disabled = true;
      try { await aoEnviar(ler(), { form, controles }); } catch (e) { erro.textContent = e.erros?.length ? e.erros.join(' · ') : e.message; erro.hidden = false; } finally { botao.disabled = false; }
    });
    return { el: form, ler, controles, erro };
  }
  const esc = (nome, rotulo, opcoes, extra = {}) => ({ nome, rotulo, tipo: 'escolha', opcoes, ...extra });
  const txt = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'texto', ...extra });
  const num = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'numero', ...extra });
  const int = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'inteiro', ...extra });
  const bool = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'booleano', ...extra });
  const longo = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'textoLongo', ...extra });
  const opcoesDe = (chave) => app.catalogo?.opcoes?.[chave] || [];
  const acaoDo = (id) => app.catalogo?.acoes.find((a) => a.id === id);

  // ---------- ações (tarefas) ----------
  async function executarAcao(id, { valores = {}, aoConcluir, titulo } = {}) {
    const acao = acaoDo(id);
    if (!acao) { toast(`ação desconhecida: ${id}`, 'erro'); return; }
    const form = criarFormulario({
      campos: acao.campos, valores, rotuloEnviar: acao.especial === 'git' ? 'Commit e push' : acao.especial === 'deploy' ? 'Publicar' : 'Executar',
      aoEnviar: async (opcoes) => {
        const r = await api('/api/tarefas', { metodo: 'POST', corpo: { acao: id, opcoes } });
        fecharModal();
        registrarTarefa(r.tarefa);
        if (aoConcluir) app.aoConcluir.set(r.tarefa.id, aoConcluir);
        abrirGaveta(r.tarefa.id);
        toast(`Tarefa iniciada: ${r.tarefa.nome}`);
      },
    });
    if (!acao.campos.length) form.el.prepend(el('p', { class: 'muted campo--largo' }, 'Esta ação não tem opções.'));
    abrirModal({ titulo: titulo || acao.titulo, descricao: acao.descricao, conteudo: form.el });
  }
  const botaoAcao = (id, rotulo, opts = {}, classe = '') => btn(rotulo || acaoDo(id)?.titulo || id, { onClick: () => executarAcao(id, opts), title: acaoDo(id)?.descricao }, classe);

  function registrarTarefa(t) { app.tarefas.set(t.id, t); renderGaveta(); atualizarIndicador(); }
  function ativas() { return [...app.tarefas.values()].filter((t) => ['fila', 'executando', 'cancelando'].includes(t.estado)); }
  function atualizarIndicador() {
    const n = ativas().length;
    $('#contador-tarefas').textContent = n ? String(n) : '';
    $('#ponto-tarefas').className = `ponto${n ? ' ponto--ativo' : ''}`;
    const navContador = $('#nav [data-contador="tarefas"]');
    if (navContador) navContador.textContent = n ? String(n) : '';
  }
  function aoTerminar(t) {
    const ok = t.estado === 'ok';
    if (ok && !app.gavetaManual) setTimeout(() => { if (!ativas().length && !app.gavetaManual) $('#gaveta').hidden = true; }, 4000);
    toast(ok ? `Concluído: ${t.nome}` : `${t.estado === 'erro' ? 'Falhou' : 'Cancelada'}: ${t.nome}${t.erro ? ` — ${t.erro}` : ''}`, ok ? 'ok' : 'erro');
    const cb = app.aoConcluir.get(t.id);
    if (cb) { app.aoConcluir.delete(t.id); try { cb(t); } catch { /* ignora */ } }
    if (app.atualizarPagina) app.atualizarPagina();
  }
  function ligarStream() {
    if (app.sse) app.sse.close();
    const es = new EventSource('/api/tarefas/stream');
    es.addEventListener('estado', (ev) => { const d = JSON.parse(ev.data); for (const t of d.tarefas) app.tarefas.set(t.id, t); renderGaveta(); atualizarIndicador(); });
    es.addEventListener('tarefa', (ev) => {
      const t = JSON.parse(ev.data);
      const antes = app.tarefas.get(t.id);
      app.tarefas.set(t.id, t);
      if ((!antes || ['fila', 'executando', 'cancelando'].includes(antes.estado)) && ['ok', 'erro', 'cancelada'].includes(t.estado)) aoTerminar(t);
      renderGaveta(); atualizarIndicador();
      if (app.pagina === 'tarefas' && app.atualizarPagina) app.atualizarPagina();
    });
    es.addEventListener('log', (ev) => {
      const { id, linha } = JSON.parse(ev.data);
      const l = app.logs.get(id) || [];
      l.push(linha); app.logs.set(id, l);
      if (app.gavetaTarefa === id) anexarLog($('#gaveta-log'), linha);
      const painelLog = $('#log-tarefa-pagina');
      if (painelLog && painelLog.dataset.id === id) anexarLog(painelLog, linha);
    });
    app.sse = es;
  }
  function linhaLog(linha) {
    const classe = linha.startsWith('$ ') ? 'cmd' : /^✖|erro|Error|falh/i.test(linha) ? 'erro' : /^✔/.test(linha) ? 'ok' : '';
    return el('span', { class: classe || undefined }, `${linha}\n`);
  }
  function anexarLog(pre, linha) { const noFim = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 24; pre.append(linhaLog(linha)); if (noFim) pre.scrollTop = pre.scrollHeight; }
  function renderLog(pre, linhas) { preencher(pre, ...linhas.map(linhaLog)); pre.scrollTop = pre.scrollHeight; }
  async function carregarLog(id) {
    try { const r = await api(`/api/tarefas/${id}`); app.tarefas.set(id, { ...r.tarefa, log: undefined }); app.logs.set(id, r.tarefa.log); return r.tarefa.log; } catch { return app.logs.get(id) || []; }
  }

  // ---------- gaveta de tarefas ----------
  async function abrirGaveta(id) {
    const g = $('#gaveta');
    g.hidden = false;
    if (id) app.gavetaTarefa = id;
    if (!app.gavetaTarefa) { const lista = [...app.tarefas.values()]; app.gavetaTarefa = lista.length ? lista[lista.length - 1].id : null; }
    renderGaveta();
    if (app.gavetaTarefa) renderLog($('#gaveta-log'), await carregarLog(app.gavetaTarefa));
  }
  function renderGaveta() {
    const g = $('#gaveta');
    if (g.hidden) return;
    const lista = [...app.tarefas.values()].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 8);
    preencher($('#gaveta-lista'), ...lista.map((t) => el('button', { type: 'button', class: t.id === app.gavetaTarefa ? 'ativa' : '', onClick: async () => { app.gavetaTarefa = t.id; renderGaveta(); renderLog($('#gaveta-log'), await carregarLog(t.id)); } }, el('span', {}, t.nome), chip(ESTADO_TAREFA[t.estado] || t.estado, t.estado))));
    const atual = app.tarefas.get(app.gavetaTarefa);
    $('#gaveta-titulo').textContent = atual ? `${atual.nome} · ${ESTADO_TAREFA[atual.estado] || atual.estado}${atual.totalPassos > 1 ? ` (passo ${atual.passo}/${atual.totalPassos})` : ''}` : 'Tarefas';
    $('#gaveta-cancelar').hidden = !atual || !['fila', 'executando'].includes(atual.estado);
  }
  $('#gaveta-fechar').addEventListener('click', () => { $('#gaveta').hidden = true; app.gavetaManual = false; });
  $('#gaveta-cancelar').addEventListener('click', async () => { if (!app.gavetaTarefa) return; try { await api(`/api/tarefas/${app.gavetaTarefa}/cancelar`, { metodo: 'POST' }); } catch (e) { toast(e.message, 'erro'); } });
  $('#btn-tarefas').addEventListener('click', () => { const g = $('#gaveta'); if (g.hidden) { app.gavetaManual = true; abrirGaveta(); } else { g.hidden = true; app.gavetaManual = false; } });

  // ---------- componentes de tabela ----------
  function tabela({ colunas, linhas, vazio: msgVazio = 'Nada por aqui ainda.', aoClicar, classeLinha }) {
    const thead = el('thead', {}, el('tr', {}, ...colunas.map((c) => el('th', { class: c.classe }, c.rotulo))));
    const tbody = el('tbody', {}, linhas.length ? linhas.map((l, i) => el('tr', { class: `${aoClicar ? 'clicavel ' : ''}${classeLinha ? classeLinha(l) : ''}`, onClick: aoClicar ? (ev) => { if (ev.target.closest('button, a, input, select')) return; aoClicar(l, i); } : undefined }, ...colunas.map((c) => el('td', { class: c.classe }, c.valor(l, i))))) : el('tr', {}, el('td', { colspan: colunas.length, class: 'vazio' }, msgVazio)));
    return el('div', { class: 'tabela-rolagem' }, el('table', {}, thead, tbody));
  }
  function abas(lista, ativa, aoTrocar) {
    return el('div', { class: 'abas', role: 'tablist' }, ...lista.map(([id, rotulo]) => el('button', { type: 'button', role: 'tab', class: id === ativa ? 'ativa' : '', onClick: () => aoTrocar(id) }, rotulo)));
  }
  function barras(itens, { rotulo, valor, max = 100, formatar = (v) => fmt.num(v, 1) }) {
    if (!itens.length) return el('p', { class: 'vazio' }, 'Sem dados.');
    const maximo = max || Math.max(...itens.map(valor)) || 1;
    return el('div', { class: 'barras' }, ...itens.map((it) => el('div', { class: 'linha' }, el('span', { title: rotulo(it) }, rotulo(it).length > 30 ? `${rotulo(it).slice(0, 29)}…` : rotulo(it)), el('div', { class: 'trilha' }, el('div', { class: 'valor-barra', style: { width: `${Math.max(1, (valor(it) / maximo) * 100)}%` } })), el('span', { class: 'num' }, formatar(valor(it))))));
  }
  const arquivoUrl = (rel) => `/arquivo/${String(rel).split('/').map(encodeURIComponent).join('/')}`;
  const linkArquivo = (rel, rotulo) => (rel ? link(rotulo || rel.split('/').pop(), arquivoUrl(rel), { target: '_blank', rel: 'noopener' }) : muted('—'));

  // ---------- páginas ----------
  const PAGINAS = {};

  // Início
  PAGINAS.inicio = {
    titulo: 'Início', subtitulo: 'Visão geral: produtos, análises, blog, KDP e designs.',
    async render({ conteudo, acoes }) {
      const e = await api('/api/estado');
      preencher(acoes, btn('Atualizar', { onClick: () => navegar() }), e.kpis.produtos === 0 ? botaoAcao('exemplo', 'Rodar fluxo de exemplo', {}, 'btn--primario') : null);
      const passos = [
        { feito: e.kpis.produtos > 0, texto: 'Importar produtos dos programas de afiliados', botao: btn('Importar', { onClick: abrirImportacao }) },
        { feito: Boolean(e.ranking), texto: 'Pontuar vendas × comissão e gerar o ranking', botao: botaoAcao('afiliados.analisar', 'Analisar') },
        { feito: e.kpis.posts > 0, texto: 'Gerar análises e comparativos para os melhores', botao: botaoAcao('afiliados.reviews', 'Gerar análises') },
        { feito: e.blogDist, texto: 'Gerar o blog e publicar', botao: link('Publicação', '#/blog', { class: 'btn' }) },
        { feito: e.kpis.livros > 0, texto: 'Produzir livros para o KDP', botao: botaoAcao('kdp.livro', 'Novo livro') },
        { feito: e.designs.estampas + e.designs.listagens + e.designs.capas > 0, texto: 'Criar designs para a Amazon', botao: botaoAcao('design.camiseta', 'Nova estampa') },
        { feito: e.ia.sdk && e.ia.credencial, texto: 'Ligar a IA (Claude) para textos mais ricos', botao: link('Configurar', '#/ia', { class: 'btn' }) },
      ];
      const situacao = [
        ['IA (Claude)', e.ia.sdk && e.ia.credencial ? ['ok', 'pronta'] : ['aviso', e.ia.sdk ? 'sem credencial (modo template)' : 'SDK não instalado (modo template)']],
        ['Renderizador PNG/PDF', e.renderizador ? ['ok', e.renderizador.tipo] : ['aviso', 'nenhum — instale Chromium, rsvg-convert, ImageMagick ou Inkscape']],
        ['Blog gerado', e.blogDist ? ['ok', `sim · ${fmt.data(e.blogDistModificadoEm)}`] : ['aviso', 'ainda não']],
        ['Conteúdo', e.blogErros.length ? ['falta', `${e.blogErros.length} problema(s)`] : ['ok', `${e.kpis.posts} posts válidos`]],
        ['Configuração', e.configErros.length ? ['falta', e.configErros.join('; ')] : ['ok', e.configArquivo]],
        ['Pasta de trabalho', ['ok', e.workspace]],
      ];
      preencher(conteudo, 
        e.configErros.length ? alerta([el('b', {}, 'Configuração inválida: '), e.configErros.join('; '), ' ', link('Corrigir', '#/config')], 'erro') : null,
        el('section', { class: 'tiles' },
          tile('Ganho médio por 100 cliques (top 10)', fmt.moeda(e.kpis.epcMedioTop), 'preço × comissão × conversão esperada', 'tile--hero'),
          tile('Produtos na base', fmt.num(e.kpis.produtos), `${fmt.num(e.kpis.promoviveis)} em ouro/prata`),
          tile('Análises no blog', fmt.num(e.kpis.posts), `${fmt.num(e.kpis.semPost)} bons produtos sem análise`),
          tile('Livros KDP', fmt.num(e.kpis.livros), e.livros.length ? `último: ${e.livros[0].titulo}` : 'nenhum ainda'),
          tile('Designs', fmt.num(e.designs.estampas + e.designs.listagens + e.designs.capas), `${e.designs.estampas} estampas · ${e.designs.listagens} listagens · ${e.designs.capas} capas`),
          tile('Teto teórico de comissão/mês', fmt.moeda(e.kpis.potencial), 'se todas as vendas dos produtos ouro/prata viessem do blog')),
        el('div', { class: 'grade grade--2' },
          cartao('Próximos passos', el('ol', { class: 'lista-passos passo-lista' }, ...passos.map((p, i) => el('li', { class: p.feito ? 'feito' : '' }, el('span', { class: 'n' }, p.feito ? '✓' : String(i + 1)), el('span', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' } }, el('span', {}, p.texto), p.botao))))),
          cartao('Situação do sistema', el('ul', { class: 'lista' }, ...situacao.map(([n, [tipo, t]]) => el('li', {}, el('span', { class: 'texto' }, el('b', {}, n), el('span', { class: 'sub' }, t)), el('span', { class: `status status--${tipo}` })))), e.blogErros.length ? alerta([el('b', {}, 'Problemas no conteúdo:'), el('ul', {}, ...e.blogErros.map((x) => el('li', {}, x)))], 'erro') : null)),
        el('div', { class: 'grade grade--2' },
          cartao(['Melhores produtos', el('small', {}, e.ranking ? `ranking de ${fmt.data(e.ranking.geradoEm)}` : 'sem ranking')], tabela({ colunas: [{ rotulo: '#', classe: 'num', valor: (p) => p.pontuacao?.posicao ?? '' }, { rotulo: 'Produto', valor: (p) => [p.nome, el('span', { class: 'sub' }, `${p.programa} · ${p.categoriaNome || ''}`)] }, { rotulo: 'Score', classe: 'num', valor: (p) => fmt.num(p.pontuacao?.score, 1) }, { rotulo: 'Classe', valor: (p) => chip(p.pontuacao?.classe || '—', p.pontuacao?.classe || 'neutro') }, { rotulo: 'Ganho/100', classe: 'num', valor: (p) => fmt.moeda(p.pontuacao?.epc100, p.moeda) }], linhas: e.top, vazio: 'Importe produtos e rode a análise.', aoClicar: (p) => abrirProduto(p.id) })),
          cartao(['Bons produtos sem análise', el('small', {}, String(e.semPost.length))], e.semPost.length ? [el('ul', { class: 'lista' }, ...e.semPost.map((p) => el('li', {}, el('span', { class: 'texto' }, p.nome, el('span', { class: 'sub' }, `score ${fmt.num(p.pontuacao?.score, 1)} · ${p.pontuacao?.classe}`))))), el('p', {}, botaoAcao('afiliados.reviews', 'Gerar análises destes produtos', { valores: { id: e.semPost.map((p) => p.id).join(','), top: e.semPost.length } }, 'btn--primario'))] : vazio('Todos os produtos ouro/prata já têm análise.'))),
        cartao(['Últimos posts', el('small', {}, link('ver todos', '#/posts'))], tabela({ colunas: [{ rotulo: 'Título', valor: (p) => p.titulo }, { rotulo: 'Tipo', valor: (p) => p.tipo }, { rotulo: 'Categoria', valor: (p) => p.categoriaNome }, { rotulo: 'Data', valor: (p) => fmt.data(p.data) }], linhas: e.posts, vazio: 'Nenhum post ainda.', aoClicar: (p) => { location.hash = `#/posts/editar/${encodeURIComponent(p.arquivo)}`; } })),
      );
      app.atualizarPagina = () => navegar();
    },
  };

  // Produtos
  const CAMPOS_REGISTRO = () => [
    txt('nome', 'Nome do produto', { obrigatorio: true, largo: true }), esc('programa', 'Programa', opcoesDe('programas'), { obrigatorio: true, padrao: 'amazon-br' }), txt('id', 'Identificador (ASIN, MLB, SKU…)'), txt('marca', 'Marca'), txt('categoria', 'Categoria', { ajuda: 'texto livre; é mapeada para a categoria canônica' }),
    num('preco', 'Preço'), num('preco_antigo', 'Preço antigo (De:)'), num('comissao', 'Comissão (%)', { ajuda: 'vazio = taxa de referência do programa' }), int('bsr', 'BSR (ranking de vendas)'), num('vendas_mes', 'Vendas/mês (se souber)'), num('avaliacao', 'Avaliação (0–5)'), int('avaliacoes', 'Nº de avaliações'), num('tendencia', 'Tendência (-1 a 1)'),
    txt('url', 'URL da página do produto'), txt('link', 'Link de afiliado', { ajuda: 'Amazon: montado com a tag configurada se vazio' }), txt('imagem', 'URL da imagem'),
    longo('descricao', 'Descrição', { linhas: 3 }), longo('pros', 'Prós (separe com ;)', { linhas: 2 }), longo('contras', 'Contras (separe com ;)', { linhas: 2 }), longo('atributos', 'Ficha técnica (chave=valor; chave=valor)', { linhas: 2 }), txt('palavras_chave', 'Palavras-chave (vírgula)', { largo: true }), txt('publico', 'Para quem é', { largo: true }),
  ];
  async function abrirProduto(id) {
    let d;
    try { d = await api(`/api/produtos/${encodeURIComponent(id)}`); } catch (e) { toast(e.message, 'erro'); return; }
    const p = d.produto;
    const form = criarFormulario({
      campos: CAMPOS_REGISTRO(), valores: d.registro, rotuloEnviar: 'Salvar',
      extraRodape: [btn('Excluir', { onClick: async () => { if (!(await confirmar(`Excluir "${p.nome}" da base?`, 'Excluir'))) return; try { await api(`/api/produtos/${encodeURIComponent(id)}`, { metodo: 'DELETE' }); toast('Produto excluído'); if (app.atualizarPagina) app.atualizarPagina(); } catch (e) { toast(e.message, 'erro'); } } }, 'btn--perigo'), p.post ? link('Ver análise', `#/posts/editar/${encodeURIComponent(p.post)}`, { class: 'btn', onClick: fecharModal }) : botaoAcao('afiliados.reviews', 'Gerar análise', { valores: { id, top: 1 } })],
      aoEnviar: async (registro) => { const r = await api(`/api/produtos/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { registro } }); fecharModal(); toast(r.avisos.length ? `Salvo com avisos: ${r.avisos.join('; ')}` : 'Produto salvo'); if (app.atualizarPagina) app.atualizarPagina(); },
    });
    const resumo = p.pontuacao ? el('p', { class: 'muted' }, `Score ${fmt.num(p.pontuacao.score, 1)} · ${p.pontuacao.classe} · ganho/100 cliques ${fmt.moeda(p.pontuacao.epc100, p.moeda)} · vendas/mês ${p.vendasMes === null ? '—' : fmt.num(p.vendasMes)} (${p.vendasFonte})`) : el('p', { class: 'muted' }, 'Ainda sem pontuação: rode a análise.');
    abrirModal({ titulo: p.nome, conteudo: el('div', {}, resumo, form.el) });
  }
  function abrirNovoProduto() {
    const form = criarFormulario({ campos: CAMPOS_REGISTRO(), rotuloEnviar: 'Adicionar', aoEnviar: async (registro) => { const r = await api('/api/produtos', { metodo: 'POST', corpo: { registro, programa: registro.programa } }); fecharModal(); toast(r.avisos.length ? `Adicionado com avisos: ${r.avisos.join('; ')}` : 'Produto adicionado'); if (app.atualizarPagina) app.atualizarPagina(); } });
    abrirModal({ titulo: 'Novo produto', descricao: 'Cadastro manual. Para muitos produtos, importe um CSV/JSON.', conteudo: form.el });
  }
  function abrirImportacao() {
    const arquivoInput = el('input', { type: 'file', accept: '.csv,.json,.txt,.tsv', name: 'arquivo' });
    const textoArea = el('textarea', { rows: 6, placeholder: 'programa;id;nome;marca;categoria;preco;comissao;bsr;avaliacao;avaliacoes;link;...\namazon-br;B0XXXX;Nome do produto;Marca;Cozinha;199.90;;850;4.6;1200;https://...', class: 'mono' });
    const programa = el('select', {}, ...opcoesDe('programas').map((o) => el('option', { value: o.valor, selected: o.valor === 'amazon-br' }, o.rotulo)));
    const substituir = el('input', { type: 'checkbox' });
    const erro = el('p', { class: 'form__erro', hidden: true });
    const resultado = el('div');
    const enviar = el('button', { type: 'submit', class: 'btn btn--primario' }, 'Importar');
    const form = el('form', { class: 'form', novalidate: true, onSubmit: async (ev) => {
      ev.preventDefault(); erro.hidden = true; enviar.disabled = true;
      try {
        let texto = textoArea.value; let nome = 'colado';
        if (arquivoInput.files?.[0]) { texto = await arquivoInput.files[0].text(); nome = arquivoInput.files[0].name; }
        if (!texto.trim()) throw new Error('escolha um arquivo ou cole o conteúdo');
        const r = await api('/api/produtos/importar', { metodo: 'POST', corpo: { texto, nome, programa: programa.value, substituir: substituir.checked } });
        preencher(resultado, alerta([el('b', {}, `${r.registros} registros lidos: `), `${r.novos} novos, ${r.atualizados} atualizados, ${r.ignorados} ignorados · base com ${r.total} produtos.`, r.avisos.length ? el('ul', {}, ...r.avisos.map((a) => el('li', {}, a)), r.maisAvisos ? el('li', {}, `… e mais ${r.maisAvisos} avisos`) : null) : null], 'ok'), el('p', { class: 'acoes-linha' }, botaoAcao('afiliados.analisar', 'Analisar agora', {}, 'btn--primario'), btn('Fechar', { onClick: fecharModal })));
        if (app.atualizarPagina) app.atualizarPagina();
      } catch (e) { erro.textContent = e.message; erro.hidden = false; } finally { enviar.disabled = false; }
    } },
      el('label', { class: 'campo' }, el('span', {}, 'Arquivo CSV ou JSON'), arquivoInput, el('span', { class: 'ajuda' }, 'Colunas aceitas: programa, id/asin, nome, marca, categoria, preco, preco_antigo, comissao, bsr, vendas_mes, avaliacao, avaliacoes, url, link, imagem, descricao, pros, contras, atributos, palavras_chave, publico (separador ; ou ,).')),
      el('label', { class: 'campo' }, el('span', {}, 'Ou cole o conteúdo'), textoArea),
      el('div', { class: 'form form--colunas' }, el('label', { class: 'campo' }, el('span', {}, 'Programa padrão (quando a coluna programa estiver vazia)'), programa), el('label', { class: 'campo campo--check' }, substituir, el('span', {}, 'Apagar a base antes de importar'))),
      erro, resultado, el('div', { class: 'form__rodape' }, btn('Cancelar', { onClick: fecharModal }), enviar));
    abrirModal({ titulo: 'Importar produtos', descricao: 'Mescla por id: campos vazios não apagam os existentes; preço, avaliações e vendas informados atualizam.', conteudo: form });
  }
  PAGINAS.produtos = {
    titulo: 'Produtos', subtitulo: 'Base de produtos dos programas de afiliados, com a pontuação de vendas × comissão.',
    async render({ conteudo, acoes }) {
      const d = await api('/api/produtos');
      const filtros = { busca: '', classe: '', programa: '', semPost: false };
      const selecionados = new Set();
      preencher(acoes, btn('Importar', { onClick: abrirImportacao }, 'btn--primario'), botaoAcao('afiliados.importar-online', 'Importar online'), botaoAcao('afiliados.analisar', 'Analisar (ranking)'), botaoAcao('afiliados.reviews', 'Gerar análises'), botaoAcao('afiliados.comparativos', 'Comparativos'), btn('Novo produto', { onClick: abrirNovoProduto }));
      const corpoTabela = el('div');
      const barraSel = el('div', { class: 'acoes-linha', hidden: true });
      const desenhar = () => {
        const b = filtros.busca.toLowerCase();
        const lista = d.produtos.filter((p) => (!b || `${p.nome} ${p.marca || ''} ${p.id}`.toLowerCase().includes(b)) && (!filtros.classe || p.pontuacao?.classe === filtros.classe) && (!filtros.programa || p.programa === filtros.programa) && (!filtros.semPost || !p.post));
        preencher(corpoTabela, tabela({
          colunas: [
            { rotulo: '', valor: (p) => el('input', { type: 'checkbox', checked: selecionados.has(p.id), onChange: (ev) => { if (ev.target.checked) selecionados.add(p.id); else selecionados.delete(p.id); atualizarSel(); } }) },
            { rotulo: '#', classe: 'num', valor: (p) => p.pontuacao?.posicao ?? '' },
            { rotulo: 'Produto', valor: (p) => [p.nome, el('span', { class: 'sub' }, `${p.marca ? `${p.marca} · ` : ''}${p.programa} · ${p.categoriaNome || p.categoria}`)] },
            { rotulo: 'Preço', classe: 'num', valor: (p) => fmt.moeda(p.preco, p.moeda) },
            { rotulo: 'Comissão', classe: 'num', valor: (p) => [fmt.moeda(p.comissaoValor, p.moeda), el('span', { class: 'sub' }, fmt.pct(p.comissaoTaxa))] },
            { rotulo: 'Vendas/mês', classe: 'num', valor: (p) => (p.vendasMes === null || p.vendasMes === undefined ? '—' : `${fmt.num(p.vendasMes)}${String(p.vendasFonte || '').startsWith('estimado') ? '*' : ''}`) },
            { rotulo: 'Score', classe: 'num', valor: (p) => fmt.num(p.pontuacao?.score, 1) },
            { rotulo: 'Classe', valor: (p) => (p.pontuacao ? chip(p.pontuacao.classe, p.pontuacao.classe) : chip('sem score', 'neutro')) },
            { rotulo: 'Ganho/100', classe: 'num', valor: (p) => fmt.moeda(p.pontuacao?.epc100, p.moeda) },
            { rotulo: 'Análise', valor: (p) => (p.post ? link('ver', `#/posts/editar/${encodeURIComponent(p.post)}`) : muted('—')) },
          ],
          linhas: lista, vazio: d.total ? 'Nenhum produto com esses filtros.' : 'Nenhum produto importado. Use "Importar" ou rode o fluxo de exemplo no Início.', aoClicar: (p) => abrirProduto(p.id), classeLinha: (p) => (selecionados.has(p.id) ? 'selecionada' : ''),
        }), el('p', { class: 'muted' }, `${lista.length} de ${d.total} produtos · * vendas estimadas por BSR/histórico · comissões e vendas são dados internos (não aparecem no blog)`));
      };
      const atualizarSel = () => { barraSel.hidden = !selecionados.size; preencher(barraSel, el('b', {}, `${selecionados.size} selecionado(s)`), botaoAcao('afiliados.reviews', 'Gerar análises dos selecionados', { valores: { id: [...selecionados].join(','), top: selecionados.size } }, 'btn--primario'), btn('Excluir selecionados', { onClick: async () => { if (!(await confirmar(`Excluir ${selecionados.size} produto(s) da base?`, 'Excluir'))) return; for (const id of selecionados) { try { await api(`/api/produtos/${encodeURIComponent(id)}`, { metodo: 'DELETE' }); } catch (e) { toast(e.message, 'erro'); } } selecionados.clear(); navegar(); } }, 'btn--perigo'), btn('Limpar seleção', { onClick: () => { selecionados.clear(); atualizarSel(); desenhar(); } })); };
      const classes = ['ouro', 'prata', 'bronze', 'descartar'];
      preencher(conteudo, 
        d.desatualizado ? alerta([el('b', {}, 'A base mudou depois do último ranking. '), 'Rode a análise para atualizar scores e classes. ', botaoAcao('afiliados.analisar', 'Analisar agora', {}, 'btn--mini')]) : null,
        el('div', { class: 'kpi-linha' }, el('div', {}, el('b', {}, fmt.num(d.total)), el('span', {}, 'produtos')), ...(d.ranking ? classes.map((c) => el('div', {}, el('b', {}, fmt.num(d.ranking.resumo.porClasse?.[c] || 0)), el('span', {}, c))) : []), el('div', {}, el('b', {}, d.ranking ? fmt.data(d.ranking.geradoEm) : '—'), el('span', {}, 'ranking gerado em'))),
        el('div', { class: 'filtros' }, el('input', { type: 'search', placeholder: 'Buscar por nome, marca ou id', onInput: (ev) => { filtros.busca = ev.target.value; desenhar(); } }), el('select', { onChange: (ev) => { filtros.classe = ev.target.value; desenhar(); } }, el('option', { value: '' }, 'Todas as classes'), ...classes.map((c) => el('option', { value: c }, c))), el('select', { onChange: (ev) => { filtros.programa = ev.target.value; desenhar(); } }, el('option', { value: '' }, 'Todos os programas'), ...opcoesDe('programas').map((o) => el('option', { value: o.valor }, o.rotulo))), el('label', { class: 'campo campo--check', style: { paddingTop: 0 } }, el('input', { type: 'checkbox', onChange: (ev) => { filtros.semPost = ev.target.checked; desenhar(); } }), el('span', {}, 'só sem análise'))),
        barraSel, el('section', { class: 'cartao' }, corpoTabela),
      );
      desenhar();
      app.atualizarPagina = () => navegar();
    },
  };

  // Conteúdo (posts e páginas)
  const TIPOS_POST = ['review', 'comparativo', 'artigo', 'guia', 'noticia'];
  function estadoPost(p) { if (p.rascunho) return chip('rascunho', 'rascunho'); if (p.erros.length) return chip('com erros', 'erro'); return chip('publicado', 'publicado'); }
  async function previewBlog({ abrir } = {}) {
    const r = await api('/api/blog/preview', { metodo: 'POST' });
    toast(`Pré-visualização gerada: ${r.paginas} páginas em ${r.ms} ms`);
    if (abrir) window.open(abrir === true ? '/preview/' : `/preview/${abrir}`, '_blank', 'noopener');
    return r;
  }
  PAGINAS.posts = {
    titulo: 'Conteúdo', subtitulo: 'Posts do blog (análises, comparativos, artigos) e páginas fixas.',
    async render({ conteudo, acoes, params }) {
      if (params[0] === 'editar' || params[0] === 'pagina') return renderEditor({ conteudo, acoes, tipo: params[0] === 'pagina' ? 'paginas' : 'posts', arquivo: decodeURIComponent(params[1] || '') });
      const aba = params[0] === 'paginas' ? 'paginas' : 'posts';
      preencher(acoes, btn('Novo post', { onClick: () => novoConteudo('posts') }, 'btn--primario'), btn('Nova página', { onClick: () => novoConteudo('paginas') }), botaoAcao('afiliados.reviews', 'Gerar análises'), botaoAcao('afiliados.comparativos', 'Comparativos'), btn('Pré-visualizar blog', { onClick: () => previewBlog({ abrir: true }).catch((e) => toast(e.message, 'erro')) }));
      const [posts, paginas] = await Promise.all([api('/api/posts'), api('/api/paginas')]);
      const filtro = { busca: '' };
      const corpo = el('div');
      const desenhar = () => {
        const b = filtro.busca.toLowerCase();
        if (aba === 'paginas') {
          preencher(corpo, tabela({ colunas: [{ rotulo: 'Título', valor: (p) => [p.titulo, el('span', { class: 'sub' }, `/${p.slug}/`)] }, { rotulo: 'Menu', valor: (p) => (p.menu ? 'sim' : 'não') }, { rotulo: 'Palavras', classe: 'num', valor: (p) => fmt.num(p.palavras) }, { rotulo: 'Modificado', valor: (p) => fmt.data(p.modificadoEm) }], linhas: paginas.paginas.filter((p) => !b || p.titulo.toLowerCase().includes(b)), aoClicar: (p) => { location.hash = `#/posts/pagina/${encodeURIComponent(p.arquivo)}`; } }));
          return;
        }
        const lista = posts.posts.filter((p) => !b || `${p.titulo} ${p.slug} ${p.categoria}`.toLowerCase().includes(b));
        preencher(corpo, tabela({ colunas: [
          { rotulo: 'Título', valor: (p) => [p.titulo, el('span', { class: 'sub' }, `${p.slug} · ${p.gerador || 'manual'}`)] }, { rotulo: 'Tipo', valor: (p) => p.tipo }, { rotulo: 'Categoria', valor: (p) => p.categoriaNome || p.categoria }, { rotulo: 'Data', valor: (p) => fmt.data(p.data) }, { rotulo: 'Nota', classe: 'num', valor: (p) => (p.nota === null || p.nota === '' ? '—' : fmt.num(p.nota, 1)) }, { rotulo: 'Estado', valor: (p) => estadoPost(p) }, { rotulo: 'Palavras', classe: 'num', valor: (p) => fmt.num(p.palavras) },
          { rotulo: '', classe: 'acoes', valor: (p) => el('span', { class: 'pontos' }, btn('Editar', { onClick: () => { location.hash = `#/posts/editar/${encodeURIComponent(p.arquivo)}`; } }, 'btn--mini'), btn('Ver', { onClick: () => previewBlog({ abrir: p.url }).catch((e) => toast(e.message, 'erro')) }, 'btn--mini')) },
        ], linhas: lista, vazio: 'Nenhum post. Gere análises a partir do ranking ou crie um post.', aoClicar: (p) => { location.hash = `#/posts/editar/${encodeURIComponent(p.arquivo)}`; } }));
      };
      preencher(conteudo, 
        posts.erros.length ? alerta([el('b', {}, `${posts.erros.length} problema(s) impedem o build do blog:`), el('ul', {}, ...posts.erros.slice(0, 10).map((x) => el('li', {}, x)))], 'erro') : null,
        abas([['posts', `Posts (${posts.total})`], ['paginas', `Páginas (${paginas.paginas.length})`]], aba, (id) => { location.hash = `#/posts/${id}`; }),
        el('div', { class: 'filtros' }, el('input', { type: 'search', placeholder: 'Buscar', onInput: (ev) => { filtro.busca = ev.target.value; desenhar(); } })),
        el('section', { class: 'cartao' }, corpo),
      );
      desenhar();
      app.atualizarPagina = () => navegar();
    },
  };
  function novoConteudo(tipo) {
    const campos = tipo === 'posts' ? [txt('titulo', 'Título', { obrigatorio: true, largo: true }), esc('tipo', 'Tipo', TIPOS_POST.map((t) => ({ valor: t, rotulo: t })), { padrao: 'artigo', obrigatorio: true }), esc('categoria', 'Categoria', opcoesDe('categorias'), { padrao: 'outros', obrigatorio: true }), bool('rascunho', 'Começar como rascunho', { padrao: true })] : [txt('titulo', 'Título', { obrigatorio: true, largo: true }), txt('slug', 'Slug (opcional)'), bool('menu', 'Mostrar no menu', { padrao: true })];
    const form = criarFormulario({ campos, rotuloEnviar: 'Criar', aoEnviar: async (v) => { const r = await api(`/api/${tipo}`, { metodo: 'POST', corpo: v }); fecharModal(); const arq = tipo === 'posts' ? r.post.arquivo : r.pagina.arquivo; location.hash = `#/posts/${tipo === 'posts' ? 'editar' : 'pagina'}/${encodeURIComponent(arq)}`; } });
    abrirModal({ titulo: tipo === 'posts' ? 'Novo post' : 'Nova página', conteudo: form.el });
  }
  async function renderEditor({ conteudo, acoes, tipo, arquivo }) {
    const d = await api(`/api/${tipo}/${encodeURIComponent(arquivo)}`);
    const meta = { ...d.meta };
    const ehPost = tipo === 'posts';
    const campos = ehPost ? [
      txt('titulo', 'Título', { obrigatorio: true, largo: true }), txt('slug', 'Slug', { obrigatorio: true }), esc('tipo', 'Tipo', [...new Set([...TIPOS_POST, meta.tipo].filter(Boolean))].map((t) => ({ valor: t, rotulo: t })), { obrigatorio: true }), esc('categoria', 'Categoria', [...opcoesDe('categorias'), ...(meta.categoria && !opcoesDe('categorias').some((c) => c.valor === meta.categoria) ? [{ valor: meta.categoria, rotulo: meta.categoria }] : [])], { obrigatorio: true }),
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true }, num('nota', 'Nota (0–10)', { min: 0, max: 10 }), bool('rascunho', 'Rascunho (fica fora do site)'), txt('tags', 'Tags (vírgula)'),
      longo('descricao', 'Descrição (meta description, até 160 caracteres)', { linhas: 2 }), txt('link', 'Link de afiliado'), txt('imagem', 'Imagem (URL)'), txt('produtoNome', 'Nome do produto'), txt('marca', 'Marca'), num('preco', 'Preço'), txt('moeda', 'Moeda'),
      longo('pros', 'Prós (um por linha)', { linhas: 3 }), longo('contras', 'Contras (um por linha)', { linhas: 3 }),
    ] : [txt('titulo', 'Título', { obrigatorio: true, largo: true }), txt('slug', 'Slug', { obrigatorio: true }), bool('menu', 'Mostrar no menu'), bool('noindex', 'Não indexar'), longo('descricao', 'Descrição', { linhas: 2 })];
    const valores = { ...meta, tags: Array.isArray(meta.tags) ? meta.tags.join(', ') : meta.tags || '', pros: Array.isArray(meta.pros) ? meta.pros.join('\n') : meta.pros || '', contras: Array.isArray(meta.contras) ? meta.contras.join('\n') : meta.contras || '', menu: meta.menu !== false, rascunho: meta.rascunho === true, noindex: meta.noindex === true };
    const corpoArea = el('textarea', { class: 'mono', rows: 28, spellcheck: 'true' }, d.corpo);
    const montarMeta = (v) => {
      const m = { ...meta, ...v };
      for (const c of campos) if (c.tipo !== 'secao' && v[c.nome] === undefined) { if (c.tipo === 'booleano') m[c.nome] = false; else delete m[c.nome]; }
      if (ehPost) { m.tags = String(v.tags || '').split(',').map((s) => s.trim()).filter(Boolean); m.pros = String(v.pros || '').split('\n').map((s) => s.trim()).filter(Boolean); m.contras = String(v.contras || '').split('\n').map((s) => s.trim()).filter(Boolean); if (!m.rascunho) delete m.rascunho; }
      else { if (m.menu) delete m.menu; if (!m.noindex) delete m.noindex; }
      return m;
    };
    let salvando = false;
    const salvar = async (v) => {
      const r = await api(`/api/${tipo}/${encodeURIComponent(arquivo)}`, { metodo: 'PUT', corpo: { meta: montarMeta(v), corpo: corpoArea.value } });
      toast('Salvo');
      if (r.arquivo !== arquivo) { location.hash = `#/posts/${ehPost ? 'editar' : 'pagina'}/${encodeURIComponent(r.arquivo)}`; return r; }
      Object.assign(meta, r.meta);
      return r;
    };
    const form = criarFormulario({ campos, valores, rotuloEnviar: 'Salvar', aoEnviar: salvar, extraRodape: [
      btn('Pré-visualizar', { onClick: async () => { if (salvando) return; salvando = true; try { await salvar(form.ler()); await previewBlog({ abrir: ehPost ? `post/${form.ler().slug || meta.slug}/` : `${form.ler().slug || meta.slug}/` }); } catch (e) { form.erro.textContent = e.erros?.length ? e.erros.join(' · ') : e.message; form.erro.hidden = false; } finally { salvando = false; } } }),
      btn('Excluir', { onClick: async () => { if (!(await confirmar(`Excluir ${arquivo}? Esta ação não pode ser desfeita.`, 'Excluir'))) return; try { await api(`/api/${tipo}/${encodeURIComponent(arquivo)}`, { metodo: 'DELETE' }); toast('Excluído'); location.hash = ehPost ? '#/posts' : '#/posts/paginas'; } catch (e) { toast(e.message, 'erro'); } } }, 'btn--perigo'),
    ] });
    preencher(acoes, link('← Voltar', ehPost ? '#/posts' : '#/posts/paginas', { class: 'btn' }));
    const extras = Object.keys(meta).filter((k) => !campos.some((c) => c.nome === k) && !['atualizado'].includes(k));
    preencher(conteudo, 
      el('div', { class: 'grade', style: { gridTemplateColumns: 'minmax(0, 1fr)' } },
        cartao(['Metadados', el('small', {}, `${arquivo}${meta.atualizado ? ` · atualizado em ${fmt.data(meta.atualizado)}` : ''}`)], form.el, extras.length ? el('p', { class: 'muted' }, `Outros campos preservados: ${extras.join(', ')}`) : null),
        cartao(['Corpo (Markdown)', el('small', {}, 'títulos com ##, listas com -, links [texto](url), imagens ![alt](url)')], el('label', { class: 'campo' }, corpoArea))),
    );
    app.atualizarPagina = null;
  }

  // Publicação (blog)
  PAGINAS.blog = {
    titulo: 'Publicação', subtitulo: 'Gerar o site, pré-visualizar e publicar na Cloudflare ou via GitHub.',
    async render({ conteudo, acoes }) {
      const b = await api('/api/blog');
      preencher(acoes, btn('Pré-visualizar', { onClick: () => previewBlog().then(() => navegar()).catch((e) => toast(e.message, 'erro')) }), botaoAcao('blog.build', 'Gerar site'), botaoAcao('blog.deploy', 'Publicar na Cloudflare', {}, 'btn--primario'), botaoAcao('git.publicar', 'Enviar para o GitHub'));
      const g = b.git;
      const iframe = b.preview.existe ? el('iframe', { class: 'iframe-preview', src: '/preview/', title: 'Pré-visualização do blog' }) : vazio('Clique em "Pré-visualizar" para gerar uma cópia local do site (inclui rascunhos).');
      preencher(conteudo, 
        b.configErros.length ? alerta([el('b', {}, 'Configuração inválida: '), b.configErros.join('; ')], 'erro') : null,
        b.conteudo.erros.length ? alerta([el('b', {}, 'O conteúdo tem problemas que impedem o build: '), el('ul', {}, ...b.conteudo.erros.map((x) => el('li', {}, x))), link('Abrir conteúdo', '#/posts')], 'erro') : null,
        el('div', { class: 'grade grade--3' },
          cartao('Site', el('ul', { class: 'lista' },
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'URL pública'), el('span', { class: 'sub' }, b.url ? link(b.url, b.url, { target: '_blank', rel: 'noopener' }) : '—')), b.siteUrlEnv ? el('span', { class: 'pill', title: 'SITE_URL_BLOG no ambiente' }, `env: ${b.siteUrlEnv}`) : null),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Conteúdo'), el('span', { class: 'sub' }, `${b.conteudo.posts} posts · ${b.conteudo.paginas} páginas · ${b.conteudo.categorias || 0} categorias`)), el('span', { class: `status status--${b.conteudo.erros.length ? 'falta' : 'ok'}` })),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Último build (workspace/blog/dist)'), el('span', { class: 'sub' }, b.dist.existe ? `${b.dist.paginas} páginas · ${fmt.data(b.dist.modificadoEm)}` : 'ainda não gerado')), el('span', { class: `status status--${b.dist.existe ? 'ok' : 'aviso'}` })),
          ), el('p', { class: 'muted' }, 'Base path: ', el('code', {}, b.base), b.basePathEnv ? ` · env BASE_PATH_BLOG=${b.basePathEnv}` : '')),
          cartao('Cloudflare Workers', el('ul', { class: 'lista' },
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'wrangler'), el('span', { class: 'sub' }, b.wrangler.instalado ? 'instalado (dependência de desenvolvimento)' : 'não instalado — rode npm install em central/')), el('span', { class: `status status--${b.wrangler.instalado ? 'ok' : 'falta'}` })),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'CLOUDFLARE_API_TOKEN'), el('span', { class: 'sub' }, b.cloudflareToken ? 'definido' : 'não definido: o wrangler usa o login salvo (npx wrangler login) ou defina em Configuração → Chaves')), el('span', { class: `status status--${b.cloudflareToken ? 'ok' : 'aviso'}` })),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Worker'), el('span', { class: 'sub' }, b.wrangler.worker))),
          ), el('p', { class: 'muted' }, 'Com o Workers Builds ligado ao repositório, cada push na branch de produção também reconstrói e publica o blog.'), el('p', {}, botaoAcao('blog.deploy', 'Publicar agora', {}, 'btn--primario'))),
          cartao('GitHub', g.git ? [el('ul', { class: 'lista' },
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Branch'), el('span', { class: 'sub' }, `${g.branch}${g.commitsNaoEnviados ? ` · ${g.commitsNaoEnviados} commit(s) não enviado(s)` : ''}`))),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Remoto'), el('span', { class: 'sub' }, g.remoto || '—'))),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Último commit'), el('span', { class: 'sub' }, g.ultimoCommit || '—'))),
            el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Alterações em conteudo/, data/ e config'), g.alteracoes.length ? el('ul', { class: 'mono', style: { fontSize: '.78rem', margin: '4px 0 0', paddingLeft: '16px' } }, ...g.alteracoes.slice(0, 12).map((a) => el('li', {}, `${a.estado} ${a.caminho}`)), g.alteracoes.length > 12 ? el('li', {}, `… e mais ${g.alteracoes.length - 12}`) : null) : el('span', { class: 'sub' }, 'nenhuma')), el('span', { class: `status status--${g.alteracoes.length ? 'aviso' : 'ok'}` })),
          ), el('p', {}, botaoAcao('git.publicar', 'Commit + push', {}, g.alteracoes.length ? 'btn--primario' : ''))] : el('p', { class: 'muted' }, `Repositório git indisponível: ${g.motivo}`)),
        ),
        cartao(['Pré-visualização', el('small', {}, b.preview.existe ? [`gerada em ${fmt.data(b.preview.modificadoEm)} · `, link('abrir em nova aba', '/preview/', { target: '_blank', rel: 'noopener' })] : 'não gerada')], iframe),
      );
      app.atualizarPagina = () => navegar();
    },
  };

  // KDP
  PAGINAS.kdp = {
    titulo: 'KDP', subtitulo: 'Livros para o Amazon KDP: interior em PDF, capa, metadados, preço e nichos.',
    async render({ conteudo, acoes, params }) {
      const aba = ['livros', 'preco', 'metadados', 'nichos', 'manuscritos'].includes(params[0]) ? params[0] : 'livros';
      const k = await api('/api/kdp');
      preencher(acoes, botaoAcao('kdp.livro', 'Novo livro', {}, 'btn--primario'), botaoAcao('kdp.metadados', 'Gerar metadados'), botaoAcao('kdp.manuscrito', 'Escrever manuscrito (IA)'));
      const corpo = el('div', { class: 'grade' });
      if (aba === 'livros') {
        juntar(corpo, cartao(['Livros gerados', el('small', {}, `${k.livros.length}`)], tabela({ colunas: [
          { rotulo: 'Título', valor: (l) => [l.titulo, el('span', { class: 'sub' }, `${l.subtitulo || ''}${l.subtitulo ? ' · ' : ''}${l.autor} · ${fmt.data(l.geradoEm)}`)] }, { rotulo: 'Tipo', valor: (l) => l.tipo }, { rotulo: 'Páginas', classe: 'num', valor: (l) => l.paginas }, { rotulo: 'Trim', valor: (l) => `${l.trim} · ${l.papel}` }, { rotulo: 'Lombada', classe: 'num', valor: (l) => `${l.lombadaPol}"` },
          { rotulo: 'Fonte', valor: (l) => el('span', { class: `status status--${l.fontes?.embutida ? 'ok' : 'falta'}` }, l.fontes?.embutida ? 'embutida' : 'não embutida') },
          { rotulo: 'Arquivos', valor: (l) => el('span', { class: 'pontos' }, linkArquivo(l.arquivos.interior, 'interior.pdf'), l.arquivos.capaSvg ? linkArquivo(l.arquivos.capaSvg, 'capa.svg') : null, l.arquivos.capaHtml ? linkArquivo(l.arquivos.capaHtml, 'capa.html') : null, linkArquivo(l.arquivos.metadados, 'metadados.json')) },
          { rotulo: '', classe: 'acoes', valor: (l) => el('span', { class: 'pontos' }, l.arquivosAbs?.capaHtml ? btn('PDF da capa', { onClick: () => executarAcao('design.render', { valores: { arquivo: l.arquivosAbs.capaHtml, pdf: true } }) }, 'btn--mini') : null, btn('Pasta', { onClick: () => { location.hash = `#/arquivos/${l.pasta}`; } }, 'btn--mini')) },
        ], linhas: k.livros, vazio: 'Nenhum livro gerado. Clique em "Novo livro".' })));
        const avisos = k.livros.flatMap((l) => l.avisos.map((a) => `${l.titulo}: ${a}`));
        if (avisos.length) juntar(corpo, alerta([el('b', {}, 'Avisos dos últimos livros:'), el('ul', {}, ...avisos.slice(0, 8).map((a) => el('li', {}, a)))]));
      }
      if (aba === 'preco') {
        const resultado = el('div');
        const form = criarFormulario({ campos: [bool('ebook', 'eBook (em vez de paperback)'), int('paginas', 'Páginas', { padrao: 120, min: 24, max: 828, quando: { campo: 'ebook', valores: ['false'] } }), esc('tinta', 'Tinta', [{ valor: 'pb', rotulo: 'preto e branco' }, { valor: 'cor-padrao', rotulo: 'cor padrão' }, { valor: 'cor-premium', rotulo: 'cor premium' }], { padrao: 'pb', obrigatorio: true, quando: { campo: 'ebook', valores: ['false'] } }), esc('papel', 'Papel (lombada)', opcoesDe('papeis'), { padrao: 'branco', obrigatorio: true, quando: { campo: 'ebook', valores: ['false'] } }), esc('marketplace', 'Marketplace', [...new Set([...k.tabelas.marketplacesPaperback, ...k.tabelas.marketplacesEbook])].map((m) => ({ valor: m, rotulo: m })), { padrao: 'amazon.com', obrigatorio: true }), num('preco', 'Preço de lista', { min: 0, ajuda: 'paperback: vazio mostra só as sugestões' }), num('mb', 'Tamanho do eBook (MB)', { padrao: 1, quando: { campo: 'ebook', valores: ['true'] } })], rotuloEnviar: 'Calcular', aoEnviar: async (v) => {
          const r = await api('/api/kdp/preco', { metodo: 'POST', corpo: v });
          if (r.ebook) { const e = r.ebook; preencher(resultado, el('div', { class: 'tiles' }, tile('Royalty por venda', fmt.moeda(e.royalty, e.moeda), `opção ${e.opcao}% · entrega ${fmt.moeda(e.entrega, e.moeda)}`), tile('Preço', fmt.moeda(r.preco, e.moeda), e.dentroFaixa70 ? 'dentro da faixa de 70%' : `fora da faixa de 70% (${e.faixa70?.join('–')})`))); return; }
          preencher(resultado, el('div', { class: 'tiles' }, tile('Custo de impressão', fmt.moeda(r.custo.custo, r.custo.moeda), `${r.paginas} páginas · ${r.tinta} · ${r.marketplace}`), tile('Lombada', `${r.lombadaPol}"`, r.paginas < 79 ? 'sem texto na lombada (< 79 páginas)' : 'com texto na lombada'), r.royalty ? tile('Royalty no preço informado', fmt.moeda(r.royalty.royalty, r.royalty.moeda), `${fmt.pct(r.royalty.margem, 0)} de margem · mínimo ${fmt.moeda(r.royalty.precoMinimo, r.royalty.moeda)}${r.royalty.viavel ? '' : ' · INVIÁVEL'}`) : null),
            cartao('Preços sugeridos', tabela({ colunas: [{ rotulo: 'Meta de royalty', valor: (s) => fmt.moeda(s.meta, s.moeda) }, { rotulo: 'Preço de lista', classe: 'num', valor: (s) => fmt.moeda(s.preco, s.moeda) }, { rotulo: 'Royalty real', classe: 'num', valor: (s) => fmt.moeda(s.royalty, s.moeda) }], linhas: r.sugestoes }), el('p', { class: 'muted' }, `Tabela ${r.tabela.verificadoEm}. ${r.tabela.observacao}`)));
        } });
        juntar(corpo, cartao('Calculadora de preço e royalty', form.el), resultado);
      }
      if (aba === 'metadados') {
        juntar(corpo, cartao(['Metadados gerados', el('small', {}, 'título, subtítulo, descrição, 7 palavras-chave, categorias')], tabela({ colunas: [{ rotulo: 'Título', valor: (m) => [m.titulo, el('span', { class: 'sub' }, m.subtitulo || '')] }, { rotulo: 'Palavras-chave', valor: (m) => (m.palavrasChave || []).join(' · ') }, { rotulo: 'Categorias', valor: (m) => (m.categorias || []).join(' · ') }, { rotulo: 'Validação', valor: (m) => chip(m.valido ? 'válido' : 'com erros', m.valido ? 'ok' : 'erro') }, { rotulo: 'Gerador', valor: (m) => m.gerador }, { rotulo: '', classe: 'acoes', valor: (m) => linkArquivo(m.arquivo, 'JSON') }], linhas: k.metadados, vazio: 'Nenhum metadado gerado ainda (os livros gerados têm o seu próprio metadados.json).' })));
      }
      if (aba === 'nichos') {
        const saida = el('div');
        const desenharNichos = (n) => { if (!n) { preencher(saida, vazio('Cole um CSV e clique em "Pontuar" para avaliar nichos.')); return; } preencher(saida, cartao(['Nichos pontuados', el('small', {}, `gerado em ${fmt.data(n.geradoEm)}`)], barras(n.nichos.slice(0, 12), { rotulo: (x) => x.termo, valor: (x) => x.score }), tabela({ colunas: [{ rotulo: '#', classe: 'num', valor: (x) => x.posicao }, { rotulo: 'Termo', valor: (x) => x.termo }, { rotulo: 'Buscas/mês', classe: 'num', valor: (x) => fmt.num(x.buscasMes) }, { rotulo: 'Resultados', classe: 'num', valor: (x) => fmt.num(x.resultados) }, { rotulo: 'Preço médio', classe: 'num', valor: (x) => fmt.moeda(x.precoMedio, 'USD') }, { rotulo: 'Score', classe: 'num', valor: (x) => x.score }, { rotulo: 'Classe', valor: (x) => chip(x.classe, x.classe) }], linhas: n.nichos }))); };
        const area = el('textarea', { rows: 8, class: 'mono', placeholder: 'termo;buscas_mes;resultados;preco_medio;bsr_medio_top\ncaça-palavras grande;5400;1200;7.99;35000' });
        const erro = el('p', { class: 'form__erro', hidden: true });
        juntar(corpo, cartao('Pontuar nichos (demanda × concorrência × monetização × tração)', el('div', { class: 'form' }, el('label', { class: 'campo' }, el('span', {}, 'CSV com termo, buscas_mes, resultados, preco_medio, bsr_medio_top'), area), erro, el('div', { class: 'form__rodape' }, btn('Pontuar', { onClick: async () => { erro.hidden = true; try { const r = await api('/api/kdp/nicho', { metodo: 'POST', corpo: { texto: area.value } }); desenharNichos({ geradoEm: new Date().toISOString(), nichos: r.nichos }); } catch (e) { erro.textContent = e.message; erro.hidden = false; } } }, 'btn--primario')))), saida);
        desenharNichos(k.nichos);
      }
      if (aba === 'manuscritos') {
        juntar(corpo, cartao(['Manuscritos', el('small', {}, 'escritos pela IA ou colocados em workspace/kdp/manuscritos')], tabela({ colunas: [{ rotulo: 'Arquivo', valor: (m) => linkArquivo(m.arquivo, m.nome) }, { rotulo: 'Tamanho', classe: 'num', valor: (m) => fmt.tamanho(m.tamanho) }, { rotulo: 'Modificado', valor: (m) => fmt.data(m.modificadoEm) }, { rotulo: '', classe: 'acoes', valor: (m) => btn('Gerar livro deste manuscrito', { onClick: () => executarAcao('kdp.livro', { valores: { tipo: 'texto', manuscrito: m.caminho } }) }, 'btn--mini') }], linhas: k.manuscritos, vazio: 'Nenhum manuscrito. Use "Escrever manuscrito (IA)" (precisa da chave do Claude).' })));
      }
      preencher(conteudo, abas([['livros', `Livros (${k.livros.length})`], ['preco', 'Preço e royalty'], ['metadados', `Metadados (${k.metadados.length})`], ['nichos', 'Nichos'], ['manuscritos', `Manuscritos (${k.manuscritos.length})`]], aba, (id) => { location.hash = `#/kdp/${id}`; }), corpo);
      app.atualizarPagina = () => navegar();
    },
  };

  // Design
  PAGINAS.design = {
    titulo: 'Design', subtitulo: 'Estampas para Merch by Amazon, capas KDP, imagens de listagem e verificação de conformidade.',
    async render({ conteudo, acoes, params }) {
      const aba = ['estampas', 'capas', 'listagens', 'ideias', 'conformidade'].includes(params[0]) ? params[0] : 'estampas';
      const d = await api('/api/design');
      preencher(acoes, botaoAcao('design.camiseta', 'Nova estampa', {}, 'btn--primario'), botaoAcao('design.capa', 'Nova capa'), botaoAcao('design.listagem', 'Nova listagem'), botaoAcao('design.ideias', 'Ideias por nicho'), botaoAcao('design.render', 'Converter arquivo'));
      const corpo = el('div', { class: 'grade' });
      const arq = (item, nome) => item.arquivos.find((a) => a.nome === nome);
      if (aba === 'estampas') {
        juntar(corpo, d.estampas.length ? el('div', { class: 'galeria' }, ...d.estampas.map((e) => { const png = arq(e, 'estampa.png'); const svg = arq(e, 'estampa.svg'); return el('figure', {}, el('img', { class: 'miniatura', src: arquivoUrl((png || svg).caminho), alt: e.titulo || e.nome, loading: 'lazy' }), el('figcaption', {}, el('b', {}, e.titulo || e.nome), el('span', { class: 'muted' }, `${e.layout || ''} · ${e.paleta || ''}`), el('span', {}, chip(e.conformidade === false ? `${e.erros.length} erro(s)` : 'conforme', e.conformidade === false ? 'erro' : 'ok'), ' ', png ? linkArquivo(png.caminho, 'PNG') : muted('sem PNG'), ' ', svg ? linkArquivo(svg.caminho, 'SVG') : null, ' ', link('pasta', `#/arquivos/${e.pasta}`)))); })) : vazio('Nenhuma estampa. Clique em "Nova estampa" ou gere ideias por nicho.'));
      }
      if (aba === 'capas') {
        juntar(corpo, d.capas.length ? el('div', { class: 'galeria' }, ...d.capas.map((c) => { const svg = arq(c, 'capa.svg'); const html = arq(c, 'capa.html'); const pdf = arq(c, 'capa.pdf'); return el('figure', {}, el('img', { class: 'miniatura miniatura--capa', src: arquivoUrl(svg.caminho), alt: c.nome, loading: 'lazy' }), el('figcaption', {}, el('b', {}, c.nome), el('span', {}, linkArquivo(svg.caminho, 'SVG'), ' ', html ? linkArquivo(html.caminho, 'HTML') : null, ' ', pdf ? linkArquivo(pdf.caminho, 'PDF') : (html ? btn('Gerar PDF', { onClick: () => executarAcao('design.render', { valores: { arquivo: `${c.pastaAbs}/capa.html`, pdf: true } }) }, 'btn--mini') : null)))); })) : vazio('Nenhuma capa avulsa (as capas dos livros ficam na pasta de cada livro, em KDP).'));
      }
      if (aba === 'listagens') {
        juntar(corpo, ...(d.listagens.length ? d.listagens.map((l) => { const info = arq(l, 'infografico.svg'); const principal = arq(l, 'principal.svg'); const banner = arq(l, 'banner-a-plus.svg'); return cartao([l.titulo || l.nome, el('small', {}, chip(l.conformidade === false ? `${l.erros.length} erro(s)` : 'conforme', l.conformidade === false ? 'erro' : 'ok'))], el('div', { class: 'galeria' }, ...[principal, info, banner].filter(Boolean).map((a) => el('figure', {}, el('img', { class: 'miniatura miniatura--capa', src: arquivoUrl(a.caminho), alt: a.nome, loading: 'lazy' }), el('figcaption', {}, linkArquivo(a.caminho))))), l.bullets?.length ? el('ul', {}, ...l.bullets.map((b) => el('li', {}, b))) : null, l.descricao ? el('p', { class: 'muted' }, l.descricao) : null, l.erros.length ? alerta(el('ul', {}, ...l.erros.map((x) => el('li', {}, x))), 'erro') : null, el('p', {}, link('pasta', `#/arquivos/${l.pasta}`))); }) : [vazio('Nenhuma listagem. Clique em "Nova listagem".')]));
      }
      if (aba === 'ideias') {
        juntar(corpo, ...(d.ideias.length ? d.ideias.map((i) => cartao([`Nicho: ${i.nicho}`, el('small', {}, `${i.ideias.length} ideias · ${i.idioma} · ${fmt.data(i.geradoEm)}`)], tabela({ colunas: [{ rotulo: 'Estampa', valor: (x) => [x.texto.replace(/\s*\|\s*/g, ' / '), el('span', { class: 'sub' }, x.subtexto || '')] }, { rotulo: 'Layout', valor: (x) => x.estilo }, { rotulo: 'Paleta', valor: (x) => x.paleta }, { rotulo: '', classe: 'acoes', valor: (x) => btn('Produzir', { onClick: () => executarAcao('design.camiseta', { valores: { texto: x.texto, subtexto: x.subtexto || '', layout: opcoesDe('layouts').some((o) => o.valor === x.estilo) ? x.estilo : 'empilhado', paleta: opcoesDe('paletas').some((o) => o.valor === x.paleta) ? x.paleta : 'noite', nicho: i.nicho, idioma: i.idioma } }) }, 'btn--mini') }], linhas: i.ideias }))) : [vazio('Nenhuma lista de ideias. Use "Ideias por nicho".')]));
      }
      if (aba === 'conformidade') {
        const saida = el('div');
        const form = criarFormulario({ campos: [longo('texto', 'Texto da estampa ou qualquer texto', { linhas: 3 }), txt('titulo', 'Título da listagem (opcional)', { largo: true }), txt('marca', 'Marca (opcional)'), longo('descricao', 'Descrição (opcional)', { linhas: 2 })], rotuloEnviar: 'Verificar', aoEnviar: async (v) => { const r = await api('/api/design/conformidade', { metodo: 'POST', corpo: v }); const res = r.resultado; preencher(saida, alerta([el('b', {}, res.ok ? 'Nenhum erro encontrado. ' : `${res.erros.length} erro(s). `), res.erros.length ? el('ul', {}, ...res.erros.map((x) => el('li', {}, x))) : null, res.avisos?.length ? el('ul', {}, ...res.avisos.map((x) => el('li', {}, `aviso: ${x}`))) : null, el('span', { class: 'muted' }, 'A lista de marcas é inicial: pesquise no INPI/USPTO antes de publicar.')], res.ok ? 'ok' : 'erro')); } });
        juntar(corpo, cartao('Conformidade (marcas registradas, termos proibidos, limites)', form.el), saida);
      }
      preencher(conteudo, el('p', { class: 'muted' }, `Renderizador PNG/PDF: ${d.renderizador ? `${d.renderizador.tipo} (${d.renderizador.bin})` : 'nenhum — instale Chromium/Chrome, rsvg-convert, ImageMagick ou Inkscape para gerar PNG/PDF'}`), abas([['estampas', `Estampas (${d.estampas.length})`], ['capas', `Capas (${d.capas.length})`], ['listagens', `Listagens (${d.listagens.length})`], ['ideias', `Ideias (${d.ideias.length})`], ['conformidade', 'Conformidade']], aba, (id) => { location.hash = `#/design/${id}`; }), corpo);
      app.atualizarPagina = () => navegar();
    },
  };

  // Fiscal
  PAGINAS.fiscal = {
    titulo: 'Fiscal', subtitulo: 'Estimativa de imposto e líquido mensal sobre comissões (R$) e royalties KDP (US$): PF, MEI e Simples.',
    async render({ conteudo, acoes }) {
      acoes.replaceChildren();
      const saida = el('div', { class: 'grade' });
      const form = criarFormulario({ campos: [num('comissoes', 'Comissões mensais (R$)', { padrao: 0, min: 0 }), num('royalties', 'Royalties mensais KDP (US$)', { padrao: 0, min: 0 }), num('folha', 'Folha de pagamento mensal (R$, Simples)', { padrao: 0, min: 0 }), num('cambio', 'Câmbio USD→BRL', { padraoDe: 'fiscal.cambioUsdBrl', min: 0.01 })], rotuloEnviar: 'Estimar', aoEnviar: async (v) => {
        const r = await api('/api/fiscal/estimar', { metodo: 'POST', corpo: v });
        const regime = (nome, x, extra) => cartao(nome, el('div', { class: 'kpi-linha' }, el('div', {}, el('b', {}, fmt.moeda(x.liquido)), el('span', {}, 'líquido/mês')), el('div', {}, el('b', {}, fmt.moeda(x.imposto ?? x.irAPagar ?? x.dasMensal)), el('span', {}, 'imposto/mês')), el('div', {}, el('b', {}, fmt.pct(x.cargaEfetiva)), el('span', {}, 'carga efetiva'))), extra, x.observacoes?.length ? el('ul', { class: 'muted', style: { fontSize: '.82rem', paddingLeft: '18px' } }, ...x.observacoes.map((o) => el('li', {}, o))) : null);
        const melhor = [['Pessoa física', r.pf.liquido], ['MEI', r.mei.excedeLimite ? -Infinity : r.mei.liquido], ['Simples', r.simples.liquido]].sort((a, b) => b[1] - a[1])[0];
        preencher(saida, alerta([el('b', {}, `Receita bruta ${fmt.moeda(r.receitaBrutaBrl)}/mês (câmbio ${r.cambio}). `), `Maior líquido estimado: ${melhor[0]} (${fmt.moeda(melhor[1])}). Confirme com um contador.`], 'ok'), el('div', { class: 'grade grade--3' },
          regime(`Pessoa física (carnê-leão, tabela ${r.tabela.vigencia}${r.tabela.redutor ? ' + redutor' : ''})`, r.pf, el('p', { class: 'muted' }, `Base ${fmt.moeda(r.pf.baseCalculo)} · IR bruto ${fmt.moeda(r.pf.irBruto)} · retido nos EUA ${fmt.moeda(r.pf.retidoExterior)} · compensado ${fmt.moeda(r.pf.compensado)}`)),
          regime('MEI', r.mei, r.mei.excedeLimite ? alerta('Excede o limite anual do MEI.', 'erro') : el('p', { class: 'muted' }, `DAS ${fmt.moeda(r.mei.dasMensal)}/mês`)),
          regime(`Simples Nacional (Anexo ${r.simples.anexo})`, r.simples, el('p', { class: 'muted' }, `Fator R ${fmt.pct(r.simples.fatorR)}`)),
        ), el('p', { class: 'muted' }, r.tabela.observacao));
      } });
      preencher(conteudo, cartao('Parâmetros', form.el), saida);
      app.atualizarPagina = null;
    },
  };

  // IA
  PAGINAS.ia = {
    titulo: 'IA (Claude)', subtitulo: 'Textos mais ricos para análises, metadados KDP, manuscritos, listagens e ideias. Opcional: sem chave, tudo roda em modo template.',
    async render({ conteudo, acoes }) {
      const ia = await api('/api/ia');
      preencher(acoes, botaoAcao('ia.testar', 'Testar conexão', {}, 'btn--primario'), btn('Limpar cache', { onClick: async () => { try { const r = await api('/api/ia/limpar-cache', { metodo: 'POST' }); toast(`${r.removidos} respostas removidas do cache`); navegar(); } catch (e) { toast(e.message, 'erro'); } } }));
      const form = criarFormulario({ campos: [txt('modelo', 'Modelo', { obrigatorio: true }), esc('esforco', 'Esforço', ['low', 'medium', 'high', 'max'].map((e) => ({ valor: e, rotulo: e })), { obrigatorio: true }), int('maxTokens', 'max_tokens', { min: 256, max: 128000 }), bool('cache', 'Cache em disco (workspace/ia-cache)'), bool('fallbacks', 'Fallbacks do servidor')], valores: { modelo: ia.modelo, esforco: ia.esforco, maxTokens: ia.maxTokens, cache: ia.cache, fallbacks: ia.fallbacks }, rotuloEnviar: 'Salvar', aoEnviar: async (v) => { const c = await api('/api/config'); c.config.ia = { ...(c.config.ia || {}), modelo: v.modelo, esforco: v.esforco, maxTokens: v.maxTokens, cache: Boolean(v.cache), fallbacks: Boolean(v.fallbacks) }; await api('/api/config', { metodo: 'PUT', corpo: { config: c.config } }); toast('Configuração da IA salva'); app.catalogo = await api('/api/catalogo'); } });
      preencher(conteudo, el('div', { class: 'grade grade--2' },
        cartao('Estado', el('ul', { class: 'lista' }, el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'SDK @anthropic-ai/sdk'), el('span', { class: 'sub' }, ia.sdk ? 'instalado' : 'não instalado — rode npm install dentro de central/')), el('span', { class: `status status--${ia.sdk ? 'ok' : 'falta'}` })), el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Credencial (ANTHROPIC_API_KEY)'), el('span', { class: 'sub' }, ia.credencial ? 'presente' : 'ausente — defina em Configuração → Chaves')), el('span', { class: `status status--${ia.credencial ? 'ok' : 'falta'}` })), el('li', {}, el('span', { class: 'texto' }, el('b', {}, 'Cache'), el('span', { class: 'sub' }, `${ia.cacheItens} respostas guardadas`)))), el('p', {}, ia.pronta ? chip('IA pronta', 'ok') : chip('modo template', 'rascunho'), ' ', link('Configurar chave', '#/config/chaves', { class: 'btn btn--mini' })), el('p', { class: 'muted' }, 'Com a IA ligada, marque a opção "IA" nas ações: gerar análises, metadados KDP, listagens e ideias. O manuscrito sempre usa a IA.')),
        cartao('Parâmetros', form.el)));
      app.atualizarPagina = null;
    },
  };

  // Configuração
  const lerCaminho = (o, c) => c.split('.').reduce((x, k) => (x ? x[k] : undefined), o);
  const definirCaminho = (o, c, v) => { const partes = c.split('.'); let x = o; for (const k of partes.slice(0, -1)) { if (!x[k] || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } x[partes[partes.length - 1]] = v; };
  PAGINAS.config = {
    titulo: 'Configuração', subtitulo: 'Marca, programas de afiliados, blog, KDP, design, fiscal e chaves de API (central/precozen.config.json e central/.env).',
    async render({ conteudo, acoes, params }) {
      const aba = ['geral', 'chaves', 'json'].includes(params[0]) ? params[0] : 'geral';
      acoes.replaceChildren();
      const corpo = el('div', { class: 'grade' });
      if (aba === 'geral') {
        const c = await api('/api/config');
        const cfg = c.config;
        const campos = [
          { tipo: 'secao', rotulo: 'Marca e site' }, txt('marca.nome', 'Nome', { obrigatorio: true }), txt('marca.slogan', 'Slogan'), txt('marca.url', 'URL pública (https://…)', { obrigatorio: true }), txt('marca.basePath', 'Base path', { padrao: '/' }), txt('marca.autor', 'Autor padrão'), txt('marca.email', 'E-mail de contato'), int('marca.ano', 'Ano'), longo('marca.descricao', 'Descrição do site', { linhas: 2 }), { nome: 'marca.tema.corPrimaria', rotulo: 'Cor primária', tipo: 'cor' }, { nome: 'marca.tema.corAcento', rotulo: 'Cor de acento', tipo: 'cor' },
          { tipo: 'secao', rotulo: 'Programas de afiliados' }, txt('afiliados.programas.amazon-br.tag', 'Tag Amazon Brasil (Associados)', { ajuda: 'ex.: minhaloja-20' }), txt('afiliados.programas.amazon-com.tag', 'Tag Amazon.com'), txt('afiliados.programas.magalu.loja', 'Loja Magalu (Parceiro Magalu)'), num('afiliados.pontuacao.conversao', 'Conversão esperada (0–1)', { min: 0, max: 1 }), num('afiliados.pontuacao.classes.ouro', 'Score mínimo: ouro', { min: 0, max: 100 }), num('afiliados.pontuacao.classes.prata', 'Score mínimo: prata', { min: 0, max: 100 }), num('afiliados.pontuacao.classes.bronze', 'Score mínimo: bronze', { min: 0, max: 100 }),
          { tipo: 'secao', rotulo: 'Blog' }, int('blog.postsPorPagina', 'Posts por página', { min: 1, max: 100 }), txt('blog.anuncios.adsense', 'AdSense (ca-pub-…)', { ajuda: 'vazio = sem anúncios' }), longo('blog.divulgacao', 'Texto de divulgação de afiliados', { linhas: 2 }), longo('blog.metodologia', 'Metodologia', { linhas: 2 }),
          { tipo: 'secao', rotulo: 'KDP' }, txt('kdp.autor', 'Autor/editora'), esc('kdp.trimPadrao', 'Trim padrão', opcoesDe('trims'), { obrigatorio: true }), esc('kdp.papelPadrao', 'Papel padrão', opcoesDe('papeis'), { obrigatorio: true }), txt('kdp.marketplacePadrao', 'Marketplace padrão'), txt('kdp.idioma', 'Idioma'), txt('kdp.fonte', 'Fonte TTF (caminho, opcional)', { largo: true }),
          { tipo: 'secao', rotulo: 'Design' }, txt('design.marca', 'Marca nas listagens Merch'), esc('design.paletaPadrao', 'Paleta padrão', opcoesDe('paletas'), { obrigatorio: true }), txt('design.renderizador', 'Renderizador (auto, chromium, rsvg, imagemagick, inkscape, nenhum)'),
          { tipo: 'secao', rotulo: 'Fiscal' }, num('fiscal.cambioUsdBrl', 'Câmbio USD→BRL', { min: 0.01 }), num('fiscal.retencaoEuaRoyalties', 'Retenção nos EUA sobre royalties (0–1)', { min: 0, max: 1 }), bool('fiscal.irpf.redutor.ativo', 'Ativar redutor do IR 2026 (Lei 15.270/2025)'), num('fiscal.mei.dasMensal', 'DAS mensal do MEI (R$)', { min: 0 }),
        ];
        const valores = {};
        for (const f of campos) if (f.tipo !== 'secao') { const v = lerCaminho(cfg, f.nome); valores[f.nome] = v === null || v === undefined ? (f.tipo === 'booleano' ? false : '') : v; }
        const form = criarFormulario({ campos, valores, rotuloEnviar: 'Salvar configuração', aoEnviar: async (v, { controles }) => {
          const novo = JSON.parse(JSON.stringify(cfg));
          for (const [nome, ctl] of controles) { const val = lerControle(ctl); const vazioTexto = val === '' ; if (ctl.campo.tipo === 'booleano') definirCaminho(novo, nome, Boolean(val)); else if (vazioTexto) definirCaminho(novo, nome, nome === 'blog.anuncios.adsense' || nome === 'kdp.fonte' ? null : ''); else definirCaminho(novo, nome, val); }
          if (novo.marca) novo.marca.basePath = novo.marca.basePath || '/';
          await api('/api/config', { metodo: 'PUT', corpo: { config: novo } });
          toast('Configuração salva');
          app.catalogo = await api('/api/catalogo');
          navegar();
        } });
        juntar(corpo, c.erros.length ? alerta([el('b', {}, 'A configuração atual tem erros: '), c.erros.join('; ')], 'erro') : null, cartao(['Configuração', el('small', {}, c.arquivo)], form.el));
      }
      if (aba === 'chaves') {
        const s = await api('/api/segredos');
        const grupos = new Map();
        for (const seg of s.segredos) { const g = grupos.get(seg.grupo) || []; g.push(seg); grupos.set(seg.grupo, g); }
        juntar(corpo, alerta([el('b', {}, 'As chaves ficam só em '), el('code', {}, s.arquivo), ' (ignorado pelo git) e nunca são mostradas de volta. Cole o valor e clique em Salvar; deixe vazio para manter.']));
        for (const [grupo, lista] of grupos) {
          juntar(corpo, cartao(grupo, el('div', { class: 'form' }, ...lista.map((seg) => { const input = el('input', { type: 'password', autocomplete: 'off', placeholder: seg.definido ? '•••••••• (definido)' : 'não definido' }); return el('div', { class: 'lista' }, el('li', { style: { listStyle: 'none' } }, el('span', { class: 'texto' }, el('b', { class: 'mono' }, seg.nome), el('span', { class: 'sub' }, seg.descricao || '')), el('span', { class: `status status--${seg.definido ? 'ok' : 'aviso'}` }, seg.definido ? 'definido' : 'vazio'), el('span', { class: 'pontos' }, input, btn('Salvar', { onClick: async () => { if (!input.value.trim()) { toast('Cole um valor antes de salvar'); return; } try { await api('/api/segredos', { metodo: 'PUT', corpo: { valores: { [seg.nome]: input.value } } }); toast(`${seg.nome} salvo`); navegar(); } catch (e) { toast(e.message, 'erro'); } } }, 'btn--mini btn--primario'), seg.noArquivo ? btn('Remover', { onClick: async () => { if (!(await confirmar(`Remover ${seg.nome} do .env?`, 'Remover'))) return; try { await api('/api/segredos', { metodo: 'PUT', corpo: { valores: { [seg.nome]: null } } }); toast(`${seg.nome} removido`); navegar(); } catch (e) { toast(e.message, 'erro'); } } }, 'btn--mini btn--perigo') : null))); }))));
        }
      }
      if (aba === 'json') {
        const c = await api('/api/config');
        const area = el('textarea', { class: 'mono', rows: 30, spellcheck: 'false' }, JSON.stringify(c.config, null, 2));
        const erro = el('p', { class: 'form__erro', hidden: true });
        juntar(corpo, cartao(['JSON completo', el('small', {}, c.arquivo)], el('div', { class: 'form' }, el('label', { class: 'campo' }, area), erro, el('div', { class: 'form__rodape' }, btn('Salvar', { onClick: async () => { erro.hidden = true; try { const obj = JSON.parse(area.value); await api('/api/config', { metodo: 'PUT', corpo: { config: obj } }); toast('Configuração salva'); app.catalogo = await api('/api/catalogo'); navegar(); } catch (e) { erro.textContent = e.erros?.length ? e.erros.join(' · ') : e.message; erro.hidden = false; } } }, 'btn--primario')))));
      }
      preencher(conteudo, abas([['geral', 'Geral'], ['chaves', 'Chaves e tokens'], ['json', 'JSON avançado']], aba, (id) => { location.hash = `#/config/${id}`; }), corpo);
      app.atualizarPagina = null;
    },
  };

  // Arquivos
  PAGINAS.arquivos = {
    titulo: 'Arquivos', subtitulo: 'Pasta de trabalho (workspace): saídas de afiliados, blog, KDP, design e cache da IA.',
    async render({ conteudo, acoes, params }) {
      const pasta = params.map(decodeURIComponent).join('/');
      const d = await api(`/api/arquivos?pasta=${encodeURIComponent(pasta)}`);
      preencher(acoes, btn('Atualizar', { onClick: () => navegar() }));
      const partes = pasta ? pasta.split('/') : [];
      const trilha = el('nav', { class: 'caminho-pasta' }, link('workspace', '#/arquivos'), ...partes.map((p, i) => [el('span', { class: 'muted' }, ' / '), link(p, `#/arquivos/${partes.slice(0, i + 1).map(encodeURIComponent).join('/')}`)]));
      preencher(conteudo, el('p', { class: 'muted' }, d.raiz), trilha, cartao(null, tabela({ colunas: [
        { rotulo: 'Nome', valor: (i) => (i.tipo === 'pasta' ? link(`📁 ${i.nome}`, `#/arquivos/${i.caminho.split('/').map(encodeURIComponent).join('/')}`) : linkArquivo(i.caminho, i.nome)) }, { rotulo: 'Tamanho', classe: 'num', valor: (i) => fmt.tamanho(i.tamanho) }, { rotulo: 'Modificado', valor: (i) => fmt.data(i.modificadoEm) },
        { rotulo: '', classe: 'acoes', valor: (i) => el('span', { class: 'pontos' }, i.tipo === 'arquivo' ? link('baixar', `${arquivoUrl(i.caminho)}?baixar=1`, { class: 'btn btn--mini' }) : null, btn('Excluir', { onClick: async () => { if (!(await confirmar(`Excluir ${i.tipo} "${i.nome}"?`, 'Excluir'))) return; try { await api('/api/arquivos', { metodo: 'DELETE', corpo: { caminho: i.caminho } }); toast('Excluído'); navegar(); } catch (e) { toast(e.message, 'erro'); } } }, 'btn--mini btn--perigo')) },
      ], linhas: d.itens, vazio: 'Pasta vazia.' })));
      app.atualizarPagina = () => navegar();
    },
  };

  // Tarefas
  PAGINAS.tarefas = {
    titulo: 'Tarefas', subtitulo: 'Comandos executados pelo painel, com o log de cada um.',
    async render({ conteudo, acoes, params }) {
      const d = await api('/api/tarefas');
      for (const t of d.tarefas) app.tarefas.set(t.id, t);
      preencher(acoes, btn('Atualizar', { onClick: () => navegar() }));
      const selecionada = params[0] || d.tarefas[0]?.id || null;
      const pre = el('pre', { class: 'log', id: 'log-tarefa-pagina', dataset: { id: selecionada || '' }, style: { maxHeight: '60vh', minHeight: '200px' } });
      const t = selecionada ? app.tarefas.get(selecionada) : null;
      preencher(conteudo, el('div', { class: 'grade grade--2' },
        cartao('Histórico', tabela({ colunas: [{ rotulo: 'Tarefa', valor: (x) => [x.nome, el('span', { class: 'sub' }, `${fmt.data(x.criadoEm)} · ${x.comandos[0]}`)] }, { rotulo: 'Estado', valor: (x) => chip(ESTADO_TAREFA[x.estado] || x.estado, x.estado) }, { rotulo: 'Duração', classe: 'num', valor: (x) => fmt.duracao(x.inicioEm, x.fimEm) }, { rotulo: '', classe: 'acoes', valor: (x) => (['fila', 'executando'].includes(x.estado) ? btn('Cancelar', { onClick: async () => { try { await api(`/api/tarefas/${x.id}/cancelar`, { metodo: 'POST' }); } catch (e) { toast(e.message, 'erro'); } } }, 'btn--mini btn--perigo') : null) }], linhas: d.tarefas, vazio: 'Nenhuma tarefa executada nesta sessão.', aoClicar: (x) => { location.hash = `#/tarefas/${x.id}`; }, classeLinha: (x) => (x.id === selecionada ? 'selecionada' : '') })),
        cartao([t ? t.nome : 'Log', el('small', {}, t ? `${ESTADO_TAREFA[t.estado] || t.estado}${t.erro ? ` · ${t.erro}` : ''}` : '')], t ? el('p', { class: 'muted mono', style: { fontSize: '.8rem' } }, t.comandos.join('\n')) : null, pre)));
      if (selecionada) renderLog(pre, await carregarLog(selecionada));
      app.atualizarPagina = async () => { const d2 = await api('/api/tarefas'); for (const x of d2.tarefas) app.tarefas.set(x.id, x); if (app.pagina === 'tarefas') navegar(); };
    },
  };

  // ---------- navegação ----------
  const NAV = [['inicio', 'Início'], ['produtos', 'Produtos'], ['posts', 'Conteúdo'], ['blog', 'Publicação'], ['kdp', 'KDP'], ['design', 'Design'], ['fiscal', 'Fiscal'], ['ia', 'IA'], ['arquivos', 'Arquivos'], ['config', 'Configuração'], ['tarefas', 'Tarefas']];
  function montarNav() {
    preencher($('#nav'), ...NAV.map(([id, rotulo]) => el('a', { href: `#/${id}`, dataset: { pagina: id } }, rotulo, id === 'tarefas' ? el('span', { class: 'contador', dataset: { contador: 'tarefas' } }) : null)));
  }
  let navegacao = 0;
  async function navegar() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const nome = PAGINAS[partes[0]] ? partes[0] : 'inicio';
    const pagina = PAGINAS[nome];
    const minha = ++navegacao;
    app.pagina = nome;
    app.atualizarPagina = null;
    for (const a of $('#nav').querySelectorAll('a')) a.classList.toggle('ativo', a.dataset.pagina === nome);
    $('#titulo-pagina').textContent = pagina.titulo;
    $('#subtitulo-pagina').textContent = pagina.subtitulo || '';
    // Cada navegação desenha em contêineres próprios; só a navegação mais recente chega ao DOM (evita corrida entre renders).
    const conteudo = el('div');
    const acoes = el('div');
    $('#acoes-pagina').replaceChildren();
    preencher($('#conteudo'), el('p', { class: 'muted' }, 'Carregando…'));
    try {
      if (!app.catalogo) app.catalogo = await api('/api/catalogo');
      await pagina.render({ conteudo, acoes, params: partes.slice(1) });
      if (minha !== navegacao) return;
      preencher($('#acoes-pagina'), ...[...acoes.childNodes]);
      preencher($('#conteudo'), ...[...conteudo.childNodes]);
    } catch (e) {
      if (minha !== navegacao) return;
      preencher($('#conteudo'), alerta([el('b', {}, 'Erro: '), e.message, e.erros?.length ? el('ul', {}, ...e.erros.map((x) => el('li', {}, x))) : null], 'erro'));
    }
  }
  window.addEventListener('hashchange', navegar);

  // ---------- sessão ----------
  function mostrarLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    if (app.sse) { app.sse.close(); app.sse = null; }
    $('#form-login input[name="token"]').focus();
  }
  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = $('#login-erro');
    erro.hidden = true;
    const token = $('#form-login input[name="token"]').value.trim();
    try {
      const r = await fetch('/api/sessao', { method: 'POST', headers: { 'X-Precozen-Painel': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.erro || (r.status === 429 ? 'muitas tentativas: aguarde um minuto' : 'token inválido'));
      $('#form-login input[name="token"]').value = '';
      await iniciar();
    } catch (e) { erro.textContent = e.message; erro.hidden = false; }
  });
  $('#btn-sair').addEventListener('click', async () => { try { await api('/api/sessao', { metodo: 'DELETE' }); } catch { /* já saiu */ } app.catalogo = null; mostrarLogin(); });

  async function iniciar() {
    let sessao = { autenticado: false };
    try { sessao = await (await fetch('/api/sessao', { credentials: 'same-origin' })).json(); } catch { sessao = { autenticado: false }; }
    if (!sessao.autenticado) { mostrarLogin(); return; }
    $('#login').hidden = true;
    $('#app').hidden = false;
    montarNav();
    ligarStream();
    app.catalogo = null;
    await navegar();
  }
  iniciar();
})();
