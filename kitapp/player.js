'use strict';
/* Kitapp: жаһандық аудиоплеер. Бөлімнің mp3 файлы болса соны, болмаса браузер дауысын ойнатады.
   Беттер ауысқанда тоқтамайды: төменде мини-плеер, басқанда толық экран ашылады. */

const CPS = 13.3;            // браузер дауысының шамамен жылдамдығы: 1× кезінде секундына таңба
const RATES = [.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP = [[0, 'Өшіру'], [5, '5 минут'], [15, '15 минут'], [30, '30 минут'], [45, '45 минут'], [60, '1 сағат'], ['end', 'Бөлім соңында']];
const fmtT = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };

const P = { b: null, v: null, chs: [], durs: [], i: 0, mode: null, rec: null, url: null, parts: [], cum: [], playing: false, rate: +(localStorage.kRate || 1), sleepAt: 0, sleepEnd: false, saved: 0 };
const paud = $('#pAudio'), sheet = $('#psheet'), mini = $('#mini');

const estSecs = text => text.length / CPS;

/* ---------- Ойнату логикасы ---------- */
async function pLoad(i, pos) {
  P.i = i; stopSpeech(); paud.pause();
  // мәтін бөліктері екі режимге де керек: браузер дауысы осылармен оқиды, «Мәтін» көрінісі осыларды белгілейді
  P.parts = RAG.chunkText(P.chs[i].text, 200);
  P.cum = [0]; for (const p of P.parts) P.cum.push(P.cum[P.cum.length - 1] + p.length);
  P.textFor = -1; P.hl = -1;
  P.rec = await get('audio', `${P.v.id}:${i}`);
  P.mode = P.rec ? 'mp3' : 'tts';
  if (P.mode === 'mp3') {
    if (P.url) URL.revokeObjectURL(P.url);
    P.url = URL.createObjectURL(P.rec.blob); paud.src = P.url;
    paud.addEventListener('loadedmetadata', () => {
      paud.playbackRate = P.rate;
      if (pos?.t && pos.t < paud.duration - 3) paud.currentTime = pos.t;
      if (isFinite(paud.duration) && !P.rec.dur) { P.rec.dur = paud.duration; P.durs[i] = paud.duration; put('audio', P.rec); }
    }, { once: true });
  } else {
    Sp.i = Math.min(pos?.part || 0, Math.max(0, P.parts.length - 1));
  }
  pMeta(); pRender();
}

// Қазір оқылып жатқан мәтін бөлігі: браузер дауысында нақты, mp3-те уақыт үлесі бойынша шамамен
function curPart() {
  if (P.mode === 'tts') return Math.min(Sp.i, P.parts.length - 1);
  const [t, d] = pTimes(), ch = d ? t / d * P.cum[P.cum.length - 1] : 0;
  return Math.max(0, P.cum.findIndex(c => c > ch) - 1);
}
function seekPart(k) {
  if (P.mode === 'tts') { Sp.i = k; if (P.playing) speakFrom(k); }
  else { const d = pTimes()[1]; if (d) paud.currentTime = P.cum[k] / P.cum[P.cum.length - 1] * d; }
  pSave(); pRender();
}
function renderText() {
  const box = $('#psText');
  if (P.textFor !== P.i) {
    P.textFor = P.i; P.hl = -1;
    box.innerHTML = `<h4>${esc(P.chs[P.i].title)}</h4>` + P.parts.map((p, k) => `<span data-k="${k}">${esc(p)} </span>`).join('');
  }
  const k = curPart();
  if (k !== P.hl) {
    box.querySelector('.on')?.classList.remove('on');
    const el = box.querySelector(`[data-k="${k}"]`);
    if (el) { el.classList.add('on'); if (!box.matches(':hover') || P.playing) el.scrollIntoView({ block: 'center', behavior: P.hl < 0 ? 'auto' : 'smooth' }); }
    P.hl = k;
  }
}

function speakFrom(k) {
  const vo = getVoices(), voice = vo.find(x => x.voiceURI === localStorage.kVoice) || vo[0];
  speak(P.chs[P.i].text, { voice, rate: P.rate, from: k, onEnd: pEnded });
}

