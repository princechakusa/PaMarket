const CACHE = 'pamarket-v81';

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
        './', './index.html', './manifest.json', './css/styles.css', './offline.html', './ads.html',
        './js/app.js',  './js/auth.js', './js/home.js', './js/post.js',
        './js/messages.js', './js/detail.js', './js/browse.js',
        './js/account.js', './js/profile.js',
        './js/supabase.js', './js/admin.js', './js/categories.js',
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

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => {
        if (r) return r;
        if (event.request.mode === 'navigate') return caches.match('./offline.html');
        return new Response('Offline', { status: 503 });
      }))
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
    data:      { deepLink: d.deepLink || d.deep_link || null }
  };
  if (d.image) opts.image = d.image;
  event.waitUntil(
    self.registration.showNotification(d.title || 'PaMarket', opts)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.deepLink;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const win = list.find(w => 'focus' in w);
      if (win) {
        win.focus();
        if (link) win.postMessage({ type: 'deeplink', route: link });
        return;
      }
      return clients.openWindow(link ? ('./?deeplink=' + encodeURIComponent(link)) : './');
    })
  );
});
