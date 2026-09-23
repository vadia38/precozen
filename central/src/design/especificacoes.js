// Especificações de arquivos e textos para venda na Amazon: Merch (print on demand), imagens de listagem e A+.
// Conferido em 2026-09; a Amazon muda requisitos sem aviso — confira em merch.amazon.com e na Central do Vendedor.

export const MERCH = {
  camiseta: { nome: 'Camiseta padrão', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG com fundo transparente, sRGB, 300 dpi', maxMb: 25 },
  'camiseta-premium': { nome: 'Camiseta premium', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG transparente', maxMb: 25 },
  'gola-v': { nome: 'Camiseta gola V', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG transparente', maxMb: 25 },
  regata: { nome: 'Regata', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG transparente', maxMb: 25 },
  'manga-longa': { nome: 'Manga longa', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG transparente', maxMb: 25 },
  raglan: { nome: 'Raglan', largura: 4500, altura: 5400, polegadas: '15 × 18', formato: 'PNG transparente', maxMb: 25 },
  moletom: { nome: 'Moletom', largura: 4500, altura: 4050, polegadas: '15 × 13,5', formato: 'PNG transparente', maxMb: 25 },
  'moletom-capuz': { nome: 'Moletom com capuz', largura: 4500, altura: 4050, polegadas: '15 × 13,5', formato: 'PNG transparente', maxMb: 25 },
  'moletom-ziper': { nome: 'Moletom com zíper', largura: 4500, altura: 4050, polegadas: '15 × 13,5', formato: 'PNG transparente', maxMb: 25 },
  popsocket: { nome: 'PopSockets', largura: 485, altura: 485, polegadas: '1,6 × 1,6', formato: 'PNG (área circular)', maxMb: 25 },
};

export const LIMITES_MERCH = { marca: 50, titulo: 60, bullet: 256, bullets: 2, descricao: 2000 };

export const IMAGENS_AMAZON = {
  principal: { nome: 'Imagem principal', largura: 2000, altura: 2000, fundo: '#FFFFFF', ocupacao: 0.85, observacao: 'Fundo branco puro (RGB 255), produto ocupando ≥ 85% do quadro, sem texto, logos ou marcas d’água' },
  secundaria: { nome: 'Imagens secundárias', largura: 2000, altura: 2000, observacao: 'Infográficos, escala, uso; texto permitido' },
  'a-plus-padrao': { nome: 'A+ imagem padrão', largura: 970, altura: 600 },
  'a-plus-texto': { nome: 'A+ imagem com texto', largura: 300, altura: 300 },
  'a-plus-comparativo': { nome: 'A+ tabela comparativa', largura: 150, altura: 300 },
  'banner-loja': { nome: 'Banner da loja', largura: 3000, altura: 600 },
};

export const LIMITES_AMAZON = { titulo: 200, bullet: 250, bullets: 5, descricao: 2000, palavrasChaveBytes: 250 };

export function produtoMerch(id) {
  const p = MERCH[String(id).toLowerCase()];
  if (!p) throw new Error(`produto Merch desconhecido: ${id} (opções: ${Object.keys(MERCH).join(', ')})`);
  return { id: String(id).toLowerCase(), ...p };
}

export function imagemAmazon(id) {
  const p = IMAGENS_AMAZON[String(id).toLowerCase()];
  if (!p) throw new Error(`tipo de imagem desconhecido: ${id} (opções: ${Object.keys(IMAGENS_AMAZON).join(', ')})`);
  return { id: String(id).toLowerCase(), ...p };
}
