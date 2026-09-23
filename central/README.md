# Precozen Central

Sistema central de monetização em três frentes, com uma única linha de comando (`precozen`):

1. **Afiliados + blog** — importa produtos de programas de afiliados (Amazon, Mercado Livre, Shopee, Hotmart, Magalu), pontua **vendas × comissão × qualidade × preço × tendência**, gera análises e comparativos em Markdown e publica um blog estático monetizado com links de afiliado.
2. **Amazon KDP** — gera livros prontos para publicar: interior em PDF com fontes embutidas (caça-palavras, sudoku, labirintos, planner, rastreador de hábitos, cadernos, livros de texto a partir de um manuscrito, páginas para colorir), capa completa (verso + lombada + frente), metadados validados, preços/royalties e pontuação de nichos.
3. **Designs para a Amazon** — estampas tipográficas para Merch by Amazon (PNG 4500×5400 transparente), capas KDP, imagens de listagem (principal, infográfico 2000×2000, banner A+), textos de listagem e checagem de conformidade (marcas registradas, termos proibidos, limites).

Tudo em Node 20+ sem dependências obrigatórias. A geração de texto com IA (Claude) é opcional: sem chave, tudo funciona em **modo template**. O módulo **fiscal** estima imposto e líquido (PF/carnê-leão, MEI, Simples) sobre comissões e royalties, e o **painel** mostra o estado de tudo.

```
cd central
node bin/precozen.js exemplo          # roda o fluxo completo com dados de exemplo (≈ 3 s)
node bin/precozen.js painel servir    # http://localhost:4190/painel/ e /blog/dist/
node bin/precozen.js ajuda            # todos os módulos e comandos
```

Na raiz do repositório: `npm run central -- <modulo> <comando>` faz o mesmo.

## Fluxo de monetização

```
CSV/JSON ou APIs ──► afiliados importar ──► afiliados analisar (ranking: score, classe, ganho/100 cliques)
                                                     │
                                                     ├──► afiliados reviews / comparativos (Markdown em conteudo/posts)
                                                     │           └──► blog build (HTML estático, SEO, RSS, JSON-LD, CSP)
                                                     │
                       kdp nicho / kdp livro ────────┼──► interior.pdf + capa.svg/html + metadados.json + manifesto.json
                                                     │
      design camiseta / capa / listagem / ideias ────┼──► SVG + PNG/PDF + textos + conformidade
                                                     │
                                          painel build ◄─┘   fiscal estimar
```

## Módulo afiliados

| Comando | O que faz |
|---|---|
| `afiliados importar --arquivo produtos.csv [--programa amazon-br]` | Importa CSV/JSON (colunas flexíveis: `nome, preco, categoria, comissao, bsr, vendas_mes, avaliacao, avaliacoes, link, url, imagem, descricao, pros, contras, atributos, palavras_chave, publico`). Mescla por id. |
| `afiliados importar --fonte amazon-paapi --palavras "air fryer"` | Busca na PA-API 5 (assinatura SigV4 própria). Exige conta de Associado aprovada e as chaves no `.env`. |
| `afiliados importar --fonte mercadolivre --palavras "..."` | Busca pública do Mercado Livre (vendas estimadas por `sold_quantity`/idade do anúncio). |
| `afiliados importar --fonte shopee --palavras "..."` | Shopee Affiliate Open API (GraphQL assinado). |
| `afiliados importar --fonte hotmart --dias 30` | Vendas aprovadas do seu histórico Hotmart, agregadas por produto. |
| `afiliados analisar [--top N] [--min-score 60] [--programa x] [--categoria y]` | Pontua e grava `workspace/afiliados/ranking.{json,csv,md}`. |
| `afiliados reviews [--top 10] [--id a,b] [--forcar] [--ia]` | Gera análises em `conteudo/posts/`. |
| `afiliados comparativos [--minimo 3]` | Gera "Os N melhores &lt;categoria&gt; de &lt;ano&gt;". |
| `afiliados programas` / `afiliados fontes` | Tabelas de comissão de referência e fontes disponíveis. |

**Score (0–100)** = comissão por venda (30%) + demanda (30%) + qualidade (20%) + faixa de preço (10%) + tendência (10%), pesos em `precozen.config.json`. Classes: ouro ≥ 70, prata ≥ 55, bronze ≥ 40. **Ganho/100 cliques** = preço × comissão × conversão esperada × 100 (EPC), a métrica para comparar produtos entre programas. Vendas mensais: informadas, estimadas pelo histórico ou pelo ranking de vendas (`vendas ≈ k × BSR^-α`, parâmetros em `afiliados.estimativas`).

