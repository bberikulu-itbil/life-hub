'use strict';
/* Kitapp: аудио. Екі жол: (1) браузердің ішкі дауысы (файлсыз), (2) бұлттық дауыс: бөлім бойынша mp3 жасап, құрылғыда сақтау. */

const Sp = { gen: 0, i: 0, parts: [], active: false };
const speechOK = 'speechSynthesis' in window;
const TTS_MIN_CHARS = 600; // бұдан қысқа бөлім келесімен біріктіріледі (мысалы, «Мазмұны»)

function stopSpeech() { Sp.gen++; Sp.active = false; if (speechOK) speechSynthesis.cancel(); }

// Chrome ұзақ сөйлемді ортасында үзіп тастайды, сондықтан мәтінді қысқа бөліктермен оқимыз.
function speak(text, { voice, rate, from = 0, onProg, onEnd }) {
  stopSpeech();
  const gen = Sp.gen; Sp.parts = RAG.chunkText(text, 200); Sp.i = from; Sp.active = true;
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

// Бөлім мәтіндерін жинап, тым қысқа бөлімдерді көрші бөліммен біріктіреді (нәтиже әрдайым бірдей).
async function audioChapters(v) {
  const cs = (await byBook('chunks', v.bookId)).filter(c => c.versionId === v.id).sort((a, b) => a.n - b.n);
  const raw = v.chapters.map(ch => ({ title: ch.title, text: ttsText(cs.filter(c => c.pi >= ch.from && c.pi <= ch.to).map(c => c.text).join(' ')) })).filter(c => c.text);
  const out = [];
  for (const c of raw) {
    const last = out[out.length - 1];
    if (last && last.text.length < TTS_MIN_CHARS) { last.text += ' ' + c.text; last.title = c.title; } else out.push({ ...c });
  }
  if (out.length > 1 && out[out.length - 1].text.length < TTS_MIN_CHARS) { const t = out.pop(); out[out.length - 1].text += ' ' + t.text; }
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

async function genAudio(v, ci, text, gender, onProg, ctl) {
  const pieces = RAG.chunkText(text, 3500), blobs = [];
  for (let i = 0; i < pieces.length; i++) {
    if (ctl?.stop) return null;
    onProg(i / pieces.length, `${i + 1}/${pieces.length}`);
    blobs.push(await ttsPiece(pieces[i], gender));
  }
  const rec = { id: `${v.id}:${ci}`, bookId: v.bookId, versionId: v.id, ci, gender, created: Date.now(), blob: new Blob(blobs, { type: 'audio/mpeg' }) };
  await put('audio', rec);
  return rec;
}

function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function showAudio(bookId, versionId) {
  setNav('lib'); stopSpeech();
  const b = await get('books', bookId);
  const v = await withPrepared(b, versionId, () => showAudio(bookId, versionId), () => showBook(bookId), 'аудио');
  if (!v) return;

  const vs = (await byBook('versions', bookId)).filter(isReady);
  const chs = await audioChapters(v);
  const files = new Map((await byBook('audio', bookId)).filter(a => a.versionId === v.id && a.ci < chs.length).map(a => [a.ci, a]));
  let engine = localStorage.kEngine || 'browser', gender = localStorage.kGender || 'f', rate = +(localStorage.kRate || 1), cur = -1, objUrl = null;
  const picked = new Set(), Q = { running: false, stop: false };
  const voices = () => getVoices();
  const mins = i => Math.max(1, Math.round(chs[i].text.length / 800));
  const totalMin = chs.reduce((a, _, i) => a + mins(i), 0);

  view.innerHTML = `
    <button class="ghost" id="aBack">${ic('back')} Кітапқа</button>
    <div class="sec"><h3>${ic('headphones')} ${esc(b.title)}</h3>
      <small style="color:var(--mute)">${chs.length} бөлім · шамамен ${totalMin >= 60 ? `${Math.floor(totalMin / 60)} сағ ${totalMin % 60} мин` : totalMin + ' мин'} аудио</small>
      ${vs.length > 1 ? `<label>Нұсқа <select id="aVer">${vs.map(x => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
      <div class="seg" id="aEng"><button data-e="browser">Браузер дауысы</button><button data-e="cloud">Бұлттық дауыс (mp3)</button></div>
      <div id="aOpt"></div>
      <label>Жылдамдық <select id="aRate">${[.75, 1, 1.25, 1.5, 2].map(r => `<option value="${r}" ${r === rate ? 'selected' : ''}>${r}×</option>`).join('')}</select></label>
    </div>
    <div class="sec" id="aList"></div>
    <div class="player" id="aPlayer" hidden><div id="aNow" style="font-weight:600"></div><audio id="aud" controls></audio>
      <div class="row" id="aSpCtl"><button id="aPause">${ic('pause', 16)} Тоқтату</button><button id="aStop">${ic('stop', 16)}</button><span id="aProg" style="color:var(--mute)"></span></div></div>`;
  $('#aBack').onclick = () => { Q.stop = true; stopSpeech(); $('#aud').pause(); showBook(bookId); };
  $('#aVer') && ($('#aVer').onchange = e => { Q.stop = true; showAudio(bookId, e.target.value); });

  const drawOpt = () => {
    document.querySelectorAll('#aEng button').forEach(x => x.classList.toggle('on', x.dataset.e === engine));
    if (engine === 'browser') {
      const vl = voices();
      $('#aOpt').innerHTML = speechOK ? `<label>Дауыс <select id="aVoice">${vl.map(x => `<option value="${esc(x.voiceURI)}" ${x.voiceURI === localStorage.kVoice ? 'selected' : ''}>${esc(x.name)} (${esc(x.lang)})</option>`).join('')}</select></label>
        <small style="color:var(--mute)">${vl.some(x => x.lang.toLowerCase().startsWith('kk')) ? '' : 'Бұл құрылғыда қазақ дауысы жоқ: қазақша мәтін түрік немесе орыс дауысымен нашар оқылады. Сапалы нәтиже үшін «Бұлттық дауысты» таңда. '}Экран құлыпталғанда оқу тоқтауы мүмкін.</small>` : '<p>Бұл браузерде дауыс жоқ.</p>';
      $('#aVoice') && ($('#aVoice').onchange = e => localStorage.kVoice = e.target.value);
    } else {
      $('#aOpt').innerHTML = `<div class="row" style="align-items:flex-end"><label style="flex:1;margin:0">Дауыс <select id="aGender"><option value="f" ${gender === 'f' ? 'selected' : ''}>Әйел (Айгүл)</option><option value="m" ${gender === 'm' ? 'selected' : ''}>Ер (Дәулет)</option></select></label>
        <button id="aTry">${ic('volume', 16)} Тыңдап көру</button></div>
        <small style="color:var(--mute)">Әр бөлімнен mp3 жасалып, құрылғыда сақталады: кейін интернетсіз де тыңдайсың, файлды жүктеп алуға да болады. Жасау сервердегі дауыс қызметінің лимитін жейді.</small>`;
      $('#aGender').onchange = e => { gender = e.target.value; localStorage.kGender = gender; };
      $('#aTry').onclick = async e => {
        const btn = e.currentTarget; btn.disabled = true;
        try { const blob = await ttsPiece(chs[0].text.slice(0, 160), gender); const a = new Audio(URL.createObjectURL(blob)); a.playbackRate = rate; a.play(); }
        catch (err) { toast(err.message); }
        btn.disabled = false;
      };
    }
  };
  drawOpt();
  if (speechOK) speechSynthesis.onvoiceschanged = () => { if (engine === 'browser') drawOpt(); };
  $('#aEng').onclick = e => { const x = e.target.dataset.e; if (!x) return; engine = x; localStorage.kEngine = x; drawOpt(); drawList(); };
  $('#aRate').onchange = e => { rate = +e.target.value; localStorage.kRate = rate; $('#aud').playbackRate = rate; };

  const missing = () => chs.map((_, i) => i).filter(i => !files.has(i));
  const chars = idxs => idxs.reduce((a, i) => a + chs[i].text.length, 0);
  const drawList = () => {
    const miss = missing(), sel = [...picked].filter(i => !files.has(i));
    const bar = engine === 'cloud' ? (Q.running
      ? `<div class="prog"><i id="qf"></i></div><div class="row" style="justify-content:space-between"><small id="ql" style="color:var(--mute)"></small><button id="qStop">${ic('x', 16)} Тоқтату</button></div>`
      : `<div class="row" style="margin-bottom:.4rem"><button id="aSelAll">${ic('check', 16)} Барлығын таңдау</button>
          <button class="primary" id="aGoSel" ${sel.length ? '' : 'disabled'}>Таңдалғанды жасау (${sel.length})</button>
          <button id="aGoAll" ${miss.length ? '' : 'disabled'}>Қалғанын жасау (${miss.length})</button></div>
          ${miss.length ? `<small style="color:var(--mute)">Қалған ${miss.length} бөлім: ~${chars(miss).toLocaleString('kk')} таңба, ~${miss.reduce((a, i) => a + mins(i), 0)} мин аудио.</small>` : ''}`) : '';
    $('#aList').innerHTML = `<h3>Бөлімдер</h3>${bar}` + chs.map((c, i) => `<div class="ch ${i === cur ? 'now' : ''}" data-i="${i}">
      <div style="display:flex;gap:.6rem;align-items:center">${engine === 'cloud' && !files.has(i) ? `<input type="checkbox" data-c="${i}" style="width:auto" ${picked.has(i) ? 'checked' : ''} ${Q.running ? 'disabled' : ''}>` : ''}
        <div><b>${i + 1}. ${esc(c.title)}</b><br><small style="color:var(--mute)">~${mins(i)} мин${files.has(i) ? ` · ${ic('check', 13)} аудио файл бар` : ''}</small></div></div>
      <div class="row"><button class="primary" data-a="play" aria-label="Тыңдау">${ic('play', 16)}</button>
        ${files.has(i) ? `<button data-a="dl" aria-label="Жүктеп алу">${ic('download', 16)}</button><button class="danger" data-a="rm" aria-label="Файлды өшіру">${ic('trash', 16)}</button>` : (engine === 'cloud' ? `<button data-a="gen" ${Q.running ? 'disabled' : ''}>Жасау</button>` : '')}</div></div>`).join('');
    $('#aSelAll') && ($('#aSelAll').onclick = () => { miss.forEach(i => picked.add(i)); drawList(); });
    $('#aGoSel') && ($('#aGoSel').onclick = () => runQueue(sel));
    $('#aGoAll') && ($('#aGoAll').onclick = () => runQueue(miss));
    $('#qStop') && ($('#qStop').onclick = () => { Q.stop = true; $('#qStop').disabled = true; });
  };

  // Кезек: бөлімдерді бірінен соң бірін жасайды; жалпы прогресс пен тоқтату бар.
  const runQueue = async idxs => {
    const todo = idxs.filter(i => !files.has(i)), total = chars(todo);
    if (!todo.length) return;
    if (!confirm(`${todo.length} бөлім үшін ~${total.toLocaleString('kk')} таңба дауысқа айналады. Бұл қызмет лимитін жейді. Жалғастырамыз ба?`)) return;
    Q.running = true; Q.stop = false; drawList();
    let doneChars = 0, k = 0;
    for (const i of todo) {
      if (Q.stop) break;
      k++;
      try {
        const rec = await genAudio(v, i, chs[i].text, gender, (f, l) => {
          if (!$('#qf')) return;
          $('#qf').style.width = Math.round((doneChars + chs[i].text.length * f) / total * 100) + '%';
          $('#ql').textContent = `${k}/${todo.length} бөлім, «${chs[i].title}» ${l}`;
        }, Q);
        if (!rec) break;
        files.set(i, rec); picked.delete(i); doneChars += chs[i].text.length;
      } catch (err) { console.error(err); toast(`${i + 1}-бөлім: ${err.message}`); break; }
    }
    Q.running = false; toast(Q.stop ? 'Тоқтатылды' : 'Кезек аяқталды'); drawList();
  };

  const aud = $('#aud');
  const play = async i => {
    stopSpeech(); aud.pause(); cur = i;
    $('#aPlayer').hidden = false; $('#aNow').textContent = `${i + 1}. ${chs[i].title}`; drawList();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: chs[i].title, artist: b.author || '', album: b.title });
    if (engine === 'cloud') {
      const rec = files.get(i);
      if (!rec) { toast('Бұл бөлімнің аудиосы жоқ: «Жасау» бас'); return; }
      $('#aSpCtl').hidden = true; aud.hidden = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
      objUrl = URL.createObjectURL(rec.blob); aud.src = objUrl; aud.playbackRate = rate;
      const key = `kPos:${rec.id}`;
      aud.onloadedmetadata = () => { const t = +localStorage[key] || 0; if (t < aud.duration - 5) aud.currentTime = t; aud.playbackRate = rate; };
      aud.ontimeupdate = () => { if (Math.round(aud.currentTime) % 5 === 0) localStorage[key] = aud.currentTime; };
      aud.onended = () => { delete localStorage[key]; if (files.has(i + 1)) play(i + 1); };
      aud.play().catch(() => {});
    } else {
      aud.hidden = true; $('#aSpCtl').hidden = false; $('#aPause').innerHTML = `${ic('pause', 16)} Тоқтату`;
      const sel = voices().find(x => x.voiceURI === localStorage.kVoice) || voices()[0];
      speak(chs[i].text, { voice: sel, rate, onProg: p => $('#aProg').textContent = Math.round(p * 100) + '%', onEnd: () => { if (i + 1 < chs.length) play(i + 1); } });
    }
  };
  $('#aPause').onclick = () => {
    if (Sp.active) { const at = Sp.i; stopSpeech(); Sp.i = at; $('#aPause').innerHTML = `${ic('play', 16)} Жалғастыру`; }
    else if (cur >= 0) {
      const sel = voices().find(x => x.voiceURI === localStorage.kVoice) || voices()[0];
      speak(chs[cur].text, { voice: sel, rate, from: Sp.i, onProg: p => $('#aProg').textContent = Math.round(p * 100) + '%', onEnd: () => cur + 1 < chs.length && play(cur + 1) });
      $('#aPause').innerHTML = `${ic('pause', 16)} Тоқтату`;
    }
  };
  $('#aStop').onclick = () => { stopSpeech(); Sp.i = 0; $('#aPlayer').hidden = true; cur = -1; drawList(); };
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('previoustrack', () => cur > 0 && play(cur - 1));
    navigator.mediaSession.setActionHandler('nexttrack', () => cur + 1 < chs.length && play(cur + 1));
  }

  $('#aList').onchange = e => { const c = e.target.dataset.c; if (c != null) { e.target.checked ? picked.add(+c) : picked.delete(+c); drawList(); } };
  $('#aList').onclick = async e => {
    const btn = e.target.closest('[data-a]'), row = e.target.closest('.ch'); if (!btn || !row) return;
    const a = btn.dataset.a, i = +row.dataset.i;
    if (a === 'play') play(i);
    if (a === 'gen') runQueue([i]);
    if (a === 'dl') saveBlob(files.get(i).blob, fileName(b, i, chs[i]));
    if (a === 'rm' && confirm('Бұл бөлімнің аудио файлы өшеді.')) { await del('audio', files.get(i).id); files.delete(i); drawList(); }
  };
  drawList();
}
