// Paletas de cores para designs (capas, camisetas, imagens de listagem) e utilitários de contraste.

export const PALETAS = {
  noite: { nome: 'Noite', fundo: '#0F172A', texto: '#F8FAFC', acento: '#F59E0B', secundaria: '#1E293B' },
  praia: { nome: 'Praia', fundo: '#FDF6E3', texto: '#0F3D5E', acento: '#F97316', secundaria: '#7DD3FC' },
  retro: { nome: 'Retrô', fundo: '#F4E1C1', texto: '#3B2F2F', acento: '#C0392B', secundaria: '#E9A23B' },
  floresta: { nome: 'Floresta', fundo: '#14261D', texto: '#EAF4EC', acento: '#9AE6B4', secundaria: '#2F6B4A' },
  neon: { nome: 'Neon', fundo: '#0B0B12', texto: '#FFFFFF', acento: '#39FF14', secundaria: '#FF2D95' },
  pastel: { nome: 'Pastel', fundo: '#FFF1F2', texto: '#4A2C3A', acento: '#F472B6', secundaria: '#A5B4FC' },
  mono: { nome: 'Monocromático', fundo: '#FFFFFF', texto: '#111111', acento: '#111111', secundaria: '#9CA3AF' },
  vinho: { nome: 'Vinho', fundo: '#3B0A1E', texto: '#FDE8EF', acento: '#F4B860', secundaria: '#7A1F3D' },
  oceano: { nome: 'Oceano', fundo: '#0B3C5D', texto: '#EAF6FF', acento: '#FFD166', secundaria: '#1D6FA3' },
  sol: { nome: 'Sol', fundo: '#FFB703', texto: '#1B1B1B', acento: '#023047', secundaria: '#FB8500' },
  papel: { nome: 'Papel', fundo: '#FAF7F0', texto: '#2B2B2B', acento: '#B45309', secundaria: '#D6CFC2' },
  lavanda: { nome: 'Lavanda', fundo: '#EDE9FE', texto: '#2E1065', acento: '#7C3AED', secundaria: '#C4B5FD' },
};

export function paleta(nome = 'noite') {
  const p = PALETAS[String(nome).toLowerCase()];
  if (!p) throw new Error(`paleta desconhecida: ${nome} (opções: ${Object.keys(PALETAS).join(', ')})`);
  return { id: String(nome).toLowerCase(), ...p };
}

export function hexParaRgb(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbParaHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Luminância relativa (WCAG). */
export function luminancia(hex) {
  const [r, g, b] = hexParaRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const la = luminancia(a); const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Cor de texto legível (preto ou branco) sobre um fundo. */
export function textoLegivel(fundo) {
  return contraste(fundo, '#111111') >= contraste(fundo, '#FFFFFF') ? '#111111' : '#FFFFFF';
}

export function misturar(a, b, t = 0.5) {
  const ca = hexParaRgb(a); const cb = hexParaRgb(b);
  return rgbParaHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export const escurecer = (hex, t = 0.2) => misturar(hex, '#000000', t);
export const clarear = (hex, t = 0.2) => misturar(hex, '#FFFFFF', t);
