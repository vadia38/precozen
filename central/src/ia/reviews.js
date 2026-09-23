// Reescrita de uma análise com IA: mantém a estrutura, os links de afiliado, a ficha técnica e o rodapé do template.
import { gerar } from './cliente.js';
import { SISTEMA_EDITOR, ESQUEMA_REVIEW, promptReview } from './prompts.js';
import { formatarNumero } from '../core/util.js';

export async function reescreverReview(post, produto, { config, ranking, hoje = new Date() } = {}) {
  const ano = new Date(hoje).getUTCFullYear();
  const alternativas = (ranking?.produtos || []).filter((o) => o.id !== produto.id && o.categoria === produto.categoria).slice(0, 3);
  const { json, modelo, cache } = await gerar({ sistema: SISTEMA_EDITOR, usuario: promptReview(produto, { categoriaNome: post.partes.categoriaNome, nota: post.partes.nota, alternativas, ano }), esquema: ESQUEMA_REVIEW, config });
  const r = json;
  const partes = post.partes;
  const corpo = [
    r.introducao.trim(),
    '',
    partes.resumo,
    '',
    partes.cta,
    '',
    '## Para quem é',
    '',
    r.paraQuem.trim(),
    '',
    '## Pontos fortes',
    '',
    ...r.pontosFortes.map((x) => `- **${x.titulo.trim()}.** ${x.texto.trim()}`),
    '',
    '## Pontos de atenção',
    '',
    ...r.pontosAtencao.map((x) => `- **${x.titulo.trim()}.** ${x.texto.trim()}`),
    '',
    ...r.analise.flatMap((s) => [`## ${s.subtitulo.trim()}`, '', s.texto.trim(), '']),
    partes.ficha,
    partes.alternativas,
    '## Veredito',
    '',
    `**Nota ${formatarNumero(partes.nota, 1)}/10.** ${r.veredito.trim()}`,
    '',
    partes.cta,
    '',
    '## Perguntas frequentes',
    '',
    ...r.faq.flatMap((f) => [`### ${f.pergunta.trim()}`, '', f.resposta.trim(), '']),
    '---',
    '',
    partes.rodape,
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  const meta = { ...post.meta };
  if (r.titulo && r.titulo.length <= 90) meta.titulo = r.titulo.trim();
  if (r.descricao && r.descricao.length >= 60 && r.descricao.length <= 170) meta.descricao = r.descricao.trim();
  meta.tags = [...new Set([post.meta.categoriaNome, ...r.tags.map((t) => t.trim()).filter(Boolean)])].slice(0, 8);
  meta.gerador = `ia:${modelo}${cache ? ' (cache)' : ''}`;
  return { ...post, meta, corpo };
}
