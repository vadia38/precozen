// Gerador de análises (reviews) em Markdown com front matter, a partir dos produtos pontuados.
// Modo template (determinístico, sem IA) + modo IA opcional (src/ia) que reescreve/expande as seções.
import path from 'node:path';
import { RAIZ_CENTRAL, gravarTexto, existe } from '../core/arquivos.js';
import { serializar } from '../core/frontmatter.js';
import { criarRng } from '../core/rng.js';
import { slug, formatarMoeda, formatarNumero, dataIso, dataExtenso, arredondar, clamp, truncar } from '../core/util.js';
import { categoriasCanonicas, programas } from './programas.js';
import { carregarRanking } from './analisar.js';

export const DIR_POSTS = path.join(RAIZ_CENTRAL, 'conteudo', 'posts');

/** Nota editorial 0–10 a partir das avaliações, do volume e do ajuste de preço. */
export function notaEditorial(p) {
  const partes = p.pontuacao?.partes || {};
  if (p.avaliacao) {
    const base = p.avaliacao * 2; // 0–10
    const volume = clamp(Math.log10(1 + (p.numAvaliacoes || 0)) / 4, 0, 1); // 0–1
    const preco = (partes.preco ?? 60) / 100;
    return arredondar(clamp(base * 0.8 + volume * 1.2 + preco * 0.8, 0, 10), 1);
  }
  return arredondar(clamp(((partes.qualidade ?? 40) / 100) * 6 + 2, 0, 10), 1);
}

/** Nome curto para chamadas e perguntas: corta em ":", " (", " - ", " com ", ", " e limita a ~45 caracteres. */
export function nomeCurto(nome, max = 45, minimo = 8) {
  const n = String(nome ?? '').trim();
  const cortes = [];
  for (const sep of [': ', ' (', ' - ', ' — ', ' – ', ' com ', ', ', ' para ']) {
    let i = n.indexOf(sep);
    while (i > 0) { cortes.push(i); i = n.indexOf(sep, i + 1); }
  }
  cortes.sort((a, b) => a - b);
  const corte = cortes.find((i) => i >= minimo);
  let curto = corte !== undefined ? n.slice(0, corte).trim() : n;
  if (curto.length > max) {
    const parte = curto.slice(0, max);
    curto = parte.slice(0, parte.lastIndexOf(' ') > 15 ? parte.lastIndexOf(' ') : max).trim();
  }
  return curto.replace(/[\s:,;-]+$/, '');
}

