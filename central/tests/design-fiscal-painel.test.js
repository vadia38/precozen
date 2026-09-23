import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-design-'));
process.env.PRECOZEN_WORKSPACE = ws;
const { carregarConfig } = await import('../src/core/config.js');
const { paleta, contraste, textoLegivel, misturar } = await import('../src/design/paletas.js');
const { gerarCamiseta, textosMerch } = await import('../src/design/camiseta.js');
const { gerarCapa } = await import('../src/design/capa.js');
const { gerarInfografico, gerarBannerAPlus, gerarImagemPrincipal, textosListagem } = await import('../src/design/listagem.js');
const { verificarTexto, verificarListagemMerch, verificarListagemAmazon } = await import('../src/design/conformidade.js');
const { detectarRenderizador, svgParaPng, htmlParaPdf, dimensoesPng } = await import('../src/design/render.js');
const { produtoMerch } = await import('../src/design/especificacoes.js');
const { irpfMensal, estimarPessoaFisica, estimarMei, estimarSimples, compararRegimes } = await import('../src/fiscal/calculos.js');
const { construirPainel, coletarEstado } = await import('../src/painel/build.js');

const config = carregarConfig();
after(() => fs.rmSync(ws, { recursive: true, force: true }));

test('paletas e contraste', () => {
  assert.equal(paleta('noite').acento, '#F59E0B');
  assert.throws(() => paleta('x'));
  assert.ok(contraste('#000000', '#FFFFFF') > 20);
  assert.equal(textoLegivel('#0F172A'), '#FFFFFF');
  assert.equal(textoLegivel('#FFF1F2'), '#111111');
  assert.equal(misturar('#000000', '#ffffff', 0.5), '#808080');
});

test('camiseta: layouts, tamanho Merch e textos de listagem', () => {
  for (const layout of ['empilhado', 'arco', 'selo', 'minimal']) {
    const r = gerarCamiseta({ texto: 'Café primeiro | perguntas depois', subtexto: 'desde sempre', layout, paleta: 'sol' });
    assert.match(r.svg, /width="4500" height="5400"/);
    assert.match(r.svg, /CAFÉ PRIMEIRO/);
    assert.doesNotMatch(r.svg, /<rect width="100%"/); // fundo transparente
  }
  assert.equal(produtoMerch('moletom').altura, 4050);
  assert.throws(() => gerarCamiseta({ texto: 'x', layout: 'zz' }));
  const t = textosMerch({ texto: 'Café primeiro | perguntas depois', nicho: 'café' });
  assert.ok(t.titulo.length <= 60 && t.marca.length <= 50 && t.bullets.length === 2);
  assert.equal(t.titulo, 'Camiseta Café primeiro perguntas depois Presente Divertido');
});

