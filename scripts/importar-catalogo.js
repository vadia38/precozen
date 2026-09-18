#!/usr/bin/env node
/**
 * Importa/atualiza data/produtos.json a partir de um CSV exportado do painel (ou de uma planilha).
 *
 * Uso:
 *   node scripts/importar-catalogo.js --csv produtos.csv [--imagens pasta/] [--substituir] [--dry-run]
 *
 * Colunas reconhecidas (nomes flexíveis, sem diferenciar maiúsculas/acentos):
 *   codigo|código|sku|id          obrigatório
 *   nome|descricao|descrição|titulo obrigatório
 *   ref|referencia|referência       opcional
 *   categoria|cat|cat_id            id, alias ou nome da categoria (data/categorias.json)
 *   subcategoria|subgrupo|montadora|sub_id  opcional (id ou nome do subgrupo da categoria)
 *   imagem|foto|arquivo             opcional; nome do arquivo em --imagens (padrão: <codigo>.jpg)
 *   pagina|pagina_pdf               opcional
 *   ativo                           "0", "nao", "não" ou "false" remove o item da lista
 *
 * Comportamento: por padrão faz merge — atualiza itens existentes, acrescenta novos e mantém a ordem.
 * Com --substituir, a lista passa a ser exatamente o conteúdo do CSV (na ordem do arquivo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../src/lib/data.js';
import { normalizar, codigoValido } from '../public/js/lib/util.js';
import { lerArgs } from '../src/build.js';

const ALIASES = {
  codigo: ['codigo', 'código', 'sku', 'id', 'cod'],
  nome: ['nome', 'descricao', 'descrição', 'titulo', 'título', 'produto', 'name'],
  ref: ['ref', 'referencia', 'referência', 'reference'],
  categoria: ['categoria', 'cat', 'cat_id', 'category'],
  subgrupo: ['subcategoria', 'subgrupo', 'montadora', 'sub_id', 'sub'],
  imagem: ['imagem', 'foto', 'arquivo', 'image'],
  pagina: ['pagina', 'página', 'pagina_pdf', 'page'],
  ativo: ['ativo', 'enviar', 'active'],
};

export function parseCsv(texto) {
  const t = texto.replace(/^﻿/, '');
  const primeiraLinha = t.split(/\r?\n/)[0] || '';
  const sep = (primeiraLinha.match(/;/g) || []).length >= (primeiraLinha.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  const naoVazias = linhas.filter((l) => l.some((c) => c.trim() !== ''));
  if (!naoVazias.length) return [];
  const cabecalho = naoVazias[0].map((c) => normalizar(c));
  return naoVazias.slice(1).map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] ?? '').trim()])));
}

function coluna(linha, chave) {
  for (const a of ALIASES[chave]) if (linha[normalizar(a)] !== undefined && linha[normalizar(a)] !== '') return linha[normalizar(a)];
  return '';
}

/** Lê largura/altura de JPEG ou PNG sem dependências. */
export function dimensoesImagem(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if ([0xc0, 0xc1, 0xc2].includes(m)) return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

export function importar({ csv, imagens, substituir = false, dryRun = false, raiz = RAIZ }) {
  const categorias = JSON.parse(fs.readFileSync(path.join(raiz, 'data/categorias.json'), 'utf8'));
  const arquivoProdutos = path.join(raiz, 'data/produtos.json');
  const atuais = fs.existsSync(arquivoProdutos) ? JSON.parse(fs.readFileSync(arquivoProdutos, 'utf8')) : [];
  const porCodigo = new Map(atuais.map((p) => [p.codigo, p]));
  const dirImg = path.join(raiz, 'public/img/produtos');
  const erros = [], avisos = [];
  const resolverCategoria = (v) => {
    const n = normalizar(v);
    return categorias.find((c) => c.id === n || (c.alias || []).includes(n) || normalizar(c.nome) === n || String(c.numero) === n);
  };
  const resolverSub = (cat, v) => {
    if (!v || !cat.subgrupos) return null;
    const n = normalizar(v);
    return cat.subgrupos.find((s) => s.id === n || normalizar(s.nome) === n || normalizar(s.nome).split(' / ').includes(n)) || null;
  };

  const linhas = parseCsv(fs.readFileSync(csv, 'utf8'));
  const resultado = [];
  const vistos = new Set();
  let novos = 0, atualizados = 0, removidos = 0, fotosCopiadas = 0;
  for (const [i, l] of linhas.entries()) {
    const codigo = coluna(l, 'codigo');
    const nome = coluna(l, 'nome');
    const ativo = coluna(l, 'ativo');
    if (!codigoValido(codigo)) { erros.push(`linha ${i + 2}: código inválido "${codigo}"`); continue; }
    if (vistos.has(codigo)) { erros.push(`linha ${i + 2}: código repetido ${codigo}`); continue; }
    vistos.add(codigo);
    if (['0', 'nao', 'não', 'false', 'n'].includes(normalizar(ativo))) { if (porCodigo.has(codigo)) removidos++; continue; }
    if (!nome) { erros.push(`linha ${i + 2}: ${codigo} sem nome`); continue; }
    const existente = porCodigo.get(codigo);
    const cat = coluna(l, 'categoria') ? resolverCategoria(coluna(l, 'categoria')) : categorias.find((c) => c.id === existente?.categoria);
    if (!cat) { erros.push(`linha ${i + 2}: ${codigo} com categoria desconhecida "${coluna(l, 'categoria')}"`); continue; }
    const sub = coluna(l, 'subgrupo') ? resolverSub(cat, coluna(l, 'subgrupo')) : (cat.subgrupos ? cat.subgrupos.find((s) => s.id === existente?.subgrupo) : null);
    if (coluna(l, 'subgrupo') && !sub) avisos.push(`${codigo}: subgrupo "${coluna(l, 'subgrupo')}" não existe em ${cat.id}; ignorado`);

    let imagem = existente?.imagem || null;
    const nomeImgBruto = path.basename(coluna(l, 'imagem') || `${codigo}.jpg`);
    const nomeImg = /^[a-zA-Z0-9._-]+$/.test(nomeImgBruto) ? nomeImgBruto : `${codigo}.jpg`;
    if (imagens) {
      const candidatos = [nomeImg, `${codigo}.jpg`, `${codigo}.jpeg`, `${codigo}.png`].map((n) => path.join(imagens, n));
      const origem = candidatos.find((c) => fs.existsSync(c));
      if (origem) {
        const buf = fs.readFileSync(origem);
        const dim = dimensoesImagem(buf);
        if (!dim) avisos.push(`${codigo}: imagem ${path.basename(origem)} não é JPEG/PNG válido`);
        else {
          const destino = `${codigo}${path.extname(origem).toLowerCase() === '.png' ? '.png' : '.jpg'}`;
          if (!dryRun) fs.writeFileSync(path.join(dirImg, destino), buf);
          imagem = { arquivo: destino, largura: dim.largura, altura: dim.altura };
          fotosCopiadas++;
        }
      }
    }
    if (!imagem) avisos.push(`${codigo}: sem foto`);
    const pagina = Number(coluna(l, 'pagina')) || existente?.pagina || null;
    const item = { codigo, ref: coluna(l, 'ref') || null, nome, categoria: cat.id, subgrupo: sub?.id || null, pagina, ordem: existente?.ordem ?? null, imagem };
    if (existente) { if (JSON.stringify({ ...existente, ordem: null }) !== JSON.stringify({ ...item, ordem: null })) atualizados++; } else novos++;
    resultado.push(item);
  }
  if (erros.length) return { ok: false, erros, avisos };

  let finais;
  if (substituir) finais = resultado;
  else {
    const mapaNovo = new Map(resultado.map((p) => [p.codigo, p]));
    finais = atuais.filter((p) => !(vistos.has(p.codigo) && !mapaNovo.has(p.codigo))).map((p) => mapaNovo.get(p.codigo) || p);
    for (const p of resultado) if (!porCodigo.has(p.codigo)) finais.push(p);
  }
  finais.forEach((p, i) => { p.ordem = i + 1; });
  if (!dryRun) fs.writeFileSync(arquivoProdutos, JSON.stringify(finais, null, 1));
  return { ok: true, erros, avisos, novos, atualizados, removidos, fotosCopiadas, total: finais.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = lerArgs(process.argv.slice(2));
  if (!args.csv) { console.error('Informe --csv arquivo.csv'); process.exit(2); }
  const r = importar({ csv: args.csv, imagens: args.imagens, substituir: Boolean(args.substituir), dryRun: Boolean(args['dry-run']) });
  for (const a of r.avisos) console.warn(`aviso: ${a}`);
  if (!r.ok) { for (const e of r.erros) console.error(`erro: ${e}`); process.exit(1); }
  console.log(`${args['dry-run'] ? '[simulação] ' : ''}✔ ${r.total} produtos · ${r.novos} novos · ${r.atualizados} atualizados · ${r.removidos} removidos · ${r.fotosCopiadas} fotos copiadas`);
  console.log('Agora rode: npm run validar && npm run build');
}
