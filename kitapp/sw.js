const C = 'kitapp-v10';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'rag.js', 'chat.js', 'audio.js', 'icons.js', 'covers.js', 'home.js', 'player.js', 'prep.js', 'profile.js', 'kstats.js', 'kspeed.js', 'speed.js', 'stats.js', 'edit.js', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Желі бірінші, үзілсе кэш: оффлайн оқу үшін кітаптар IndexedDB-де, ал кітапхана файлдары кэште.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
