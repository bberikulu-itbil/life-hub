const C = 'kitapp-v14';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'rag.js', 'chat.js', 'audio.js', 'icons.js', 'covers.js', 'home.js', 'player.js', 'prep.js', 'shelves.js', 'marks.js', 'brand.js', 'profile.js', 'kstats.js', 'kspeed.js', 'kconvert.js', 'convert.js', 'speed.js', 'stats.js', 'edit.js', 'manifest.webmanifest'];
// Сыртқы кітапханалар: интернетсіз оқу үшін алдын ала сақталады (нұсқасы бекітілген, өзгермейді).
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(async c => {
  await c.addAll(SHELL);
  await Promise.all(LIBS.map(u => c.add(u).catch(() => {}))); // біреуі жүктелмесе де орнату тоқтамасын
}).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('supabase.co') || u.hostname.endsWith('openrouter.ai')) return; // ЖИ және аккаунт — тек желі
  const save = res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; };
  // CDN: алдымен кэш (файлдар өзгермейді); қосымшаның өз файлдары: алдымен желі, үзілсе кэш
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(save)));
    return;
  }
  e.respondWith(fetch(r).then(save).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
