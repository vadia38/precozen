import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-admin-'));
const conteudo = path.join(ws, 'conteudo');
fs.cpSync(path.join(RAIZ, 'conteudo'), conteudo, { recursive: true });
process.env.PRECOZEN_WORKSPACE = path.join(ws, 'workspace');
process.env.PRECOZEN_CONTEUDO = conteudo;
process.env.PRECOZEN_ENV = path.join(ws, '.env');
delete process.env.PRECOZEN_PAINEL_TOKEN;
delete process.env.CLOUDFLARE_API_TOKEN;

const { Sessoes, verificarOrigem, nomeDoHost, lerCookies, gerarToken } = await import('../src/painel/admin/sessao.js');
const { FilaTarefas } = await import('../src/painel/admin/tarefas.js');
const { validarOpcoes, montarArgs, ACOES, resolverCaminhoPermitido, catalogo, prepararTarefa } = await import('../src/painel/admin/acoes.js');
const { iniciarAdmin } = await import('../src/painel/admin/servidor.js');

const TOKEN = 'token-de-teste-com-tamanho-suficiente';
let servidor;
let base;
let cookie = '';
const req = async (caminho, { metodo = 'GET', corpo, cabecalhos = {}, semHeader = false, cru = false } = {}) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { ...(semHeader ? {} : { 'X-Precozen-Painel': '1' }), 'Content-Type': 'application/json', Cookie: cookie, ...cabecalhos }, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  if (cru) return r;
  const txt = await r.text();
  let dados;
  try { dados = JSON.parse(txt); } catch { dados = txt; }
  return { status: r.status, dados, cabecalhos: r.headers };
};

before(async () => {
  servidor = await iniciarAdmin({ porta: 0, token: TOKEN, silencioso: true });
  base = servidor.url;
});
after(async () => {
  await servidor.fechar();
  fs.rmSync(ws, { recursive: true, force: true });
});

test('sessões: token, bloqueio por tentativas e cookies', () => {
  assert.throws(() => new Sessoes({ token: 'curto' }));
  const s = new Sessoes({ token: TOKEN, maxTentativas: 3 });
  assert.equal(s.autenticar('errado', 'x').ok, false);
  assert.equal(s.autenticar('errado', 'x').ok, false);
  assert.equal(s.autenticar('errado', 'x').bloqueado, true);
  assert.equal(s.autenticar(TOKEN, 'x').bloqueado, true, 'bloqueado mesmo com o token certo dentro da janela');
  const ok = s.autenticar(TOKEN, 'y');
  assert.ok(ok.ok && s.validar(ok.id));
  assert.match(s.cookie(ok.id), /HttpOnly; SameSite=Strict/);
  s.remover(ok.id);
  assert.equal(s.validar(ok.id), false);
  assert.equal(lerCookies('a=1; precozen_painel=abc%20d').precozen_painel, 'abc d');
  assert.equal(nomeDoHost('[::1]:4200'), '::1');
  assert.equal(nomeDoHost('Localhost:4200'), 'localhost');
  assert.ok(gerarToken().length >= 32);
});

test('verificações de origem (rebinding e CSRF)', () => {
  const hosts = new Set(['localhost', '127.0.0.1', '::1']);
  const r = (method, headers) => verificarOrigem({ method, headers }, { hostsPermitidos: hosts });
  assert.equal(r('GET', { host: '127.0.0.1:4200' }), null);
  assert.match(r('GET', { host: 'painel.exemplo.com' }), /host não permitido/);
  assert.match(r('POST', { host: 'localhost:4200' }), /X-Precozen-Painel/);
  assert.equal(r('POST', { host: 'localhost:4200', 'x-precozen-painel': '1' }), null);
  assert.match(r('POST', { host: 'localhost:4200', 'x-precozen-painel': '1', origin: 'http://evil.test' }), /origem não permitida/);
  assert.equal(r('POST', { host: 'localhost:4200', 'x-precozen-painel': '1', origin: 'http://localhost:4200', 'sec-fetch-site': 'same-origin' }), null);
  assert.match(r('POST', { host: 'localhost:4200', 'x-precozen-painel': '1', 'sec-fetch-site': 'cross-site' }), /outro site/);
  const lan = (headers) => verificarOrigem({ method: 'GET', headers }, { hostsPermitidos: hosts, aceitarIps: true });
  assert.equal(lan({ host: '192.168.0.10:4200' }), null, 'IP literal aceito no modo rede local');
  assert.equal(lan({ host: '[fe80::1]:4200' }), null);
  assert.match(lan({ host: 'painel.exemplo.com' }), /host não permitido/, 'nomes de domínio continuam restritos');
});

