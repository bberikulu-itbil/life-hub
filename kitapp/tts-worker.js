// Kitapp: ISSAI қазақ дауысын (Piper kk_KZ-issai-high) фонда, интерфейсті қатырмай іске қосатын worker.
import { TtsSession } from './vendor/piper/piper.js';

let session = null;
const ready = () => session ??= TtsSession.create({
  voiceId: 'kk_KZ-issai-high',
  progress: p => self.postMessage({ t: 'dl', loaded: p.loaded, total: p.total, url: p.url }),
});

self.onmessage = async ({ data: m }) => {
  try {
    const s = await ready();
    if (m.t === 'init') return self.postMessage({ t: 'ok', id: m.id });
    s.speakerId = m.speaker ?? 0;
    s.lengthScale = m.lengthScale || undefined;
    const { pcm, sampleRate } = await s.predictPcm(m.text);
    self.postMessage({ t: 'pcm', id: m.id, pcm, sampleRate }, [pcm.buffer]);
  } catch (e) {
    session = null; // келесі сұрауда қайта іске қосылады
    self.postMessage({ t: 'err', id: m.id, error: String(e?.message || e) });
  }
};
