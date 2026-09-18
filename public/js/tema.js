// Aplica o tema salvo antes da primeira pintura, evitando o "flash" de tema errado.
// Carregado de forma síncrona no <head>; é minúsculo de propósito.
(function () {
  try {
    var t = localStorage.getItem('luretec.tema');
    if (t === 'claro' || t === 'escuro') document.documentElement.setAttribute('data-tema', t);
  } catch (e) { /* armazenamento indisponível: segue o tema do sistema */ }
})();
