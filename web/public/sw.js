/* Sunny service worker: app-shell cache, Web Push, notification taps. */
const VERSION = 'v1';
const SHELL = `sunny-shell-${VERSION}`;
const RUNTIME = `sunny-runtime-${VERSION}`;
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon-180.png',
  '/icons/favicon-32.png',
];

// ---------- Install: cache the shell, including the hashed JS/CSS it references ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(SHELL_URLS);
      try {
        const html = await (await cache.match('/')).text();
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll(assets);
      } catch {
        // Assets get cached on first use instead.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== RUNTIME) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API: always network. The app keeps its own offline copy of the data.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Pages: network first so updates show up, cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(SHELL)).put('/', res.clone());
          return res;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build files never change: cache first.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Icons, manifest, Google Fonts: serve cached, refresh in the background.
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === self.location.origin || isFont) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME);
        const hit = await cache.match(req);
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        if (hit) {
          event.waitUntil(refresh);
          return hit;
        }
        return (await refresh) || Response.error();
      })(),
    );
  }
});

// ---------- Push ----------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Sunny';
  const body = data.body || '';

  event.waitUntil(
    (async () => {
      // Always show a notification: iOS can revoke push for silent pushes.
      await self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data,
        tag: 'sunny-' + Date.now(),
      });
      // If Sunny is open on screen, also show the in-app banner.
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const win of wins) {
        if (win.visibilityState === 'visible') win.postMessage({ type: 'reminder', ...data });
      }
    })(),
  );
});

// ---------- Notification tap → Moment screen ----------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins[0];
      if (win) {
        try {
          await win.focus();
        } catch {
          // focus can fail if the window is gone; the message still queues
        }
        win.postMessage({ type: 'open-moment', ...data });
        return;
      }
      const q = new URLSearchParams({
        moment: '1',
        a: data.affirmationId == null ? '' : String(data.affirmationId),
        t: data.title || '',
        b: data.body || '',
      });
      await self.clients.openWindow('/?' + q.toString());
    })(),
  );
});
