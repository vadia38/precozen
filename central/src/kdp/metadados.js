// Metadados de publicação KDP: limites, palavras proibidas, geração por template e validação.
import { slug, truncar, tituloCaso } from '../core/util.js';

export const LIMITES = { titulo: 200, subtitulo: 200, tituloMaisSubtitulo: 200, descricao: 4000, palavrasChave: 7, palavraChave: 50, categorias: 3, nomeAutor: 100 };

/** Termos que a KDP proíbe ou desaconselha em títulos e palavras-chave. */
export const TERMOS_PROIBIDOS = ['grátis', 'gratis', 'free', 'best seller', 'bestseller', 'best-seller', 'mais vendido', 'novo', 'new', 'promoção', 'sale', 'kindle unlimited', 'kindle', 'amazon', 'ebook', 'e-book', 'livro', 'book', 'notebook', 'edição limitada', 'garantido', 'guaranteed', 'cura', 'cure'];

const TAGS_HTML_PERMITIDAS = ['p', 'b', 'i', 'u', 'br', 'ul', 'ol', 'li', 'h4', 'h5', 'h6', 'em', 'strong'];

function limparHtml(html) {
  return String(html ?? '').replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (m, tag) => (TAGS_HTML_PERMITIDAS.includes(tag.toLowerCase()) ? `<${m.startsWith('</') ? '/' : ''}${tag.toLowerCase()}>` : ''));
}

