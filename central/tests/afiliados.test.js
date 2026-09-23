import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'precozen-afiliados-'));
process.env.PRECOZEN_WORKSPACE = ws;
const { carregarConfig } = await import('../src/core/config.js');
const { resolverCategoria, taxaComissao, montarLink } = await import('../src/afiliados/programas.js');
const { estimarVendasPorBsr, estimarVendasPorHistorico, resolverVendas } = await import('../src/afiliados/estimativas.js');
const { pontuar, classificarLista, saturar } = await import('../src/afiliados/pontuacao.js');
const { normalizarProduto, lerAtributos } = await import('../src/afiliados/normalizar.js');
const { importarRegistros, importarDeFonte, carregarProdutos } = await import('../src/afiliados/importar.js');
const { analisar, carregarRanking } = await import('../src/afiliados/analisar.js');
const { gerarReview, gerarReviews, nomeCurto, notaEditorial } = await import('../src/afiliados/reviews.js');
const { gerarComparativos } = await import('../src/afiliados/comparativos.js');
const { assinarRequisicao, converterItem, regiaoDoHost } = await import('../src/afiliados/fontes/amazon-paapi.js');
const { assinar, consultaOfertas, converterOferta } = await import('../src/afiliados/fontes/shopee.js');
const { agregarVendas } = await import('../src/afiliados/fontes/hotmart.js');
const { converterResultado } = await import('../src/afiliados/fontes/mercadolivre.js');
const { analisar: lerFrontMatter } = await import('../src/core/frontmatter.js');
const { RAIZ_CENTRAL } = await import('../src/core/arquivos.js');

const config = carregarConfig();
after(() => fs.rmSync(ws, { recursive: true, force: true }));

test('programas: categorias, comissões e links', () => {
  assert.equal(resolverCategoria('Casa & Cozinha'), 'cozinha');
  assert.equal(resolverCategoria('Fone de ouvido bluetooth'), 'eletronicos');
  assert.equal(resolverCategoria('xyz'), 'outros');
  assert.equal(taxaComissao('amazon-br', 'livros'), 0.08);
  assert.equal(taxaComissao('amazon-br', 'inexistente'), 0.05);
  assert.equal(taxaComissao('hotmart', 'cursos', 50), 0.5);
  assert.equal(taxaComissao('hotmart', 'cursos', 0.6), 0.6);
  assert.equal(montarLink('amazon-br', 'B0ABC', { 'amazon-br': { tag: 'tag-20' } }), 'https://www.amazon.com.br/dp/B0ABC?tag=tag-20&linkCode=ll1');
  assert.equal(montarLink('amazon-br', 'B0ABC', {}), null);
  assert.equal(montarLink('mercado-livre', 'MLB1', {}, 'https://mercadolivre.com/sec/X'), 'https://mercadolivre.com/sec/X');
  assert.equal(montarLink('amazon-br', '../x', { 'amazon-br': { tag: 't' } }), null);
});

test('estimativas de vendas', () => {
  assert.ok(estimarVendasPorBsr(100, { k: 6000, alpha: 0.65 }) > estimarVendasPorBsr(1000, { k: 6000, alpha: 0.65 }));
  assert.equal(estimarVendasPorBsr(0), null);
  assert.equal(Math.round(estimarVendasPorHistorico(1200, new Date(Date.now() - 365.25 * 24 * 3600 * 1000))), 100);
  assert.deepEqual(resolverVendas({ vendasMes: 50 }), { vendasMes: 50, fonte: 'informado' });
  assert.equal(resolverVendas({ bsr: 500, programa: 'amazon-br' }).fonte, 'estimado-bsr');
  assert.equal(resolverVendas({}).fonte, 'desconhecido');
});

