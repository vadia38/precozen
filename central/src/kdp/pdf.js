// Escritor de PDF sem dependências: páginas, formas vetoriais, texto com fontes TrueType embutidas (Type0/Identity-H),
// fontes padrão (Helvetica/Times/Courier) como reserva, imagens JPEG/PNG, metadados e compressão Flate.
// Coordenadas das páginas: origem no canto superior esquerdo, em pontos (1/72 pol).
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { lerTtf, medirTtf } from './fonte-ttf.js';
import { lerImagem } from './imagem.js';

// Larguras (1/1000 em) das fontes padrão para ASCII 32–126; acentuadas usam a largura da letra base.
const LARG_HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const LARG_HELVETICA_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const FONTES_PADRAO = { Helvetica: LARG_HELVETICA, 'Helvetica-Bold': LARG_HELVETICA_BOLD, 'Times-Roman': LARG_HELVETICA, 'Times-Bold': LARG_HELVETICA_BOLD, Courier: null, 'Courier-Bold': null };

const f2 = (n) => (Math.round(n * 100) / 100).toString();

export function corPdf(cor) {
  if (Array.isArray(cor)) return cor.map((c) => f2(c)).join(' ');
  const hex = String(cor || '#000000').replace('#', '');
  const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => f2(c)).join(' ');
}

