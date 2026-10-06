// NormoDose — Service Worker (offline-first app shell) — chemins à plat
const CACHE = "normodose-4.4.0";
const CORE = ["./", "./index.html", "./abonnement.html", "./manifest.webmanifest"];
const OPTIONAL = [
  "./icon-192.png","./icon-512.png","./maskable-192.png",
  "./maskable-512.png","./apple-touch-icon.png","./favicon-32.png"
];
const NAV_TIMEOUT = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map((u) => c.add(u).catch(() => {})));
    await Promise.all(OPTIONAL.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function cacheable(res) { return res && res.ok && res.type !== "opaque"; }

function pageKey(req) {
  try {
    const u = new URL(req.url);
    if (u.pathname.endsWith("abonnement.html")) return "./abonnement.html";
  } catch (_) {}
  return "./index.html";
}

function navigateStrategy(req) {
  const key = pageKey(req);
  return new Promise((resolve) => {
    let settled = false;
    const fallback = async () => {
      const hit = (await caches.match(key)) || (await caches.match("./index.html"));
      resolve(hit || Response.error());
    };
    const timer = setTimeout(() => { if (settled) return; settled = true; fallback(); }, NAV_TIMEOUT);
    fetch(req).then((res) => {
      if (cacheable(res)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
      }
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(res);
    }).catch(() => {
      if (settled) return;
      settled = true; clearTimeout(timer); fallback();
    });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") { e.respondWith(navigateStrategy(req)); return; }
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached)
    )
  );
});
