// Regras do orçamento (carrinho de cotação). Isomórfico: sem DOM, sem localStorage.
import { codigoValido } from './util.js';

export const CHAVE_ORCAMENTO = 'luretec.orcamento.v1';
export const QTD_MAXIMA = 9999;
export const ITENS_MAXIMOS = 200;

/** Normaliza uma quantidade para inteiro entre 1 e QTD_MAXIMA. */
export function qtdValida(valor, padrao = 1) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < 1) return padrao;
  return Math.min(n, QTD_MAXIMA);
}

/** "64041:2,66025-3:1" */
export function serializarItens(itens) {
  return (itens || [])
    .filter((i) => i && codigoValido(i.codigo))
    .map((i) => `${i.codigo}:${qtdValida(i.qtd)}`)
    .join(',');
}

/** Inverso de serializarItens. Ignora entradas inválidas. */
export function parseItens(texto) {
  const saida = [];
  const vistos = new Set();
  for (const parte of String(texto || '').split(',')) {
    const [codigoBruto, qtdBruta] = parte.trim().split(':');
    const codigo = (codigoBruto || '').trim();
    if (!codigoValido(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    saida.push({ codigo, qtd: qtdValida(qtdBruta) });
    if (saida.length >= ITENS_MAXIMOS) break;
  }
  return saida;
}

/** Sanitiza os dados do cliente (limites de tamanho, sem quebras de linha nos campos curtos). */
export function limparCliente(cliente = {}) {
  const curto = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return {
    nome: curto(cliente.nome, 80),
    empresa: curto(cliente.empresa, 80),
    telefone: curto(cliente.telefone, 30),
    cidade: curto(cliente.cidade, 60),
    observacoes: String(cliente.observacoes ?? '').replace(/\r/g, '').trim().slice(0, 500),
  };
}

/**
 * Monta o texto enviado pelo WhatsApp (ou copiado/impresso).
 * itens: [{ codigo, nome, ref, qtd }]
 */
export function montarMensagem({ itens = [], cliente = {}, titulo = 'Orçamento — Catálogo Luretec', urlCompartilhar = '' }) {
  const c = limparCliente(cliente);
  const linhas = [`*${titulo}*`];
  const dados = [c.nome, c.empresa, c.telefone, c.cidade].filter(Boolean);
  if (dados.length) linhas.push(`Cliente: ${dados.join(' · ')}`);
  linhas.push('', `Itens (${itens.length}):`);
  itens.forEach((item, i) => {
    const ref = item.ref ? ` (REF. ${item.ref})` : '';
    linhas.push(`${i + 1}. ${item.codigo} — ${item.nome}${ref} × ${qtdValida(item.qtd)}`);
  });
  if (c.observacoes) linhas.push('', `Obs.: ${c.observacoes}`);
  if (urlCompartilhar) linhas.push('', `Lista online: ${urlCompartilhar}`);
  return linhas.join('\n');
}

/** Monta o link wa.me com o texto já codificado. */
export function linkWhatsApp(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** Total de unidades no orçamento. */
export function totalUnidades(itens) {
  return (itens || []).reduce((soma, i) => soma + qtdValida(i.qtd), 0);
}