As comissões de `data/programas.json` são **valores de referência** — as tabelas oficiais mudam; informe a coluna `comissao` sempre que tiver o número real. Links da Amazon são montados por ASIN + tag; os demais programas geram links no próprio painel (coluna `link`).

## Módulo blog

`blog build [--out dist] [--base /blog/] [--url https://...]`, `blog validar`, `blog servir`. Lê `conteudo/posts/*.md` (front matter + Markdown) e `conteudo/paginas/*.md` (sobre, divulgação, privacidade, contato) e gera: início, posts, categorias, comparativos, busca (cliente), páginas fixas, `feed.xml`, `sitemap.xml`, `robots.txt`, `api/posts.json`, `favicon.svg`, `_headers`. Recursos: JSON-LD (`Article`, `Review` com nota editorial, `BreadcrumbList`, `ItemList`), Open Graph, CSP restrita sem scripts inline, tema claro/escuro, links de afiliado com `rel="sponsored nofollow noopener"`, aviso de afiliados e metodologia em todo post. AdSense opcional (`blog.anuncios.adsense`), que libera os domínios necessários na CSP.

Os posts em `conteudo/posts/` foram gerados a partir de `data/produtos-exemplo.csv` (marcas **fictícias**). Apague-os antes de publicar seu blog: `rm conteudo/posts/*.md` e gere os seus.

Publicação: qualquer hospedagem estática (Netlify, Cloudflare Pages, GitHub Pages, nginx) apontando para `workspace/blog/dist`.

## Módulo kdp

| Comando | O que faz |
|---|---|
| `kdp livro --tipo caca-palavras --titulo "Caça-palavras: Animais" --tema todos --paginas 100` | Livro completo: `interior.pdf`, `capa.svg` + `capa.html`, `metadados.json`, `manifesto.json` em `workspace/kdp/<slug>/`. |
| `kdp livro --tipo sudoku --quantidade 100 --dificuldade misto` · `--tipo labirinto --quantidade 60` | Puzzles com solução única / labirintos perfeitos, níveis progressivos, soluções ao final. |
| `kdp livro --tipo planner --inicio 2027-01 --meses 12 --trim 8.5x11` · `--tipo habitos` | Calendário mensal com feriados nacionais (fixos e móveis), semanas, metas; rastreador de hábitos. |
| `kdp livro --tipo pautado|pontilhado|quadriculado --paginas 120` | Cadernos (espaçamento, margem, data configuráveis). |
| `kdp livro --tipo texto --manuscrito livro.md` | Diagrama um manuscrito Markdown com sumário, capítulos em página ímpar, cabeçalho e numeração (fonte serifada). |
| `kdp livro --tipo imagens --pasta ./paginas --verso-branco` | Uma imagem (JPEG/PNG) por página: livros de colorir. |
| `kdp manuscrito --tema "..." --capitulos 8 --ia` | Escreve um livro de não ficção com Claude (JSON + Markdown) para o tipo `texto`. |
| `kdp metadados --tipo ... --tema ... [--ia]` | Título, subtítulo, descrição HTML, 7 palavras-chave e categorias, validados contra os limites e termos que a KDP rejeita. |
| `kdp preco --paginas 120 --preco 9.99 [--marketplace amazon.com] [--ebook --mb 2]` | Custo de impressão, royalty (60%/40% expandido) e preços sugeridos; eBook 70%/35% com custo de entrega. |
| `kdp nicho --arquivo nichos.csv` | Pontua nichos (buscas, concorrência, preço, BSR). |
| `kdp trims` / `kdp tipos` | Tamanhos de corte e tipos de interior. |

Especificações aplicadas: tamanhos de corte da KDP, sangria de 0,125", margem interna por contagem de páginas (0,375" a 0,875"), margem externa mínima, paridade e limites de páginas, lombada por papel (branco 0,002252"/pág, creme 0,0025", cor premium 0,002347"), texto na lombada só com ≥ 79 páginas, área do código de barras. O escritor de PDF é próprio (`src/kdp/pdf.js`): fontes TrueType **embutidas** (Type0/Identity-H com ToUnicode, exigência da KDP), formas vetoriais, imagens JPEG/PNG, compressão Flate. Fonte: `kdp.fonte` na config (caminho de um `.ttf`) ou detecção automática (DejaVu, Liberation, Arial, Noto…).

