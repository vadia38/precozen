// Leitura de argumentos e ajuda dos comandos. Formato: precozen <modulo> <comando> [--opcao valor] [--flag]
export function lerArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { args._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const igual = a.indexOf('=');
      let chave = igual > 0 ? a.slice(2, igual) : a.slice(2);
      let valor;
      if (igual > 0) valor = a.slice(igual + 1);
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) valor = argv[++i];
      else valor = true;
      if (chave.startsWith('no-') && valor === true) { chave = chave.slice(3); valor = false; }
      chave = chave.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      if (args[chave] !== undefined && args[chave] !== true) args[chave] = [].concat(args[chave], valor);
      else args[chave] = valor;
    } else args._.push(a);
  }
  return args;
}

/** Converte valores de opção: número, lista ou texto, com padrão. */
export function opcao(args, nome, padrao, tipo = 'texto') {
  const v = args[nome];
  if (v === undefined || v === true && tipo !== 'flag') return padrao;
  if (tipo === 'flag') return Boolean(v);
  if (tipo === 'numero') { const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n)) throw new Error(`--${nome} deve ser numérico`); return n; }
  if (tipo === 'inteiro') { const n = Number(v); if (!Number.isInteger(n)) throw new Error(`--${nome} deve ser inteiro`); return n; }
  if (tipo === 'lista') return [].concat(v).flatMap((x) => String(x).split(/[,;]/)).map((x) => x.trim()).filter(Boolean);
  return Array.isArray(v) ? v[v.length - 1] : String(v);
}

/** Texto de ajuda de um módulo a partir do seu mapa de comandos. */
export function ajudaModulo(nomeModulo, comandos) {
  const linhas = [`Uso: precozen ${nomeModulo} <comando> [opções]\n`, 'Comandos:'];
  for (const [nome, c] of Object.entries(comandos)) {
    linhas.push(`  ${nome.padEnd(16)} ${c.descricao}`);
    for (const [op, desc] of Object.entries(c.opcoes || {})) linhas.push(`      --${op.padEnd(18)} ${desc}`);
  }
  return linhas.join('\n');
}
