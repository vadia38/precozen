// Shopee Affiliate Open API (GraphQL) com assinatura SHA256: Authorization: SHA256 Credential=AppId, Timestamp=ts, Signature=sha256(AppId+ts+payload+Secret)
import crypto from 'node:crypto';
import { segredo } from '../../core/config.js';
import { requisitar } from '../../core/http.js';

export const nome = 'shopee';
export const descricao = 'Ofertas de produtos da Shopee Afiliados (SHOPEE_AFFILIATE_APP_ID/SECRET no .env)';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

export function assinar({ appId, secret, payload, timestamp = Math.floor(Date.now() / 1000) }) {
  const assinatura = crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`, 'utf8').digest('hex');
  return { authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${assinatura}`, timestamp, assinatura };
}

export function consultaOfertas({ palavras, limite = 50, pagina = 1, ordenacao = 2 }) {
  const q = `{ productOfferV2(keyword: ${JSON.stringify(palavras)}, limit: ${Math.min(50, limite)}, page: ${pagina}, sortType: ${ordenacao}) { nodes { itemId productName priceMin priceMax commissionRate commission sales ratingStar imageUrl productLink offerLink shopName productCatIds priceDiscountRate } pageInfo { page limit hasNextPage } } }`;
  return JSON.stringify({ query: q });
}

export function converterOferta(n) {
  return {
    programa: 'shopee',
    id: String(n.itemId ?? ''),
    nome: n.productName || '',
    categoria: Array.isArray(n.productCatIds) ? String(n.productCatIds[0] ?? '') : '',
    preco: n.priceMin ?? n.priceMax ?? '',
    comissao: n.commissionRate ?? '',
    total_vendido: n.sales ?? '',
    avaliacao: n.ratingStar ?? '',
    imagem: n.imageUrl || '',
    url: n.productLink || '',
    link: n.offerLink || '',
    marca: n.shopName || '',
  };
}

export async function buscar(opcoes = {}, deps = {}) {
  const appId = deps.appId || segredo('SHOPEE_AFFILIATE_APP_ID');
  const secret = deps.secret || segredo('SHOPEE_AFFILIATE_SECRET');
  if (!appId || !secret) throw new Error('Shopee: defina SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET no central/.env');
  if (!opcoes.palavras) throw new Error('informe --palavras "termo de busca"');
  const registros = [];
  for (let pagina = 1; pagina <= (opcoes.paginas || 1); pagina++) {
    const payload = consultaOfertas({ ...opcoes, pagina });
    const { authorization } = assinar({ appId, secret, payload });
    const resp = await requisitar(ENDPOINT, { metodo: 'POST', corpo: payload, cabecalhos: { 'content-type': 'application/json', authorization }, fetchImpl: deps.fetchImpl });
    if (resp.json?.errors?.length) throw new Error(`Shopee: ${resp.json.errors.map((e) => e.message).join('; ')}`);
    const dados = resp.json?.data?.productOfferV2;
    registros.push(...(dados?.nodes || []).map(converterOferta));
    if (!dados?.pageInfo?.hasNextPage) break;
  }
  return registros;
}
