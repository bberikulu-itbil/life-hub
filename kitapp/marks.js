'use strict';
/* Kitapp: бетбелгілер (оқығышта — бет/орын, аудиода — бөлім/уақыт) және кітапты мерзімге дейін аяқтау мақсаты. */

const MARK_COLORS = ['#f5a524', '#3b6ef5', '#22a06b', '#e5484d', '#8e4ec6'];
const GOAL_ST = { ahead: ['Озып келесің', 'ok'], on: ['Жоспар бойынша', 'ok'], behind: ['Артта қалдың', 'warn'], late: ['Мерзім өтті', 'bad'], done: ['Орындалды', 'ok'] };

/* ---------- Бетбелгі терезесі ---------- */
function openMarkDlg(mark, after) {
  const D = $('#markDlg'), F = $('#markForm');
  let color = mark.color || MARK_COLORS[0];
  F.reset();
  F.elements.title.value = mark.title || ''; F.elements.note.value = mark.note || '';
  $('#mkLabel').innerHTML = `${ic(mark.kind === 'audio' ? 'headphones' : 'book-open', 13)} ${esc(mark.label)}${mark.chTitle ? ' · ' + esc(mark.chTitle) : ''}`;
  const drawColors = () => $('#mkColors').innerHTML = MARK_COLORS.map(c => `<button type="button" class="${c === color ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Түс"></button>`).join('');
  drawColors();
  $('#mkColors').onclick = e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) { color = c; drawColors(); } };
  $('#mkDel').hidden = !mark.id;
  $('#mkDel').onclick = async () => { await del('marks', mark.id); D.close(); toast('Бетбелгі өшірілді'); after?.(); };
  $('#mkCancel').onclick = () => D.close();
  F.onsubmit = async () => {
    await put('marks', { ...mark, id: mark.id || uid(), title: F.elements.title.value.trim(), note: F.elements.note.value.trim(), color, created: mark.created || Date.now() });
    toast('Бетбелгі сақталды'); after?.();
  };
  D.showModal();
}

function readerMark() {
  const pdf = R.kind === 'pdf', pct = R.cur?.pct || 0;
  openMarkDlg({ bookId: R.book.id, versionId: R.ver.id, kind: 'read', pos: pdf ? { page: R.page } : { cfi: R.cur?.pos?.cfi }, pct, label: pdf ? `бет ${R.page}` : `${pct}%` }, refreshNotes);
}
function audioMark() {
  if (!P.b) return;
  const t = pTimes()[0];
  openMarkDlg({ bookId: P.b.id, versionId: P.v.id, kind: 'audio', audio: { ci: P.i, t: paud.currentTime || 0, part: Sp.i }, label: `${P.i + 1}-бөлім · ${fmtT(t)}`, chTitle: P.chs[P.i].title, pct: Math.round(P.i / P.chs.length * 100) });
}

async function gotoMark(m) {
  const b = await get('books', m.bookId);
  if (!b) return toast('Кітап өшірілген');
  if (m.kind === 'audio') return Player.open(b, null, { vid: m.versionId, at: m.audio });
  if (!rEl.hidden && R.ver?.id === m.versionId) { // оқығыш ашық — бірден көшеміз
    if (R.kind === 'pdf') renderPdf(m.pos.page); else if (m.pos.cfi) R.rend.display(m.pos.cfi);
    $('#rPanel').hidden = true; return;
  }
  const v = await get('versions', m.versionId);
  if (!v) return toast('Бұл бетбелгінің нұсқасы өшірілген');
  openReader(b, { ...v, pos: m.pos });
}

const markRow = m => `<div class="mark" data-m="${m.id}"><i style="background:${m.color}"></i>
  <button class="mark-b" data-a="go"><b>${esc(m.title || m.label)}</b><small>${ic(m.kind === 'audio' ? 'headphones' : 'book-open', 12)} ${esc(m.label)}${m.chTitle ? ' · ' + esc(m.chTitle) : ''}</small>${m.note ? `<span>${esc(m.note)}</span>` : ''}</button>
  <button class="icon-btn" data-a="edit" aria-label="Өңдеу">${ic('edit', 16)}</button></div>`;

