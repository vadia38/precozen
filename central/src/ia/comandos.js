// Comandos do módulo ia: status, testar, limpar-cache.
import { disponibilidade, gerar, limparCache, PADRAO_IA } from './cliente.js';
import { log } from '../core/log.js';

export const comandos = {
  status: {
    descricao: 'Mostra se o SDK do Claude está instalado, se há credencial e qual modelo será usado',
    async executar(args, { config }) {
      const d = disponibilidade();
      const cfg = { ...PADRAO_IA, ...(config.ia || {}) };
      log.info(`SDK @anthropic-ai/sdk: ${d.sdk ? 'instalado' : 'NÃO instalado (rode npm install em central/)'}`);
      log.info(`Credencial (ANTHROPIC_API_KEY): ${d.credencial ? 'presente' : 'ausente (central/.env) — o SDK também aceita perfil do `ant auth login`'}`);
      log.info(`Modelo: ${cfg.modelo} · esforço ${cfg.esforco} · max_tokens ${cfg.maxTokens} · cache ${cfg.cache ? 'ligado' : 'desligado'} · fallbacks ${cfg.fallbacks ? 'ligados' : 'desligados'}`);
      return { resumo: d.sdk && d.credencial ? 'IA pronta' : 'IA em modo template (sem SDK ou credencial)' };
    },
  },
  testar: {
    descricao: 'Faz uma chamada curta ao Claude e mostra modelo, tokens e a resposta',
    opcoes: { forcar: 'ignora o cache' },
    async executar(args, { config }) {
      const r = await gerar({ sistema: 'Responda em português do Brasil, em uma frase.', usuario: 'Diga que a integração do Precozen Central com o Claude está funcionando.', config, maxTokens: 300, forcar: Boolean(args.forcar) });
      log.info(r.texto);
      return { resumo: `modelo ${r.modelo} · entrada ${r.uso?.input_tokens ?? '?'} · saída ${r.uso?.output_tokens ?? '?'} tokens${r.cache ? ' · (cache)' : ''}` };
    },
  },
  'limpar-cache': {
    descricao: 'Apaga as respostas de IA guardadas em workspace/ia-cache',
    async executar() {
      const n = limparCache();
      return { resumo: `${n} respostas removidas do cache` };
    },
  },
};