test('pontuação: partes, classes e ranking', () => {
  assert.ok(Math.abs(saturar(40, 40) - 63.2) < 0.2);
  const bom = pontuar({ preco: 500, comissaoTaxa: 0.1, vendasMes: 800, avaliacao: 4.8, numAvaliacoes: 5000, tendencia: 0.5 }, config.afiliados.pontuacao);
  const ruim = pontuar({ preco: 20, comissaoTaxa: 0.02, vendasMes: 2, avaliacao: 3.2, numAvaliacoes: 5 }, config.afiliados.pontuacao);
  assert.ok(bom.pontuacao.score > 80 && bom.pontuacao.classe === 'ouro', JSON.stringify(bom.pontuacao));
  assert.ok(ruim.pontuacao.score < 40 && ruim.pontuacao.classe === 'descartar');
  assert.equal(bom.pontuacao.epc100, 150);
  const parcial = pontuar({ preco: 100, comissaoTaxa: 0.1, vendasMes: null, avaliacao: 4.5, numAvaliacoes: 100 });
  assert.equal(parcial.pontuacao.parcial, true);
  assert.equal(parcial.pontuacao.partes.demanda, null);
  const r = classificarLista([ruim, bom].map((p) => ({ ...p, categoria: 'x', categoriaNome: 'X' })), config.afiliados.pontuacao);
  assert.equal(r.produtos[0].pontuacao.posicao, 1);
  assert.equal(r.resumo.total, 2);
});

test('normalização de registros brutos', () => {
  assert.deepEqual(lerAtributos('cor=preto; potência: 1200W'), { cor: 'preto', potência: '1200W' });
  const { produto, avisos } = normalizarProduto({ ASIN: 'B0X', Título: 'Fone', Categoria: 'Eletrônicos', Preço: 'R$ 249,00', Comissão: '8%', BSR: '210', Nota: '4,5', Avaliações: '8.930', Pros: 'a; b' }, { configAfiliados: config.afiliados });
  assert.equal(produto.id, 'amazon-br:B0X');
  assert.equal(produto.preco, 249);
  assert.equal(produto.comissaoTaxa, 0.08);
  assert.equal(produto.bsr, 210);
  assert.equal(produto.avaliacao, 4.5);
  assert.equal(produto.numAvaliacoes, 8930);
  assert.deepEqual(produto.pros, ['a', 'b']);
  assert.equal(produto.vendasFonte, 'estimado-bsr');
  assert.ok(produto.link.includes('tag=precozen-20'));
  assert.equal(avisos.length, 0);
  assert.equal(normalizarProduto({ preco: 1 }).produto, null);
  const ml = normalizarProduto({ programa: 'mercadolivre', id: 'MLB1', nome: 'X', preco: 10, total_vendido: 120, date_created: '2020-01-01' });
  assert.equal(ml.produto.programa, 'mercado-livre');
  assert.equal(ml.produto.vendasFonte, 'estimado-historico');
});

