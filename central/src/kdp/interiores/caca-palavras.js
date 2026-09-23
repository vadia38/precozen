// Caça-palavras: gera grades com palavras escondidas em até 8 direções, lista de palavras e páginas de solução.
import path from 'node:path';
import { RAIZ_CENTRAL, lerJson } from '../../core/arquivos.js';
import { normalizar, capitalizar } from '../../core/util.js';
import { criarRng } from '../../core/rng.js';
import { areaUtil, numeroPagina, tituloPagina, celulas } from './comum.js';

export const id = 'caca-palavras';
export const nome = 'Caça-palavras';
export const descricao = 'Grades de 10 a 20 letras por tema (animais, frutas, cores, profissões...) ou palavras próprias, com soluções';
export const opcoes = { tema: 'tema do data/temas-caca-palavras.json ou "todos" (padrão: alterna temas)', palavras: 'lista própria separada por vírgula', tamanho: 'lado da grade (padrão 15)', porPuzzle: 'palavras por puzzle (padrão 15)', dificuldade: 'facil (4 direções) | medio (8) | dificil (8 + diagonais invertidas)' };

const ALFABETO = 'ABCDEFGHIJKLMNOPRSTUV';
const DIRECOES = { facil: [[1, 0], [0, 1]], medio: [[1, 0], [0, 1], [1, 1], [-1, 1]], dificil: [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]] };

export function temas() {
  const t = lerJson(path.join(RAIZ_CENTRAL, 'data', 'temas-caca-palavras.json'));
  return Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('_')));
}

export const limparPalavra = (p) => normalizar(p).replace(/[^a-z]/g, '').toUpperCase();

/** Gera uma grade. Devolve { grade: string[][], colocadas: [{palavra, original, x, y, dx, dy}], naoColocadas } */
export function gerarGrade(palavras, { tamanho = 15, dificuldade = 'medio', rng = criarRng('cp') } = {}) {
  const grade = Array.from({ length: tamanho }, () => Array(tamanho).fill(''));
  const dirs = DIRECOES[dificuldade] || DIRECOES.medio;
  const colocadas = [];
  const naoColocadas = [];
  const lista = [...palavras].map((p) => ({ original: p, palavra: limparPalavra(p) })).filter((p) => p.palavra.length >= 3 && p.palavra.length <= tamanho).sort((a, b) => b.palavra.length - a.palavra.length);
  for (const item of lista) {
    const w = item.palavra;
    let ok = false;
    for (let tentativa = 0; tentativa < 200 && !ok; tentativa++) {
      const [dx, dy] = rng.escolher(dirs);
      const x0 = rng.inteiro(0, tamanho - 1);
      const y0 = rng.inteiro(0, tamanho - 1);
      const xf = x0 + dx * (w.length - 1); const yf = y0 + dy * (w.length - 1);
      if (xf < 0 || yf < 0 || xf >= tamanho || yf >= tamanho) continue;
      let cabe = true;
      for (let i = 0; i < w.length; i++) { const c = grade[y0 + dy * i][x0 + dx * i]; if (c && c !== w[i]) { cabe = false; break; } }
      if (!cabe) continue;
      for (let i = 0; i < w.length; i++) grade[y0 + dy * i][x0 + dx * i] = w[i];
      colocadas.push({ palavra: w, original: item.original, x: x0, y: y0, dx, dy });
      ok = true;
    }
    if (!ok) naoColocadas.push(item.original);
  }
  for (let y = 0; y < tamanho; y++) for (let x = 0; x < tamanho; x++) if (!grade[y][x]) grade[y][x] = ALFABETO[rng.inteiro(0, ALFABETO.length - 1)];
  return { grade, colocadas, naoColocadas, tamanho };
}

