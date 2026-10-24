'use strict';
/* Kitapp 1-кезең: кітапхана, PDF/EPUB оқығыш, нұсқалар, конспект, ескертпелер. Деректер IndexedDB-де. */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const STATUS = { plan: 'Жоспарда', reading: 'Оқып жатырмын', done: 'Оқыдым' };

/* ---------- IndexedDB ---------- */
let db;
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('kitapp', 5);
  r.onupgradeneeded = () => {
    const d = r.result;
    // Әр қойма жоқ болса ғана құрылады, сондықтан кез келген ескі нұсқадан көтерілуге болады.
    const mk = (n, key, idx) => { if (!d.objectStoreNames.contains(n)) { const o = d.createObjectStore(n, { keyPath: key }); if (idx) o.createIndex(idx, idx); } };
    mk('books', 'id'); mk('versions', 'id', 'bookId'); mk('notes', 'id', 'bookId'); mk('konspekt', 'bookId');
    mk('chunks', 'id', 'bookId'); mk('chats', 'bookId'); mk('audio', 'id', 'bookId'); mk('sessions', 'id', 'bookId'); mk('drills', 'id', 'bookId');
  };
  r.onsuccess = () => { db = r.result; res(); };
  r.onerror = () => rej(r.error);
});
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const st = (n, m = 'readonly') => db.transaction(n, m).objectStore(n);
const put = (n, v) => rq(st(n, 'readwrite').put(v));
const get = (n, k) => rq(st(n).get(k));
const all = n => rq(st(n).getAll());
const byBook = (n, id) => rq(st(n).index('bookId').getAll(id));
const del = (n, k) => rq(st(n, 'readwrite').delete(k));

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2200);
}
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const cover = t => `background:linear-gradient(160deg,hsl(${hue(t)} 45% 38%),hsl(${(hue(t) + 40) % 360} 50% 28%))`;
const typeOf = f => (f.name.toLowerCase().endsWith('.epub') || f.type === 'application/epub+zip') ? 'epub' : 'pdf';

/* ---------- Кітапхана ---------- */
const view = $('#view');
let filter = { q: '', status: '' };