test('catálogo de ações: validação e argumentos', async () => {
  assert.ok(Object.keys(ACOES).length >= 15);
  assert.throws(() => validarOpcoes('kdp.livro', { tipo: 'inexistente' }), /opção desconhecida|obrigatório/);
  assert.throws(() => validarOpcoes('kdp.livro', { tipo: 'sudoku', titulo: 'x', paginas: 3 }), /mínimo 24/);
  assert.throws(() => validarOpcoes('kdp.livro', { tipo: 'sudoku', titulo: 'linha\nquebrada' }), /quebras de linha/);
  assert.throws(() => validarOpcoes('design.render', { arquivo: '/etc/passwd' }), /fora das pastas permitidas/);
  const v = validarOpcoes('kdp.livro', { tipo: 'sudoku', titulo: 'Meu livro', capa: false, quantidade: '5', inicio: '2027-01', desconhecido: 'ignorado' });
  assert.deepEqual(v, { tipo: 'sudoku', titulo: 'Meu livro', quantidade: 5, inicio: '2027-01', capa: false });
  assert.deepEqual(montarArgs(ACOES['kdp.livro'], v), ['--tipo=sudoku', '--titulo=Meu livro', '--quantidade=5', '--inicio=2027-01', '--no-capa']);
  assert.throws(() => resolverCaminhoPermitido('../../../../etc/passwd'), /fora das pastas/);
  assert.equal(resolverCaminhoPermitido('data/produtos-exemplo.csv'), path.join(RAIZ, 'data', 'produtos-exemplo.csv'));
  const c = catalogo();
  assert.ok(c.acoes.find((a) => a.id === 'kdp.livro').campos.find((f) => f.nome === 'trim').opcoes.length > 10);
  assert.ok(c.opcoes.programas.length >= 5);
  const t = await prepararTarefa('afiliados.analisar', { top: 5 });
  assert.equal(t.passos.length, 1);
  assert.ok(t.passos[0].args.includes('--top=5'));
  await assert.rejects(prepararTarefa('git.publicar', { mensagem: '-x' }), /nenhuma alteração|não pode começar/);
});

test('fila de tarefas: sucesso, falha, cancelamento e log', async () => {
  const fila = new FilaTarefas();
  const ok = fila.criar({ nome: 'ok', passos: [{ comando: process.execPath, args: ['-e', "console.log('linha 1'); console.error('linha 2')"] }, { comando: process.execPath, args: ['-e', "console.log('passo 2')"] }], notas: ['nota inicial'] });
  const falha = fila.criar({ nome: 'falha', passos: [{ comando: process.execPath, args: ['-e', 'process.exit(3)'] }] });
  const cancelada = fila.criar({ nome: 'cancelada', passos: [{ comando: process.execPath, args: ['-e', 'setTimeout(() => {}, 10000)'] }] });
  fila.cancelar(cancelada.id);
  const r1 = await fila.esperar(ok.id);
  assert.equal(r1.estado, 'ok');
  assert.deepEqual(r1.log.filter((l) => !l.startsWith('$ ')), ['nota inicial', 'linha 1', 'linha 2', 'passo 2']);
  const r2 = await fila.esperar(falha.id);
  assert.equal(r2.estado, 'erro');
  assert.equal(r2.codigo, 3);
  assert.equal(fila.obter(cancelada.id).estado, 'cancelada');
  const inexistente = fila.criar({ nome: 'sem binário', passos: [{ comando: '/caminho/que/nao/existe', args: [] }] });
  assert.equal((await fila.esperar(inexistente.id)).estado, 'erro');
  assert.equal(fila.listar().length, 4);
});

