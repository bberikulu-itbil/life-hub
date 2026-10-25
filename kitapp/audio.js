'use strict';
/* Kitapp: аудио. Екі жол: (1) браузердің ішкі дауысы (файлсыз), (2) бұлттық дауыс: бөлім бойынша mp3 жасап, құрылғыда сақтау. */

const Sp = { gen: 0, i: 0, parts: [], active: false };
const speechOK = 'speechSynthesis' in window;
const TTS_MIN_CHARS = 600; // бұдан қысқа бөлім келесімен біріктіріледі (мысалы, «Мазмұны»)

function stopSpeech() { Sp.gen++; Sp.active = false; if (speechOK) speechSynthesis.cancel(); }

// Chrome ұзақ сөйлемді ортасында үзіп тастайды, сондықтан мәтінді қысқа бөліктермен оқимыз.
function speak(text, { voice, rate, from = 0, onProg, onEnd }) {
  stopSpeech();
  const gen = Sp.gen; Sp.parts = Array.isArray(text) ? text : RAG.chunkText(text, 200); // плеер өз бөліктерін береді: белгілеу индекстері сәйкес болсын Sp.i = from; Sp.active = true;
  const next = () => {
    if (gen !== Sp.gen) return;
    if (Sp.i >= Sp.parts.length) { Sp.active = false; onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(Sp.parts[Sp.i]);
    u.rate = rate; u.lang = voice?.lang || 'kk-KZ'; if (voice) u.voice = voice;
    const step = () => { if (gen !== Sp.gen) return; Sp.i++; onProg?.(Sp.i / Sp.parts.length); next(); };
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

// Бір бөлікті (<=3500 таңба) дыбыстау: уақытша қатеде 3 рет қайталайды, 4xx қатеде бірден тоқтайды.
async function ttsPiece(text, gender) {
  let last;
  for (let a = 0; a < 3; a++) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Алдымен Life Hub-қа кір');
    try {
      const res = await fetch(`${SB_URL}/functions/v1/book-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SB_KEY },
        body: JSON.stringify({ text, gender }),
      });
      if (res.ok) return await res.blob();
      const msg = (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) throw Object.assign(new Error(msg), { fatal: true });
      last = new Error(msg);
    } catch (e) { if (e.fatal) throw e; last = e; }
    await sleep(1500 * (a + 1));
  }
  throw last;
}

// mp3 ұзақтығы (секунд); анықталмаса 0.
const blobDuration = blob => new Promise(r => {
  const a = new Audio(), u = URL.createObjectURL(blob), fin = d => { URL.revokeObjectURL(u); r(isFinite(d) ? d : 0); };
  a.preload = 'metadata'; a.onloadedmetadata = () => fin(a.duration); a.onerror = () => fin(0); a.src = u;
  setTimeout(() => fin(0), 8000);
});

async function genAudio(v, ci, text, gender, onProg, ctl) {
  if (ttsEngine() === 'issai') {
    const blob = await issaiChapter(text, onProg, ctl);
    if (!blob) return null;
    const rec = { id: `${v.id}:${ci}`, bookId: v.bookId, versionId: v.id, ci, gender: 'issai:' + issaiSpeaker(), created: Date.now(), blob, dur: await blobDuration(blob) };
    await put('audio', rec);
    return rec;
  }
  const pieces = RAG.chunkText(text, 3500), blobs = [];
  for (let i = 0; i < pieces.length; i++) {
    if (ctl?.stop) return null;
    onProg(i / pieces.length, `${i + 1}/${pieces.length}`);
    blobs.push(await ttsPiece(pieces[i], gender));
  }
  const blob = new Blob(blobs, { type: 'audio/mpeg' });
  const rec = { id: `${v.id}:${ci}`, bookId: v.bookId, versionId: v.id, ci, gender, created: Date.now(), blob, dur: await blobDuration(blob) };
  await put('audio', rec);
  return rec;
}

function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Аудио баптаулары (Профильде): дауыстар және әдепкі жылдамдық ---------- */
function audioSettingsHTML() {
  const g = localStorage.kGender || 'f', r = +(localStorage.kRate || 1);
  return `<div class="glass sec" id="audioSet"><h3>${ic('headphones', 18)} Аудио баптаулары</h3>
    <small class="muted">Бөлімнің mp3 файлы болса, плеер соны ойнатады; болмаса браузер дауысымен оқиды.</small>
    <div class="fgrid">
      <label>mp3 жасайтын қозғалтқыш <select id="aEng"><option value="issai" ${ttsEngine() === 'issai' ? 'selected' : ''}>ISSAI қазақ дауысы (құрылғыда, тегін)</option><option value="cloud" ${ttsEngine() === 'cloud' ? 'selected' : ''}>Бұлттық дауыс (Azure)</option></select></label>
      <label>ISSAI дикторы <select id="aSpk">${ISSAI_VOICES.map(([i, n]) => `<option value="${i}" ${i === issaiSpeaker() ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Бұлттық дауыс (mp3 жасау) <select id="aGender"><option value="f" ${g === 'f' ? 'selected' : ''}>Әйел (Айгүл)</option><option value="m" ${g === 'm' ? 'selected' : ''}>Ер (Дәулет)</option></select></label>
      <label>Браузер дауысы (файлсыз) <select id="aVoice"></select></label>
      <label>Тыңдау жылдамдығы <select id="aRate">${RATES.map(x => `<option value="${x}" ${x === r ? 'selected' : ''}>${x}×</option>`).join('')}</select></label>
    </div>
    <div class="glass sec" id="aIssai"><small class="muted">ISSAI моделі тексерілуде…</small></div>
    <div class="row"><button id="aTry">${ic('play', 16)} Таңдалған дауысты тыңдап көру</button><button id="aTryB">${ic('volume', 16)} Браузер дауысын тыңдау</button></div>
    <small id="aVoiceNote" class="muted"></small></div>`;
}
function bindAudioSettings() {
  const SAMPLE = 'Сәлеметсіз бе! Бұл Kitapp қосымшасының дауысы. Кітапты тыңдауға дайынбыз.';
  $('#aGender').onchange = e => localStorage.kGender = e.target.value;
  $('#aEng').onchange = e => localStorage.kTtsEngine = e.target.value;
  $('#aSpk').onchange = e => localStorage.kIssaiSpk = e.target.value;
  const drawIssai = async () => {
    const el = $('#aIssai'); if (!el) return;
    const ok = await issaiReady();
    el.innerHTML = `<small class="muted">ISSAI KazakhTTS · CC BY 4.0 · Piper. Модель ${ok ? 'құрылғыда сақталған: интернетсіз жұмыс істейді.' : `әлі жүктелмеген (~${ISSAI_MB} МБ, бір рет).`}</small>
      <div class="row">${ok ? `<button class="ghost danger" id="aIRm">${ic('trash', 16)} Модельді өшіру</button>` : `<button id="aIDl">${ic('download', 16)} Модельді жүктеу</button>`}</div><div class="prog" hidden><i id="aIf"></i></div>`;
    $('#aIRm') && ($('#aIRm').onclick = async () => { if (confirm('ISSAI моделі құрылғыдан өшеді.')) { await issaiRemove(); drawIssai(); } });
    $('#aIDl') && ($('#aIDl').onclick = async e => {
      e.currentTarget.disabled = true; el.querySelector('.prog').hidden = false;
      try { await issaiInit(f => { const b = $('#aIf'); if (b) b.style.width = Math.round(f * 100) + '%'; }); toast('ISSAI дауысы дайын'); }
      catch (err) { toast(err.message); }
      drawIssai();
    });
  };
  drawIssai();
  $('#aRate').onchange = e => { localStorage.kRate = e.target.value; P.rate = +e.target.value; paud.playbackRate = P.rate; };
  const fill = () => {
    if (!$('#aVoice')) return;
    const vl = getVoices();
    $('#aVoice').innerHTML = vl.length ? vl.map(x => `<option value="${esc(x.voiceURI)}" ${x.voiceURI === localStorage.kVoice ? 'selected' : ''}>${esc(x.name)} (${esc(x.lang)})</option>`).join('') : '<option>Дауыс табылмады</option>';
    $('#aVoiceNote').textContent = vl.some(x => x.lang.toLowerCase().startsWith('kk')) ? '' : 'Бұл құрылғыда қазақ браузер дауысы жоқ: mp3 жоқ бөлімдер түрік не орыс дауысымен нашар оқылады. Сапалы нәтиже үшін кітап бетінен «Аудио жасау» арқылы mp3 жаса.';
  };
  fill();
  if (speechOK) speechSynthesis.onvoiceschanged = fill;
  $('#aVoice').onchange = e => localStorage.kVoice = e.target.value;
  $('#aTryB').onclick = () => { const vo = getVoices(); if (!vo.length) return toast('Браузер дауысы табылмады'); speak(SAMPLE, { voice: vo.find(x => x.voiceURI === localStorage.kVoice) || vo[0], rate: +(localStorage.kRate || 1) }); };
  $('#aTry').onclick = async e => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      if (ttsEngine() === 'issai' && !(await issaiReady()) && !confirm(`ISSAI моделі (~${ISSAI_MB} МБ) бір рет жүктеледі. Жалғастырамыз ба?`)) throw new Error('Бас тартылды');
      const a = new Audio(URL.createObjectURL(ttsEngine() === 'issai' ? await issaiSample(SAMPLE) : await ttsPiece(SAMPLE, localStorage.kGender || 'f'))); a.playbackRate = +(localStorage.kRate || 1); a.play(); }
    catch (err) { toast(err.message); }
    btn.disabled = false; drawIssai();
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
  const files = new Map((await byBook('audio', bookId)).filter(a => a.versionId === v.id && a.ci < chs.length).map(a => [a.ci, a]));
  const gender = localStorage.kGender || 'f';
  const picked = new Set(), Q = { running: false, stop: false };
  const dur = i => files.get(i)?.dur || estSecs(chs[i].text);
  const total = chs.reduce((a, _, i) => a + dur(i), 0);

  view.innerHTML = `
    <button class="back" id="aBack">${ic('back', 22)} Артқа</button>
    <header class="hd"><h1>Аудио жасау</h1></header>
    <div class="glass sec ab-hero">${coverHTML(b, 'cv-sm')}<div><b>${esc(b.title)}</b><small>${esc(b.author || '')}</small>
      <small>${chs.length} бөлім · ${fmtT(total)} · ${files.size}/${chs.length} mp3 дайын</small>
      <button class="primary" id="aListen">${ic('headphones', 18)} Тыңдау</button></div></div>
    ${vs.length > 1 ? `<label>Нұсқа <select id="aVer">${vs.map(x => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <div class="glass sec row" style="justify-content:space-between"><small class="muted">${ic('volume', 15)} ${ttsEngine() === 'issai' ? `ISSAI: ${ISSAI_VOICES.find(x => x[0] === issaiSpeaker())?.[1] || ''}, құрылғыда, тегін` : `Бұлттық дауыс: ${gender === 'm' ? 'Ер (Дәулет)' : 'Әйел (Айгүл)'}`}. Дауыстар Профильде өзгертіледі.</small>
      <button class="ghost" id="aVoices">${ic('sliders', 16)} Аудио баптаулары</button></div>
    <div class="glass sec" id="aList"></div>`;

  $('#aBack').onclick = () => { Q.stop = true; showBook(bookId); };
  $('#aListen').onclick = () => Player.open(b);
  $('#aVer') && ($('#aVer').onchange = e => { Q.stop = true; showAudio(bookId, e.target.value); });
  $('#aVoices').onclick = () => showProfile('audio');

  const missing = () => chs.map((_, i) => i).filter(i => !files.has(i));
  const chars = idxs => idxs.reduce((a, i) => a + chs[i].text.length, 0);
  const drawList = () => {
    const miss = missing(), sel = [...picked].filter(i => !files.has(i));
    const bar = Q.running
      ? `<div class="prog"><i id="qf"></i></div><div class="row" style="justify-content:space-between"><small id="ql" style="color:var(--mute)"></small><button id="qStop">${ic('x', 16)} Тоқтату</button></div>`
      : `<div class="row" style="margin-bottom:.4rem"><button id="aSelAll">${ic('check', 16)} Барлығын таңдау</button>
          <button class="primary" id="aGoSel" ${sel.length ? '' : 'disabled'}>Таңдалғанды жасау (${sel.length})</button>
          <button id="aGoAll" ${miss.length ? '' : 'disabled'}>Қалғанын жасау (${miss.length})</button></div>
          ${miss.length ? `<small style="color:var(--mute)">Қалған ${miss.length} бөлім: ~${chars(miss).toLocaleString('kk')} таңба, ~${fmtT(miss.reduce((a, i) => a + dur(i), 0))} аудио.</small>` : ''}`;
    $('#aList').innerHTML = `<h3>Бөлімдер · ${chs.length}</h3>${bar}<div class="chlist">` + chs.map((c, i) => `<div class="chrow" data-i="${i}">
      ${!files.has(i) ? `<input type="checkbox" data-c="${i}" ${picked.has(i) ? 'checked' : ''} ${Q.running ? 'disabled' : ''} aria-label="Таңдау">` : `<span class="ok">${ic('check', 16)}</span>`}
      <button class="chplay" data-a="play"><em class="num">${i + 1}</em><span>${esc(c.title)}</span><em>${fmtT(dur(i))}</em></button>
      ${files.has(i) ? `<button class="icon-btn" data-a="dl" aria-label="Жүктеп алу">${ic('download', 18)}</button><button class="icon-btn danger" data-a="rm" aria-label="Файлды өшіру">${ic('trash', 18)}</button>`
        : `<button class="icon-btn" data-a="gen" ${Q.running ? 'disabled' : ''} aria-label="mp3 жасау">${ic('music', 18)}</button>`}</div>`).join('') + '</div>';
    $('#aSelAll') && ($('#aSelAll').onclick = () => { miss.forEach(i => picked.add(i)); drawList(); });
    $('#aGoSel') && ($('#aGoSel').onclick = () => runQueue(sel));
    $('#aGoAll') && ($('#aGoAll').onclick = () => runQueue(miss));
    $('#qStop') && ($('#qStop').onclick = () => { Q.stop = true; $('#qStop').disabled = true; });
  };

  // Кезек: бөлімдерді бірінен соң бірін жасайды; жалпы прогресс пен тоқтату бар.
  const runQueue = async idxs => {
    const todo = idxs.filter(i => !files.has(i)), sum = chars(todo);
    if (!todo.length) return;
    const local = ttsEngine() === 'issai';
    if (!confirm(local
      ? `${todo.length} бөлім (~${sum.toLocaleString('kk')} таңба) осы құрылғыда дыбысталады. Бұл бірнеше минутқа созылуы мүмкін, бетті жаппаңыз.`
      : `${todo.length} бөлім үшін ~${sum.toLocaleString('kk')} таңба дауысқа айналады. Бұл қызмет лимитін жейді. Жалғастырамыз ба?`)) return;
    Q.running = true; Q.stop = false; drawList();
    let lock = null; try { lock = await navigator.wakeLock?.request('screen'); } catch { /* қолдамайды */ }
    if (local && !(await issaiReady())) {
      if (!confirm(`Алдымен ISSAI моделі (~${ISSAI_MB} МБ) бір рет жүктеледі. Wi-Fi ұсынылады. Жалғастырамыз ба?`)) { Q.running = false; lock?.release(); return drawList(); }
      try { await issaiInit(f => { if ($('#qf')) { $('#qf').style.width = Math.round(f * 100) + '%'; $('#ql').textContent = `Дауыс моделі жүктелуде: ${Math.round(f * 100)}%`; } }); }
      catch (err) { toast(err.message); Q.running = false; lock?.release(); return drawList(); }
    }
    let doneChars = 0, k = 0;
    for (const i of todo) {
      if (Q.stop) break;
      k++;
      try {
        const rec = await genAudio(v, i, chs[i].text, gender, (f, l) => {
          if (!$('#qf')) return;
          $('#qf').style.width = Math.round((doneChars + chs[i].text.length * f) / sum * 100) + '%';
          $('#ql').textContent = `${k}/${todo.length} бөлім, «${chs[i].title}» ${l}`;
        }, Q);
        if (!rec) break;
        files.set(i, rec); picked.delete(i); doneChars += chs[i].text.length;
      } catch (err) { console.error(err); toast(`${i + 1}-бөлім: ${err.message}`); break; }
    }
    Q.running = false; lock?.release(); toast(Q.stop ? 'Тоқтатылды' : 'Кезек аяқталды');
    if ($('#aList')) drawList();
  };

  $('#aList').onchange = e => { const c = e.target.dataset.c; if (c != null) { e.target.checked ? picked.add(+c) : picked.delete(+c); drawList(); } };
  $('#aList').onclick = async e => {
    const btn = e.target.closest('[data-a]'), row = e.target.closest('.chrow'); if (!btn || !row) return;
    const a = btn.dataset.a, i = +row.dataset.i;
    if (a === 'play') Player.open(b, i);
    if (a === 'gen') runQueue([i]);
    if (a === 'dl') saveBlob(files.get(i).blob, fileName(b, i, chs[i]));
    if (a === 'rm' && confirm('Бұл бөлімнің аудио файлы өшеді.')) { await del('audio', files.get(i).id); files.delete(i); drawList(); }
  };
  drawList();
}
