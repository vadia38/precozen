// Carrega e enriquece os dados do catálogo (config, categorias, produtos, montadoras).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar, tokensCompactos, capitalizar, codigoValido } from '../../public/js/lib/util.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function lerJson(relativo) {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, relativo), 'utf8'));
}

/** Extrai atributos técnicos a partir do nome do produto. */
export function extrairAtributos(nome) {
  const n = String(nome || '');
  const a = {};
  let m;
  if ((m = n.match(/\b(direit[oa]|esquerd[oa])\b/i))) a.lado = /^d/i.test(m[1]) ? 'Direito' : 'Esquerdo';
  if ((m = n.match(/\b(traseir[oa]|dianteir[oa])\b/i))) a.posicao = /^t/i.test(m[1]) ? 'Traseiro' : 'Dianteiro';
  if ((m = n.match(/\b(simples|duplo|qu[aá]druplo)\b/i))) {
    const t = normalizar(m[1]);
    a.tipo = t === 'simples' ? 'Simples' : t === 'duplo' ? 'Duplo' : 'Quádruplo';
  }
  if ((m = n.match(/\b(\d+)\s?pinos?\b/i))) a.pinos = `${m[1]} pinos`;
  if ((m = n.match(/\b([24])P\b/))) a.portas = `${m[1]} portas`;
  if (/\b(s\/|sem)\s*motor\b/i.test(n)) a.motor = 'Sem motor';
  else if (/\b(c\/|com)\s*motor\b/i.test(n)) a.motor = 'Com motor';
  if ((m = n.match(/\b110\s*\/\s*(2[24]0)\s?V?\b/i))) a.voltagem = `110/${m[1]}V`;
  else if (/\bbivolt\b/i.test(n)) a.voltagem = 'Bivolt';
  else if ((m = n.match(/\b(12|24)-(110|220)\s?V\b/i))) a.voltagem = `${m[1]}V → ${m[2]}V`;
  else if ((m = n.match(/\b(12|24|110|220)\s?V(?:DC)?\b/i))) a.voltagem = `${m[1]}V`;
  if ((m = n.match(/\b(\d{1,5})\s?W\b/))) a.potencia = `${m[1]}W`;
  if ((m = n.match(/\b(\d{1,4})\s?A\b/))) a.corrente = `${m[1]}A`;
  if ((m = n.match(/\b(\d{4})\s?K\b/))) a.temperaturaCor = `${m[1]}K`;
  if ((m = n.match(/\b(\d{2,3}x\d{2,3}(?:x\d{1,3})?)\s?(?:mm)?\b/i))) a.medida = `${m[1].toLowerCase()} mm`;
  if ((m = n.match(/(\d+(?:[.,]\d+)?)\s?(?:mts|mt|m)\b/i))) a.comprimento = `${m[1].replace('.', ',')} m`;
  if ((m = n.match(/(\d+)"/))) a.polegadas = `${m[1]}"`;
  // \b não reconhece letras acentuadas; usa-se lookaround com classes Unicode.
  if ((m = n.match(/(?<![\p{L}\p{N}])(âmbar|ambar|verde|azul|vermelh[oa]|branc[oa]|pret[oa]|amarel[oa]|laranja|cinza|bege|cristal|prata|dourad[oa])(?![\p{L}\p{N}])/iu))) {
    const cor = normalizar(m[1]);
    const nomes = { ambar: 'Âmbar', verde: 'Verde', azul: 'Azul', vermelho: 'Vermelho', vermelha: 'Vermelho', branco: 'Branco', branca: 'Branco', preto: 'Preto', preta: 'Preto', amarelo: 'Amarelo', amarela: 'Amarelo', laranja: 'Laranja', cinza: 'Cinza', bege: 'Bege', cristal: 'Cristal', prata: 'Prata', dourado: 'Dourado', dourada: 'Dourado' };
    a.cor = nomes[cor] || capitalizar(cor);
  }
  return a;
}

/** Prepara o dicionário de montadoras para casamento por tokens. */
function prepararMontadoras(dicionario) {
  const lista = [];
  for (const [id, m] of Object.entries(dicionario)) {
    if (id.startsWith('_')) continue;
    const simples = new Map(); // token -> nome de exibição
    const compostos = []; // [tokens[], nome]
    for (const modelo of m.modelos || []) {
      const toks = tokensCompactos(modelo);
      if (toks.length === 1) simples.set(toks[0], modelo);
      else if (toks.length > 1) compostos.push([toks, modelo]);
    }
    const marcas = new Set((m.marca || []).map((x) => tokensCompactos(x).join('')));
    lista.push({ id, nome: m.nome, marcas, simples, compostos });
  }
  return lista;
}

/** Identifica montadoras e modelos citados no nome de um produto. */
export function detectarMontadoras(nome, montadorasPreparadas) {
  const toks = tokensCompactos(nome);
  const conjunto = new Set(toks);
  const frase = ` ${toks.join(' ')} `;
  const encontradas = new Map();
  for (const m of montadorasPreparadas) {
    const modelos = new Set();
    for (const [tok, display] of m.simples) if (conjunto.has(tok)) modelos.add(display);
    for (const [seq, display] of m.compostos) if (frase.includes(` ${seq.join(' ')} `)) modelos.add(display);
    const marcaCitada = [...m.marcas].some((x) => conjunto.has(x));
    if (modelos.size || marcaCitada) encontradas.set(m.id, { id: m.id, nome: m.nome, modelos: [...modelos] });
  }
  return [...encontradas.values()];
}

/** Carrega tudo e devolve o modelo de dados usado pelo gerador e pela API. */
export function carregarDados(opcoes = {}) {
  const config = lerJson('site.config.json');
  const categorias = lerJson('data/categorias.json');
  const produtosBrutos = lerJson('data/produtos.json');
  const dicionario = lerJson('data/montadoras.json');
  const montadorasPrep = prepararMontadoras(dicionario);
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const montadoraPorId = new Map(montadorasPrep.map((m) => [m.id, m]));

  const produtos = produtosBrutos.map((p, i) => {
    const cat = categoriaPorId.get(p.categoria);
    const sub = cat?.subgrupos?.find((s) => s.id === p.subgrupo) || null;
    const detectadas = detectarMontadoras(p.nome, montadorasPrep);
    // subgrupo de botões é autoritativo: entra primeiro
    if (p.subgrupo && montadoraPorId.has(p.subgrupo) && !detectadas.some((d) => d.id === p.subgrupo)) {
      detectadas.unshift({ id: p.subgrupo, nome: montadoraPorId.get(p.subgrupo).nome, modelos: [] });
    }
    const atributos = extrairAtributos(p.nome);
    const tags = [];
    if (/\buniversal\b/i.test(p.nome)) tags.push('Universal');
    return {
      codigo: p.codigo,
      ref: p.ref || null,
      nome: p.nome,
      categoria: p.categoria,
      categoriaNome: cat?.nome || p.categoria,
      subgrupo: p.subgrupo || null,
      subgrupoNome: sub?.nome || null,
      ordem: p.ordem ?? i + 1,
      pagina: p.pagina ?? null,
      imagem: p.imagem ? { ...p.imagem } : null,
      montadoras: detectadas.map((d) => d.id),
      montadorasNome: detectadas.map((d) => d.nome),
      modelos: [...new Set(detectadas.flatMap((d) => d.modelos))],
      atributos,
      tags,
    };
  });

  // Estatísticas
  const contagem = (chave) => {
    const m = new Map();
    for (const p of produtos) for (const k of [].concat(chave(p)).filter(Boolean)) m.set(k, (m.get(k) || 0) + 1);
    return m;
  };
  const porCategoria = contagem((p) => p.categoria);
  const porSubgrupo = contagem((p) => (p.subgrupo ? `${p.categoria}/${p.subgrupo}` : null));
  const porMontadora = contagem((p) => p.montadoras);
  const porMontadoraCategoria = contagem((p) => p.montadoras.map((m) => `${p.categoria}/${m}`));

  const categoriasEnriquecidas = categorias.map((c) => ({
    ...c,
    total: porCategoria.get(c.id) || 0,
    subgrupos: (c.subgrupos || [])
      .map((s) => ({ ...s, total: porSubgrupo.get(`${c.id}/${s.id}`) || 0 }))
      .filter((s) => s.total > 0),
    montadoras: montadorasPrep
      .map((m) => ({ id: m.id, nome: m.nome, total: porMontadoraCategoria.get(`${c.id}/${m.id}`) || 0 }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total),
  }));

  const montadoras = montadorasPrep
    .map((m) => {
      const itens = produtos.filter((p) => p.montadoras.includes(m.id));
      const modelos = [...new Set(itens.flatMap((p) => p.modelos))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const cats = categoriasEnriquecidas
        .map((c) => ({ id: c.id, nome: c.nome, total: itens.filter((p) => p.categoria === c.id).length }))
        .filter((c) => c.total > 0);
      return { id: m.id, nome: m.nome, total: itens.length, modelos, categorias: cats };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  const dados = { config, categorias: categoriasEnriquecidas, produtos, montadoras, totais: { produtos: produtos.length, categorias: categoriasEnriquecidas.length, montadoras: montadoras.length } };
  if (opcoes.validar !== false) {
    const erros = validarDados(dados);
    if (erros.length) {
      const err = new Error(`Dados inválidos:\n - ${erros.join('\n - ')}`);
      err.erros = erros;
      throw err;
    }
  }
  return dados;
}

/** Verifica integridade. Devolve lista de mensagens de erro (vazia = ok). */
export function validarDados({ config, categorias, produtos, montadoras }) {
  const erros = [];
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const vistos = new Set();
  const dirImg = path.join(RAIZ, 'public', 'img', 'produtos');
  for (const p of produtos) {
    if (!codigoValido(p.codigo)) erros.push(`código inválido: "${p.codigo}"`);
    if (vistos.has(p.codigo)) erros.push(`código duplicado: ${p.codigo}`);
    vistos.add(p.codigo);
    if (!p.nome || !p.nome.trim()) erros.push(`${p.codigo}: nome vazio`);
    if (p.nome && p.nome.length > 140) erros.push(`${p.codigo}: nome muito longo`);
    const c = cat.get(p.categoria);
    if (!c) erros.push(`${p.codigo}: categoria desconhecida "${p.categoria}"`);
    else if (p.subgrupo && !(c.subgrupos || []).some((s) => s.id === p.subgrupo)) {
      erros.push(`${p.codigo}: subgrupo "${p.subgrupo}" não existe em ${p.categoria}`);
    }
    if (p.imagem) {
      if (!p.imagem.arquivo || !fs.existsSync(path.join(dirImg, p.imagem.arquivo))) erros.push(`${p.codigo}: foto não encontrada (${p.imagem?.arquivo})`);
      if (!(Number.isFinite(p.imagem.largura) && Number.isFinite(p.imagem.altura) && p.imagem.largura > 0 && p.imagem.altura > 0)) erros.push(`${p.codigo}: dimensões da foto inválidas`);
      if (p.imagem.arquivo && /[^a-zA-Z0-9._-]/.test(p.imagem.arquivo)) erros.push(`${p.codigo}: nome de arquivo de foto inválido`);
    }
    if (p.pagina !== null && p.pagina !== undefined && !(Number.isInteger(p.pagina) && p.pagina > 0)) erros.push(`${p.codigo}: página do PDF inválida`);
  }
  for (const c of categorias) {
    if (!/^[a-z0-9-]+$/.test(c.id)) erros.push(`categoria com id inválido: ${c.id}`);
    if (!c.nome) erros.push(`categoria ${c.id} sem nome`);
    if (c.cor && !/^[a-z]+$/.test(c.cor)) erros.push(`categoria ${c.id} com cor inválida`);
    for (const s of c.subgrupos || []) if (!/^[a-z0-9-]+$/.test(s.id)) erros.push(`subgrupo com id inválido em ${c.id}: ${s.id}`);
  }
  for (const m of montadoras) if (!/^[a-z0-9-]+$/.test(m.id)) erros.push(`montadora com id inválido: ${m.id}`);
  for (const d of config.destaques || []) if (!vistos.has(d)) erros.push(`destaque não encontrado: ${d}`);
  if (!config.whatsapp?.numero || !/^\d{10,15}$/.test(config.whatsapp.numero)) erros.push('config.whatsapp.numero deve ter só dígitos com DDI (ex.: 5511999999999)');
  for (const chave of ['url', 'siteOficial', 'orcamentoOficial']) {
    if (!/^https?:\/\/[^\s"'<>]+$/.test(config[chave] || '')) erros.push(`config.${chave} deve ser uma URL http(s) válida`);
  }
  if (!config.pdf?.arquivo || !/^[a-zA-Z0-9_./-]+$/.test(config.pdf.arquivo) || config.pdf.arquivo.includes('..')) erros.push('config.pdf.arquivo deve ser um caminho relativo simples');
  if (!/^#[0-9a-fA-F]{6}$/.test(config.tema?.corPrimaria || '')) erros.push('config.tema.corPrimaria deve ser uma cor hexadecimal (#RRGGBB)');
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(config.idioma || '')) erros.push('config.idioma deve ser como pt-BR');
  return erros;
}
