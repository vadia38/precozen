import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-kdp-'));
process.env.PRECOZEN_WORKSPACE = ws;
const { carregarConfig } = await import('../src/core/config.js');
const { trim, paginaInterior, dimensoesCapa, larguraLombada, margemInterna, validarPaginas } = await import('../src/kdp/especificacoes.js');
const { custoImpressao, royaltyPaperback, royaltyEbook, sugerirPrecos } = await import('../src/kdp/royalties.js');
const { gerarMetadadosTemplate, validarMetadados } = await import('../src/kdp/metadados.js');
const { analisarNichos } = await import('../src/kdp/nicho.js');
const { DocumentoPdf } = await import('../src/kdp/pdf.js');
const { localizarFonte, lerTtf, medirTtf } = await import('../src/kdp/fonte-ttf.js');
const { gerarGrade, limparPalavra, temas } = await import('../src/kdp/interiores/caca-palavras.js');
const { gerarPuzzle, contarSolucoes, resolver } = await import('../src/kdp/interiores/sudoku.js');
const { gerarLabirinto } = await import('../src/kdp/interiores/labirinto.js');
const { pascoa, feriadosBrasil } = await import('../src/kdp/interiores/planner.js');
const { analisarManuscrito, manuscritoDeJson } = await import('../src/kdp/interiores/texto.js');
const { gerarLivro, INTERIORES } = await import('../src/kdp/livro.js');
const { criarRng } = await import('../src/core/rng.js');
const { criarPng } = await import('./util-png.js');

const config = carregarConfig();
after(() => fs.rmSync(ws, { recursive: true, force: true }));

test('especificações: trims, margens, lombada e capa', () => {
  assert.equal(trim('6x9').altura, 9);
  assert.throws(() => trim('7x7'));
  assert.equal(margemInterna(120), 0.375);
  assert.equal(margemInterna(200), 0.5);
  assert.equal(margemInterna(800), 0.875);
  assert.equal(larguraLombada(200, 'branco'), 0.4504);
  assert.equal(larguraLombada(200, 'creme'), 0.5);
  const p = paginaInterior('6x9', { paginas: 120 });
  assert.equal(p.largura, 432); assert.equal(p.altura, 648);
  assert.equal(p.margens.interna, 27); assert.equal(p.margens.externa, 18);
  const ps = paginaInterior('6x9', { sangria: true });
  assert.equal(ps.larguraPol, 6.125); assert.equal(ps.alturaPol, 9.25);
  const c = dimensoesCapa('6x9', 120, 'branco');
  assert.equal(c.lombadaPol, 0.2702);
  assert.equal(c.larguraPol, 12.5202); assert.equal(c.alturaPol, 9.25);
  assert.equal(c.textoNaLombada, true);
  assert.equal(dimensoesCapa('6x9', 60).textoNaLombada, false);
  assert.deepEqual(validarPaginas(120), []);
  assert.ok(validarPaginas(23).length && validarPaginas(121).length && validarPaginas(900).length);
});

test('royalties e custos', () => {
  assert.equal(custoImpressao({ paginas: 100 }).custo, 2.3);
  assert.equal(custoImpressao({ paginas: 200 }).custo, 3.4);
  const r = royaltyPaperback({ precoLista: 9.99, paginas: 120 });
  assert.equal(r.custo, 2.44); assert.equal(r.royalty, 3.55); assert.equal(r.viavel, true);
  assert.equal(royaltyPaperback({ precoLista: 3, paginas: 120 }).viavel, false);
  assert.equal(royaltyEbook({ preco: 4.99, tamanhoMb: 2 }).royalty, 3.19);
  assert.equal(royaltyEbook({ preco: 0.99 }).opcao, 35);
  assert.equal(royaltyEbook({ preco: 9.99, marketplace: 'amazon.com.br' }).opcao, 70);
  const s = sugerirPrecos({ paginas: 120, metas: [3] });
  assert.ok(s[0].royalty >= 3);
});

test('metadados: template e validação', () => {
  const m = gerarMetadadosTemplate({ tipo: 'caca-palavras', tema: 'animais', autor: 'A', paginas: 60, trim: '6x9', quantidade: 40 });
  assert.equal(m.titulo, 'Caça-palavras: Animais');
  assert.equal(m.palavrasChave.length, 7);
  assert.equal(m.categorias.length, 3);
  const v = validarMetadados(m);
  assert.equal(v.valido, true);
  const ruim = validarMetadados({ titulo: 'Livro grátis best seller', subtitulo: '', descricaoHtml: 'x'.repeat(4001), palavrasChave: ['a', 'a', 'b'.repeat(60)], categorias: ['1', '2', '3', '4'] });
  assert.ok(!ruim.valido);
  assert.ok(ruim.avisos.some((a) => /grátis|best seller|livro/.test(a)));
});