test('capa KDP: dimensões e zonas', () => {
  const c = gerarCapa({ trim: '6x9', paginas: 120, titulo: 'Título Longo Para Testar Quebra de Linhas', subtitulo: 'Sub', autor: 'Autor', textoContracapa: 'texto', guias: true, selo: 'novo' });
  assert.equal(c.dims.px300.largura, 3756); assert.equal(c.dims.px300.altura, 2775);
  assert.match(c.svg, /viewBox="0 0 3756 2775"/);
  assert.match(c.svg, /rotate\(90\)/); // texto na lombada
  assert.match(c.html, /@page\{size:12.5202in 9.25in/);
  const curta = gerarCapa({ trim: '6x9', paginas: 40, titulo: 'T' });
  assert.doesNotMatch(curta.svg, /rotate\(90\)/);
});

test('listagem: imagens e textos', () => {
  const i = gerarInfografico({ titulo: 'Garrafa Térmica Inox 1 L', destaques: ['Mantém gelado por 24 h', 'Inox 304'], selo: 'BPA free' });
  assert.match(i.svg, /width="2000" height="2000"/);
  assert.match(gerarBannerAPlus({ titulo: 'T', texto: 'x' }).svg, /width="970" height="600"/);
  assert.match(gerarImagemPrincipal({}).svg, /fill="#FFFFFF"/);
  assert.throws(() => gerarInfografico({ titulo: 'x', imagem: '/nao/existe.png' }));
  const t = textosListagem({ nome: 'Garrafa', marca: 'M', categoria: 'Esportes', beneficios: ['Gelado: 24 h', 'inox'], atributos: { capacidade: '1 L' }, publico: 'atletas' });
  assert.equal(t.bullets[0], 'GELADO: 24 h');
  assert.ok(t.bullets.length >= 3 && t.titulo.length <= 200);
});

test('conformidade', () => {
  assert.equal(verificarTexto('Café primeiro').ok, true);
  const r = verificarTexto('Mickey Mouse fan grátis');
  assert.equal(r.ok, false);
  assert.ok(r.avisos.length >= 1);
  assert.ok(verificarTexto('Disneyland').ok, 'não deve casar substring dentro de palavra');
  const m = verificarListagemMerch({ marca: 'x'.repeat(51), titulo: 'ok', bullets: ['a', 'b', 'c'], descricao: 'd' });
  assert.ok(m.erros.some((e) => /marca/.test(e)) && m.erros.some((e) => /bullets/.test(e)));
  const a = verificarListagemAmazon({ titulo: 'T!!!', bullets: [], descricao: '', palavrasChave: ['x'.repeat(300)] });
  assert.ok(a.avisos.length >= 2);
});

test('render: PNG transparente e PDF quando há renderizador', () => {
  const r = detectarRenderizador();
  if (!r) { console.log('sem renderizador: teste pulado'); return; }
  const est = gerarCamiseta({ texto: 'Teste', layout: 'minimal' });
  const png = svgParaPng(est.svg, path.join(ws, 'e.png'), { largura: 450, altura: 540 });
  const d = dimensoesPng(png.destino);
  assert.equal(d.largura, 450); assert.equal(d.altura, 540); assert.equal(d.colorType, 6);
  if (r.tipo === 'chromium') {
    const c = gerarCapa({ trim: '5x8', paginas: 100, titulo: 'T' });
    const pdf = htmlParaPdf(c.html, path.join(ws, 'c.pdf'));
    assert.ok(fs.readFileSync(pdf.destino).subarray(0, 5).toString() === '%PDF-');
  }
});

test('fiscal: tabela progressiva, compensação e comparação de regimes', () => {
  const t = config.fiscal.irpf;
  assert.equal(irpfMensal(2000, t).imposto, 0);
  assert.equal(irpfMensal(5000, t).imposto, 466.27);
  const comRedutor = irpfMensal(5000, { ...t, redutor: { ...t.redutor, ativo: true } });
  assert.equal(comRedutor.imposto, 0);
  const parcial = irpfMensal(6000, { ...t, redutor: { ...t.redutor, ativo: true } });
  assert.ok(parcial.imposto > 0 && parcial.imposto < irpfMensal(6000, t).imposto);
  const pf = estimarPessoaFisica({ comissoesBrl: 3000, royaltiesUsd: 500, cambio: 5, retencaoEua: 0.3, tabela: t });
  assert.equal(pf.royaltiesBrutoBrl, 2500); assert.equal(pf.retidoExterior, 750);
  assert.ok(pf.compensado <= pf.irBruto && pf.irAPagar >= 0 && pf.liquido > 0);
  const mei = estimarMei({ receitaMensalBrl: 8000, mei: config.fiscal.mei });
  assert.equal(mei.excedeLimite, true);
  assert.equal(estimarSimples({ receitaMensalBrl: 10000, folhaMensalBrl: 3000, simples: config.fiscal.simples }).anexo, 'III');
  assert.equal(estimarSimples({ receitaMensalBrl: 10000, folhaMensalBrl: 0, simples: config.fiscal.simples }).anexo, 'V');
  const c = compararRegimes({ comissoesBrl: 3500, royaltiesUsd: 400, config });
  assert.ok(c.pf.liquido > 0 && c.mei.liquido > 0 && c.simples.liquido > 0);
});

test('painel: estado vazio e página gerada', () => {
  const e = coletarEstado({ config });
  assert.equal(e.kpis.produtos, 0);
  const r = construirPainel({ config, out: path.join(ws, 'painel') });
  const html = fs.readFileSync(r.arquivo, 'utf8');
  assert.match(html, /Painel central/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /Nenhum produto pontuado/);
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.ok(fs.existsSync(path.join(ws, 'painel', 'painel.css')));
});
