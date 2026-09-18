/* Service worker do catálogo. Os marcadores __VERSAO__, __BASE__ e __PRECACHE__ são preenchidos pelo build. */
const VERSAO = '__VERSAO__';
const BASE = '__BASE__';
const PRECACHE = __PRECACHE__;
const CACHE_APP = `luretec-app-${VERSAO}`;
const CACHE_PAGINAS = `luretec-paginas-${VERSAO}`;
const CACHE_IMAGENS = 'luretec-imagens-v1';
const LIMITE_IMAGENS = 700;
const LIMITE_PAGINAS = 150;
const OFFLINE = `${BASE}offline.html`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const manter = new Set([CACHE_APP, CACHE_PAGINAS, CACHE_IMAGENS]);
    for (const nome of await caches.keys()) if (nome.startsWith('luretec-') && !manter.has(nome)) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function limitar(nomeCache, limite) {
  const cache = await caches.open(nomeCache);
  const chaves = await cache.keys();
  if (chaves.length <= limite) return;
  for (const k of chaves.slice(0, chaves.length - limite)) await cache.delete(k);
}

function comTimeout(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promessa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.endsWith('.pdf')) return; // arquivo grande: sempre da rede

  // Navegação: rede primeiro (com limite de tempo), depois cache, depois página offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resposta = await comTimeout(fetch(req), 5000);
        if (resposta.ok) {
          const cache = await caches.open(CACHE_PAGINAS);
          cache.put(req, resposta.clone()).then(() => limitar(CACHE_PAGINAS, LIMITE_PAGINAS));
        }
        return resposta;
      } catch {
        const cache = await caches.open(CACHE_PAGINAS);
        return (await cache.match(req, { ignoreSearch: true })) || (await caches.match(OFFLINE)) || Response.error();
      }
    })());
    return;
  }

  // Fotos: cache primeiro.
  if (url.pathname.startsWith(`${BASE}img/produtos/`)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_IMAGENS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const resposta = await fetch(req);
      if (resposta.ok) cache.put(req, resposta.clone()).then(() => limitar(CACHE_IMAGENS, LIMITE_IMAGENS));
      return resposta;
    })());
    return;
  }

  // CSS, JS, ícones e API: responde do cache e atualiza em segundo plano.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_APP);
    const hit = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req).then((resposta) => {
      if (resposta.ok) cache.put(req, resposta.clone());
      return resposta;
    }).catch(() => null);
    return hit || (await rede) || Response.error();
  })());
});