test('servidor: autenticação, CSRF e host', async () => {
  assert.equal((await req('/api/sessao')).dados.autenticado, false);
  assert.equal((await req('/api/estado')).status, 401);
  assert.equal((await req('/api/sessao', { metodo: 'POST', corpo: { token: TOKEN }, semHeader: true })).status, 403, 'sem o cabeçalho anti-CSRF');
  assert.equal((await req('/api/sessao', { metodo: 'POST', corpo: { token: 'errado' } })).status, 401);
  const statusHost = await new Promise((resolve, reject) => { const u = new URL(base); http.get({ host: u.hostname, port: u.port, path: '/api/sessao', setHost: false, headers: { Host: 'painel.exemplo.com' } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject); });
  assert.equal(statusHost, 403, 'host de fora (DNS rebinding)');
  const r = await req('/api/sessao', { metodo: 'POST', corpo: { token: TOKEN } });
  assert.equal(r.status, 200);
  assert.match(cookie, /^precozen_painel=/);
  assert.equal((await req('/api/sessao')).dados.autenticado, true);
  const html = await req('/', { cru: true });
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy'), /script-src 'self'/);
  const viaUrl = await fetch(`${base}/?token=${TOKEN}`, { redirect: 'manual' });
  assert.equal(viaUrl.status, 302);
  assert.match(viaUrl.headers.get('set-cookie'), /precozen_painel=/);
  assert.equal((await fetch(`${base}/?token=errado`, { redirect: 'manual' })).status, 403);
});

test('servidor: estado, catálogo e importação de produtos', async () => {
  const e = await req('/api/estado');
  assert.equal(e.status, 200);
  assert.equal(e.dados.kpis.produtos, 0);
  assert.ok(e.dados.posts.length > 0, 'posts de exemplo copiados para a pasta temporária');
  const c = await req('/api/catalogo');
  assert.ok(c.dados.acoes.length >= 15);
  assert.equal(c.dados.config.kdp.trimPadrao, '6x9');
  const csv = fs.readFileSync(path.join(RAIZ, 'data', 'produtos-exemplo.csv'), 'utf8');
  const imp = await req('/api/produtos/importar', { metodo: 'POST', corpo: { texto: csv, nome: 'exemplo.csv', programa: 'amazon-br' } });
  assert.equal(imp.status, 200);
  assert.equal(imp.dados.total, 26);
  assert.ok(fs.existsSync(path.join(process.env.PRECOZEN_WORKSPACE, 'afiliados', 'importacoes', imp.dados.arquivo.split('/').pop())));
  assert.equal((await req('/api/produtos/importar', { metodo: 'POST', corpo: { texto: '   ' } })).status, 400);
});

test('servidor: tarefa de análise, edição e exclusão de produtos', async () => {
  const t = await req('/api/tarefas', { metodo: 'POST', corpo: { acao: 'afiliados.analisar', opcoes: {} } });
  assert.equal(t.status, 200);
  const fim = await servidor.fila.esperar(t.dados.tarefa.id);
  assert.equal(fim.estado, 'ok', fim.log.join('\n'));
  const p = await req('/api/produtos');
  assert.equal(p.dados.total, 26);
  assert.ok(p.dados.produtos[0].pontuacao.score > 0);
  assert.equal(p.dados.desatualizado, false);
  const id = p.dados.produtos[0].id;
  const um = await req(`/api/produtos/${encodeURIComponent(id)}`);
  assert.equal(um.dados.registro.nome, p.dados.produtos[0].nome);
  const ed = await req(`/api/produtos/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { registro: { preco: '1234.5', pros: 'um; dois' } } });
  assert.equal(ed.status, 200);
  assert.equal(ed.dados.produto.preco, 1234.5);
  assert.equal(ed.dados.registro.pros, 'um; dois');
  assert.equal((await req(`/api/produtos/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { registro: { nome: '' } } })).status, 400);
  assert.equal((await req('/api/produtos', { metodo: 'POST', corpo: { registro: { nome: 'Produto manual', preco: 99, programa: 'shopee', link: 'https://s.shopee.com.br/x' } } })).dados.total, 27);
  assert.equal((await req('/api/produtos')).dados.desatualizado, true, 'a base mudou depois do ranking');
  const del = await req(`/api/produtos/${encodeURIComponent('shopee:produto-manual')}`, { metodo: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal(del.dados.total, 26);
  assert.equal((await req('/api/produtos/nao-existe', { metodo: 'DELETE' })).status, 404);
  const ruim = await req('/api/tarefas', { metodo: 'POST', corpo: { acao: 'kdp.livro', opcoes: { tipo: 'sudoku' } } });
  assert.equal(ruim.status, 400);
  assert.match(ruim.dados.erro, /Título: obrigatório/);
  assert.equal((await req('/api/tarefas', { metodo: 'POST', corpo: { acao: 'rm -rf', opcoes: {} } })).status, 400);
});

