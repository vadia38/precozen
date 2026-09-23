// Importação de produtos para a base local (workspace/afiliados/produtos.json), com mesclagem por id.
import { workspace, lerJson, gravarJson } from '../core/arquivos.js';
import { normalizarProduto } from './normalizar.js';
import { fonte } from './fontes/index.js';

export const caminhoProdutos = () => workspace('afiliados', 'produtos.json');

export function carregarProdutos() {
  return lerJson(caminhoProdutos(), []);
}

export function salvarProdutos(produtos) {
  return gravarJson(caminhoProdutos(), produtos);
}

/**
 * Normaliza e mescla registros brutos na base. Campos vazios do registro novo não apagam os existentes;
 * campos informados (preço, avaliações, vendas) atualizam. `substituir` troca a base inteira.
 */
export function importarRegistros(registros, { programa = 'amazon-br', config, substituir = false, hoje = new Date(), produtosAtuais } = {}) {
  const configAfiliados = config?.afiliados || {};
  const atuais = substituir ? [] : (produtosAtuais || carregarProdutos());
  const porId = new Map(atuais.map((p) => [p.id, p]));
  const avisos = [];
  let novos = 0;
  let atualizados = 0;
  let ignorados = 0;
  for (const bruto of registros) {
    const { produto, avisos: av } = normalizarProduto(bruto, { programaPadrao: programa, configAfiliados, hoje });
    avisos.push(...av);
    if (!produto) { ignorados++; continue; }
    const existente = porId.get(produto.id);
    if (existente) {
      const mesclado = { ...existente };
      for (const [k, v] of Object.entries(produto)) {
        const vazio = v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && v && !Object.keys(v).length);
        if (!vazio) mesclado[k] = v;
      }
      mesclado.numAvaliacoes = Math.max(existente.numAvaliacoes || 0, produto.numAvaliacoes || 0);
      porId.set(produto.id, mesclado);
      atualizados++;
    } else {
      porId.set(produto.id, produto);
      novos++;
    }
  }
  const produtos = [...porId.values()];
  return { produtos, total: produtos.length, novos, atualizados, ignorados, avisos };
}

/** Importa de uma fonte registrada (arquivo, amazon-paapi, mercadolivre, shopee, hotmart) e grava a base. */
export async function importarDeFonte(nomeFonte, opcoes = {}, { config, gravar = true, deps } = {}) {
  const f = fonte(nomeFonte);
  const registros = await f.buscar(opcoes, deps);
  const resultado = importarRegistros(registros, { programa: opcoes.programa || 'amazon-br', config, substituir: Boolean(opcoes.substituir) });
  if (gravar) salvarProdutos(resultado.produtos);
  return { ...resultado, fonte: nomeFonte, registros: registros.length };
}
