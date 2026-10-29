/* Gera Escalas — Service Worker
   Estratégia:
   - HTML/navegação: rede primeiro (pega novas versões), cache de reserva offline.
   - Outros arquivos do mesmo domínio (imagens, ícones): cache primeiro.
   - Chamadas externas (Supabase, CDNs) e requisições não-GET: passam direto, sem cache.
*/
var VERSION = "ge-cache-v1";
var CORE = "./"; /* app shell = start_url do PWA (a pasta /app/) */

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll([CORE]).catch(function () {});
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== VERSION) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return; /* nunca mexe em POST/login/sync */

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; /* deixa Supabase/CDN passar */

  var accept = req.headers.get("accept") || "";
  var isHTML = req.mode === "navigate" || accept.indexOf("text/html") !== -1;

  if (isHTML) {
    /* rede primeiro: sempre tenta baixar a versão mais nova */
    e.respondWith(
      fetch(req).then(function (res) {
        try {
          var a = res.clone(), b = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, a); c.put(CORE, b); });
        } catch (err) {}
        return res;
      }).catch(function () {
        /* offline: usa a última cópia guardada */
        return caches.match(req).then(function (m) { return m || caches.match(CORE); });
      })
    );
    return;
  }

  /* demais arquivos do mesmo domínio: cache primeiro, atualiza em segundo plano */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        try {
          if (res && res.status === 200 && req.url.indexOf("?") === -1) {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copy); });
          }
        } catch (err) {}
        return res;
      }).catch(function () { return hit; });
    })
  );
});
