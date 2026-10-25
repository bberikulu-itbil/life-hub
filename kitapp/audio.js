'use strict';
/* Kitapp: аудио. mp3 жоқ бөлім таңдалған дауыспен тікелей оқылады (ISSAI не браузер); «Аудио жасау» бөлімдерді ISSAI-мен mp3 етіп сақтайды. */

const Sp = { gen: 0, i: 0, parts: [], active: false };
const speechOK = 'speechSynthesis' in window;
const TTS_MIN_CHARS = 600; // бұдан қысқа бөлім келесімен біріктіріледі (мысалы, «Мазмұны»)

function stopSpeech() { Sp.gen++; Sp.active = false; if (speechOK) speechSynthesis.cancel(); if (Sp.au) { Sp.au.pause(); Sp.au = null; } }

// 0.05 с үнсіздік: iOS дыбысты тек батырма басылған сәтте рұқсат етеді, сол сәтте элементті «ашып» қоямыз
const SILENT = (() => { const n = 400, b = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); })();

// Мәтінді қысқа бөліктермен оқиды (Chrome ұзақ сөйлемді үзіп тастайды; ISSAI қысқа бөлікті тез дайындайды).
// ISSAI таңдалса: әр бөлік құрылғыда дыбысталып, плеердің audio элементінде ойнайды; келесісі алдын ала дайындалады.
function speak(text, { voice, rate, from = 0, onProg, onEnd, onErr, onWait, el }) {
  stopSpeech();
  const gen = Sp.gen; Sp.parts = Array.isArray(text) ? text : RAG.chunkText(text, 200); // плеер өз бөліктерін береді: белгілеу индекстері сәйкес болсын
  Sp.i = from; Sp.active = true;
  const step = () => { if (gen !== Sp.gen) return; Sp.i++; onProg?.(Sp.i / Sp.parts.length); next(); };
  const issai = ttsEngine() === 'issai', au = issai ? (Sp.au = el || (Sp.own ??= new Audio())) : null, pre = new Map();
  const synth = i => { if (!pre.has(i)) pre.set(i, issaiSample(Sp.parts[i])); return pre.get(i); };
  if (au) { au.src = SILENT; au.play().catch(() => {}); }
  const next = async () => {
    if (gen !== Sp.gen) return;
    if (Sp.i >= Sp.parts.length) { Sp.active = false; onEnd?.(); return; }
    if (issai) {
      let blob;
      Sp.wait = true; onWait?.();
      try { blob = await synth(Sp.i); } catch (e) { if (gen === Sp.gen) { toast('ISSAI: ' + e.message); stopSpeech(); onErr?.(e); } return; }
      Sp.wait = false; onWait?.();
      if (gen !== Sp.gen) return;
      if (Sp.i + 1 < Sp.parts.length) synth(Sp.i + 1);
      pre.delete(Sp.i - 1);
      if (au.src.startsWith('blob:') && au.src !== SILENT) URL.revokeObjectURL(au.src);
      au.src = URL.createObjectURL(blob); au.playbackRate = rate; au.addEventListener('ended', step, { once: true }); // onended-ке тимейміз: оны плеердің mp3 режимі қолданады
      au.play().catch(e => { if (gen === Sp.gen) { toast('Дыбыс ойнамады: ' + e.message); stopSpeech(); onErr?.(e); } });
      return;
    }
    const u = new SpeechSynthesisUtterance(Sp.parts[Sp.i]);
    u.rate = rate; u.lang = voice?.lang || 'kk-KZ'; if (voice) u.voice = voice;
    u.onend = step; u.onerror = step;
    speechSynthesis.speak(u);
  };
  next();
}

const voiceRank = v => { const l = v.lang.toLowerCase(); return l.startsWith('kk') ? 0 : l.startsWith('tr') ? 1 : l.startsWith('ru') ? 2 : l.startsWith('en') ? 3 : 4; };
const getVoices = () => speechOK ? speechSynthesis.getVoices().sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name)) : [];

// Дыбыстауға кедергі келтіретін белгілерді алып тастау: сілтемелер, [12] сияқты анықтамалар, қайталанған тыныс белгі.
const ttsText = t => t.replace(/https?:\/\/\S+/g, ' ').replace(/\[\d+(?:[,–-]\s*\d+)*\]/g, ' ').replace(/\.{4,}/g, '…').replace(/\s{2,}/g, ' ').trim();

