/* Afiliados Gera Escalas — Service Worker */
var VERSION = "afil-cache-v1";
var SHELL = ["./", "./index.html"];
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== VERSION) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url; try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; /* deixa Supabase/CDN passar */
  var accept = req.headers.get("accept") || "";
  var isHTML = req.mode === "navigate" || accept.indexOf("text/html") !== -1;
  if (isHTML) {
    e.respondWith(fetch(req).then(function (res) {
      try { var a = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, a); c.put("./", res.clone()); }); } catch (err) {}
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || caches.match("./"); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      try { if (res && res.status === 200 && req.url.indexOf("?") === -1) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); } } catch (err) {}
      return res;
    }).catch(function () { return hit; });
  }));
});
