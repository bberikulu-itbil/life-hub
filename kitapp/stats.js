'use strict';
/* Kitapp 4-кезең: оқу уақытын санау және аналитика беті. Сессиялар IndexedDB-дегі 'sessions' қоймасында. */

/* ---------- Оқу уақытын санау ---------- */
const T = { s: null, last: 0, tick: null };
const touchRead = () => { T.last = Date.now(); };

function flushTrack() {
  if (!T.s || T.s.secs < 10) return Promise.resolve(); // 10 секундтан қысқа сессия есепке алынбайды
  T.s.toPct = R.cur?.pct ?? T.s.toPct;
  return put('sessions', T.s);
}
function startTrack(b, v) {
  endTrack();
  const now = Date.now();
  T.s = { id: uid(), bookId: b.id, versionId: v.id, start: now, day: KS.dayKey(now), secs: 0, fromPct: v.pct || 0, toPct: v.pct || 0 };
  T.last = now;
  // Экран көрініп тұрғанда және соңғы 2 минутта әрекет болғанда ғана секунд санаймыз.
  T.tick = setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - T.last > 120000) return;
    if (++T.s.secs % 30 === 0) flushTrack();
  }, 1000);
}
async function endTrack() {
  clearInterval(T.tick);
  await flushTrack();
  T.s = null;
}
['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(ev => rEl.addEventListener(ev, touchRead, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushTrack());
addEventListener('pagehide', flushTrack);

/* ---------- Аналитика беті ---------- */
const WD = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];

async function showStats() {
  setNav('stats');
  const [ss, books, vs] = await Promise.all([all('sessions'), all('books'), all('versions')]);
  const S = KS.summarize(ss), now = Date.now();
  const goal = +(localStorage.kGoal || 20), range = +(localStorage.kRange || 14);

  const days = Array.from({ length: range }, (_, i) => { const k = KS.daysAgo(now, range - 1 - i); return { k, secs: S.byDay[k] || 0, d: new Date(k + 'T00:00') }; });
  const max = Math.max(goal * 60, ...days.map(d => d.secs), 1);
  const label = (x, i) => range <= 14 ? `${x.d.getDate()}<br>${WD[x.d.getDay()]}` : (i % Math.ceil(range / 10) === 0 ? x.d.getDate() : '');

  const per = books.map(b => {
    const mine = ss.filter(s => s.bookId === b.id), secs = mine.reduce((a, s) => a + s.secs, 0);
    const pct = Math.max(0, ...vs.filter(v => v.bookId === b.id).map(v => v.pct || 0));
    return { b, secs, n: mine.length, pct, eta: b.status === 'reading' ? KS.remaining(secs, pct) : null };
  }).filter(x => x.secs || x.b.status === 'reading').sort((a, c) => c.secs - a.secs);

  const cnt = s => books.filter(b => b.status === s).length;
  const year = String(new Date().getFullYear());
  const doneYear = books.filter(b => b.status === 'done' && (b.finishDate || '').startsWith(year)).length;
  const todayPct = Math.min(100, Math.round(S.today / (goal * 60) * 100));
  const stat = (v, l) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`;

  view.innerHTML = `
    <h2 style="margin:.2rem 0 1rem">${ic('chart', 22)} Оқу аналитикасы</h2>
    <div class="sec">
      <div class="row" style="justify-content:space-between"><b>Бүгінгі мақсат</b>
        <label style="margin:0">мин/күн <input id="goal" type="number" min="1" max="600" value="${goal}" style="width:5rem;display:inline-block"></label></div>
      <div class="bar-p" style="height:10px;border-radius:99px;margin:.5rem 0"><i style="width:${todayPct}%;border-radius:99px"></i></div>
      <small style="color:var(--mute)">${KS.fmtDur(S.today)} / ${goal} мин · ${todayPct >= 100 ? `мақсат орындалды ${ic('check-circle', 15)}` : `${todayPct}%`}</small>
    </div>
    <div class="stats">
      ${stat(KS.fmtDur(S.today), 'Бүгін')}${stat(KS.fmtDur(S.week), '7 күнде')}${stat(KS.fmtDur(S.month), '30 күнде')}
      ${stat(S.streak + ' күн', `${ic('flame', 14)} Қатарынан`)}${stat(KS.fmtDur(S.total), 'Барлығы')}${stat(KS.fmtDur(S.avg30), 'Орташа/күн (30)')}
      ${stat(KS.fmtDur(S.best), 'Ең жақсы күн')}${stat(cnt('done'), `Оқылған кітап (${year}: ${doneYear})`)}${stat(cnt('reading'), 'Оқып жатырмын')}
    </div>
    <div class="sec"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Күн сайынғы оқу</h3>
      <select id="range" style="width:auto">${[7, 14, 30, 90].map(r => `<option value="${r}" ${r === range ? 'selected' : ''}>${r} күн</option>`).join('')}</select></div>
      <div class="bars">${days.map(x => `<div class="col" title="${x.k}: ${KS.fmtDur(x.secs)}"><i style="height:${x.secs / max * 100}%"></i></div>`).join('')}<div class="goal" style="bottom:${goal * 60 / max * 100}%"></div></div>
      <div class="lbls">${days.map((x, i) => `<div>${label(x, i)}</div>`).join('')}</div>
      ${S.total ? '' : '<div class="empty">Деректер әлі жоқ. Кітапты оқи бастасаң, уақыт өзі есептеледі.</div>'}
    </div>
    <div class="sec"><h3>Кітаптар бойынша</h3>${per.length ? per.map(x => `
      <div class="ver" data-id="${x.b.id}" style="cursor:pointer"><div><b>${esc(x.b.title)}</b> <span class="badge">${STATUS[x.b.status]}</span><br>
        <small style="color:var(--mute)">${KS.fmtDur(x.secs)} · ${x.n} сессия · ${x.pct}% оқылды${x.eta ? ` · аяқтауға ~${KS.fmtDur(x.eta)}` : ''}</small></div>
        <div style="width:90px"><div class="bar-p"><i style="width:${x.pct}%"></i></div></div></div>`).join('') : '<div class="empty">Әлі оқылған кітап жоқ</div>'}</div>`;

  $('#goal').onchange = e => { localStorage.kGoal = Math.max(1, +e.target.value || 20); showStats(); };
  $('#range').onchange = e => { localStorage.kRange = e.target.value; showStats(); };
  view.querySelectorAll('.ver[data-id]').forEach(r => r.onclick = () => showBook(r.dataset.id));
}
