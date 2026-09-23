// Fonte local: CSV ou JSON exportados de painéis de afiliados, planilhas ou de outras ferramentas.
import { lerDados } from '../../core/arquivos.js';
import { lerCsv } from '../../core/csv.js';

export const nome = 'arquivo';
export const descricao = 'CSV/JSON local (colunas flexíveis: nome, preco, categoria, comissao, bsr, vendas, avaliacao, avaliacoes, link, ...)';

/** Devolve registros brutos (objetos) a partir de um arquivo .csv ou .json. */
export function lerRegistros(caminho) {
  const dados = lerDados(caminho);
  if (dados && dados.csv !== undefined) return lerCsv(dados.csv);
  if (Array.isArray(dados)) return dados;
  if (dados && Array.isArray(dados.produtos)) return dados.produtos;
  if (dados && Array.isArray(dados.items)) return dados.items;
  throw new Error(`${caminho}: esperado um array de produtos (ou {produtos:[...]})`);
}

export async function buscar({ arquivo }) {
  if (!arquivo) throw new Error('informe --arquivo caminho.csv|json');
  return lerRegistros(arquivo);
}
