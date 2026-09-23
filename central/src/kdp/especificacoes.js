// Especificações de impressão do Amazon KDP (paperback): tamanhos de corte, margens, sangria, lombada e limites.
// Valores de referência conferidos em 2026-09; a KDP altera regras sem aviso — confira em kdp.amazon.com/help antes de publicar.

export const TRIMS = {
  '5x8': { largura: 5, altura: 8 },
  '5.06x7.81': { largura: 5.06, altura: 7.81 },
  '5.25x8': { largura: 5.25, altura: 8 },
  '5.5x8.5': { largura: 5.5, altura: 8.5 },
  '6x9': { largura: 6, altura: 9 },
  '6.14x9.21': { largura: 6.14, altura: 9.21 },
  '6.69x9.61': { largura: 6.69, altura: 9.61 },
  '7x10': { largura: 7, altura: 10 },
  '7.44x9.69': { largura: 7.44, altura: 9.69 },
  '7.5x9.25': { largura: 7.5, altura: 9.25 },
  '8x10': { largura: 8, altura: 10 },
  '8.25x6': { largura: 8.25, altura: 6, paisagem: true },
  '8.25x8.25': { largura: 8.25, altura: 8.25 },
  '8.5x8.5': { largura: 8.5, altura: 8.5 },
  '8.5x11': { largura: 8.5, altura: 11 },
  a4: { largura: 8.27, altura: 11.69 },
  a5: { largura: 5.83, altura: 8.27 },
};

/** Espessura por página (polegadas) por tipo de papel. */
export const PAPEIS = {
  branco: { nome: 'Branco (preto e branco)', polPorPagina: 0.002252, tinta: 'pb' },
  creme: { nome: 'Creme (preto e branco)', polPorPagina: 0.0025, tinta: 'pb' },
  'cor-padrao': { nome: 'Cor padrão (papel branco)', polPorPagina: 0.002252, tinta: 'cor-padrao' },
  'cor-premium': { nome: 'Cor premium (papel branco)', polPorPagina: 0.002347, tinta: 'cor-premium' },
};

export const SANGRIA_POL = 0.125;
export const MARGEM_EXTERNA_MIN = { semSangria: 0.25, comSangria: 0.375 };
export const LIMITES_PAGINAS = { pb: { min: 24, max: 828 }, 'cor-premium': { min: 24, max: 828 }, 'cor-padrao': { min: 72, max: 600 } };
export const MIN_PAGINAS_TEXTO_LOMBADA = 79;
export const PT_POR_POL = 72;

/** Margem interna (medianiz) mínima em polegadas, pela contagem de páginas. */
export function margemInterna(paginas) {
  if (paginas <= 150) return 0.375;
  if (paginas <= 300) return 0.5;
  if (paginas <= 500) return 0.625;
  if (paginas <= 700) return 0.75;
  return 0.875;
}

export function trim(id) {
  const t = TRIMS[String(id).toLowerCase()];
  if (!t) throw new Error(`tamanho de corte desconhecido: ${id} (opções: ${Object.keys(TRIMS).join(', ')})`);
  return { id: String(id).toLowerCase(), ...t };
}

export function papel(id) {
  const p = PAPEIS[String(id).toLowerCase()];
  if (!p) throw new Error(`papel desconhecido: ${id} (opções: ${Object.keys(PAPEIS).join(', ')})`);
  return { id: String(id).toLowerCase(), ...p };
}

export function validarPaginas(paginas, tinta = 'pb') {
  const lim = LIMITES_PAGINAS[tinta] || LIMITES_PAGINAS.pb;
  const erros = [];
  if (!Number.isInteger(paginas)) erros.push('número de páginas deve ser inteiro');
  else {
    if (paginas < lim.min) erros.push(`mínimo de ${lim.min} páginas para ${tinta}`);
    if (paginas > lim.max) erros.push(`máximo de ${lim.max} páginas para ${tinta}`);
    if (paginas % 2 !== 0) erros.push('a contagem de páginas deve ser par (a KDP adiciona uma em branco se for ímpar)');
  }
  return erros;
}

/** Largura da lombada em polegadas. */
export function larguraLombada(paginas, papelId = 'branco') {
  return Math.round(paginas * papel(papelId).polPorPagina * 10000) / 10000;
}

/** Página interior em pontos: tamanho (com sangria opcional) e margens mínimas por lado. */
export function paginaInterior(trimId, { sangria = false, paginas = 100, margemExtra = 0 } = {}) {
  const t = trim(trimId);
  const s = sangria ? SANGRIA_POL : 0;
  const larguraPol = t.largura + s; // sangria só na borda externa
  const alturaPol = t.altura + 2 * s;
  const interna = margemInterna(paginas) + margemExtra;
  const externa = (sangria ? MARGEM_EXTERNA_MIN.comSangria : MARGEM_EXTERNA_MIN.semSangria) + margemExtra;
  const topo = externa;
  const base = externa;
  return {
    trim: t, sangria: s, larguraPol, alturaPol,
    largura: larguraPol * PT_POR_POL, altura: alturaPol * PT_POR_POL,
    margens: { topo: topo * PT_POR_POL + s * PT_POR_POL, base: base * PT_POR_POL + s * PT_POR_POL, interna: interna * PT_POR_POL, externa: externa * PT_POR_POL + s * PT_POR_POL },
    margensPol: { topo, base, interna, externa },
  };
}

/** Dimensões da capa completa (verso + lombada + frente) com sangria, em polegadas e pontos. */
export function dimensoesCapa(trimId, paginas, papelId = 'branco') {
  const t = trim(trimId);
  const lombada = larguraLombada(paginas, papelId);
  const larguraPol = SANGRIA_POL * 2 + t.largura * 2 + lombada;
  const alturaPol = SANGRIA_POL * 2 + t.altura;
  const margemSegura = 0.25; // texto e elementos importantes a 0,25" da borda do corte
  return {
    trim: t, paginas, papel: papelId, lombadaPol: lombada, larguraPol: Math.round(larguraPol * 10000) / 10000, alturaPol: Math.round(alturaPol * 10000) / 10000,
    largura: larguraPol * PT_POR_POL, altura: alturaPol * PT_POR_POL, sangria: SANGRIA_POL, margemSegura,
    textoNaLombada: paginas >= MIN_PAGINAS_TEXTO_LOMBADA,
    zonas: {
      verso: { x: SANGRIA_POL, largura: t.largura },
      lombada: { x: SANGRIA_POL + t.largura, largura: lombada },
      frente: { x: SANGRIA_POL + t.largura + lombada, largura: t.largura },
      codigoBarras: { largura: 2, altura: 1.2, distanciaBorda: 0.25 },
    },
    px300: { largura: Math.round(larguraPol * 300), altura: Math.round(alturaPol * 300) },
  };
}

export function listarTrims() {
  return Object.entries(TRIMS).map(([id, t]) => ({ id, ...t, polegadas: `${t.largura}" × ${t.altura}"`, mm: `${Math.round(t.largura * 25.4)} × ${Math.round(t.altura * 25.4)} mm` }));
}
