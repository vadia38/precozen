// Painel central: uma página estática com o estado do sistema (produtos, ranking, posts, livros, designs, IA) e o próximo passo.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_CENTRAL, workspace, lerJson, gravarTexto, listarArquivos } from '../core/arquivos.js';
import { escapeHtml, formatarMoeda, formatarNumero, dataIso, truncar } from '../core/util.js';
import { carregarProdutos } from '../afiliados/importar.js';
import { carregarRanking } from '../afiliados/analisar.js';
import { carregarBlog } from '../blog/conteudo.js';
import { disponibilidade } from '../ia/cliente.js';
import { detectarRenderizador } from '../design/render.js';

/** Lê tudo o que existe no workspace e no conteúdo. */
export function coletarEstado({ config } = {}) {
  const produtos = carregarProdutos();
  const ranking = carregarRanking();
  let blog = { posts: [], categorias: [], erros: [] };
  try { blog = carregarBlog(); } catch (e) { blog.erros = [e.message]; }
  const livros = listarArquivos(workspace('kdp'), (p) => p.endsWith('manifesto.json')).map((p) => { try { return lerJson(p); } catch { return null; } }).filter(Boolean);
  const estampas = listarArquivos(workspace('design', 'camisetas'), (p) => p.endsWith('listagem.json')).map((p) => { try { return { ...lerJson(p), pasta: path.dirname(p) }; } catch { return null; } }).filter(Boolean);
  const listagens = listarArquivos(workspace('design', 'listagens'), (p) => p.endsWith('textos.json')).map((p) => { try { return { ...lerJson(p), pasta: path.dirname(p) }; } catch { return null; } }).filter(Boolean);
  const capas = listarArquivos(workspace('design', 'capas'), (p) => p.endsWith('capa.svg')).map((p) => path.dirname(p));
  const nichos = lerJson(workspace('kdp', 'nichos.json'), null);
  const blogDist = fs.existsSync(workspace('blog', 'dist', 'index.html'));
  const ia = disponibilidade();
  const renderizador = detectarRenderizador();
  const top = ranking?.produtos?.slice(0, 10) || [];
  const promoviveis = ranking?.produtos?.filter((p) => ['ouro', 'prata'].includes(p.pontuacao.classe)) || [];
  const epcMedioTop = top.length ? top.reduce((s, p) => s + p.pontuacao.epc100, 0) / top.length : 0;
  const potencial = promoviveis.reduce((s, p) => s + (p.pontuacao.receitaPotencialMes || 0), 0);
  const postsPorProduto = new Set(blog.posts.map((p) => p.produto).filter(Boolean));
  const semPost = promoviveis.filter((p) => !postsPorProduto.has(p.id));
  return { geradoEm: dataIso(), config, produtos, ranking, blog, livros, estampas, listagens, capas, nichos, blogDist, ia, renderizador, kpis: { produtos: produtos.length, promoviveis: promoviveis.length, epcMedioTop, potencial, posts: blog.posts.length, livros: livros.length, estampas: estampas.length, semPost: semPost.length }, semPost };
}

