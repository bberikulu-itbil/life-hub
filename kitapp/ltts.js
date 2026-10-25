'use strict';
/* Kitapp: құрылғыдағы қазақ дауысы — ISSAI KazakhTTS (Piper, CC BY 4.0).
   Модель бір рет жүктеледі және сақталады; одан кейін аудио интернетсіз, тегін жасалады.
   Нәтиже бөлім бойынша mp3 (lamejs) болып сақталады. */

// Дауыстар: ISSAI KazakhTTS деректерінен үйретілген Piper модельдері (CC BY 4.0).
// «Жылдам» модельдер шағын (20–28 МБ) және телефонда бірнеше есе тез; «Жоғары сапа» — 6 дикторлы үлкен модель (128 МБ).
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/kk/kk_KZ/';
const MODELS = {
  'kk_KZ-raya-x_low': { url: HF + 'raya/x_low/kk_KZ-raya-x_low.onnx', mb: 21, name: 'Жылдам модель · Рая', cps: 50 },
  'kk_KZ-iseke-x_low': { url: HF + 'iseke/x_low/kk_KZ-iseke-x_low.onnx', mb: 28, name: 'Жылдам модель · Исеке', cps: 45 },
  'kk_KZ-issai-high': { url: HF + 'issai/high/kk_KZ-issai-high.onnx', mb: 128, name: 'Жоғары сапа моделі (6 диктор)', cps: 6 },
};
// cps — алғашқы болжам (таңба/сек); нақты жылдамдық әр құрылғыда өлшеніп, сақталады
const VOICES = [
  { key: 'raya', model: 'kk_KZ-raya-x_low', spk: 0, name: 'Рая · жылдам' },
  { key: 'iseke', model: 'kk_KZ-iseke-x_low', spk: 0, name: 'Исеке · жылдам' },
  ...[[3, 'Рая'], [1, 'Исеке'], [4, 'Әйел дауысы 2'], [5, 'Әйел дауысы 3'], [2, 'Әйел дауысы 4'], [0, 'Ер дауысы 2']]
    .map(([spk, n]) => ({ key: 'h' + spk, model: 'kk_KZ-issai-high', spk, name: n + ' · жоғары сапа' })),
];
// Бір таңдау: ISSAI дауысы (әдепкі) немесе браузер дауысы. mp3 файлдарды әрқашан ISSAI жасайды.
const ttsEngine = () => localStorage.kTtsEngine === 'browser' ? 'browser' : 'issai';
const voiceCur = () => VOICES.find(v => v.key === (localStorage.kIssaiVoice || (localStorage.kIssaiSpk ? 'h' + localStorage.kIssaiSpk : 'raya'))) || VOICES[0];
const haveModels = new Set(); // құрылғыда сақталған модельдер (батырма басылған сәтте синхронды тексеру үшін)
const voiceHave = (vo = voiceCur()) => haveModels.has(vo.model);

let ttsW = null, ttsSeq = 0;
const ttsWait = new Map();
const DL = {}; // модель жүктелуі: { [model]: { loaded, total, t0, bps } }
const onDl = new Set(); // жүктелу прогресін тыңдайтындар

function ttsWorker() {
  if (ttsW) return ttsW;
  ttsW = new Worker('tts-worker.js', { type: 'module' });
  ttsW.onmessage = ({ data: m }) => {
    if (m.t === 'dl') {
      if (!/\.onnx$/.test(m.url || '')) return;
      const d = DL[m.voice] ??= { t0: performance.now() };
      Object.assign(d, { loaded: m.loaded, total: m.total, bps: m.loaded / Math.max(.5, (performance.now() - d.t0) / 1000) });
      onDl.forEach(f => f(m.voice, d));
      return;
    }
    const w = ttsWait.get(m.id); if (!w) return;
    ttsWait.delete(m.id);
    m.t === 'err' ? w.rej(new Error(m.error)) : w.res(m);
  };
  ttsW.onerror = e => { for (const w of ttsWait.values()) w.rej(new Error(e.message || 'Дауыс модулі іске қосылмады')); ttsWait.clear(); ttsW = null; };
  return ttsW;
}
const ttsCall = msg => new Promise((res, rej) => { const id = ++ttsSeq; ttsWait.set(id, { res, rej }); ttsWorker().postMessage({ ...msg, id }); });

const modelCache = () => caches.open('kitapp-tts-models');
async function checkModels() { try { const c = await modelCache(); for (const [id, m] of Object.entries(MODELS)) (await c.match(m.url)) ? haveModels.add(id) : haveModels.delete(id); } catch { /* Cache API жоқ */ } return haveModels; }
checkModels();
async function issaiRemove(model) { haveModels.delete(model); try { await (await modelCache()).delete(MODELS[model].url); } catch { /* жоқ */ } ttsW?.terminate(); ttsW = null; }
// Модельді жүктеп, іске қосу
async function issaiInit(model = voiceCur().model) {
  DL[model] = { t0: performance.now(), loaded: 0, total: MODELS[model].mb * 1048576 };
  try { await ttsCall({ t: 'init', voice: model }); haveModels.add(model); } finally { delete DL[model]; onDl.forEach(f => f(model, null)); }
}

// Осы құрылғыдағы дыбыстау жылдамдығы (таңба/сек), әр модель үшін бөлек
const speedOf = model => { try { return JSON.parse(localStorage.kTtsCps || '{}')[model] || MODELS[model].cps; } catch { return MODELS[model].cps; } };
function noteSpeed(model, chars, ms) {
  if (chars < 40 || !ms) return;
  try { const s = JSON.parse(localStorage.kTtsCps || '{}'), v = chars / (ms / 1000); s[model] = s[model] ? s[model] * .7 + v * .3 : v; localStorage.kTtsCps = JSON.stringify(s); } catch { /* сақтау өшік */ }
}
// Мәтінді дайындауға кететін шамамен уақыт (сек)
const prepSecs = (chars, vo = voiceCur()) => chars / speedOf(vo.model);

async function speakPcm(text, pri) {
  const vo = voiceCur();
  const r = await ttsCall({ t: 'speak', voice: vo.model, text, speaker: vo.spk, pri, lengthScale: +(localStorage.kIssaiLen || 0) || undefined });
  noteSpeed(vo.model, text.length, r.ms); haveModels.add(vo.model);
  return r;
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
  const pieces = RAG.chunkText(text, 250); // қысқа бөліктер: қатар тыңдап отырғанда тікелей оқу ұзақ күтпейді
  let w = null; const sil = n => new Float32Array(n); // сөйлемдер арасындағы қысқа үнсіздік
  for (let i = 0; i < pieces.length; i++) {
    if (ctl?.stop) return null;
    onProg(i / pieces.length, `${i + 1}/${pieces.length}`);
    const { pcm, sampleRate } = await speakPcm(pieces[i], false);
    w ??= mp3Writer(sampleRate);
    w.push(pcm); w.push(sil(Math.round(sampleRate * .25)));
  }
  return w ? w.done() : null;
}

// Қысқа мәтінді дыбыстау (тікелей тыңдау, тыңдап көру): mp3 дайындаудан бұрын орындалады
async function issaiSample(text) {
  await loadLame();
  const { pcm, sampleRate } = await speakPcm(text, true);
  const w = mp3Writer(sampleRate); w.push(pcm);
  return w.done();
}
