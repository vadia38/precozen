// Cliente de IA (Claude) via SDK oficial carregado sob demanda: sem a dependência instalada, os comandos com --ia
// avisam como instalar e o restante do sistema segue funcionando em modo template.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { segredo } from '../core/config.js';
import { workspace, lerJson, gravarJson } from '../core/arquivos.js';
import { log } from '../core/log.js';

const require = createRequire(import.meta.url);

export const PADRAO_IA = { modelo: 'claude-opus-5', esforco: 'high', maxTokens: 16000, cache: true, fallbacks: true };

/** Diagnóstico rápido: SDK instalado? credencial presente? */
export function disponibilidade() {
  let sdk = false;
  try { require.resolve('@anthropic-ai/sdk'); sdk = true; } catch { sdk = false; }
  const credencial = Boolean(segredo('ANTHROPIC_API_KEY') || segredo('ANTHROPIC_AUTH_TOKEN'));
  return { sdk, credencial };
}

export async function carregarSdk() {
  try {
    const mod = await import('@anthropic-ai/sdk');
    return mod.default || mod.Anthropic || mod;
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (package|module)/.test(String(e.message))) {
      throw new Error('SDK do Claude não instalado. Rode `npm install` dentro de central/ (instala @anthropic-ai/sdk) e defina ANTHROPIC_API_KEY em central/.env');
    }
    throw e;
  }
}

function chaveCache(partes) {
  return crypto.createHash('sha256').update(JSON.stringify(partes)).digest('hex').slice(0, 32);
}

function traduzirErro(Anthropic, e) {
  if (Anthropic && e instanceof Anthropic.AuthenticationError) return new Error('credencial do Claude inválida ou ausente: defina ANTHROPIC_API_KEY em central/.env (ou faça `ant auth login`)');
  if (Anthropic && e instanceof Anthropic.RateLimitError) return new Error('limite de requisições do Claude atingido; aguarde e tente de novo');
  if (Anthropic && e instanceof Anthropic.APIError) return new Error(`erro da API do Claude (${e.status}): ${e.message}`);
  return e;
}

/**
 * Envia uma solicitação e devolve { texto, json, modelo, uso, cache }.
 * Com `esquema` (JSON Schema), a resposta é restrita ao formato e devolvida em `json`.
 */
export async function gerar({ sistema, usuario, esquema, config, maxTokens, esforco, forcar = false }) {
  const cfg = { ...PADRAO_IA, ...(config?.ia || {}) };
  const chave = chaveCache({ modelo: cfg.modelo, sistema, usuario, esquema });
  const arquivoCache = workspace('ia-cache', `${chave}.json`);
  if (cfg.cache && !forcar) {
    const guardado = lerJson(arquivoCache, null);
    if (guardado) return { ...guardado, cache: true };
  }
  const Anthropic = await carregarSdk();
  const cliente = new Anthropic();
  const params = {
    model: cfg.modelo,
    max_tokens: maxTokens || cfg.maxTokens,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: usuario }],
    thinking: { type: 'adaptive' },
    output_config: { effort: esforco || cfg.esforco, ...(esquema ? { format: { type: 'json_schema', schema: esquema } } : {}) },
  };
  let mensagem;
  try {
    mensagem = await enviar(cliente, params, cfg.fallbacks);
  } catch (e) {
    throw traduzirErro(Anthropic, e);
  }
  if (mensagem.stop_reason === 'refusal') throw new Error(`a IA recusou esta solicitação${mensagem.stop_details?.category ? ` (categoria ${mensagem.stop_details.category})` : ''}`);
  if (mensagem.stop_reason === 'max_tokens') throw new Error('resposta da IA cortada pelo limite de tokens; aumente ia.maxTokens em precozen.config.json');
  const texto = mensagem.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let json = null;
  if (esquema) {
    try { json = JSON.parse(texto); } catch { throw new Error('a IA não devolveu JSON válido; tente de novo'); }
  }
  const resultado = { texto, json, modelo: mensagem.model, uso: mensagem.usage, cache: false };
  if (cfg.cache) gravarJson(arquivoCache, resultado);
  return resultado;
}

/** Streaming com finalMessage(); com fallbacks do lado do servidor por padrão (beta) e retorno ao caminho simples se recusado. */
async function enviar(cliente, params, comFallbacks) {
  if (comFallbacks) {
    try {
      const stream = cliente.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
      return await stream.finalMessage();
    } catch (e) {
      const msg = String(e?.message || '');
      if (e?.status === 400 && /fallback|beta/i.test(msg)) log.aviso('fallbacks do servidor indisponíveis nesta conta; enviando sem eles');
      else throw e;
    }
  }
  const stream = cliente.messages.stream(params);
  return stream.finalMessage();
}

export function limparCache() {
  const fs = require('node:fs');
  const dir = workspace('ia-cache');
  let n = 0;
  if (fs.existsSync(dir)) { for (const f of fs.readdirSync(dir)) { fs.rmSync(`${dir}/${f}`); n++; } }
  return n;
}
