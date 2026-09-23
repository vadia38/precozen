// Conversor Markdown → HTML enxuto e seguro para os posts do blog.
// Suporta: títulos, parágrafos, negrito/itálico/código, links com atributos {:afiliado .classe}, imagens, citações,
// listas (ordenadas e não), tabelas com alinhamento, linha horizontal e blocos de código. Todo texto é escapado.
import { escapeHtml, slug, urlSegura } from '../core/util.js';

function inline(texto) {
  let t = escapeHtml(texto);
  // código
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // imagens ![alt](src)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const u = urlSegura(src) || (src.startsWith('/') && !src.startsWith('//') ? src : null);
    return u ? `<img src="${escapeHtml(u)}" alt="${alt}" loading="lazy" decoding="async">` : alt;
  });
  // links [texto](url){:afiliado .classe}
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)(\{:([^}]*)\})?/g, (_, rotulo, href, __, attrs) => {
    const externo = /^https?:\/\//i.test(href);
    const interno = href.startsWith('/') && !href.startsWith('//');
    const ancora = href.startsWith('#');
    if (!(externo && urlSegura(href)) && !interno && !ancora) return rotulo;
    const flags = (attrs || '').split(/\s+/).filter(Boolean);
    const afiliado = flags.includes('afiliado');
    const classes = flags.filter((f) => f.startsWith('.')).map((f) => f.slice(1)).concat(afiliado ? ['link-afiliado'] : []);
    const rel = afiliado ? 'sponsored nofollow noopener' : externo ? 'noopener' : null;
    return `<a href="${escapeHtml(href)}"${classes.length ? ` class="${escapeHtml(classes.join(' '))}"` : ''}${rel ? ` rel="${rel}"` : ''}${externo ? ' target="_blank"' : ''}>${rotulo}</a>`;
  });
  // negrito e itálico
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  return t;
}

function tabela(linhas) {
  const partir = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const cab = partir(linhas[0]);
  const alinh = partir(linhas[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : null));
  const corpo = linhas.slice(2).map((l) => `<tr>${partir(l).map((c, i) => `<td${alinh[i] ? ` style="text-align:${alinh[i]}"` : ''}>${inline(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="tabela-rolagem"><table><thead><tr>${cab.map((c, i) => `<th${alinh[i] ? ` style="text-align:${alinh[i]}"` : ''}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${corpo}</tbody></table></div>`;
}

/** Converte Markdown em HTML. Devolve { html, titulos: [{nivel, texto, id}] } para o sumário. */
export function markdownParaHtml(md, { idsTitulos = true } = {}) {
  const linhas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  const titulos = [];
  const idsUsados = new Set();
  let i = 0;
  const paragrafo = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) { html.push(`<p>${inline(paragrafo.join(' '))}</p>`); paragrafo.length = 0; }
  };
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { fecharParagrafo(); i++; continue; }
    // bloco de código
    if (/^```/.test(l)) {
      fecharParagrafo();
      const buf = []; i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) buf.push(linhas[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    // título
    const t = l.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (t) {
      fecharParagrafo();
      const nivel = t[1].length;
      const texto = t[2].trim();
      let id = slug(texto, 60);
      while (idsUsados.has(id)) id += '-2';
      idsUsados.add(id);
      titulos.push({ nivel, texto, id });
      html.push(`<h${nivel}${idsTitulos ? ` id="${id}"` : ''}>${inline(texto)}</h${nivel}>`);
      i++; continue;
    }
    // linha horizontal
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { fecharParagrafo(); html.push('<hr>'); i++; continue; }
    // citação
    if (/^>\s?/.test(l)) {
      fecharParagrafo();
      const buf = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) buf.push(linhas[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${markdownParaHtml(buf.join('\n'), { idsTitulos: false }).html}</blockquote>`);
      continue;
    }
    // tabela
    if (/^\|/.test(l) && i + 1 < linhas.length && /^\|?\s*:?-{2,}/.test(linhas[i + 1])) {
      fecharParagrafo();
      const buf = [];
      while (i < linhas.length && /^\|/.test(linhas[i])) buf.push(linhas[i++]);
      html.push(tabela(buf));
      continue;
    }
    // listas
    const li = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      fecharParagrafo();
      const ordenada = /\d/.test(li[2]);
      const itens = [];
      while (i < linhas.length) {
        const m = linhas[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        itens.push(m[3]);
        i++;
        // continuação indentada
        while (i < linhas.length && /^\s{2,}\S/.test(linhas[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(linhas[i])) itens[itens.length - 1] += ` ${linhas[i++].trim()}`;
      }
      const tag = ordenada ? 'ol' : 'ul';
      html.push(`<${tag}>${itens.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    // parágrafo: uma linha que é só um link com classe botão vira parágrafo próprio
    paragrafo.push(l.trim());
    i++;
  }
  fecharParagrafo();
  return { html: html.join('\n'), titulos };
}

/** Texto puro (para descrições e contagem de palavras). */
export function markdownParaTexto(md) {
  return String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)(\{:[^}]*\})?/g, '$1')
    .replace(/[#>*`_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tempoLeitura(md) {
  const palavras = markdownParaTexto(md).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}
