const C = 'jospar-v1';
const SHELL = ['./', 'index.html', 'style.css', 'core.js', 'sync.js', 'app.js', 'manifest.webmanifest', '../brand/tokens.css', '../brand/logos/jospar.svg'];
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js'; // нұсқасы бекітілген: интернетсіз де іске қосылсын
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then(async (c) => { await c.addAll(SHELL); await c.add(LIB).catch(() => {}); }).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jospar-') && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Желі бірінші (жаңа нұсқа тез шығады), желі жоқ болса — кэштен. Supabase API мен бөтен сайттар кэшке түспейді.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || (new URL(e.request.url).origin !== location.origin && e.request.url !== LIB)) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});
