// Kitapp: қазақ дауысын (Piper, ISSAI деректері) фонда, интерфейсті қатырмай іске қосатын worker.
// Сұраулар бір-бірден орындалады; тікелей тыңдау сұраулары (pri) mp3 дайындаудан бұрын өтеді.
import { TtsSession } from './vendor/piper/piper.js';

let session = null, voice = null, busy = false;
const queue = [];

async function sessionFor(v) {
  if (session && voice === v) return session;
  TtsSession._instance = null; // кітапхана бір ғана модель ұстайды: басқа дауысқа ауысқанда жаңасын ашамыз
  voice = v;
  session = TtsSession.create({ voiceId: v, progress: p => self.postMessage({ t: 'dl', voice: v, loaded: p.loaded, total: p.total, url: p.url }) });
  try { return await session; } catch (e) { session = null; voice = null; throw e; }
}

async function run(m) {
  try {
    const s = await sessionFor(m.voice);
    if (m.t === 'init') return self.postMessage({ t: 'ok', id: m.id });
    s.speakerId = m.speaker ?? 0;
    s.lengthScale = m.lengthScale || undefined;
    const t0 = performance.now();
    const { pcm, sampleRate } = await s.predictPcm(m.text);
    self.postMessage({ t: 'pcm', id: m.id, pcm, sampleRate, ms: performance.now() - t0 }, [pcm.buffer]);
  } catch (e) {
    self.postMessage({ t: 'err', id: m.id, error: String(e?.message || e) });
  }
}

self.onmessage = async ({ data: m }) => {
  const k = m.pri ? queue.findIndex(x => !x.pri) : -1; // басымды сұрау кезектегі қарапайымдардың алдына
  queue.splice(k < 0 ? queue.length : k, 0, m);
  if (busy) return;
  busy = true;
  while (queue.length) await run(queue.shift());
  busy = false;
};
