// Catálogo de ações do painel: a lista fechada de comandos que a interface pode disparar, com os campos permitidos,
// a validação de cada valor e a montagem dos processos (sem shell: argumentos vão em array).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RAIZ_CENTRAL, RAIZ_REPO, workspace, lerJson } from '../../core/arquivos.js';
import { INTERIORES } from '../../kdp/livro.js';
import { listarTrims, PAPEIS } from '../../kdp/especificacoes.js';
import { PALETAS } from '../../design/paletas.js';
import { LAYOUTS } from '../../design/camiseta.js';
import { MERCH } from '../../design/especificacoes.js';
import { programas, categoriasCanonicas } from '../../afiliados/programas.js';
import { FONTES } from '../../afiliados/fontes/index.js';

const execFileAsync = promisify(execFile);
export const BIN = path.join(RAIZ_CENTRAL, 'bin', 'precozen.js');

const esc = (nome, rotulo, opcoes, extra = {}) => ({ nome, rotulo, tipo: 'escolha', opcoes, ...extra });
const txt = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'texto', ...extra });
const num = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'numero', ...extra });
const int = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'inteiro', ...extra });
const bool = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'booleano', ...extra });
const cam = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'caminho', ...extra });

const ESTILOS_CAPA = ['bloco', 'faixa', 'minimal', 'circulo'];

/** Opções que dependem dos módulos (tipos de livro, trims, paletas, programas…), resolvidas na hora. */
export function opcoesDinamicas() {
  let temas = [];
  try { temas = Object.keys(lerJson(path.join(RAIZ_CENTRAL, 'data', 'temas-caca-palavras.json'))); } catch { temas = []; }
  return {
    tiposLivro: Object.entries(INTERIORES).map(([id, m]) => ({ valor: id, rotulo: m.nome, descricao: m.descricao })),
    trims: listarTrims().map((t) => ({ valor: t.id, rotulo: `${t.id} (${t.polegadas})` })),
    papeis: Object.keys(PAPEIS).map((p) => ({ valor: p, rotulo: p })),
    paletas: Object.entries(PALETAS).map(([id, p]) => ({ valor: id, rotulo: p.nome })),
    layouts: LAYOUTS.map((l) => ({ valor: l, rotulo: l })),
    produtosMerch: Object.entries(MERCH).map(([id, m]) => ({ valor: id, rotulo: m.nome })),
    programas: Object.entries(programas()).map(([id, p]) => ({ valor: id, rotulo: p.nome })),
    categorias: Object.entries(categoriasCanonicas()).map(([id, c]) => ({ valor: id, rotulo: c.nome })),
    fontesOnline: Object.entries(FONTES).filter(([id]) => id !== 'arquivo').map(([id, f]) => ({ valor: id, rotulo: f.descricao || id })),
    estilosCapa: ESTILOS_CAPA.map((e) => ({ valor: e, rotulo: e })),
    temasCacaPalavras: [{ valor: 'todos', rotulo: 'todos os temas' }, ...temas.map((t) => ({ valor: t, rotulo: t }))],
  };
}

const quando = (campo, valores) => ({ quando: { campo, valores } });
const PUZZLES = ['caca-palavras', 'sudoku', 'labirinto'];

