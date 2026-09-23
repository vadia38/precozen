// Helpers compartilhados pelos interiores: área útil por página (margens espelhadas), cabeçalho, numeração e títulos.

/** Área útil da página n (1 = direita/ímpar). Margem interna fica à esquerda nas ímpares e à direita nas pares. */
export function areaUtil(spec, numero) {
  const impar = numero % 2 === 1;
  const esquerda = impar ? spec.margens.interna : spec.margens.externa;
  const direita = impar ? spec.margens.externa : spec.margens.interna;
  return { x: esquerda, y: spec.margens.topo, largura: spec.largura - esquerda - direita, altura: spec.altura - spec.margens.topo - spec.margens.base, impar, direita: spec.largura - direita, base: spec.altura - spec.margens.base };
}

export function cabecalho(pagina, area, texto, { tamanho = 9, cor = '#666' } = {}) {
  if (!texto) return;
  pagina.texto(texto, area.impar ? area.direita : area.x, area.y - 6, { fonte: 'regular', tamanho, cor, alinhamento: area.impar ? 'direita' : 'esquerda' });
}

export function numeroPagina(pagina, area, numero, { tamanho = 9, cor = '#666' } = {}) {
  pagina.texto(String(numero), area.x + area.largura / 2, area.base + 18, { fonte: 'regular', tamanho, cor, alinhamento: 'centro' });
}

export function tituloPagina(pagina, area, titulo, { tamanho = 16, subtitulo, cor = '#111' } = {}) {
  pagina.texto(titulo, area.x + area.largura / 2, area.y + tamanho, { fonte: 'negrito', tamanho, cor, alinhamento: 'centro' });
  if (subtitulo) pagina.texto(subtitulo, area.x + area.largura / 2, area.y + tamanho + 14, { fonte: 'regular', tamanho: 10, cor: '#555', alinhamento: 'centro' });
  return area.y + tamanho + (subtitulo ? 26 : 14);
}

/** Distribui itens em uma grade de células (colunas × linhas) dentro da área. */
export function celulas(area, colunas, linhas, { espaco = 12, topo = 0 } = {}) {
  const w = (area.largura - espaco * (colunas - 1)) / colunas;
  const h = (area.altura - topo - espaco * (linhas - 1)) / linhas;
  const out = [];
  for (let l = 0; l < linhas; l++) for (let c = 0; c < colunas; c++) out.push({ x: area.x + c * (w + espaco), y: area.y + topo + l * (h + espaco), largura: w, altura: h });
  return out;
}

export const MM = 72 / 25.4;