// Бетбелгілер тізімін қосып, басуды байланыстыру. after — өзгерістен кейін қайта сызу.
function bindMarks(box, marks, after) {
  box.onclick = e => {
    const row = e.target.closest('[data-m]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row || !a) return;
    const m = marks.find(x => x.id === row.dataset.m);
    a === 'go' ? gotoMark(m) : openMarkDlg(m, after);
  };
}

/* ---------- Мақсат: кітапты белгілі күнге дейін аяқтау ---------- */
async function goalInfo(b, pct) {
  if (!b.goal) return null;
  const secs = (await byBook('sessions', b.id)).reduce((a, s) => a + s.secs, 0);
  return KS.goalPlan(b.goal, pct, Date.now(), +b.pages || 0, secs);
}
const plusDays = n => KS.dayKey(Date.now() + n * 864e5);
// «...дейін» алдында барыс септігі
const MONTHS = ['қаңтарға', 'ақпанға', 'наурызға', 'сәуірге', 'мамырға', 'маусымға', 'шілдеге', 'тамызға', 'қыркүйекке', 'қазанға', 'қарашаға', 'желтоқсанға'];
// браузерлердің бәрінде қазақ айлары жоқ, сондықтан өзіміз жазамыз
const fmtDay = d => { const x = new Date(d + 'T12:00'); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };

function goalHTML(b, plan, pct) {
  if (!b.goal) return `<div class="glass sec goal"><h3>${ic('target', 18)} Мақсат</h3>
    <p class="muted">Кітапты қашан аяқтағың келеді? Күнделікті қанша оқу керегін есептеп, жоспардан қалсаң ескертеміз.</p>
    <div class="fwrap">${[[7, '1 апта'], [14, '2 апта'], [30, '1 ай'], [60, '2 ай']].map(([n, t]) => `<button class="fchip" data-gd="${n}">${t}</button>`).join('')}</div>
    <div class="row" style="margin-top:.6rem;flex-wrap:nowrap"><input type="date" id="gDate" min="${plusDays(1)}"><button class="primary" id="gSet">${ic('target', 16)} Қою</button></div></div>`;
  const [st, cls] = GOAL_ST[plan.status], per = [plan.pagesPerDay && `≈${Math.ceil(plan.pagesPerDay)} бет`, plan.minsPerDay && `≈${Math.ceil(plan.minsPerDay)} мин`].filter(Boolean).join(' · ');
  return `<div class="glass sec goal"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${ic('target', 18)} Мақсат</h3><span class="gchip ${cls}">${st}</span></div>
    <p><b>${fmtDay(b.goal.by)}</b> дейін аяқтау${plan.daysLeft > 0 ? ` · ${plan.daysLeft} күн қалды` : ''}</p>
    ${plan.status !== 'done' && plan.status !== 'late' ? `<div class="gbig">Күніне ~${Math.ceil(plan.pctPerDay)}%${per ? ` <small>(${per})</small>` : ''}</div>` : ''}
    ${plan.expected != null ? `<div class="gbar"><div class="bar-p"><i style="width:${pct}%"></i></div><span class="gmark" style="left:${Math.min(100, plan.expected)}%"></span></div><small class="muted">Қазір ${pct}% · жоспар бойынша ~${Math.round(plan.expected)}% болуы керек</small>` : ''}
    <div class="row end"><button class="ghost" id="gEdit">${ic('edit', 16)} Өзгерту</button><button class="ghost danger" id="gDel">${ic('trash', 16)} Өшіру</button></div></div>`;
}
function bindGoal(b, pct, after) {
  const setGoal = async by => { if (!by) return; b.goal = { by, set: Date.now(), p0: pct }; if (b.status === 'plan') applyStatus(b, 'reading'); await put('books', b); toast('Мақсат қойылды'); after(); };
  view.querySelectorAll('[data-gd]').forEach(x => x.onclick = () => setGoal(plusDays(+x.dataset.gd)));
  $('#gSet') && ($('#gSet').onclick = () => setGoal($('#gDate').value));
  $('#gEdit') && ($('#gEdit').onclick = async () => { delete b.goal; await put('books', b); after(); });
  $('#gDel') && ($('#gDel').onclick = async () => { if (!confirm('Мақсат өшеді.')) return; delete b.goal; await put('books', b); after(); });
}
