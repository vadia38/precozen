// Sudoku: geração de grades completas, remoção de dicas com verificação de solução única, níveis e soluções.
import { criarRng } from '../../core/rng.js';
import { areaUtil, numeroPagina, tituloPagina, celulas } from './comum.js';

export const id = 'sudoku';
export const nome = 'Sudoku';
export const descricao = 'Grades 9×9 com solução única, níveis fácil/médio/difícil/especialista e soluções ao final';
export const opcoes = { dificuldade: 'facil | medio | dificil | especialista | misto (padrão misto)', porPagina: '1 ou 2 grades por página (padrão 1)' };

const DICAS = { facil: [40, 46], medio: [33, 37], dificil: [28, 31], especialista: [24, 27] };

function candidatos(g, i) {
  const r = Math.floor(i / 9); const c = i % 9;
  const usados = new Set();
  for (let k = 0; k < 9; k++) { usados.add(g[r * 9 + k]); usados.add(g[k * 9 + c]); }
  const br = r - (r % 3); const bc = c - (c % 3);
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) usados.add(g[(br + dr) * 9 + bc + dc]);
  const out = [];
  for (let v = 1; v <= 9; v++) if (!usados.has(v)) out.push(v);
  return out;
}

/** Conta soluções (até `limite`). */
export function contarSolucoes(grade, limite = 2) {
  const g = [...grade];
  let total = 0;
  const rec = () => {
    if (total >= limite) return;
    let melhor = -1; let melhores = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const cs = candidatos(g, i);
      if (!cs.length) return;
      if (!melhores || cs.length < melhores.length) { melhor = i; melhores = cs; if (cs.length === 1) break; }
    }
    if (melhor === -1) { total++; return; }
    for (const v of melhores) { g[melhor] = v; rec(); g[melhor] = 0; if (total >= limite) return; }
  };
  rec();
  return total;
}

export function resolver(grade) {
  const g = [...grade];
  const rec = () => {
    let melhor = -1; let melhores = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const cs = candidatos(g, i);
      if (!cs.length) return false;
      if (!melhores || cs.length < melhores.length) { melhor = i; melhores = cs; if (cs.length === 1) break; }
    }
    if (melhor === -1) return true;
    for (const v of melhores) { g[melhor] = v; if (rec()) return true; g[melhor] = 0; }
    return false;
  };
  return rec() ? g : null;
}

/** Grade completa aleatória (preenche por backtracking com ordem embaralhada). */
export function gradeCompleta(rng) {
  const g = Array(81).fill(0);
  const rec = (i) => {
    if (i === 81) return true;
    for (const v of rng.embaralhar(candidatos(g, i))) { g[i] = v; if (rec(i + 1)) return true; }
    g[i] = 0;
    return false;
  };
  rec(0);
  return g;
}

/** Remove dicas mantendo solução única até atingir a faixa do nível. */
export function gerarPuzzle(rng, dificuldade = 'medio') {
  const solucao = gradeCompleta(rng);
  const puzzle = [...solucao];
  const [min, max] = DICAS[dificuldade] || DICAS.medio;
  const alvo = rng.inteiro(min, max);
  const ordem = rng.embaralhar([...Array(81).keys()]);
  let dicas = 81;
  for (const i of ordem) {
    if (dicas <= alvo) break;
    const j = 80 - i; // simetria central
    const vi = puzzle[i]; const vj = puzzle[j];
    if (!vi) continue;
    puzzle[i] = 0; if (j !== i) puzzle[j] = 0;
    if (contarSolucoes(puzzle, 2) !== 1) { puzzle[i] = vi; if (j !== i) puzzle[j] = vj; continue; }
    dicas -= j === i ? 1 : 2;
  }
  return { puzzle, solucao, dicas, dificuldade };
}

