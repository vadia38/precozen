// Carrega posts e páginas de central/conteudo, valida o front matter e monta o modelo do blog.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_CENTRAL, listarArquivos } from '../core/arquivos.js';
import { analisar as lerFrontMatter } from '../core/frontmatter.js';
import { slug, ordenarPor, truncar, urlSegura } from '../core/util.js';
import { markdownParaHtml, markdownParaTexto, tempoLeitura } from './markdown.js';
import { categoriasCanonicas } from '../afiliados/programas.js';

export const DIR_CONTEUDO = path.join(RAIZ_CENTRAL, 'conteudo');

const PAGINAS_FIXAS = { sobre: 'Sobre', divulgacao: 'Divulgação de afiliados', privacidade: 'Política de privacidade', contato: 'Contato', metodologia: 'Metodologia' };

export function validarPost(meta, arquivo) {
  const erros = [];
  if (!meta.titulo) erros.push(`${arquivo}: sem título`);
  if (!meta.slug || !/^[a-z0-9-]+$/.test(meta.slug)) erros.push(`${arquivo}: slug inválido (só letras minúsculas, números e hífens)`);
  if (!meta.data || !/^\d{4}-\d{2}-\d{2}$/.test(String(meta.data))) erros.push(`${arquivo}: data deve ser AAAA-MM-DD`);
  if (meta.link && !urlSegura(meta.link)) erros.push(`${arquivo}: link inválido`);
  if (meta.imagem && !urlSegura(meta.imagem) && !String(meta.imagem).startsWith('/')) erros.push(`${arquivo}: imagem deve ser URL http(s) ou caminho absoluto`);
  if (meta.nota !== undefined && meta.nota !== '' && !(Number(meta.nota) >= 0 && Number(meta.nota) <= 10)) erros.push(`${arquivo}: nota deve estar entre 0 e 10`);
  return erros;
}

export function carregarPosts(dir = path.join(DIR_CONTEUDO, 'posts')) {
  const erros = [];
  const posts = [];
  const slugs = new Set();
  for (const arquivo of listarArquivos(dir, (p) => p.endsWith('.md'))) {
    const { meta, corpo } = lerFrontMatter(fs.readFileSync(arquivo, 'utf8'));
    if (meta.rascunho === true) continue;
    meta.slug = meta.slug || slug(path.basename(arquivo, '.md'));
    erros.push(...validarPost(meta, path.basename(arquivo)));
    if (slugs.has(meta.slug)) erros.push(`${path.basename(arquivo)}: slug repetido (${meta.slug})`);
    slugs.add(meta.slug);
    const { html, titulos } = markdownParaHtml(corpo);
    const texto = markdownParaTexto(corpo);
    posts.push({
      ...meta,
      tipo: meta.tipo || 'artigo',
      categoria: meta.categoria || 'outros',
      categoriaNome: meta.categoriaNome || categoriasCanonicas()[meta.categoria]?.nome || 'Geral',
      tags: meta.tags || [],
      descricao: meta.descricao || truncar(texto, 155),
      corpoMarkdown: corpo,
      html,
      titulos: titulos.filter((t) => t.nivel === 2),
      texto,
      palavras: texto.split(' ').filter(Boolean).length,
      minutos: tempoLeitura(corpo),
      arquivo,
      url: `post/${meta.slug}/`,
    });
  }
  return { posts: ordenarPor(posts, ['-data', 'titulo']), erros };
}

export function carregarPaginas(dir = path.join(DIR_CONTEUDO, 'paginas')) {
  const paginas = [];
  for (const arquivo of listarArquivos(dir, (p) => p.endsWith('.md'))) {
    const { meta, corpo } = lerFrontMatter(fs.readFileSync(arquivo, 'utf8'));
    const id = meta.slug || slug(path.basename(arquivo, '.md'));
    const { html, titulos } = markdownParaHtml(corpo);
    paginas.push({ ...meta, slug: id, titulo: meta.titulo || PAGINAS_FIXAS[id] || id, html, titulos, texto: markdownParaTexto(corpo), url: `${id}/`, noindex: meta.noindex === true, menu: meta.menu !== false });
  }
  return paginas;
}

/** Modelo completo do blog: posts, páginas, categorias com contagem, tags. */
export function carregarBlog({ dirPosts, dirPaginas } = {}) {
  const { posts, erros } = carregarPosts(dirPosts);
  const paginas = carregarPaginas(dirPaginas);
  const cats = categoriasCanonicas();
  const porCategoria = new Map();
  for (const p of posts) {
    const c = porCategoria.get(p.categoria) || { id: p.categoria, nome: p.categoriaNome || cats[p.categoria]?.nome || p.categoria, posts: [] };
    c.posts.push(p);
    porCategoria.set(p.categoria, c);
  }
  const categorias = [...porCategoria.values()].map((c) => ({ ...c, total: c.posts.length, url: `categoria/${c.id}/` })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  const tags = new Map();
  for (const p of posts) for (const t of p.tags) tags.set(t, (tags.get(t) || 0) + 1);
  return { posts, paginas, categorias, tags: [...tags.entries()].sort((a, b) => b[1] - a[1]), erros };
}
