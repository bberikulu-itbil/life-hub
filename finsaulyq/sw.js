const C = 'finsaulyq-v1';
const SHELL = ['./', 'index.html', 'style.css', 'core.js', 'app.js', 'manifest.webmanifest', '../brand/tokens.css', '../brand/logos/finsaulyq.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('finsaulyq-') && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Желі бірінші (жаңа нұсқа тез шығады), желі жоқ болса — кэштен
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});
