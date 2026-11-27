/* global __BUILD_FILES__ */
// Service worker do TudoPDF (somente versão web/PWA). Gerado no build: a lista de arquivos é injetada.
// Só guarda arquivos da própria aplicação. Documentos do usuário NUNCA passam por aqui:
// eles são lidos diretamente da memória do navegador e não geram requisições de rede.
const CACHE = "__CACHE_VERSION__";
const FILES = __BUILD_FILES__;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tudopdf-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação: sempre o index.html em cache (a rota fica no hash).
  if (request.mode === "navigate") {
    event.respondWith(caches.match("./").then(r => r || fetch(request)));
    return;
  }

  // Cache primeiro; o que faltar (ex.: CMaps) é buscado uma vez e guardado.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