async function showLibrary() {
  setNav('lib');
  const [books, versions] = await Promise.all([all('books'), all('versions')]);
  books.sort((a, b) => b.added - a.added);
  view.innerHTML = `
    <div class="bar">
      <input id="q" placeholder="Кітап немесе автор іздеу…" value="${esc(filter.q)}">
      <select id="fs"><option value="">Барлығы</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${filter.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div>
    <div class="grid" id="grid"></div>`;
  const draw = () => {
    const q = filter.q.toLowerCase();
    const list = books.filter(b => (!filter.status || b.status === filter.status) && (`${b.title} ${b.author} ${b.genre || ''} ${(b.tags || []).join(' ')}`.toLowerCase().includes(q)));
    $('#grid').innerHTML = list.length ? list.map(b => {
      const vs = versions.filter(v => v.bookId === b.id);
      const pct = Math.max(0, ...vs.map(v => v.pct || 0));
      return `<div class="card" data-id="${b.id}"><button class="kebab card-k" data-k="${b.id}" aria-label="Мәзір">⋮</button>
        <div class="cover" style="${cover(b.title)}">${esc(b.title)}</div>
        <div class="bar-p"><i style="width:${pct}%"></i></div>
        <div class="meta">${esc(b.author || '—')}<br><span class="badge">${STATUS[b.status]}</span> · ${vs.length} нұсқа</div></div>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1">${books.length ? 'Ештеңе табылмады' : 'Кітапхана бос. «+ Кітап қосу» батырмасын бас.'}</div>`;
  };
  draw();
  $('#q').oninput = e => { filter.q = e.target.value; draw(); };
  $('#fs').onchange = e => { filter.status = e.target.value; draw(); };
  $('#grid').onclick = e => { const k = e.target.closest('.kebab'); if (k) return bookMenu(k.dataset.k, k); const c = e.target.closest('.card'); if (c) showBook(c.dataset.id); };
}

/* ---------- Кітап беті ---------- */
async function showBook(id) {
  setNav('lib');
  const b = await get('books', id);
  if (!b) return showLibrary();
  const [vs, notes, ks] = await Promise.all([byBook('versions', id), byBook('notes', id), get('konspekt', id)]);
  notes.sort((a, c) => c.created - a.created);
  view.innerHTML = `
    <button class="ghost" id="back">← Кітапхана</button>
    <div class="sec">
      <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="flex:1;min-width:0"><h2 style="margin:0;word-break:break-word">${esc(b.title)}</h2>
        <div style="color:var(--mute)">${esc(b.author || 'Автор көрсетілмеген')}</div></div>
        <button class="kebab" id="bMenu" aria-label="Мәзір">⋮</button></div>
      <div class="chips">${chips(b)}</div>
      ${b.summary ? `<p style="margin:.6rem 0 0">${esc(b.summary)}</p>` : ''}
      <div class="row" style="margin-top:.6rem">
        <select id="bs" style="width:auto">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <span class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="${n <= (b.rating || 0) ? 'on' : ''}">★</button>`).join('')}</span>
      </div>
    </div>
    <div class="row"><button class="primary" id="chatBtn" style="flex:1;min-width:130px">💬 ЖИ-мен талқылау</button><button class="primary" id="audioBtn" style="flex:1;min-width:130px">🎧 Аудио</button><button class="primary" id="speedBtn" style="flex:1;min-width:130px">⚡ Жылдам оқу</button></div>
    <div class="sec"><h3>Нұсқалар</h3><div id="vers">${vs.length ? vs.map(v => `
      <div class="ver" data-id="${v.id}">
        <div><b>${esc(v.name)}</b> <span class="badge">${v.type.toUpperCase()}</span><br><small style="color:var(--mute)">${(v.blob.size / 1048576).toFixed(1)} МБ · ${v.pct || 0}% оқылды</small></div>
        <div class="row"><button class="primary" data-a="open">Оқу</button><button data-a="ren">Атауы</button><button class="danger" data-a="del">✕</button></div>
      </div>`).join('') : '<div class="empty">Нұсқа жоқ</div>'}</div>
      <button id="addVer" style="margin-top:.6rem">+ Нұсқа қосу</button>
      <input type="file" id="verFile" accept=".pdf,.epub" multiple hidden>
    </div>
    <div class="sec"><h3>Конспект</h3>
      <textarea id="ks" rows="10" placeholder="Кітап бойынша өз конспектің…">${esc(ks?.text || '')}</textarea>
      <div class="row end" style="margin-top:.5rem"><span id="ksSt" style="color:var(--mute);font-size:.85rem"></span><button id="ksExp">.md жүктеу</button></div>
    </div>
    <div class="sec"><h3>Ескертпелер</h3>${notes.length ? notes.map(n => `
      <div class="note" data-id="${n.id}"><small>${esc(n.ref)} · ${esc(n.vname || '')}</small><div>${esc(n.text).replace(/\n/g, '<br>')}</div><button class="ghost danger" data-a="dn">жою</button></div>`).join('') : '<div class="empty">Оқығанда 📝 арқылы қосасың</div>'}</div>
`;

  $('#back').onclick = showLibrary;
  $('#chatBtn').onclick = () => showChat(id);
  $('#audioBtn').onclick = () => showAudio(id);
  $('#speedBtn').onclick = () => showSpeed(id);
  const save = async p => { Object.assign(b, p); await put('books', b); };
  $('#bMenu').onclick = e => bookMenu(id, e.currentTarget);
  $('#bs').onchange = async e => { applyStatus(b, e.target.value); await put('books', b); showBook(id); };
  $('#stars').onclick = async e => { const n = +e.target.dataset.n; if (!n) return; await save({ rating: n === b.rating ? 0 : n }); showBook(id); };
  $('#addVer').onclick = () => $('#verFile').click();
  $('#verFile').onchange = async e => { await addVersions(id, [...e.target.files]); showBook(id); };
  $('#vers').onclick = async e => {
    const a = e.target.dataset.a, row = e.target.closest('.ver'); if (!a || !row) return;
    const v = vs.find(x => x.id === row.dataset.id);
    if (a === 'open') openReader(b, v);
    if (a === 'ren') { const n = prompt('Нұсқа аты', v.name); if (n) { v.name = n.trim(); await put('versions', v); showBook(id); } }
    if (a === 'del' && confirm('Бұл нұсқаны жоямыз ба?')) { await dropChunks(id, v.id); await del('versions', v.id); showBook(id); }
  };
  let t;
  $('#ks').oninput = e => {
    $('#ksSt').textContent = 'жазылуда…'; clearTimeout(t);
    t = setTimeout(async () => { await put('konspekt', { bookId: id, text: e.target.value, updated: Date.now() }); $('#ksSt').textContent = 'сақталды'; }, 600);
  };
  $('#ksExp').onclick = () => {
    const body = `# ${b.title}\n${b.author ? `_${b.author}_\n` : ''}\n${$('#ks').value}\n\n## Ескертпелер\n${notes.map(n => `- (${n.ref}) ${n.text.replace(/\n/g, ' ')}`).join('\n')}\n`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }));
    a.download = `${b.title}.md`; a.click(); URL.revokeObjectURL(a.href);
  };
  view.querySelectorAll('[data-a=dn]').forEach(btn => btn.onclick = async () => { await del('notes', btn.closest('.note').dataset.id); showBook(id); });
}

