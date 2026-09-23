// Aplica o tema salvo antes da pintura para evitar piscar (carregado no <head>, sem módulo).
(function () {
  try {
    var t = localStorage.getItem('tema');
    if (t === 'claro' || t === 'escuro') document.documentElement.setAttribute('data-tema', t);
  } catch (e) { /* armazenamento indisponível */ }
})();
