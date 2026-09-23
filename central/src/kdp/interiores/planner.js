// Planner: páginas mensais (calendário com feriados nacionais), semanais e de metas, a partir de um mês inicial.
import { MESES, DIAS_SEMANA_CURTO, capitalizar } from '../../core/util.js';
import { areaUtil, numeroPagina, tituloPagina, MM } from './comum.js';

export const id = 'planner';
export const nome = 'Planner';
export const descricao = 'Calendário mensal com feriados nacionais, páginas semanais e metas, começando em qualquer mês';
export const opcoes = { inicio: 'mês inicial AAAA-MM (padrão: próximo janeiro)', meses: 'quantidade de meses (padrão 12)', semanais: 'inclui páginas semanais (sim/não)' };

/** Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano) {
  const a = ano % 19; const b = Math.floor(ano / 100); const c = ano % 100; const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Feriados nacionais brasileiros (fixos + móveis) como mapa "MM-DD" → nome. */
export function feriadosBrasil(ano) {
  const f = { '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência', '10-12': 'N. Sra. Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
  const p = pascoa(ano);
  const add = (dias, nome) => { const d = new Date(p); d.setUTCDate(d.getUTCDate() + dias); f[`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`] = nome; };
  add(-47, 'Carnaval'); add(-2, 'Sexta-feira Santa'); add(60, 'Corpus Christi');
  return f;
}

function paginaMes(pg, a, ano, mes, feriados, { linhasNotas = true } = {}) {
  const yTopo = tituloPagina(pg, a, `${capitalizar(MESES[mes])} ${ano}`, { tamanho: 18 });
  const colunas = 7;
  const w = a.largura / colunas;
  const yCab = yTopo + 8;
  DIAS_SEMANA_CURTO.forEach((d, i) => pg.texto(d, a.x + i * w + w / 2, yCab + 10, { fonte: 'negrito', tamanho: 9, alinhamento: 'centro', cor: '#333' }));
  const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const semanas = Math.ceil((primeiro + dias) / 7);
  const alturaDisponivel = a.altura - (yCab + 16 - a.y) - (linhasNotas ? 90 : 0);
  const h = Math.min(alturaDisponivel / semanas, 95);
  const y0 = yCab + 16;
  for (let s = 0; s < semanas; s++) for (let d = 0; d < 7; d++) {
    const x = a.x + d * w; const y = y0 + s * h;
    const dia = s * 7 + d - primeiro + 1;
    pg.retangulo(x, y, w, h, { contorno: '#999', espessura: 0.5 });
    if (dia >= 1 && dia <= dias) {
      const chave = `${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const feriado = feriados[chave];
      if (d === 0 || d === 6 || feriado) pg.retangulo(x + 0.5, y + 0.5, w - 1, h - 1, { preenchimento: '#f1f3f7' });
      pg.texto(String(dia), x + 4, y + 11, { fonte: 'negrito', tamanho: 9, cor: '#222' });
      if (feriado) pg.paragrafo(feriado, x + 3, y + 14, w - 6, { tamanho: 6, entrelinha: 1.15, cor: '#555', maxLinhas: 2 });
    }
  }
  if (linhasNotas) {
    const yN = y0 + semanas * h + 14;
    pg.texto('Prioridades do mês', a.x, yN, { fonte: 'negrito', tamanho: 10 });
    for (let i = 1; i <= 4; i++) { const ly = yN + 6 + i * 16; if (ly < a.base) { pg.circulo(a.x + 5, ly - 3, 3, { contorno: '#777', espessura: 0.6 }); pg.linha(a.x + 14, ly, a.direita, ly, { espessura: 0.4, cor: '#aaa' }); } }
  }
}

function paginaSemana(pg, a, inicio, feriados) {
  const fim = new Date(inicio); fim.setUTCDate(fim.getUTCDate() + 6);
  const fmt = (d) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
  const yTopo = tituloPagina(pg, a, `Semana de ${fmt(inicio)} a ${fmt(fim)}`, { tamanho: 13, subtitulo: String(inicio.getUTCFullYear()) });
  const alturaCaixa = (a.altura - (yTopo + 6 - a.y) - 10) / 4;
  const w = (a.largura - 10) / 2;
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio); d.setUTCDate(d.getUTCDate() + i);
    const col = i % 2; const lin = Math.floor(i / 2);
    const x = a.x + col * (w + 10); const y = yTopo + 6 + lin * alturaCaixa;
    const chave = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    pg.retangulo(x, y, w, alturaCaixa - 8, { contorno: '#999', espessura: 0.5, raio: 6 });
    pg.texto(`${DIAS_SEMANA_CURTO[d.getUTCDay()]} ${d.getUTCDate()}`, x + 8, y + 14, { fonte: 'negrito', tamanho: 10 });
    if (feriados[chave]) pg.texto(feriados[chave], x + w - 8, y + 14, { tamanho: 7, cor: '#777', alinhamento: 'direita' });
    for (let l = 1; l * 14 + 22 < alturaCaixa - 8; l++) pg.linha(x + 8, y + 18 + l * 14, x + w - 8, y + 18 + l * 14, { espessura: 0.3, cor: '#bbb' });
  }
  const x = a.x + w + 10; const y = yTopo + 6 + 3 * alturaCaixa;
  pg.retangulo(x, y, w, alturaCaixa - 8, { contorno: '#999', espessura: 0.5, raio: 6, preenchimento: '#f7f8fb' });
  pg.texto('Notas e prioridades', x + 8, y + 14, { fonte: 'negrito', tamanho: 10 });
}

export function gerar(doc, spec, { inicio, meses = 12, semanais = true, numerar = true } = {}) {
  const hoje = new Date();
  let [ano, mes] = inicio ? String(inicio).split('-').map(Number) : [hoje.getUTCFullYear() + 1, 1];
  if (!ano || !mes || mes < 1 || mes > 12) throw new Error('--inicio deve ser AAAA-MM');
  mes -= 1;
  let n = 0;
  // Página de metas do período
  n++;
  { const pg = doc.novaPagina(); const a = areaUtil(spec, n); const y = tituloPagina(pg, a, 'Metas do período', { tamanho: 18, subtitulo: `${capitalizar(MESES[mes])} ${ano} a ${capitalizar(MESES[(mes + meses - 1) % 12])} ${ano + Math.floor((mes + meses - 1) / 12)}` });
    for (let i = 1; i <= 12; i++) { const ly = y + 14 + i * 26; if (ly < a.base) { pg.retangulo(a.x, ly - 10, 12, 12, { contorno: '#777', espessura: 0.6 }); pg.linha(a.x + 20, ly + 2, a.direita, ly + 2, { espessura: 0.4, cor: '#aaa' }); } }
    if (numerar) numeroPagina(pg, a, n); }
  const feriadosPorAno = new Map();
  const fer = (y) => { if (!feriadosPorAno.has(y)) feriadosPorAno.set(y, feriadosBrasil(y)); return feriadosPorAno.get(y); };
  for (let m = 0; m < meses; m++) {
    const anoAtual = ano + Math.floor((mes + m) / 12);
    const mesAtual = (mes + m) % 12;
    n++;
    { const pg = doc.novaPagina(); const a = areaUtil(spec, n); paginaMes(pg, a, anoAtual, mesAtual, fer(anoAtual)); if (numerar) numeroPagina(pg, a, n); }
    if (semanais) {
      let inicioSemana = new Date(Date.UTC(anoAtual, mesAtual, 1));
      inicioSemana.setUTCDate(inicioSemana.getUTCDate() - ((inicioSemana.getUTCDay() + 6) % 7)); // segunda-feira
      const fimMes = new Date(Date.UTC(anoAtual, mesAtual + 1, 0));
      while (inicioSemana <= fimMes) {
        n++;
        const pg = doc.novaPagina(); const a = areaUtil(spec, n);
        paginaSemana(pg, a, inicioSemana, fer(inicioSemana.getUTCFullYear()));
        if (numerar) numeroPagina(pg, a, n);
        inicioSemana = new Date(inicioSemana); inicioSemana.setUTCDate(inicioSemana.getUTCDate() + 7);
      }
    }
  }
  return { paginas: n, meses, inicio: `${ano}-${String(mes + 1).padStart(2, '0')}` };
}
