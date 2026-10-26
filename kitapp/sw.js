const C = 'kitapp-v34'; // Kitapp: белгіленген сөзді сөздікке қосу, PDF мәтін қабаты
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'rag.js', 'chat.js', 'audio.js', 'ltts.js', 'jobs.js', 'tts-worker.js', 'vendor/piper/piper.js', 'vendor/piper/piper-o91UDS6e.js', 'icons.js', 'covers.js', 'home.js', 'player.js', 'prep.js', 'shelves.js', 'marks.js', 'brand.js', 'profile.js', 'kstats.js', 'kspeed.js', 'kconvert.js', 'convert.js', 'speed.js', 'stats.js', 'edit.js', 'cloud.js', '../brand/addword.js', 'manifest.webmanifest',
  'vendor/lib/pdf.min.js', 'vendor/lib/pdf.worker.min.js', 'vendor/lib/epub.min.js', 'vendor/lib/jszip.min.js']; // кітап ашуға міндетті: CDN-сіз, қосымшамен бірге
// Сыртқы кітапханалар: интернетсіз оқу үшін алдын ала сақталады (нұсқасы бекітілген, өзгермейді).
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(async c => {
  await c.addAll(SHELL);
  await Promise.all(LIBS.map(u => c.add(u).catch(() => {}))); // біреуі жүктелмесе де орнату тоқтамасын
}).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(
  // Тек ескі интерфейс кэшін тазалаймыз. kitapp-tts-models (21–128 МБ) және басқа дерек кэштері сақталуы керек.
  k.filter(x => x.startsWith('kitapp-v') && x !== C).map(x => caches.delete(x))
)).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('supabase.co') || u.hostname.endsWith('openrouter.ai') || u.hostname.endsWith('huggingface.co')) return; // ISSAI моделін piper өзі сақтайды // ЖИ және аккаунт — тек желі
  const save = res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; };
  // CDN: алдымен кэш (файлдар өзгермейді); қосымшаның өз файлдары: алдымен желі, үзілсе кэш
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(save)));
    return;
  }
  e.respondWith(fetch(r).then(save).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
