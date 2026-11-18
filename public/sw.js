/**
 * Clean Kitchen Service Worker (v13)
 * • оболочка приложения кэшируется при установке — открывается без сети;
 * • статика: из кэша сразу, обновляется в фоне;
 * • навигация офлайн → сохранённый index.html;
 * • /api/ никогда не кэшируется здесь — данные лежат в IndexedDB (см. lib/offline.ts, lib/sync.ts).
 * Файлы из «пакета для офлайн» (кэш ck-offline-pack) находятся через caches.match по всем кэшам.
 */
const SHELL_CACHE = "ck-shell-v13";
const KEEP = [SHELL_CACHE, "ck-offline-pack"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const urls = new Set(["/", "/index.html", "/manifest.webmanifest", "/icon.svg"]);
    try {
      const html = await (await fetch("/index.html", { cache: "no-store" })).text();
      for (const m of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|webmanifest|svg|png))"/g)) urls.add(m[1]);
    } catch { /* офлайн при установке */ }
    await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: "offline", offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(SHELL_CACHE);
        c.put("/index.html", net.clone()).catch(() => undefined);
        return net;
      } catch {
        return (await caches.match("/index.html")) || (await caches.match("/")) || new Response("Офлайн", { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: false });
    const refresh = fetch(req).then(async (res) => {
      if (res && res.status === 200 && res.type === "basic") (await caches.open(SHELL_CACHE)).put(req, res.clone());
      return res;
    }).catch(() => undefined);
    if (hit) { event.waitUntil(refresh); return hit; }
    return (await refresh) || new Response("", { status: 504 });
  })());
});
