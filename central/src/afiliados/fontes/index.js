// Registro das fontes de produtos.
import * as arquivo from './arquivo.js';
import * as amazon from './amazon-paapi.js';
import * as mercadolivre from './mercadolivre.js';
import * as shopee from './shopee.js';
import * as hotmart from './hotmart.js';

export const FONTES = { arquivo, 'amazon-paapi': amazon, mercadolivre, shopee, hotmart };

export function fonte(nome) {
  const f = FONTES[nome];
  if (!f) throw new Error(`fonte desconhecida: ${nome} (disponíveis: ${Object.keys(FONTES).join(', ')})`);
  return f;
}