/** Nome médio para títulos (até ~70 caracteres, em limite de palavra). */
export function nomeMedio(nome, max = 70) {
  const n = String(nome ?? '').trim();
  if (n.length <= max) return n;
  const parte = n.slice(0, max);
  return parte.slice(0, parte.lastIndexOf(' ') > 20 ? parte.lastIndexOf(' ') : max).replace(/[\s:,;(-]+$/, '');
}

const TITULOS = [
  (n, ano) => `${n}: vale a pena? Análise completa (${ano})`,
  (n, ano) => `Análise: ${n} — prós, contras e para quem serve (${ano})`,
  (n, ano) => `${n} é bom? O que avaliar antes de comprar (${ano})`,
];

const ABERTURAS = [
  (p, c) => `Se você está pesquisando ${c.toLowerCase()} e o **${p.nome}** apareceu na sua lista, esta análise reúne o que importa para decidir: o que ele entrega, onde deixa a desejar e para quem faz sentido.`,
  (p, c) => `O **${p.nome}** é um dos itens mais procurados em ${c.toLowerCase()}. Aqui você encontra uma análise objetiva, baseada nas especificações oficiais e no que centenas de compradores relatam.`,
  (p, c) => `Antes de fechar a compra do **${p.nome}**, vale entender o que ele realmente oferece. Reunimos especificações, pontos fortes, pontos de atenção e alternativas na mesma faixa de preço.`,
];

const VEREDITOS = {
  alto: [
    'É uma compra segura para a maioria das pessoas: entrega o que promete e tem histórico consistente de avaliações positivas.',
    'Entre as opções da categoria, está entre as mais equilibradas em preço, recursos e satisfação dos compradores.',
  ],
  medio: [
    'É uma boa opção se os pontos de atenção não pesarem no seu uso. Vale comparar com as alternativas abaixo antes de decidir.',
    'Cumpre bem a proposta, mas não é unanimidade: leia os pontos de atenção e veja se combinam com a sua rotina.',
  ],
  baixo: [
    'Só recomendamos se o preço estiver bem abaixo da média ou se um recurso específico for indispensável para você.',
    'Há alternativas com melhor equilíbrio na mesma faixa; considere as opções listadas abaixo.',
  ],
};

function faixaPreco(p) {
  if (!p.preco) return null;
  const v = p.preco;
  if (v < 80) return 'de entrada';
  if (v < 300) return 'intermediária';
  if (v < 1000) return 'premium';
  return 'topo de linha';
}

function textoDemanda(p) {
  if (p.vendasMes === null || p.vendasMes === undefined) return '';
  if (p.vendasMes >= 500) return 'É um dos itens mais vendidos da categoria no momento.';
  if (p.vendasMes >= 100) return 'Tem giro alto de vendas, o que costuma indicar preço competitivo e reposição rápida.';
  if (p.vendasMes >= 20) return 'Tem vendas constantes, sem picos artificiais.';
  return '';
}

function textoAvaliacoes(p) {
  if (!p.avaliacao) return 'Ainda há poucas avaliações públicas, então trate as opiniões com cautela.';
  const n = formatarNumero(p.numAvaliacoes);
  const nota = formatarNumero(p.avaliacao, 1);
  if (p.avaliacao >= 4.6) return `A nota média é **${nota} de 5** em ${n} avaliações, um índice alto para a categoria.`;
  if (p.avaliacao >= 4.2) return `A nota média é **${nota} de 5** em ${n} avaliações: boa, com algumas ressalvas recorrentes.`;
  return `A nota média é **${nota} de 5** em ${n} avaliações, abaixo do que consideramos confortável; leia as críticas antes de comprar.`;
}

export function prosDerivados(p) {
  const lista = [...(p.pros || [])];
  if (lista.length >= 3) return lista.slice(0, 6);
  if (p.avaliacao >= 4.5 && p.numAvaliacoes >= 100) lista.push(`Avaliação média de ${formatarNumero(p.avaliacao, 1)} em ${formatarNumero(p.numAvaliacoes)} opiniões`);
  if (p.precoAntigo && p.preco) lista.push(`Preço atual ${formatarNumero((1 - p.preco / p.precoAntigo) * 100)}% abaixo do valor de referência`);
  if (p.marca) lista.push(`Marca com histórico na categoria (${p.marca})`);
  for (const [k, v] of Object.entries(p.atributos || {}).slice(0, 2)) lista.push(`${k[0].toUpperCase() + k.slice(1)}: ${v}`);
  return [...new Set(lista)].slice(0, 6);
}

export function contrasDerivados(p, cats = categoriasCanonicas()) {
  const lista = [...(p.contras || [])];
  const genericos = cats[p.categoria]?.atencao || cats.outros.atencao;
  for (const g of genericos) if (lista.length < 4) lista.push(g);
  if (lista.length < 4) lista.push('O preço muda com frequência nos marketplaces: confira o valor atual antes de decidir.');
  return [...new Set(lista)].slice(0, 5);
}

function tabelaFicha(p) {
  const entradas = Object.entries(p.atributos || {});
  if (!entradas.length) return '';
  const linhas = entradas.map(([k, v]) => `| ${k[0].toUpperCase() + k.slice(1)} | ${String(v).replace(/\|/g, '/')} |`);
  return ['| Item | Especificação |', '|---|---|', ...linhas].join('\n');
}

function alternativas(p, ranking, max = 3) {
  const lista = (ranking?.produtos || []).filter((o) => o.id !== p.id && o.categoria === p.categoria && o.preco);
  return lista.slice(0, max);
}

function tabelaAlternativas(p, alts) {
  if (!alts.length) return '';
  const linha = (o, atual) => `| ${atual ? '**' : ''}${o.nome.replace(/\|/g, '/')}${atual ? '** (analisado)' : ''} | ${o.preco ? formatarMoeda(o.preco, o.moeda) : '—'} | ${o.avaliacao ? `${formatarNumero(o.avaliacao, 1)} (${formatarNumero(o.numAvaliacoes)})` : '—'} | ${o.link ? `[ver oferta](${o.link}){:afiliado}` : '—'} |`;
  return ['| Produto | Preço | Avaliação | Onde ver |', '|---|---:|---:|---|', linha(p, true), ...alts.map((o) => linha(o, false))].join('\n');
}

function perguntas(p, programaNome) {
  const curto = nomeCurto(p.nome);
  const digital = programas()[p.programa]?.tipo === 'digital' || p.categoria === 'cursos';
  const garantia = digital
    ? `Produtos digitais vendidos pela ${programaNome} têm garantia de reembolso de no mínimo 7 dias (o produtor pode oferecer prazo maior${p.atributos?.garantia ? `; aqui consta "${p.atributos.garantia}"` : ''}). O pedido é feito na própria plataforma, sem depender do vendedor.`
    : p.atributos?.garantia
      ? `Sim: o fabricante informa ${p.atributos.garantia} de garantia. Além disso, compras online têm 7 dias de arrependimento pelo Código de Defesa do Consumidor.`
      : 'Compras online no Brasil têm 7 dias de arrependimento pelo Código de Defesa do Consumidor. A garantia do fabricante varia por vendedor; confira na página do produto antes de comprar.';
  return [
    [`Onde comprar ${curto} com segurança?`, digital ? `Compre pela página oficial na ${programaNome}: o pagamento, o acesso e a garantia ficam com a plataforma. O link desta análise leva à página oficial do produto.` : `Prefira lojas com histórico, como ${programaNome}, e confira se o vendedor tem boas avaliações e política de troca clara. O link desta análise leva à página oficial do produto.`],
    [`${curto} tem garantia?`, garantia],
    [`Qual é o melhor momento para comprar ${curto}?`, digital ? 'Produtores costumam abrir promoções em datas específicas (lançamentos, Black Friday). Se a garantia de reembolso cobre seu prazo de teste, não há motivo para esperar muito.' : 'Os preços nos marketplaces oscilam ao longo do mês. Compare o valor atual com o histórico recente e aproveite datas promocionais (Black Friday, aniversário da loja) quando o desconto for real.'],
  ];
}

/**
 * Gera uma análise em Markdown (template) para um produto pontuado.
 * Devolve { meta, corpo, arquivo, slug }.
 */
export function gerarReview(p, { config, ranking, hoje = new Date(), semente } = {}) {
  const rng = criarRng(semente || p.id);
  const ano = new Date(hoje).getUTCFullYear();
  const marca = config?.marca || {};
  const cats = categoriasCanonicas();
  const categoriaNome = p.categoriaNome || cats[p.categoria]?.nome || 'Produtos';
  const programaNome = programas()[p.programa]?.nome?.replace(/\s*\(.*\)$/, '') || p.programa;
  const nota = notaEditorial(p);
  const titulo = rng.escolher(TITULOS)(nomeMedio(p.nome), ano);
  const slugPost = slug(`${p.nome}-analise`, 90);
  const pros = prosDerivados(p);
  const contras = contrasDerivados(p, cats);
  const alts = alternativas(p, ranking);
  const faixa = faixaPreco(p);
  const nivel = nota >= 8.5 ? 'alto' : nota >= 7 ? 'medio' : 'baixo';
  const cta = p.link ? `[Ver preço atual de ${nomeCurto(p.nome)} →](${p.link}){:afiliado .botao}` : '';
  const descricao = truncar(`${p.nome}: análise com prós, contras, ficha técnica, alternativas e nota ${formatarNumero(nota, 1)}/10. ${p.publico ? `Indicado para ${p.publico}.` : ''}`, 155);

  const resumo = `> **Resumo rápido** · Nota ${formatarNumero(nota, 1)}/10 · ${p.preco ? `${formatarMoeda(p.preco, p.moeda)}${faixa ? ` (faixa ${faixa})` : ''}` : 'preço sob consulta'}${p.avaliacao ? ` · ${formatarNumero(p.avaliacao, 1)}★ em ${formatarNumero(p.numAvaliacoes)} avaliações` : ''}${p.publico ? ` · Ideal para ${p.publico}` : ''}`;
  const ficha = Object.keys(p.atributos || {}).length ? ['## Ficha técnica', '', tabelaFicha(p), ''].join('\n') : '';
  const alternativasMd = alts.length ? ['## Comparação com alternativas', '', `Outras opções de ${categoriaNome.toLowerCase()} que analisamos, na mesma faixa de uso:`, '', tabelaAlternativas(p, alts), ''].join('\n') : '';
  const rodape = `*${config?.blog?.metodologia || 'Análise baseada em especificações oficiais e avaliações públicas.'} Preço consultado em ${dataExtenso(hoje)}; pode mudar sem aviso. ${marca.nome || 'Este site'} pode receber comissão por compras feitas pelos links, sem custo extra para você.*`;
  const faq = perguntas(p, programaNome);

  const corpo = [
    rng.escolher(ABERTURAS)(p, categoriaNome),
    '',
    resumo,
    '',
    cta,
    '',
    '## O que é e para quem serve',
    '',
    p.descricao ? p.descricao : `O ${p.nome} é um produto da categoria ${categoriaNome.toLowerCase()}${p.marca ? `, da marca ${p.marca}` : ''}.`,
    '',
    [p.publico ? `**Para quem é:** ${p.publico}.` : '', textoDemanda(p), textoAvaliacoes(p)].filter(Boolean).join(' '),
    '',
    '## Pontos fortes',
    '',
    ...pros.map((x) => `- ${x}`),
    '',
    '## Pontos de atenção',
    '',
    ...contras.map((x) => `- ${x}`),
    '',
    ficha,
    alternativasMd,
    '## Veredito',
    '',
    `**Nota ${formatarNumero(nota, 1)}/10.** ${rng.escolher(VEREDITOS[nivel])}${p.publico ? ` Faz mais sentido para ${p.publico}.` : ''}`,
    '',
    cta,
    '',
    '## Perguntas frequentes',
    '',
    ...faq.flatMap(([q, a]) => [`### ${q}`, '', a, '']),
    `---`,
    '',
    rodape,
  ].filter((l) => l !== null && l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');

  const meta = {
    titulo, slug: slugPost, descricao, tipo: 'review', data: dataIso(hoje), atualizado: dataIso(hoje),
    categoria: p.categoria, categoriaNome, produto: p.id, programa: p.programa, produtoNome: p.nome, marca: p.marca || '',
    nota, preco: p.preco ?? '', moeda: p.moeda, avaliacao: p.avaliacao ?? '', numAvaliacoes: p.numAvaliacoes || 0,
    link: p.link || '', url: p.url || '', imagem: p.imagem || '', tags: [...new Set([categoriaNome, ...(p.palavrasChave || []).slice(0, 4)])],
    pros, contras, gerador: 'template', autor: marca.autor || '',
  };
  return { meta, corpo, slug: slugPost, arquivo: `${slugPost}.md`, partes: { resumo, cta, ficha, alternativas: alternativasMd, rodape, faq, pros, contras, nota, categoriaNome, programaNome, textoDemanda: textoDemanda(p), textoAvaliacoes: textoAvaliacoes(p) } };
}

export function salvarPost(post, dir = DIR_POSTS) {
  const caminho = path.join(dir, post.arquivo);
  gravarTexto(caminho, serializar(post.meta, post.corpo));
  return caminho;
}

/**
 * Gera reviews para os melhores produtos do ranking. opcoes: { top, ids, classes, forcar, ia, dir, hoje }
 */
export async function gerarReviews({ config, top = 10, ids, classes = ['ouro', 'prata'], forcar = false, ia = false, dir = DIR_POSTS, hoje = new Date(), ranking } = {}) {
  const r = ranking || carregarRanking();
  if (!r) throw new Error('rode antes: precozen afiliados analisar');
  let selecionados = r.produtos;
  if (ids?.length) selecionados = selecionados.filter((p) => ids.includes(p.id) || ids.includes(p.identificador));
  else selecionados = selecionados.filter((p) => classes.includes(p.pontuacao.classe)).slice(0, top);
  const gerados = [];
  const pulados = [];
  let escritor = null;
  if (ia) {
    const mod = await import('../ia/reviews.js');
    escritor = mod.reescreverReview;
  }
  for (const p of selecionados) {
    let post = gerarReview(p, { config, ranking: r, hoje });
    const caminho = path.join(dir, post.arquivo);
    if (existe(caminho) && !forcar) { pulados.push(post.arquivo); continue; }
    if (escritor) post = await escritor(post, p, { config });
    salvarPost(post, dir);
    gerados.push(post.arquivo);
  }
  return { gerados, pulados, dir };
}
