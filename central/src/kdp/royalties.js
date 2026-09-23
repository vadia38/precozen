// Royalties e custos de impressão do KDP (paperback e eBook), com tabelas de referência configuráveis.
// Fonte: tabelas públicas da KDP (Printing cost & royalty calculator). Confira valores atuais antes de definir preço.

export const TABELAS = {
  verificadoEm: '2026-09',
  observacao: 'Custos de impressão de referência da KDP (atualização de 2023). Use a calculadora oficial para o valor final.',
  paperback: {
    'amazon.com': { moeda: 'USD', royalty: 0.6, pb: { fixo: 2.3, ate: 108, base: 1.0, porPagina: 0.012 }, 'cor-premium': { fixo: 3.65, ate: 40, base: 1.0, porPagina: 0.07 }, 'cor-padrao': { fixo: null, ate: 0, base: 1.0, porPagina: 0.0255 }, precoMinimo: null, expandido: 0.4 },
    'amazon.co.uk': { moeda: 'GBP', royalty: 0.6, pb: { fixo: 1.93, ate: 108, base: 0.85, porPagina: 0.01 }, 'cor-premium': { fixo: 3.1, ate: 40, base: 0.85, porPagina: 0.06 }, 'cor-padrao': { fixo: null, ate: 0, base: 0.85, porPagina: 0.02 } },
    'amazon.de': { moeda: 'EUR', royalty: 0.6, pb: { fixo: 2.05, ate: 108, base: 0.85, porPagina: 0.012 }, 'cor-premium': { fixo: 3.35, ate: 40, base: 0.85, porPagina: 0.07 }, 'cor-padrao': { fixo: null, ate: 0, base: 0.85, porPagina: 0.025 } },
  },
  ebook: {
    'amazon.com': { moeda: 'USD', faixa70: [2.99, 9.99], entregaPorMb: 0.15, minimo35: 0.99, maximo: 200 },
    'amazon.com.br': { moeda: 'BRL', faixa70: [5.99, 24.99], entregaPorMb: 0.3, minimo35: 1.99, maximo: 400 },
    'amazon.co.uk': { moeda: 'GBP', faixa70: [1.77, 9.99], entregaPorMb: 0.1, minimo35: 0.77, maximo: 150 },
    'amazon.de': { moeda: 'EUR', faixa70: [2.69, 9.99], entregaPorMb: 0.12, minimo35: 0.99, maximo: 215 },
  },
};

const r2 = (n) => Math.round(n * 100) / 100;

/** Custo de impressão de um paperback. tinta: pb | cor-premium | cor-padrao */
export function custoImpressao({ paginas, tinta = 'pb', marketplace = 'amazon.com', tabelas = TABELAS }) {
  const m = tabelas.paperback[marketplace];
  if (!m) throw new Error(`marketplace sem tabela de impressão: ${marketplace} (disponíveis: ${Object.keys(tabelas.paperback).join(', ')})`);
  const t = m[tinta];
  if (!t) throw new Error(`tinta desconhecida: ${tinta}`);
  const custo = t.fixo !== null && paginas <= t.ate ? t.fixo : t.base + t.porPagina * paginas;
  return { custo: r2(custo), moeda: m.moeda, tinta, paginas, marketplace };
}

/** Royalty de paperback: 60% do preço de lista menos o custo de impressão (40% na distribuição expandida). */
export function royaltyPaperback({ precoLista, paginas, tinta = 'pb', marketplace = 'amazon.com', expandido = false, tabelas = TABELAS }) {
  const m = tabelas.paperback[marketplace];
  const { custo, moeda } = custoImpressao({ paginas, tinta, marketplace, tabelas });
  const taxa = expandido ? (m.expandido ?? 0.4) : m.royalty;
  const royalty = r2(precoLista * taxa - custo);
  const precoMinimo = r2(Math.ceil((custo / taxa) * 100) / 100);
  return { precoLista, custo, taxa, royalty, moeda, precoMinimo, margem: precoLista ? r2(royalty / precoLista) : 0, viavel: royalty > 0 };
}

/** Royalty de eBook: 70% (dentro da faixa, menos entrega) ou 35%. */
export function royaltyEbook({ preco, tamanhoMb = 1, marketplace = 'amazon.com', opcao, tabelas = TABELAS }) {
  const m = tabelas.ebook[marketplace];
  if (!m) throw new Error(`marketplace sem tabela de eBook: ${marketplace}`);
  const dentroFaixa = preco >= m.faixa70[0] && preco <= m.faixa70[1];
  const usar70 = opcao === 70 ? dentroFaixa : opcao === 35 ? false : dentroFaixa;
  const entrega = usar70 ? r2(m.entregaPorMb * tamanhoMb) : 0;
  const royalty = usar70 ? r2(preco * 0.7 - entrega) : r2(preco * 0.35);
  return { preco, moeda: m.moeda, opcao: usar70 ? 70 : 35, entrega, royalty, dentroFaixa70: dentroFaixa, faixa70: m.faixa70 };
}

/** Sugere preços de lista para um paperback a partir de metas de royalty por unidade. */
export function sugerirPrecos({ paginas, tinta = 'pb', marketplace = 'amazon.com', metas = [2, 3, 4, 5, 6], tabelas = TABELAS }) {
  const { custo, moeda } = custoImpressao({ paginas, tinta, marketplace, tabelas });
  const taxa = tabelas.paperback[marketplace].royalty;
  return metas.map((meta) => {
    const preco = Math.ceil(((custo + meta) / taxa) * 100) / 100;
    const precoRedondo = Math.ceil(preco) - 0.01;
    return { meta, preco: r2(precoRedondo), royalty: r2(precoRedondo * taxa - custo), moeda };
  });
}
