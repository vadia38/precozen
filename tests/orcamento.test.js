import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializarItens, parseItens, qtdValida, montarMensagem, linkWhatsApp, limparCliente, totalUnidades, QTD_MAXIMA } from '../public/js/lib/orcamento.js';

test('qtdValida limita a faixa', () => {
  assert.equal(qtdValida('3'), 3);
  assert.equal(qtdValida(0), 1);
  assert.equal(qtdValida('abc'), 1);
  assert.equal(qtdValida(99999), QTD_MAXIMA);
  assert.equal(qtdValida(2.6), 3);
});

test('serializar e parse são inversos e ignoram entradas inválidas', () => {
  const itens = [{ codigo: '64041', qtd: 2 }, { codigo: '66025-3', qtd: 1 }];
  const s = serializarItens(itens);
  assert.equal(s, '64041:2,66025-3:1');
  assert.deepEqual(parseItens(s), itens);
  assert.deepEqual(parseItens('lixo:1,64041:x,64041:5,<script>:2'), [{ codigo: '64041', qtd: 1 }]);
  assert.deepEqual(parseItens(''), []);
});

test('limparCliente remove quebras de linha e limita tamanho', () => {
  const c = limparCliente({ nome: ' João\nSilva ', empresa: 'x'.repeat(200), observacoes: 'linha 1\nlinha 2' });
  assert.equal(c.nome, 'João Silva');
  assert.equal(c.empresa.length, 80);
  assert.equal(c.observacoes, 'linha 1\nlinha 2');
});

test('montarMensagem inclui cabeçalho, itens numerados, ref e observações', () => {
  const texto = montarMensagem({
    itens: [{ codigo: '64041', nome: 'Botão de vidro Uno', ref: 'FA01A43', qtd: 2 }, { codigo: '61056', nome: 'Lâmpada LED H4', ref: null, qtd: 1 }],
    cliente: { nome: 'Maria', empresa: 'Auto Elétrica X', observacoes: 'Entrega urgente' },
    urlCompartilhar: 'https://exemplo.test/orcamento/?itens=64041:2,61056:1',
  });
  assert.match(texto, /^\*Orçamento — Catálogo Luretec\*/);
  assert.match(texto, /Cliente: Maria · Auto Elétrica X/);
  assert.match(texto, /1\. 64041 — Botão de vidro Uno \(REF\. FA01A43\) × 2/);
  assert.match(texto, /2\. 61056 — Lâmpada LED H4 × 1/);
  assert.match(texto, /Obs\.: Entrega urgente/);
  assert.match(texto, /Lista online: https:\/\/exemplo\.test/);
});

test('linkWhatsApp usa só dígitos e codifica o texto', () => {
  const link = linkWhatsApp('+55 (11) 97383-1508', 'Olá & tchau');
  assert.equal(link, 'https://wa.me/5511973831508?text=Ol%C3%A1%20%26%20tchau');
});

test('totalUnidades soma quantidades válidas', () => {
  assert.equal(totalUnidades([{ qtd: 2 }, { qtd: '3' }, { qtd: 0 }]), 6);
});
