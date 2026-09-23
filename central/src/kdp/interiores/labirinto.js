// Labirintos: geração por retrocesso (grade perfeita, caminho único), entrada/saída, níveis e soluções.
import { criarRng } from '../../core/rng.js';
import { areaUtil, numeroPagina, tituloPagina, celulas } from './comum.js';

export const id = 'labirinto';
export const nome = 'Labirintos';
export const descricao = 'Labirintos quadrados com dificuldade progressiva (10×10 a 30×30) e soluções ao final';
export const opcoes = { dificuldade: 'facil | medio | dificil | extremo | progressivo (padrão progressivo)', porPagina: '1 ou 2 por página' };

const TAMANHOS = { facil: 10, medio: 15, dificil: 20, extremo: 30 };

/** Gera um labirinto. Devolve { largura, altura, celulas: [{paredes: [cima, direita, baixo, esquerda]}], solucao: [[x,y],...] } */
export function gerarLabirinto(largura, altura, rng) {
  const cels = Array.from({ length: largura * altura }, () => ({ paredes: [true, true, true, true], visitada: false }));
  const idx = (x, y) => y * largura + x;
  const pilha = [[0, 0]];
  cels[0].visitada = true;
  const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]]; // dx, dy, parede atual, parede vizinha
  while (pilha.length) {
    const [x, y] = pilha[pilha.length - 1];
    const vizinhos = dirs.filter(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < largura && y + dy < altura && !cels[idx(x + dx, y + dy)].visitada);
    if (!vizinhos.length) { pilha.pop(); continue; }
    const [dx, dy, pa, pv] = rng.escolher(vizinhos);
    cels[idx(x, y)].paredes[pa] = false;
    cels[idx(x + dx, y + dy)].paredes[pv] = false;
    cels[idx(x + dx, y + dy)].visitada = true;
    pilha.push([x + dx, y + dy]);
  }
  // Solução por busca em largura de (0,0) a (largura-1, altura-1)
  const anterior = new Map();
  const fila = [[0, 0]];
  const visto = new Set(['0,0']);
  while (fila.length) {
    const [x, y] = fila.shift();
    if (x === largura - 1 && y === altura - 1) break;
    const c = cels[idx(x, y)];
    for (const [dx, dy, pa] of dirs) {
      if (c.paredes[pa]) continue;
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= altura || visto.has(`${nx},${ny}`)) continue;
      visto.add(`${nx},${ny}`); anterior.set(`${nx},${ny}`, [x, y]); fila.push([nx, ny]);
    }
  }
  const solucao = [];
  let atual = [largura - 1, altura - 1];
  while (atual) { solucao.unshift(atual); atual = anterior.get(`${atual[0]},${atual[1]}`); }
  return { largura, altura, celulas: cels.map((c) => ({ paredes: c.paredes })), solucao };
}

function desenhar(pg, lab, x, y, lado, { solucao = false } = {}) {
  const cel = lado / Math.max(lab.largura, lab.altura);
  const w = cel * lab.largura; const h = cel * lab.altura;
  const esp = Math.max(1, cel * 0.12);
  for (let cy = 0; cy < lab.altura; cy++) for (let cx = 0; cx < lab.largura; cx++) {
    const c = lab.celulas[cy * lab.largura + cx];
    const x0 = x + cx * cel; const y0 = y + cy * cel;
    if (c.paredes[0] && !(cx === 0 && cy === 0)) pg.linha(x0, y0, x0 + cel, y0, { espessura: esp, cor: '#111' });
    if (c.paredes[1]) pg.linha(x0 + cel, y0, x0 + cel, y0 + cel, { espessura: esp, cor: '#111' });
    if (c.paredes[2] && !(cx === lab.largura - 1 && cy === lab.altura - 1)) pg.linha(x0, y0 + cel, x0 + cel, y0 + cel, { espessura: esp, cor: '#111' });
    if (c.paredes[3]) pg.linha(x0, y0, x0, y0 + cel, { espessura: esp, cor: '#111' });
  }
  pg.texto('▶', x + cel * 0.5, y - 3, { tamanho: cel * 0.6, alinhamento: 'centro', cor: '#111' });
  pg.texto('▼', x + w - cel * 0.5, y + h + cel * 0.7, { tamanho: cel * 0.6, alinhamento: 'centro', cor: '#111' });
  if (solucao) pg.caminho([[x + cel / 2, y - cel * 0.3], ...lab.solucao.map(([sx, sy]) => [x + sx * cel + cel / 2, y + sy * cel + cel / 2]), [x + w - cel / 2, y + h + cel * 0.3]], { contorno: '#e0552b', espessura: Math.max(1.2, cel * 0.25) });
}

const NOMES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', extremo: 'Extremo' };

export function gerar(doc, spec, { quantidade = 50, dificuldade = 'progressivo', porPagina = 1, semente = 'lab', numerar = true, titulo = 'Labirinto' } = {}) {
  const rng = criarRng(semente);
  const niveis = dificuldade === 'progressivo' ? ['facil', 'medio', 'dificil', 'extremo'] : [dificuldade];
  if (!niveis.every((nv) => TAMANHOS[nv])) throw new Error(`dificuldade desconhecida: ${dificuldade}`);
  const labs = [];
  for (let i = 0; i < quantidade; i++) {
    const nivel = dificuldade === 'progressivo' ? niveis[Math.min(niveis.length - 1, Math.floor((i / quantidade) * niveis.length))] : dificuldade;
    const t = TAMANHOS[nivel];
    labs.push({ ...gerarLabirinto(t, t, rng), nivel, numero: i + 1 });
  }
  let n = 0;
  for (let i = 0; i < labs.length; i += porPagina) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const grupo = labs.slice(i, i + porPagina);
    const cels = porPagina === 1 ? [a] : celulas(a, 1, 2, { espaco: 24 });
    grupo.forEach((lab, k) => {
      const c = cels[k];
      const yTopo = tituloPagina(pg, { ...a, y: c.y, largura: c.largura, x: c.x }, `${titulo} ${lab.numero}`, { subtitulo: `${NOMES[lab.nivel]} · ${lab.largura} × ${lab.altura}` });
      const lado = Math.min(c.largura - 8, c.altura - (yTopo - c.y) - 24);
      desenhar(pg, lab, c.x + (c.largura - lado) / 2, yTopo + 14, lado);
    });
    if (numerar) numeroPagina(pg, a, n);
  }
  const porPaginaSol = 6;
  for (let i = 0; i < labs.length; i += porPaginaSol) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const yTopo = tituloPagina(pg, a, i === 0 ? 'Soluções' : 'Soluções (continuação)');
    const cels = celulas({ ...a, y: yTopo + 6, altura: a.altura - (yTopo + 6 - a.y) }, 2, 3, { espaco: 16 });
    labs.slice(i, i + porPaginaSol).forEach((lab, k) => {
      const c = cels[k];
      const lado = Math.min(c.largura - 6, c.altura - 24);
      pg.texto(`${titulo} ${lab.numero}`, c.x + c.largura / 2, c.y + 9, { tamanho: 8, alinhamento: 'centro', cor: '#444' });
      desenhar(pg, lab, c.x + (c.largura - lado) / 2, c.y + 18, lado, { solucao: true });
    });
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas: n, labirintos: labs.length };
}
