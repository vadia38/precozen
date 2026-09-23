// Comandos do painel: build e servir (workspace inteiro: painel + blog gerado).
import { opcao } from '../core/cli.js';
import { log } from '../core/log.js';
import { workspace } from '../core/arquivos.js';
import { construirPainel } from './build.js';
import { servirPasta } from './servidor.js';

export const comandos = {
  build: {
    descricao: 'Gera o painel em workspace/painel/index.html',
    opcoes: { out: 'pasta de saída' },
    async executar(args, { config }) {
      const r = construirPainel({ config, out: opcao(args, 'out') });
      return { resumo: `painel em ${r.arquivo} · ${r.kpis.produtos} produtos · ${r.kpis.posts} posts · ${r.kpis.livros} livros` };
    },
  },
  servir: {
    descricao: 'Gera o painel e serve a pasta de trabalho (painel em /painel/, blog em /blog/dist/)',
    opcoes: { porta: 'porta (padrão 4190)' },
    async executar(args, { config }) {
      const porta = opcao(args, 'porta', 4190, 'inteiro');
      const r = construirPainel({ config });
      log.info(`Painel: http://localhost:${porta}/painel/ · Blog: http://localhost:${porta}/blog/dist/ (se gerado)`);
      await servirPasta(workspace(), { porta, observar: [workspace()], aoMudar: () => { try { construirPainel({ config }); } catch (e) { log.erro(e.message); } } });
      return null;
    },
  },
};