function pPlay() {
  if (!P.b) return;
  if (P.mode === 'tts' && (!speechOK || !getVoices().length)) { toast('Бұл бөлімнің mp3 файлы жоқ, ал браузер дауысы табылмады. Кітап бетінен «Аудио жасау» арқылы mp3 жаса.'); pRender(); return; }
  P.playing = true;
  if (P.mode === 'mp3') paud.play().catch(() => { P.playing = false; pRender(); });
  else speakFrom(Sp.i);
  pRender();
}
function pPause() {
  P.playing = false;
  if (P.mode === 'mp3') paud.pause(); else { const at = Sp.i; stopSpeech(); Sp.i = at; }
  pSave(); pRender();
}
const pToggle = () => P.playing ? pPause() : pPlay();

async function pEnded() {
  if (P.sleepEnd) { P.sleepEnd = false; P.playing = false; pSave(); pRender(); return; }
  if (P.i + 1 < P.chs.length) { await pLoad(P.i + 1); pPlay(); } else { P.playing = false; pRender(); toast('Кітап аяқталды'); }
}
paud.onended = () => P.mode === 'mp3' && pEnded();
paud.onpause = () => { if (P.mode === 'mp3' && P.playing && !paud.ended) { P.playing = false; pRender(); } };
paud.onplay = () => { if (P.mode === 'mp3' && !P.playing) { P.playing = true; pRender(); } };

function pTimes() {
  if (P.mode === 'mp3') return [paud.currentTime || 0, isFinite(paud.duration) ? paud.duration : (P.rec?.dur || 0)];
  const total = (P.cum[P.cum.length - 1] || 0) / CPS / P.rate;
  return [(P.cum[Math.min(Sp.i, P.parts.length)] || 0) / CPS / P.rate, total];
}
function pSeek(sec) {
  const [, dur] = pTimes(); sec = Math.max(0, Math.min(dur - .5, sec));
  if (P.mode === 'mp3') paud.currentTime = sec;
  else {
    const ch = sec * CPS * P.rate;
    Sp.i = Math.max(0, P.cum.findIndex(c => c > ch) - 1);
    if (P.playing) speakFrom(Sp.i);
  }
  pSave(); pRender();
}
const pSkip = d => pSeek(pTimes()[0] + d);
async function pJump(i) { if (i < 0 || i >= P.chs.length) return; await pLoad(i); pPlay(); }
const pPrev = () => pTimes()[0] > 5 ? pSeek(0) : pJump(P.i - 1);
const pNext = () => pJump(P.i + 1);

function pRate() {
  P.rate = RATES[(RATES.indexOf(P.rate) + 1) % RATES.length] || 1; localStorage.kRate = P.rate;
  paud.playbackRate = P.rate;
  if (P.mode === 'tts' && P.playing) speakFrom(Sp.i);
  pRender();
}

function pSave() {
  if (!P.b) return;
  try { localStorage['kPlay:' + P.b.id] = JSON.stringify({ vid: P.v.id, ci: P.i, t: paud.currentTime || 0, part: Sp.i, at: Date.now() }); } catch { /* сақтау өшік */ }
}

function pStop() {
  pPause(); P.b = null; paud.removeAttribute('src'); hideSheet(); updateMini();
}

function pMeta() {
  if (!('mediaSession' in navigator) || !P.b) return;
  const art = coverURL(P.b);
  navigator.mediaSession.metadata = new MediaMetadata({ title: P.chs[P.i].title, artist: P.b.author || '', album: P.b.title, artwork: art ? [{ src: art, sizes: '360x540', type: 'image/jpeg' }] : [] });
}
if ('mediaSession' in navigator) {
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* қолдамайды */ } };
  h('play', pPlay); h('pause', pPause); h('seekbackward', () => pSkip(-15)); h('seekforward', () => pSkip(30));
  h('previoustrack', pPrev); h('nexttrack', pNext);
}

// Әр жарты секунд: интерфейс, ұйқы таймері, позицияны сақтау.
setInterval(() => {
  if (!P.b) return;
  if (P.sleepAt && Date.now() >= P.sleepAt) { P.sleepAt = 0; if (P.playing) { pPause(); toast('Ұйқы таймері: тоқтатылды'); } }
  if (P.playing && Date.now() - P.saved > 5000) { P.saved = Date.now(); pSave(); }
  if (P.playing || P.sleepAt) pRender();
}, 500);