// Тақырыпшалардың бөлім мәтініндегі орны (таңба нөмірі); табылмағаны алынады
function subsAt(text, titles = []) {
  const out = []; let from = 0;
  for (const t of titles) { const at = text.indexOf(ttsText(t), from); if (at >= 0) { out.push({ title: t, at }); from = at + 1; } }
  return out;
}

// Бөлім мәтіндерін жинап, тым қысқа бөлімдерді көрші бөліммен біріктіреді (нәтиже әрдайым бірдей).
async function audioChapters(v) {
  const cs = (await byBook('chunks', v.bookId)).filter(c => c.versionId === v.id).sort((a, b) => a.n - b.n);
  const raw = v.chapters.map(ch => { const text = ttsText(cs.filter(c => c.pi >= ch.from && c.pi <= ch.to).map(c => c.text).join(' ')); return { title: ch.title, text, subs: subsAt(text, ch.subs) }; }).filter(c => c.text);
  const out = [];
  const join = (a, b) => { const off = a.text.length + 1; a.subs.push(...b.subs.map(x => ({ ...x, at: x.at + off }))); a.text += ' ' + b.text; };
  for (const c of raw) {
    const last = out[out.length - 1];
    if (last && last.text.length < TTS_MIN_CHARS) { join(last, c); last.title = c.title; } else out.push({ ...c, subs: [...c.subs] });
  }
  if (out.length > 1 && out[out.length - 1].text.length < TTS_MIN_CHARS) join(out[out.length - 2], out.pop());
  return out;
}

