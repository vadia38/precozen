# Design system — Catálogo Luretec

Fonte de verdade visual do site. Os tokens vivem em `public/css/site.css` (`:root`); este documento explica as decisões.

## Identidade

Derivada do catálogo impresso 2026: fundo navy profundo, logo "GC" branco, códigos em âmbar, cards brancos com cantos arredondados, faixa âmbar no topo.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--cor-navy` | `#0A1121` | igual | cabeçalho, rodapé, hero, faixas de chamada |
| `--cor-ambar` | `#F49E0A` | igual | códigos de produto, ação primária, filtro ativo, detalhes |
| `--cor-zap` | `#25D366` | igual | somente ações de WhatsApp |
| `--bg` | `#EEF2F8` | `#0A1121` | fundo da página |
| `--superficie` | `#FFFFFF` | `#131C36` | cards, formulários, painéis |
| `--superficie-2` | `#F6F8FC` | `#182340` | seções alternadas, cabeçalhos de página |
| `--texto` / `--texto-2` / `--texto-3` | `#0B1222` / `#46536B` / `#6B7890` | `#E6EDF6` / `#B4C0D6` / `#8DA0BF` | hierarquia de texto |
| `--borda` / `--borda-forte` | `#D9E0EC` / `#B9C4D6` | `#26334F` / `#3A4A6B` | contornos |
| `--link` | `#0F4C9C` | `#8EC5FF` | links em prosa |
| `--foco` | `#2563EB` | `#60A5FA` | anel de foco (3px, offset 2px) |

Regras de contraste: texto nunca em âmbar sobre branco (2,1:1). Âmbar só como fundo com texto navy (8,9:1) ou como detalhe decorativo. Fotos ficam sempre sobre branco (`--foto-bg`), mesmo no tema escuro, porque os originais têm fundo branco.

## Tipografia

- Pilha: `"Montserrat", "Poppins", system-ui, …` — sem fontes externas (privacidade, CSP `font-src 'self'`, sem FOIT). Se Montserrat estiver instalada, o visual fica idêntico ao PDF.
- Base 16px, `line-height` 1,5. Títulos 700 com `letter-spacing -0.01em` e `clamp()` fluido.
- Códigos e referências em monoespaçada (`--mono`).
- "Eyebrow": 0,75rem, caixa alta, `letter-spacing 0.14em`, na cor da categoria.

## Espaçamento e layout

- Contêiner 1200px; gutters 16 / 24 / 32px (celular / tablet / desktop).
- Raios: 8 (pequeno), 12 (padrão), 18px (cards, painéis).
- Grade de produtos: `auto-fill, minmax(160px → 210px → 230px, 1fr)`; 2 colunas já em 360px de largura.
- Breakpoints usados: 600, 640, 720, 820, 880 (menu desktop), 900, 960, 1000, 1024.

## Componentes

- **Card de produto**: foto 4:3 sobre branco, pílula de código âmbar, título com no máximo 3 linhas, referência em mono, botão "Orçamento" de largura total. O link do título cobre o card inteiro (`::after`), mantendo o botão clicável acima.
- **Chips**: filtros e aplicações. Ativo = âmbar. Mínimo 36px de altura; 44px na variante `--grande`.
- **Tiles**: categorias e montadoras. Cada categoria tem uma cor (`.tile--ambar`, `.tile--azul`…), usada só no ícone e no destaque de hover.
- **Botões**: 44px mínimo (52px no `--grande`); primário âmbar, contorno neutro, WhatsApp verde, perigo em contorno.
- **Barra de listagem**: busca + selects + alternância grade/lista. O botão "Filtrar" só aparece sem JavaScript.
- **Toasts**: canto inferior, `aria-live="polite"`, sempre com texto (nunca só ícone).

## Movimento

Transições de 160ms em cor, sombra e `transform` (translateY de 2px em hover). Nada anima largura/altura. `prefers-reduced-motion` desliga tudo.

## Acessibilidade (checklist aplicado)

- Skip link, landmarks (`header`, `main`, `nav` rotuladas, `footer`).
- Todo botão só com ícone tem `aria-label`; ícones decorativos têm `aria-hidden`.
- Foco visível em tudo; menus fecham com Esc; modal devolve o foco.
- Resultados de busca anunciados com `aria-live`.
- Alvos de toque ≥ 44px; nenhum texto abaixo de 12px.

## Anti-padrões evitados

Emoji como ícone, texto cinza sobre cinza, placeholder como rótulo, scroll horizontal, fontes e scripts de terceiros, estilos inline (bloqueados pela CSP).
