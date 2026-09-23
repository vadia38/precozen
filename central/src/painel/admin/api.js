// Rotas JSON do painel administrativo. Cada rota devolve um objeto (vira JSON) ou lança ErroHttp.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_CENTRAL, workspace, lerJson, gravarJson, gravarTexto, listarArquivos, nomeSeguro, caminhoSeguro } from '../../core/arquivos.js';
import { carregarConfig, validarConfig } from '../../core/config.js';
import { analisar as lerFrontMatter, serializar } from '../../core/frontmatter.js';
import { slug, dataIso, contarPalavras, truncar } from '../../core/util.js';
import { carregarProdutos, salvarProdutos, importarRegistros, importarDeFonte, caminhoProdutos } from '../../afiliados/importar.js';
import { carregarRanking, caminhoRanking } from '../../afiliados/analisar.js';
import { DIR_POSTS } from '../../afiliados/reviews.js';
import { DIR_CONTEUDO, carregarBlog, validarPost } from '../../blog/conteudo.js';
import { construirBlog } from '../../blog/build.js';
import { coletarEstado } from '../build.js';
import { compararRegimes } from '../../fiscal/calculos.js';
import { sugerirPrecos, royaltyPaperback, royaltyEbook, custoImpressao, TABELAS } from '../../kdp/royalties.js';
import { larguraLombada } from '../../kdp/especificacoes.js';
import { analisarNichosDeArquivo } from '../../kdp/nicho.js';
import { verificarTexto, verificarListagemMerch, verificarListagemAmazon } from '../../design/conformidade.js';
import { disponibilidade, limparCache, PADRAO_IA } from '../../ia/cliente.js';
import { detectarRenderizador } from '../../design/render.js';
import { catalogo, prepararTarefa, estadoGit, localizarWrangler } from './acoes.js';

export class ErroHttp extends Error {
  constructor(status, mensagem, extras = {}) { super(mensagem); this.status = status; this.extras = extras; }
}

const DIR_PAGINAS = path.join(DIR_CONTEUDO, 'paginas');
const arquivoEnv = () => (process.env.PRECOZEN_ENV ? path.resolve(process.env.PRECOZEN_ENV) : path.join(RAIZ_CENTRAL, '.env'));
const ARQUIVO_ENV_EXEMPLO = path.join(RAIZ_CENTRAL, '.env.example');
const SEGREDOS_EXTRAS = { PRECOZEN_PAINEL_TOKEN: 'Token fixo de acesso ao painel administrativo', CLOUDFLARE_API_TOKEN: 'Token da API da Cloudflare para o wrangler deploy', CLOUDFLARE_ACCOUNT_ID: 'Id da conta Cloudflare (opcional)', SITE_URL_BLOG: 'URL pública do blog usada no build', BASE_PATH_BLOG: 'Base path do blog usado no build' };
const CONTROLE = /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const CHAVES_PERIGOSAS = new Set(['__proto__', 'constructor', 'prototype']);

function versaoPacote() {
  try { return lerJson(path.join(RAIZ_CENTRAL, 'package.json')).version; } catch { return '?'; }
}

function relWorkspace(abs) {
  if (!abs || typeof abs !== 'string') return null;
  const rel = path.relative(workspace(), path.resolve(abs));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : null;
}

function mtime(p) {
  try { return fs.statSync(p).mtime.toISOString(); } catch { return null; }
}

function texto(v, { max = 5000, linhas = false, rotulo = 'texto' } = {}) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') throw new ErroHttp(400, `${rotulo}: valor inválido`);
  const s = String(v);
  if (CONTROLE.test(s)) throw new ErroHttp(400, `${rotulo}: caracteres de controle não permitidos`);
  if (!linhas && /[\r\n]/.test(s)) throw new ErroHttp(400, `${rotulo}: não pode ter quebras de linha`);
  if (s.length > max) throw new ErroHttp(400, `${rotulo}: no máximo ${max} caracteres`);
  return s;
}

function numero(v, { rotulo = 'número', padrao = 0, min = -Infinity, max = Infinity } = {}) {
  if (v === undefined || v === null || v === '') return padrao;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw new ErroHttp(400, `${rotulo}: número inválido`);
  if (n < min || n > max) throw new ErroHttp(400, `${rotulo}: fora do intervalo ${min}–${max}`);
  return n;
}

function objeto(v, rotulo = 'corpo') {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroHttp(400, `${rotulo}: esperado um objeto`);
  return v;
}

/** Limpa um objeto vindo do cliente: chaves seguras, sem protótipo, profundidade limitada. */
function limparObjeto(v, profundidade = 0) {
  if (profundidade > 12) throw new ErroHttp(400, 'estrutura profunda demais');
  if (Array.isArray(v)) return v.map((x) => limparObjeto(x, profundidade + 1));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (CHAVES_PERIGOSAS.has(k) || !/^[A-Za-z_][\w.-]*$/.test(k)) throw new ErroHttp(400, `chave inválida: ${k}`);
      out[k] = limparObjeto(val, profundidade + 1);
    }
    return out;
  }
  if (typeof v === 'string') { if (CONTROLE.test(v)) throw new ErroHttp(400, 'caracteres de controle não permitidos'); return v; }
  if (typeof v === 'number' && !Number.isFinite(v)) throw new ErroHttp(400, 'número inválido');
  return v;
}

function nomeArquivoMd(v) {
  const s = String(v || '');
  if (!/^[a-z0-9][a-z0-9._-]{0,180}\.md$/i.test(s) || s.includes('..')) throw new ErroHttp(400, `nome de arquivo inválido: ${s}`);
  return s;
}

