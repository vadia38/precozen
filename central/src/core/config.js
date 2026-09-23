// Configuração central: precozen.config.json + variáveis de ambiente (.env) + validação.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_CENTRAL, lerJson } from './arquivos.js';

let carregouEnv = false;

/** Carrega central/.env (sem sobrescrever variáveis já definidas). */
export function carregarEnv(arquivo = path.join(RAIZ_CENTRAL, '.env')) {
  if (carregouEnv) return;
  carregouEnv = true;
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

/** Lê um segredo do ambiente. Lança erro amigável se obrigatório e ausente. */
export function segredo(nome, { obrigatorio = false } = {}) {
  carregarEnv();
  const v = process.env[nome];
  if (!v && obrigatorio) throw new Error(`variável ${nome} não definida (veja central/.env.example)`);
  return v || '';
}

function mesclar(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra) || typeof base !== 'object' || typeof extra !== 'object' || !base || !extra) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) out[k] = mesclar(base[k], v);
  return out;
}

export function validarConfig(cfg) {
  const erros = [];
  if (!cfg.marca?.nome) erros.push('marca.nome é obrigatório');
  if (!/^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(String(cfg.marca?.url || '').replace(/\/+$/, ''))) erros.push('marca.url deve ser uma URL http(s) simples (ex.: https://precozen.com.br)');
  if (!/^\/([a-zA-Z0-9_-]+\/)*$/.test(cfg.marca?.basePath || '/')) erros.push('marca.basePath deve começar e terminar com "/"');
  if (!/^#[0-9a-fA-F]{6}$/.test(cfg.marca?.tema?.corPrimaria || '')) erros.push('marca.tema.corPrimaria deve ser #RRGGBB');
  if (!/^#[0-9a-fA-F]{6}$/.test(cfg.marca?.tema?.corAcento || '')) erros.push('marca.tema.corAcento deve ser #RRGGBB');
  const pesos = cfg.afiliados?.pontuacao?.pesos || {};
  const somaPesos = Object.values(pesos).reduce((a, b) => a + Number(b || 0), 0);
  if (Math.abs(somaPesos - 1) > 0.001) erros.push(`afiliados.pontuacao.pesos deve somar 1 (soma ${somaPesos.toFixed(3)})`);
  for (const [id, p] of Object.entries(cfg.afiliados?.programas || {})) {
    if (!/^[a-z0-9-]+$/.test(id)) erros.push(`programa com id inválido: ${id}`);
    if (p.tag && !/^[a-zA-Z0-9-]+$/.test(p.tag)) erros.push(`tag do programa ${id} inválida`);
  }
  if (cfg.blog?.anuncios?.adsense && !/^ca-pub-\d+$/.test(cfg.blog.anuncios.adsense)) erros.push('blog.anuncios.adsense deve ser como ca-pub-1234567890');
  return erros;
}

/** Carrega a configuração (arquivo padrão ou PRECOZEN_CONFIG), aplica sobrescritas e valida. */
export function carregarConfig({ arquivo, sobrescritas } = {}) {
  carregarEnv();
  const caminho = arquivo || process.env.PRECOZEN_CONFIG || path.join(RAIZ_CENTRAL, 'precozen.config.json');
  const base = lerJson(caminho);
  const cfg = mesclar(base, sobrescritas || {});
  cfg.marca.url = String(cfg.marca.url).replace(/\/+$/, '');
  cfg.marca.basePath = cfg.marca.basePath || '/';
  const erros = validarConfig(cfg);
  if (erros.length) {
    const e = new Error(`configuração inválida (${caminho}):\n - ${erros.join('\n - ')}`);
    e.erros = erros;
    throw e;
  }
  cfg._arquivo = caminho;
  return cfg;
}
