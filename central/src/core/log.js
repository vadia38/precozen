// Saída no terminal com cores opcionais (respeita NO_COLOR e --silencioso).
const cor = (c) => (t) => (process.env.NO_COLOR || !process.stdout.isTTY ? String(t) : `\x1b[${c}m${t}\x1b[0m`);
export const cores = { verde: cor(32), amarelo: cor(33), vermelho: cor(31), azul: cor(36), cinza: cor(90), negrito: cor(1) };

let silencioso = false;
export function definirSilencioso(v) { silencioso = Boolean(v); }

export const log = {
  info: (...a) => { if (!silencioso) console.log(...a); },
  ok: (...a) => { if (!silencioso) console.log(cores.verde('✔'), ...a); },
  aviso: (...a) => console.warn(cores.amarelo('!'), ...a),
  erro: (...a) => console.error(cores.vermelho('✖'), ...a),
  passo: (...a) => { if (!silencioso) console.log(cores.azul('→'), ...a); },
  titulo: (t) => { if (!silencioso) console.log(`\n${cores.negrito(t)}`); },
};

/** Tabela simples no terminal. colunas: [{chave, rotulo, largura?, alinhar?: 'direita'}] */
export function tabela(linhas, colunas) {
  if (silencioso) return;
  const larguras = colunas.map((c) => Math.max(c.rotulo.length, ...linhas.map((l) => String(fmt(l, c)).length), c.largura || 0));
  const sep = larguras.map((w) => '─'.repeat(w)).join('─┼─');
  const cab = colunas.map((c, i) => c.rotulo.padEnd(larguras[i])).join(' │ ');
  console.log(cab); console.log(sep);
  for (const l of linhas) console.log(colunas.map((c, i) => (c.alinhar === 'direita' ? String(fmt(l, c)).padStart(larguras[i]) : String(fmt(l, c)).padEnd(larguras[i]))).join(' │ '));
}
function fmt(l, c) { const v = typeof c.chave === 'function' ? c.chave(l) : l[c.chave]; return v === undefined || v === null ? '' : v; }
