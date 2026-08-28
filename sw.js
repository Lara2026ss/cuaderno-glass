/**
 * Cuaderno Glass Pro 5.0 — Service Worker & Offline Cache Engine
 */

const CACHE_NAME = 'cuaderno-glass-v5-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app/bootstrap.js',
  '/src/app/state.js',
  '/src/app/events.js',
  '/src/app/logger.js',
  '/src/app/router.js',
  '/src/audio/audio-engine.js',
  '/src/features/deals.js',
  '/src/features/documents.js',
  '/src/features/notes.js',
  '/src/features/pomodoro.js',
  '/src/features/search.js',
  '/src/features/tasks.js',
  '/src/firebase/auth.js',
  '/src/firebase/config.js',
  '/src/firebase/firestore.js',
  '/src/firebase/sync.js',
  '/src/integrations/discord.js',
  '/src/integrations/gemini.js',
  '/src/integrations/github.js',
  '/src/integrations/google-drive.js',
  '/src/integrations/price-tracker.js',
  '/src/integrations/registry.js',
  '/src/integrations/render.js',
  '/src/services/notifications.js',
  '/src/styles/glass.css',
  '/src/styles/components.css',
  '/src/styles/responsive.css',
  '/src/ui/components.js',
  '/src/ui/modals.js',
  '/src/ui/toast.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('⚡ [Service Worker] Pre-cacheando shell de la aplicación');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('⚠️ [Service Worker] Pre-cache parcial:', err.message);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [Service Worker] Limpiando cache antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a API y Firebase (siempre frescas de red o manejadas por offline queue)
  if (event.request.url.includes('/api/') || event.request.url.includes('googleapis.com') || event.request.url.includes('firebaseio.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Listener de Notificaciones Web Push
self.addEventListener('push', (event) => {
  let payload = { title: 'Cuaderno Glass', body: 'Nueva notificación de tu suite' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || 'https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/favicon.png',
      badge: 'https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/favicon.png',
      data: payload.data || {}
    })
  );
});
