// Rastreador de hábitos: uma página por mês com grade hábitos × dias e espaço para reflexão.
import { MESES, capitalizar } from '../../core/util.js';
import { areaUtil, numeroPagina, tituloPagina } from './comum.js';

export const id = 'habitos';
export const nome = 'Rastreador de hábitos';
export const descricao = 'Grade mensal (até 31 dias × N hábitos) com linhas em branco para os hábitos e área de reflexão';
export const opcoes = { inicio: 'mês inicial AAAA-MM (padrão: próximo janeiro)', meses: 'quantidade de meses (padrão 12)', habitos: 'linhas de hábitos por página (padrão 12)' };

export function gerar(doc, spec, { inicio, meses = 12, habitos = 12, numerar = true } = {}) {
  const hoje = new Date();
  let [ano, mes] = inicio ? String(inicio).split('-').map(Number) : [hoje.getUTCFullYear() + 1, 1];
  if (!ano || !mes || mes < 1 || mes > 12) throw new Error('--inicio deve ser AAAA-MM');
  mes -= 1;
  let n = 0;
  for (let m = 0; m < meses; m++) {
    const anoAtual = ano + Math.floor((mes + m) / 12);
    const mesAtual = (mes + m) % 12;
    const dias = new Date(Date.UTC(anoAtual, mesAtual + 1, 0)).getUTCDate();
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const yTopo = tituloPagina(pg, a, `${capitalizar(MESES[mesAtual])} ${anoAtual}`, { tamanho: 16, subtitulo: 'Marque cada dia em que cumpriu o hábito' });
    const colHabito = Math.max(70, a.largura * 0.28);
    const cel = (a.largura - colHabito) / dias;
    const linhaAlt = Math.min(18, (a.altura * 0.62) / habitos);
    const y0 = yTopo + 10;
    pg.texto('Hábito', a.x + 3, y0 + 10, { fonte: 'negrito', tamanho: 8 });
    for (let d = 1; d <= dias; d++) pg.texto(String(d), a.x + colHabito + (d - 1) * cel + cel / 2, y0 + 10, { tamanho: Math.min(7, cel * 0.8), alinhamento: 'centro', cor: '#333' });
    for (let h = 0; h <= habitos; h++) pg.linha(a.x, y0 + 14 + h * linhaAlt, a.direita, y0 + 14 + h * linhaAlt, { espessura: h === 0 ? 0.8 : 0.35, cor: h === 0 ? '#333' : '#aaa' });
    for (let d = 0; d <= dias; d++) pg.linha(a.x + colHabito + d * cel, y0 + 14, a.x + colHabito + d * cel, y0 + 14 + habitos * linhaAlt, { espessura: d === 0 ? 0.8 : 0.3, cor: d === 0 ? '#333' : '#bbb' });
    pg.linha(a.x, y0 + 14, a.x, y0 + 14 + habitos * linhaAlt, { espessura: 0.8, cor: '#333' });
    const yR = y0 + 14 + habitos * linhaAlt + 24;
    pg.texto('Reflexão do mês', a.x, yR, { fonte: 'negrito', tamanho: 10 });
    for (let i = 1; yR + 6 + i * 16 < a.base; i++) pg.linha(a.x, yR + 6 + i * 16, a.direita, yR + 6 + i * 16, { espessura: 0.4, cor: '#aaa' });
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas: n, meses };
}