function graficoBarras(itens, { largura = 640, alturaBarra = 22, rotulo, valor, formatar, max }) {
  if (!itens.length) return '<p class="vazio">Sem dados ainda.</p>';
  const margemEsq = 220; const margemDir = 70; const topo = 8;
  const altura = topo + itens.length * (alturaBarra + 6);
  const maximo = max || Math.max(...itens.map(valor));
  const escala = (largura - margemEsq - margemDir) / (maximo || 1);
  const linhas = itens.map((it, i) => {
    const y = topo + i * (alturaBarra + 6);
    const w = Math.max(2, valor(it) * escala);
    return `<g><title>${escapeHtml(`${rotulo(it)}: ${formatar(valor(it))}`)}</title><text x="${margemEsq - 10}" y="${y + alturaBarra * 0.7}" text-anchor="end">${escapeHtml(truncar(rotulo(it), 28))}</text><rect class="barra" x="${margemEsq}" y="${y}" width="${w.toFixed(1)}" height="${alturaBarra}" rx="4"/><text class="valor" x="${margemEsq + w + 8}" y="${y + alturaBarra * 0.7}">${escapeHtml(formatar(valor(it)))}</text></g>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de barras">${linhas}</svg>`;
}

function tile(label, value, delta, extra = '') {
  return `<div class="tile ${extra}"><p class="tile__label">${escapeHtml(label)}</p><p class="tile__value">${escapeHtml(value)}</p>${delta ? `<p class="tile__delta">${escapeHtml(delta)}</p>` : ''}</div>`;
}

export function htmlPainel(estado) {
  const { config, kpis, ranking, blog, livros, estampas, listagens, capas, ia, renderizador, blogDist, semPost } = estado;
  const marca = config.marca.nome;
  const top = ranking?.produtos?.slice(0, 12) || [];
  const passos = [
    { feito: kpis.produtos > 0, texto: 'Importar produtos dos programas de afiliados', cmd: 'precozen afiliados importar --arquivo produtos.csv' },
    { feito: Boolean(ranking), texto: 'Pontuar vendas × comissão e gerar o ranking', cmd: 'precozen afiliados analisar' },
    { feito: kpis.posts > 0, texto: 'Gerar análises e comparativos para os melhores', cmd: 'precozen afiliados reviews --top 10 && precozen afiliados comparativos' },
    { feito: blogDist, texto: 'Publicar o blog (pasta workspace/blog/dist)', cmd: 'precozen blog build' },
    { feito: kpis.livros > 0, texto: 'Produzir livros para o KDP (interior + capa + metadados)', cmd: 'precozen kdp livro --tipo caca-palavras --titulo "..."' },
    { feito: kpis.estampas > 0 || listagens.length > 0, texto: 'Criar designs para a Amazon (Merch, listagens)', cmd: 'precozen design camiseta --texto "..."' },
    { feito: ia.sdk && ia.credencial, texto: 'Ligar a IA para textos mais ricos (opcional)', cmd: 'npm install && ANTHROPIC_API_KEY em central/.env' },
  ];
  const linhaRanking = (p) => `<tr><td class="num">${p.pontuacao.posicao}</td><td>${p.link ? `<a href="${escapeHtml(p.link)}" rel="noopener sponsored" target="_blank">${escapeHtml(truncar(p.nome, 60))}</a>` : escapeHtml(truncar(p.nome, 60))}<br><span class="muted">${escapeHtml(p.programa)} · ${escapeHtml(p.categoriaNome)}</span></td><td class="num">${p.preco ? formatarMoeda(p.preco, p.moeda) : '—'}</td><td class="num">${formatarMoeda(p.comissaoValor, p.moeda)}<br><span class="muted">${formatarNumero(p.comissaoTaxa * 100, 1)}%</span></td><td class="num">${p.vendasMes === null ? '—' : formatarNumero(p.vendasMes)}${p.vendasFonte?.startsWith('estimado') ? '*' : ''}</td><td class="num">${formatarNumero(p.pontuacao.score, 1)}</td><td><span class="chip chip--${p.pontuacao.classe}">${p.pontuacao.classe}</span></td><td class="num">${formatarMoeda(p.pontuacao.epc100, p.moeda)}</td></tr>`;
  const corpo = `<header class="topo"><div class="container topo__inner"><h1>${escapeHtml(marca)} · Painel central</h1><nav><a href="#ranking">Ranking</a><a href="#conteudo">Conteúdo</a><a href="#kdp">KDP</a><a href="#design">Design</a><a href="#passos">Próximos passos</a>${blogDist ? '<a href="../blog/dist/">Abrir blog</a>' : ''}</nav><span class="topo__meta">gerado em ${escapeHtml(estado.geradoEm)}</span></div></header>
<main class="container">
<section class="tiles" aria-label="Indicadores">
  ${tile('Ganho médio por 100 cliques (top 10)', formatarMoeda(kpis.epcMedioTop), 'preço × comissão × conversão esperada', 'tile--hero')}
  ${tile('Produtos na base', formatarNumero(kpis.produtos), `${formatarNumero(kpis.promoviveis)} em ouro/prata`)}
  ${tile('Análises publicadas', formatarNumero(kpis.posts), `${formatarNumero(kpis.semPost)} produtos bons sem análise`)}
  ${tile('Livros KDP gerados', formatarNumero(kpis.livros), livros.length ? `${formatarNumero(livros.reduce((s, l) => s + l.paginas, 0))} páginas no total` : 'nenhum ainda')}
  ${tile('Designs', formatarNumero(kpis.estampas + listagens.length + capas.length), `${kpis.estampas} estampas · ${listagens.length} listagens · ${capas.length} capas`)}
  ${tile('Teto teórico de comissão/mês', formatarMoeda(kpis.potencial), 'se 100% das vendas dos produtos ouro/prata viessem do blog')}
</section>
<section class="painel-grade">
  <div class="cartao" id="ranking"><h2>Score dos melhores produtos <small>0–100 · comissão, demanda, qualidade, preço, tendência</small></h2>${graficoBarras(top, { rotulo: (p) => p.nome, valor: (p) => p.pontuacao.score, formatar: (v) => formatarNumero(v, 1), max: 100 })}</div>
  <div class="cartao"><h2>Ganho por 100 cliques <small>por produto, na moeda do programa</small></h2>${graficoBarras(top.slice().sort((a, b) => b.pontuacao.epc100 - a.pontuacao.epc100), { rotulo: (p) => p.nome, valor: (p) => p.pontuacao.epc100, formatar: (v) => formatarMoeda(v) })}</div>
</section>
<section class="cartao"><h2>Ranking completo <small>${ranking ? `${ranking.resumo.total} produtos · gerado em ${escapeHtml(ranking.geradoEm)}` : 'rode precozen afiliados analisar'}</small></h2><div class="tabela-rolagem"><table><thead><tr><th class="num">#</th><th>Produto</th><th class="num">Preço</th><th class="num">Comissão</th><th class="num">Vendas/mês</th><th class="num">Score</th><th>Classe</th><th class="num">Ganho/100 cliques</th></tr></thead><tbody>${(ranking?.produtos || []).slice(0, 40).map(linhaRanking).join('') || '<tr><td colspan="8" class="vazio">Nenhum produto pontuado.</td></tr>'}</tbody></table></div><p class="muted">* vendas estimadas pelo ranking/histórico. Comissões e vendas são dados internos: não aparecem no blog.</p></section>
<section class="painel-grade" id="conteudo">
  <div class="cartao"><h2>Conteúdo do blog <small>${blog.posts.length} posts · ${blog.categorias.length} categorias${blog.erros.length ? ' · ERROS' : ''}</small></h2><div class="tabela-rolagem"><table><thead><tr><th>Título</th><th>Tipo</th><th>Categoria</th><th>Data</th></tr></thead><tbody>${blog.posts.slice(0, 25).map((p) => `<tr><td>${blogDist ? `<a href="../blog/dist/${escapeHtml(p.url)}">${escapeHtml(truncar(p.titulo, 70))}</a>` : escapeHtml(truncar(p.titulo, 70))}</td><td>${escapeHtml(p.tipo)}</td><td>${escapeHtml(p.categoriaNome)}</td><td>${escapeHtml(p.data)}</td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhum post.</td></tr>'}</tbody></table></div>${blog.erros.length ? `<p class="status status--falta">${escapeHtml(blog.erros.join('; '))}</p>` : ''}</div>
  <div class="cartao"><h2>Bons produtos sem análise <small>${semPost.length}</small></h2>${semPost.length ? `<ul>${semPost.slice(0, 12).map((p) => `<li>${escapeHtml(truncar(p.nome, 60))} <span class="muted">score ${p.pontuacao.score}</span></li>`).join('')}</ul><p class="muted">Gere com <code>precozen afiliados reviews --top ${Math.min(20, semPost.length)}</code></p>` : '<p class="vazio">Todos os produtos ouro/prata já têm análise.</p>'}</div>
</section>
<section class="painel-grade" id="kdp">
  <div class="cartao"><h2>Livros KDP <small>${livros.length}</small></h2><div class="tabela-rolagem"><table><thead><tr><th>Título</th><th>Tipo</th><th class="num">Páginas</th><th>Trim</th><th class="num">Lombada</th><th>Fonte</th></tr></thead><tbody>${livros.map((l) => `<tr><td>${escapeHtml(truncar(l.titulo, 50))}<br><span class="muted">${escapeHtml(l.pasta)}</span></td><td>${escapeHtml(l.tipo)}</td><td class="num">${l.paginas}</td><td>${escapeHtml(l.trim)}</td><td class="num">${l.lombadaPol}"</td><td><span class="status ${l.fontes?.embutida ? 'status--ok' : 'status--falta'}">${l.fontes?.embutida ? 'embutida' : 'não embutida'}</span></td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhum livro gerado.</td></tr>'}</tbody></table></div></div>
  <div class="cartao"><h2>Nichos KDP <small>${estado.nichos ? `${estado.nichos.nichos.length} avaliados` : 'rode precozen kdp nicho'}</small></h2>${estado.nichos ? graficoBarras(estado.nichos.nichos.slice(0, 8), { rotulo: (n) => n.termo, valor: (n) => n.score, formatar: (v) => formatarNumero(v, 1), max: 100 }) : '<p class="vazio">Sem análise de nichos.</p>'}</div>
</section>
<section class="painel-grade" id="design">
  <div class="cartao"><h2>Estampas Merch <small>${estampas.length}</small></h2><div class="tabela-rolagem"><table><thead><tr><th>Título da listagem</th><th>Layout</th><th>Conformidade</th></tr></thead><tbody>${estampas.map((e) => `<tr><td>${escapeHtml(truncar(e.titulo || '', 60))}<br><span class="muted">${escapeHtml(e.pasta)}</span></td><td>${escapeHtml(e.layout || '')}</td><td><span class="status ${e.conformidade?.ok ? 'status--ok' : 'status--falta'}">${e.conformidade?.ok ? 'ok' : `${e.conformidade?.erros?.length || 0} erro(s)`}</span></td></tr>`).join('') || '<tr><td colspan="3" class="vazio">Nenhuma estampa.</td></tr>'}</tbody></table></div></div>
  <div class="cartao"><h2>Listagens e capas <small>${listagens.length + capas.length}</small></h2><ul>${listagens.map((l) => `<li>${escapeHtml(truncar(l.titulo, 70))} <span class="status ${l.conformidade?.ok ? 'status--ok' : 'status--falta'}">${l.conformidade?.ok ? 'conforme' : 'revisar'}</span></li>`).join('')}${capas.map((c) => `<li>Capa: <span class="muted">${escapeHtml(c)}</span></li>`).join('')}</ul>${!listagens.length && !capas.length ? '<p class="vazio">Nenhuma listagem ou capa.</p>' : ''}<p class="muted">Renderizador de PNG/PDF: ${renderizador ? `${escapeHtml(renderizador.tipo)}` : 'nenhum (instale Chromium, rsvg-convert, ImageMagick ou Inkscape)'} · IA: ${ia.sdk && ia.credencial ? 'pronta' : 'modo template'}</p></div>
</section>
<section id="passos"><h2>Próximos passos</h2><ol class="lista-passos">${passos.map((p, i) => `<li class="${p.feito ? 'feito' : ''}"><span class="n">${p.feito ? '✓' : i + 1}</span><span>${escapeHtml(p.texto)}<br><code>${escapeHtml(p.cmd)}</code></span></li>`).join('')}</ol></section>
<p class="rodape">Precozen Central · dados internos (comissões, vendas estimadas) — não publique este painel. Estimativas fiscais: <code>precozen fiscal estimar --comissoes 3500 --royalties 400</code>.</p>
</main>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; base-uri 'self'; form-action 'self'; object-src 'none'">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(marca)} · Painel central</title>
<link rel="stylesheet" href="painel.css">
</head>
<body>
${corpo}
</body>
</html>
`;
}

export function construirPainel({ config, out } = {}) {
  const inicio = Date.now();
  const estado = coletarEstado({ config });
  const dir = out ? path.resolve(out) : workspace('painel');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(RAIZ_CENTRAL, 'templates', 'painel.css'), path.join(dir, 'painel.css'));
  const arquivo = gravarTexto(path.join(dir, 'index.html'), htmlPainel(estado));
  return { arquivo, dir, kpis: estado.kpis, ms: Date.now() - inicio };
}