function produtoResumido(p) {
  return {
    id: p.id, identificador: p.identificador, programa: p.programa, nome: p.nome, marca: p.marca, categoria: p.categoria, categoriaNome: p.categoriaNome, preco: p.preco, precoAntigo: p.precoAntigo, moeda: p.moeda,
    comissaoTaxa: p.comissaoTaxa, comissaoInformada: p.comissaoInformada, comissaoValor: p.comissaoValor ?? Math.round((p.preco || 0) * (p.comissaoTaxa || 0) * 100) / 100, bsr: p.bsr, vendasMes: p.vendasMes, vendasFonte: p.vendasFonte,
    avaliacao: p.avaliacao, numAvaliacoes: p.numAvaliacoes, tendencia: p.tendencia, url: p.url, link: p.link, imagem: p.imagem, atualizadoEm: p.atualizadoEm, pontuacao: p.pontuacao || null,
  };
}

/** Converte um produto salvo no registro bruto que a importação entende (para edições parciais). */
export function produtoParaRegistro(p) {
  return {
    id: p.identificador || '', programa: p.programa, nome: p.nome, marca: p.marca || '', categoria: p.categoriaOriginal || p.categoria || '', preco: p.preco ?? '', preco_antigo: p.precoAntigo ?? '',
    comissao: p.comissaoInformada ? Math.round(p.comissaoTaxa * 10000) / 100 : '', bsr: p.bsr ?? '', vendas_mes: p.vendasFonte === 'informado' ? p.vendasMes : '', total_vendido: p.totalVendido ?? '', criado_em: p.criadoEm || '',
    avaliacao: p.avaliacao ?? '', avaliacoes: p.numAvaliacoes || '', tendencia: p.tendencia ?? '', url: p.url || '', link: p.link || '', imagem: p.imagem || '', descricao: p.descricao || '',
    pros: (p.pros || []).join('; '), contras: (p.contras || []).join('; '), atributos: Object.entries(p.atributos || {}).map(([k, v]) => `${k}=${v}`).join('; '), palavras_chave: (p.palavrasChave || []).join(', '), publico: p.publico || '',
  };
}

const CHAVES_REGISTRO = new Set(['id', 'programa', 'nome', 'marca', 'categoria', 'preco', 'preco_antigo', 'comissao', 'bsr', 'vendas_mes', 'total_vendido', 'criado_em', 'avaliacao', 'avaliacoes', 'tendencia', 'url', 'link', 'imagem', 'descricao', 'pros', 'contras', 'atributos', 'palavras_chave', 'publico']);

function limparRegistro(bruto) {
  const r = objeto(bruto, 'registro');
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (!CHAVES_REGISTRO.has(k)) continue;
    if (v === null || v === undefined) continue;
    out[k] = texto(v, { max: 5000, linhas: true, rotulo: k });
  }
  return out;
}

function listarPostsBrutos(dir = DIR_POSTS) {
  const posts = [];
  for (const arquivo of listarArquivos(dir, (p) => p.endsWith('.md'))) {
    let meta = {}; let corpo = '';
    try { ({ meta, corpo } = lerFrontMatter(fs.readFileSync(arquivo, 'utf8'))); } catch { /* arquivo ilegível */ }
    const nome = path.basename(arquivo);
    const slugPost = meta.slug || slug(nome.replace(/\.md$/, ''));
    const erros = validarPost({ ...meta, slug: slugPost }, nome);
    posts.push({ arquivo: nome, slug: slugPost, titulo: meta.titulo || nome, tipo: meta.tipo || 'artigo', categoria: meta.categoria || 'outros', categoriaNome: meta.categoriaNome || '', data: meta.data || '', atualizado: meta.atualizado || '', nota: meta.nota ?? null, rascunho: meta.rascunho === true, produto: meta.produto || null, gerador: meta.gerador || '', palavras: contarPalavras(corpo), modificadoEm: mtime(arquivo), erros, url: `post/${slugPost}/` });
  }
  return posts.sort((a, b) => String(b.data).localeCompare(String(a.data)) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

function limparMeta(meta) {
  const m = limparObjeto(objeto(meta, 'meta'));
  if (Object.keys(m).length > 200) throw new ErroHttp(400, 'meta com campos demais');
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === 'string' && v.length > 20000) throw new ErroHttp(400, `${k}: texto longo demais`);
    if (typeof v === 'string') m[k] = v.replace(/\r?\n/g, ' ').trim();
  }
  return m;
}

function lerMarkdown(dir, arquivo) {
  const caminho = caminhoSeguro(dir, nomeArquivoMd(arquivo));
  if (!fs.existsSync(caminho)) throw new ErroHttp(404, `arquivo não encontrado: ${arquivo}`);
  const bruto = fs.readFileSync(caminho, 'utf8');
  return { caminho, bruto, ...lerFrontMatter(bruto) };
}

function salvarMarkdown(dir, arquivo, { meta, corpo }, { validar = true } = {}) {
  const atual = lerMarkdown(dir, arquivo);
  const novaMeta = meta !== undefined ? limparMeta(meta) : atual.meta;
  const novoCorpo = corpo !== undefined ? texto(corpo, { max: 2_000_000, linhas: true, rotulo: 'corpo' }) : atual.corpo;
  const base = arquivo.replace(/\.md$/i, '');
  if (!novaMeta.slug) novaMeta.slug = slug(String(novaMeta.titulo || base));
  const nomeNovo = validar ? `${novaMeta.slug}.md` : arquivo;
  if (validar) {
    const erros = validarPost(novaMeta, nomeNovo);
    if (erros.length && novaMeta.rascunho !== true) throw new ErroHttp(400, `post inválido: ${erros.join('; ')}`, { erros });
    novaMeta.atualizado = dataIso();
  }
  nomeArquivoMd(nomeNovo);
  const caminhoNovo = caminhoSeguro(dir, nomeNovo);
  if (caminhoNovo !== atual.caminho && fs.existsSync(caminhoNovo)) throw new ErroHttp(409, `já existe um arquivo ${nomeNovo}`);
  gravarTexto(caminhoNovo, serializar(novaMeta, novoCorpo));
  if (caminhoNovo !== atual.caminho) fs.unlinkSync(atual.caminho);
  return { arquivo: nomeNovo, meta: novaMeta, corpo: novoCorpo };
}