/* ---------- Интерфейс ---------- */
function pRender() {
  if (!P.b) return;
  const [t, d] = pTimes(), playIc = ic(P.playing ? 'pause' : 'play', 30, true);
  // мини-плеер
  mini.hidden = false; document.body.classList.add('has-mini');
  mini.innerHTML = `<div class="mini-p"><i style="width:${d ? t / d * 100 : 0}%"></i></div>
    <div class="mini-cv">${coverHTML(P.b, 'cv-xs')}</div>
    <div class="mini-t"><b>${esc(P.chs[P.i].title)}</b><small>${esc(P.b.title)}</small></div>
    <button class="icon-btn" data-m="toggle" aria-label="${P.playing ? 'Кідірту' : 'Ойнату'}">${ic(P.playing ? 'pause' : 'play', 22, true)}</button>
    <button class="icon-btn" data-m="close" aria-label="Плеерді жабу">${ic('x', 20)}</button>`;
  if (sheet.hidden) return;
  $('#psCh').textContent = `${P.i + 1}/${P.chs.length} · ${P.chs[P.i].title}`;
  $('#psMode').textContent = P.mode === 'mp3' ? 'mp3 файл' : 'Браузер дауысы';
  const s = $('#psSeek'); s.max = Math.max(1, Math.round(d)); if (!s.matches(':active')) s.value = Math.round(t);
  s.style.setProperty('--p', (d ? t / d * 100 : 0) + '%');
  $('#psT0').textContent = fmtT(t); $('#psT1').textContent = '-' + fmtT(d - t);
  $('#psPlay').innerHTML = playIc; $('#psPlay').setAttribute('aria-label', P.playing ? 'Кідірту' : 'Ойнату');
  $('#psRate').textContent = P.rate + '×';
  sheet.classList.toggle('txt', !!P.textMode);
  if (P.textMode) renderText();
  $('#psSleep').innerHTML = `${ic('moon', 18)} ${P.sleepAt ? fmtT((P.sleepAt - Date.now()) / 1000) : P.sleepEnd ? 'Бөлім соңында' : 'Ұйқы таймері'}`;
}

function showSheet() {
  if (!P.b) return;
  const u = coverURL(P.b);
  $('#psBg').style.backgroundImage = u ? `url("${u}")` : 'none';
  $('#psCover').innerHTML = coverHTML(P.b, 'cv-xl');
  $('#psTitle').textContent = P.b.title; $('#psAuthor').textContent = P.b.author || '';
  $('#psList').hidden = true;
  sheet.hidden = false; document.body.classList.add('noscroll');
  pRender();
}
function hideSheet() { sheet.hidden = true; document.body.classList.remove('noscroll'); }

function sheetList(title, rows, onPick) {
  const L = $('#psList');
  L.innerHTML = `<div class="psl-hd"><b>${title}</b><button class="icon-btn" data-x aria-label="Жабу">${ic('x', 20)}</button></div><div class="psl-body">${rows}</div>`;
  L.hidden = false;
  L.onclick = e => { if (e.target.closest('[data-x]')) return (L.hidden = true); const r = e.target.closest('[data-i]'); if (r) { L.hidden = true; onPick(r.dataset.i); } };
  L.querySelector('.now')?.scrollIntoView({ block: 'center' });
}

