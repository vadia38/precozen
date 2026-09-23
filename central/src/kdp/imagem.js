// Leitura de imagens para embutir em PDF: JPEG (direto, DCTDecode) e PNG (não entrelaçado; tons de cinza, RGB, RGBA e paleta).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function lerImagem(caminho) {
  const buf = fs.readFileSync(caminho);
  if (buf[0] === 0xff && buf[1] === 0xd8) return lerJpeg(buf, caminho);
  if (buf.toString('ascii', 1, 4) === 'PNG') return lerPng(buf, caminho);
  throw new Error(`formato de imagem não suportado (use JPEG ou PNG): ${caminho}`);
}

function lerJpeg(buf, caminho) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marcador = buf[i + 1];
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { i += 2; continue; }
    const tamanho = buf.readUInt16BE(i + 2);
    if ((marcador >= 0xc0 && marcador <= 0xc3) || (marcador >= 0xc5 && marcador <= 0xc7) || (marcador >= 0xc9 && marcador <= 0xcb) || (marcador >= 0xcd && marcador <= 0xcf)) {
      const bits = buf[i + 4];
      const altura = buf.readUInt16BE(i + 5);
      const largura = buf.readUInt16BE(i + 7);
      const canais = buf[i + 9];
      return { tipo: 'jpeg', caminho, largura, altura, bits, canais, colorSpace: canais === 1 ? 'DeviceGray' : canais === 4 ? 'DeviceCMYK' : 'DeviceRGB', dados: buf, filtro: 'DCTDecode' };
    }
    i += 2 + tamanho;
  }
  throw new Error(`JPEG sem cabeçalho de dimensões: ${caminho}`);
}

function lerPng(buf, caminho) {
  let pos = 8;
  let largura = 0; let altura = 0; let bits = 8; let tipoCor = 2; let entrelacado = 0;
  const idat = [];
  let paleta = null;
  while (pos < buf.length) {
    const tamanho = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === 'IHDR') { largura = dados.readUInt32BE(0); altura = dados.readUInt32BE(4); bits = dados[8]; tipoCor = dados[9]; entrelacado = dados[12]; }
    else if (tipo === 'PLTE') paleta = Buffer.from(dados);
    else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    pos += 12 + tamanho;
  }
  if (entrelacado) throw new Error(`PNG entrelaçado não suportado: ${caminho}`);
  if (bits !== 8) throw new Error(`PNG com ${bits} bits por canal não suportado (use 8): ${caminho}`);
  const comprimido = Buffer.concat(idat);
  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipoCor];
  if (!canais) throw new Error(`PNG com tipo de cor ${tipoCor} não suportado: ${caminho}`);
  if (tipoCor === 0 || tipoCor === 2 || tipoCor === 3) {
    return { tipo: 'png', caminho, largura, altura, bits, canais, colorSpace: tipoCor === 0 ? 'DeviceGray' : tipoCor === 3 ? 'Indexed' : 'DeviceRGB', paleta, dados: comprimido, filtro: 'FlateDecode', predictor: { Predictor: 15, Colors: canais, BitsPerComponent: 8, Columns: largura } };
  }
  // Com alfa: desfaz os filtros PNG, separa cor e máscara
  const bruto = zlib.inflateSync(comprimido);
  const bpp = canais;
  const stride = largura * bpp;
  const cor = Buffer.alloc(largura * altura * (bpp - 1));
  const alfa = Buffer.alloc(largura * altura);
  let anterior = Buffer.alloc(stride);
  for (let y = 0; y < altura; y++) {
    const filtro = bruto[y * (stride + 1)];
    const linha = Buffer.from(bruto.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? linha[x - bpp] : 0;
      const b = anterior[x];
      const c = x >= bpp ? anterior[x - bpp] : 0;
      let v = linha[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += Math.floor((a + b) / 2);
      else if (filtro === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      linha[x] = v & 0xff;
    }
    for (let x = 0; x < largura; x++) {
      for (let k = 0; k < bpp - 1; k++) cor[(y * largura + x) * (bpp - 1) + k] = linha[x * bpp + k];
      alfa[y * largura + x] = linha[x * bpp + bpp - 1];
    }
    anterior = linha;
  }
  return { tipo: 'png', caminho, largura, altura, bits: 8, canais: bpp - 1, colorSpace: bpp === 2 ? 'DeviceGray' : 'DeviceRGB', dados: zlib.deflateSync(cor), filtro: 'FlateDecode', mascara: zlib.deflateSync(alfa) };
}
