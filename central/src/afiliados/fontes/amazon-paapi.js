// Amazon Product Advertising API 5.0 com assinatura AWS SigV4 (sem SDK). Exige conta de Associado aprovada.
// Docs: https://webservices.amazon.com/paapi5/documentation/
import crypto from 'node:crypto';
import { segredo } from '../../core/config.js';
import { requisitar } from '../../core/http.js';

export const nome = 'amazon-paapi';
export const descricao = 'Busca na Amazon via PA-API 5 (AMAZON_PAAPI_ACCESS_KEY/SECRET_KEY/PARTNER_TAG no .env)';

const SERVICO = 'ProductAdvertisingAPI';
const RECURSOS = [
  'ItemInfo.Title', 'ItemInfo.ByLineInfo', 'ItemInfo.Features', 'ItemInfo.Classifications', 'ItemInfo.ProductInfo',
  'Offers.Listings.Price', 'Offers.Listings.SavingBasis', 'Offers.Listings.Availability.Message',
  'Images.Primary.Large', 'BrowseNodeInfo.WebsiteSalesRank', 'BrowseNodeInfo.BrowseNodes',
];

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (chave, s, enc) => crypto.createHmac('sha256', chave).update(s, 'utf8').digest(enc);

/** Marketplace ("www.amazon.com.br") e região a partir do host. */
export function regiaoDoHost(host) {
  const mapa = { 'webservices.amazon.com': 'us-east-1', 'webservices.amazon.com.br': 'us-east-1', 'webservices.amazon.ca': 'us-east-1', 'webservices.amazon.com.mx': 'us-east-1', 'webservices.amazon.co.uk': 'eu-west-1', 'webservices.amazon.de': 'eu-west-1', 'webservices.amazon.fr': 'eu-west-1', 'webservices.amazon.es': 'eu-west-1', 'webservices.amazon.it': 'eu-west-1', 'webservices.amazon.co.jp': 'us-west-2', 'webservices.amazon.com.au': 'us-west-2', 'webservices.amazon.in': 'eu-west-1' };
  return mapa[host] || 'us-east-1';
}

/**
 * Assina uma requisição PA-API (POST JSON). Puro: recebe data fixa para testes.
 * Devolve { url, cabecalhos, corpo }.
 */
export function assinarRequisicao({ host, caminho, alvo, corpo, accessKey, secretKey, regiao, data = new Date() }) {
  const amzDate = data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dataCurta = amzDate.slice(0, 8);
  const payload = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  const cabecalhosCanon = { 'content-encoding': 'amz-1.0', host, 'x-amz-date': amzDate, 'x-amz-target': alvo };
  const chaves = Object.keys(cabecalhosCanon).sort();
  const canonHeaders = chaves.map((k) => `${k}:${cabecalhosCanon[k]}\n`).join('');
  const signed = chaves.join(';');
  const canonRequest = ['POST', caminho, '', canonHeaders, signed, sha256(payload)].join('\n');
  const escopo = `${dataCurta}/${regiao}/${SERVICO}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, escopo, sha256(canonRequest)].join('\n');
  const kDate = hmac(`AWS4${secretKey}`, dataCurta);
  const kRegion = hmac(kDate, regiao);
  const kService = hmac(kRegion, SERVICO);
  const kSigning = hmac(kService, 'aws4_request');
  const assinatura = hmac(kSigning, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${escopo}, SignedHeaders=${signed}, Signature=${assinatura}`;
  return {
    url: `https://${host}${caminho}`,
    cabecalhos: { 'content-type': 'application/json; charset=utf-8', 'content-encoding': 'amz-1.0', host, 'x-amz-date': amzDate, 'x-amz-target': alvo, authorization },
    corpo: payload,
    canonRequest,
    stringToSign,
  };
}