export const ACOES = {
  'afiliados.importar-online': {
    titulo: 'Importar de uma fonte online', grupo: 'afiliados', cli: ['afiliados', 'importar'],
    descricao: 'Busca produtos na API do programa (precisa das credenciais em Configuração → Chaves) e mescla na base local.',
    campos: [esc('fonte', 'Fonte', 'fontesOnline', { obrigatorio: true }), txt('palavras', 'Termo de busca', { obrigatorio: true, max: 200 }), esc('programa', 'Programa dos registros', 'programas', { padrao: 'amazon-br' }), int('paginas', 'Páginas a buscar', { padrao: 1, min: 1, max: 10 }), int('limite', 'Limite de itens', { padrao: 50, min: 1, max: 500 }), int('dias', 'Janela em dias (Hotmart)', { padrao: 30, min: 1, max: 365, ...quando('fonte', ['hotmart']) }), txt('indice', 'Índice de busca (Amazon)', { padrao: 'All', max: 40, ...quando('fonte', ['amazon-paapi']) }), bool('substituir', 'Apagar a base antes de importar')],
  },
  'afiliados.importar-arquivo': {
    titulo: 'Importar de um arquivo do computador', grupo: 'afiliados', cli: ['afiliados', 'importar'],
    descricao: 'Lê um CSV/JSON já salvo (caminho no servidor) e mescla na base local.',
    campos: [cam('arquivo', 'Arquivo CSV ou JSON', { obrigatorio: true }), esc('programa', 'Programa padrão', 'programas', { padrao: 'amazon-br' }), bool('substituir', 'Apagar a base antes de importar')],
  },
  'afiliados.analisar': {
    titulo: 'Pontuar produtos e gerar o ranking', grupo: 'afiliados', cli: ['afiliados', 'analisar'],
    descricao: 'Comissão × demanda × qualidade × preço × tendência. Gera ranking em JSON, CSV e Markdown.',
    campos: [int('top', 'Limitar aos N melhores (0 = todos)', { padrao: 0, min: 0, max: 5000 }), num('minScore', 'Score mínimo', { padrao: 0, min: 0, max: 100 }), esc('programa', 'Só o programa', 'programas', { opcional: true }), esc('categoria', 'Só a categoria', 'categorias', { opcional: true }), num('minPreco', 'Preço mínimo', { min: 0 }), num('maxPreco', 'Preço máximo', { min: 0 })],
  },
  'afiliados.reviews': {
    titulo: 'Gerar análises (posts) dos melhores produtos', grupo: 'afiliados', cli: ['afiliados', 'reviews'],
    descricao: 'Escreve um post de análise por produto em conteudo/posts. Com IA, reescreve as seções com o Claude.',
    campos: [int('top', 'Quantidade de produtos', { padrao: 10, min: 1, max: 500 }), txt('id', 'Ids específicos (separados por vírgula)', { max: 5000, ajuda: 'ex.: amazon-br:B0EXEMPLO01, amazon-br:B0EXEMPLO02' }), txt('classes', 'Classes aceitas', { padrao: 'ouro,prata', max: 60 }), bool('forcar', 'Sobrescrever posts existentes'), bool('ia', 'Reescrever com IA (Claude)')],
  },
  'afiliados.comparativos': {
    titulo: 'Gerar comparativos por categoria', grupo: 'afiliados', cli: ['afiliados', 'comparativos'],
    descricao: 'Posts "Os N melhores <categoria>" para categorias com produtos suficientes no ranking.',
    campos: [int('minimo', 'Mínimo de produtos por categoria', { padrao: 3, min: 2, max: 20 }), bool('forcar', 'Sobrescrever posts existentes')],
  },
  'blog.build': {
    titulo: 'Gerar o site (build)', grupo: 'blog', cli: ['blog', 'build'],
    descricao: 'Gera o blog estático em workspace/blog/dist com a URL pública configurada.',
    campos: [txt('url', 'URL pública (opcional)', { max: 200, padraoDe: 'marca.url', ajuda: 'Deixe vazio para usar marca.url da configuração ou SITE_URL_BLOG.' }), txt('base', 'Base path', { padrao: '/', max: 60 })],
  },
  'blog.deploy': {
    titulo: 'Publicar na Cloudflare (wrangler deploy)', grupo: 'blog', especial: 'deploy',
    descricao: 'Gera o site e envia para o Worker precozen-blog. Usa CLOUDFLARE_API_TOKEN (Chaves) ou o login salvo do wrangler.',
    campos: [txt('url', 'URL pública do site', { max: 200, padraoDe: 'marca.url', ajuda: 'Canônicos e sitemap usam esta URL (ex.: https://precozen-blog.sua-conta.workers.dev ou o domínio próprio).' })],
  },
  'git.publicar': {
    titulo: 'Enviar conteúdo para o GitHub (commit + push)', grupo: 'blog', especial: 'git',
    descricao: 'Commita conteudo/, data/ e precozen.config.json e envia para a branch atual. A Cloudflare reconstrói o blog quando a branch de produção recebe o push.',
    campos: [txt('mensagem', 'Mensagem do commit', { obrigatorio: true, max: 500 })],
  },
  'kdp.livro': {
    titulo: 'Gerar livro para o KDP', grupo: 'kdp', cli: ['kdp', 'livro'],
    descricao: 'Interior em PDF com fontes embutidas, capa completa (SVG/HTML), metadados e manifesto.',
    campos: [
      esc('tipo', 'Tipo de interior', 'tiposLivro', { padrao: 'pautado', obrigatorio: true }), txt('titulo', 'Título', { obrigatorio: true, max: 200 }), txt('subtitulo', 'Subtítulo', { max: 200 }), txt('autor', 'Autor', { max: 120, padraoDe: 'kdp.autor' }),
      esc('trim', 'Tamanho de corte', 'trims', { padraoDe: 'kdp.trimPadrao' }), esc('papel', 'Papel', 'papeis', { padraoDe: 'kdp.papelPadrao' }), int('paginas', 'Meta de páginas (par, ≥ 24)', { min: 24, max: 828 }), bool('sangria', 'Interior com sangria'),
      esc('tema', 'Tema das palavras', 'temasCacaPalavras', { padrao: 'todos', ...quando('tipo', ['caca-palavras']) }), txt('palavras', 'Palavras próprias (separadas por vírgula)', { max: 5000, ...quando('tipo', ['caca-palavras']) }), int('tamanho', 'Lado da grade', { min: 8, max: 25, ...quando('tipo', ['caca-palavras']) }), int('porPuzzle', 'Palavras por puzzle', { min: 5, max: 40, ...quando('tipo', ['caca-palavras']) }),
      txt('dificuldade', 'Dificuldade', { max: 20, ajuda: 'caça-palavras: facil | medio | dificil · sudoku: facil | medio | dificil | especialista | misto · labirinto: facil | medio | dificil | extremo | progressivo', ...quando('tipo', PUZZLES) }), int('quantidade', 'Quantidade de puzzles', { min: 1, max: 1000, ...quando('tipo', PUZZLES) }), int('porPagina', 'Puzzles por página', { min: 1, max: 2, ...quando('tipo', ['sudoku', 'labirinto']) }),
      { nome: 'inicio', rotulo: 'Mês inicial (AAAA-MM)', tipo: 'mes', ...quando('tipo', ['planner', 'habitos']) }, int('meses', 'Quantidade de meses', { min: 1, max: 36, ...quando('tipo', ['planner', 'habitos']) }), int('habitos', 'Hábitos por página', { min: 3, max: 30, ...quando('tipo', ['habitos']) }),
      num('espacamento', 'Espaçamento entre linhas (mm)', { min: 4, max: 15, ...quando('tipo', ['pautado']) }),
      cam('manuscrito', 'Manuscrito (.md ou .json)', { ...quando('tipo', ['texto']) }), cam('pasta', 'Pasta de imagens', { ...quando('tipo', ['imagens']) }), bool('versoBranco', 'Verso em branco após cada imagem', { ...quando('tipo', ['imagens']) }),
      txt('publico', 'Público-alvo (metadados)', { max: 200 }), esc('paleta', 'Paleta da capa', 'paletas', { padraoDe: 'design.paletaPadrao' }), esc('estilo', 'Estilo da capa', 'estilosCapa', { padrao: 'bloco' }), bool('capa', 'Gerar capa', { padrao: true }), txt('semente', 'Semente (reproduz o mesmo livro)', { max: 60 }),
    ],
  },
  'kdp.metadados': {
    titulo: 'Gerar metadados (título, descrição, palavras-chave)', grupo: 'kdp', cli: ['kdp', 'metadados'],
    descricao: 'Template ou IA. Valida limites da KDP e salva em workspace/kdp.',
    campos: [esc('tipo', 'Tipo de livro', 'tiposLivro', { padrao: 'pautado' }), txt('tema', 'Tema/assunto', { max: 200 }), txt('titulo', 'Título', { max: 200 }), txt('subtitulo', 'Subtítulo', { max: 200 }), txt('autor', 'Autor', { max: 120, padraoDe: 'kdp.autor' }), int('paginas', 'Páginas', { min: 24, max: 828 }), esc('trim', 'Trim', 'trims', { padraoDe: 'kdp.trimPadrao' }), txt('publico', 'Público-alvo', { max: 200 }), bool('ia', 'Gerar com IA (Claude)')],
  },
  'kdp.manuscrito': {
    titulo: 'Escrever manuscrito com IA', grupo: 'kdp', cli: ['kdp', 'manuscrito'],
    descricao: 'Não ficção em capítulos, salvo em Markdown + JSON para o tipo "texto". Pode levar alguns minutos.',
    campos: [txt('tema', 'Tema do livro', { obrigatorio: true, max: 300 }), txt('publico', 'Público-alvo', { max: 200 }), int('capitulos', 'Capítulos', { padrao: 8, min: 1, max: 40 }), int('palavras', 'Palavras por capítulo', { padrao: 1200, min: 200, max: 5000 }), txt('tom', 'Tom do texto', { padrao: 'prático e acessível', max: 120 }), { nome: 'instrucoes', rotulo: 'Instruções extras', tipo: 'textoLongo', max: 3000 }],
  },
  'design.camiseta': {
    titulo: 'Criar estampa tipográfica (Merch)', grupo: 'design', cli: ['design', 'camiseta'],
    descricao: 'SVG + PNG transparente no tamanho Merch e textos da listagem com verificação de conformidade.',
    campos: [txt('texto', 'Frase principal (use | para quebrar linhas)', { obrigatorio: true, max: 200 }), txt('subtexto', 'Linha secundária', { max: 120 }), esc('layout', 'Layout', 'layouts', { padrao: 'empilhado' }), esc('paleta', 'Paleta', 'paletas', { padraoDe: 'design.paletaPadrao' }), esc('produto', 'Produto', 'produtosMerch', { padrao: 'camiseta' }), esc('corCamisa', 'Cor da camisa', [{ valor: 'escura', rotulo: 'escura' }, { valor: 'clara', rotulo: 'clara' }], { padrao: 'escura' }), txt('nicho', 'Nicho (para os textos)', { max: 80 }), txt('marca', 'Marca da listagem', { max: 80, padraoDe: 'design.marca' }), esc('idioma', 'Idioma', [{ valor: 'pt-BR', rotulo: 'português' }, { valor: 'en-US', rotulo: 'inglês' }], { padrao: 'pt-BR' }), bool('png', 'Gerar PNG', { padrao: true })],
  },
  'design.capa': {
    titulo: 'Criar capa completa KDP', grupo: 'design', cli: ['design', 'capa'],
    descricao: 'Verso + lombada + frente em SVG/HTML, opcionalmente PNG e PDF (Chromium).',
    campos: [txt('titulo', 'Título', { obrigatorio: true, max: 200 }), txt('subtitulo', 'Subtítulo', { max: 200 }), txt('autor', 'Autor', { max: 120, padraoDe: 'kdp.autor' }), esc('trim', 'Trim', 'trims', { padraoDe: 'kdp.trimPadrao' }), int('paginas', 'Páginas do interior', { padrao: 120, min: 24, max: 828 }), esc('papel', 'Papel', 'papeis', { padraoDe: 'kdp.papelPadrao' }), { nome: 'contracapa', rotulo: 'Texto da contracapa', tipo: 'textoLongo', max: 2000 }, esc('paleta', 'Paleta', 'paletas', { padraoDe: 'design.paletaPadrao' }), esc('estilo', 'Estilo', 'estilosCapa', { padrao: 'bloco' }), txt('selo', 'Selo (texto curto)', { max: 40 }), bool('guias', 'Desenhar guias (não imprimir)'), bool('png', 'Gerar PNG'), bool('pdf', 'Gerar PDF')],
  },
  'design.listagem': {
    titulo: 'Criar imagens e textos de listagem', grupo: 'design', cli: ['design', 'listagem'],
    descricao: 'Imagem principal, infográfico 2000×2000, banner A+ e textos (título, bullets, descrição).',
    campos: [txt('nome', 'Nome do produto', { obrigatorio: true, max: 200 }), txt('marca', 'Marca', { max: 80 }), txt('categoria', 'Categoria', { max: 80 }), { nome: 'beneficios', rotulo: 'Benefícios (separados por ;)', tipo: 'textoLongo', max: 2000 }, { nome: 'atributos', rotulo: 'Atributos (chave=valor; chave=valor)', tipo: 'textoLongo', max: 2000 }, txt('publico', 'Público', { max: 200 }), cam('imagem', 'Foto do produto (PNG/JPG)'), esc('paleta', 'Paleta', 'paletas', { padrao: 'papel' }), txt('selo', 'Selo', { max: 40 }), bool('png', 'Gerar PNGs'), bool('ia', 'Textos com IA (Claude)')],
  },
  'design.ideias': {
    titulo: 'Gerar ideias de estampas por nicho', grupo: 'design', cli: ['design', 'ideias'],
    descricao: 'Lista de frases/layouts/paletas por nicho (template ou IA), com opção de produzir as estampas.',
    campos: [txt('nicho', 'Nicho', { obrigatorio: true, max: 80 }), int('quantidade', 'Quantidade', { padrao: 10, min: 1, max: 50 }), esc('idioma', 'Idioma', [{ valor: 'pt-BR', rotulo: 'português' }, { valor: 'en-US', rotulo: 'inglês' }], { padrao: 'pt-BR' }), bool('ia', 'Usar IA (Claude)'), bool('produzir', 'Produzir as estampas (SVG/PNG)')],
  },
  'design.render': {
    titulo: 'Converter SVG → PNG ou HTML → PDF', grupo: 'design', cli: ['design', 'render'],
    descricao: 'Usa o renderizador disponível (Chromium, rsvg-convert, ImageMagick ou Inkscape).',
    campos: [cam('arquivo', 'Arquivo .svg ou .html', { obrigatorio: true }), bool('pdf', 'Gerar PDF (HTML)'), int('largura', 'Largura (px)', { min: 16, max: 20000 }), int('altura', 'Altura (px)', { min: 16, max: 20000 })],
  },
  'ia.testar': {
    titulo: 'Testar a conexão com o Claude', grupo: 'ia', cli: ['ia', 'testar'],
    descricao: 'Faz uma chamada curta e mostra modelo, tokens e a resposta.',
    campos: [bool('forcar', 'Ignorar o cache')],
  },
  'painel.build': { titulo: 'Gerar o painel estático', grupo: 'painel', cli: ['painel', 'build'], descricao: 'Página estática com o estado do sistema em workspace/painel.', campos: [] },
  'exemplo': { titulo: 'Rodar o fluxo completo de exemplo', grupo: 'painel', cli: ['exemplo'], descricao: 'Importa os produtos de exemplo, pontua, gera análises, blog, um livro KDP e uma estampa.', campos: [bool('rapido', 'Modo rápido (sem PNG)', { padrao: true })] },
};

