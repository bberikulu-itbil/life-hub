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

const view = $('#view');

/* ---------- Кітап беті ---------- */
const INFO = [['pages', 'Бет саны'], ['year', 'Шыққан жылы'], ['isbn', 'ISBN'], ['publisher', 'Баспа'], ['lang', 'Тілі'], ['genre', 'Жанры'], ['source', 'Қайдан алынды'], ['startDate', 'Оқи бастаған күні'], ['finishDate', 'Аяқтаған күні']];

async function showBook(id) {
  if (['home', 'library', 'list', 'groups'].includes(view.dataset.page)) showBook.back = rerender; // «Артқа» осы бетке қайтарады
  setNav('lib'); view.dataset.page = 'book'; rerender = () => showBook(id);
  const b = await get('books', id);
  if (!b) return showLibrary();
  const [vs, notes, ks, recs, books] = await Promise.all([byBook('versions', id), byBook('notes', id), get('konspekt', id), byBook('audio', id), all('books')]);
  notes.sort((a, c) => c.created - a.created);
  vs.sort((a, c) => verOrder(a) - verOrder(c));
  const rv = vs.filter(isReady), av = rv.find(x => recs.some(r => r.versionId === x.id)) || rv[0];
  const clean = vs.find(x => x.kind === 'clean'), src = vs.find(x => x.type === 'pdf') || vs.find(x => x.kind === 'original') || vs[0];
  const chs = av ? await audioChapters(av) : [];
  const dur = (c, i) => recs.find(r => r.versionId === av.id && r.ci === i)?.dur || estSecs(c.text);
  const totalAudio = chs.reduce((a, c, i) => a + dur(c, i), 0);
  const pct = bookPct(b, vs);
  const mine = new Set(authorsOf(b)), others = books.filter(x => x.id !== id && authorsOf(x).some(a => mine.has(a)));
  const info = INFO.map(([k, t]) => [t, k === 'lang' ? LANGS[b.lang] : b[k]]).filter(([, v]) => v).concat((b.tags || []).length ? [['Сөрелер', b.tags.map(t => '#' + t).join(' ')]] : []);
  const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  const hh = Math.floor(totalAudio / 3600), mm = Math.round(totalAudio % 3600 / 60);

  view.innerHTML = `
    <div class="bk-top"><button class="back" id="back">${ic('back', 22)} Артқа</button><button class="icon-btn glass" id="bMenu" aria-label="Мәзір">${ic('more', 22)}</button></div>
    <div class="bk-hero">
      <div class="bk-cv">${coverHTML(b, 'cv-lg')}</div>
      <h1>${esc(b.title)}</h1>
      <div class="bk-au">${authorsOf(b).map(a => `<button class="link" data-au="${esc(a)}">${esc(a)}</button>`).join(', ') || '<span>Автор көрсетілмеген</span>'}</div>
      <div class="bk-stats">
        ${b.pages ? stat(b.pages, 'бет') : ''}${b.year ? stat(b.year, 'жыл') : ''}
        ${chs.length ? stat(hh ? `${hh} сағ ${mm} мин` : `${mm} мин`, ic('headphones', 16)) : ''}
        ${stat(pct + '%', 'оқылды')}
      </div>
      <div class="bk-act"><button class="primary big" id="bRead">${ic('book-open', 20)} Оқу</button><button class="glass big" id="bListen">${ic('headphones', 20)} Тыңдау</button></div>
      <div class="bk-more">
        <button class="chip glass" id="speedBtn">${ic('zap', 16)} Жылдам оқу</button>
        <button class="chip glass" id="chatBtn">${ic('chat', 16)} ЖИ-мен талқылау</button>
        <button class="chip glass" id="audioBtn">${ic('music', 16)} Аудио жасау</button>
      </div>
      <div class="bk-st">
        <div class="seg glass" id="bs">${Object.entries(STATUS).map(([k, v]) => `<button data-s="${k}" class="${b.status === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <span class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="${n <= (b.rating || 0) ? 'on' : ''}" aria-label="${n} жұлдыз">${ic('star', 24, n <= (b.rating || 0))}</button>`).join('')}</span>
      </div>
    </div>

    <div class="glass sec"><h3>Сипаттама</h3>${b.summary ? `<p class="clamp" id="sum">${esc(b.summary)}</p><button class="link" id="sumMore">Толығырақ</button>`
      : `<p class="muted">Сипаттама жоқ. Жоғарғы ${ic('more', 14)} мәзірінен «Өңдеу» арқылы қос.</p>`}</div>

    ${!clean && src ? `<div class="glass sec tip">${ic('layers', 22)}<div><b>Таза нұсқа жасау</b><small>Тыңдау мен жылдам оқу үшін бет нөмірлерісіз, колонтитулсыз, тараулары бөлінген EPUB кітап.</small></div><button class="primary" id="convBtn">Жасау</button></div>` : ''}

    <div class="glass sec"><h3>Бөлімдер${chs.length ? ` · ${chs.length}` : ''}</h3>${chs.length ? `
      <div class="chlist" id="chs">${chs.map((c, i) => `<button class="lrow ${i >= 4 ? 'more' : ''}" data-i="${i}"><em class="num">${i + 1}</em><span>${esc(c.title)}</span><em>${fmtT(dur(c, i))}</em></button>`).join('')}</div>
      ${chs.length > 4 ? '<button class="link center" id="chAll">Барлығын көру</button>' : ''}`
      : vs.length ? `<p class="muted">Бөлімдерді көру және тыңдау үшін кітап мәтінін бір рет дайындау керек.</p><button id="prepBtn">${ic('layers', 16)} Мәтінді дайындау</button>`
      : '<p class="muted">Кітапқа әлі файл қосылмаған.</p>'}</div>

    ${others.length ? `<div class="sec bare"><h3>Автордың басқа кітаптары</h3><div class="hscroll">${others.map(x => `<button class="mini-card" data-b="${x.id}">${coverHTML(x)}<span>${esc(x.title)}</span></button>`).join('')}</div></div>` : ''}

    ${info.length ? `<div class="glass sec"><h3>Ақпарат</h3><dl class="info">${info.map(([t, v]) => `<div><dt>${t}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>` : ''}

    <div class="glass sec"><h3>Нұсқалар</h3><div id="vers">${vs.length ? vs.map(v => `
      <div class="ver" data-id="${v.id}">
        <div><b>${esc(v.name)}</b> <span class="badge">${v.type.toUpperCase()}</span>${v.kind ? ` <span class="badge">${KIND[v.kind]}</span>` : ''}<br><small class="muted">${mb(v.blob.size)} · ${v.pct || 0}% оқылды${isReady(v) ? ' · мәтін дайын' : ''}</small></div>
        <div class="row"><button class="primary" data-a="open">${ic('book-open', 16)} Оқу</button><button class="icon-btn" data-a="vmenu" aria-label="Нұсқа мәзірі">${ic('more', 20)}</button></div>
      </div>`).join('') : `<div class="empty">Нұсқа жоқ. Жоғарғы ${ic('more', 16)} мәзірінен «Нұсқа қосу» таңда.</div>`}</div>
    </div>

    <div class="glass sec"><h3>Конспект</h3>
      <textarea id="ks" rows="8" placeholder="Кітап бойынша өз конспектің…">${esc(ks?.text || '')}</textarea>
      <div class="row end" style="margin-top:.5rem"><span id="ksSt" class="muted" style="font-size:.85rem"></span><button id="ksExp">${ic('download', 16)} .md жүктеу</button></div>
    </div>
    <div class="glass sec"><h3>Ескертпелер</h3>${notes.length ? notes.map(n => `
      <div class="note" data-id="${n.id}"><small>${esc(n.ref)} · ${esc(n.vname || '')}</small><div>${esc(n.text).replace(/\n/g, '<br>')}</div><button class="ghost danger" data-a="dn">${ic('trash', 14)} жою</button></div>`).join('') : '<div class="empty">Оқығанда оқығыштағы «Ескертпелер» батырмасы арқылы қосасың</div>'}</div>
`;

  $('#back').onclick = () => (showBook.back || showLibrary)();
  $('#bMenu').onclick = e => bookMenu(id, e.currentTarget);
  $('#bRead').onclick = () => continueReading(b);
  $('#bListen').onclick = () => Player.open(b);
  $('#chatBtn').onclick = () => showChat(id);
  $('#audioBtn').onclick = () => showAudio(id);
  $('#speedBtn').onclick = () => continueReading(b, true);
  $('#convBtn') && ($('#convBtn').onclick = () => showConvert(b, src, () => showBook(id)));
  $('#prepBtn') && ($('#prepBtn').onclick = () => renderPrep(b, vs.find(x => x.kind === 'original') || vs[0], () => showBook(id), () => showBook(id), 'бөлімдер'));
  $('#sumMore') && ($('#sumMore').onclick = e => { $('#sum').classList.toggle('clamp'); e.target.textContent = $('#sum').classList.contains('clamp') ? 'Толығырақ' : 'Жасыру'; });
  $('#chAll') && ($('#chAll').onclick = e => { $('#chs').classList.add('open'); e.target.remove(); });
  $('#chs') && ($('#chs').onclick = e => { const r = e.target.closest('[data-i]'); if (r) Player.open(b, +r.dataset.i); });
  view.querySelectorAll('[data-au]').forEach(x => x.onclick = () => { showList.q = ''; showList('author', x.dataset.au); });
  view.querySelectorAll('[data-b]').forEach(x => x.onclick = () => showBook(x.dataset.b));
  $('#bs').onclick = async e => { const s = e.target.closest('[data-s]')?.dataset.s; if (!s || s === b.status) return; applyStatus(b, s); await put('books', b); showBook(id); };
  $('#stars').onclick = async e => { const n = +e.target.closest('[data-n]')?.dataset.n; if (!n) return; b.rating = n === b.rating ? 0 : n; await put('books', b); showBook(id); };
  $('#vers').onclick = e => {
    const btn = e.target.closest('[data-a]'), row = e.target.closest('.ver'); if (!btn || !row) return;
    const v = vs.find(x => x.id === row.dataset.id);
    if (btn.dataset.a === 'open') openReader(b, v);
    if (btn.dataset.a === 'vmenu') versionMenu(v, btn);
  };
  let t;
  $('#ks').oninput = e => {
    $('#ksSt').textContent = 'жазылуда…'; clearTimeout(t);
    t = setTimeout(async () => { await put('konspekt', { bookId: id, text: e.target.value, updated: Date.now() }); $('#ksSt').textContent = 'сақталды'; }, 600);
  };
  $('#ksExp').onclick = () => {
    const body = `# ${b.title}\n${b.author ? `_${b.author}_\n` : ''}\n${$('#ks').value}\n\n## Ескертпелер\n${notes.map(n => `- (${n.ref}) ${n.text.replace(/\n/g, ' ')}`).join('\n')}\n`;
    saveBlob(new Blob([body], { type: 'text/markdown' }), `${b.title}.md`);
  };
  view.querySelectorAll('[data-a=dn]').forEach(btn => btn.onclick = async () => { await del('notes', btn.closest('.note').dataset.id); showBook(id); });
  scrollTo(0, 0);
}

/* ---------- Кітап қосу ---------- */
const dlg = $('#addDlg');
const openAdd = () => { $('#addForm').reset(); dlg.showModal(); };
$('#addCancel').onclick = () => dlg.close();
$('#addForm').querySelector('[name=file]').onchange = e => {
  const f = e.target.files[0], t = $('#addForm [name=title]');
  if (f && !t.value) t.value = f.name.replace(/\.[^.]+$/, '');
};
$('#addForm').onsubmit = async e => {
  const d = new FormData(e.target), id = uid(), files = [...e.target.file.files], typed = d.get('title').trim();
  const b = { id, title: typed || files[0]?.name.replace(/\.[^.]+$/, '') || 'Атаусыз кітап', titleAuto: !typed, author: d.get('author').trim(), status: 'plan', rating: 0, added: Date.now() };
  await put('books', b);
  await addVersions(id, files, d.get('vname').trim());
  if (!files.length) return showBook(id);
  toast('Мұқаба мен ақпарат оқылуда…'); await enrichBook(b).catch(() => {});
  autoConvert(b, () => showBook(id));
};

/* ---------- Оқығыш ---------- */
const R = { book: null, ver: null, kind: null, pdf: null, rend: null, page: 1, total: 1, font: 100, zoom: 1 };
const rEl = $('#reader'), stage = $('#rStage');

async function openReader(b, v) {
  Object.assign(R, { book: b, ver: v, kind: v.type, font: +(localStorage.kFont || 100) });
  $('#rTitle').textContent = `${b.title} · ${v.name}`;
  stage.innerHTML = ''; rEl.hidden = false; $('#rPanel').hidden = true;
  if (b.status === 'plan') applyStatus(b, 'reading');
  b.lastOpened = Date.now(); b.lastVersion = v.id; put('books', b);
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
  R.rend.themes.override('color', dark ? '#e9edf5' : '#1b2130');
  R.rend.themes.override('background', dark ? '#161b26' : '#fbfbfd');
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
$('#rSpeed').onclick = () => readerSpeed();
$('#rNotes').onclick = () => { const p = $('#rPanel'); p.hidden = !p.hidden; };
$('#rClose').onclick = async () => {
  clearTimeout(pT);
  if (R.cur) { R.ver.pos = R.cur.pos; R.ver.pct = R.cur.pct; await put('versions', R.ver); }
  await endTrack();
  if (R.rend) { R.rend.destroy(); R.rend = null; }
  if (R.pdf) { R.pdf.destroy(); R.pdf = null; }
  rEl.hidden = true; stage.innerHTML = ''; rerender();
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

/* ---------- Тақырып (жүйе / жарық / қараңғы), PWA ---------- */
function applyTheme() {
  const t = localStorage.kTheme || 'system';
  const d = t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
  document.documentElement.dataset.theme = d;
  document.querySelector('meta[name=theme-color]').content = d === 'dark' ? '#1a2030' : '#eef1f7';
  applyEpubTheme();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.storage?.persist?.(); // iOS/Chrome-ға деректерді өздігінен өшірмеуді сұрау

/* ---------- Мәзір (телефонда төменде, компьютерде сол жақта) ---------- */
function setNav(v) {
  document.querySelectorAll('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  view.dataset.page = ''; closeMenu();
  setTimeout(updateMini); // бет өз атын (view.dataset.page) қойғаннан кейін
}
$('#nav').onclick = e => {
  const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
  ({ home: showHome, lib: showLibrary, stats: showStats, chat: () => showChat(null), profile: showProfile })[v]();
  scrollTo(0, 0);
};

addEventListener('DOMContentLoaded', () => openDB().then(showHome));
