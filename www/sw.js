const CACHE = 'pamarket-v208';

// Never cache these — auth tokens, API data, realtime
const NO_CACHE = [
  'supabase.co',
  'supabase.io',
  '/auth/',
  '/rest/v1/',
  '/realtime/',
  'accounts.google.com',
];

function shouldCache(url) {
  return !NO_CACHE.some(p => url.includes(p));
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        './', './index.html', './manifest.json', './css/styles.css', './offline.html',
        './js/app.js',  './js/auth.js', './js/home.js', './js/post.js',
        './js/messages.js', './js/detail.js', './js/browse.js',
        './js/account.js', './js/profile.js', './js/verify.js', './js/business-onboarding.js', './js/business-profile.js',
        './js/lib/supabase.umd.js', './js/supabase.js', './js/admin.js', './js/categories.js', './js/attributes.js', './js/ads-carousel.js', './js/refresh-manager.js',
        './img/icon-192.png', './img/icon-512.png'
      ]).catch(() => {})
    ).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Skip caching for auth/API/realtime requests — always go to network
  if (!shouldCache(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for the app shell (the HTML document). iOS "Add to Home Screen"
  // PWAs otherwise keep serving a stale cached index.html forever, so new code
  // (and the JS version bumps it references) never loads and the app looks like
  // it "doesn't refresh". Always pull a fresh index.html when online; fall back
  // to the cached copy (then offline.html) only when the network is unavailable.
  const isDocument = event.request.mode === 'navigate' ||
    (event.request.destination === 'document') ||
    url.endsWith('/') || url.endsWith('/index.html');

  if (isDocument) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('./index.html') || caches.match('./offline.html'))
      )
    );
    return;
  }

  // Everything else (versioned JS/CSS, images): stale-while-revalidate. These
  // carry ?v= cache-busting query strings, so a fresh index.html referencing a
  // new version is a new URL that misses the cache and is fetched from network.
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
        return cached || networkFetch;
      })
    )
  );
});

// ── Push notifications ────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let d;
  try { d = event.data.json(); } catch(e) { d = { title: 'PaMarket', body: event.data.text() }; }
  const opts = {
    body:      d.body || '',
    icon:      './img/icon-192.png',
    badge:     './img/icon-192.png',
    tag:       d.type || 'pamarket',
    renotify:  true,
    // Carry the full content so a click can open the broadcast detail directly.
    data:      {
      deepLink: d.deepLink || d.deep_link || null,
      type:     d.type || '',
      title:    d.title || '',
      body:     d.body || '',
      image:    d.image || d.imageUrl || ''
    }
  };
  if (d.image) opts.image = d.image;
  event.waitUntil(
    self.registration.showNotification(d.title || 'PaMarket', opts)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const link = data.deepLink || 'Notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const win = list.find(w => 'focus' in w);
      if (win) {
        win.focus();
        // Hand the whole payload to the app so it can open the broadcast detail.
        win.postMessage({ type: 'notif-tap', data: data, route: link });
        return;
      }
      return clients.openWindow('./?deeplink=' + encodeURIComponent(link));
    })
  );
});