function lerSegredosConhecidos() {
  const lista = [];
  const vistos = new Set();
  let bloco = [];
  if (fs.existsSync(ARQUIVO_ENV_EXEMPLO)) {
    for (const linha of fs.readFileSync(ARQUIVO_ENV_EXEMPLO, 'utf8').split(/\r?\n/)) {
      const chave = linha.match(/^\s*#?\s*([A-Z][A-Z0-9_]{2,63})\s*=/);
      if (chave) {
        if (!vistos.has(chave[1])) { vistos.add(chave[1]); lista.push({ nome: chave[1], descricao: bloco.join(' '), grupo: (bloco[0] || 'Chaves').split(/\s\(|:/)[0].trim().slice(0, 60) }); }
        continue;
      }
      const comentario = linha.match(/^\s*#\s*(.+)$/);
      if (comentario) { if (!/^Copie|^Só preencha/.test(comentario[1])) bloco.push(comentario[1].trim()); continue; }
      if (!linha.trim()) bloco = [];
    }
  }
  for (const [nome, descricao] of Object.entries(SEGREDOS_EXTRAS)) if (!vistos.has(nome)) { vistos.add(nome); lista.push({ nome, descricao, grupo: 'Painel e publicação' }); }
  return lista;
}

function lerEnvBruto() {
  return fs.existsSync(arquivoEnv()) ? fs.readFileSync(arquivoEnv(), 'utf8') : '';
}

function envDefinidos() {
  const out = {};
  for (const linha of lerEnvBruto().split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); out[m[1]] = v; }
  }
  return out;
}

function escreverEnv(valores) {
  const linhas = lerEnvBruto().split(/\r?\n/);
  if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop();
  const indice = new Map();
  linhas.forEach((l, i) => { const m = l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/i); if (m) indice.set(m[1], i); });
  const atualizados = [];
  const removidos = [];
  for (const [nome, valor] of Object.entries(valores)) {
    if (valor === null) {
      if (indice.has(nome)) { linhas[indice.get(nome)] = null; removidos.push(nome); }
      delete process.env[nome];
      continue;
    }
    const precisaAspas = /^\s|\s$|[#"'\\]/.test(valor);
    const linha = `${nome}=${precisaAspas ? JSON.stringify(valor) : valor}`;
    if (indice.has(nome)) linhas[indice.get(nome)] = linha; else linhas.push(linha);
    process.env[nome] = valor;
    atualizados.push(nome);
  }
  const conteudo = `${linhas.filter((l) => l !== null).join('\n')}\n`;
  const tmp = `${arquivoEnv()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, conteudo, { mode: 0o600 });
  fs.renameSync(tmp, arquivoEnv());
  try { fs.chmodSync(arquivoEnv(), 0o600); } catch { /* sistemas sem chmod */ }
  return { atualizados, removidos };
}

function itensDesign() {
  const ler = (p) => { try { return lerJson(p); } catch { return null; } };
  const pastaComArquivos = (dir) => ({ pasta: relWorkspace(dir), pastaAbs: dir, nome: path.basename(dir), arquivos: fs.readdirSync(dir).filter((f) => !f.endsWith('.tmp')).map((f) => ({ nome: f, caminho: relWorkspace(path.join(dir, f)), tamanho: fs.statSync(path.join(dir, f)).size })), modificadoEm: mtime(dir) });
  const estampas = listarArquivos(workspace('design', 'camisetas'), (p) => p.endsWith('listagem.json')).map((p) => { const j = ler(p); return j ? { ...pastaComArquivos(path.dirname(p)), titulo: j.titulo, layout: j.layout, paleta: j.paleta, conformidade: j.conformidade?.ok ?? null, erros: j.conformidade?.erros || [], marca: j.marca, bullets: j.bullets } : null; }).filter(Boolean);
  const listagens = listarArquivos(workspace('design', 'listagens'), (p) => p.endsWith('textos.json')).map((p) => { const j = ler(p); return j ? { ...pastaComArquivos(path.dirname(p)), titulo: j.titulo, conformidade: j.conformidade?.ok ?? null, erros: j.conformidade?.erros || [], bullets: j.bullets, descricao: j.descricao } : null; }).filter(Boolean);
  const capas = listarArquivos(workspace('design', 'capas'), (p) => p.endsWith('capa.svg')).map((p) => pastaComArquivos(path.dirname(p)));
  const ideias = listarArquivos(workspace('design', 'ideias'), (p) => p.endsWith('.json')).map((p) => { const j = ler(p); return j ? { arquivo: relWorkspace(p), nicho: j.nicho, idioma: j.idioma, geradoEm: j.geradoEm, ideias: (j.ideias || []).map((i) => ({ texto: i.texto, subtexto: i.subtexto, estilo: i.estilo, paleta: i.paleta, titulo: i.titulo })) } : null; }).filter(Boolean);
  return { estampas, listagens, capas, ideias };
}

function itensKdp() {
  const ler = (p) => { try { return lerJson(p); } catch { return null; } };
  const livros = listarArquivos(workspace('kdp'), (p) => p.endsWith('manifesto.json')).map((p) => { const m = ler(p); if (!m) return null; const arquivos = {}; const arquivosAbs = {}; for (const [k, v] of Object.entries(m.arquivos || {})) { arquivos[k] = relWorkspace(v); arquivosAbs[k] = v; } return { titulo: m.titulo, subtitulo: m.subtitulo, autor: m.autor, tipo: m.tipo, trim: m.trim, papel: m.papel, paginas: m.paginas, lombadaPol: m.lombadaPol, capa: m.capa, fontes: m.fontes, avisos: m.avisos || [], geradoEm: m.geradoEm, tamanhoPdf: m.tamanhoPdf, pasta: relWorkspace(path.dirname(p)), pastaAbs: path.dirname(p), arquivos, arquivosAbs, interior: m.interior ? { paginas: m.interior.paginas, puzzles: m.interior.puzzles || m.interior.labirintos || null } : null }; }).filter(Boolean);
  const metadados = listarArquivos(workspace('kdp'), (p) => /metadados-[^/\\]+\.json$/.test(p)).map((p) => { const j = ler(p); return j ? { arquivo: relWorkspace(p), titulo: j.titulo, subtitulo: j.subtitulo, palavrasChave: j.palavrasChave, categorias: j.categorias, valido: j.validacao?.valido ?? null, gerador: j.gerador || 'template', modificadoEm: mtime(p) } : null; }).filter(Boolean);
  const manuscritos = listarArquivos(workspace('kdp', 'manuscritos'), (p) => p.endsWith('.md')).map((p) => ({ arquivo: relWorkspace(p), caminho: p, nome: path.basename(p), modificadoEm: mtime(p), tamanho: fs.statSync(p).size }));
  const nichos = ler(workspace('kdp', 'nichos.json'));
  return { livros: livros.sort((a, b) => String(b.geradoEm).localeCompare(String(a.geradoEm))), metadados, manuscritos, nichos, tabelas: { verificadoEm: TABELAS.verificadoEm, observacao: TABELAS.observacao, marketplacesPaperback: Object.keys(TABELAS.paperback), marketplacesEbook: Object.keys(TABELAS.ebook) } };
}

function resumoConfig(config) {
  if (!config) return null;
  return { marca: { nome: config.marca.nome, url: config.marca.url, basePath: config.marca.basePath, autor: config.marca.autor || '' }, kdp: { autor: config.kdp?.autor || '', trimPadrao: config.kdp?.trimPadrao || '6x9', papelPadrao: config.kdp?.papelPadrao || 'branco', marketplacePadrao: config.kdp?.marketplacePadrao || 'amazon.com' }, design: { paletaPadrao: config.design?.paletaPadrao || 'noite', marca: config.design?.marca || '', renderizador: config.design?.renderizador || 'auto' }, fiscal: { cambioUsdBrl: config.fiscal?.cambioUsdBrl || 5 }, ia: { ...PADRAO_IA, ...(config.ia || {}) } };
}

function configOuNulo(ctx) {
  try { return { config: ctx.config(), erros: [] }; } catch (e) { return { config: null, erros: e.erros || [e.message] }; }
}

/** Rotas: [método, caminho (com :param), handler(ctx) → objeto]. */
export const rotas = [
  ['GET', '/api/estado', (ctx) => {
    const { config, erros } = configOuNulo(ctx);
    const e = coletarEstado({ config });
    const slim = (p) => produtoResumido(p);
    return {
      geradoEm: e.geradoEm, versao: versaoPacote(), node: process.version, workspace: workspace(), configArquivo: config?._arquivo || null, configErros: erros,
      marca: config ? { nome: config.marca.nome, url: config.marca.url, basePath: config.marca.basePath } : null,
      kpis: e.kpis, ia: e.ia, renderizador: e.renderizador ? { tipo: e.renderizador.tipo, bin: e.renderizador.bin } : null, blogDist: e.blogDist, blogDistModificadoEm: mtime(workspace('blog', 'dist', 'index.html')),
      ranking: e.ranking ? { geradoEm: e.ranking.geradoEm, resumo: e.ranking.resumo } : null, top: (e.ranking?.produtos || []).slice(0, 10).map(slim), semPost: e.semPost.slice(0, 12).map(slim),
      posts: e.blog.posts.slice(0, 10).map((p) => ({ titulo: p.titulo, slug: p.slug, tipo: p.tipo, categoriaNome: p.categoriaNome, data: p.data, arquivo: path.basename(p.arquivo) })), blogErros: e.blog.erros,
      livros: e.livros.slice(0, 8).map((l) => ({ titulo: l.titulo, tipo: l.tipo, paginas: l.paginas, trim: l.trim, pasta: relWorkspace(l.pasta) })), designs: { estampas: e.estampas.length, listagens: e.listagens.length, capas: e.capas.length },
      nichos: (e.nichos?.nichos || []).slice(0, 8).map((n) => ({ termo: n.termo, score: n.score, classe: n.classe })), tarefaAtiva: ctx.fila.ativa(),
    };
  }],
  ['GET', '/api/catalogo', (ctx) => { const { config } = configOuNulo(ctx); return { ...catalogo(), config: resumoConfig(config) }; }],

  // Produtos
  ['GET', '/api/produtos', () => {
    const produtos = carregarProdutos();
    const ranking = carregarRanking();
    const pontos = new Map((ranking?.produtos || []).map((p) => [p.id, p]));
    const posts = new Map(listarPostsBrutos().filter((p) => p.produto).map((p) => [p.produto, p.arquivo]));
    const lista = produtos.map((p) => { const r = pontos.get(p.id); return { ...produtoResumido(r ? { ...p, ...r } : p), post: posts.get(p.id) || null }; })
      .sort((a, b) => (b.pontuacao?.score ?? -1) - (a.pontuacao?.score ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const mProdutos = mtime(caminhoProdutos());
    const mRanking = mtime(caminhoRanking());
    return { produtos: lista, ranking: ranking ? { geradoEm: ranking.geradoEm, resumo: ranking.resumo, filtros: ranking.filtros || {} } : null, desatualizado: Boolean(ranking && mProdutos && mRanking && new Date(mProdutos) > new Date(mRanking)), total: produtos.length };
  }],
  ['GET', '/api/produtos/:id', (ctx) => {
    const p = carregarProdutos().find((x) => x.id === ctx.params.id);
    if (!p) throw new ErroHttp(404, 'produto não encontrado');
    const r = (carregarRanking()?.produtos || []).find((x) => x.id === p.id);
    return { produto: { ...produtoResumido(r ? { ...p, ...r } : p), descricao: p.descricao, pros: p.pros, contras: p.contras, atributos: p.atributos, palavrasChave: p.palavrasChave, publico: p.publico, categoriaOriginal: p.categoriaOriginal, totalVendido: p.totalVendido, criadoEm: p.criadoEm }, registro: produtoParaRegistro(p) };
  }],
  ['POST', '/api/produtos', (ctx) => {
    const corpo = objeto(ctx.corpo);
    const registro = limparRegistro(corpo.registro);
    if (!registro.nome) throw new ErroHttp(400, 'informe o nome do produto');
    const { config } = configOuNulo(ctx);
    const r = importarRegistros([registro], { programa: texto(corpo.programa || registro.programa || 'amazon-br', { max: 40 }), config });
    salvarProdutos(r.produtos);
    const novo = r.produtos.find((p) => p.nome === registro.nome.trim() || p.identificador === registro.id) || null;
    return { produto: novo ? produtoResumido(novo) : null, novos: r.novos, atualizados: r.atualizados, avisos: r.avisos, total: r.total };
  }],
  ['PUT', '/api/produtos/:id', (ctx) => {
    const produtos = carregarProdutos();
    const atual = produtos.find((p) => p.id === ctx.params.id);
    if (!atual) throw new ErroHttp(404, 'produto não encontrado');
    const registro = { ...produtoParaRegistro(atual), ...limparRegistro(objeto(ctx.corpo).registro) };
    if (!registro.nome) throw new ErroHttp(400, 'o nome não pode ficar vazio');
    const { config } = configOuNulo(ctx);
    const r = importarRegistros([registro], { programa: registro.programa || atual.programa, config, produtosAtuais: produtos.filter((p) => p.id !== atual.id) });
    if (r.ignorados) throw new ErroHttp(400, `registro ignorado: ${r.avisos.join('; ')}`);
    salvarProdutos(r.produtos);
    const ids = new Set(produtos.filter((p) => p.id !== atual.id).map((p) => p.id));
    const novo = r.produtos.find((p) => !ids.has(p.id)) || r.produtos.find((p) => p.id === atual.id);
    return { produto: produtoResumido(novo), registro: produtoParaRegistro(novo), avisos: r.avisos };
  }],
  ['DELETE', '/api/produtos/:id', (ctx) => {
    const produtos = carregarProdutos();
    const resto = produtos.filter((p) => p.id !== ctx.params.id);
    if (resto.length === produtos.length) throw new ErroHttp(404, 'produto não encontrado');
    salvarProdutos(resto);
    return { removido: ctx.params.id, total: resto.length };
  }],
  ['POST', '/api/produtos/importar', async (ctx) => {
    const corpo = objeto(ctx.corpo);
    const conteudo = texto(corpo.texto, { max: 30_000_000, linhas: true, rotulo: 'texto' });
    if (!conteudo.trim()) throw new ErroHttp(400, 'arquivo vazio');
    const ehJson = /^\s*[\[{]/.test(conteudo);
    const nome = nomeSeguro(texto(corpo.nome || 'importacao', { max: 120 }).replace(/\.(csv|json|txt|tsv)$/i, ''), 'importacao');
    const arquivo = workspace('afiliados', 'importacoes', `${dataIso()}-${Date.now().toString(36)}-${nome}.${ehJson ? 'json' : 'csv'}`);
    gravarTexto(arquivo, conteudo);
    const { config } = configOuNulo(ctx);
    const r = await importarDeFonte('arquivo', { arquivo, programa: texto(corpo.programa || 'amazon-br', { max: 40 }), substituir: corpo.substituir === true }, { config });
    return { arquivo: relWorkspace(arquivo), registros: r.registros, novos: r.novos, atualizados: r.atualizados, ignorados: r.ignorados, total: r.total, avisos: r.avisos.slice(0, 50), maisAvisos: Math.max(0, r.avisos.length - 50) };
  }],

  // Posts e páginas
  ['GET', '/api/posts', () => { const posts = listarPostsBrutos(); return { posts, total: posts.length, erros: posts.flatMap((p) => (p.rascunho ? [] : p.erros)) }; }],
  ['POST', '/api/posts', (ctx) => {
    const corpo = objeto(ctx.corpo);
    const titulo = texto(corpo.titulo, { max: 200, rotulo: 'título' }).trim();
    if (!titulo) throw new ErroHttp(400, 'informe o título');
    const { config } = configOuNulo(ctx);
    const slugPost = slug(texto(corpo.slug || titulo, { max: 200 }), 80);
    if (!slugPost) throw new ErroHttp(400, 'não foi possível gerar o slug');
    const arquivo = `${slugPost}.md`;
    const caminho = caminhoSeguro(DIR_POSTS, arquivo);
    if (fs.existsSync(caminho)) throw new ErroHttp(409, `já existe um post com o slug ${slugPost}`);
    const meta = { titulo, slug: slugPost, descricao: texto(corpo.descricao || '', { max: 300 }), tipo: texto(corpo.tipo || 'artigo', { max: 30 }), data: dataIso(), categoria: texto(corpo.categoria || 'outros', { max: 60 }), tags: [], rascunho: corpo.rascunho === true, gerador: 'manual', autor: config?.marca?.autor || '' };
    const corpoMd = texto(corpo.corpo || `## Introdução\n\nEscreva aqui.\n`, { max: 2_000_000, linhas: true, rotulo: 'corpo' });
    gravarTexto(caminho, serializar(meta, corpoMd));
    return { post: listarPostsBrutos().find((p) => p.arquivo === arquivo) };
  }],
  ['GET', '/api/posts/:arquivo', (ctx) => { const r = lerMarkdown(DIR_POSTS, ctx.params.arquivo); return { arquivo: ctx.params.arquivo, meta: r.meta, corpo: r.corpo }; }],
  ['PUT', '/api/posts/:arquivo', (ctx) => { const corpo = objeto(ctx.corpo); const r = salvarMarkdown(DIR_POSTS, nomeArquivoMd(ctx.params.arquivo), corpo); return { ...r, post: listarPostsBrutos().find((p) => p.arquivo === r.arquivo) }; }],
  ['DELETE', '/api/posts/:arquivo', (ctx) => { const r = lerMarkdown(DIR_POSTS, ctx.params.arquivo); fs.unlinkSync(r.caminho); return { removido: ctx.params.arquivo }; }],
  ['GET', '/api/paginas', () => ({ paginas: listarArquivos(DIR_PAGINAS, (p) => p.endsWith('.md')).map((p) => { const { meta, corpo } = lerFrontMatter(fs.readFileSync(p, 'utf8')); const nome = path.basename(p); return { arquivo: nome, slug: meta.slug || nome.replace(/\.md$/, ''), titulo: meta.titulo || nome.replace(/\.md$/, ''), menu: meta.menu !== false, noindex: meta.noindex === true, palavras: contarPalavras(corpo), modificadoEm: mtime(p) }; }) })],
  ['POST', '/api/paginas', (ctx) => {
    const corpo = objeto(ctx.corpo);
    const titulo = texto(corpo.titulo, { max: 200, rotulo: 'título' }).trim();
    if (!titulo) throw new ErroHttp(400, 'informe o título');
    const id = slug(texto(corpo.slug || titulo, { max: 120 }), 60);
    const caminho = caminhoSeguro(DIR_PAGINAS, `${id}.md`);
    if (fs.existsSync(caminho)) throw new ErroHttp(409, `já existe a página ${id}`);
    gravarTexto(caminho, serializar({ titulo, slug: id, descricao: texto(corpo.descricao || '', { max: 300 }), menu: corpo.menu !== false }, texto(corpo.corpo || `Escreva aqui.\n`, { max: 2_000_000, linhas: true })));
    return { pagina: { arquivo: `${id}.md`, slug: id, titulo } };
  }],
  ['GET', '/api/paginas/:arquivo', (ctx) => { const r = lerMarkdown(DIR_PAGINAS, ctx.params.arquivo); return { arquivo: ctx.params.arquivo, meta: r.meta, corpo: r.corpo }; }],
  ['PUT', '/api/paginas/:arquivo', (ctx) => { const r = salvarMarkdown(DIR_PAGINAS, nomeArquivoMd(ctx.params.arquivo), objeto(ctx.corpo), { validar: false }); return { arquivo: r.arquivo, meta: r.meta }; }],
  ['DELETE', '/api/paginas/:arquivo', (ctx) => { const r = lerMarkdown(DIR_PAGINAS, ctx.params.arquivo); fs.unlinkSync(r.caminho); return { removido: ctx.params.arquivo }; }],

  // Blog e publicação
  ['GET', '/api/blog', async (ctx) => {
    const { config, erros } = configOuNulo(ctx);
    const dist = workspace('blog', 'dist');
    let conteudo = { posts: 0, paginas: 0, erros: [] };
    try { const b = carregarBlog(); conteudo = { posts: b.posts.length, paginas: b.paginas.length, categorias: b.categorias.length, erros: b.erros }; } catch (e) { conteudo.erros = [e.message]; }
    const wrangler = localizarWrangler();
    return {
      configErros: erros, url: config?.marca?.url || null, base: config?.marca?.basePath || '/', siteUrlEnv: process.env.SITE_URL_BLOG || null, basePathEnv: process.env.BASE_PATH_BLOG || null,
      dist: { existe: fs.existsSync(path.join(dist, 'index.html')), modificadoEm: mtime(path.join(dist, 'index.html')), paginas: fs.existsSync(dist) ? listarArquivos(dist, (p) => p.endsWith('.html')).length : 0, caminho: dist },
      preview: { existe: fs.existsSync(workspace('blog', 'preview', 'index.html')), modificadoEm: mtime(workspace('blog', 'preview', 'index.html')) },
      wrangler: { instalado: Boolean(wrangler), caminho: wrangler, worker: 'precozen-blog' }, cloudflareToken: Boolean(process.env.CLOUDFLARE_API_TOKEN), git: await estadoGit(), conteudo,
    };
  }],
  ['POST', '/api/blog/preview', (ctx) => {
    const { config, erros } = configOuNulo(ctx);
    if (!config) throw new ErroHttp(400, `configuração inválida: ${erros.join('; ')}`, { erros });
    try {
      const hostUrl = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(String(ctx.host || '')) ? ctx.host : `localhost:${ctx.porta}`;
      const r = construirBlog({ config, out: workspace('blog', 'preview'), base: '/preview/', url: `http://${hostUrl}`, rascunhos: true });
      return { paginas: r.paginas, posts: r.posts, ms: r.ms, url: '/preview/' };
    } catch (e) { throw new ErroHttp(400, e.message, { erros: e.erros || [] }); }
  }],
  ['GET', '/api/blog/validar', () => { const b = carregarBlog({ rascunhos: true }); return { posts: b.posts.length, rascunhos: b.posts.filter((p) => p.rascunho).length, paginas: b.paginas.length, categorias: b.categorias.map((c) => ({ id: c.id, nome: c.nome, total: c.total })), erros: b.erros }; }],
  ['GET', '/api/git', () => estadoGit()],

  // KDP
  ['GET', '/api/kdp', () => itensKdp()],
  ['POST', '/api/kdp/preco', (ctx) => {
    const c = objeto(ctx.corpo);
    const marketplace = texto(c.marketplace || 'amazon.com', { max: 30 });
    if (c.ebook === true) {
      if (!TABELAS.ebook[marketplace]) throw new ErroHttp(400, `marketplace sem tabela de eBook: ${marketplace}`);
      const preco = numero(c.preco, { rotulo: 'preço', padrao: 9.99, min: 0.01, max: 10000 });
      return { ebook: royaltyEbook({ preco, tamanhoMb: numero(c.mb, { rotulo: 'MB', padrao: 1, min: 0, max: 1000 }), marketplace }), preco, marketplace };
    }
    if (!TABELAS.paperback[marketplace]) throw new ErroHttp(400, `marketplace sem tabela de impressão: ${marketplace}`);
    const paginas = numero(c.paginas, { rotulo: 'páginas', padrao: 120, min: 24, max: 828 });
    const tinta = texto(c.tinta || 'pb', { max: 20 });
    if (!['pb', 'cor-padrao', 'cor-premium'].includes(tinta)) throw new ErroHttp(400, 'tinta inválida');
    const preco = numero(c.preco, { rotulo: 'preço', padrao: 0, min: 0, max: 10000 });
    const papel = texto(c.papel || 'branco', { max: 20 });
    let lombada = null;
    try { lombada = larguraLombada(paginas, papel); } catch (e) { throw new ErroHttp(400, e.message); }
    let royalty = null;
    try { royalty = preco ? royaltyPaperback({ precoLista: preco, paginas, tinta, marketplace }) : null; } catch (e) { throw new ErroHttp(400, e.message); }
    return { paginas, tinta, marketplace, preco, custo: custoImpressao({ paginas, tinta, marketplace }), sugestoes: sugerirPrecos({ paginas, tinta, marketplace }), royalty, lombadaPol: lombada, tabela: { verificadoEm: TABELAS.verificadoEm, observacao: TABELAS.observacao } };
  }],
  ['POST', '/api/kdp/nicho', (ctx) => {
    const c = objeto(ctx.corpo);
    const conteudo = texto(c.texto, { max: 5_000_000, linhas: true, rotulo: 'CSV' });
    if (!conteudo.trim()) throw new ErroHttp(400, 'cole o CSV com as colunas termo, buscas_mes, resultados, preco_medio, bsr_medio_top');
    const arquivo = workspace('kdp', 'nichos-entrada.csv');
    gravarTexto(arquivo, conteudo);
    let lista;
    try { lista = analisarNichosDeArquivo(arquivo); } catch (e) { throw new ErroHttp(400, e.message); }
    const saida = gravarJson(workspace('kdp', 'nichos.json'), { geradoEm: dataIso(), nichos: lista });
    return { nichos: lista, arquivo: relWorkspace(saida) };
  }],

  // Design
  ['GET', '/api/design', () => { const r = detectarRenderizador(); return { ...itensDesign(), renderizador: r ? { tipo: r.tipo, bin: r.bin } : null }; }],
  ['POST', '/api/design/conformidade', (ctx) => {
    const c = objeto(ctx.corpo);
    const dados = { texto: texto(c.texto || '', { max: 5000, linhas: true }), titulo: texto(c.titulo || '', { max: 500 }), marca: texto(c.marca || '', { max: 200 }), descricao: texto(c.descricao || '', { max: 5000, linhas: true }), bullets: Array.isArray(c.bullets) ? c.bullets.slice(0, 10).map((b) => texto(b, { max: 500 })) : undefined };
    if (c.modo === 'amazon') return { resultado: verificarListagemAmazon({ titulo: dados.titulo, bullets: dados.bullets || [], descricao: dados.descricao, marca: dados.marca }) };
    if (dados.titulo || dados.marca) return { resultado: verificarListagemMerch({ marca: dados.marca, titulo: dados.titulo, descricao: dados.descricao, estampa: dados.texto }) };
    return { resultado: verificarTexto(dados.texto) };
  }],

  // Fiscal
  ['POST', '/api/fiscal/estimar', (ctx) => {
    const { config, erros } = configOuNulo(ctx);
    if (!config) throw new ErroHttp(400, `configuração inválida: ${erros.join('; ')}`);
    const c = objeto(ctx.corpo);
    const cambio = numero(c.cambio, { rotulo: 'câmbio', padrao: config.fiscal.cambioUsdBrl, min: 0.01, max: 100 });
    const cfg = { ...config, fiscal: { ...config.fiscal, cambioUsdBrl: cambio } };
    const r = compararRegimes({ comissoesBrl: numero(c.comissoes, { rotulo: 'comissões', min: 0, max: 1e9 }), royaltiesUsd: numero(c.royalties, { rotulo: 'royalties', min: 0, max: 1e9 }), folhaMensalBrl: numero(c.folha, { rotulo: 'folha', min: 0, max: 1e9 }), config: cfg });
    return { ...r, cambio, tabela: { vigencia: config.fiscal.irpf.vigencia, observacao: config.fiscal.irpf.observacao, redutor: Boolean(config.fiscal.irpf.redutor?.ativo) } };
  }],

  // IA
  ['GET', '/api/ia', (ctx) => { const { config } = configOuNulo(ctx); const d = disponibilidade(); const cfg = { ...PADRAO_IA, ...(config?.ia || {}) }; let cacheItens = 0; try { cacheItens = fs.readdirSync(workspace('ia-cache')).filter((f) => f.endsWith('.json')).length; } catch { cacheItens = 0; } return { ...d, pronta: d.sdk && d.credencial, modelo: cfg.modelo, esforco: cfg.esforco, maxTokens: cfg.maxTokens, cache: cfg.cache, fallbacks: cfg.fallbacks, cacheItens }; }],
  ['POST', '/api/ia/limpar-cache', () => ({ removidos: limparCache() })],

  // Configuração e chaves
  ['GET', '/api/config', (ctx) => { const arquivo = ctx.configArquivo(); const config = lerJson(arquivo); return { arquivo, config, erros: validarConfig({ ...config, marca: { ...(config.marca || {}), url: String(config.marca?.url || '').replace(/\/+$/, '') } }) }; }],
  ['PUT', '/api/config', (ctx) => {
    const c = objeto(ctx.corpo);
    const config = limparObjeto(objeto(c.config, 'config'));
    delete config._arquivo;
    if (config.marca && typeof config.marca.url === 'string') config.marca.url = config.marca.url.trim().replace(/\/+$/, '');
    const erros = validarConfig(config);
    if (erros.length) throw new ErroHttp(400, `configuração inválida: ${erros.join('; ')}`, { erros });
    const arquivo = ctx.configArquivo();
    gravarJson(arquivo, config);
    return { arquivo, config };
  }],
  ['GET', '/api/segredos', () => { const definidos = envDefinidos(); return { arquivo: arquivoEnv(), existe: fs.existsSync(arquivoEnv()), segredos: lerSegredosConhecidos().map((s) => ({ ...s, definido: Boolean(definidos[s.nome] || process.env[s.nome]), noArquivo: Boolean(definidos[s.nome]) })) }; }],
  ['PUT', '/api/segredos', (ctx) => {
    const c = objeto(ctx.corpo);
    const valores = objeto(c.valores, 'valores');
    const conhecidos = new Set(lerSegredosConhecidos().map((s) => s.nome));
    const limpos = {};
    for (const [nome, valor] of Object.entries(valores)) {
      if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(nome) || !conhecidos.has(nome)) throw new ErroHttp(400, `chave não permitida: ${nome}`);
      if (valor === null) { limpos[nome] = null; continue; }
      if (typeof valor !== 'string') throw new ErroHttp(400, `${nome}: valor inválido`);
      if (/[\r\n\0]/.test(valor) || valor.length > 4096) throw new ErroHttp(400, `${nome}: valor inválido`);
      limpos[nome] = valor.trim();
    }
    return escreverEnv(limpos);
  }],

  // Arquivos da pasta de trabalho
  ['GET', '/api/arquivos', (ctx) => {
    const rel = texto(ctx.query.get('pasta') || '', { max: 1000 });
    const dir = rel ? caminhoSeguro(workspace(), rel) : workspace();
    if (!fs.existsSync(dir)) return { pasta: rel, itens: [], raiz: workspace() };
    if (!fs.statSync(dir).isDirectory()) throw new ErroHttp(400, 'não é uma pasta');
    const itens = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.endsWith('.tmp')).map((e) => { const p = path.join(dir, e.name); const st = fs.statSync(p); return { nome: e.name, tipo: e.isDirectory() ? 'pasta' : 'arquivo', tamanho: e.isDirectory() ? null : st.size, modificadoEm: st.mtime.toISOString(), caminho: relWorkspace(p) }; }).sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome, 'pt-BR') : a.tipo === 'pasta' ? -1 : 1));
    return { pasta: rel, itens, raiz: workspace() };
  }],
  ['DELETE', '/api/arquivos', (ctx) => {
    const rel = texto(objeto(ctx.corpo).caminho, { max: 1000, rotulo: 'caminho' });
    if (!rel.trim()) throw new ErroHttp(400, 'informe o caminho');
    const alvo = caminhoSeguro(workspace(), rel);
    if (alvo === workspace()) throw new ErroHttp(400, 'não é possível apagar a raiz da pasta de trabalho');
    if (!fs.existsSync(alvo)) throw new ErroHttp(404, 'não encontrado');
    fs.rmSync(alvo, { recursive: true, force: true });
    return { removido: rel };
  }],

  // Tarefas
  ['GET', '/api/tarefas', (ctx) => ({ tarefas: ctx.fila.listar(), ativa: ctx.fila.ativa() })],
  ['POST', '/api/tarefas', async (ctx) => {
    const c = objeto(ctx.corpo);
    const acao = texto(c.acao, { max: 60, rotulo: 'ação' });
    const { config } = configOuNulo(ctx);
    let preparada;
    try { preparada = await prepararTarefa(acao, c.opcoes || {}, { config }); } catch (e) { throw new ErroHttp(400, e.message, { erros: e.erros || [] }); }
    return { tarefa: ctx.fila.criar(preparada) };
  }],
  ['GET', '/api/tarefas/:id', (ctx) => { const t = ctx.fila.obter(ctx.params.id); if (!t) throw new ErroHttp(404, 'tarefa não encontrada'); return { tarefa: t }; }],
  ['POST', '/api/tarefas/:id/cancelar', (ctx) => { const t = ctx.fila.cancelar(ctx.params.id); if (!t) throw new ErroHttp(404, 'tarefa não encontrada'); return { tarefa: t }; }],
];

/** Compila as rotas para casamento rápido. */
export function compilarRotas(lista = rotas) {
  return lista.map(([metodo, caminho, handler]) => {
    const nomes = [];
    const re = new RegExp(`^${caminho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([a-zA-Z]+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; })}$`);
    return { metodo, re, nomes, handler };
  });
}

export function encontrarRota(compiladas, metodo, caminho) {
  for (const r of compiladas) {
    if (r.metodo !== metodo) continue;
    const m = caminho.match(r.re);
    if (!m) continue;
    const params = {};
    r.nomes.forEach((n, i) => { try { params[n] = decodeURIComponent(m[i + 1]); } catch { params[n] = m[i + 1]; } });
    return { handler: r.handler, params };
  }
  return null;
}

export { carregarConfig };
