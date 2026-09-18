import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, tokens, tokensCompactos, compactar, slug, escapeHtml, juntarUrl, plural, codigoValido, truncar } from '../public/js/lib/util.js';

test('normalizar remove acentos, caixa e espaços extras', () => {
  assert.equal(normalizar('  Máq. Vidro   Gol  '), 'maq. vidro gol');
  assert.equal(normalizar('ÂMBAR'), 'ambar');
  assert.equal(normalizar(null), '');
});

test('tokens e tokensCompactos', () => {
  assert.deepEqual(tokens('T-Cross 2P/Polo'), ['t', 'cross', '2p', 'polo']);
  assert.deepEqual(tokensCompactos('T-Cross CR-V HB20/HB20S'), ['tcross', 'crv', 'hb20', 'hb20s']);
  assert.equal(compactar('FA01-A43 '), 'fa01a43');
});

test('slug e escapeHtml', () => {
  assert.equal(slug('Máquinas de vidro — lado direito'), 'maquinas-de-vidro-lado-direito');
  assert.equal(escapeHtml('Palheta 19" <b>&</b> \'x\''), 'Palheta 19&quot; &lt;b&gt;&amp;&lt;/b&gt; &#39;x&#39;');
});

test('juntarUrl e plural', () => {
  assert.equal(juntarUrl('https://site.com/', '/base/', 'produto/64041/'), 'https://site.com/base/produto/64041');
  assert.equal(plural(1, 'produto', 'produtos'), '1 produto');
  assert.equal(plural(12, 'produto', 'produtos'), '12 produtos');
});

test('codigoValido aceita códigos do catálogo e rejeita lixo', () => {
  for (const c of ['64041', '640113', '66025-3', '61008-1']) assert.ok(codigoValido(c), c);
  for (const c of ['', 'abc', '64041<script>', '1', '../etc', '64041 ']) assert.ok(!codigoValido(c), c);
});

test('truncar respeita o limite', () => {
  assert.equal(truncar('abc', 10), 'abc');
  assert.equal(truncar('a'.repeat(20), 10).length, 10);
});
