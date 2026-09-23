// Leitura e escrita de CSV sem dependências: separador automático (; , ou tab), aspas, BOM e quebras dentro de campos.
import { normalizar } from './util.js';

export function detectarSeparador(texto) {
  const primeira = String(texto).split(/\r?\n/).find((l) => l.trim()) || '';
  const contagem = { ';': 0, ',': 0, '\t': 0 };
  let dentro = false;
  for (const c of primeira) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && c in contagem) contagem[c]++;
  }
  return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0] : ';';
}

/** Converte CSV em linhas (arrays de strings). */
export function lerLinhasCsv(texto, separador) {
  const t = String(texto ?? '').replace(/^﻿/, '');
  const sep = separador || detectarSeparador(t);
  const linhas = [];
  let linha = [];
  let campo = '';
  let dentro = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else dentro = false;
      } else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((v) => v.trim() !== '')) linhas.push(linha); }
  return linhas;
}

/** Normaliza cabeçalho: "Preço (R$)" -> "preco_r". */
export function chaveColuna(nome) {
  return normalizar(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Converte CSV em objetos, com cabeçalho normalizado. */
export function lerCsv(texto, { separador } = {}) {
  const linhas = lerLinhasCsv(texto, separador);
  if (!linhas.length) return [];
  const cabecalho = linhas[0].map(chaveColuna);
  return linhas.slice(1).map((l) => {
    const o = {};
    cabecalho.forEach((k, i) => { if (k) o[k] = (l[i] ?? '').trim(); });
    return o;
  });
}

function escaparCampo(v, sep) {
  const s = String(v ?? '');
  return new RegExp(`[${sep === '\t' ? '\\t' : sep}"\\n\\r]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializa objetos em CSV (com BOM para abrir direto no Excel em pt-BR). */
export function paraCsv(itens, colunas, { separador = ';', bom = true } = {}) {
  const cols = colunas || [...new Set(itens.flatMap((it) => Object.keys(it)))];
  const cab = cols.map((c) => (typeof c === 'string' ? c : c.rotulo));
  const chaves = cols.map((c) => (typeof c === 'string' ? c : c.chave));
  const linhas = itens.map((it) => chaves.map((k) => escaparCampo(typeof k === 'function' ? k(it) : it[k], separador)).join(separador));
  return `${bom ? '﻿' : ''}${cab.map((c) => escaparCampo(c, separador)).join(separador)}\n${linhas.join('\n')}\n`;
}