async function addVersions(bookId, files, vname) {
  for (const f of files) {
    const type = typeOf(f);
    await put('versions', { id: uid(), bookId, name: vname || f.name.replace(/\.[^.]+$/, '') || type.toUpperCase(), type, blob: f, pos: null, pct: 0, added: Date.now() });
  }
  if (files.length) toast('Нұсқа қосылды');
}

/* ---------- Кітап қосу ---------- */
const dlg = $('#addDlg');
$('#addBtn').onclick = () => { $('#addForm').reset(); dlg.showModal(); };
$('#addCancel').onclick = () => dlg.close();
$('#addForm').querySelector('[name=file]').onchange = e => {
  const f = e.target.files[0], t = $('#addForm [name=title]');
  if (f && !t.value) t.value = f.name.replace(/\.[^.]+$/, '');
};
$('#addForm').onsubmit = async e => {
  const d = new FormData(e.target), id = uid();
  await put('books', { id, title: d.get('title').trim(), author: d.get('author').trim(), status: 'plan', rating: 0, added: Date.now() });
  await addVersions(id, [...e.target.file.files], d.get('vname').trim());
  showBook(id);
};
$('#home').onclick = showLibrary;

/* ---------- Оқығыш ---------- */
const R = { book: null, ver: null, kind: null, pdf: null, rend: null, page: 1, total: 1, font: 100, zoom: 1 };
const rEl = $('#reader'), stage = $('#rStage');

async function openReader(b, v) {
  Object.assign(R, { book: b, ver: v, kind: v.type, font: +(localStorage.kFont || 100) });
  $('#rTitle').textContent = `${b.title} · ${v.name}`;
  stage.innerHTML = ''; rEl.hidden = false; $('#rPanel').hidden = true;
  if (b.status === 'plan') { applyStatus(b, 'reading'); put('books', b); }
  startTrack(b, v);
  const buf = await v.blob.arrayBuffer();
  try {
    if (v.type === 'pdf') await openPdf(buf); else await openEpub(buf);
  } catch (err) { console.error(err); stage.innerHTML = `<div class="empty">Файлды ашу мүмкін болмады: ${esc(err.message)}</div>`; }
  refreshNotes();
}

async function openPdf(buf) {
  R.pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  R.total = R.pdf.numPages;
  const s = $('#rSlider'); s.min = 1; s.max = R.total;
  await renderPdf(Math.min(R.ver.pos?.page || 1, R.total));
}
async function renderPdf(n) {
  R.page = Math.max(1, Math.min(R.total, n));
  const p = await R.pdf.getPage(R.page);
  const w = Math.min(stage.clientWidth - 16, 1000) * R.zoom;
  const vp0 = p.getViewport({ scale: 1 }), sc = w / vp0.width, dpr = window.devicePixelRatio || 1;
  const vp = p.getViewport({ scale: sc * dpr });
  let c = stage.querySelector('canvas');
  if (!c) { stage.innerHTML = '<canvas></canvas>'; c = stage.querySelector('canvas'); }
  c.width = vp.width; c.height = vp.height; c.style.width = vp.width / dpr + 'px';
  await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  stage.scrollTop = 0;
  progress({ page: R.page }, Math.round(R.page / R.total * 100), `${R.page} / ${R.total}`);
  $('#rSlider').value = R.page;
}