export function validarMetadados(meta) {
  const avisos = [];
  const erros = [];
  const titulo = String(meta.titulo || '');
  const subtitulo = String(meta.subtitulo || '');
  if (!titulo.trim()) erros.push('título vazio');
  if (titulo.length > LIMITES.titulo) erros.push(`título com ${titulo.length} caracteres (máximo ${LIMITES.titulo})`);
  if (titulo.length + subtitulo.length > LIMITES.tituloMaisSubtitulo) avisos.push(`título + subtítulo com ${titulo.length + subtitulo.length} caracteres (a KDP aceita até ${LIMITES.tituloMaisSubtitulo} no conjunto)`);
  const descricao = String(meta.descricaoHtml || meta.descricao || '');
  if (descricao.length > LIMITES.descricao) erros.push(`descrição com ${descricao.length} caracteres (máximo ${LIMITES.descricao})`);
  if (descricao.length < 200) avisos.push('descrição curta: descrições com 800 a 2.000 caracteres convertem melhor');
  const pcs = meta.palavrasChave || [];
  if (pcs.length > LIMITES.palavrasChave) erros.push(`${pcs.length} palavras-chave (máximo ${LIMITES.palavrasChave})`);
  if (pcs.length < LIMITES.palavrasChave) avisos.push(`use as ${LIMITES.palavrasChave} palavras-chave disponíveis (há ${pcs.length})`);
  for (const pc of pcs) if (String(pc).length > LIMITES.palavraChave) erros.push(`palavra-chave longa demais: "${truncar(pc, 30)}" (${String(pc).length}/${LIMITES.palavraChave})`);
  const baixo = (s) => String(s).toLowerCase();
  for (const termo of TERMOS_PROIBIDOS) {
    const re = new RegExp(`(^|[^\\p{L}])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
    if (re.test(baixo(titulo)) || re.test(baixo(subtitulo))) avisos.push(`título/subtítulo contém "${termo}", termo que a KDP pode rejeitar`);
    for (const pc of pcs) if (re.test(baixo(pc))) avisos.push(`palavra-chave "${pc}" contém "${termo}"`);
  }
  const vistas = new Set();
  for (const pc of pcs) { const k = baixo(pc).trim(); if (vistas.has(k)) avisos.push(`palavra-chave repetida: "${pc}"`); vistas.add(k); }
  const cats = meta.categorias || [];
  if (cats.length > LIMITES.categorias) erros.push(`${cats.length} categorias (máximo ${LIMITES.categorias})`);
  if (!meta.autor) avisos.push('sem nome de autor');
  return { erros, avisos, valido: erros.length === 0 };
}

const TIPOS = {
  'caca-palavras': { nome: 'Caça-palavras', publico: 'adultos, idosos e crianças a partir de 8 anos', beneficios: ['exercita a atenção e o vocabulário', 'letra grande para ler com conforto', 'soluções no final'] },
  sudoku: { nome: 'Sudoku', publico: 'quem gosta de lógica, do iniciante ao avançado', beneficios: ['grades grandes e fáceis de preencher', 'níveis progressivos', 'todas as soluções no final'] },
  labirinto: { nome: 'Labirintos', publico: 'crianças e adultos', beneficios: ['dificuldade progressiva', 'traçado limpo, sem confusão visual', 'soluções no final'] },
  pautado: { nome: 'Caderno pautado', publico: 'estudantes, escritores e quem gosta de anotar', beneficios: ['linhas claras e espaçamento confortável', 'papel branco de boa gramatura', 'formato prático'] },
  pontilhado: { nome: 'Caderno pontilhado', publico: 'quem usa bullet journal, desenho e planejamento', beneficios: ['grade de pontos discreta', 'flexível para listas, esboços e tabelas', 'páginas numeradas'] },
  quadriculado: { nome: 'Caderno quadriculado', publico: 'estudantes de exatas, engenheiros e designers', beneficios: ['grade precisa', 'ideal para gráficos, plantas e cálculos', 'formato prático'] },
  planner: { nome: 'Planner', publico: 'quem quer organizar a semana e o mês', beneficios: ['visão mensal e semanal', 'espaço para metas e prioridades', 'começa em qualquer mês'] },
  habitos: { nome: 'Rastreador de hábitos', publico: 'quem quer criar rotinas e acompanhar metas', beneficios: ['acompanhamento diário por 12 meses', 'espaço para reflexões', 'visual simples que motiva'] },
  texto: { nome: 'Guia', publico: 'leitores interessados no tema', beneficios: ['linguagem clara', 'capítulos objetivos', 'exemplos práticos'] },
  imagens: { nome: 'Páginas para colorir', publico: 'crianças e adultos', beneficios: ['impressão em página inteira', 'imagens de um lado só da folha', 'papel branco'] },
};

/** Gera metadados sem IA, a partir do tipo e do tema do livro. */
export function gerarMetadadosTemplate({ tipo = 'pautado', tema = '', titulo, subtitulo, autor, paginas, trim, quantidade, idioma = 'pt-BR', publico, extras = [] } = {}) {
  const t = TIPOS[tipo] || TIPOS.texto;
  const temaTxt = tema ? tituloCaso(tema) : '';
  const tituloFinal = titulo || (temaTxt ? `${t.nome}: ${temaTxt}` : t.nome);
  const qtd = quantidade ? `${quantidade} ${tipo === 'sudoku' ? 'jogos' : tipo === 'labirinto' ? 'labirintos' : tipo === 'caca-palavras' ? 'caça-palavras' : 'páginas'}` : paginas ? `${paginas} páginas` : '';
  const subtituloFinal = subtitulo || [qtd, trim ? `formato ${trim.replace('x', ' × ')} pol` : '', t.beneficios[0]].filter(Boolean).join(' · ');
  const beneficios = [...t.beneficios, ...extras].map((b) => `<li>${b[0].toUpperCase()}${b.slice(1)}</li>`).join('');
  const descricaoHtml = `<p><b>${tituloFinal}</b>${temaTxt ? ` reúne ${t.nome.toLowerCase()} sobre ${temaTxt.toLowerCase()}` : ''} em um formato pensado para ${publico || t.publico}.</p>` +
    `<p>O que você encontra:</p><ul>${beneficios}${qtd ? `<li>${qtd[0].toUpperCase()}${qtd.slice(1)}</li>` : ''}${trim ? `<li>Formato ${trim.replace('x', ' × ')} polegadas, fácil de levar</li>` : ''}</ul>` +
    `<p>Ideal para presentear ou para o uso diário. Capa flexível e acabamento de qualidade.</p>`;
  const base = tipo === 'texto'
    ? [temaTxt.toLowerCase(), `guia prático ${temaTxt.toLowerCase()}`.trim(), publico || t.publico, `${temaTxt.toLowerCase()} para iniciantes`.trim(), 'passo a passo', 'exemplos práticos', 'aprenda em casa']
    : [t.nome.toLowerCase(), temaTxt ? `${t.nome.toLowerCase()} ${temaTxt.toLowerCase()}` : '', publico || t.publico, `${t.nome.toLowerCase()} para adultos`, `${t.nome.toLowerCase()} letra grande`, 'presente criativo', 'passatempo'];
  const palavrasChave = [...new Set(base.filter(Boolean).map((k) => truncar(k, 50).replace(/…$/, '')))].slice(0, 7);
  while (palavrasChave.length < 7) palavrasChave.push(['atividades', 'lazer', 'organização', 'estudo', 'diário', 'anotações', 'planejamento'][palavrasChave.length]);
  const categorias = tipo === 'texto' ? ['Não ficção > Geral'] : ['Jogos e atividades > Passatempos e quebra-cabeças', 'Autoajuda > Criatividade', 'Não ficção > Referência'];
  return { titulo: tituloFinal, subtitulo: subtituloFinal, autor: autor || '', descricaoHtml, palavrasChave: palavrasChave.slice(0, 7), categorias: categorias.slice(0, 3), idioma, publico: publico || t.publico, slug: slug(tituloFinal, 60), gerador: 'template' };
}

export function limparDescricao(html) {
  return limparHtml(html);
}

export function tiposDisponiveis() {
  return Object.entries(TIPOS).map(([id, t]) => ({ id, nome: t.nome, publico: t.publico }));
}