$('#psDown').onclick = hideSheet;
P.textMode = localStorage.kPText === '1';
$('#psTxt').onclick = () => { P.textMode = !P.textMode; localStorage.kPText = P.textMode ? '1' : '0'; P.textFor = -1; P.hl = -1; pRender(); };
$('#psText').onclick = e => { const s = e.target.closest('[data-k]'); if (s) seekPart(+s.dataset.k); };
$('#psMark').onclick = () => audioMark();
$('#psPlay').onclick = pToggle;
$('#psRw').onclick = () => pSkip(-15);
$('#psFf').onclick = () => pSkip(30);
$('#psPrev').onclick = pPrev;
$('#psNext').onclick = pNext;
$('#psRate').onclick = pRate;
$('#psSeek').onchange = e => pSeek(+e.target.value);
$('#psSeek').oninput = e => { const d = pTimes()[1]; e.target.style.setProperty('--p', (d ? e.target.value / d * 100 : 0) + '%'); $('#psT0').textContent = fmtT(+e.target.value); };
$('#psSet').onclick = () => { const id = P.b.id; hideSheet(); showAudio(id); };
$('#psChs').onclick = $('#psCh').onclick = () => sheetList(`Бөлімдер · ${P.chs.length}`, P.chs.map((c, i) => `<button class="lrow ${i === P.i ? 'now' : ''}" data-i="${i}"><em class="num">${i + 1}</em><span>${esc(c.title)}</span><em>${fmtT(P.durs[i])}</em></button>`).join(''), i => pJump(+i));
$('#psSleep').onclick = () => sheetList('Ұйқы таймері', SLEEP.map(([k, t]) => `<button class="lrow" data-i="${k}"><span>${t}</span></button>`).join(''), k => {
  P.sleepEnd = k === 'end'; P.sleepAt = k === 'end' || k === '0' ? 0 : Date.now() + k * 60000;
  toast(k === '0' ? 'Таймер өшірілді' : 'Таймер қойылды'); pRender();
});
document.addEventListener('keydown', e => {
  if (sheet.hidden || /TEXTAREA|INPUT|SELECT/.test(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); pToggle(); }
  if (e.key === 'ArrowLeft') pSkip(-15); if (e.key === 'ArrowRight') pSkip(30);
  if (e.key === 'Escape') hideSheet();
});

mini.onclick = async e => {
  const m = e.target.closest('[data-m]')?.dataset.m;
  if (m === 'toggle') return pToggle();
  if (m === 'close') return pStop();
  if (m === 'read') return continueReading(await get('books', mini.dataset.book));
  if (P.b) showSheet(); else if (mini.dataset.book) showBook(mini.dataset.book);
};

// Плеер жоқ кезде мини-панель соңғы оқылған кітапты ұсынады.
async function updateMini() {
  if (P.b) return pRender();
  const cur = db ? currentBook(await all('books')) : null;
  if (!cur || ['book', 'home'].includes(view.dataset.page)) { mini.hidden = true; document.body.classList.remove('has-mini'); return; }
  const pct = bookPct(cur, await byBook('versions', cur.id));
  mini.dataset.book = cur.id; mini.hidden = false; document.body.classList.add('has-mini');
  mini.innerHTML = `<div class="mini-p"><i style="width:${pct}%"></i></div><div class="mini-cv">${coverHTML(cur, 'cv-xs')}</div>
    <div class="mini-t"><b>${esc(cur.title)}</b><small>${esc(cur.author || '')}</small></div><button class="pill" data-m="read">Оқу</button>`;
}

const Player = {
  // ci берілсе — сол бөлімнің басынан, әйтпесе тоқтаған жерден.
  async open(b, ci, opts = {}) {
    const saved = JSON.parse(localStorage['kPlay:' + b.id] || 'null');
    // дайындау бетінен кейін кітап бетіне қайтып, плеерді ашамыз
    const v = await withPrepared(b, opts.vid || saved?.vid, () => { showBook(b.id); Player.open(b, ci, opts); }, () => showBook(b.id), 'аудио');
    if (!v) return;
    const chs = await audioChapters(v);
    if (!chs.length) return toast('Аудио үшін мәтін табылмады');
    if (P.b) pPause();
    b.lastOpened = Date.now(); put('books', b);
    const recs = (await byBook('audio', b.id)).filter(a => a.versionId === v.id);
    Object.assign(P, { b, v, chs, durs: chs.map((c, i) => recs.find(r => r.ci === i)?.dur || estSecs(c.text)) });
    const at = opts.at && opts.vid === v.id && opts.at.ci < chs.length ? opts.at : null; // бетбелгіден ашу
    const resume = !at && ci == null && saved?.vid === v.id && saved.ci < chs.length;
    await pLoad(at ? at.ci : resume ? saved.ci : (ci || 0), at || (resume ? saved : null));
    if (opts.expand !== false) showSheet();
    pPlay();
  },
  get active() { return !!P.b; },
};