const fileName = (b, i, c) => `${b.title} - ${i + 1}. ${c.title}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) + '.mp3';

// mp3 ұзақтығы (секунд); анықталмаса 0.
const blobDuration = blob => new Promise(r => {
  const a = new Audio(), u = URL.createObjectURL(blob), fin = d => { URL.revokeObjectURL(u); r(isFinite(d) ? d : 0); };
  a.preload = 'metadata'; a.onloadedmetadata = () => fin(a.duration); a.onerror = () => fin(0); a.src = u;
  setTimeout(() => fin(0), 8000);
});

async function genAudio(v, ci, text, onProg, ctl) {
  const blob = await issaiChapter(text, onProg, ctl);
  if (!blob) return null;
  const rec = { id: `${v.id}:${ci}`, bookId: v.bookId, versionId: v.id, ci, gender: voiceCur().key, created: Date.now(), blob, dur: await blobDuration(blob) };
  await put('audio', rec);
  return rec;
}

function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Аудио баптаулары (Профильде): бір дауыс таңдауы және жылдамдық ---------- */
const voiceLabel = () => ttsEngine() === 'issai' ? voiceCur().name : `Браузер · ${getVoices().find(x => x.voiceURI === localStorage.kVoice)?.name || 'әдепкі'}`;
// Модель жоқ болса, жүктеуге рұқсат сұрайды (батырма басылған сәтте, синхронды)
function askModel(vo = voiceCur()) {
  if (voiceHave(vo)) return true;
  return confirm(`«${vo.name}» дауысының моделі (~${MODELS[vo.model].mb} МБ) бір рет жүктеледі, содан кейін интернетсіз жұмыс істейді. Жүктейміз бе?`);
}
function audioSettingsHTML() {
  const r = +(localStorage.kRate || 1);
  return `<div class="glass sec" id="audioSet"><h3>${ic('headphones', 18)} Дауыс</h3>
    <small class="muted">Таңдалған дауыс тыңдағанда да, mp3 дайындағанда да қолданылады. «Жылдам» дауыстар телефонда кідіріссіз оқиды; «жоғары сапа» әдемірек, бірақ шамамен 8–10 есе баяу дайындалады.</small>
    <div class="fgrid">
      <label>Дауыс <select id="aVoiceSel"></select></label>
      <label>Тыңдау жылдамдығы <select id="aRate">${RATES.map(x => `<option value="${x}" ${x === r ? 'selected' : ''}>${x}×</option>`).join('')}</select></label>
    </div>
    <label class="tgl"><input type="checkbox" id="aAuto" ${localStorage.kAutoPrep !== '0' ? 'checked' : ''}><span>Тыңдап отырғанда алдағы бөлімдерді алдын ала дайындау<br><small class="muted">Келесі 2 бөлім фонда mp3 болып дайындалады, сондықтан кідіріссіз ойнайды.</small></span></label>
    <div class="row"><button class="primary" id="aTry">${ic('play', 16)} Тыңдап көру</button></div>
    <small id="aVoiceNote" class="muted"></small></div>`;
}
function bindAudioSettings() {
  const SAMPLE = 'Сәлеметсіз бе! Бұл Kitapp қосымшасының дауысы. Кітапты тыңдауға дайынбыз.';
  const fill = () => {
    const sel = $('#aVoiceSel'); if (!sel) return;
    const vl = getVoices(), cur = ttsEngine() === 'issai' ? 'i:' + voiceCur().key : 'b:' + (localStorage.kVoice || '');
    const opt = vo => `<option value="i:${vo.key}">${vo.name}${voiceHave(vo) ? ' ✓' : ` (${MODELS[vo.model].mb} МБ)`}</option>`;
    sel.innerHTML = `<optgroup label="ISSAI · жылдам">${VOICES.filter(x => !x.key.startsWith('h')).map(opt).join('')}</optgroup>
      <optgroup label="ISSAI · жоғары сапа">${VOICES.filter(x => x.key.startsWith('h')).map(opt).join('')}</optgroup>`
      + (vl.length ? `<optgroup label="Браузер дауысы">${vl.map(x => `<option value="b:${esc(x.voiceURI)}">${esc(x.name)} (${esc(x.lang)})</option>`).join('')}</optgroup>` : '');
    sel.value = cur; if (sel.selectedIndex < 0) sel.selectedIndex = 0;
    const vo = voiceCur(), cps = speedOf(vo.model);
    $('#aVoiceNote').innerHTML = ttsEngine() === 'browser'
      ? (vl.some(x => x.lang.toLowerCase().startsWith('kk')) ? '' : 'Бұл құрылғыда қазақ браузер дауысы жоқ: мәтін түрік не орыс дауысымен нашар оқылады. ISSAI дауысын таңдаған дұрыс.')
      : `Осы құрылғыда: 10 минут аудио ≈ ${fmtLeft(prepSecs(10 * 60 * CPS))} дайындалады${voiceHave(vo) ? '' : ` · модельді жүктеу ~${MODELS[vo.model].mb} МБ`}. ${cps * 1 < CPS ? 'Бұл дауыс тыңдаудан баяу дайындалады: алдымен mp3 жасап алған дұрыс.' : ''}`;
  };
  fill();
  if (speechOK) speechSynthesis.onvoiceschanged = fill;
  $('#aVoiceSel').onchange = e => {
    const [k, v] = [e.target.value.slice(0, 1), e.target.value.slice(2)];
    if (k === 'i') { localStorage.kTtsEngine = 'issai'; localStorage.kIssaiVoice = v; } else { localStorage.kTtsEngine = 'browser'; localStorage.kVoice = v; }
    if (P.playing && P.mode === 'tts') speakFrom(Sp.i); // ойнап тұрса, жаңа дауыспен жалғасады
    fill();
  };
  $('#aAuto').onchange = e => localStorage.kAutoPrep = e.target.checked ? '1' : '0';
  $('#aRate').onchange = e => { localStorage.kRate = e.target.value; P.rate = +e.target.value; paud.playbackRate = P.rate; };
  $('#aTry').onclick = () => {
    if (P.playing) pPause();
    if (ttsEngine() === 'issai' && !askModel()) return;
    const vo = getVoices();
    if (ttsEngine() === 'browser' && !vo.length) return toast('Браузер дауысы табылмады');
    if (ttsEngine() === 'issai' && !voiceHave()) toast('Модель жүктелуде… прогресі Профиль → Дайындау және жүктеу бөлімінде');
    speak(SAMPLE, { voice: vo.find(x => x.voiceURI === localStorage.kVoice) || vo[0], rate: +(localStorage.kRate || 1), onEnd: fill, onErr: fill });
  };
}

/* ---------- Кітаптың mp3 файлдарын жасау беті. Тыңдау — жаһандық плеерде (player.js). ---------- */
async function showAudio(bookId, versionId) {
  setNav('lib'); view.dataset.page = 'audio';
  const b = await get('books', bookId);
  const v = await withPrepared(b, versionId, () => showAudio(bookId, versionId), () => showBook(bookId), 'аудио');
  if (!v) return;
  rerender = () => showAudio(bookId, v.id);

  const vs = (await byBook('versions', bookId)).filter(isReady);
  const chs = await audioChapters(v);
  let files = new Map();
  const picked = new Set();
  const dur = i => files.get(i)?.dur || estSecs(chs[i].text);
  const total = chs.reduce((a, c) => a + estSecs(c.text), 0);

  view.innerHTML = `
    <button class="back" id="aBack">${ic('back', 22)} Артқа</button>
    <header class="hd"><h1>Аудио жасау</h1></header>
    <div class="glass sec ab-hero">${coverHTML(b, 'cv-sm')}<div><b>${esc(b.title)}</b><small>${esc(b.author || '')}</small>
      <small id="aSum"></small>
      <button class="primary" id="aListen">${ic('headphones', 18)} Тыңдау</button></div></div>
    ${vs.length > 1 ? `<label>Нұсқа <select id="aVer">${vs.map(x => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <div class="glass sec row" style="justify-content:space-between"><small class="muted">${ic('volume', 15)} Дауыс: ${esc(voiceCur().name)} (құрылғыда, тегін). Дайындау беттер ауысса да жалғасады.</small>
      <button class="ghost" id="aVoices">${ic('sliders', 16)} Дауысты өзгерту</button></div>
    <div class="glass sec" id="aList"></div>`;

  $('#aBack').onclick = () => showBook(bookId);
  $('#aListen').onclick = () => Player.open(b);
  $('#aVer') && ($('#aVer').onchange = e => showAudio(bookId, e.target.value));
  $('#aVoices').onclick = () => showProfile('audio');

  const missing = () => chs.map((_, i) => i).filter(i => !files.has(i) && !jobState(v.id, i));
  const chars = idxs => idxs.reduce((a, i) => a + chs[i].text.length, 0);
  const drawList = async () => {
    if (!$('#aList')) { onDl.delete(progress); return document.removeEventListener('kjobs', onJobs); }
    files = new Map((await byBook('audio', bookId)).filter(a => a.versionId === v.id && a.ci < chs.length).map(a => [a.ci, a]));
    const miss = missing(), sel = [...picked].filter(i => miss.includes(i)), busy = JB.q.some(j => j.vid === v.id) || JB.cur?.vid === v.id;
    $('#aSum').textContent = `${chs.length} бөлім · ${fmtT(total)} аудио · ${files.size}/${chs.length} дайын`;
    $('#aList').innerHTML = `<h3>Бөлімдер · ${chs.length}</h3>
      ${busy ? `<div class="prog"><i id="qf"></i></div><div class="row" style="justify-content:space-between"><small id="ql" class="muted"></small><button id="qStop">${ic('x', 16)} Тоқтату</button></div>` : ''}
      <div class="row" style="margin:.4rem 0"><button id="aSelAll" ${miss.length ? '' : 'disabled'}>${ic('check', 16)} Барлығын таңдау</button>
        <button class="primary" id="aGoSel" ${sel.length ? '' : 'disabled'}>Таңдалғанды дайындау (${sel.length})</button>
        <button id="aGoAll" ${miss.length ? '' : 'disabled'}>Қалғанын дайындау (${miss.length})</button></div>
      ${miss.length ? `<small class="muted">Қалған ${miss.length} бөлімді дайындауға ~${fmtLeft(prepSecs(chars(miss)))} кетеді (осы құрылғыдағы жылдамдық бойынша).</small>` : ''}
      <div class="chlist">` + chs.map((c, i) => { const js = jobState(v.id, i); return `<div class="chrow" data-i="${i}">
      ${files.has(i) ? `<span class="ok au-ok" title="Дайын">${ic('check-circle', 16)}</span>` : js ? `<span class="au-live" title="${js === 'run' ? 'Дайындалуда' : 'Кезекте'}">${ic(js === 'run' ? 'refresh' : 'list', 16)}</span>` : `<input type="checkbox" data-c="${i}" ${picked.has(i) ? 'checked' : ''} aria-label="Таңдау">`}
      <button class="chplay" data-a="play"><em class="num">${i + 1}</em><span>${esc(c.title)}<br><small class="muted">${files.has(i) ? 'Дайын · mp3' : js === 'run' ? `Дайындалуда <b data-run>${Math.round(JB.f * 100)}%</b>` : js ? 'Кезекте' : `Дайындау ~${fmtLeft(prepSecs(c.text.length))}`}</small></span><em>${fmtT(dur(i))}</em></button>
      ${files.has(i) ? `<button class="icon-btn" data-a="dl" aria-label="Жүктеп алу">${ic('download', 18)}</button><button class="icon-btn danger" data-a="rm" aria-label="Файлды өшіру">${ic('trash', 18)}</button>`
        : js ? `<button class="icon-btn" data-a="cancel" aria-label="Кезектен алу">${ic('x', 18)}</button>` : `<button class="icon-btn" data-a="gen" aria-label="mp3 дайындау">${ic('music', 18)}</button>`}</div>`; }).join('') + '</div>';
    $('#aSelAll').onclick = () => { miss.forEach(i => picked.add(i)); drawList(); };
    $('#aGoSel').onclick = () => queue(sel);
    $('#aGoAll').onclick = () => queue(miss);
    $('#qStop') && ($('#qStop').onclick = () => { JB.q = JB.q.filter(j => j.vid !== v.id); if (JB.cur?.vid === v.id) JB.stop = true; jobsSave(); jobsEmit(); });
    progress();
  };
  // Жалпы прогресс: тек жолақ пен жазу жаңарады (бүкіл тізім емес)
  const progress = () => {
    if (!$('#qf')) return;
    const mine = [JB.cur, ...JB.q].filter(j => j && j.vid === v.id), left = mine.reduce((a, j) => a + j.chars * (j === JB.cur ? 1 - JB.f : 1), 0);
    const dl = DL[voiceCur().model];
    $('#qf').style.width = (dl ? Math.round(dl.loaded / dl.total * 100) : JB.cur?.vid === v.id ? Math.round(JB.f * 100) : 0) + '%';
    $('#ql').textContent = dl ? `Дауыс моделі жүктелуде: ${Math.round(dl.loaded / dl.total * 100)}%${dl.bps ? ` · ~${fmtLeft((dl.total - dl.loaded) / dl.bps)} қалды` : ''}`
      : JB.cur?.vid === v.id ? `«${JB.cur.title}» · ${Math.round(JB.f * 100)}% · барлығы ~${fmtLeft(prepSecs(left))} қалды` : `Кезекте: ${mine.length} бөлім`;
    const r = view.querySelector('[data-run]'); if (r) r.textContent = Math.round(JB.f * 100) + '%';
  };
  let lastKey = '';
  const onJobs = () => { const k = (JB.cur?.key || '') + '|' + JB.q.length; if (k !== lastKey) { lastKey = k; drawList(); } else progress(); };
  document.addEventListener('kjobs', onJobs);
  onDl.add(progress);

  const queue = async idxs => {
    if (!idxs.length) return;
    if (!voiceHave() && !askModel()) return;
    const n = await jobAdd(b, v, idxs);
    picked.clear();
    toast(n ? `${n} бөлім кезекке қосылды · ~${fmtLeft(prepSecs(chars(idxs)))}` : 'Бұл бөлімдер дайын не кезекте');
  };

  $('#aList').onchange = e => { const c = e.target.dataset.c; if (c != null) { e.target.checked ? picked.add(+c) : picked.delete(+c); drawList(); } };
  $('#aList').onclick = async e => {
    const btn = e.target.closest('[data-a]'), row = e.target.closest('.chrow'); if (!btn || !row) return;
    const a = btn.dataset.a, i = +row.dataset.i;
    if (a === 'play') Player.open(b, i);
    if (a === 'gen') queue([i]);
    if (a === 'cancel') jobCancel(jobKey(v.id, i));
    if (a === 'dl') saveBlob(files.get(i).blob, fileName(b, i, chs[i]));
    if (a === 'rm' && confirm('Бұл бөлімнің аудио файлы өшеді.')) { await del('audio', files.get(i).id); if (P.v?.id === v.id) P.has.delete(i); drawList(); }
  };
  drawList();
}