test('nichos', () => {
  const n = analisarNichos([{ termo: 'a', buscas_mes: 10000, resultados: 500, preco_medio: 12, bsr: 5000 }, { termo: 'b', buscas_mes: 100, resultados: 90000, preco_medio: 3, bsr: 900000 }]);
  assert.equal(n[0].termo, 'a');
  assert.ok(n[0].score > n[1].score);
  assert.equal(n[0].classe, 'forte');
});

test('fonte TrueType e escritor PDF (estrutura, xref, fontes embutidas, imagens)', () => {
  const f = localizarFonte('sans');
  if (!f) { console.log('sem fonte TTF no sistema; teste de embutir pulado'); return; }
  const ttf = lerTtf(f.regular);
  assert.ok(ttf.unitsPerEm > 0 && ttf.cmap.size > 100 && ttf.nome.length > 0);
  assert.ok(medirTtf(ttf, 'ção', 12) > 10);
  const doc = new DocumentoPdf({ largura: 432, altura: 648, titulo: 'Teste ção', autor: 'A' });
  doc.registrarFonte('regular', f.regular).registrarFonte('negrito', f.negrito).registrarFonte('padrao', 'Helvetica');
  const p = doc.novaPagina();
  p.texto('Olá, ação!', 100, 100, { fonte: 'negrito', tamanho: 14 });
  p.texto('padrão (çã)', 100, 130, { fonte: 'padrao' });
  p.linha(10, 10, 100, 100).retangulo(10, 200, 50, 30, { preenchimento: '#f00', raio: 6 }).circulo(200, 200, 20, { contorno: '#000' }).caminho([[1, 1], [50, 50], [1, 50]], { fechar: true, preenchimento: '#00f' });
  assert.ok(p.paragrafo('palavra '.repeat(60), 50, 300, 200) > 40);
  // PNG RGBA 2×2 mínimo e JPEG mínimo sintético
  const pngPath = path.join(ws, 'i.png'); fs.writeFileSync(pngPath, criarPng({ canais: 4 }));
  const rgbPath = path.join(ws, 'rgb.png'); fs.writeFileSync(rgbPath, criarPng({ largura: 3, altura: 2, canais: 3 }));
  assert.equal(doc.registrarImagem('rgb', rgbPath).colorSpace, 'DeviceRGB');
  const img = doc.registrarImagem('i', pngPath);
  assert.equal(img.largura, 2); assert.ok(img.mascara);
  p.imagem('i', 300, 300, 40, 40);
  doc.novaPagina().texto('Página 2', 50, 50);
  const buf = doc.gerar();
  const txt = buf.toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.7'));
  assert.match(txt, /\/Type \/Page\b/);
  assert.match(txt, /\/Count 2/);
  assert.match(txt, /\/FontFile2/);
  assert.match(txt, /\/Subtype \/Type0/);
  assert.match(txt, /\/ToUnicode/);
  assert.match(txt, /\/SMask/);
  // xref aponta para "N 0 obj"
  const startxref = Number(txt.slice(txt.lastIndexOf('startxref') + 9).trim().split(/\s/)[0]);
  const xref = txt.slice(startxref);
  const linhas = xref.split('\n');
  const total = Number(linhas[1].split(' ')[1]);
  for (let i = 1; i < total; i++) {
    const off = Number(linhas[2 + i].slice(0, 10));
    assert.equal(buf.subarray(off, off + `${i} 0 obj`.length).toString('latin1'), `${i} 0 obj`, `offset do objeto ${i}`);
  }
  assert.match(txt.slice(txt.lastIndexOf('trailer')), /\/ID \[<[a-f0-9]{32}> <[a-f0-9]{32}>\]/);
});

test('caça-palavras: todas as palavras estão na grade', () => {
  const rng = criarRng('t');
  const palavras = temas().animais.slice(0, 15);
  const g = gerarGrade(palavras, { tamanho: 15, dificuldade: 'dificil', rng });
  assert.ok(g.colocadas.length >= 13, `só ${g.colocadas.length} colocadas`);
  for (const c of g.colocadas) {
    let lida = '';
    for (let i = 0; i < c.palavra.length; i++) lida += g.grade[c.y + c.dy * i][c.x + c.dx * i];
    assert.equal(lida, c.palavra);
    assert.equal(c.palavra, limparPalavra(c.original));
  }
  assert.ok(g.grade.every((l) => l.every((ch) => /^[A-Z]$/.test(ch))));
});

