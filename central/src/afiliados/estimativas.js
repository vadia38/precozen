// Estimativa de vendas mensais a partir do ranking de vendas (BSR) — heurística ajustável por marketplace.
// vendas/mês ≈ k × BSR^(−alpha). Os parâmetros ficam em precozen.config.json (afiliados.estimativas).

const PADRAO = { k: 6000, alpha: 0.65 };

export function estimarVendasPorBsr(bsr, parametros = PADRAO) {
  const r = Number(bsr);
  if (!Number.isFinite(r) || r < 1) return null;
  const { k = PADRAO.k, alpha = PADRAO.alpha } = parametros || {};
  return Math.max(0, k * r ** -alpha);
}

/** Vendas/mês a partir do total vendido e da idade do anúncio (Mercado Livre expõe sold_quantity + date_created). */
export function estimarVendasPorHistorico(totalVendido, dataCriacao, hoje = new Date()) {
  const total = Number(totalVendido);
  if (!Number.isFinite(total) || total < 0) return null;
  const inicio = dataCriacao ? new Date(dataCriacao) : null;
  const meses = inicio && !Number.isNaN(inicio.getTime()) ? Math.max(1, (hoje - inicio) / (1000 * 60 * 60 * 24 * 30.44)) : 12;
  return total / meses;
}

/**
 * Define vendas mensais do produto na ordem: informadas > histórico (total vendido) > BSR > desconhecidas.
 * Devolve { vendasMes, fonte }.
 */
export function resolverVendas(produto, estimativasConfig = {}) {
  if (Number.isFinite(Number(produto.vendasMes)) && produto.vendasMes !== null && produto.vendasMes !== '') return { vendasMes: Number(produto.vendasMes), fonte: 'informado' };
  if (Number.isFinite(Number(produto.totalVendido)) && produto.totalVendido !== null && produto.totalVendido !== '') {
    const v = estimarVendasPorHistorico(produto.totalVendido, produto.criadoEm);
    if (v !== null) return { vendasMes: v, fonte: 'estimado-historico' };
  }
  if (produto.bsr) {
    const v = estimarVendasPorBsr(produto.bsr, estimativasConfig[produto.programa] || PADRAO);
    if (v !== null) return { vendasMes: v, fonte: 'estimado-bsr' };
  }
  return { vendasMes: null, fonte: 'desconhecido' };
}