/** Converte um item da resposta em registro bruto compatível com a normalização. */
export function converterItem(item, marketplace) {
  const info = item.ItemInfo || {};
  const listing = item.Offers?.Listings?.[0] || {};
  const nos = item.BrowseNodeInfo?.BrowseNodes || [];
  const categoria = nos.find((n) => n.SalesRank)?.ContextFreeName || nos[0]?.ContextFreeName || nos[0]?.DisplayName || info.Classifications?.ProductGroup?.DisplayValue || '';
  return {
    programa: marketplace === 'www.amazon.com' ? 'amazon-com' : 'amazon-br',
    asin: item.ASIN,
    nome: info.Title?.DisplayValue || '',
    marca: info.ByLineInfo?.Brand?.DisplayValue || info.ByLineInfo?.Manufacturer?.DisplayValue || '',
    categoria,
    preco: listing.Price?.Amount ?? '',
    preco_antigo: listing.SavingBasis?.Amount ?? '',
    bsr: item.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank ?? nos.find((n) => n.SalesRank)?.SalesRank ?? '',
    imagem: item.Images?.Primary?.Large?.URL || '',
    url: item.DetailPageURL || '',
    link: item.DetailPageURL || '',
    pros: (info.Features?.DisplayValues || []).slice(0, 6).join('; '),
    descricao: (info.Features?.DisplayValues || []).join(' '),
  };
}

export function credenciais(env = {}) {
  const accessKey = env.accessKey || segredo('AMAZON_PAAPI_ACCESS_KEY');
  const secretKey = env.secretKey || segredo('AMAZON_PAAPI_SECRET_KEY');
  const tag = env.tag || segredo('AMAZON_PAAPI_PARTNER_TAG');
  const host = env.host || segredo('AMAZON_PAAPI_HOST') || 'webservices.amazon.com.br';
  const regiao = env.regiao || segredo('AMAZON_PAAPI_REGION') || regiaoDoHost(host);
  if (!accessKey || !secretKey || !tag) throw new Error('PA-API: defina AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY e AMAZON_PAAPI_PARTNER_TAG no central/.env');
  return { accessKey, secretKey, tag, host, regiao, marketplace: host.replace('webservices.', 'www.') };
}

/** SearchItems: busca por palavras-chave. opcoes: { palavras, indice='All', paginas=1, itensPorPagina=10 } */
export async function buscar(opcoes = {}, deps = {}) {
  const cred = credenciais(deps.credenciais);
  const { palavras, indice = 'All', paginas = 1, itensPorPagina = 10, minPreco, maxPreco } = opcoes;
  if (!palavras) throw new Error('informe --palavras "termo de busca"');
  const registros = [];
  for (let pagina = 1; pagina <= Math.min(paginas, 10); pagina++) {
    const corpo = {
      Keywords: palavras, SearchIndex: indice, ItemCount: Math.min(10, itensPorPagina), ItemPage: pagina,
      PartnerTag: cred.tag, PartnerType: 'Associates', Marketplace: cred.marketplace, Resources: RECURSOS,
      ...(minPreco ? { MinPrice: Math.round(minPreco * 100) } : {}), ...(maxPreco ? { MaxPrice: Math.round(maxPreco * 100) } : {}),
    };
    const req = assinarRequisicao({ host: cred.host, caminho: '/paapi5/searchitems', alvo: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems', corpo, accessKey: cred.accessKey, secretKey: cred.secretKey, regiao: cred.regiao });
    const resp = await requisitar(req.url, { metodo: 'POST', cabecalhos: req.cabecalhos, corpo: req.corpo, fetchImpl: deps.fetchImpl });
    const itens = resp.json?.SearchResult?.Items || [];
    registros.push(...itens.map((it) => converterItem(it, cred.marketplace)));
    if (itens.length < corpo.ItemCount) break;
  }
  return registros;
}

/** GetItems: detalhes de até 10 ASINs por chamada. */
export async function obterItens(asins, deps = {}) {
  const cred = credenciais(deps.credenciais);
  const registros = [];
  for (let i = 0; i < asins.length; i += 10) {
    const corpo = { ItemIds: asins.slice(i, i + 10), PartnerTag: cred.tag, PartnerType: 'Associates', Marketplace: cred.marketplace, Resources: RECURSOS };
    const req = assinarRequisicao({ host: cred.host, caminho: '/paapi5/getitems', alvo: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', corpo, accessKey: cred.accessKey, secretKey: cred.secretKey, regiao: cred.regiao });
    const resp = await requisitar(req.url, { metodo: 'POST', cabecalhos: req.cabecalhos, corpo: req.corpo, fetchImpl: deps.fetchImpl });
    registros.push(...(resp.json?.ItemsResult?.Items || []).map((it) => converterItem(it, cred.marketplace)));
  }
  return registros;
}
