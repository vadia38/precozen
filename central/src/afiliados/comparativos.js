// Comparativos por categoria: "Os N melhores <categoria> de <ano>", a partir do ranking.
import path from 'node:path';
import { existe } from '../core/arquivos.js';
import { slug, formatarMoeda, formatarNumero, dataIso, dataExtenso, agrupar, truncar } from '../core/util.js';
import { carregarRanking } from './analisar.js';
import { notaEditorial, salvarPost, DIR_POSTS } from './reviews.js';

export function gerarComparativo(categoriaId, produtos, { config, hoje = new Date(), maximo = 7 } = {}) {
  const lista = produtos.filter((p) => p.preco).slice(0, maximo);
  if (lista.length < 2) return null;
  const ano = new Date(hoje).getUTCFullYear();
  const categoriaNome = lista[0].categoriaNome;
  const titulo = `Os ${lista.length} melhores produtos de ${categoriaNome} em ${ano}`;
  const slugPost = slug(`melhores-${categoriaNome}-${ano}`, 90);
  const maisBarato = [...lista].sort((a, b) => a.preco - b.preco)[0];
  const melhorNota = [...lista].sort((a, b) => notaEditorial(b) - notaEditorial(a))[0];
  const linhas = lista.map((p, i) => `| ${i + 1} | [${p.nome.replace(/\|/g, '/')}](/post/${slug(`${p.nome}-analise`, 90)}/) | ${formatarMoeda(p.preco, p.moeda)} | ${p.avaliacao ? `${formatarNumero(p.avaliacao, 1)} (${formatarNumero(p.numAvaliacoes)})` : '—'} | ${formatarNumero(notaEditorial(p), 1)} | ${p.link ? `[ver oferta](${p.link}){:afiliado}` : '—'} |`);
  const secoes = lista.map((p, i) => [
    `## ${i + 1}. ${p.nome}`,
    '',
    `${p.descricao ? truncar(p.descricao, 260) : `Opção ${i === 0 ? 'mais bem colocada' : 'sólida'} da categoria.`} ${p.publico ? `Indicado para ${p.publico}.` : ''}`,
    '',
    `- **Preço:** ${formatarMoeda(p.preco, p.moeda)}${p.precoAntigo ? ` (de ${formatarMoeda(p.precoAntigo, p.moeda)})` : ''}`,
    `- **Avaliação:** ${p.avaliacao ? `${formatarNumero(p.avaliacao, 1)} de 5 em ${formatarNumero(p.numAvaliacoes)} opiniões` : 'poucas avaliações públicas'}`,
    `- **Nota editorial:** ${formatarNumero(notaEditorial(p), 1)}/10`,
    ...(p.pros?.length ? [`- **Destaque:** ${p.pros[0]}`] : []),
    ...(p.contras?.length ? [`- **Atenção:** ${p.contras[0]}`] : []),
    '',
    p.link ? `[Ver preço atual →](${p.link}){:afiliado .botao}` : '',
    '',
    `[Leia a análise completa](/post/${slug(`${p.nome}-analise`, 90)}/)`,
    '',
  ].join('\n'));
  const corpo = [
    `Comparamos ${lista.length} opções de **${categoriaNome.toLowerCase()}** com base em preço, avaliações públicas, volume de vendas e especificações. A tabela resume; abaixo, os detalhes de cada uma.`,
    '',
    `> **Escolha rápida** · Melhor avaliado: **${melhorNota.nome}** · Mais barato: **${maisBarato.nome}** (${formatarMoeda(maisBarato.preco, maisBarato.moeda)})`,
    '',
    '| # | Produto | Preço | Avaliação | Nota | Onde ver |',
    '|---|---|---:|---:|---:|---|',
    ...linhas,
    '',
    ...secoes,
    '## Como escolhemos',
    '',
    `${config?.blog?.metodologia || 'Analisamos especificações e avaliações públicas.'} A ordem considera nota dos compradores, volume de avaliações, faixa de preço e consistência de vendas.`,
    '',
    '---',
    '',
    `*Preços consultados em ${dataExtenso(hoje)}; podem mudar sem aviso. Podemos receber comissão por compras feitas pelos links, sem custo extra para você.*`,
  ].join('\n');
  const meta = {
    titulo, slug: slugPost, descricao: truncar(`Comparativo ${ano}: ${lista.map((p) => p.nome).join(', ')}. Preços, avaliações e notas para escolher ${categoriaNome.toLowerCase()} sem erro.`, 155),
    tipo: 'comparativo', data: dataIso(hoje), atualizado: dataIso(hoje), categoria: categoriaId, categoriaNome,
    produtos: lista.map((p) => p.id), tags: [categoriaNome, 'melhores', String(ano)], gerador: 'template', autor: config?.marca?.autor || '',
  };
  return { meta, corpo, slug: slugPost, arquivo: `${slugPost}.md` };
}

export function gerarComparativos({ config, minimo = 3, forcar = false, dir = DIR_POSTS, hoje = new Date(), ranking } = {}) {
  const r = ranking || carregarRanking();
  if (!r) throw new Error('rode antes: precozen afiliados analisar');
  const grupos = agrupar(r.produtos.filter((p) => p.pontuacao.classe !== 'descartar'), 'categoria');
  const gerados = [];
  const pulados = [];
  for (const [cat, produtos] of grupos) {
    if (produtos.length < minimo) continue;
    const post = gerarComparativo(cat, produtos, { config, hoje });
    if (!post) continue;
    if (existe(path.join(dir, post.arquivo)) && !forcar) { pulados.push(post.arquivo); continue; }
    salvarPost(post, dir);
    gerados.push(post.arquivo);
  }
  return { gerados, pulados, dir };
}
