'use strict';
/* Kitapp: құрылғыдағы қазақ дауысы — ISSAI KazakhTTS (Piper kk_KZ-issai-high, CC BY 4.0).
   Модель бір рет жүктеледі (~128 МБ) және сақталады; одан кейін аудио интернетсіз, тегін жасалады.
   Нәтиже бөлім бойынша mp3 (lamejs) болып сақталады. */

const ISSAI_MODEL_URL = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/kk/kk_KZ/issai/high/kk_KZ-issai-high.onnx';
const ISSAI_MB = 128;
// speaker_id_map: модельдің ішкі нөмірлері
const ISSAI_VOICES = [[3, 'Рая (әйел)'], [1, 'Исеке (ер)'], [4, 'Әйел дауысы 2'], [5, 'Әйел дауысы 3'], [2, 'Әйел дауысы 4'], [0, 'Ер дауысы 2']];
// Бір таңдау: ISSAI дикторы (әдепкі) немесе браузер дауысы. mp3 файлдарды әрқашан ISSAI жасайды.
const ttsEngine = () => localStorage.kTtsEngine === 'browser' ? 'browser' : 'issai';
let issaiHave = false; // модель құрылғыда бар ма (батырма басылған сәтте синхронды тексеру үшін)
const issaiSpeaker = () => +(localStorage.kIssaiSpk ?? 3);

let ttsW = null, ttsSeq = 0;
const ttsWait = new Map();
let onModelDl = null; // модель жүктелу прогресі: (loaded, total) => {}

function ttsWorker() {
  if (ttsW) return ttsW;
  ttsW = new Worker('tts-worker.js', { type: 'module' });
  ttsW.onmessage = ({ data: m }) => {
    if (m.t === 'dl') { if (/\.onnx$/.test(m.url || '')) onModelDl?.(m.loaded, m.total); return; }
    const w = ttsWait.get(m.id); if (!w) return;
    ttsWait.delete(m.id);
    m.t === 'err' ? w.rej(new Error(m.error)) : w.res(m);
  };
  ttsW.onerror = e => { for (const w of ttsWait.values()) w.rej(new Error(e.message || 'Дауыс модулі іске қосылмады')); ttsWait.clear(); ttsW = null; };
  return ttsW;
}
const ttsCall = (msg, transfer) => new Promise((res, rej) => { const id = ++ttsSeq; ttsWait.set(id, { res, rej }); ttsWorker().postMessage({ ...msg, id }, transfer || []); });

async function issaiReady() { try { return issaiHave = !!(await (await caches.open('kitapp-tts-models')).match(ISSAI_MODEL_URL)); } catch { return false; } }
issaiReady();
async function issaiRemove() { issaiHave = false; try { await (await caches.open('kitapp-tts-models')).delete(ISSAI_MODEL_URL); } catch { /* жоқ */ } ttsW?.terminate(); ttsW = null; }
// Модельді жүктеп, іске қосу. onProg(0..1)
async function issaiInit(onProg) {
  onModelDl = (l, t) => onProg?.(t ? l / t : 0);
  try { await ttsCall({ t: 'init' }); issaiHave = true; } finally { onModelDl = null; }
}

// lamejs mp3 кодері: бірінші қажет болғанда жүктеледі
let lameP = null;
const loadLame = () => lameP ??= new Promise((res, rej) => {
  if (window.lamejs) return res();
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
  s.onload = res; s.onerror = () => { lameP = null; rej(new Error('mp3 кодерін жүктеу мүмкін болмады')); };
  document.head.append(s);
});
function mp3Writer(sampleRate, kbps = 64) {
  const enc = new lamejs.Mp3Encoder(1, sampleRate, kbps), out = [];
  return {
    push(f32) {
      // Piper шығысы тым тыныш (шың ~0.1): әр бөлікті шыңы 0.9 болатындай күшейтеміз
      let pk = 0; for (let i = 0; i < f32.length; i++) pk = Math.max(pk, Math.abs(f32[i]));
      const g = pk > 1e-4 ? Math.min(10, .9 / pk) : 1;
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) { const v = Math.max(-1, Math.min(1, f32[i] * g)); i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
      for (let i = 0; i < i16.length; i += 11520) { const b = enc.encodeBuffer(i16.subarray(i, i + 11520)); if (b.length) out.push(new Uint8Array(b)); }
    },
    done() { const b = enc.flush(); if (b.length) out.push(new Uint8Array(b)); return new Blob(out, { type: 'audio/mpeg' }); },
  };
}

// Мәтінді сөйлемдік бөліктерге бөліп, ретімен дыбыстап, бір mp3-ке жинайды. ctl.stop — тоқтату
async function issaiChapter(text, onProg, ctl) {
  await loadLame();
  const pieces = RAG.chunkText(text, 500);
  let w = null; const sil = n => new Float32Array(n); // сөйлемдер арасындағы қысқа үнсіздік
  for (let i = 0; i < pieces.length; i++) {
    if (ctl?.stop) return null;
    onProg(i / pieces.length, `${i + 1}/${pieces.length}`);
    const { pcm, sampleRate } = await ttsCall({ t: 'speak', text: pieces[i], speaker: issaiSpeaker(), lengthScale: +(localStorage.kIssaiLen || 0) || undefined });
    w ??= mp3Writer(sampleRate);
    w.push(pcm); w.push(sil(Math.round(sampleRate * .25)));
  }
  return w ? w.done() : null;
}

// Қысқа мәтінді тыңдап көру
async function issaiSample(text) {
  await loadLame();
  const { pcm, sampleRate } = await ttsCall({ t: 'speak', text, speaker: issaiSpeaker(), lengthScale: +(localStorage.kIssaiLen || 0) || undefined });
  const w = mp3Writer(sampleRate); w.push(pcm);
  return w.done();
}