function dentro(caminho, raiz) {
  const rel = path.relative(raiz, caminho);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function raizesPermitidas() {
  const raizes = [RAIZ_REPO, workspace()];
  try { raizes.push(os.homedir()); } catch { /* sem home */ }
  return raizes.map((r) => path.resolve(r));
}

/** Resolve um caminho informado pela interface, aceitando só o repositório, a pasta de trabalho e a pasta do usuário. */
export function resolverCaminhoPermitido(valor) {
  const s = String(valor || '').trim();
  if (!s || s.includes('\0')) throw new Error('caminho vazio ou inválido');
  const abs = path.resolve(RAIZ_CENTRAL, s);
  if (!raizesPermitidas().some((r) => dentro(abs, r))) throw new Error(`caminho fora das pastas permitidas: ${s}`);
  return abs;
}

const CONTROLE = /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/;

function validarCampo(campo, bruto, dinamicas) {
  const vazio = bruto === undefined || bruto === null || bruto === '' || (typeof bruto === 'string' && !bruto.trim());
  if (vazio) { if (campo.obrigatorio) throw new Error(`${campo.rotulo}: obrigatório`); return undefined; }
  switch (campo.tipo) {
    case 'texto': case 'textoLongo': case 'lista': {
      if (typeof bruto !== 'string' && typeof bruto !== 'number') throw new Error(`${campo.rotulo}: texto inválido`);
      const s = String(bruto).trim();
      if (CONTROLE.test(s)) throw new Error(`${campo.rotulo}: caracteres de controle não permitidos`);
      if (campo.tipo === 'texto' && /[\r\n]/.test(s)) throw new Error(`${campo.rotulo}: não pode ter quebras de linha`);
      if (s.length > (campo.max || 5000)) throw new Error(`${campo.rotulo}: no máximo ${campo.max || 5000} caracteres`);
      return s;
    }
    case 'numero': case 'inteiro': {
      const n = typeof bruto === 'number' ? bruto : Number(String(bruto).replace(',', '.'));
      if (!Number.isFinite(n)) throw new Error(`${campo.rotulo}: número inválido`);
      if (campo.tipo === 'inteiro' && !Number.isInteger(n)) throw new Error(`${campo.rotulo}: precisa ser inteiro`);
      if (campo.min !== undefined && n < campo.min) throw new Error(`${campo.rotulo}: mínimo ${campo.min}`);
      if (campo.max !== undefined && n > campo.max) throw new Error(`${campo.rotulo}: máximo ${campo.max}`);
      return n;
    }
    case 'booleano': {
      if (typeof bruto === 'boolean') return bruto;
      const s = String(bruto).toLowerCase();
      if (['true', '1', 'sim', 'on'].includes(s)) return true;
      if (['false', '0', 'nao', 'não', 'off'].includes(s)) return false;
      throw new Error(`${campo.rotulo}: valor booleano inválido`);
    }
    case 'escolha': {
      const lista = Array.isArray(campo.opcoes) ? campo.opcoes : (dinamicas[campo.opcoes] || []);
      const s = String(bruto);
      if (!lista.some((o) => o.valor === s)) throw new Error(`${campo.rotulo}: opção desconhecida "${s}"`);
      return s;
    }
    case 'caminho': return resolverCaminhoPermitido(bruto);
    case 'mes': {
      const s = String(bruto).trim();
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Error(`${campo.rotulo}: use o formato AAAA-MM`);
      return s;
    }
    default: throw new Error(`tipo de campo desconhecido: ${campo.tipo}`);
  }
}

/** Valida as opções recebidas contra o catálogo. Devolve só os campos conhecidos, já convertidos. */
export function validarOpcoes(id, opcoes = {}, dinamicas = opcoesDinamicas()) {
  const acao = ACOES[id];
  if (!acao) throw new Error(`ação desconhecida: ${id}`);
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) throw new Error('opções inválidas');
  const valores = {};
  const erros = [];
  for (const campo of acao.campos) {
    try {
      const v = validarCampo(campo, opcoes[campo.nome], dinamicas);
      if (v !== undefined) valores[campo.nome] = v;
    } catch (e) { erros.push(e.message); }
  }
  if (erros.length) { const e = new Error(`opções inválidas: ${erros.join('; ')}`); e.erros = erros; throw e; }
  return valores;
}

