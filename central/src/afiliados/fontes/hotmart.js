// Hotmart: histórico de vendas do afiliado (o que realmente está vendendo), via OAuth client_credentials.
import { segredo } from '../../core/config.js';
import { requisitar, obterJson } from '../../core/http.js';

export const nome = 'hotmart';
export const descricao = 'Vendas aprovadas do seu histórico Hotmart, agregadas por produto (HOTMART_CLIENT_ID/SECRET/BASIC no .env)';

const AUTH = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const API = 'https://developers.hotmart.com/payments/api/v1';

export async function obterToken(deps = {}) {
  const clientId = deps.clientId || segredo('HOTMART_CLIENT_ID');
  const clientSecret = deps.clientSecret || segredo('HOTMART_CLIENT_SECRET');
  const basic = deps.basic || segredo('HOTMART_BASIC');
  if (!clientId || !clientSecret || !basic) throw new Error('Hotmart: defina HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET e HOTMART_BASIC no central/.env');
  const url = `${AUTH}?grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const resp = await requisitar(url, { metodo: 'POST', cabecalhos: { authorization: `Basic ${basic}`, 'content-type': 'application/json' }, fetchImpl: deps.fetchImpl });
  if (!resp.json?.access_token) throw new Error('Hotmart: token não recebido');
  return resp.json.access_token;
}

/** Agrega transações aprovadas por produto: vendas, faturamento e comissão média. */
export function agregarVendas(itens, { dias = 30 } = {}) {
  const porProduto = new Map();
  for (const it of itens) {
    const id = String(it.product?.id ?? it.product?.ucode ?? it.product?.name ?? '');
    if (!id) continue;
    const p = porProduto.get(id) || { id, nome: it.product?.name || id, vendas: 0, faturamento: 0, comissao: 0, moeda: it.purchase?.price?.currency_code || 'BRL' };
    p.vendas += 1;
    p.faturamento += Number(it.purchase?.price?.value) || 0;
    p.comissao += Number(it.commissions?.find?.((c) => c.source === 'AFFILIATE')?.commission?.value ?? it.purchase?.commission_as_affiliate?.value ?? 0) || 0;
    porProduto.set(id, p);
  }
  const fator = 30 / Math.max(1, dias);
  return [...porProduto.values()].map((p) => ({
    programa: 'hotmart',
    id: p.id,
    nome: p.nome,
    categoria: 'cursos',
    preco: p.vendas ? p.faturamento / p.vendas : '',
    comissao: p.faturamento ? p.comissao / p.faturamento : '',
    vendas_mes: Math.round(p.vendas * fator * 10) / 10,
    link: '',
  }));
}

export async function buscar(opcoes = {}, deps = {}) {
  const token = deps.token || (await obterToken(deps));
  const dias = Number(opcoes.dias) || 30;
  const fim = Date.now();
  const inicio = fim - dias * 24 * 60 * 60 * 1000;
  const itens = [];
  let pagina = null;
  do {
    const url = `${API}/sales/history?transaction_status=APPROVED&start_date=${inicio}&end_date=${fim}&max_results=500${pagina ? `&page_token=${encodeURIComponent(pagina)}` : ''}`;
    const dados = await obterJson(url, { cabecalhos: { authorization: `Bearer ${token}` }, fetchImpl: deps.fetchImpl });
    itens.push(...(dados.items || []));
    pagina = dados.page_info?.next_page_token || null;
  } while (pagina);
  return agregarVendas(itens, { dias });
}
