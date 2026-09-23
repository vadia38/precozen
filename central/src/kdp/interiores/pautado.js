// Páginas pautadas: espaçamento configurável, linha de margem, campo de data e numeração.
import { areaUtil, cabecalho, numeroPagina, MM } from './comum.js';

export const id = 'pautado';
export const nome = 'Caderno pautado';
export const descricao = 'Linhas horizontais (espaçamento colegial 7,1 mm por padrão), margem e campo de data opcionais';
export const opcoes = { espacamento: 'mm entre linhas (padrão 7.1)', margemLinha: 'linha vertical de margem (sim/não)', data: 'campo "Data:" no topo (sim/não)' };

export function gerar(doc, spec, { paginas, espacamento = 7.1, margemLinha = true, data = true, numerar = true, cabecalhoTexto = '' } = {}) {
  for (let n = 1; n <= paginas; n++) {
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    let y = a.y;
    if (data) { pg.texto('Data: ____ / ____ / ________', a.direita, y + 10, { tamanho: 9, cor: '#555', alinhamento: 'direita' }); y += 22; }
    const passo = espacamento * MM;
    const primeira = y + passo;
    for (let ly = primeira; ly <= a.base; ly += passo) pg.linha(a.x, ly, a.direita, ly, { espessura: 0.5, cor: '#9aa3b2' });
    if (margemLinha) { const mx = a.x + 18 * MM; pg.linha(mx, y, mx, a.base, { espessura: 0.7, cor: '#e07a7a' }); }
    cabecalho(pg, a, cabecalhoTexto);
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas };
}
