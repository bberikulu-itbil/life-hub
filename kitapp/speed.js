'use strict';
/* Kitapp: жылдам оқу. Жалпы жаттығу (Профиль: бастапқы өлшем, 6 кезең, еркін жаттығу, баптаулар) және оқығыштың ішіндегі жылдам оқу. */

const SP_DEF = { chapPause: 2, baseline: 200, family: 'serif', font: 56, orp: true, punct: 1, long: true, ramp: true, countdown: true, unlocked: 1, freeMode: 'rsvp', freePer: 1, freeWpm: 260, freeMins: 3 };
const FF = { serif: 'Georgia,"Times New Roman",serif', sans: 'system-ui,sans-serif', mono: 'ui-monospace,Menlo,monospace' };
const spGet = () => ({ ...SP_DEF, ...JSON.parse(localStorage.kSpeed || '{}') });
const spSet = o => { localStorage.kSpeed = JSON.stringify(o); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Бөлім басталатын сөз индексі -> {n, title}
function chapterMarks(v, firstOfPi) {
  const pis = Object.keys(firstOfPi).map(Number).sort((a, c) => a - c), m = new Map();
  (v.chapters || []).forEach((ch, n) => { const p = pis.find(x => x >= ch.from); if (p != null && !m.has(firstOfPi[p])) m.set(firstOfPi[p], { n: n + 1, title: ch.title }); });
  return m;
}
const markAt = (marks, i) => { let r = null; if (marks) for (const [k, m] of marks) if (k <= i && (!r || k > r.k)) r = { k, ...m }; return r; };

async function loadWords(v) {
  const cs = (await byBook('chunks', v.bookId)).filter(c => c.versionId === v.id).sort((a, b) => a.n - b.n);
  const words = [], firstOfPi = {};
  for (const c of cs) { if (!(c.pi in firstOfPi)) firstOfPi[c.pi] = words.length; words.push(...KSP.tokenize(c.text)); }
  return { words, firstOfPi };
}

/* ---------- Жаттығу терезесі ---------- */
function runDrill(cfg, words, start, S, done) {
  const WIN = 70, total = cfg.mins * 60000, o = KSP.opts(S.punct, S.long);
  const ov = document.createElement('div'); ov.className = 'sp-ov';
  ov.innerHTML = `<div class="sp-bar"><button id="spX" aria-label="Жабу">${ic('x')}</button><div class="sp-t"><b>${esc(cfg.title)}</b><small id="spC"></small></div><span id="spW" style="color:var(--mute)"></span><span style="flex:1"></span><button id="spM">−</button><button id="spP">+</button></div>
    <div class="sp-main" id="spMain" style="font-family:${FF[S.family]};font-size:${S.font}px"></div><div class="sp-ctx" id="spCtx"></div>
    <div class="sp-foot"><div class="bar-p"><i id="spBar" style="width:0"></i></div><div class="row" style="justify-content:center;margin-top:.6rem"><button id="spB" aria-label="10 сөз артқа">${ic('skip-back')} 10</button><button id="spPlay" class="primary" aria-label="Ойнату">${ic('play')}</button><button id="spF" aria-label="10 сөз алға">10 ${ic('skip-forward')}</button></div></div>`;
  document.body.append(ov);
  const q = s => ov.querySelector(s), main = q('#spMain');
  let i = start, maxI = start, adj = 0, playing = false, timer = 0, active = 0, seg = 0, gone = false, ws = -1, shown = start;
  const setCh = () => { const m = markAt(cfg.marks, i); q('#spC').textContent = m ? `${m.n}. ${m.title}` : ''; };

  const el = () => active + (playing ? Date.now() - seg : 0);
  const wpm = () => Math.max(60, (S.ramp ? KSP.rampWpm(cfg.from, cfg.to, el() / total) : cfg.from) + adj);

  const show = c => {
    if (cfg.mode === 'pacer') {
      if (ws < 0 || i < ws || i >= ws + WIN) { ws = i; main.innerHTML = `<div class="pacer" style="font-size:${Math.max(18, S.font / 2.4)}px">${words.slice(ws, ws + WIN).map((w, k) => `<span data-i="${ws + k}">${esc(w)}</span>`).join(' ')}</div>`; }
      main.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      for (let j = c.end - c.words.length; j < c.end; j++) main.querySelector(`[data-i="${j}"]`)?.classList.add('hl');
    } else if (c.words.length === 1 && S.orp) {
      const w = c.words[0], k = KSP.orp(w);
      main.innerHTML = `<div class="orp"><span class="l">${esc(w.slice(0, k))}</span><span class="p">${esc(w[k] || '')}</span><span class="r">${esc(w.slice(k + 1))}</span></div>`;
    } else main.innerHTML = `<div class="chunk">${esc(c.words.join(' '))}</div>`;
  };
  // cfg.book: оқығыштан ашылғанда жолақ кітаптағы орынды көрсетеді, уақыт шектеусіз
  const stat = () => { q('#spW').textContent = Math.round(wpm()) + ' сөз/мин'; q('#spBar').style.width = Math.min(100, (cfg.book ? i / words.length : el() / total) * 100) + '%'; };

  const step = () => {
    if (!playing || gone) return;
    if (el() >= total) return finish();
    // Жаңа бөлім басталғанда: бөлім атын көрсетіп, баптаудағы уақытқа кідіреміз
    const m = cfg.marks?.get(i);
    if (m && i !== shown) {
      shown = i; setCh();
      if (S.chapPause > 0) { main.innerHTML = `<div class="ch-card"><small>${m.n}-бөлім</small><b>${esc(m.title)}</b></div>`; timer = setTimeout(step, S.chapPause * 1000); return; }
    }
    const c = KSP.chunkAt(words, i, cfg.per, cfg.marks);
    if (!c) return finish();
    show(c); stat(); cfg.onStep?.();
    timer = setTimeout(() => { i = c.end; maxI = Math.max(maxI, i); step(); }, KSP.delayFor(c.words, wpm(), o));
  };
  const play = () => { playing = true; seg = Date.now(); q('#spPlay').innerHTML = ic('pause'); q('#spCtx').textContent = ''; step(); };
  const pause = () => {
    if (!playing) return;
    playing = false; clearTimeout(timer); active += Date.now() - seg; q('#spPlay').innerHTML = ic('play');
    if (cfg.mode !== 'pacer') q('#spCtx').innerHTML = words.slice(Math.max(start, i - 12), i + 24).map((w, k) => esc(w)).join(' ');
  };
  const jump = d => { i = Math.max(start, Math.min(words.length - 1, i + d)); shown = i; setCh(); const c = KSP.chunkAt(words, i, cfg.per, cfg.marks); if (c) { show(c); if (!playing) q('#spCtx').textContent = ''; } };
  const finish = () => {
    if (gone) return; pause(); gone = true; document.removeEventListener('keydown', onKey); ov.remove();
    const n = maxI - start, secs = active / 1000;
    done(n >= 20 && secs >= 3 ? { words: n, secs, wpm: n / (secs / 60), endIdx: maxI } : null);
  };
  const onKey = e => {
    if (e.key === ' ') { e.preventDefault(); playing ? pause() : play(); }
    if (e.key === 'ArrowLeft') jump(-10); if (e.key === 'ArrowRight') jump(10);
    if (e.key === 'Escape') finish();
  };
  document.addEventListener('keydown', onKey);
  setCh();
  q('#spX').onclick = finish; q('#spPlay').onclick = () => playing ? pause() : play();
  q('#spB').onclick = () => jump(-10); q('#spF').onclick = () => jump(10);
  q('#spM').onclick = () => { adj -= 10; stat(); }; q('#spP').onclick = () => { adj += 10; stat(); };
  main.onclick = () => playing ? pause() : play();
  (async () => {
    if (S.countdown) for (const n of [3, 2, 1]) { main.innerHTML = `<div class="chunk">${n}</div>`; await sleep(700); if (gone) return; }
    play();
  })();
}

/* Бастапқы өлшем: жай оқып, уақытты өлшейміз. Мәтін «Бастау» басқанда ғана көрінеді. */
function runBaseline(words, start, done) {
  const seg = words.slice(start, start + 200);
  const ov = document.createElement('div'); ov.className = 'sp-ov';
  ov.innerHTML = `<div class="sp-bar"><button id="bX" aria-label="Жабу">${ic('x')}</button><b>Бастапқы өлшем</b></div>
    <div class="sp-main" style="padding:1rem;overflow:auto"><div id="bBody" class="pacer" style="font-size:1.15rem">Әдеттегідей, түсініп оқы. «Бастау» бас, оқып бітіргенде «Бітірдім» бас.</div></div>
    <div class="sp-foot"><div class="row" style="justify-content:center"><button class="primary" id="bGo">Бастау</button></div></div>`;
  document.body.append(ov);
  let t0 = 0; const q = s => ov.querySelector(s);
  q('#bX').onclick = () => { ov.remove(); done(null); };
  q('#bGo').onclick = () => {
    if (!t0) { t0 = Date.now(); q('#bBody').textContent = seg.join(' '); q('#bGo').textContent = 'Бітірдім'; return; }
    const secs = (Date.now() - t0) / 1000; ov.remove();
    done({ words: seg.length, secs, wpm: seg.length / (secs / 60), endIdx: start + seg.length });
  };
}

/* ---------- Оқығыштағы жылдам оқу: ағымдағы беттен бастап, жалпы баптаулармен ---------- */
async function readerSpeed() {
  const b = R.book, v = R.ver;
  if (!isReady(v)) {
    toast('Мәтін дайындалуда, бір сәт…');
    try { await indexVersion(b, v); } catch (err) { return toast(err.message); }
  }
  const { words, firstOfPi } = await loadWords(v);
  if (!words.length) return toast('Бұл файлда мәтін табылмады');
  const pis = Object.keys(firstOfPi).map(Number).sort((a, c) => a - c);
  const here = R.kind === 'pdf' ? R.page - 1 : (R.rend?.currentLocation()?.start?.index ?? 0);
  const start = firstOfPi[pis.find(p => p >= here)] ?? 0;
  const S = spGet();
  runDrill({ title: 'Жылдам оқу', mode: S.freeMode, per: S.freePer, from: S.freeWpm, to: S.freeWpm, mins: 24 * 60, book: true, onStep: touchRead, marks: chapterMarks(v, firstOfPi) }, words, start, { ...S, ramp: false }, async res => {
    if (!res) return;
    await put('drills', { id: uid(), bookId: b.id, versionId: v.id, ts: Date.now(), stage: -2, name: `Оқығышта: ${b.title}`, mode: S.freeMode, per: S.freePer, wpm: Math.round(res.wpm), words: res.words, secs: Math.round(res.secs), comp: null });
    // Оқығышты жылдам оқу тоқтаған жерге көшіру
    const pi = pis.filter(p => firstOfPi[p] <= res.endIdx).pop() ?? here;
    if (R.kind === 'pdf') renderPdf(pi + 1);
    else { const it = R.book_epub?.spine.get(pi); if (it) R.rend.display(it.href); }
    toast(`${Math.round(res.wpm)} сөз/мин · ${res.words} сөз`);
  });
}

/* ---------- Жалпы жылдам оқу жаттығуы (Профиль бөлімінде) ---------- */
async function showSpeed() {
  setNav('profile'); view.dataset.page = 'speed';
  const [books, allVs] = await Promise.all([all('books'), all('versions')]);
  const title = id => books.find(x => x.id === id)?.title || '';
  const vsSorted = allVs.filter(v => title(v.bookId)).sort((a, c) => title(a.bookId).localeCompare(title(c.bookId), 'kk'));
  if (!vsSorted.length) {
    view.innerHTML = `<button class="back" id="sBack">${ic('back', 22)} Профиль</button><header class="hd"><h1>Жылдам оқу</h1></header>
      <div class="glass sec"><p>Жаттығу кітап мәтінімен жүреді. Алдымен кітапханаға кем дегенде бір кітап қос.</p><button class="primary" id="sAdd">${ic('plus', 16)} Кітап қосу</button></div>`;
    $('#sBack').onclick = showProfile; $('#sAdd').onclick = openAdd;
    return;
  }
  const cur = currentBook(books);
  const want = vsSorted.find(v => v.id === localStorage.kSpeedSrc) || vsSorted.find(v => v.bookId === cur?.id && isReady(v)) || vsSorted.find(isReady) || vsSorted[0];
  const b = books.find(x => x.id === want.bookId);
  const v = await withPrepared(b, want.id, () => showSpeed(), () => showProfile(), 'жылдам оқу жаттығуы');
  if (!v) return;
  localStorage.kSpeedSrc = v.id;
  const { words, firstOfPi } = await loadWords(v);
  const drills = (await all('drills')).sort((a, c) => c.ts - a.ts);
  const S = spGet(), stages = KSP.stagesFor(S.baseline);
  const pis = Object.keys(firstOfPi).map(Number).sort((a, c) => a - c);
  const chStart = ch => firstOfPi[pis.find(p => p >= ch.from)] ?? 0;
  const posPct = Math.round((v.speedPos || 0) / Math.max(1, words.length) * 100);
  const best = Math.max(0, ...drills.filter(d => d.comp >= 3).map(d => d.wpm));
  const sel = (id, opts, c) => `<select id="${id}">${opts.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(c) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const compTxt = d => d.comp == null ? 'оқығышта' : `түсіну ${d.comp}/5`;
  const recent = drills.slice(0, 20).reverse(), top = Math.max(1, ...recent.map(x => x.wpm));

  view.innerHTML = `
    <button class="back" id="sBack">${ic('back', 22)} Профиль</button>
    <header class="hd"><h1>Жылдам оқу</h1></header>
    <div class="stats"><div class="stat"><b>${S.baseline}</b><small>Бастапқы қарқын (сөз/мин)</small></div><div class="stat"><b>${best || '—'}</b><small>Ең жақсы (түсінумен)</small></div>
      <div class="stat"><b>${Math.min(S.unlocked, 6)}/6</b><small>Ашылған кезең</small></div><div class="stat"><b>${drills.length}</b><small>Жаттығу саны</small></div></div>
    <div class="glass sec"><h3>${ic('book-open', 18)} Жаттығу мәтіні</h3>
      <label>Кітап ${sel('sSrc', vsSorted.map(x => [x.id, `${title(x.bookId)} · ${x.name}${isReady(x) ? '' : ' (дайындалмаған)'}`]), v.id)}</label>
      <label>Қайдан бастау
        <select id="sFrom"><option value="pos">Тоқтаған жерден (${posPct}%)</option><option value="0">Басынан</option>${(v.chapters || []).map((c, i) => `<option value="c${i}">${i + 1}. ${esc(c.title)}</option>`).join('')}</select></label>
      <small class="muted">Кез келген кітапты оқығышта ашып, жоғарғы ${ic('zap', 13)} батырмасымен де жылдам оқуға болады.</small>
    </div>
    <div class="glass sec"><h3>Кезеңдер</h3>
      <div class="ver"><div><b>0. Бастапқы өлшем</b><br><small class="muted">Жай оқып, өз қарқыныңды өлшейміз. Кезеңдер осыған қарай есептеледі</small></div><button data-s="0">Өлшеу</button></div>
      ${stages.map(s => `<div class="ver"><div><b>${s.id}. ${s.title}</b> ${s.id < S.unlocked ? `<span class="badge">${ic('check', 13)}</span>` : ''}<br><small class="muted">${s.desc} · ${s.from}–${s.to} сөз/мин · ${s.mins} мин</small></div>
        <button class="${s.id <= S.unlocked ? 'primary' : ''}" data-s="${s.id}" ${s.id > S.unlocked ? 'disabled' : ''}>${s.id > S.unlocked ? ic('lock', 16) : 'Бастау'}</button></div>`).join('')}
      <small class="muted">Келесі кезең ашылуы үшін: кезеңді аяқтап, түсінуді кемінде 3/5 деп бағала.</small>
    </div>
    <div class="glass sec"><h3>Еркін жаттығу және оқығыш</h3><small class="muted">Бұл мәндер оқығыштағы жылдам оқуда да қолданылады.</small><div class="fgrid">
      <label>Режим ${sel('fMode', [['rsvp', 'Сөз-сөзден (RSVP)'], ['pacer', 'Нұсқаушы (мәтін көрінеді)']], S.freeMode)}</label>
      <label>Бір мезгілде сөз ${sel('fPer', [1, 2, 3, 4].map(n => [n, n]), S.freePer)}</label>
      <label>Қарқын (сөз/мин) <input id="fWpm" type="number" min="80" max="1200" step="10" value="${S.freeWpm}"></label>
      <label>Жаттығу ұзақтығы (мин) ${sel('fMins', [1, 2, 3, 5, 10].map(n => [n, n]), S.freeMins)}</label></div>
      <button class="primary" id="fGo">${ic('play', 16)} Еркін жаттығуды бастау</button></div>
    <div class="glass sec"><h3>Баптаулар</h3>
      <div class="fgrid">
        <label>Қаріп ${sel('oFam', [['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']], S.family)}</label>
        <label>Қаріп өлшемі (px) <input id="oFont" type="number" min="24" max="120" step="4" value="${S.font}"></label>
        <label>Тыныс белгіде кідіру ${sel('oPunct', [[0, 'Жоқ'], [1, 'Қалыпты'], [2, 'Ұзақ']], S.punct)}</label>
        <label>Ұзын сөзде баяулату ${sel('oLong', [[1, 'Иә'], [0, 'Жоқ']], +S.long)}</label>
        <label>Кезеңде қарқын біртіндеп өсуі ${sel('oRamp', [[1, 'Иә'], [0, 'Жоқ']], +S.ramp)}</label>
        <label>Ұстау әрпін бөлектеу (1 сөз) ${sel('oOrp', [[1, 'Иә'], [0, 'Жоқ']], +S.orp)}</label>
        <label>Бастар алдында 3-2-1 ${sel('oCount', [[1, 'Иә'], [0, 'Жоқ']], +S.countdown)}</label>
        <label>Бөлім аяқталғанда кідіріс ${sel('oChap', [[0, 'Жоқ'], [1, '1 сек'], [2, '2 сек'], [3, '3 сек'], [5, '5 сек'], [8, '8 сек']], S.chapPause)}</label>
        <label>Бастапқы қарқынды қолмен қою <input id="oBase" type="number" min="80" max="700" step="10" value="${S.baseline}"></label></div>
      <button class="ghost danger" id="oReset">${ic('refresh', 16)} Кезеңдерді басынан бастау</button></div>
    <div class="glass sec"><h3>Тарих</h3>${drills.length ? `<div class="bars" style="height:90px">${recent.map(d => `<div class="col" title="${new Date(d.ts).toLocaleDateString('kk')} · ${d.wpm} сөз/мин · ${compTxt(d)}"><i style="height:${d.wpm / top * 100}%;opacity:${d.comp == null || d.comp >= 3 ? 1 : .35}"></i></div>`).join('')}</div>
      <small class="muted">Соңғы 20 жаттығудың қарқыны; түсіну 3/5-тен төмен болса баған күңгірт.</small>` +
      drills.slice(0, 10).map(d => `<div class="note"><small>${new Date(d.ts).toLocaleDateString('kk')} · ${esc(d.name)}${d.stage !== -2 ? ` · ${esc(title(d.bookId))}` : ''}</small><div>${d.wpm} сөз/мин · ${d.words} сөз · ${compTxt(d)}</div></div>`).join('') : '<div class="empty">Әлі жаттығу жоқ. Бастапқы өлшемнен баста.</div>'}</div>`;

  $('#sBack').onclick = showProfile;
  $('#sSrc').onchange = e => { localStorage.kSpeedSrc = e.target.value; showSpeed(); };
  const startIdx = () => { const f = $('#sFrom').value; return f === 'pos' ? (v.speedPos || 0) : f === '0' ? 0 : chStart(v.chapters[+f.slice(1)]); };
  const save = () => {
    Object.assign(S, { family: $('#oFam').value, font: +$('#oFont').value || 56, punct: +$('#oPunct').value, long: $('#oLong').value === '1', ramp: $('#oRamp').value === '1', orp: $('#oOrp').value === '1', countdown: $('#oCount').value === '1', chapPause: +$('#oChap').value, baseline: Math.max(80, +$('#oBase').value || 200),
      freeMode: $('#fMode').value, freePer: +$('#fPer').value, freeWpm: Math.max(60, +$('#fWpm').value || 260), freeMins: +$('#fMins').value });
    spSet(S);
  };
  ['oFam', 'oFont', 'oPunct', 'oLong', 'oRamp', 'oOrp', 'oCount', 'oChap', 'oBase', 'fMode', 'fPer', 'fWpm', 'fMins'].forEach(id => $('#' + id).onchange = () => { const b0 = S.baseline; save(); if (S.baseline !== b0) showSpeed(); });
  $('#oReset').onclick = () => { if (confirm('Ашылған кезеңдер жабылып, 1-кезеңнен басталады. Тарих сақталады.')) { S.unlocked = 1; spSet(S); showSpeed(); } };

  const after = cfg => async res => {
    if (!res) return showSpeed();
    view.innerHTML = `<div class="glass sec"><h3>${esc(cfg.title)}: нәтиже</h3>
      <div class="stats"><div class="stat"><b>${Math.round(res.wpm)}</b><small>сөз/мин</small></div><div class="stat"><b>${res.words}</b><small>сөз</small></div><div class="stat"><b>${KS.fmtDur(res.secs)}</b><small>уақыт</small></div></div>
      <p>Оқығаныңның қаншасын түсіндің?</p><div class="seg" id="comp">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}">${n}</button>`).join('')}</div>
      <small class="muted">1 = ештеңе түсінбедім, 5 = бәрін түсіндім. Адал баға қарқынды дұрыс өсіруге көмектеседі.</small></div>`;
    $('#comp').onclick = async e => {
      const comp = +e.target.closest('[data-n]')?.dataset.n; if (!comp) return;
      await put('drills', { id: uid(), bookId: b.id, versionId: v.id, ts: Date.now(), stage: cfg.id ?? -1, name: cfg.title, mode: cfg.mode, per: cfg.per, wpm: Math.round(res.wpm), words: res.words, secs: Math.round(res.secs), comp });
      v.speedPos = res.endIdx % words.length; await put('versions', v);
      const s2 = spGet();
      if (cfg.baseline) { if (comp >= 3) s2.baseline = Math.max(80, Math.min(700, Math.round(res.wpm / 10) * 10)); else toast('Түсіну төмен: өлшемді қайталап көр'); }
      else if (cfg.id === s2.unlocked && cfg.id < 6 && comp >= 3) { s2.unlocked++; toast(`${cfg.id + 1}-кезең ашылды`); }
      spSet(s2); showSpeed();
    };
  };
  const marks = chapterMarks(v, firstOfPi);
  const launch = cfg => runDrill({ ...cfg, marks }, words, startIdx(), spGet(), after(cfg));
  view.querySelectorAll('[data-s]').forEach(btn => btn.onclick = () => {
    save(); const n = +btn.dataset.s;
    if (n === 0) return runBaseline(words, startIdx(), r => after({ title: 'Бастапқы өлшем', baseline: true, mode: 'static', per: 0 })(r));
    launch(stages[n - 1]);
  });
  $('#fGo').onclick = () => { save(); launch({ title: 'Еркін жаттығу', mode: S.freeMode, per: S.freePer, from: S.freeWpm, to: Math.round(S.freeWpm * 1.3), mins: S.freeMins }); };
}
