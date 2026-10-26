'use strict';
/* Kitapp 1-кезең: кітапхана, PDF/EPUB оқығыш, нұсқалар, конспект, ескертпелер. Деректер IndexedDB-де. */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/lib/pdf.worker.min.js';

const APP_VERSION = '0.8.1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const STATUS = { plan: 'Жоспарда', reading: 'Оқып жатырмын', done: 'Оқыдым' };

/* ---------- IndexedDB ---------- */
let db;
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('kitapp', 6);
  r.onupgradeneeded = () => {
    const d = r.result;
    // Әр қойма жоқ болса ғана құрылады, сондықтан кез келген ескі нұсқадан көтерілуге болады.
    const mk = (n, key, idx) => { if (!d.objectStoreNames.contains(n)) { const o = d.createObjectStore(n, { keyPath: key }); if (idx) o.createIndex(idx, idx); } };
    mk('books', 'id'); mk('versions', 'id', 'bookId'); mk('notes', 'id', 'bookId'); mk('konspekt', 'bookId');
    mk('chunks', 'id', 'bookId'); mk('chats', 'bookId'); mk('audio', 'id', 'bookId'); mk('sessions', 'id', 'bookId'); mk('drills', 'id', 'bookId'); mk('marks', 'id', 'bookId');
  };
  r.onsuccess = () => { db = r.result; res(); };
  r.onerror = () => rej(r.error);
});
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const st = (n, m = 'readonly') => db.transaction(n, m).objectStore(n);
// бұлтқа сақталатын қоймалардағы өзгеріс кітапты «жіберілуі керек» деп белгілейді (cloud.js)
const put = (n, v) => rq(st(n, 'readwrite').put(v)).then(r => { if (SYNC_STORES.includes(n)) cloudDirty(n === 'books' ? v.id : v.bookId); return r; });
const get = (n, k) => rq(st(n).get(k));
const all = n => rq(st(n).getAll());
const byBook = (n, id) => rq(st(n).index('bookId').getAll(id));
const del = async (n, k) => { const b = SYNC_STORES.includes(n) && n !== 'books' ? (n === 'konspekt' ? k : (await get(n, k))?.bookId) : null; const r = await rq(st(n, 'readwrite').delete(k)); if (b) cloudDirty(b); return r; };

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
  const [vs, notes, ks, recs, books, marks] = await Promise.all([byBook('versions', id), byBook('notes', id), get('konspekt', id), byBook('audio', id), all('books'), byBook('marks', id)]);
  marks.sort((a, c) => (a.pct || 0) - (c.pct || 0) || a.created - c.created);
  notes.sort((a, c) => c.created - a.created);
  vs.sort((a, c) => verOrder(a) - verOrder(c));
  const rv = vs.filter(isReady), av = rv.find(x => recs.some(r => r.versionId === x.id)) || rv[0];
  const clean = vs.find(x => x.kind === 'clean'), src = vs.find(x => x.type === 'pdf') || vs.find(x => x.kind === 'original') || vs[0];
  const chs = av ? await audioChapters(av) : [];
  const dur = (c, i) => recs.find(r => r.versionId === av.id && r.ci === i)?.dur || estSecs(c.text);
  const totalAudio = chs.reduce((a, c, i) => a + dur(c, i), 0);
  const pct = bookPct(b, vs), plan = await goalInfo(b, pct);
  const ser = b.series ? seriesBooks(books, b.series) : [];
  const mine = new Set(authorsOf(b)), others = books.filter(x => x.id !== id && !ser.includes(x) && authorsOf(x).some(a => mine.has(a)));
  const info = INFO.map(([k, t]) => [t, k === 'lang' ? LANGS[b.lang] : b[k]]).filter(([, v]) => v).concat((b.tags || []).length ? [['Сөрелер', b.tags.map(t => '#' + t).join(' ')]] : []);
  const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  const hh = Math.floor(totalAudio / 3600), mm = Math.round(totalAudio % 3600 / 60);

  view.innerHTML = `
    <div class="bk-top"><button class="back" id="back">${ic('back', 22)} Артқа</button><button class="icon-btn glass" id="bMenu" aria-label="Мәзір">${ic('more', 22)}</button></div>
    <div class="bk-hero">
      <div class="bk-cv">${coverHTML(b, 'cv-lg')}</div>
      <h1>${esc(b.title)}</h1>
      ${b.series ? `<button class="link" id="bSer">${ic('layers', 14)} ${esc(b.series)}${b.seriesNo !== '' && b.seriesNo != null ? ` · ${b.seriesNo}-кітап` : ''}</button>` : ''}
      <div class="bk-au">${authorsOf(b).map(a => `<button class="link" data-au="${esc(a)}">${esc(a)}</button>`).join(', ') || '<span>Автор көрсетілмеген</span>'}</div>
      <div class="bk-stats">
        ${b.pages ? stat(b.pages, b.pageCalc ? 'шартты бет' : 'бет') : ''}${b.year ? stat(b.year, 'жыл') : ''}
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

    ${b.status !== 'done' || b.goal ? goalHTML(b, plan, pct) : ''}

    <div class="glass sec"><h3>Бетбелгілер${marks.length ? ` · ${marks.length}` : ''}</h3>${marks.length ? `<div id="bMarks">${marks.map(markRow).join('')}</div>` : `<p class="muted">Оқығышта немесе плеерде ${ic('bookmark', 14)} батырмасымен қоясың: атауы, түсі, жазбасы бар.</p>`}</div>

    <div class="glass sec"><h3>Сипаттама</h3>${b.summary ? `<p class="clamp" id="sum">${esc(b.summary)}</p><button class="link" id="sumMore">Толығырақ</button>`
      : `<p class="muted">Сипаттама жоқ. Жоғарғы ${ic('more', 14)} мәзірінен «Өңдеу» арқылы қос.</p>`}</div>

    ${!clean && src ? `<div class="glass sec tip">${ic('layers', 22)}<div><b>Таза нұсқа жасау</b><small>Тыңдау мен жылдам оқу үшін бет нөмірлерісіз, колонтитулсыз, тараулары бөлінген EPUB кітап.</small></div><button class="primary" id="convBtn">Жасау</button></div>` : ''}

    <div class="glass sec"><h3>Бөлімдер${chs.length ? ` · ${chs.length}` : ''}</h3>${chs.length ? `
      <div class="chlist" id="chs">${chs.map((c, i) => `<button class="lrow ${i >= 4 ? 'more' : ''}" data-i="${i}"><em class="num">${i + 1}</em><span>${esc(c.title)}</span><em>${fmtT(dur(c, i))}</em></button>`).join('')}</div>
      ${chs.length > 4 ? '<button class="link center" id="chAll">Барлығын көру</button>' : ''}`
      : vs.length ? `<p class="muted">Бөлімдерді көру және тыңдау үшін кітап мәтінін бір рет дайындау керек.</p><button id="prepBtn">${ic('layers', 16)} Мәтінді дайындау</button>`
      : '<p class="muted">Кітапқа әлі файл қосылмаған.</p>'}</div>

    ${ser.length > 1 ? `<div class="sec bare"><h3>«${esc(b.series)}» сериясы · ${ser.length}</h3><div class="hscroll">${ser.map(x => `<button class="mini-card ${x.id === id ? 'cur' : ''}" data-b="${x.id}">${coverHTML(x)}<em class="bc-l">${esc(seriesLabel(x))}</em><span>${esc(x.title)}</span></button>`).join('')}</div></div>` : ''}

    ${others.length ? `<div class="sec bare"><h3>Автордың басқа кітаптары</h3><div class="hscroll">${others.map(x => `<button class="mini-card" data-b="${x.id}">${coverHTML(x)}<span>${esc(x.title)}</span></button>`).join('')}</div></div>` : ''}

    ${info.length ? `<div class="glass sec"><h3>Ақпарат</h3><dl class="info">${info.map(([t, v]) => `<div><dt>${t}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>` : ''}

    <div class="glass sec"><h3>Нұсқалар</h3><div id="vers">${vs.length ? vs.map(v => `
      <div class="ver" data-id="${v.id}">
        <div><b>${esc(v.name)}</b> <span class="badge">${v.type.toUpperCase()}</span>${v.kind ? ` <span class="badge">${KIND[v.kind]}</span>` : ''}<br><small class="muted">${mb(v.blob.size)}${v.pages ? ` · ${v.pages} шартты бет` : ''} · ${v.pct || 0}% оқылды${isReady(v) ? ' · мәтін дайын' : ''}</small></div>
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
  bindGoal(b, pct, () => showBook(id));
  $('#bMarks') && bindMarks($('#bMarks'), marks, () => showBook(id));
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
  view.querySelectorAll('[data-b]').forEach(x => x.onclick = () => x.dataset.b !== id && showBook(x.dataset.b));
  $('#bSer') && ($('#bSer').onclick = () => { showList.q = ''; showList('series', b.series); });
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
const R = { book: null, ver: null, kind: null, pdf: null, rend: null, page: 1, total: 1, zoom: 1, toc: [] };
const rEl = $('#reader'), stage = $('#rStage');
const RS_DEF = { font: 100, family: 'serif', lh: 1.6, theme: 'auto', flow: 'paginated', autoHide: true };
const rs = () => ({ ...RS_DEF, font: +(localStorage.kFont || 100), ...JSON.parse(localStorage.kReader || '{}') });
const PAPER = { light: ['#fbfbfd', '#1b2130'], sepia: ['#f4ecdc', '#3b2f1e'], dark: ['#161b26', '#e3e8f0'] };
const FAMILY = { serif: 'Georgia, "Times New Roman", serif', sans: '-apple-system, system-ui, sans-serif' };

async function openReader(b, v) {
  if (!rEl.hidden) await cleanupReader(); // басқа кітап/нұсқа ашылса — алдыңғысын жабамыз
  Object.assign(R, { book: b, ver: v, kind: v.type, toc: [], cur: null, book_epub: null });
  $('#rTitle').textContent = b.title; $('#rAuthor').textContent = b.author || v.name;
  $('#rCh').textContent = ''; $('#rLeft').textContent = ''; $('#rPosText').textContent = '';
  stage.innerHTML = '<div class="empty">Кітап ашылуда…</div>'; rEl.hidden = false; rEl.dataset.flow = rs().flow; showReaderBars(); $('#rPanel').hidden = true;
  if (!history.state?.kReader) history.pushState({ kReader: 1 }, ''); // Android/браузер «артқа» батырмасы оқығышты жабады
  applyPaper();
  if (b.status === 'plan') applyStatus(b, 'reading');
  b.lastOpened = Date.now(); b.lastVersion = v.id; put('books', b);
  startTrack(b, v);
  try {
    const buf = await v.blob.arrayBuffer();
    if (v.type === 'pdf') await openPdf(buf); else await openEpub(buf);
  } catch (err) { console.error(err); stage.innerHTML = `<div class="empty">Файлды ашу мүмкін болмады: ${esc(err.message)}</div>`; }
  refreshNotes();
}

/* --- PDF --- */
async function openPdf(buf) {
  R.pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  R.total = R.pdf.numPages;
  const s = $('#rSlider'); s.min = 1; s.max = R.total; s.step = 1;
  R.toc = (await pdfOutline(R.pdf)).map(o => ({ title: o.title, page: o.page + 1 }));
  if (R.toc.length < 2 && R.ver.chapters?.length) R.toc = R.ver.chapters.map(c => ({ title: c.title, page: c.from + 1 }));
  await renderPdf(Math.min(R.ver.pos?.page || 1, R.total));
}
async function renderPdf(n) {
  R.page = Math.max(1, Math.min(R.total, n));
  const p = await R.pdf.getPage(R.page);
  const w = Math.min(stage.clientWidth - 16, 1000) * R.zoom;
  const vp0 = p.getViewport({ scale: 1 }), sc = w / vp0.width, dpr = window.devicePixelRatio || 1;
  const vp = p.getViewport({ scale: sc * dpr });
  let c = stage.querySelector('canvas');
  if (!c) { stage.innerHTML = '<div class="pdfp"><canvas></canvas><div class="textLayer"></div></div>'; c = stage.querySelector('canvas'); }
  c.width = vp.width; c.height = vp.height; c.style.width = vp.width / dpr + 'px';
  await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  // Көрінбейтін мәтін қабаты: сөзді белгілеп сөздікке қосуға болады. Масштаб — canvas-тың нақты көрінген ені.
  const tl = stage.querySelector('.textLayer'); tl.replaceChildren();
  pdfjsLib.renderTextLayer({ textContentSource: p.streamTextContent(), container: tl, viewport: p.getViewport({ scale: c.offsetWidth / vp0.width }) }).promise.catch(() => {}); // мәтіні жоқ (скан) бетте қабат бос қалады
  stage.scrollTop = 0;
  const ci = R.toc.filter(t => t.page <= R.page).length - 1, next = R.toc[ci + 1]?.page ?? R.total + 1;
  if (R.toc.length) chapterInfo(R.toc[ci]?.title || '', next - R.page - 1);
  else { chapterInfo('', -1); $('#rLeft').textContent = R.total > R.page ? `кітапта ${R.total - R.page} бет қалды` : 'соңғы бет'; }
  progress({ page: R.page }, Math.round(R.page / R.total * 100), `${R.page} / ${R.total}`);
  $('#rSlider').value = R.page;
}

/* --- EPUB --- */
async function openEpub(buf) {
  const book = ePub(buf);
  R.book_epub = book;
  stage.innerHTML = '<div class="epub"></div>';
  R.rend = book.renderTo(stage.firstChild, { width: '100%', height: '100%', flow: rs().flow === 'scrolled' ? 'scrolled-doc' : 'paginated', spread: 'none' });
  applyEpubTheme();
  R.rend.on('relocated', loc => {
    const pct = book.locations.length() ? Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100) : (R.ver.pct || 0);
    const file = loc.start.href.split('/').pop(), t = R.toc.filter(x => x.file === file);
    chapterInfo(t[0]?.title || R.toc.filter(x => x.spine <= loc.start.index).pop()?.title || '', (loc.start.displayed?.total || 0) - (loc.start.displayed?.page || 0));
    const pn = R.ver.pages ? Math.max(1, Math.ceil(pct / 100 * R.ver.pages)) : 0;
    progress({ cfi: loc.start.cfi }, pct, pn ? `${pn} / ${R.ver.pages}` : pct + '%');
    $('#rSlider').value = pct;
  });
  R.rend.on('displayError', err => { console.error(err); stage.innerHTML = `<div class="empty">EPUB бетін көрсету мүмкін болмады: ${esc(err?.message || 'белгісіз қате')}</div>`; });
  bindGestures(R.rend);
  const s = $('#rSlider'); s.min = 0; s.max = 100; s.step = 1;
  await book.ready;
  const flat = (list, lvl = 0) => (list || []).flatMap(t => [{ title: t.label.replace(/\s+/g, ' ').trim(), href: t.href, file: t.href.split('#')[0].split('/').pop(), spine: book.spine.get(t.href.split('#')[0])?.index ?? 0, lvl }, ...flat(t.subitems, lvl + 1)]);
  R.toc = flat(book.navigation?.toc);
  // Кей EPUB-тың алғашқы spine файлы бос мұқаба/титул болады. Сақталған орын жоқ болса,
  // мазмұндағы алғашқы нақты бөлімнен ашамыз.
  const useful = R.toc.find(t => !/^(басы|мұқаба|титул|мазмұн(?:ы)?|cover|title|contents?)$/i.test(t.title));
  await R.rend.display(R.ver.pos?.cfi || useful?.href || undefined);
  book.locations.generate(1200).then(() => {
    const st = R.rend?.currentLocation()?.start;
    if (st) { const pct = Math.round(book.locations.percentageFromCfi(st.cfi) * 100), pn = R.ver.pages ? Math.max(1, Math.ceil(pct / 100 * R.ver.pages)) : 0; progress({ cfi: st.cfi }, pct, pn ? `${pn} / ${R.ver.pages}` : pct + '%'); $('#rSlider').value = pct; }
  }).catch(() => {});
}
function applyEpubTheme() {
  if (!R.rend) return;
  const o = rs(), [bg, fg] = paperColors();
  R.rend.themes.fontSize(o.font + '%');
  R.rend.themes.override('color', fg); R.rend.themes.override('background', bg);
  R.rend.themes.override('font-family', FAMILY[o.family]); R.rend.themes.override('line-height', String(o.lh));
}
const paperColors = () => { const t = rs().theme; return PAPER[t === 'auto' ? (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') : t]; };
function applyPaper() {
  const [bg, fg] = paperColors(), t = rs().theme;
  rEl.style.setProperty('--paper', bg); rEl.style.setProperty('--rink', fg);
  rEl.dataset.paper = t === 'auto' ? (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') : t;
  applyEpubTheme();
}

function chapterInfo(title, left) {
  $('#rCh').textContent = title || R.book.title;
  $('#rLeft').textContent = left > 0 ? `тараудың соңына ${left} бет` : left === 0 ? 'тараудың соңғы беті' : '';
}

let pT;
function progress(pos, pct, label) {
  touchRead();
  $('#rPosText').textContent = label;
  R.cur = { pos, pct, label };
  clearTimeout(pT);
  pT = setTimeout(async () => { R.ver.pos = pos; R.ver.pct = pct; await put('versions', R.ver); }, 400);
}

const go = d => R.kind === 'pdf' ? renderPdf(R.page + d) : (d > 0 ? R.rend?.next() : R.rend?.prev());
let rBarsTimer;
function scheduleReaderBars() {
  clearTimeout(rBarsTimer);
  if (rs().autoHide && !rEl.hidden && !$('#rSheet').open) rBarsTimer = setTimeout(() => rEl.classList.add('bare'), 2000);
}
function showReaderBars() { rEl.classList.remove('bare'); scheduleReaderBars(); setTimeout(() => R.rend?.resize?.(), 260); }
const toggleBars = () => { rEl.classList.contains('bare') ? showReaderBars() : (rEl.classList.add('bare'), clearTimeout(rBarsTimer)); };

// Беттің шетін басу — бет ауыстыру, ортасы — жолақтарды жасыру; саусақпен сырғыту — бет ауыстыру
function zoneTap(x, w) {
  if (rEl.classList.contains('bare')) return showReaderBars();
  if (R.kind === 'epub' && rs().flow === 'scrolled') return toggleBars();
  if (x < w * .28) go(-1); else if (x > w * .72) go(1); else toggleBars();
}
function bindGestures(rend) {
  let sx = 0, sy = 0, st = 0;
  const down = e => { const t = e.changedTouches?.[0] || e; sx = t.screenX; sy = t.screenY; st = Date.now(); };
  const up = (e, tap) => {
    const t = e.changedTouches?.[0] || e, dx = t.screenX - sx, dy = t.screenY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) return go(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - st < 400) tap(t);
  };
  if (rend) {
    // EPUB беті iframe ішінде: үлкейтуді сол құжатта да тоқтатамыз
    rend.hooks.content.register(c => { c.document.documentElement.style.touchAction = 'manipulation'; c.document.addEventListener('gesturestart', e => e.preventDefault()); AddWord.watch(c.document); });
    rend.on('touchstart', down);
    rend.on('touchend', e => up(e, t => zoneTap(t.screenX - stage.getBoundingClientRect().left - (window.screenX || 0), stage.clientWidth)));
    rend.on('click', e => { if (!('ontouchstart' in window) && !e.target.closest?.('a')) zoneTap(e.clientX - (rend.manager?.container?.scrollLeft || 0), stage.clientWidth); });
  }
}
stage.addEventListener('touchstart', e => { if (R.kind === 'pdf') { const t = e.changedTouches[0]; stage._s = [t.screenX, t.screenY, Date.now()]; } }, { passive: true });
stage.addEventListener('touchend', e => {
  if (R.kind !== 'pdf' || !stage._s) return;
  const t = e.changedTouches[0], [x0, y0, t0] = stage._s, dx = t.screenX - x0, dy = t.screenY - y0;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - t0 < 400) zoneTap(t.clientX - stage.getBoundingClientRect().left, stage.clientWidth);
});
stage.addEventListener('click', e => { if (R.kind === 'pdf' && !('ontouchstart' in window)) zoneTap(e.clientX - stage.getBoundingClientRect().left, stage.clientWidth); });

$('#rNext').onclick = () => go(1);
$('#rPrev').onclick = () => go(-1);
$('#rSlider').onchange = e => {
  const v = +e.target.value;
  if (R.kind === 'pdf') renderPdf(v);
  else if (R.book_epub?.locations.length()) R.rend.display(R.book_epub.locations.cfiFromPercentage(v / 100));
};

// Жабу: алдымен экранды жасырамыз, кейін тазалаймыз — epub.js қате берсе де оқығыш жабылады
async function cleanupReader() {
  clearTimeout(pT);
  try { if (R.cur && R.ver) { R.ver.pos = R.cur.pos; R.ver.pct = R.cur.pct; await put('versions', R.ver); } } catch (e) { console.warn(e); }
  try { await endTrack(); } catch (e) { console.warn(e); }
  try { R.rend?.destroy(); } catch (e) { console.warn(e); }
  try { R.book_epub?.destroy(); } catch (e) { console.warn(e); }
  try { R.pdf?.destroy(); } catch (e) { console.warn(e); }
  Object.assign(R, { rend: null, pdf: null, book_epub: null });
  stage.innerHTML = '';
}
async function closeReader(after) {
  if (rEl.hidden) return;
  rEl.hidden = true; $('#rSheet').open && $('#rSheet').close();
  await cleanupReader();
  (after || rerender)();
}
$('#rClose').onclick = () => history.state?.kReader ? history.back() : closeReader();
addEventListener('popstate', () => { if (!rEl.hidden) closeReader(); });
document.addEventListener('keydown', e => {
  if (rEl.hidden || /TEXTAREA|INPUT/.test(e.target.tagName) || $('#rSheet').open) return;
  if (R.kind === 'epub' && rs().flow === 'scrolled' && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' '].includes(e.key)) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
  if (e.key === 'Escape') $('#rClose').click();
});

/* --- Төменгі парақтар: мәзір, мазмұн, іздеу, мәтін баптаулары --- */
function rSheet(html, bind) {
  const D = $('#rSheet'); D.querySelector('.rs-body').innerHTML = html;
  D.onclick = e => { if (e.target === D) D.close(); };
  bind?.(D); if (!D.open) D.showModal();
}
function showToc() {
  if (!R.toc.length) return toast('Бұл кітапта мазмұн табылмады');
  const cur = $('#rCh').textContent;
  rSheet(`<h3>Мазмұны</h3><div class="rs-list">${R.toc.map((t, i) => `<button class="lrow ${t.title === cur ? 'now' : ''}" data-i="${i}" style="padding-left:${.5 + (t.lvl || 0) * 1.1}rem"><span>${esc(t.title)}</span>${t.page ? `<em>${t.page}</em>` : ''}</button>`).join('')}</div>`, D => {
    D.querySelector('.now')?.scrollIntoView({ block: 'center' });
    D.querySelector('.rs-list').onclick = e => {
      const t = R.toc[+e.target.closest('[data-i]')?.dataset.i]; if (!t) return;
      D.close(); R.kind === 'pdf' ? renderPdf(t.page) : R.rend.display(t.href);
    };
  });
}
function showSearch() {
  rSheet(`<h3>Кітаптан іздеу</h3><label class="search glass">${ic('search', 18)}<input id="rsQ" placeholder="Сөз не тіркес…" enterkeyhint="search"></label><div class="rs-list" id="rsRes"></div>`, D => {
    const q = D.querySelector('#rsQ'); setTimeout(() => q.focus(), 60);
    let t;
    q.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(q.value.trim()), 300); };
  });
}
async function runSearch(q) {
  const box = $('#rsRes'); if (!box) return;
  if (q.length < 2) { box.innerHTML = ''; return; }
  if (!isReady(R.ver)) {
    box.innerHTML = '<small class="muted">Іздеу үшін мәтін бір рет дайындалады…</small>';
    try { await indexVersion(R.book, R.ver); } catch (err) { box.innerHTML = `<small class="muted">${esc(err.message)}</small>`; return; }
  }
  const cs = (await byBook('chunks', R.book.id)).filter(c => c.versionId === R.ver.id).sort((a, b) => a.n - b.n), ql = q.toLowerCase(), hits = [];
  for (const c of cs) {
    let k = c.text.toLowerCase().indexOf(ql);
    while (k >= 0 && hits.length < 60) { hits.push({ c, k }); k = c.text.toLowerCase().indexOf(ql, k + ql.length); }
    if (hits.length >= 60) break;
  }
  const snip = ({ c, k }) => { const a = Math.max(0, k - 50), b = Math.min(c.text.length, k + q.length + 70); return `${a ? '…' : ''}${esc(c.text.slice(a, k))}<mark>${esc(c.text.slice(k, k + q.length))}</mark>${esc(c.text.slice(k + q.length, b))}…`; };
  box.innerHTML = hits.length ? `<small class="muted">${hits.length >= 60 ? '60+' : hits.length} нәтиже</small>` + hits.map((h, i) => `<button class="rs-hit" data-i="${i}"><small class="muted">${esc(h.c.ref)}</small><span>${snip(h)}</span></button>`).join('') : '<small class="muted">Ештеңе табылмады</small>';
  box.onclick = e => {
    const h = hits[+e.target.closest('[data-i]')?.dataset.i]; if (!h) return;
    $('#rSheet').close();
    if (R.kind === 'pdf') renderPdf(+(h.c.ref.match(/\d+/)?.[0] || 1));
    else { const it = R.book_epub.spine.get(h.c.pi); if (it) R.rend.display(it.href); }
  };
}
function showAa() {
  const o = rs(), seg = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(([k, t]) => `<button data-v="${k}" class="${String(k) === String(cur) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  rSheet(`<h3>Мәтін баптаулары</h3>
    <div class="row" style="flex-wrap:nowrap;justify-content:space-between"><button id="aaM" class="big" style="flex:1">A−</button><b id="aaV" style="min-width:4.5rem;text-align:center">${R.kind === 'pdf' ? Math.round(R.zoom * 100) : o.font}%</b><button id="aaP" class="big" style="flex:1">A+</button></div>
    ${R.kind === 'pdf' ? '<small class="muted">PDF-те қаріпті өзгерту мүмкін емес, бет үлкейеді. Ыңғайлы оқу үшін кітаптың «Таза нұсқасын» аш.</small>' : `<label>Қаріп</label>${seg('aaF', [['serif', 'Serif'], ['sans', 'Sans']], o.family)}<label>Жол аралығы</label>${seg('aaL', [[1.4, 'Тығыз'], [1.6, 'Қалыпты'], [1.9, 'Кең']], o.lh)}<label>Оқу бағыты</label>${seg('aaFlow', [['paginated', 'Беттеп оқу'], ['scrolled', 'Тігінен оқу']], o.flow)}`}
    <label>Басқару батырмалары</label>${seg('aaHide', [[1, '2 секундта жасыру'], [0, 'Әрдайым көрсету']], +o.autoHide)}
    <label>Бет түсі</label>${seg('aaT', [['auto', 'Жүйе'], ['light', 'Ақ'], ['sepia', 'Сепия'], ['dark', 'Қараңғы']], o.theme)}`, D => {
    const save = p => { localStorage.kReader = JSON.stringify({ ...rs(), ...p }); if (p.font) localStorage.kFont = p.font; applyPaper(); };
    const size = d => {
      if (R.kind === 'pdf') { R.zoom = Math.max(.6, Math.min(3, R.zoom + d * .2)); renderPdf(R.page); D.querySelector('#aaV').textContent = Math.round(R.zoom * 100) + '%'; }
      else { const f = Math.max(70, Math.min(220, rs().font + d * 10)); save({ font: f }); D.querySelector('#aaV').textContent = f + '%'; }
    };
    D.querySelector('#aaM').onclick = () => size(-1); D.querySelector('#aaP').onclick = () => size(1);
    const segBind = (id, k, num) => { const el = D.querySelector('#' + id); if (el) el.onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v == null) return; save({ [k]: num ? +v : v }); el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }; };
    segBind('aaF', 'family'); segBind('aaL', 'lh', true); segBind('aaT', 'theme');
    const flow = D.querySelector('#aaFlow'); if (flow) flow.onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; save({ flow: v }); rEl.dataset.flow = v; flow.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); R.rend?.flow(v === 'scrolled' ? 'scrolled-doc' : 'paginated'); R.rend?.resize?.(); };
    const hide = D.querySelector('#aaHide'); hide.onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v == null) return; save({ autoHide: v === '1' }); hide.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); v === '1' ? scheduleReaderBars() : (clearTimeout(rBarsTimer), rEl.classList.remove('bare')); };
  });
}
function showMore() {
  const b = R.book, items = [['about', 'book', 'Кітап туралы'], ...(navigator.share ? [['share', 'share', 'Бөлісу']] : []), ['toc', 'list', 'Мазмұны'], ['search', 'search', 'Кітаптан іздеу'],
    ['shelf', 'shelves', 'Сөреге қосу'], ['listen', 'headphones', 'Тыңдау'], ['speed', 'zap', 'Жылдам оқу'], ['ai', 'chat', 'ЖИ-мен талқылау'],
    b.status === 'done' ? ['reading', 'book-open', 'Қайта оқып жатырмын'] : ['done', 'flag', 'Оқыдым деп белгілеу']];
  rSheet(`<div class="rs-menu">${items.map(([a, i, t]) => `<button class="lrow" data-a="${a}">${ic(i, 22)}<span>${t}</span></button>`).join('')}</div>`, D => {
    D.querySelector('.rs-menu').onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (!['toc', 'search'].includes(a)) D.close();
      if (a === 'about') closeReader(() => showBook(b.id));
      if (a === 'share') navigator.share({ title: b.title, text: `«${b.title}»${b.author ? `, ${b.author}` : ''}: оқып жатырмын (${R.cur?.pct || 0}%)` }).catch(() => {});
      if (a === 'toc') showToc();
      if (a === 'search') showSearch();
      if (a === 'shelf') openShelfDlg(b.id);
      if (a === 'listen') readerListen();
      if (a === 'speed') readerSpeed();
      if (a === 'ai') closeReader(() => showChat(b.id));
      if (a === 'done' || a === 'reading') { applyStatus(b, a); await put('books', b); toast(a === 'done' ? 'Оқылды деп белгіленді' : 'Оқып жатырмын'); }
    };
  });
}
function showReaderTools() {
  const pct = R.cur?.pct || 0;
  rSheet(`<div class="reader-tool-head"><button data-a="toc"><span>${esc($('#rCh').textContent || 'Мазмұны')} · ${pct}%</span>${ic('list', 24)}</button></div>
    <div class="reader-tool-list">
      <button data-a="notes"><span>Белгілер мен ескертпелер</span>${ic('note', 24)}</button>
      <button data-a="search"><span>Кітаптан іздеу</span>${ic('search', 24)}</button>
      <button data-a="aa"><span>Мәтін баптаулары</span><b>Aa</b></button>
    </div>
    <div class="reader-tool-icons">
      ${navigator.share ? `<button data-a="share" aria-label="Бөлісу">${ic('share', 24)}</button>` : ''}
      <button data-a="shelf" aria-label="Сөреге қосу">${ic('shelves', 24)}</button>
      <button data-a="mark" aria-label="Бетбелгі қою">${ic('bookmark', 24)}</button>
    </div>`, D => {
    D.querySelector('.rs-body').onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      D.close();
      if (a === 'toc') showToc();
      if (a === 'search') showSearch();
      if (a === 'aa') showAa();
      if (a === 'notes') showReaderNotes();
      if (a === 'mark') readerMark();
      if (a === 'shelf') openShelfDlg(R.book.id);
      if (a === 'share') navigator.share({ title: R.book.title, text: `«${R.book.title}»: ${pct}% оқылды` }).catch(() => {});
    };
  });
}
async function showReaderNotes() {
  const ms = (await byBook('marks', R.book.id)).filter(m => m.kind === 'read' && m.versionId === R.ver.id).sort((a, b) => (a.pct || 0) - (b.pct || 0));
  const ns = (await byBook('notes', R.book.id)).sort((a, b) => b.created - a.created);
  rSheet(`<div class="psl-hd"><b>Белгілер мен ескертпелер</b><button class="icon-btn" data-mark aria-label="Бетбелгі қою">${ic('bookmark', 20)}</button></div>
    <h4>Бетбелгілер</h4><div id="rsMarks">${ms.length ? ms.map(markRow).join('') : '<small class="muted">Әзірге жоқ</small>'}</div>
    <h4>Ескертпе</h4><textarea id="rsNoteText" placeholder="Осы жерге ескертпе жаз…"></textarea><button class="primary" data-save>Ескертпені сақтау</button>
    <div class="rs-list">${ns.length ? ns.map(n => `<div class="note"><small>${esc(n.ref)}</small><div>${esc(n.text).replace(/\n/g, '<br>')}</div></div>`).join('') : '<small class="muted">Әзірге ескертпе жоқ</small>'}</div>`, D => {
    bindMarks(D.querySelector('#rsMarks'), ms, showReaderNotes);
    D.querySelector('[data-mark]').onclick = () => {
      const pdf = R.kind === 'pdf', pct = R.cur?.pct || 0;
      D.close();
      openMarkDlg({ bookId: R.book.id, versionId: R.ver.id, kind: 'read', pos: pdf ? { page: R.page } : { cfi: R.cur?.pos?.cfi }, pct, label: pdf ? `бет ${R.page}` : `${pct}%` }, showReaderNotes);
    };
    D.querySelector('[data-save]').onclick = async () => {
      const t = D.querySelector('#rsNoteText').value.trim(); if (!t) return;
      await put('notes', { id: uid(), bookId: R.book.id, vname: R.ver.name, text: t, ref: R.kind === 'pdf' ? `бет ${R.page}` : (R.cur?.label || ''), created: Date.now() });
      D.close(); showReaderNotes(); toast('Ескертпе сақталды');
    };
  });
}
$('#rMore').onclick = showMore;
$('#rTools').onclick = showReaderTools;
const readerListen = () => {
  const b = R.book, v = R.ver;
  const pi = R.kind === 'pdf' ? R.page - 1 : (R.rend?.currentLocation()?.start?.index ?? 0);
  // Дайындау қажет болса, оның прогресі оқығыштың артында жасырылып қалмасын.
  if (!isReady(v)) return closeReader(() => Player.open(b, null, { vid: v.id, pi }));
  Player.open(b, null, { vid: v.id, pi });
};

async function refreshNotes() {
  const ms = (await byBook('marks', R.book.id)).filter(m => m.kind === 'read' && m.versionId === R.ver.id).sort((a, b) => (a.pct || 0) - (b.pct || 0));
  $('#rMarks').innerHTML = ms.length ? ms.map(markRow).join('') : '<small class="muted">Әзірге жоқ</small>';
  bindMarks($('#rMarks'), ms, refreshNotes);
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
  if (!rEl.hidden) applyPaper();
  applyEpubTheme();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();
addEventListener('DOMContentLoaded', () => applyLogo());
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

addEventListener('DOMContentLoaded', () => openDB().then(showHome).then(async () => {
  try { if (await ensureEpubPages() && ['home', 'library', 'book'].includes(view.dataset.page)) rerender(); } catch (e) { console.warn('epub pages', e); }
  autoSync();
}));
