// Pontuação de nichos/palavras-chave para KDP: demanda × concorrência × preço, a partir de dados informados (CSV/JSON).
import { lerCsv } from '../core/csv.js';
import { lerDados } from '../core/arquivos.js';
import { paraNumero, arredondar, clamp } from '../core/util.js';

export function pontuarNicho(n) {
  const buscas = Number(n.buscasMes) || 0;
  const resultados = Number(n.resultados) || 0;
  const precoMedio = Number(n.precoMedio) || 0;
  const bsr = Number(n.bsrMedioTop) || 0;
  const demanda = clamp(Math.log10(1 + buscas) / 4, 0, 1) * 100; // 10 mil buscas/mês → 100
  const concorrencia = resultados ? clamp(1 - (Math.log10(1 + resultados) - 2) / 3, 0, 1) * 100 : 50; // 100 resultados → 100; 100 mil → 0
  const monetizacao = precoMedio ? clamp((precoMedio - 4) / 10, 0, 1) * 100 : 50; // US$ 14 → 100
  const tracao = bsr ? clamp(1 - (Math.log10(bsr) - 2) / 4, 0, 1) * 100 : 50; // BSR 100 → 100; 1 milhão → 0
  const score = arredondar(demanda * 0.35 + concorrencia * 0.3 + monetizacao * 0.15 + tracao * 0.2, 1);
  return { ...n, partes: { demanda: arredondar(demanda, 1), concorrencia: arredondar(concorrencia, 1), monetizacao: arredondar(monetizacao, 1), tracao: arredondar(tracao, 1) }, score, classe: score >= 65 ? 'forte' : score >= 50 ? 'medio' : 'fraco' };
}

function normalizarLinha(l) {
  const pegar = (...ks) => { for (const k of ks) if (l[k] !== undefined && l[k] !== '') return l[k]; return undefined; };
  return {
    termo: pegar('termo', 'palavra_chave', 'keyword', 'nicho'),
    buscasMes: paraNumero(pegar('buscas_mes', 'buscas', 'volume', 'search_volume')),
    resultados: paraNumero(pegar('resultados', 'concorrencia', 'results', 'competing')),
    precoMedio: paraNumero(pegar('preco_medio', 'preco', 'avg_price')),
    bsrMedioTop: paraNumero(pegar('bsr_medio_top', 'bsr', 'bsr_medio')),
    tipo: pegar('tipo', 'formato') || '',
    observacao: pegar('observacao', 'obs') || '',
  };
}

export function analisarNichos(registros) {
  const lista = registros.map(normalizarLinha).filter((n) => n.termo).map(pontuarNicho).sort((a, b) => b.score - a.score);
  lista.forEach((n, i) => { n.posicao = i + 1; });
  return lista;
}

export function analisarNichosDeArquivo(caminho) {
  const dados = lerDados(caminho);
  const registros = dados.csv !== undefined ? lerCsv(dados.csv) : Array.isArray(dados) ? dados : dados.nichos || [];
  return analisarNichos(registros);
}