function textoPdf(s) {
  const str = String(s ?? '');
  if (/^[\x20-\x7e]*$/.test(str)) return `(${str.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  const utf16 = Buffer.from(`﻿${str}`, 'utf16le');
  for (let i = 0; i < utf16.length; i += 2) { const t = utf16[i]; utf16[i] = utf16[i + 1]; utf16[i + 1] = t; }
  return `<${utf16.toString('hex')}>`;
}

/** Página com métodos de desenho (origem no topo). */
export class Pagina {
  constructor(doc, largura, altura) {
    this.doc = doc; this.largura = largura; this.altura = altura; this.ops = []; this.fontesUsadas = new Set(); this.imagensUsadas = new Set();
  }
  y(v) { return this.altura - v; }
  cor(cor, preenchimento = true) { this.ops.push(`${corPdf(cor)} ${preenchimento ? 'rg' : 'RG'}`); return this; }
  linha(x1, y1, x2, y2, { espessura = 1, cor = '#000', tracejado = null } = {}) {
    this.ops.push('q', `${f2(espessura)} w ${corPdf(cor)} RG`, tracejado ? `[${tracejado.map(f2).join(' ')}] 0 d` : '[] 0 d', `${f2(x1)} ${f2(this.y(y1))} m ${f2(x2)} ${f2(this.y(y2))} l S`, 'Q');
    return this;
  }
  retangulo(x, y, w, h, { preenchimento = null, contorno = null, espessura = 1, raio = 0 } = {}) {
    const op = preenchimento && contorno ? 'B' : preenchimento ? 'f' : 'S';
    const cores = `${preenchimento ? `${corPdf(preenchimento)} rg ` : ''}${contorno ? `${corPdf(contorno)} RG ` : ''}${f2(espessura)} w`;
    if (raio > 0) {
      const r = Math.min(raio, w / 2, h / 2); const k = 0.5523 * r; const yb = this.y(y + h); const yt = this.y(y);
      this.ops.push('q', cores, `${f2(x + r)} ${f2(yb)} m`, `${f2(x + w - r)} ${f2(yb)} l`, `${f2(x + w - r + k)} ${f2(yb)} ${f2(x + w)} ${f2(yb + r - k)} ${f2(x + w)} ${f2(yb + r)} c`, `${f2(x + w)} ${f2(yt - r)} l`, `${f2(x + w)} ${f2(yt - r + k)} ${f2(x + w - r + k)} ${f2(yt)} ${f2(x + w - r)} ${f2(yt)} c`, `${f2(x + r)} ${f2(yt)} l`, `${f2(x + r - k)} ${f2(yt)} ${f2(x)} ${f2(yt - r + k)} ${f2(x)} ${f2(yt - r)} c`, `${f2(x)} ${f2(yb + r)} l`, `${f2(x)} ${f2(yb + r - k)} ${f2(x + r - k)} ${f2(yb)} ${f2(x + r)} ${f2(yb)} c`, 'h', op, 'Q');
    } else this.ops.push('q', cores, `${f2(x)} ${f2(this.y(y + h))} ${f2(w)} ${f2(h)} re ${op}`, 'Q');
    return this;
  }
  circulo(cx, cy, r, { preenchimento = null, contorno = null, espessura = 1 } = {}) {
    const k = 0.5523 * r; const y = this.y(cy);
    const op = preenchimento && contorno ? 'B' : preenchimento ? 'f' : 'S';
    this.ops.push('q', `${preenchimento ? `${corPdf(preenchimento)} rg ` : ''}${contorno ? `${corPdf(contorno)} RG ` : ''}${f2(espessura)} w`,
      `${f2(cx + r)} ${f2(y)} m`, `${f2(cx + r)} ${f2(y + k)} ${f2(cx + k)} ${f2(y + r)} ${f2(cx)} ${f2(y + r)} c`, `${f2(cx - k)} ${f2(y + r)} ${f2(cx - r)} ${f2(y + k)} ${f2(cx - r)} ${f2(y)} c`,
      `${f2(cx - r)} ${f2(y - k)} ${f2(cx - k)} ${f2(y - r)} ${f2(cx)} ${f2(y - r)} c`, `${f2(cx + k)} ${f2(y - r)} ${f2(cx + r)} ${f2(y - k)} ${f2(cx + r)} ${f2(y)} c`, 'h', op, 'Q');
    return this;
  }
  /** Polilinha/polígono: pontos [[x,y],...] */
  caminho(pontos, { fechar = false, preenchimento = null, contorno = '#000', espessura = 1, juncao = 1 } = {}) {
    if (!pontos.length) return this;
    const op = fechar ? (preenchimento && contorno ? 'b' : preenchimento ? 'f' : 's') : 'S';
    this.ops.push('q', `${preenchimento ? `${corPdf(preenchimento)} rg ` : ''}${contorno ? `${corPdf(contorno)} RG ` : ''}${f2(espessura)} w ${juncao} j ${juncao} J`, `${f2(pontos[0][0])} ${f2(this.y(pontos[0][1]))} m`, ...pontos.slice(1).map(([x, y]) => `${f2(x)} ${f2(this.y(y))} l`), op, 'Q');
    return this;
  }
  /** Texto em uma linha. alinhamento: esquerda | centro | direita (x é a âncora). y é a linha de base. */
  texto(str, x, y, { fonte = 'regular', tamanho = 11, cor = '#000', alinhamento = 'esquerda', espacamento = 0 } = {}) {
    const s = String(str ?? '');
    if (!s) return this;
    const f = this.doc.fonte(fonte);
    const largura = this.doc.medir(s, fonte, tamanho) + espacamento * Math.max(0, s.length - 1);
    const x0 = alinhamento === 'centro' ? x - largura / 2 : alinhamento === 'direita' ? x - largura : x;
    this.fontesUsadas.add(f.recurso);
    this.ops.push('q', 'BT', `/${f.recurso} ${f2(tamanho)} Tf`, `${corPdf(cor)} rg`, espacamento ? `${f2(espacamento)} Tc` : '', `${f2(x0)} ${f2(this.y(y))} Td`, `${this.doc.codificar(s, fonte)} Tj`, 'ET', 'Q');
    return this;
  }
  /** Parágrafo com quebra automática. Devolve a altura ocupada. */
  paragrafo(str, x, y, larguraMax, { fonte = 'regular', tamanho = 11, entrelinha = 1.4, cor = '#000', alinhamento = 'esquerda', maxLinhas = Infinity } = {}) {
    const linhas = this.doc.quebrar(str, fonte, tamanho, larguraMax).slice(0, maxLinhas);
    const passo = tamanho * entrelinha;
    linhas.forEach((l, i) => {
      const ax = alinhamento === 'centro' ? x + larguraMax / 2 : alinhamento === 'direita' ? x + larguraMax : x;
      this.texto(l, ax, y + tamanho + i * passo, { fonte, tamanho, cor, alinhamento });
    });
    return linhas.length * passo;
  }
  imagem(nome, x, y, w, h) {
    const img = this.doc.imagens.get(nome);
    if (!img) throw new Error(`imagem não registrada: ${nome}`);
    this.imagensUsadas.add(img.recurso);
    this.ops.push('q', `${f2(w)} 0 0 ${f2(h)} ${f2(x)} ${f2(this.y(y + h))} cm`, `/${img.recurso} Do`, 'Q');
    return this;
  }
  conteudo() { return this.ops.filter(Boolean).join('\n'); }
}

export class DocumentoPdf {
  constructor({ largura = 432, altura = 648, titulo = '', autor = '', assunto = '', palavrasChave = '', criador = 'Precozen Central', comprimir = true } = {}) {
    this.larguraPadrao = largura; this.alturaPadrao = altura;
    this.info = { titulo, autor, assunto, palavrasChave, criador };
    this.comprimir = comprimir;
    this.paginas = [];
    this.fontes = new Map(); // apelido -> { tipo: 'ttf'|'padrao', ttf, nome, recurso, glifosUsados }
    this.imagens = new Map();
    this.contadorRecursos = 0;
  }

  /** Registra fonte TrueType (caminho .ttf) ou padrão ('Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Courier'). */
  registrarFonte(apelido, origem) {
    const recurso = `F${++this.contadorRecursos}`;
    if (origem && /\.ttf$/i.test(origem)) {
      const ttf = lerTtf(origem);
      if (ttf.fsType === 2) throw new Error(`a fonte ${ttf.nome} não permite embutir (fsType restrito)`);
      this.fontes.set(apelido, { tipo: 'ttf', ttf, nome: ttf.nome, recurso, glifosUsados: new Map() });
    } else {
      const nome = origem || 'Helvetica';
      if (!(nome in FONTES_PADRAO)) throw new Error(`fonte padrão desconhecida: ${nome}`);
      this.fontes.set(apelido, { tipo: 'padrao', nome, recurso, larguras: FONTES_PADRAO[nome] });
    }
    return this;
  }
  fonte(apelido) {
    const f = this.fontes.get(apelido) || this.fontes.get('regular');
    if (!f) throw new Error(`fonte não registrada: ${apelido}`);
    return f;
  }
  registrarImagem(nome, caminho) {
    const img = lerImagem(caminho);
    this.imagens.set(nome, { ...img, recurso: `Im${++this.contadorRecursos}` });
    return img;
  }
  medir(texto, apelido = 'regular', tamanho = 11) {
    const f = this.fonte(apelido);
    if (f.tipo === 'ttf') return medirTtf(f.ttf, texto, tamanho);
    let w = 0;
    for (const ch of String(texto ?? '')) {
      const base = ch.normalize('NFD')[0];
      const c = base.charCodeAt(0);
      w += f.larguras ? (c >= 32 && c <= 126 ? f.larguras[c - 32] : 556) : 600;
    }
    return (w / 1000) * tamanho;
  }
  quebrar(texto, apelido, tamanho, larguraMax) {
    const linhas = [];
    for (const par of String(texto ?? '').split(/\n/)) {
      const palavras = par.split(/\s+/).filter(Boolean);
      let atual = '';
      for (const p of palavras) {
        const teste = atual ? `${atual} ${p}` : p;
        if (this.medir(teste, apelido, tamanho) <= larguraMax || !atual) {
          if (!atual && this.medir(p, apelido, tamanho) > larguraMax) {
            // palavra maior que a linha: corta por caracteres
            let pedaco = '';
            for (const ch of p) { if (this.medir(pedaco + ch, apelido, tamanho) > larguraMax && pedaco) { linhas.push(pedaco); pedaco = ''; } pedaco += ch; }
            atual = pedaco;
          } else atual = teste;
        } else { linhas.push(atual); atual = p; }
      }
      linhas.push(atual);
    }
    return linhas;
  }
  codificar(texto, apelido) {
    const f = this.fonte(apelido);
    if (f.tipo === 'ttf') {
      const hex = [];
      for (const ch of String(texto)) {
        const cp = ch.codePointAt(0);
        let g = f.ttf.cmap.get(cp);
        if (g === undefined) g = f.ttf.cmap.get(63) ?? 0; // "?"
        f.glifosUsados.set(g, cp);
        hex.push(g.toString(16).padStart(4, '0'));
      }
      return `<${hex.join('')}>`;
    }
    const bytes = [];
    for (const ch of String(texto)) {
      let c = ch.charCodeAt(0);
      if (c > 255) { const nfd = ch.normalize('NFD'); c = nfd.charCodeAt(0) < 256 ? nfd.charCodeAt(0) : 63; }
      bytes.push(c);
    }
    const s = Buffer.from(bytes).toString('latin1').replace(/[\\()]/g, (c) => `\\${c}`).replace(/[\x80-\xff]/g, (c) => `\\${c.charCodeAt(0).toString(8).padStart(3, '0')}`).replace(/[\r\n]/g, ' ');
    return `(${s})`;
  }
  novaPagina({ largura, altura } = {}) {
    const p = new Pagina(this, largura || this.larguraPadrao, altura || this.alturaPadrao);
    this.paginas.push(p);
    return p;
  }
  get totalPaginas() { return this.paginas.length; }

  /** Monta o arquivo. Devolve Buffer. */
  gerar() {
    const objetos = []; // Buffers, índice = id-1
    const novo = (conteudo) => { objetos.push(conteudo); return objetos.length; };
    const reservar = () => { objetos.push(null); return objetos.length; };
    const definir = (id, conteudo) => { objetos[id - 1] = conteudo; };
    const stream = (dict, dados, comprimir = this.comprimir) => {
      const corpo = comprimir ? zlib.deflateSync(Buffer.isBuffer(dados) ? dados : Buffer.from(dados, 'binary')) : (Buffer.isBuffer(dados) ? dados : Buffer.from(dados, 'binary'));
      return Buffer.concat([Buffer.from(`<< ${dict} /Length ${corpo.length}${comprimir ? ' /Filter /FlateDecode' : ''} >>\nstream\n`, 'binary'), corpo, Buffer.from('\nendstream', 'binary')]);
    };

    // Fontes
    const fontesIds = new Map();
    for (const [apelido, f] of this.fontes) {
      if (f.tipo === 'padrao') {
        fontesIds.set(f.recurso, novo(`<< /Type /Font /Subtype /Type1 /BaseFont /${f.nome} /Encoding /WinAnsiEncoding >>`));
        continue;
      }
      const t = f.ttf;
      const escala = 1000 / t.unitsPerEm;
      const arquivo = novo(stream(`/Length1 ${t.dados.length}`, t.dados));
      const flags = 32 | (t.italico ? 64 : 0);
      const descritor = novo(`<< /Type /FontDescriptor /FontName /${t.nome} /Flags ${flags} /FontBBox [${t.bbox.map((v) => Math.round(v * escala)).join(' ')}] /ItalicAngle ${f2(t.italico)} /Ascent ${Math.round(t.ascender * escala)} /Descent ${Math.round(t.descender * escala)} /CapHeight ${Math.round(t.capHeight * escala)} /StemV ${t.pesoClasse >= 600 ? 120 : 80} /FontFile2 ${arquivo} 0 R >>`);
      const glifos = [...f.glifosUsados.keys()].sort((a, b) => a - b);
      const w = glifos.map((g) => `${g} [${Math.round((t.larguras[g] || 0) * escala)}]`).join(' ');
      const cid = novo(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${t.nome} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descritor} 0 R /DW 1000 /W [${w}] /CIDToGIDMap /Identity >>`);
      const bf = glifos.map((g) => { const cp = f.glifosUsados.get(g); const u = cp > 0xffff ? Buffer.from(String.fromCodePoint(cp), 'utf16le') : null; const hexU = u ? [u[1], u[0], u[3], u[2]].map((b) => b.toString(16).padStart(2, '0')).join('') : cp.toString(16).padStart(4, '0'); return `<${g.toString(16).padStart(4, '0')}> <${hexU}>`; });
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${bf.length} beginbfchar\n${bf.join('\n')}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      const toUnicode = novo(stream('', cmap));
      fontesIds.set(f.recurso, novo(`<< /Type /Font /Subtype /Type0 /BaseFont /${t.nome} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`));
      void apelido;
    }
    // Imagens
    const imagensIds = new Map();
    for (const [, img] of this.imagens) {
      let mascara = '';
      if (img.mascara) {
        const sm = novo(stream(`/Type /XObject /Subtype /Image /Width ${img.largura} /Height ${img.altura} /ColorSpace /DeviceGray /BitsPerComponent 8`, img.mascara, false).toString('binary').replace('/Length', '/Filter /FlateDecode /Length'));
        mascara = ` /SMask ${sm} 0 R`;
      }
      let cs = `/${img.colorSpace}`;
      if (img.colorSpace === 'Indexed' && img.paleta) cs = `[/Indexed /DeviceRGB ${img.paleta.length / 3 - 1} <${img.paleta.toString('hex')}>]`;
      const decode = img.predictor ? ` /DecodeParms << /Predictor ${img.predictor.Predictor} /Colors ${img.predictor.Colors} /BitsPerComponent 8 /Columns ${img.predictor.Columns} >>` : '';
      const dict = `/Type /XObject /Subtype /Image /Width ${img.largura} /Height ${img.altura} /ColorSpace ${cs} /BitsPerComponent ${img.bits} /Filter /${img.filtro}${decode}${mascara}`;
      imagensIds.set(img.recurso, novo(stream(dict, img.dados, false)));
    }
    // Páginas
    const paginasId = reservar();
    const idsPaginas = [];
    for (const p of this.paginas) {
      const conteudo = novo(stream('', p.conteudo()));
      const fontes = [...p.fontesUsadas].map((r) => `/${r} ${fontesIds.get(r)} 0 R`).join(' ');
      const imgs = [...p.imagensUsadas].map((r) => `/${r} ${imagensIds.get(r)} 0 R`).join(' ');
      idsPaginas.push(novo(`<< /Type /Page /Parent ${paginasId} 0 R /MediaBox [0 0 ${f2(p.largura)} ${f2(p.altura)}] /Resources << /ProcSet [/PDF /Text /ImageC /ImageB] /Font << ${fontes} >> /XObject << ${imgs} >> >> /Contents ${conteudo} 0 R >>`));
    }
    definir(paginasId, `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${idsPaginas.length} >>`);
    const catalogo = novo(`<< /Type /Catalog /Pages ${paginasId} 0 R /PageLayout /SinglePage >>`);
    const agora = new Date();
    const data = `D:${agora.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
    const info = novo(`<< /Title ${textoPdf(this.info.titulo)} /Author ${textoPdf(this.info.autor)} /Subject ${textoPdf(this.info.assunto)} /Keywords ${textoPdf(this.info.palavrasChave)} /Creator ${textoPdf(this.info.criador)} /Producer (Precozen Central PDF) /CreationDate (${data}) /ModDate (${data}) >>`);

    // Serialização com offsets em bytes
    const partes = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'binary')];
    let offset = partes[0].length;
    const offsets = [];
    objetos.forEach((obj, i) => {
      const cabeca = Buffer.from(`${i + 1} 0 obj\n`, 'binary');
      const corpo = Buffer.isBuffer(obj) ? obj : Buffer.from(String(obj), 'binary');
      const fim = Buffer.from('\nendobj\n', 'binary');
      offsets.push(offset);
      partes.push(cabeca, corpo, fim);
      offset += cabeca.length + corpo.length + fim.length;
    });
    const xrefPos = offset;
    const id = crypto.createHash('md5').update(Buffer.concat(partes)).digest('hex');
    const xref = [`xref`, `0 ${objetos.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `), 'trailer', `<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R /ID [<${id}> <${id}>] >>`, 'startxref', String(xrefPos), '%%EOF', ''].join('\n');
    partes.push(Buffer.from(xref, 'binary'));
    return Buffer.concat(partes);
  }
}