Para a **capa em PDF** (formato exigido pela KDP): `precozen design render --arquivo workspace/kdp/<slug>/capa.html --pdf` (usa Chromium/Chrome headless).

## Módulo design

| Comando | O que faz |
|---|---|
| `design camiseta --texto "Café primeiro \| perguntas depois" --subtexto "desde sempre" --layout empilhado\|arco\|selo\|minimal --paleta sol` | Estampa SVG + PNG 4500×5400 transparente + `listagem.json` (marca ≤ 50, título ≤ 60, 2 bullets ≤ 256, descrição ≤ 2000) + conformidade. |
| `design ideias --nicho café --quantidade 10 [--ia] [--produzir]` | Ideias de estampas com textos de listagem; `--produzir` gera todas. |
| `design capa --titulo ... --paginas 120 --trim 6x9 --paleta floresta --estilo bloco --png --pdf --guias` | Capa completa KDP com zonas calculadas (guias opcionais para conferir). |
| `design listagem --nome "Garrafa Térmica" --beneficios "a; b; c" --atributos "capacidade=1 L" --imagem foto.png --png [--ia]` | Imagem principal (fundo branco, 85%), infográfico 2000×2000, banner A+ 970×600 e textos (título ≤ 200, 5 bullets ≤ 250, descrição ≤ 2000, palavras-chave). |
| `design conformidade --texto "..."` | Marcas registradas, termos ofensivos/sensíveis/desaconselhados (`data/palavras-proibidas.json`, lista inicial). |
| `design render --arquivo x.svg [--png] \| x.html --pdf` | Renderiza com Chromium/Chrome, rsvg-convert, ImageMagick ou Inkscape (detecção automática; `PRECOZEN_CHROMIUM` força o caminho). |
| `design especificacoes` / `design paletas` | Tamanhos Merch e de imagens Amazon; paletas de cores. |

## Módulo fiscal

`fiscal estimar --comissoes 3500 --royalties 400 [--folha 0] [--cambio 5.4]` compara pessoa física (carnê-leão com tabela progressiva, retenção de 30% nos EUA sobre royalties com compensação limitada), MEI (DAS fixo e limite anual) e Simples Nacional (Anexo III/V pelo Fator R). `fiscal tabela` mostra a tabela configurada. As tabelas em `precozen.config.json` (`fiscal`) são de referência e trazem `vigencia`/`observacao`: **confira os valores vigentes e valide com um contador**; o redutor de 2026 (isenção até R$ 5.000) fica desligado até você confirmar os coeficientes.

## IA (opcional)

```
cd central && npm install                # instala @anthropic-ai/sdk (dependência opcional)
cp .env.example .env                     # ANTHROPIC_API_KEY=...
node bin/precozen.js ia status && node bin/precozen.js ia testar
```

Com a IA ligada: `afiliados reviews --ia` (reescreve introdução, prós/contras detalhados, análise, veredito e FAQ mantendo links, ficha técnica e rodapé), `kdp metadados --ia`, `kdp manuscrito`, `design ideias --ia`, `design listagem --ia`. Modelo, esforço, `max_tokens`, cache em disco (`workspace/ia-cache`) e fallbacks do servidor em `ia` na config. Saídas são JSON com esquema (structured outputs). Dados de marketplaces entram nos prompts como dados, com instrução explícita para ignorar instruções embutidas neles.

## Painel

`painel build` gera `workspace/painel/index.html` (indicadores, gráficos de score e ganho/100 cliques, ranking, conteúdo, livros, designs, próximos passos). `painel servir` serve a pasta de trabalho: painel em `/painel/`, blog em `/blog/dist/`. O painel contém dados internos (comissões, vendas estimadas): **não publique**.

## Deploy do blog na Cloudflare

O blog é publicado como **Worker com assets estáticos** (`central/wrangler.jsonc`, nome `precozen-blog`, pasta `workspace/blog/dist`). O `_headers` gerado no build aplica cabeçalhos de segurança e marca o domínio de pré-visualização `*.workers.dev` como `noindex`; o domínio próprio é indexado normalmente. Três formas de publicar:

