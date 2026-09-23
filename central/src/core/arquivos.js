// Caminhos do sistema, pasta de trabalho e escrita segura de arquivos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_CENTRAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAIZ_REPO = path.resolve(RAIZ_CENTRAL, '..');

/** Pasta de trabalho (saídas geradas). Pode ser trocada por PRECOZEN_WORKSPACE. */
export function workspace(...partes) {
  const base = process.env.PRECOZEN_WORKSPACE ? path.resolve(process.env.PRECOZEN_WORKSPACE) : path.join(RAIZ_CENTRAL, 'workspace');
  return partes.length ? caminhoSeguro(base, ...partes) : base;
}

/** Resolve um caminho dentro de `base`, recusando saídas por ".." ou caminhos absolutos. */
export function caminhoSeguro(base, ...partes) {
  const alvo = path.resolve(base, ...partes.map((p) => String(p)));
  const rel = path.relative(base, alvo);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`caminho fora da pasta permitida: ${partes.join('/')}`);
  return alvo;
}

/** Nome de arquivo seguro (sem separadores nem caracteres de controle). */
export function nomeSeguro(nome, padrao = 'arquivo') {
  const n = String(nome ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return n || padrao;
}

export function garantirDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function existe(p) {
  return fs.existsSync(p);
}

export function lerTexto(p) {
  return fs.readFileSync(p, 'utf8');
}

export function lerJson(p, padrao) {
  if (!fs.existsSync(p)) {
    if (padrao !== undefined) return padrao;
    throw new Error(`arquivo não encontrado: ${p}`);
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`JSON inválido em ${p}: ${e.message}`);
  }
}

/** Escrita atômica: grava em arquivo temporário e renomeia. */
export function gravarTexto(p, conteudo) {
  garantirDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, conteudo);
  fs.renameSync(tmp, p);
  return p;
}

export function gravarJson(p, dados) {
  return gravarTexto(p, `${JSON.stringify(dados, null, 2)}\n`);
}

export function gravarBinario(p, buffer) {
  garantirDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, p);
  return p;
}

export function listarArquivos(dir, filtro) {
  const saida = [];
  if (!fs.existsSync(dir)) return saida;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) saida.push(...listarArquivos(p, filtro));
    else if (!filtro || filtro(p)) saida.push(p);
  }
  return saida.sort();
}

export function copiarDir(origem, destino) {
  if (!fs.existsSync(origem)) return;
  fs.cpSync(origem, destino, { recursive: true });
}

export function limparDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/** Lê um arquivo de dados por extensão (.json ou .csv). */
export function lerDados(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.json') return lerJson(p);
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') return { csv: lerTexto(p) };
  throw new Error(`formato não suportado: ${ext} (use .csv ou .json)`);
}
