// Front matter simples (chave: valor por linha; listas separadas por vírgula; JSON para objetos) + corpo Markdown.

export function serializar(meta, corpo) {
  const linhas = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) linhas.push(v.some((x) => /[,\[\]{}]/.test(String(x))) ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v.join(', ')}`);
    else if (typeof v === 'object') linhas.push(`${k}: ${JSON.stringify(v)}`);
    else linhas.push(`${k}: ${String(v).replace(/\r?\n/g, ' ')}`);
  }
  linhas.push('---', '', String(corpo ?? '').trim(), '');
  return linhas.join('\n');
}

const CAMPOS_LISTA = new Set(['tags', 'palavrasChave', 'produtos', 'pros', 'contras']);
const CAMPOS_NUMERO = new Set(['nota', 'preco', 'precoAntigo', 'avaliacao', 'numAvaliacoes', 'ordem', 'score']);

export function analisar(texto) {
  const t = String(texto ?? '').replace(/^﻿/, '');
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, corpo: t.trim() };
  const meta = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const mm = linha.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!mm) continue;
    const [, k, vBruto] = mm;
    const v = vBruto.trim();
    if (v.startsWith('{') || v.startsWith('[')) { try { meta[k] = JSON.parse(v); continue; } catch { /* segue como texto */ } }
    if (CAMPOS_LISTA.has(k)) meta[k] = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
    else if (CAMPOS_NUMERO.has(k)) { const n = Number(v.replace(',', '.')); meta[k] = Number.isFinite(n) ? n : v; }
    else if (v === 'true' || v === 'false') meta[k] = v === 'true';
    else meta[k] = v;
  }
  return { meta, corpo: m[2].trim() };
}