**1. Pelo painel da Cloudflare (Workers Builds, sem instalar nada).** Em *Workers & Pages → Create application → Import a repository*, escolha `vadia38/precozen` e configure: build command `npm run build:blog`, deploy command `npx wrangler deploy`, nome do Worker `precozen-blog` (precisa ser igual ao `name` do `wrangler.jsonc`), branch de produção a que preferir. O root directory pode ficar vazio (a raiz do repositório também tem `wrangler.jsonc` e o script `build:blog`) ou ser `central`. Em *Build variables*, defina `SITE_URL` com a URL pública (por exemplo `https://precozen-blog.<sua-conta>.workers.dev` ou o domínio próprio) para os canônicos e o sitemap saírem certos. A cada push a Cloudflare reconstrói e publica.

**2. Pelo GitHub Actions** (`.github/workflows/cloudflare-blog.yml`). Crie um token em *Account API tokens → Create Token → Edit Cloudflare Workers* e cadastre no repositório, em *Settings → Secrets and variables → Actions*: os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` e, opcionalmente, a variável `SITE_URL_BLOG`. O workflow roda nos pushes em `main` que tocam `central/` e também manualmente (*Actions → Publicar blog Precozen na Cloudflare → Run workflow*, em qualquer branch).

**3. Do seu computador.**

```
cd central && npm install            # instala o wrangler (devDependency)
npx wrangler login                    # abre o navegador para autorizar
npm run deploy                        # gera o blog e publica em https://precozen-blog.<sua-conta>.workers.dev
npm run deploy:preview                # só envia uma versão de pré-visualização
```

Domínio próprio: em *Workers & Pages → precozen-blog → Settings → Domains & Routes → Add custom domain*. Depois ajuste `marca.url` em `precozen.config.json` (ou `SITE_URL`) para o domínio final e publique de novo.

## Estrutura

```
central/
  bin/precozen.js            CLI
  precozen.config.json       marca, programas/tags, pesos do score, blog, kdp, design, fiscal, ia
  .env.example               chaves (nunca commitadas)
  src/core                   util, csv, rng, http, config, arquivos, svg, front matter, cli
  src/afiliados              programas, estimativas, pontuação, normalização, fontes/, importar, analisar, reviews, comparativos
  src/blog                   markdown, conteúdo, layout, páginas, seo, rss, build
  src/kdp                    especificações, royalties, metadados, nicho, pdf (escritor), fonte-ttf, imagem, interiores/, livro
  src/design                 especificações, paletas, camiseta, capa, listagem, conformidade, render
  src/fiscal                 cálculos
  src/ia                     cliente (SDK sob demanda), prompts/esquemas, reescrita de reviews
  src/painel                 build, servidor, exemplo (fluxo completo)
  data/                      programas e comissões, categorias, produtos-exemplo.csv, nichos-exemplo.csv, temas de caça-palavras, palavras proibidas
  conteudo/posts, paginas    conteúdo do blog (Markdown)
  templates/                 blog.css, blog.js, tema.js, painel.css
  tests/                     node --test
  workspace/                 saídas geradas (ignorado pelo git; PRECOZEN_WORKSPACE muda a pasta)
```

## Segurança

- Chaves só por variáveis de ambiente/`.env` (ignorado pelo git); nada é gravado em arquivos de saída.
- Sites gerados com CSP restrita (sem scripts/estilos inline), `nosniff`, `X-Frame-Options`, links externos com `rel="noopener"`, afiliados com `sponsored nofollow`.
- Todo texto vindo de CSV/APIs é escapado no HTML/SVG e validado (URLs só `http(s)`, ids de produto restritos, caminhos de saída presos à pasta de trabalho).
- Requisições HTTP com timeout e novas tentativas; assinaturas (SigV4, SHA256) calculadas localmente com `node:crypto`.

## Testes

`npm test` na raiz roda os testes do catálogo e do Precozen Central (`node --test central/tests`). Os testes que dependem de renderizador (PNG/PDF) ou de fonte TrueType do sistema se auto-ignoram quando não há ferramenta disponível.

## Avisos

Este sistema automatiza produção e organização; a **responsabilidade editorial, legal e fiscal continua sua**: leia as políticas dos programas de afiliados (a Amazon exige a frase de divulgação, presente no rodapé e na página de divulgação), da KDP (conteúdo, metadados, direitos autorais) e do Merch by Amazon (propriedade intelectual). Não publique análises de produtos que você não consegue avaliar com honestidade; a nota editorial e os textos gerados devem ser revisados.
