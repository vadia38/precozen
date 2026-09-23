// Páginas pontilhadas (bullet journal): grade de pontos com passo configurável.
import { areaUtil, cabecalho, numeroPagina, MM } from './comum.js';

export const id = 'pontilhado';
export const nome = 'Caderno pontilhado';
export const descricao = 'Grade de pontos (5 mm por padrão), numeração discreta';
export const opcoes = { passo: 'mm entre pontos (padrão 5)', raio: 'raio do ponto em pt (padrão 0.6)' };

export function gerar(doc, spec, { paginas, passo = 5, raio = 0.6, numerar = true, cabecalhoTexto = '' } = {}) {
  for (let n = 1; n <= paginas; n++) {
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const p = passo * MM;
    const cols = Math.floor(a.largura / p);
    const lins = Math.floor(a.altura / p);
    const x0 = a.x + (a.largura - cols * p) / 2 + p / 2;
    const y0 = a.y + (a.altura - lins * p) / 2 + p / 2;
    const ops = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) ops.push([x0 + i * p, y0 + j * p]);
    // desenha como pequenos círculos preenchidos (agrupados em um único caminho para reduzir o tamanho)
    for (const [x, y] of ops) pg.circulo(x, y, raio, { preenchimento: '#8a93a3' });
    cabecalho(pg, a, cabecalhoTexto);
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas };
}
