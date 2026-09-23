// Páginas quadriculadas: grade fina com linha mais forte a cada N células.
import { areaUtil, cabecalho, numeroPagina, MM } from './comum.js';

export const id = 'quadriculado';
export const nome = 'Caderno quadriculado';
export const descricao = 'Grade de 5 mm com reforço a cada 5 células (configurável)';
export const opcoes = { passo: 'mm entre linhas (padrão 5)', reforco: 'linha mais forte a cada N células (0 desliga)' };

export function gerar(doc, spec, { paginas, passo = 5, reforco = 5, numerar = true, cabecalhoTexto = '' } = {}) {
  for (let n = 1; n <= paginas; n++) {
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const p = passo * MM;
    const cols = Math.floor(a.largura / p);
    const lins = Math.floor(a.altura / p);
    const x0 = a.x + (a.largura - cols * p) / 2;
    const y0 = a.y + (a.altura - lins * p) / 2;
    for (let i = 0; i <= cols; i++) pg.linha(x0 + i * p, y0, x0 + i * p, y0 + lins * p, { espessura: reforco && i % reforco === 0 ? 0.6 : 0.25, cor: reforco && i % reforco === 0 ? '#7f8797' : '#b6bdc9' });
    for (let j = 0; j <= lins; j++) pg.linha(x0, y0 + j * p, x0 + cols * p, y0 + j * p, { espessura: reforco && j % reforco === 0 ? 0.6 : 0.25, cor: reforco && j % reforco === 0 ? '#7f8797' : '#b6bdc9' });
    cabecalho(pg, a, cabecalhoTexto);
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas };
}
