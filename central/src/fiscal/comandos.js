// Comandos do módulo fiscal: estimar (PF × MEI × Simples) e tabela.
import { opcao } from '../core/cli.js';
import { log, tabela } from '../core/log.js';
import { formatarMoeda, formatarPct } from '../core/util.js';
import { compararRegimes, irpfMensal } from './calculos.js';

export const comandos = {
  estimar: {
    descricao: 'Estima imposto e líquido mensal sobre comissões (BRL) e royalties KDP (USD) nos regimes PF, MEI e Simples',
    opcoes: { comissoes: 'comissões mensais em R$', royalties: 'royalties mensais em US$', folha: 'folha de pagamento mensal (Simples, Fator R)', cambio: 'câmbio USD→BRL (padrão: fiscal.cambioUsdBrl)' },
    async executar(args, { config }) {
      const cfg = { ...config, fiscal: { ...config.fiscal, cambioUsdBrl: opcao(args, 'cambio', config.fiscal.cambioUsdBrl, 'numero') } };
      const r = compararRegimes({ comissoesBrl: opcao(args, 'comissoes', 0, 'numero'), royaltiesUsd: opcao(args, 'royalties', 0, 'numero'), folhaMensalBrl: opcao(args, 'folha', 0, 'numero'), config: cfg });
      log.titulo(`Receita bruta mensal: ${formatarMoeda(r.receitaBrutaBrl)} (câmbio ${cfg.fiscal.cambioUsdBrl})`);
      log.info(`Pessoa física (carnê-leão, tabela ${config.fiscal.irpf.vigencia}): base ${formatarMoeda(r.pf.baseCalculo)} · IR ${formatarMoeda(r.pf.irBruto)}${r.pf.reducao ? ` (redução ${formatarMoeda(r.pf.reducao)})` : ''} · retido nos EUA ${formatarMoeda(r.pf.retidoExterior)} · compensado ${formatarMoeda(r.pf.compensado)} · IR a pagar ${formatarMoeda(r.pf.irAPagar)} · líquido ${formatarMoeda(r.pf.liquido)} · carga ${formatarPct(r.pf.cargaEfetiva)}`);
      log.info(`MEI: DAS ${formatarMoeda(r.mei.dasMensal)} · líquido ${formatarMoeda(r.mei.liquido)} · carga ${formatarPct(r.mei.cargaEfetiva)}${r.mei.excedeLimite ? ' · EXCEDE o limite anual' : ''}`);
      log.info(`Simples (Anexo ${r.simples.anexo}, Fator R ${formatarPct(r.simples.fatorR)}): imposto ${formatarMoeda(r.simples.imposto)} · líquido ${formatarMoeda(r.simples.liquido)} · carga ${formatarPct(r.simples.cargaEfetiva)}`);
      log.info('\nObservações:');
      for (const o of [...r.pf.observacoes, ...r.mei.observacoes, ...r.simples.observacoes]) log.info(`  - ${o}`);
      log.info(`\n${config.fiscal.irpf.observacao}`);
      const melhor = [['PF', r.pf.liquido], ['MEI', r.mei.excedeLimite ? -Infinity : r.mei.liquido], ['Simples', r.simples.liquido]].sort((a, b) => b[1] - a[1])[0];
      return { resumo: `maior líquido estimado: ${melhor[0]} (${formatarMoeda(melhor[1])}) — confirme com um contador` };
    },
  },
  tabela: {
    descricao: 'Mostra a tabela progressiva configurada e o imposto para alguns valores',
    async executar(args, { config }) {
      const t = config.fiscal.irpf;
      log.titulo(`Tabela mensal IRPF (${t.vigencia})${t.redutor?.ativo ? ' com redutor 2026' : ''}`);
      tabela(t.faixas, [{ chave: (f) => (f.ate === null ? 'acima' : formatarMoeda(f.ate)), rotulo: 'Até', alinhar: 'direita' }, { chave: (f) => formatarPct(f.aliquota), rotulo: 'Alíquota', alinhar: 'direita' }, { chave: (f) => formatarMoeda(f.deducao), rotulo: 'Dedução', alinhar: 'direita' }]);
      log.info('');
      tabela([2000, 3000, 5000, 8000, 12000].map((v) => ({ v, ...irpfMensal(v, t) })), [{ chave: (x) => formatarMoeda(x.v), rotulo: 'Base', alinhar: 'direita' }, { chave: (x) => formatarMoeda(x.imposto), rotulo: 'Imposto', alinhar: 'direita' }, { chave: (x) => formatarPct(x.aliquotaEfetiva), rotulo: 'Efetiva', alinhar: 'direita' }]);
      return { resumo: t.observacao };
    },
  },
};
