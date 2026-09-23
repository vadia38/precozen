// Comandos do painel: build, servir (estático) e admin (painel administrativo web).
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
  admin: {
    descricao: 'Painel administrativo (web, local): produtos, posts, publicação, KDP, design, fiscal, IA e configuração',
    opcoes: { porta: 'porta (padrão 4200)', host: 'endereço (padrão 127.0.0.1; outro host exige PRECOZEN_PAINEL_TOKEN)', token: 'token de acesso (padrão: PRECOZEN_PAINEL_TOKEN do .env ou um token gerado)', abrir: 'abre o navegador' },
    async executar(args) {
      const { iniciarAdmin, abrirNavegador } = await import('./admin/servidor.js');
      const r = await iniciarAdmin({ porta: opcao(args, 'porta', 4200, 'inteiro'), host: opcao(args, 'host', '127.0.0.1'), token: opcao(args, 'token'), configArquivo: args.config ? String(args.config) : undefined });
      const link = `${r.url}/?token=${r.token}`;
      log.info(`Painel administrativo: ${link}`);
      if (r.tokenGerado) log.info('Token gerado só para esta execução. Para um token fixo, defina PRECOZEN_PAINEL_TOKEN em central/.env (Ctrl+C para sair).');
      else log.info('Token lido de PRECOZEN_PAINEL_TOKEN/--token (Ctrl+C para sair).');
      if (opcao(args, 'abrir', false, 'flag')) abrirNavegador(link);
      const sair = () => { r.fechar().finally(() => process.exit(0)); };
      process.once('SIGINT', sair);
      process.once('SIGTERM', sair);
      await r.encerrado;
      return null;
    },
  },
};