function desenharGrade(pg, puzzle, x, y, lado, { solucao = false, letras = true, fonteTam } = {}) {
  const n = puzzle.tamanho;
  const cel = lado / n;
  pg.retangulo(x, y, lado, lado, { contorno: '#222', espessura: 1.2 });
  for (let i = 1; i < n; i++) { pg.linha(x + i * cel, y, x + i * cel, y + lado, { espessura: 0.25, cor: '#bbb' }); pg.linha(x, y + i * cel, x + lado, y + i * cel, { espessura: 0.25, cor: '#bbb' }); }
  const tam = fonteTam || cel * 0.62;
  if (solucao) {
    for (const c of puzzle.colocadas) {
      const x1 = x + c.x * cel + cel / 2; const y1 = y + c.y * cel + cel / 2;
      const x2 = x + (c.x + c.dx * (c.palavra.length - 1)) * cel + cel / 2; const y2 = y + (c.y + c.dy * (c.palavra.length - 1)) * cel + cel / 2;
      pg.linha(x1, y1, x2, y2, { espessura: cel * 0.7, cor: '#cfd8ea' });
    }
  }
  if (letras) for (let r = 0; r < n; r++) for (let cidx = 0; cidx < n; cidx++) pg.texto(puzzle.grade[r][cidx], x + cidx * cel + cel / 2, y + r * cel + cel / 2 + tam * 0.35, { fonte: 'negrito', tamanho: tam, alinhamento: 'centro', cor: '#111' });
}

function listaPalavras(pg, puzzle, x, y, largura, { colunas = 3, tamanho = 10 } = {}) {
  const ordenadas = [...puzzle.colocadas].map((c) => capitalizar(c.original)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const porColuna = Math.ceil(ordenadas.length / colunas);
  const wCol = largura / colunas;
  ordenadas.forEach((p, i) => { const col = Math.floor(i / porColuna); const lin = i % porColuna; pg.texto(p, x + col * wCol, y + lin * (tamanho * 1.5), { tamanho, cor: '#222' }); });
  return porColuna * tamanho * 1.5;
}

export function gerar(doc, spec, { quantidade = 40, tema, palavras, tamanho = 15, porPuzzle = 15, dificuldade = 'medio', semente = 'cp', numerar = true, titulo = 'Caça-palavras' } = {}) {
  const rng = criarRng(semente);
  const todosTemas = temas();
  const listaTemas = tema && tema !== 'todos' ? [tema] : Object.keys(todosTemas);
  for (const t of listaTemas) if (!palavras && !todosTemas[t]) throw new Error(`tema desconhecido: ${t} (disponíveis: ${Object.keys(todosTemas).join(', ')})`);
  const puzzles = [];
  for (let i = 0; i < quantidade; i++) {
    const nomeTema = palavras ? (tema || 'Palavras') : listaTemas[i % listaTemas.length];
    const fonte = palavras ? palavras : todosTemas[nomeTema];
    const escolhidas = rng.embaralhar(fonte).slice(0, porPuzzle);
    const p = gerarGrade(escolhidas, { tamanho, dificuldade, rng });
    p.tema = palavras ? nomeTema : capitalizar(nomeTema.replace(/-/g, ' '));
    p.numero = i + 1;
    puzzles.push(p);
  }
  let n = 0;
  for (const p of puzzles) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const yTopo = tituloPagina(pg, a, `${titulo} ${p.numero}`, { subtitulo: `Tema: ${p.tema} · ${p.colocadas.length} palavras` });
    const lado = Math.min(a.largura, a.altura * 0.62);
    const gx = a.x + (a.largura - lado) / 2;
    desenharGrade(pg, p, gx, yTopo + 8, lado);
    listaPalavras(pg, p, a.x + 4, yTopo + lado + 28, a.largura, { colunas: p.colocadas.length > 12 ? 3 : 2, tamanho: Math.min(11, lado / 30) });
    if (numerar) numeroPagina(pg, a, n);
  }
  // Soluções: 4 por página
  const porPagina = 4;
  for (let i = 0; i < puzzles.length; i += porPagina) {
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const yTopo = tituloPagina(pg, a, i === 0 ? 'Soluções' : 'Soluções (continuação)');
    const cels = celulas({ ...a, y: yTopo + 6, altura: a.altura - (yTopo + 6 - a.y) }, 2, 2, { espaco: 14 });
    puzzles.slice(i, i + porPagina).forEach((p, k) => {
      const c = cels[k];
      const lado = Math.min(c.largura, c.altura - 14);
      pg.texto(`${titulo} ${p.numero} · ${p.tema}`, c.x + c.largura / 2, c.y + 9, { tamanho: 8, alinhamento: 'centro', cor: '#444' });
      desenharGrade(pg, p, c.x + (c.largura - lado) / 2, c.y + 14, lado, { solucao: true, fonteTam: (lado / p.tamanho) * 0.55 });
    });
    if (numerar) numeroPagina(pg, a, n);
  }
  return { paginas: n, puzzles: puzzles.length, temas: [...new Set(puzzles.map((p) => p.tema))] };
}