test('servidor: posts (criar, salvar, renomear, validar, excluir) e páginas', async () => {
  const lista = await req('/api/posts');
  assert.ok(lista.dados.total >= 10);
  assert.equal(lista.dados.erros.length, 0);
  const novo = await req('/api/posts', { metodo: 'POST', corpo: { titulo: 'Post de teste do painel', categoria: 'cozinha', tipo: 'artigo', rascunho: true } });
  assert.equal(novo.status, 200);
  assert.equal(novo.dados.post.arquivo, 'post-de-teste-do-painel.md');
  assert.equal(novo.dados.post.rascunho, true);
  assert.equal((await req('/api/posts', { metodo: 'POST', corpo: { titulo: 'Post de teste do painel' } })).status, 409);
  const um = await req('/api/posts/post-de-teste-do-painel.md');
  assert.equal(um.dados.meta.titulo, 'Post de teste do painel');
  const invalido = await req('/api/posts/post-de-teste-do-painel.md', { metodo: 'PUT', corpo: { meta: { ...um.dados.meta, nota: 12, rascunho: false }, corpo: '## Oi' } });
  assert.equal(invalido.status, 400);
  assert.match(invalido.dados.erro, /nota/);
  const salvo = await req('/api/posts/post-de-teste-do-painel.md', { metodo: 'PUT', corpo: { meta: { ...um.dados.meta, titulo: 'Post renomeado', slug: 'post-renomeado', nota: 8, rascunho: false, tags: ['a', 'b'] }, corpo: '## Seção\n\nTexto do post.' } });
  assert.equal(salvo.status, 200, JSON.stringify(salvo.dados));
  assert.equal(salvo.dados.arquivo, 'post-renomeado.md');
  assert.ok(!fs.existsSync(path.join(conteudo, 'posts', 'post-de-teste-do-painel.md')));
  const relido = await req('/api/posts/post-renomeado.md');
  assert.deepEqual(relido.dados.meta.tags, ['a', 'b']);
  assert.equal(relido.dados.meta.nota, 8);
  assert.match(relido.dados.corpo, /Texto do post/);
  assert.ok([400, 404].includes((await req('/api/posts/..%2Fpackage.json')).status), 'caminho com .. é recusado');
  assert.equal((await req('/api/posts/nao-existe.md')).status, 404);
  const prev = await req('/api/blog/preview', { metodo: 'POST' });
  assert.equal(prev.status, 200);
  const pagina = await req('/preview/post/post-renomeado/', { cru: true });
  assert.equal(pagina.status, 200);
  assert.match(pagina.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.match(await pagina.text(), /Texto do post/);
  assert.equal((await req('/api/posts/post-renomeado.md', { metodo: 'DELETE' })).status, 200);
  const paginas = await req('/api/paginas');
  assert.ok(paginas.dados.paginas.some((p) => p.slug === 'sobre'));
  const sobre = await req('/api/paginas/sobre.md');
  const salvaPag = await req('/api/paginas/sobre.md', { metodo: 'PUT', corpo: { meta: sobre.dados.meta, corpo: `${sobre.dados.corpo}\n\nLinha nova.` } });
  assert.equal(salvaPag.status, 200);
  assert.match((await req('/api/paginas/sobre.md')).dados.corpo, /Linha nova/);
});

test('servidor: blog, kdp, fiscal, design, ia e arquivos', async () => {
  const b = await req('/api/blog');
  assert.equal(b.status, 200);
  assert.equal(typeof b.dados.wrangler.instalado, 'boolean');
  assert.equal(b.dados.git.git, true);
  const preco = await req('/api/kdp/preco', { metodo: 'POST', corpo: { paginas: 120, preco: 9.99 } });
  assert.equal(preco.status, 200);
  assert.ok(preco.dados.royalty.royalty > 0 && preco.dados.sugestoes.length > 0);
  assert.equal((await req('/api/kdp/preco', { metodo: 'POST', corpo: { paginas: 120, marketplace: 'amazon.xx' } })).status, 400);
  const nicho = await req('/api/kdp/nicho', { metodo: 'POST', corpo: { texto: fs.readFileSync(path.join(RAIZ, 'data', 'nichos-exemplo.csv'), 'utf8') } });
  assert.ok(nicho.dados.nichos.length >= 5);
  const f = await req('/api/fiscal/estimar', { metodo: 'POST', corpo: { comissoes: 3500, royalties: 400 } });
  assert.ok(f.dados.pf.liquido > 0 && f.dados.mei.liquido > 0 && f.dados.simples.liquido > 0);
  const conf = await req('/api/design/conformidade', { metodo: 'POST', corpo: { texto: 'Nike é vida' } });
  assert.equal(conf.dados.resultado.ok, false);
  const ia = await req('/api/ia');
  assert.equal(typeof ia.dados.pronta, 'boolean');
  const livro = await req('/api/tarefas', { metodo: 'POST', corpo: { acao: 'kdp.livro', opcoes: { tipo: 'sudoku', titulo: 'Sudoku Teste', paginas: 24, quantidade: 4, capa: false } } });
  const fim = await servidor.fila.esperar(livro.dados.tarefa.id);
  assert.equal(fim.estado, 'ok', fim.log.join('\n'));
  const k = await req('/api/kdp');
  assert.equal(k.dados.livros.length, 1);
  const pdf = await req(`/arquivo/${k.dados.livros[0].arquivos.interior}`, { cru: true });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal((await req('/arquivo/../package.json', { cru: true })).status, 404);
  assert.equal((await req('/arquivo/%2e%2e/package.json', { cru: true })).status, 404);
  const arq = await req('/api/arquivos?pasta=kdp');
  assert.ok(arq.dados.itens.some((i) => i.nome === 'sudoku-teste' && i.tipo === 'pasta'));
  assert.equal((await req('/api/arquivos?pasta=../')).status, 400);
  assert.equal((await req('/api/arquivos', { metodo: 'DELETE', corpo: { caminho: '' } })).status, 400);
  assert.equal((await req('/api/arquivos', { metodo: 'DELETE', corpo: { caminho: 'kdp/sudoku-teste' } })).status, 200);
  assert.equal((await req('/api/kdp')).dados.livros.length, 0);
  const tarefas = await req('/api/tarefas');
  assert.ok(tarefas.dados.tarefas.length >= 2);
  assert.equal((await req(`/api/tarefas/${livro.dados.tarefa.id}`)).dados.tarefa.log.length > 0, true);
});

test('servidor: configuração e chaves (.env isolado)', async () => {
  const c = await req('/api/config');
  assert.equal(c.dados.erros.length, 0);
  const invalida = await req('/api/config', { metodo: 'PUT', corpo: { config: { ...c.dados.config, marca: { ...c.dados.config.marca, url: 'ftp://x' } } } });
  assert.equal(invalida.status, 400);
  assert.ok(invalida.dados.erros.length);
  assert.equal((await req('/api/config', { metodo: 'PUT', corpo: { config: JSON.parse('{"__proto__": {"a": 1}, "marca": {}}') } })).status, 400);
  const s = await req('/api/segredos');
  assert.ok(s.dados.segredos.some((x) => x.nome === 'ANTHROPIC_API_KEY'));
  assert.ok(s.dados.segredos.every((x) => x.valor === undefined), 'valores nunca voltam');
  assert.equal((await req('/api/segredos', { metodo: 'PUT', corpo: { valores: { NODE_OPTIONS: '--require x' } } })).status, 400, 'só chaves conhecidas');
  assert.equal((await req('/api/segredos', { metodo: 'PUT', corpo: { valores: { CLOUDFLARE_API_TOKEN: 'a\nb' } } })).status, 400);
  const grava = await req('/api/segredos', { metodo: 'PUT', corpo: { valores: { CLOUDFLARE_API_TOKEN: 'tok-123 #x', SITE_URL_BLOG: 'https://exemplo.test' } } });
  assert.equal(grava.status, 200);
  const env = fs.readFileSync(process.env.PRECOZEN_ENV, 'utf8');
  assert.match(env, /CLOUDFLARE_API_TOKEN="tok-123 #x"/);
  assert.match(env, /SITE_URL_BLOG=https:\/\/exemplo.test/);
  assert.equal(process.env.CLOUDFLARE_API_TOKEN, 'tok-123 #x');
  assert.equal((await req('/api/blog')).dados.cloudflareToken, true);
  assert.equal((await req('/api/segredos')).dados.segredos.find((x) => x.nome === 'CLOUDFLARE_API_TOKEN').definido, true);
  await req('/api/segredos', { metodo: 'PUT', corpo: { valores: { CLOUDFLARE_API_TOKEN: null, SITE_URL_BLOG: null } } });
  assert.doesNotMatch(fs.readFileSync(process.env.PRECOZEN_ENV, 'utf8'), /CLOUDFLARE_API_TOKEN/);
  assert.equal(process.env.CLOUDFLARE_API_TOKEN, undefined);
});

test('servidor: fluxo de eventos (SSE) e saída', async () => {
  const controlador = new AbortController();
  const r = await fetch(`${base}/api/tarefas/stream`, { headers: { Cookie: cookie }, signal: controlador.signal });
  assert.equal(r.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const leitor = r.body.getReader();
  const { value } = await leitor.read();
  assert.match(new TextDecoder().decode(value), /event: estado/);
  controlador.abort();
  assert.equal((await req('/api/sessao', { metodo: 'DELETE' })).status, 200);
  assert.equal((await req('/api/estado')).status, 401);
});