function citar(v) {
  const s = String(v);
  return /[\s"'\\$`|&;<>()]/.test(s) ? `"${s.replace(/(["\\])/g, '\\$1')}"` : s;
}

/** Monta os argumentos --nome=valor a partir dos valores validados (booleanos viram --nome / --no-nome). */
export function montarArgs(acao, valores) {
  const args = [];
  for (const campo of acao.campos) {
    const v = valores[campo.nome];
    if (v === undefined) continue;
    if (campo.tipo === 'booleano') {
      if (v) args.push(`--${campo.nome}`);
      else if (campo.padrao === true) args.push(`--no-${campo.nome}`);
      continue;
    }
    args.push(`--${campo.nome}=${v}`);
  }
  return args;
}

export function localizarWrangler() {
  for (const raiz of [RAIZ_CENTRAL, RAIZ_REPO]) {
    const p = path.join(raiz, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function git(args, { cwd = RAIZ_REPO } = {}) {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: 15_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  return stdout.trim();
}

export const CAMINHOS_PUBLICAVEIS = ['conteudo', 'data', 'precozen.config.json'].map((p) => path.join(RAIZ_CENTRAL, p));

/** Estado do git para a tela de publicação (sem credenciais). */
export async function estadoGit() {
  try {
    const raiz = await git(['rev-parse', '--show-toplevel']);
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const status = await git(['status', '--porcelain', '--', ...CAMINHOS_PUBLICAVEIS]);
    const alteracoes = status ? status.split('\n').map((l) => ({ estado: l.slice(0, 2).trim() || '??', caminho: l.slice(3).trim() })) : [];
    let remoto = null;
    try { remoto = (await git(['remote', 'get-url', 'origin'])).replace(/\/\/[^@/]+@/, '//'); } catch { remoto = null; }
    let ultimoCommit = null;
    try { ultimoCommit = await git(['log', '-1', '--format=%h %s (%cr)']); } catch { ultimoCommit = null; }
    let aFrente = null;
    try { aFrente = Number(await git(['rev-list', '--count', '@{upstream}..HEAD'])); } catch { aFrente = null; }
    return { git: true, raiz, branch, alteracoes, remoto, ultimoCommit, commitsNaoEnviados: aFrente };
  } catch (e) {
    return { git: false, motivo: e.message.split('\n')[0] };
  }
}

/**
 * Prepara a tarefa de uma ação: valida as opções e monta os passos. Devolve { nome, acao, opcoes, passos, notas }.
 */
export async function prepararTarefa(id, opcoes = {}, { config } = {}) {
  const acao = ACOES[id];
  if (!acao) throw new Error(`ação desconhecida: ${id}`);
  const valores = validarOpcoes(id, opcoes);
  const notas = [];
  if (acao.especial === 'deploy') {
    const wrangler = localizarWrangler();
    if (!wrangler) throw new Error('wrangler não instalado: rode `npm install` dentro de central/ (instala o wrangler como dependência de desenvolvimento)');
    const url = valores.url || process.env.SITE_URL_BLOG || config?.marca?.url;
    const dist = workspace('blog', 'dist');
    notas.push(process.env.CLOUDFLARE_API_TOKEN ? 'Autenticação: CLOUDFLARE_API_TOKEN definido no ambiente.' : 'Sem CLOUDFLARE_API_TOKEN no ambiente: o wrangler usará o login salvo (`npx wrangler login`), se existir.');
    const argsBuild = [BIN, 'blog', 'build', '--base=/', ...(url ? [`--url=${url}`] : [])];
    return {
      nome: 'Publicar blog na Cloudflare', acao: id, opcoes: valores, notas,
      passos: [
        { comando: process.execPath, args: argsBuild, cwd: RAIZ_CENTRAL, exibir: `precozen ${argsBuild.slice(1).map(citar).join(' ')}` },
        { comando: process.execPath, args: [wrangler, 'deploy', '--assets', dist], cwd: RAIZ_CENTRAL, exibir: `wrangler deploy --assets ${citar(dist)}` },
      ],
    };
  }
  if (acao.especial === 'git') {
    const estado = await estadoGit();
    if (!estado.git) throw new Error(`o repositório git não está disponível: ${estado.motivo}`);
    if (!estado.alteracoes.length) throw new Error('nenhuma alteração para publicar em conteudo/, data/ ou precozen.config.json');
    if (estado.branch === 'HEAD') throw new Error('o repositório está com HEAD solto: faça checkout de uma branch antes de publicar');
    if (valores.mensagem.startsWith('-')) throw new Error('a mensagem do commit não pode começar com "-"');
    const relativos = CAMINHOS_PUBLICAVEIS.map((p) => path.relative(estado.raiz, p));
    const passos = [
      { comando: 'git', args: ['add', '-A', '--', ...relativos], cwd: estado.raiz, exibir: `git add -A -- ${relativos.join(' ')}` },
      { comando: 'git', args: ['commit', '-m', valores.mensagem], cwd: estado.raiz, exibir: `git commit -m ${citar(valores.mensagem)}` },
      { comando: 'git', args: ['push', '-u', 'origin', estado.branch], cwd: estado.raiz, env: { GIT_TERMINAL_PROMPT: '0' }, exibir: `git push -u origin ${estado.branch}` },
    ];
    notas.push(`Branch: ${estado.branch} · ${estado.alteracoes.length} arquivo(s) alterado(s)`);
    return { nome: 'Enviar conteúdo para o GitHub', acao: id, opcoes: valores, notas, passos };
  }
  const args = [BIN, ...acao.cli, ...montarArgs(acao, valores)];
  return {
    nome: acao.titulo, acao: id, opcoes: valores, notas,
    passos: [{ comando: process.execPath, args, cwd: RAIZ_CENTRAL, exibir: `precozen ${args.slice(1).map(citar).join(' ')}` }],
  };
}

/** Catálogo para a interface: ações com os campos e as opções resolvidas. */
export function catalogo() {
  const dinamicas = opcoesDinamicas();
  const acoes = Object.entries(ACOES).map(([id, a]) => ({
    id, titulo: a.titulo, descricao: a.descricao, grupo: a.grupo, especial: a.especial || null,
    campos: a.campos.map((c) => ({ ...c, opcoes: c.tipo === 'escolha' ? (Array.isArray(c.opcoes) ? c.opcoes : dinamicas[c.opcoes] || []) : undefined })),
  }));
  return { acoes, opcoes: dinamicas };
}
