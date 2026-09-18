#!/usr/bin/env node
// Valida data/*.json e site.config.json sem gerar o site. Sai com código 1 se houver erros.
import { carregarDados, validarDados } from '../src/lib/data.js';

try {
  const dados = carregarDados({ validar: false });
  const erros = validarDados(dados);
  if (erros.length) {
    console.error(`✖ ${erros.length} problema(s):`);
    for (const e of erros) console.error(`  - ${e}`);
    process.exit(1);
  }
  const semFoto = dados.produtos.filter((p) => !p.imagem).length;
  const semMontadora = dados.produtos.filter((p) => !p.montadoras.length && ['botoes', 'maquinas-de-vidro', 'chicotes'].includes(p.categoria)).map((p) => p.codigo);
  console.log(`✔ ${dados.produtos.length} produtos, ${dados.categorias.length} categorias, ${dados.montadoras.length} montadoras.`);
  for (const c of dados.categorias) console.log(`  ${String(c.numero).padStart(2, '0')} ${c.nome.padEnd(22)} ${String(c.total).padStart(4)}`);
  if (semFoto) console.log(`  aviso: ${semFoto} produto(s) sem foto`);
  if (semMontadora.length) console.log(`  aviso: sem montadora identificada em botões/máquinas/chicotes: ${semMontadora.join(', ')}`);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
