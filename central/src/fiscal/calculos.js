// Estimativas fiscais para receitas de afiliados e royalties: pessoa física (carnê-leão), MEI e Simples Nacional.
// Não substitui um contador. As tabelas ficam em precozen.config.json (fiscal) e devem ser conferidas na Receita Federal.
import { arredondar } from '../core/util.js';

/** Imposto mensal pela tabela progressiva (faixas com alíquota e parcela a deduzir). */
export function irpfMensal(base, tabela) {
  const b = Math.max(0, Number(base) || 0);
  if (!tabela?.faixas?.length) throw new Error('tabela do IRPF ausente na configuração (fiscal.irpf.faixas)');
  let faixa = tabela.faixas[tabela.faixas.length - 1];
  for (const f of tabela.faixas) { if (f.ate === null || f.ate === undefined || b <= f.ate) { faixa = f; break; } }
  let imposto = Math.max(0, b * faixa.aliquota - faixa.deducao);
  let reducao = 0;
  const r = tabela.redutor;
  if (r?.ativo) {
    if (b <= r.isencaoAte) reducao = imposto;
    else if (b <= r.reducaoParcialAte) reducao = Math.max(0, Math.min(imposto, r.coeficienteFixo - r.coeficienteVariavel * b));
    imposto -= reducao;
  }
  return { base: arredondar(b), aliquota: faixa.aliquota, deducao: faixa.deducao, reducao: arredondar(reducao), imposto: arredondar(imposto), aliquotaEfetiva: b ? arredondar(imposto / b, 4) : 0 };
}

/**
 * Estimativa mensal para pessoa física com carnê-leão:
 * comissões de fonte nacional (sem retenção) + royalties do exterior (com retenção na fonte compensável, limitada ao imposto brasileiro sobre aquele rendimento).
 */
export function estimarPessoaFisica({ comissoesBrl = 0, royaltiesUsd = 0, cambio, retencaoEua, outrosRendimentosBrl = 0, deducoesBrl = 0, tabela }) {
  const royaltiesBrutoBrl = royaltiesUsd * cambio;
  const retidoExterior = royaltiesBrutoBrl * retencaoEua;
  const royaltiesLiquidosRecebidos = royaltiesBrutoBrl - retidoExterior;
  const base = comissoesBrl + royaltiesBrutoBrl + outrosRendimentosBrl - deducoesBrl;
  const ir = irpfMensal(base, tabela);
  // Compensação do imposto pago no exterior (reciprocidade Brasil–EUA), limitada ao IR brasileiro proporcional aos royalties
  const proporcaoRoyalties = base > 0 ? Math.min(1, royaltiesBrutoBrl / base) : 0;
  const limiteCompensacao = ir.imposto * proporcaoRoyalties;
  const compensado = Math.min(retidoExterior, limiteCompensacao);
  const irAPagar = Math.max(0, ir.imposto - compensado);
  const liquido = comissoesBrl + royaltiesLiquidosRecebidos + outrosRendimentosBrl - irAPagar;
  return {
    regime: 'pf', cambio, retencaoEua,
    comissoesBrl: arredondar(comissoesBrl), royaltiesUsd, royaltiesBrutoBrl: arredondar(royaltiesBrutoBrl), retidoExterior: arredondar(retidoExterior), royaltiesLiquidosRecebidos: arredondar(royaltiesLiquidosRecebidos),
    baseCalculo: arredondar(base), irBruto: ir.imposto, aliquota: ir.aliquota, reducao: ir.reducao, compensado: arredondar(compensado), irAPagar: arredondar(irAPagar),
    liquido: arredondar(liquido), cargaEfetiva: base > 0 ? arredondar((irAPagar + retidoExterior) / (comissoesBrl + royaltiesBrutoBrl + outrosRendimentosBrl), 4) : 0,
    observacoes: [
      'Comissões de afiliado pagas por pessoa jurídica no Brasil podem sofrer retenção na fonte pela pagadora; confira o informe de rendimentos.',
      'Royalties recebidos do exterior entram no carnê-leão pelo valor bruto convertido pelo câmbio de compra do dia do recebimento (PTAX).',
      'O imposto retido nos EUA pode ser compensado até o limite do imposto brasileiro sobre o mesmo rendimento (reciprocidade reconhecida pela RFB).',
    ],
  };
}

/** MEI: DAS fixo mensal; alerta se a receita anual projetada ultrapassa o limite. */
export function estimarMei({ receitaMensalBrl = 0, mei }) {
  const anual = receitaMensalBrl * 12;
  const excede = anual > mei.limiteAnual;
  return { regime: 'mei', receitaMensalBrl: arredondar(receitaMensalBrl), receitaAnualProjetada: arredondar(anual), dasMensal: mei.dasMensal, limiteAnual: mei.limiteAnual, excedeLimite: excede, liquido: arredondar(receitaMensalBrl - mei.dasMensal), cargaEfetiva: receitaMensalBrl ? arredondar(mei.dasMensal / receitaMensalBrl, 4) : 0, observacoes: [mei.observacao, excede ? 'Receita projetada acima do limite do MEI: avalie o Simples Nacional.' : 'Dentro do limite anual do MEI (verifique o limite vigente).'] };
}

/** Simples Nacional (1ª faixa): Anexo III ou V conforme o Fator R (folha ≥ 28% da receita → Anexo III). */
export function estimarSimples({ receitaMensalBrl = 0, folhaMensalBrl = 0, simples }) {
  const fatorR = receitaMensalBrl ? folhaMensalBrl / receitaMensalBrl : 0;
  const anexo = fatorR >= 0.28 ? 'III' : 'V';
  const aliquota = anexo === 'III' ? simples.anexoIII : simples.anexoV;
  const imposto = receitaMensalBrl * aliquota;
  return { regime: 'simples', anexo, fatorR: arredondar(fatorR, 4), aliquota, imposto: arredondar(imposto), liquido: arredondar(receitaMensalBrl - imposto - folhaMensalBrl), cargaEfetiva: aliquota, observacoes: [simples.observacao, 'Royalties do exterior recebidos pela PJ podem ter tratamento diferente (PIS/COFINS, IRPJ); confirme com o contador.'] };
}

/** Compara os regimes para a mesma receita mensal. */
export function compararRegimes({ comissoesBrl = 0, royaltiesUsd = 0, folhaMensalBrl = 0, config }) {
  const f = config.fiscal;
  const pf = estimarPessoaFisica({ comissoesBrl, royaltiesUsd, cambio: f.cambioUsdBrl, retencaoEua: f.retencaoEuaRoyalties, tabela: f.irpf });
  const receita = comissoesBrl + royaltiesUsd * f.cambioUsdBrl;
  const mei = estimarMei({ receitaMensalBrl: receita, mei: f.mei });
  const simples = estimarSimples({ receitaMensalBrl: receita, folhaMensalBrl, simples: f.simples });
  return { receitaBrutaBrl: arredondar(receita), pf, mei, simples };
}
