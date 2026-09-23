// Comandos do módulo blog: build, validar, servir.
import { opcao } from '../core/cli.js';
import { log } from '../core/log.js';
import { construirBlog } from './build.js';
import { carregarBlog } from './conteudo.js';
import { servirPasta } from '../painel/servidor.js';
import { workspace } from '../core/arquivos.js';

export const comandos = {
  build: {
    descricao: 'Gera o blog estático em workspace/blog/dist (ou --out)',
    opcoes: { out: 'pasta de saída', base: 'base path (ex.: /blog/)', url: 'URL pública (ex.: https://precozen.com.br)' },
    async executar(args, { config }) {
      const r = construirBlog({ config, out: opcao(args, 'out'), base: opcao(args, 'base'), url: opcao(args, 'url') });
      return { resumo: `${r.paginas} páginas (${r.posts} posts, ${r.categorias} categorias) em ${r.saida} · ${r.url}${r.base} · v${r.versao}` };
    },
  },
  validar: {
    descricao: 'Confere o front matter dos posts e páginas sem gerar o site',
    async executar() {
      const blog = carregarBlog();
      for (const e of blog.erros) log.erro(e);
      if (blog.erros.length) throw new Error(`${blog.erros.length} problema(s) no conteúdo`);
      return { resumo: `${blog.posts.length} posts e ${blog.paginas.length} páginas válidos` };
    },
  },
  servir: {
    descricao: 'Gera o blog e serve localmente (reconstrói ao salvar conteúdo)',
    opcoes: { porta: 'porta (padrão 4180)' },
    async executar(args, { config }) {
      const porta = opcao(args, 'porta', 4180, 'inteiro');
      const out = workspace('blog', 'dist');
      const gerar = () => { try { const r = construirBlog({ config, out, base: '/', url: `http://localhost:${porta}` }); log.info(`[blog] ${r.paginas} páginas em ${r.ms} ms`); } catch (e) { log.erro(`[blog] ${e.message}`); } };
      gerar();
      await servirPasta(out, { porta, observar: [`${process.cwd()}/conteudo`, `${process.cwd()}/templates`], aoMudar: gerar });
      return null;
    },
  },
};
