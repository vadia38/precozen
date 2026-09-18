import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarIndice, buscar, pontuar, sugerir } from '../public/js/lib/busca.js';

const produtos = [
  { codigo: '64041', ref: 'FA01A43', nome: 'Botão de vidro Uno simples 96/97 - Âmbar', categoria: 'botoes', categoriaNome: 'Botões', subgrupo: 'fiat', subgrupoNome: 'Fiat', ordem: 1, montadoras: ['fiat'], montadorasNome: ['Fiat'], modelos: ['Uno'], atributos: { cor: 'Âmbar', tipo: 'Simples' }, tags: [] },
  { codigo: '64001', ref: 'FA01A44', nome: 'Botão de vidro Uno duplo 96/97 - Âmbar', categoria: 'botoes', categoriaNome: 'Botões', subgrupo: 'fiat', subgrupoNome: 'Fiat', ordem: 2, montadoras: ['fiat'], montadorasNome: ['Fiat'], modelos: ['Uno'], atributos: { cor: 'Âmbar', tipo: 'Duplo' }, tags: [] },
  { codigo: '66025-3', ref: 'VW008', nome: 'Máq. vidro Gol 2P G5 esquerdo sem motor', categoria: 'maquinas-de-vidro', categoriaNome: 'Máquinas de vidro', subgrupo: null, subgrupoNome: null, ordem: 3, montadoras: ['vw'], montadorasNome: ['Volkswagen'], modelos: ['Gol'], atributos: { lado: 'Esquerdo', portas: '2 portas', motor: 'Sem motor' }, tags: [] },
  { codigo: '66025-2', ref: 'VW008', nome: 'Máq. vidro Gol 2P G5 direito sem motor', categoria: 'maquinas-de-vidro', categoriaNome: 'Máquinas de vidro', subgrupo: null, subgrupoNome: null, ordem: 4, montadoras: ['vw'], montadorasNome: ['Volkswagen'], modelos: ['Gol'], atributos: { lado: 'Direito', portas: '2 portas', motor: 'Sem motor' }, tags: [] },
  { codigo: '61056', ref: null, nome: 'Lâmpada LED H4 6000K 14000 LM', categoria: 'led', categoriaNome: 'LED', subgrupo: null, subgrupoNome: null, ordem: 5, montadoras: [], montadorasNome: [], modelos: [], atributos: { temperaturaCor: '6000K' }, tags: [] },
];
const indice = criarIndice(produtos);

test('código exato vem primeiro; prefixo de código encontra variações', () => {
  assert.equal(buscar(indice, '66025-3')[0].codigo, '66025-3');
  const porPrefixo = buscar(indice, '66025').map((p) => p.codigo);
  assert.deepEqual(porPrefixo.sort(), ['66025-2', '66025-3']);
});

test('referência é encontrada com ou sem hífen e em caixa baixa', () => {
  assert.equal(buscar(indice, 'fa01a43')[0].codigo, '64041');
  assert.equal(buscar(indice, 'FA01-A43')[0].codigo, '64041');
  assert.equal(buscar(indice, 'vw008').length, 2);
});

test('texto exige todos os termos e ignora acentos', () => {
  const r = buscar(indice, 'botao uno ambar').map((p) => p.codigo);
  assert.deepEqual(r.sort(), ['64001', '64041']);
  assert.deepEqual(buscar(indice, 'gol esquerdo').map((p) => p.codigo), ['66025-3']);
  assert.deepEqual(buscar(indice, 'volkswagen').map((p) => p.codigo).sort(), ['66025-2', '66025-3']);
  assert.equal(buscar(indice, 'xyz inexistente').length, 0);
});

test('filtros de categoria, subgrupo e montadora', () => {
  assert.equal(buscar(indice, '', { categoria: 'botoes' }).length, 2);
  assert.equal(buscar(indice, '', { montadora: 'vw' }).length, 2);
  assert.equal(buscar(indice, '', { categoria: 'botoes', subgrupo: 'fiat' }).length, 2);
  assert.equal(buscar(indice, 'gol', { categoria: 'botoes' }).length, 0);
});

test('ordenações', () => {
  assert.deepEqual(buscar(indice, '', { ordem: 'catalogo' }).map((p) => p.ordem), [1, 2, 3, 4, 5]);
  const nomes = buscar(indice, '', { ordem: 'nome' }).map((p) => p.nome);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
  assert.equal(buscar(indice, '', { ordem: 'codigo' })[0].codigo, '61056');
});

test('pontuar e sugerir', () => {
  assert.equal(pontuar(indice[0], '64041'), 1000);
  assert.equal(pontuar(indice[0], 'nada a ver'), -1);
  assert.equal(sugerir(indice, 'led h4', 3)[0].codigo, '61056');
  assert.deepEqual(sugerir(indice, '   '), []);
});
