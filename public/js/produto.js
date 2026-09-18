// Página de produto: seletor de quantidade e indicação de item já no orçamento.
import { orcamento } from './app.js';
import { qtdValida, QTD_MAXIMA } from './lib/orcamento.js';

const pagina = document.querySelector('[data-produto]');
if (pagina) {
  const campo = pagina.querySelector('[data-qtd]');
  const menos = pagina.querySelector('[data-qtd-menos]');
  const mais = pagina.querySelector('[data-qtd-mais]');
  const ajustar = (delta) => { campo.value = String(Math.min(QTD_MAXIMA, Math.max(1, qtdValida(campo.value) + delta))); };
  menos?.addEventListener('click', () => ajustar(-1));
  mais?.addEventListener('click', () => ajustar(1));
  campo?.addEventListener('change', () => { campo.value = String(qtdValida(campo.value)); });

  const codigo = pagina.dataset.produto;
  const botao = pagina.querySelector('[data-adicionar]');
  const indicar = (d) => {
    const item = d.itens.find((i) => i.codigo === codigo);
    let nota = pagina.querySelector('[data-no-orcamento]');
    if (item) {
      if (!nota) {
        nota = document.createElement('p');
        nota.className = 'ajuda';
        nota.setAttribute('data-no-orcamento', '');
        botao?.parentElement.insertAdjacentElement('afterend', nota);
      }
      nota.textContent = `Já no seu orçamento: ${item.qtd} ${item.qtd === 1 ? 'unidade' : 'unidades'}.`;
    } else if (nota) nota.remove();
  };
  indicar(orcamento.ler());
  document.addEventListener('orcamento:mudou', (e) => indicar(e.detail));
}
