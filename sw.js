/**
 * Service Worker — ESI Isigny PWA
 *
 * Stratégies de cache:
 * - HTML / index.html : network-first (avec fallback cache offline)
 *   → on essaie toujours d'avoir la dernière version, mais offline OK
 * - Assets static (CSS, JS, images, fonts) : cache-first
 *   → ouverture instantanée, mise à jour en arrière-plan
 * - API / dynamique : network-only (pas de cache des données fraiches)
 */

const CACHE_VERSION = 'esi-v6-data-bypass';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Pré-cache au moment de l'install : ressources critiques pour offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo-esi.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/team-bg.jpg',
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache partial:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE — nettoie les anciens caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== FETCH — stratégies par type de requête =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne cache que les requêtes GET du même origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip API calls + données dynamiques (toujours network, jamais cache)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/data/')) {
    return;
  }

  // HTML pages: network-first, fallback cache
  const isHTML = request.mode === 'navigate'
    || (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mise à jour du cache en arrière-plan
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh en background (stale-while-revalidate)
        fetch(request).then((response) => {
          if (response && response.ok) {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // Pas en cache → fetch + ajout au cache
      return fetch(request).then((response) => {
        if (!response || !response.ok || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => {
        // Offline et pas en cache : on retourne quand même quelque chose pour les images
        if (request.destination === 'image') {
          return caches.match('/assets/logo-esi.png');
        }
      });
    })
  );
});

// Permet une mise à jour immédiate quand on push une nouvelle version
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
