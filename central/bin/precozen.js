#!/usr/bin/env node
// CLI do sistema central. Uso: precozen <modulo> <comando> [opções] — `precozen ajuda` lista tudo.
import { lerArgs, ajudaModulo } from '../src/core/cli.js';
import { log, definirSilencioso, cores } from '../src/core/log.js';
import { carregarConfig } from '../src/core/config.js';
import { duracao } from '../src/core/util.js';

const MODULOS = {
  afiliados: { arquivo: '../src/afiliados/comandos.js', descricao: 'Importa produtos de programas de afiliados, pontua vendas × comissão e gera reviews' },
  blog: { arquivo: '../src/blog/comandos.js', descricao: 'Gera o blog estático de análises (monetizado com links de afiliado)' },
  kdp: { arquivo: '../src/kdp/comandos.js', descricao: 'Gera livros (interior PDF), metadados, preços e nichos para o Amazon KDP' },
  design: { arquivo: '../src/design/comandos.js', descricao: 'Cria designs para venda na Amazon: Merch (camisetas), capas KDP e imagens de listagem' },
  fiscal: { arquivo: '../src/fiscal/comandos.js', descricao: 'Estima impostos sobre comissões e royalties (PF, MEI, Simples)' },
  painel: { arquivo: '../src/painel/comandos.js', descricao: 'Painel central com o estado de tudo e servidor local' },
  ia: { arquivo: '../src/ia/comandos.js', descricao: 'Testa e configura a geração de conteúdo com IA (Claude)' },
  exemplo: { arquivo: '../src/painel/exemplo.js', descricao: 'Roda o fluxo completo com os dados de exemplo (afiliados → blog → kdp → design → painel)' },
};

function ajudaGeral() {
  const linhas = [`${cores.negrito('Precozen Central')} — blog de afiliados, conteúdo para KDP e designs para a Amazon\n`, 'Uso: precozen <modulo> <comando> [opções]\n', 'Módulos:'];
  for (const [nome, m] of Object.entries(MODULOS)) linhas.push(`  ${nome.padEnd(12)} ${m.descricao}`);
  linhas.push('\nOpções globais: --config caminho.json  --workspace pasta  --silencioso  --ajuda');
  linhas.push('Exemplos:\n  precozen exemplo\n  precozen afiliados importar --arquivo data/produtos-exemplo.csv\n  precozen afiliados analisar --top 20\n  precozen afiliados reviews --top 10\n  precozen blog build\n  precozen kdp livro --tipo caca-palavras --titulo "Caça-palavras: Animais" --paginas 60\n  precozen design camiseta --texto "Café primeiro" --layout empilhado\n  precozen painel servir');
  return linhas.join('\n');
}

async function principal() {
  const args = lerArgs(process.argv.slice(2));
  const [modulo, comando] = args._;
  if (args.silencioso) definirSilencioso(true);
  if (args.workspace) process.env.PRECOZEN_WORKSPACE = String(args.workspace);
  if (!modulo || modulo === 'ajuda' || modulo === 'help' || (args.ajuda && !modulo)) { console.log(ajudaGeral()); return; }
  const def = MODULOS[modulo];
  if (!def) { log.erro(`módulo desconhecido: ${modulo}\n`); console.log(ajudaGeral()); process.exitCode = 2; return; }
  const mod = await import(def.arquivo);
  const comandos = mod.comandos;
  if (modulo === 'exemplo') { await mod.executar(args, { config: carregarConfig({ arquivo: args.config }) }); return; }
  if (!comando || comando === 'ajuda' || args.ajuda || !comandos[comando]) {
    if (comando && !comandos[comando] && comando !== 'ajuda') log.erro(`comando desconhecido: ${modulo} ${comando}\n`);
    console.log(ajudaModulo(modulo, comandos));
    return;
  }
  const inicio = Date.now();
  const config = carregarConfig({ arquivo: args.config });
  const resultado = await comandos[comando].executar(args, { config, args });
  if (resultado && resultado.resumo) log.ok(`${resultado.resumo} (${duracao(Date.now() - inicio)})`);
}

principal().catch((e) => {
  log.erro(e.message);
  if (process.env.PRECOZEN_DEBUG) console.error(e.stack);
  process.exitCode = 1;
});
