// Service Worker — BabyFoot Coach RPG
// Cache l'app pour fonctionnement offline et évite l'écran noir

const CACHE = 'bfc-v1';
const FILES = ['/'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  // Pour les requêtes vers Supabase, toujours réseau
  if(e.request.url.includes('supabase.co')) return;
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Réseau d'abord, cache en fallback
      return fetch(e.request)
        .then(response => {
          // Met à jour le cache
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => cached || new Response('Offline'));
    })
  );
});
