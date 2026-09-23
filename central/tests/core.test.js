import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, slug, escapeHtml, truncar, paraNumero, lista, quebrarLinhas, idCurto, ordenarPor, formatarMoeda, urlSegura, dataExtenso } from '../src/core/util.js';
import { lerCsv, paraCsv, detectarSeparador } from '../src/core/csv.js';
import { criarRng } from '../src/core/rng.js';
import { serializar, analisar } from '../src/core/frontmatter.js';
import { lerArgs, opcao } from '../src/core/cli.js';
import { caminhoSeguro, nomeSeguro } from '../src/core/arquivos.js';
import { carregarConfig, validarConfig } from '../src/core/config.js';

test('util: texto, números e listas', () => {
  assert.equal(normalizar('  Máquina  de Vidro '), 'maquina de vidro');
  assert.equal(slug('Fritadeira Elétrica 5,5 L (2026)'), 'fritadeira-eletrica-5-5-l-2026');
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(truncar('abcdefghij', 6), 'abcde…');
  assert.equal(paraNumero('R$ 1.234,56'), 1234.56);
  assert.equal(paraNumero('99.90'), 99.9);
  assert.equal(paraNumero('1,299'), 1.299);
  assert.equal(paraNumero('abc'), null);
  assert.deepEqual(lista('a; b;c'), ['a', 'b', 'c']);
  assert.deepEqual(lista('cesto de 5,5 L; leve'), ['cesto de 5,5 L', 'leve']);
  assert.deepEqual(lista('a, b'), ['a', 'b']);
  assert.deepEqual(quebrarLinhas('um dois tres quatro', 8), ['um dois', 'tres', 'quatro']);
  assert.equal(idCurto('x'), idCurto('x'));
  assert.notEqual(idCurto('x'), idCurto('y'));
  assert.deepEqual(ordenarPor([{ a: 1, b: 'z' }, { a: 3, b: 'a' }, { a: 3, b: 'b' }], ['-a', 'b']).map((x) => `${x.a}${x.b}`), ['3a', '3b', '1z']);
  assert.match(formatarMoeda(1234.5), /R\$\s?1\.234,50/);
  assert.equal(urlSegura('javascript:alert(1)'), null);
  assert.equal(urlSegura('https://exemplo.com/x?y=1'), 'https://exemplo.com/x?y=1');
  assert.equal(dataExtenso('2026-09-23'), '23 de setembro de 2026');
});

test('csv: separador automático, aspas e ida e volta', () => {
  assert.equal(detectarSeparador('a;b;c\n1;2;3'), ';');
  assert.equal(detectarSeparador('a,b,c\n1,2,3'), ',');
  const linhas = lerCsv('﻿Nome;Preço (R$);Obs\n"Fone; bom";"1.299,90";"diz ""oi""\nquebra"\n');
  assert.deepEqual(linhas, [{ nome: 'Fone; bom', preco_r: '1.299,90', obs: 'diz "oi"\nquebra' }]);
  const csv = paraCsv([{ a: 'x;y', b: 2 }], ['a', 'b']);
  assert.equal(csv, '﻿a;b\n"x;y";2\n');
  assert.deepEqual(lerCsv(csv), [{ a: 'x;y', b: '2' }]);
});

test('rng determinístico', () => {
  const a = criarRng('semente'); const b = criarRng('semente');
  assert.deepEqual([a.proximo(), a.inteiro(1, 6), a.escolher(['x', 'y'])], [b.proximo(), b.inteiro(1, 6), b.escolher(['x', 'y'])]);
  const emb = criarRng(7).embaralhar([1, 2, 3, 4, 5]);
  assert.deepEqual([...emb].sort(), [1, 2, 3, 4, 5]);
});

test('front matter: serializa e lê listas, números e JSON', () => {
  const txt = serializar({ titulo: 'Olá: mundo', nota: 9.5, tags: ['a', 'b'], contras: ['x, y', 'z'], vazio: '' }, '# Corpo\n\ntexto');
  const { meta, corpo } = analisar(txt);
  assert.equal(meta.titulo, 'Olá: mundo');
  assert.equal(meta.nota, 9.5);
  assert.deepEqual(meta.tags, ['a', 'b']);
  assert.deepEqual(meta.contras, ['x, y', 'z']);
  assert.equal(meta.vazio, undefined);
  assert.equal(corpo, '# Corpo\n\ntexto');
});

test('cli: argumentos e opções', () => {
  const args = lerArgs(['afiliados', 'importar', '--arquivo', 'x.csv', '--top=5', '--forcar', '--no-capa', '--min-score', '60', '--id', 'a', '--id', 'b']);
  assert.deepEqual(args._, ['afiliados', 'importar']);
  assert.equal(args.arquivo, 'x.csv');
  assert.equal(args.top, '5');
  assert.equal(args.forcar, true);
  assert.equal(args.capa, false);
  assert.equal(opcao(args, 'minScore', 0, 'numero'), 60);
  assert.deepEqual(opcao(args, 'id', null, 'lista'), ['a', 'b']);
  assert.throws(() => opcao({ top: 'x' }, 'top', 0, 'inteiro'));
});

test('arquivos: caminhos seguros', () => {
  assert.throws(() => caminhoSeguro('/base', '..', 'etc'));
  assert.equal(nomeSeguro('Caça-palavras: Animais/2026'), 'Caca-palavras-Animais-2026');
});

test('config: carrega e valida', () => {
  const cfg = carregarConfig();
  assert.equal(cfg.marca.nome, 'Precozen');
  assert.equal(validarConfig(cfg).length, 0);
  const ruim = JSON.parse(JSON.stringify(cfg));
  ruim.afiliados.pontuacao.pesos.comissao = 0.9;
  ruim.marca.url = 'javascript:x';
  assert.ok(validarConfig(ruim).length >= 2);
});
