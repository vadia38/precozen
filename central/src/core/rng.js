// Gerador pseudoaleatório determinístico (mulberry32) para puzzles e designs reproduzíveis.

function semearTexto(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let h = 1779033703 ^ String(seed ?? 'precozen').length;
  for (const ch of String(seed ?? 'precozen')) {
    h = Math.imul(h ^ ch.codePointAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Cria um gerador com métodos utilitários. A mesma semente produz a mesma sequência. */
export function criarRng(seed = 'precozen') {
  let a = semearTexto(seed) || 1;
  const proximo = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inteiro = (min, max) => min + Math.floor(proximo() * (max - min + 1));
  const escolher = (arr) => arr[Math.floor(proximo() * arr.length)];
  const embaralhar = (arr) => {
    const c = [...arr];
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(proximo() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return c;
  };
  const chance = (p) => proximo() < p;
  return { proximo, inteiro, escolher, embaralhar, chance, seed };
}