test('importar, analisar, reviews e comparativos com os dados de exemplo', async () => {
  const r = await importarDeFonte('arquivo', { arquivo: path.join(RAIZ_CENTRAL, 'data', 'produtos-exemplo.csv') }, { config });
  assert.equal(r.novos, 26);
  assert.equal(carregarProdutos().length, 26);
  const denovo = importarRegistros([{ programa: 'amazon-br', id: 'B0EXEMPLO01', nome: 'Fritadeira nova', preco: '389,90' }], { config });
  assert.equal(denovo.atualizados, 1);
  assert.equal(denovo.produtos.find((p) => p.id === 'amazon-br:B0EXEMPLO01').preco, 389.9);
  const { ranking, arquivos } = analisar({ config });
  assert.equal(ranking.produtos.length, 26);
  assert.ok(fs.existsSync(arquivos.csv) && fs.existsSync(arquivos.md));
  assert.equal(carregarRanking().resumo.total, 26);
  const dir = path.join(ws, 'posts');
  const rev = await gerarReviews({ config, top: 3, dir, hoje: new Date('2026-09-23T00:00:00Z') });
  assert.equal(rev.gerados.length, 3);
  const { meta, corpo } = lerFrontMatter(fs.readFileSync(path.join(dir, rev.gerados[0]), 'utf8'));
  assert.equal(meta.tipo, 'review');
  assert.match(corpo, /## Veredito/);
  assert.match(corpo, /\{:afiliado \.botao\}/);
  assert.doesNotMatch(corpo, /comiss[aã]o de|EPC|score/i);
  const rev2 = await gerarReviews({ config, top: 3, dir });
  assert.equal(rev2.pulados.length, 3);
  const comp = gerarComparativos({ config, minimo: 3, dir });
  assert.ok(comp.gerados.length >= 1);
});

test('review: nomes curtos e nota editorial', () => {
  assert.equal(nomeCurto('Smartwatch com GPS, Oxímetro e Monitor de Sono, Tela AMOLED 1,43"'), 'Smartwatch');
  assert.equal(nomeCurto('Fritadeira Elétrica sem Óleo Air Fryer 5,5 L Digital 1500 W'), 'Fritadeira Elétrica sem Óleo Air Fryer 5,5 L');
  assert.ok(notaEditorial({ avaliacao: 4.8, numAvaliacoes: 10000, pontuacao: { partes: { preco: 100 } } }) >= 9);
  const post = gerarReview({ id: 'a:1', programa: 'amazon-br', nome: 'Produto X', categoria: 'casa', categoriaNome: 'Casa', preco: 100, moeda: 'BRL', numAvaliacoes: 0, atributos: {}, pros: [], contras: [], link: 'https://www.amazon.com.br/dp/1?tag=t', pontuacao: { partes: {} } }, { config, hoje: new Date('2026-01-01') });
  assert.match(post.meta.titulo, /Produto X/);
  assert.match(post.corpo, /Ainda há poucas avaliações/);
});

test('fontes: assinatura PA-API (SigV4) determinística e conversões', () => {
  const req = assinarRequisicao({ host: 'webservices.amazon.com.br', caminho: '/paapi5/searchitems', alvo: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems', corpo: { Keywords: 'x' }, accessKey: 'AKIA', secretKey: 'segredo', regiao: 'us-east-1', data: new Date('2026-09-23T10:11:12Z') });
  assert.equal(req.cabecalhos['x-amz-date'], '20260923T101112Z');
  assert.match(req.cabecalhos.authorization, /^AWS4-HMAC-SHA256 Credential=AKIA\/20260923\/us-east-1\/ProductAdvertisingAPI\/aws4_request, SignedHeaders=content-encoding;host;x-amz-date;x-amz-target, Signature=[a-f0-9]{64}$/);
  const req2 = assinarRequisicao({ host: 'webservices.amazon.com.br', caminho: '/paapi5/searchitems', alvo: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems', corpo: { Keywords: 'x' }, accessKey: 'AKIA', secretKey: 'segredo', regiao: 'us-east-1', data: new Date('2026-09-23T10:11:12Z') });
  assert.equal(req.cabecalhos.authorization, req2.cabecalhos.authorization);
  assert.equal(regiaoDoHost('webservices.amazon.de'), 'eu-west-1');
  const item = converterItem({ ASIN: 'B1', DetailPageURL: 'https://www.amazon.com.br/dp/B1?tag=t', ItemInfo: { Title: { DisplayValue: 'T' }, ByLineInfo: { Brand: { DisplayValue: 'M' } }, Features: { DisplayValues: ['a', 'b'] } }, Offers: { Listings: [{ Price: { Amount: 10.5 } }] }, BrowseNodeInfo: { WebsiteSalesRank: { SalesRank: 99 }, BrowseNodes: [{ ContextFreeName: 'Cozinha' }] } }, 'www.amazon.com.br');
  assert.equal(item.programa, 'amazon-br');
  assert.equal(item.bsr, 99);
  assert.equal(item.preco, 10.5);
  const sh = assinar({ appId: '1', secret: 's', payload: '{}', timestamp: 1700000000 });
  assert.match(sh.authorization, /^SHA256 Credential=1, Timestamp=1700000000, Signature=[a-f0-9]{64}$/);
  assert.match(consultaOfertas({ palavras: 'x' }), /productOfferV2/);
  assert.equal(converterOferta({ itemId: 5, productName: 'P', priceMin: '9.9', commissionRate: '0.1' }).programa, 'shopee');
  const hot = agregarVendas([{ product: { id: 1, name: 'Curso' }, purchase: { price: { value: 100 } } }, { product: { id: 1, name: 'Curso' }, purchase: { price: { value: 100 } } }], { dias: 30 });
  assert.equal(hot[0].vendas_mes, 2);
  assert.equal(converterResultado({ id: 'MLB1', title: 'x', price: 5, thumbnail: 'http://a/b-I.jpg' }).imagem, 'https://a/b-O.jpg');
});
