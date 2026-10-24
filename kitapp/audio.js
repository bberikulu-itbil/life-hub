'use strict';
/* Kitapp 3-кезең: аудио. Екі жол: (1) браузердің ішкі дауысы, файлсыз, (2) бұлттық дауыс: бөлім бойынша mp3 жасап, құрылғыда сақтау. */

const Sp = { gen: 0, i: 0, parts: [], active: false };
const speechOK = 'speechSynthesis' in window;

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

async function chapterTexts(v) {
  const cs = (await byBook('chunks', v.bookId)).filter(c => c.versionId === v.id).sort((a, b) => a.n - b.n);
  return v.chapters.map(ch => cs.filter(c => c.pi >= ch.from && c.pi <= ch.to).map(c => c.text).join(' '));
}

async function genAudio(v, ci, text, gender, onProg) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Алдымен Life Hub-қа кір');
  const pieces = RAG.chunkText(text, 3500), blobs = [];
  for (let i = 0; i < pieces.length; i++) {
    onProg(`${i + 1}/${pieces.length}`);
    const res = await fetch(`${SB_URL}/functions/v1/book-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SB_KEY },
      body: JSON.stringify({ text: pieces[i], gender }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    blobs.push(await res.blob());
  }
  const rec = { id: `${v.id}:${ci}`, bookId: v.bookId, versionId: v.id, ci, gender, created: Date.now(), blob: new Blob(blobs, { type: 'audio/mpeg' }) };
  await put('audio', rec);
  return rec;
}

async function showAudio(bookId, versionId) {
  setNav('lib');
  const b = await get('books', bookId);
  const vs = (await byBook('versions', bookId)).filter(v => v.chapters?.length);
  const v = vs.find(x => x.id === versionId) || vs[0];
  stopSpeech();
  if (!v) {
    view.innerHTML = `<button class="ghost" id="aBack">← Кітапқа</button><div class="sec"><h3>🎧 ${esc(b.title)}</h3>
      <p>Аудио бөлімдер мәтіннен жасалады. Алдымен чат бетінде нұсқаның мәтінін дайында (бұрын дайындаған болсаң, «Қайта дайындау» бас: бөлімдер сонда жасалады).</p>
      <button class="primary" id="aGo">💬 Мәтінді дайындауға өту</button></div>`;
    $('#aBack').onclick = () => showBook(bookId); $('#aGo').onclick = () => showChat(bookId);
    return;
  }
  const texts = await chapterTexts(v);
  const files = new Map((await byBook('audio', bookId)).filter(a => a.versionId === v.id).map(a => [a.ci, a]));
  let engine = localStorage.kEngine || 'browser', gender = localStorage.kGender || 'f', rate = +(localStorage.kRate || 1), cur = -1, objUrl = null;
  const voices = () => getVoices();

  view.innerHTML = `
    <button class="ghost" id="aBack">← Кітапқа</button>
    <div class="sec"><h3>🎧 ${esc(b.title)}</h3>
      ${vs.length > 1 ? `<label>Нұсқа <select id="aVer">${vs.map(x => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
      <div class="seg" id="aEng"><button data-e="browser">Браузер дауысы</button><button data-e="cloud">Бұлттық дауыс (mp3)</button></div>
      <div id="aOpt"></div>
      <label>Жылдамдық <select id="aRate">${[.75, 1, 1.25, 1.5, 2].map(r => `<option value="${r}" ${r === rate ? 'selected' : ''}>${r}×</option>`).join('')}</select></label>
    </div>
    <div class="sec" id="aList"></div>
    <div class="player" id="aPlayer" hidden><div id="aNow" style="font-weight:600"></div><audio id="aud" controls></audio>
      <div class="row" id="aSpCtl"><button id="aPause">⏸ Тоқтату</button><button id="aStop">⏹</button><span id="aProg" style="color:var(--mute)"></span></div></div>`;
  $('#aBack').onclick = () => { stopSpeech(); $('#aud').pause(); showBook(bookId); };
  $('#aVer') && ($('#aVer').onchange = e => showAudio(bookId, e.target.value));

  const drawOpt = () => {
    document.querySelectorAll('#aEng button').forEach(x => x.classList.toggle('on', x.dataset.e === engine));
    if (engine === 'browser') {
      const vl = voices();
      $('#aOpt').innerHTML = speechOK ? `<label>Дауыс <select id="aVoice">${vl.map(x => `<option value="${esc(x.voiceURI)}" ${x.voiceURI === localStorage.kVoice ? 'selected' : ''}>${esc(x.name)} (${esc(x.lang)})</option>`).join('')}</select></label>
        <small style="color:var(--mute)">${vl.some(x => x.lang.toLowerCase().startsWith('kk')) ? '' : 'Бұл құрылғыда қазақ дауысы жоқ: қазақша мәтін түрік немесе орыс дауысымен нашар оқылады. Сапалы нәтиже үшін «Бұлттық дауысты» таңда. '}Экран құлыпталғанда оқу тоқтауы мүмкін.</small>` : '<p>Бұл браузерде дауыс жоқ.</p>';
      $('#aVoice') && ($('#aVoice').onchange = e => localStorage.kVoice = e.target.value);
    } else {
      $('#aOpt').innerHTML = `<label>Дауыс <select id="aGender"><option value="f" ${gender === 'f' ? 'selected' : ''}>Әйел (Айгүл)</option><option value="m" ${gender === 'm' ? 'selected' : ''}>Ер (Дәулет)</option></select></label>
        <small style="color:var(--mute)">Әр бөлімнен mp3 жасалып, құрылғыда сақталады: кейін интернетсіз де тыңдайсың. Жасау сервердегі дауыс қызметінің лимитін жейді.</small>`;
      $('#aGender').onchange = e => { gender = e.target.value; localStorage.kGender = gender; };
    }
  };
  drawOpt();
  if (speechOK) speechSynthesis.onvoiceschanged = () => { if (engine === 'browser') drawOpt(); };
  $('#aEng').onclick = e => { const x = e.target.dataset.e; if (!x) return; engine = x; localStorage.kEngine = x; drawOpt(); drawList(); };
  $('#aRate').onchange = e => { rate = +e.target.value; localStorage.kRate = rate; $('#aud').playbackRate = rate; };

  const mins = i => Math.max(1, Math.round(texts[i].length / 800));
  const drawList = () => {
    const total = texts.reduce((a, t, i) => a + (files.has(i) ? 0 : t.length), 0);
    $('#aList').innerHTML = `<h3>Бөлімдер</h3>` + v.chapters.map((c, i) => `<div class="ch ${i === cur ? 'now' : ''}" data-i="${i}">
      <div><b>${i + 1}. ${esc(c.title)}</b><br><small style="color:var(--mute)">~${mins(i)} мин${files.has(i) ? ' · ✓ аудио файл бар' : ''}</small></div>
      <div class="row"><button class="primary" data-a="play" ${!texts[i] ? 'disabled' : ''}>▶</button>${engine === 'cloud' ? `<button data-a="gen" ${!texts[i] ? 'disabled' : ''}>${files.has(i) ? 'Қайта жасау' : 'Жасау'}</button>` : ''}${files.has(i) ? '<button class="danger" data-a="rm">✕</button>' : ''}</div></div>`).join('')
      + (engine === 'cloud' && total ? `<div class="row end" style="margin-top:.6rem"><button id="aAll">Барлығын жасау (${total.toLocaleString('kk')} таңба)</button></div>` : '');
    $('#aAll') && ($('#aAll').onclick = async () => {
      if (!confirm(`${v.chapters.filter((_, i) => !files.has(i)).length} бөлім үшін ~${total.toLocaleString('kk')} таңба дауысқа айналады. Бұл қызмет лимитін жейді. Жалғастырамыз ба?`)) return;
      for (let i = 0; i < v.chapters.length; i++) if (!files.has(i) && texts[i]) { if (!(await make(i))) break; }
    });
  };

  const make = async i => {
    const btn = document.querySelector(`.ch[data-i="${i}"] [data-a=gen]`); if (btn) btn.disabled = true;
    try { files.set(i, await genAudio(v, i, texts[i], gender, p => { if (btn) btn.textContent = `Жасалуда ${p}`; })); toast(`${i + 1}-бөлім дайын`); drawList(); return true; }
    catch (err) { console.error(err); toast(err.message); drawList(); return false; }
  };

  const aud = $('#aud');
  const play = async i => {
    stopSpeech(); aud.pause(); cur = i;
    $('#aPlayer').hidden = false; $('#aNow').textContent = `${i + 1}. ${v.chapters[i].title}`; drawList();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: v.chapters[i].title, artist: b.author || '', album: b.title });
    if (engine === 'cloud') {
      const rec = files.get(i) || (confirm('Бұл бөлімнің аудиосы жоқ. Қазір жасаймыз ба?') && (await make(i)) && files.get(i));
      if (!rec) return;
      $('#aSpCtl').hidden = true; aud.hidden = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
      objUrl = URL.createObjectURL(rec.blob); aud.src = objUrl; aud.playbackRate = rate;
      const key = `kPos:${rec.id}`;
      aud.onloadedmetadata = () => { const t = +localStorage[key] || 0; if (t < aud.duration - 5) aud.currentTime = t; aud.playbackRate = rate; };
      aud.ontimeupdate = () => { if (Math.round(aud.currentTime) % 5 === 0) localStorage[key] = aud.currentTime; };
      aud.onended = () => { delete localStorage[key]; const n = [...files.keys()].filter(k => k > i).sort((a, c) => a - c)[0]; if (n === i + 1) play(n); };
      aud.play().catch(() => {});
    } else {
      aud.hidden = true; $('#aSpCtl').hidden = false; $('#aPause').textContent = '⏸ Тоқтату';
      const sel = voices().find(x => x.voiceURI === localStorage.kVoice) || voices()[0];
      speak(texts[i], { voice: sel, rate, onProg: p => $('#aProg').textContent = Math.round(p * 100) + '%', onEnd: () => { if (i + 1 < texts.length && texts[i + 1]) play(i + 1); } });
    }
  };
  $('#aPause').onclick = () => {
    if (Sp.active) { const at = Sp.i; stopSpeech(); Sp.i = at; $('#aPause').textContent = '▶ Жалғастыру'; }
    else if (cur >= 0) { const sel = voices().find(x => x.voiceURI === localStorage.kVoice) || voices()[0]; speak(texts[cur], { voice: sel, rate, from: Sp.i, onProg: p => $('#aProg').textContent = Math.round(p * 100) + '%', onEnd: () => cur + 1 < texts.length && play(cur + 1) }); $('#aPause').textContent = '⏸ Тоқтату'; }
  };
  $('#aStop').onclick = () => { stopSpeech(); Sp.i = 0; $('#aPlayer').hidden = true; cur = -1; drawList(); };
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('previoustrack', () => cur > 0 && play(cur - 1));
    navigator.mediaSession.setActionHandler('nexttrack', () => cur + 1 < texts.length && play(cur + 1));
  }

  $('#aList').onclick = async e => {
    const a = e.target.dataset.a, row = e.target.closest('.ch'); if (!a || !row) return;
    const i = +row.dataset.i;
    if (a === 'play') play(i);
    if (a === 'gen') { if (!files.has(i) || confirm('Бар аудио қайта жасалады. Жалғастырамыз ба?')) await make(i); }
    if (a === 'rm' && confirm('Бұл бөлімнің аудио файлы өшеді.')) { await del('audio', files.get(i).id); files.delete(i); drawList(); }
  };
  drawList();
}