function desenhar(pg, grade, x, y, lado, { tamanhoFonte, cinza = false } = {}) {
  const cel = lado / 9;
  for (let i = 0; i <= 9; i++) {
    const forte = i % 3 === 0;
    pg.linha(x + i * cel, y, x + i * cel, y + lado, { espessura: forte ? 1.6 : 0.4, cor: forte ? '#111' : '#999' });
    pg.linha(x, y + i * cel, x + lado, y + i * cel, { espessura: forte ? 1.6 : 0.4, cor: forte ? '#111' : '#999' });
  }
  const tam = tamanhoFonte || cel * 0.6;
  for (let i = 0; i < 81; i++) if (grade[i]) pg.texto(String(grade[i]), x + (i % 9) * cel + cel / 2, y + Math.floor(i / 9) * cel + cel / 2 + tam * 0.35, { fonte: cinza ? 'regular' : 'negrito', tamanho: tam, alinhamento: 'centro', cor: cinza ? '#333' : '#111' });
}

const NOMES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', especialista: 'Especialista' };

export function gerar(doc, spec, { quantidade = 60, dificuldade = 'misto', porPagina = 1, semente = 'sudoku', numerar = true, titulo = 'Sudoku' } = {}) {
  const rng = criarRng(semente);
  const niveis = dificuldade === 'misto' ? ['facil', 'medio', 'dificil', 'especialista'] : [dificuldade];
  if (!niveis.every((nv) => DICAS[nv])) throw new Error(`dificuldade desconhecida: ${dificuldade}`);
  const puzzles = [];
  for (let i = 0; i < quantidade; i++) {
    const nivel = dificuldade === 'misto' ? niveis[Math.min(niveis.length - 1, Math.floor((i / quantidade) * niveis.length))] : dificuldade;
    puzzles.push({ ...gerarPuzzle(rng, nivel), numero: i + 1 });
  }
  let n = 0;
  for (let i = 0; i < puzzles.length; i += porPagina) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const grupo = puzzles.slice(i, i + porPagina);
    const yTopo = porPagina === 1 ? tituloPagina(pg, a, `${titulo} ${grupo[0].numero}`, { subtitulo: `${NOMES[grupo[0].dificuldade]} · ${grupo[0].dicas} dicas` }) : a.y;
    const cels = porPagina === 1 ? [{ x: a.x, y: yTopo + 10, largura: a.largura, altura: a.altura - (yTopo + 10 - a.y) }] : celulas(a, 1, 2, { espaco: 24 });
    grupo.forEach((p, k) => {
      const c = cels[k];
      const lado = Math.min(c.largura, c.altura - (porPagina === 1 ? 0 : 22));
      const gx = c.x + (c.largura - lado) / 2;
      const gy = porPagina === 1 ? c.y : c.y + 20;
      if (porPagina > 1) pg.texto(`${titulo} ${p.numero} · ${NOMES[p.dificuldade]}`, c.x + c.largura / 2, c.y + 10, { fonte: 'negrito', tamanho: 11, alinhamento: 'centro' });
      desenhar(pg, p.puzzle, gx, gy, lado);
    });
    if (numerar) numeroPagina(pg, a, n);
  }
  const porPaginaSol = 6;
  for (let i = 0; i < puzzles.length; i += porPaginaSol) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const yTopo = tituloPagina(pg, a, i === 0 ? 'Soluções' : 'Soluções (continuação)');
    const cels = celulas({ ...a, y: yTopo + 6, altura: a.altura - (yTopo + 6 - a.y) }, 2, 3, { espaco: 14 });
    puzzles.slice(i, i + porPaginaSol).forEach((p, k) => {
      const c = cels[k];
      const lado = Math.min(c.largura, c.altura - 14);
      pg.texto(`${titulo} ${p.numero}`, c.x + c.largura / 2, c.y + 9, { tamanho: 8, alinhamento: 'centro', cor: '#444' });
      desenhar(pg, p.solucao, c.x + (c.largura - lado) / 2, c.y + 13, lado, { tamanhoFonte: lado / 9 * 0.55, cinza: true });
    });
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas: n, puzzles: puzzles.length, niveis: puzzles.reduce((acc, p) => ({ ...acc, [p.dificuldade]: (acc[p.dificuldade] || 0) + 1 }), {}) };
}
