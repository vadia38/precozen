import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { carregarDados, validarDados, extrairAtributos, detectarMontadoras, RAIZ } from '../src/lib/data.js';

const dados = carregarDados();

test('dataset carrega com 481 produtos e 11 categorias válidas', () => {
  assert.equal(dados.produtos.length, 481);
  assert.equal(dados.categorias.length, 11);
  assert.deepEqual(validarDados(dados), []);
  assert.ok(dados.montadoras.length >= 10);
});

test('todos os produtos têm foto existente e código único', () => {
  const codigos = new Set();
  for (const p of dados.produtos) {
    assert.ok(!codigos.has(p.codigo), `duplicado ${p.codigo}`);
    codigos.add(p.codigo);
    assert.ok(p.imagem, `${p.codigo} sem foto`);
    assert.ok(fs.existsSync(path.join(RAIZ, 'public/img/produtos', p.imagem.arquivo)));
  }
});

test('contagens por categoria batem com o índice do PDF', () => {
  const esperado = { botoes: 117, microventiladores: 24, chicotes: 26, led: 23, 'maquinas-de-vidro': 64, 'conectores-cabos': 82, ferramentas: 39, estribos: 8, automotivo: 49, 'reles-eletronicos': 41, baterias: 8 };
  for (const c of dados.categorias) assert.equal(c.total, esperado[c.id], c.id);
});

test('detectarMontadoras reconhece modelos e marcas pelo nome', () => {
  const dic = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/montadoras.json'), 'utf8'));
  const prep = Object.entries(dic).filter(([k]) => !k.startsWith('_')).map(([id, m]) => ({
    id, nome: m.nome,
    marcas: new Set((m.marca || []).map((x) => x.toLowerCase())),
    simples: new Map((m.modelos || []).filter((x) => !/\s/.test(x)).map((x) => [x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-/g, ''), x])),
    compostos: (m.modelos || []).filter((x) => /\s/.test(x)).map((x) => [x.toLowerCase().split(/\s+/), x]),
  }));
  const ids = (nome) => detectarMontadoras(nome, prep).map((d) => d.id).sort();
  assert.deepEqual(ids('Máq. vidro Gol 2P G5 direito sem motor'), ['vw']);
  assert.deepEqual(ids('Botão levantador vidro Renault Logan 2009/Sandero'), ['renault']);
  assert.deepEqual(ids('Chicote antena Fusion/Edge/Focus/F150/Ecosport'), ['ford']);
  assert.deepEqual(ids('Botão de vidro T-Cross/Polo/Virtus duplo'), ['vw']);
  assert.deepEqual(ids('Máq. vidro Sandero 4P 2008 direito'), ['renault']);
  assert.deepEqual(ids('Lâmpada LED H4 6000K'), []);
  assert.deepEqual(detectarMontadoras('Chicote som Hyundai HB20/IX35 com RCA', prep)[0].modelos.sort(), ['HB20', 'IX35']);
});

test('extrairAtributos lê lado, tipo, tensão, medidas e cor', () => {
  assert.deepEqual(extrairAtributos('Máq. vidro Gol 2P G5 esquerdo sem motor'), { lado: 'Esquerdo', portas: '2 portas', motor: 'Sem motor' });
  assert.equal(extrairAtributos('Micro ventilador 60x60x15mm 12V c/ bucha').voltagem, '12V');
  assert.equal(extrairAtributos('Micro ventilador 60x60x15mm 12V c/ bucha').medida, '60x60x15 mm');
  assert.equal(extrairAtributos('Ventilador bivolt 110/240V 10W').voltagem, '110/240V');
  assert.equal(extrairAtributos('Ventilador bivolt 110/240V 10W').potencia, '10W');
  assert.equal(extrairAtributos('Inversor 12-110V 2000W').voltagem, '12V → 110V');
  assert.equal(extrairAtributos('Botão de vidro Corsa Classic âmbar 6 pinos').pinos, '6 pinos');
  assert.equal(extrairAtributos('Botão de vidro Corsa Classic âmbar 6 pinos').cor, 'Âmbar');
  assert.equal(extrairAtributos('Palheta 19"').polegadas, '19"');
  assert.equal(extrairAtributos('Cabo HDMI 1,80mts 4K2K').comprimento, '1,80 m');
  assert.equal(extrairAtributos('Divisor HDMI 1x2 Splitter 3D').medida, undefined);
  assert.equal(extrairAtributos('Bateria LR6 AA').corrente, undefined);
});
