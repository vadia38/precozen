// Uma imagem por página (livros de colorir, fotos, ilustrações), com verso em branco opcional.
import fs from 'node:fs';
import path from 'node:path';
import { areaUtil, numeroPagina } from './comum.js';

export const id = 'imagens';
export const nome = 'Livro de imagens';
export const descricao = 'Cada JPEG/PNG da pasta vira uma página; --verso-branco deixa o verso vazio (livros de colorir)';
export const opcoes = { pasta: 'pasta com as imagens (ordem alfabética)', versoBranco: 'página em branco após cada imagem (sim/não)', sangria: 'imagem até a borda (precisa de --sangria no livro)' };

export function gerar(doc, spec, { pasta, versoBranco = false, numerar = false, atePagina = 0 } = {}) {
  if (!pasta || !fs.existsSync(pasta)) throw new Error(`pasta de imagens não encontrada: ${pasta}`);
  const arquivos = fs.readdirSync(pasta).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  if (!arquivos.length) throw new Error(`nenhuma imagem JPEG/PNG em ${pasta}`);
  let n = 0;
  for (const arq of arquivos) {
    const img = doc.registrarImagem(arq, path.join(pasta, arq));
    n++;
    const pg = doc.novaPagina();
    const a = areaUtil(spec, n);
    const escala = Math.min(a.largura / img.largura, a.altura / img.altura);
    const w = img.largura * escala; const h = img.altura * escala;
    pg.imagem(arq, a.x + (a.largura - w) / 2, a.y + (a.altura - h) / 2, w, h);
    if (numerar) numeroPagina(pg, a, n);
    if (versoBranco) { n++; doc.novaPagina(); }
    if (atePagina && n >= atePagina) break;
  }
  return { paginas: n, imagens: arquivos.length };
}
