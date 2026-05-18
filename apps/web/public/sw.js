// Self-destroying service worker.
//
// This REPLACES the former Serwist PWA worker. Serwist precached the app
// shell + build chunks; after rapid deploys it served a stale HTML doc
// with mismatched JS chunks, so the React form never hydrated and the
// login code input was inert ("não aceita nenhum caractere"). There is
// no offline requirement for this product.
//
// We must keep a real script served at /sw.js (NOT a 404 — a 404 aborts
// the update and the old broken worker survives). Already-installed
// clients update to THIS worker, which immediately takes over, wipes all
// caches, unregisters itself, and reloads open windows so they fall back
// to pure network-fresh delivery. After that no service worker remains.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {
        // best-effort cache wipe; continue to unregister regardless
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// No fetch handler on purpose: never serve anything from cache, even in
// the brief window before unregister completes.