async function openEpub(buf) {
  const book = ePub(buf);
  stage.innerHTML = '<div class="epub"></div>';
  R.rend = book.renderTo(stage.firstChild, { width: '100%', height: '100%', flow: 'paginated', spread: 'none' });
  R.rend.themes.fontSize(R.font + '%');
  applyEpubTheme();
  R.rend.on('relocated', loc => {
    const pct = book.locations.length() ? Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100) : (R.ver.pct || 0);
    progress({ cfi: loc.start.cfi }, pct, pct + '%');
    $('#rSlider').value = pct;
  });
  const s = $('#rSlider'); s.min = 0; s.max = 100;
  await R.rend.display(R.ver.pos?.cfi || undefined);
  book.ready.then(() => book.locations.generate(1200)).then(() => {
    if (R.rend?.currentLocation()?.start) { const pct = Math.round(book.locations.percentageFromCfi(R.rend.currentLocation().start.cfi) * 100); progress({ cfi: R.rend.currentLocation().start.cfi }, pct, pct + '%'); }
  });
  R.book_epub = book;
}
function applyEpubTheme() {
  if (!R.rend) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  R.rend.themes.override('color', dark ? '#e8ece9' : '#1d2421');
  R.rend.themes.override('background', dark ? '#121614' : '#f6f4ef');
}

let pT;
function progress(pos, pct, label) {
  touchRead();
  $('#rPosText').textContent = label;
  R.cur = { pos, pct, label };
  clearTimeout(pT);
  pT = setTimeout(async () => { R.ver.pos = pos; R.ver.pct = pct; await put('versions', R.ver); }, 400);
}

const go = d => R.kind === 'pdf' ? renderPdf(R.page + d) : (d > 0 ? R.rend.next() : R.rend.prev());
$('#rNext').onclick = () => go(1);
$('#rPrev').onclick = () => go(-1);
$('#rSlider').onchange = e => {
  const v = +e.target.value;
  if (R.kind === 'pdf') renderPdf(v);
  else if (R.book_epub?.locations.length()) R.rend.display(R.book_epub.locations.cfiFromPercentage(v / 100));
};
$('#rPlus').onclick = () => zoom(1);
$('#rMinus').onclick = () => zoom(-1);
function zoom(d) {
  if (R.kind === 'epub') { R.font = Math.max(70, Math.min(220, R.font + d * 10)); localStorage.kFont = R.font; R.rend.themes.fontSize(R.font + '%'); }
  else { R.zoom = Math.max(.6, Math.min(3, R.zoom + d * .2)); renderPdf(R.page); }
}
$('#rNotes').onclick = () => { const p = $('#rPanel'); p.hidden = !p.hidden; };
$('#rClose').onclick = async () => {
  clearTimeout(pT);
  if (R.cur) { R.ver.pos = R.cur.pos; R.ver.pct = R.cur.pct; await put('versions', R.ver); }
  await endTrack();
  if (R.rend) { R.rend.destroy(); R.rend = null; }
  if (R.pdf) { R.pdf.destroy(); R.pdf = null; }
  rEl.hidden = true; stage.innerHTML = ''; showBook(R.book.id);
};
document.addEventListener('keydown', e => {
  if (rEl.hidden || /TEXTAREA|INPUT/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
  if (e.key === 'Escape') $('#rClose').click();
});

async function refreshNotes() {
  const ns = (await byBook('notes', R.book.id)).sort((a, b) => b.created - a.created);
  $('#rNoteList').innerHTML = ns.map(n => `<div class="note"><small>${esc(n.ref)}</small><div>${esc(n.text).replace(/\n/g, '<br>')}</div></div>`).join('');
}
$('#rNoteSave').onclick = async () => {
  const t = $('#rNoteText').value.trim(); if (!t) return;
  await put('notes', { id: uid(), bookId: R.book.id, vname: R.ver.name, text: t, ref: R.kind === 'pdf' ? `бет ${R.page}` : (R.cur?.label || ''), created: Date.now() });
  $('#rNoteText').value = ''; refreshNotes(); toast('Ескертпе сақталды');
};

/* ---------- Тақырып, PWA ---------- */
const theme = localStorage.kTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;
$('#themeBtn').onclick = () => {
  const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = n; localStorage.kTheme = n; applyEpubTheme();
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.(); // iOS/Chrome-ға деректерді өздігінен өшірмеуді сұрау

/* ---------- Мәзір (телефонда төменде, компьютерде сол жақта) ---------- */
const setNav = v => document.querySelectorAll('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
$('#nav').onclick = e => {
  const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
  $('#aud')?.pause(); if (typeof stopSpeech === 'function') stopSpeech(); // көрініс ауысқанда аудио қалып қоймасын
  ({ lib: showLibrary, stats: showStats, chat: () => showChat(null) })[v]();
};

addEventListener('DOMContentLoaded', () => openDB().then(showLibrary));
