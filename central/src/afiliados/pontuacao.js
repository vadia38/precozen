// Pontuação de produtos: quanto vale a pena analisar/promover cada item, combinando comissão, demanda, qualidade, preço e tendência.
import { clamp, arredondar } from '../core/util.js';

export const PADRAO_PONTUACAO = {
  pesos: { comissao: 0.3, demanda: 0.3, qualidade: 0.2, preco: 0.1, tendencia: 0.1 },
  classes: { ouro: 70, prata: 55, bronze: 40 },
  conversao: 0.03,
  comissaoReferencia: 40,
  demandaReferencia: 300,
  faixaPreco: [80, 600],
  minimoAvaliacoes: 20,
};

/** Curva saturante 0–100: 63 no valor de referência, ~95 em 3× a referência. */
export function saturar(valor, referencia) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0 || !referencia) return 0;
  return 100 * (1 - Math.exp(-v / referencia));
}

export function pontuarComissao(comissaoValor, cfg) {
  return saturar(comissaoValor, cfg.comissaoReferencia);
}

export function pontuarDemanda(vendasMes, cfg) {
  if (vendasMes === null || vendasMes === undefined) return null;
  return saturar(vendasMes, cfg.demandaReferencia);
}

/** 70% nota média (0–5) + 30% volume de avaliações (log). Produtos sem avaliações recebem nota neutra baixa. */
export function pontuarQualidade(avaliacao, numAvaliacoes, cfg) {
  const nota = Number(avaliacao);
  const n = Number(numAvaliacoes) || 0;
  if (!Number.isFinite(nota) || nota <= 0) return n > 0 ? 30 : 25;
  const parteNota = clamp((nota - 2.5) / 2.5, 0, 1) * 70; // 2,5 → 0; 5,0 → 70
  const parteVolume = clamp(Math.log10(1 + n) / 4, 0, 1) * 30; // 10 mil avaliações → 30
  const penalidade = n < (cfg.minimoAvaliacoes || 0) ? 0.8 : 1;
  return (parteNota + parteVolume) * penalidade;
}

/** Faixa de preço "doce" para conversão: 100 dentro da faixa, decaindo fora dela. */
export function pontuarPreco(preco, cfg) {
  const p = Number(preco);
  if (!Number.isFinite(p) || p <= 0) return 40;
  const [min, max] = cfg.faixaPreco || [80, 600];
  if (p >= min && p <= max) return 100;
  if (p < min) return clamp(100 * (p / min), 20, 100);
  return clamp(100 * Math.exp(-(p - max) / (max * 2)), 20, 100);
}

/** Tendência informada (−1 a 1) ou desconto atual como sinal fraco. */
export function pontuarTendencia(produto) {
  if (Number.isFinite(Number(produto.tendencia)) && produto.tendencia !== null && produto.tendencia !== '') return clamp(50 + Number(produto.tendencia) * 50, 0, 100);
  if (produto.precoAntigo && produto.preco && produto.precoAntigo > produto.preco) {
    const desconto = 1 - produto.preco / produto.precoAntigo;
    return clamp(50 + desconto * 100, 50, 85);
  }
  return 50;
}

export function classificar(score, classes) {
  if (score >= classes.ouro) return 'ouro';
  if (score >= classes.prata) return 'prata';
  if (score >= classes.bronze) return 'bronze';
  return 'descartar';
}

/**
 * Pontua um produto normalizado. Devolve o produto com `pontuacao` {score, classe, partes, epc100, receitaPotencialMes}.
 * Quando a demanda é desconhecida, o peso dela é redistribuído (o score fica marcado como parcial).
 */
export function pontuar(produto, cfgPontuacao = PADRAO_PONTUACAO) {
  const cfg = { ...PADRAO_PONTUACAO, ...cfgPontuacao, pesos: { ...PADRAO_PONTUACAO.pesos, ...(cfgPontuacao.pesos || {}) }, classes: { ...PADRAO_PONTUACAO.classes, ...(cfgPontuacao.classes || {}) } };
  const comissaoValor = (Number(produto.preco) || 0) * (Number(produto.comissaoTaxa) || 0);
  const partes = {
    comissao: pontuarComissao(comissaoValor, cfg),
    demanda: pontuarDemanda(produto.vendasMes, cfg),
    qualidade: pontuarQualidade(produto.avaliacao, produto.numAvaliacoes, cfg),
    preco: pontuarPreco(produto.preco, cfg),
    tendencia: pontuarTendencia(produto),
  };
  let somaPesos = 0;
  let score = 0;
  for (const [k, peso] of Object.entries(cfg.pesos)) {
    if (partes[k] === null || partes[k] === undefined) continue;
    score += partes[k] * peso;
    somaPesos += peso;
  }
  score = somaPesos ? score / somaPesos : 0;
  const parcial = partes.demanda === null;
  if (parcial) score *= 0.9; // sem dado de demanda, desconto de confiança
  const epc100 = comissaoValor * cfg.conversao * 100; // ganho esperado a cada 100 cliques
  const receitaPotencialMes = produto.vendasMes !== null && produto.vendasMes !== undefined ? comissaoValor * produto.vendasMes : null; // se você fosse a origem de 100% das vendas (teto teórico)
  return {
    ...produto,
    comissaoValor: arredondar(comissaoValor, 2),
    pontuacao: {
      score: arredondar(score, 1),
      classe: classificar(score, cfg.classes),
      parcial,
      partes: Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, v === null ? null : arredondar(v, 1)])),
      epc100: arredondar(epc100, 2),
      receitaPotencialMes: receitaPotencialMes === null ? null : arredondar(receitaPotencialMes, 2),
    },
  };
}

/** Pontua e ordena uma lista, devolvendo também um resumo por classe e categoria. */
export function classificarLista(produtos, cfgPontuacao) {
  const pontuados = produtos.map((p) => pontuar(p, cfgPontuacao)).sort((a, b) => b.pontuacao.score - a.pontuacao.score || (b.pontuacao.epc100 - a.pontuacao.epc100));
  pontuados.forEach((p, i) => { p.pontuacao.posicao = i + 1; });
  const porClasse = {};
  const porCategoria = {};
  for (const p of pontuados) {
    porClasse[p.pontuacao.classe] = (porClasse[p.pontuacao.classe] || 0) + 1;
    const c = porCategoria[p.categoria] || (porCategoria[p.categoria] = { categoria: p.categoria, categoriaNome: p.categoriaNome, total: 0, scoreMedio: 0, epcMedio: 0 });
    c.total++; c.scoreMedio += p.pontuacao.score; c.epcMedio += p.pontuacao.epc100;
  }
  for (const c of Object.values(porCategoria)) { c.scoreMedio = arredondar(c.scoreMedio / c.total, 1); c.epcMedio = arredondar(c.epcMedio / c.total, 2); }
  return { produtos: pontuados, resumo: { total: pontuados.length, porClasse, porCategoria: Object.values(porCategoria).sort((a, b) => b.scoreMedio - a.scoreMedio) } };
}