test('sudoku: grades válidas com solução única por nível', () => {
  const rng = criarRng('s');
  for (const nivel of ['facil', 'dificil']) {
    const p = gerarPuzzle(rng, nivel);
    assert.equal(contarSolucoes(p.puzzle, 2), 1);
    const sol = resolver(p.puzzle);
    assert.deepEqual(sol, p.solucao);
    for (let r = 0; r < 9; r++) {
      assert.equal(new Set(p.solucao.slice(r * 9, r * 9 + 9)).size, 9);
      assert.equal(new Set(Array.from({ length: 9 }, (_, i) => p.solucao[i * 9 + r])).size, 9);
    }
    assert.equal(p.puzzle.filter(Boolean).length, p.dicas);
  }
});

test('labirinto: perfeito e solucionável', () => {
  const lab = gerarLabirinto(12, 12, criarRng('l'));
  assert.equal(lab.solucao[0][0], 0); assert.equal(lab.solucao.at(-1)[0], 11);
  const paredes = lab.celulas.reduce((s, c) => s + c.paredes.filter(Boolean).length, 0);
  // labirinto perfeito em grade: (n-1) passagens abertas → paredes removidas = 2*(n-1)
  assert.equal(paredes, 4 * 144 - 2 * (144 - 1));
});

test('planner: páscoa e feriados nacionais', () => {
  assert.equal(pascoa(2027).toISOString().slice(0, 10), '2027-03-28');
  const f = feriadosBrasil(2027);
  assert.equal(f['02-09'], 'Carnaval');
  assert.equal(f['03-26'], 'Sexta-feira Santa');
  assert.equal(f['05-27'], 'Corpus Christi');
  assert.equal(f['11-20'], 'Consciência Negra');
});

test('manuscrito: análise de markdown e json', () => {
  const b = analisarManuscrito('# Cap\n\nTexto **forte** [link](x)\n\n## Seção\n\n- item\n\n> cita');
  assert.deepEqual(b.map((x) => x.tipo), ['capitulo', 'paragrafo', 'secao', 'item', 'citacao']);
  assert.equal(b[1].texto, 'Texto forte link');
  assert.match(manuscritoDeJson({ introducao: 'i', capitulos: [{ titulo: 'T', texto: 't' }], conclusao: 'c' }), /# Introdução[\s\S]*# T[\s\S]*# Conclusão/);
});

test('gerar livros de cada tipo (páginas pares, mínimo 24, manifesto e capa)', () => {
  const md = path.join(ws, 'm.md');
  fs.writeFileSync(md, '# Intro\n\n' + 'Texto de teste. '.repeat(400) + '\n\n# Capítulo 1\n\n' + 'Mais texto. '.repeat(600));
  const imgs = path.join(ws, 'imgs'); fs.mkdirSync(imgs);
  fs.writeFileSync(path.join(imgs, 'a.png'), criarPng({ largura: 4, altura: 4, canais: 3 }));
  fs.writeFileSync(path.join(imgs, 'b.png'), criarPng({ largura: 4, altura: 6, canais: 4 }));
  const casos = [
    ['pautado', { paginas: 30 }], ['pontilhado', { paginas: 26 }], ['quadriculado', { paginas: 26 }], ['caca-palavras', { quantidade: 6, tema: 'frutas' }],
    ['sudoku', { quantidade: 4, dificuldade: 'facil' }], ['labirinto', { quantidade: 4, dificuldade: 'facil' }], ['planner', { inicio: '2027-01', meses: 2, semanais: false }],
    ['habitos', { inicio: '2027-01', meses: 3 }], ['texto', { manuscrito: md }], ['imagens', { pasta: imgs, versoBranco: true }],
  ];
  for (const [tipo, opcoes] of casos) {
    const r = gerarLivro({ config, tipo, titulo: `Teste ${tipo}`, autor: 'T', saida: path.join(ws, 'livros', tipo), semente: 'x', ...opcoes });
    assert.ok(r.paginas >= 24 && r.paginas % 2 === 0, `${tipo}: ${r.paginas} páginas`);
    assert.ok(fs.statSync(r.arquivos.interior).size > 1000, `${tipo}: pdf pequeno`);
    assert.ok(fs.existsSync(r.arquivos.manifesto) && fs.existsSync(r.arquivos.metadados) && fs.existsSync(r.arquivos.capaSvg), `${tipo}: arquivos`);
    assert.ok(r.capa.larguraPol > 12, `${tipo}: capa`);
    if (opcoes.paginas) assert.equal(r.paginas, opcoes.paginas);
  }
  assert.equal(Object.keys(INTERIORES).length, 10);
  assert.throws(() => gerarLivro({ config, tipo: 'inexistente' }));
});
