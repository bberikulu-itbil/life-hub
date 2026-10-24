'use strict';
/* Kitapp: басты бет («Кітаптарым»), жинақтар тізімі және кітаптар торы. */

const MONTH_IN = ['қаңтарда', 'ақпанда', 'наурызда', 'сәуірде', 'мамырда', 'маусымда', 'шілдеде', 'тамызда', 'қыркүйекте', 'қазанда', 'қарашада', 'желтоқсанда'];
let rerender = () => showHome(); // ⋮ мәзірінен кейін қазіргі бетті жаңарту үшін

const authorsOf = b => String(b.author || '').split(/\s*(?:[,;&]|\bжәне\b)\s*/).map(s => s.trim()).filter(Boolean);
const bookPct = (b, vs) => Math.max(0, ...vs.filter(v => v.bookId === b.id).map(v => v.pct || 0));

// Соңғы ашылған кітап (оқып жатқаны алдымен).
function currentBook(books) {
  const r = books.filter(b => b.lastOpened).sort((a, c) => (c.status === 'reading') - (a.status === 'reading') || c.lastOpened - a.lastOpened);
  return r[0] || books.find(b => b.status === 'reading') || null;
}

async function libData() {
  const [books, vs, au, ss] = await Promise.all([all('books'), all('versions'), all('audio'), all('sessions')]);
  return { books, vs, ss, withAudio: new Set(au.map(a => a.bookId)) };
}

const COLLECTIONS = [
  ['all', 'book', 'Барлығы', () => true],
  ['reading', 'book-open', 'Оқып жатырмын', b => b.status === 'reading'],
  ['done', 'flag', 'Аяқталғандар', b => b.status === 'done'],
  ['plan', 'bookmark', 'Жоспарда', b => b.status === 'plan'],
  ['audio', 'headphones', 'Аудиосы барлар', (b, d) => d.withAudio.has(b.id)],
];

// Жинақтар тізімі: keys — қай жолдар көрінеді (басты бетте қысқа, кітапханада толық).
function collectionsHTML(d, keys) {
  const row = (k, icon, text, n) => `<button class="lrow" data-c="${k}">${ic(icon, 22)}<span>${text}</span><em>${n}</em>${ic('chevron-right', 18)}</button>`;
  const extra = { shelves: ['shelves', 'Менің сөрелерім', new Set(d.books.flatMap(b => b.tags || [])).size], authors: ['users', 'Авторлар', new Set(d.books.flatMap(authorsOf)).size] };
  return `<div class="glass list" data-col>${keys.map(k => {
    const c = COLLECTIONS.find(x => x[0] === k);
    return c ? row(k, c[1], c[2], d.books.filter(b => c[3](b, d)).length) : row(k, ...extra[k]);
  }).join('')}</div>`;
}
function bindCollections() {
  view.querySelectorAll('.list[data-col]').forEach(l => l.onclick = e => {
    const c = e.target.closest('[data-c]')?.dataset.c; if (!c) return;
    c === 'shelves' || c === 'authors' ? showGroups(c) : showList(c);
  });
}

const shelf = (title, list) => list.length ? `<div class="sec bare"><h3>${title}</h3><div class="hscroll">${list.map(x => `<button class="mini-card" data-b="${x.id}">${coverHTML(x)}<span>${esc(x.title)}</span></button>`).join('')}</div></div>` : '';
const uploadBox = () => `<button class="upload" id="hUp">${ic('cloud-up', 34)}<b>Кітапты PDF немесе EPUB форматында жүктеу</b><small>Мұқаба, автор, сипаттама файлдан өзі алынады</small></button>
  <input type="file" id="hFile" accept=".pdf,.epub,application/pdf,application/epub+zip" multiple hidden>`;
function bindUpload() {
  $('#hUp').onclick = () => $('#hFile').click();
  $('#hFile').onchange = e => quickAdd([...e.target.files]);
}

/* ---------- Басты бет: статистика, қазір оқып жатқан кітап, сөрелер ---------- */
async function showHome() {
  setNav('home'); rerender = () => showHome(); view.dataset.page = 'home';
  const d = await libData(), { books, vs } = d;
  const S = KS.summarize(d.ss), now = new Date();
  const ym = KS.dayKey(now).slice(0, 7), year = String(now.getFullYear());
  const monthDays = Object.entries(S.byDay).filter(([k, s]) => k.startsWith(ym) && s >= 60).length;
  const yGoal = +(localStorage.kYearGoal || 12), yDone = books.filter(b => b.status === 'done' && (b.finishDate || '').startsWith(year)).length;
  const cur = currentBook(books), pct = cur ? bookPct(cur, vs) : 0;
  const reading = books.filter(b => b.status === 'reading' && b.id !== cur?.id).sort((a, c) => (c.lastOpened || 0) - (a.lastOpened || 0));
  const recent = [...books].sort((a, c) => c.added - a.added).slice(0, 12);
  const hour = now.getHours(), hello = hour < 12 ? 'Қайырлы таң' : hour < 18 ? 'Қайырлы күн' : 'Қайырлы кеш';

  view.innerHTML = `
    <header class="hd"><div><small class="muted">${hello}</small><h1>Басты бет</h1></div><button class="icon-btn glass" id="hSearch" aria-label="Іздеу">${ic('search', 20)}</button></header>
    <div class="home-grid">
      <div class="home-main">
        <button class="glass stat-card" id="hStats">
          <div class="sc-row"><div><small>бүгін</small><b>${Math.round(S.today / 60)} мин</b></div><div><small>${MONTH_IN[now.getMonth()]}</small><b>${monthDays} күн</b></div><div><small>қатарынан</small><b>${S.streak} күн</b></div>${ic('chevron-right', 22)}</div>
          <div class="sc-goal"><small>${yDone}/${yGoal} кітап оқылды (${year})</small><div class="bar-p"><i style="width:${Math.min(100, yDone / yGoal * 100)}%"></i></div></div>
        </button>
        ${cur ? `<div class="glass hero" data-id="${cur.id}">
          <div class="hero-hd"><div class="hero-t"><b>${esc(cur.title)}</b><small>${esc(cur.author || '')}</small></div>
            ${navigator.share ? `<button class="icon-btn" data-a="share" aria-label="Бөлісу">${ic('share', 20)}</button>` : ''}
            <button class="icon-btn kebab" data-a="menu" aria-label="Мәзір">${ic('more', 20)}</button></div>
          <button class="hero-cv" data-a="read" aria-label="Оқуды жалғастыру">${coverHTML(cur, 'cv-lg')}</button>
          <div class="hero-p"><div class="bar-p"><i style="width:${pct}%"></i></div><small>Бүкіл кітаптан ${pct}%</small></div>
          <div class="row" style="justify-content:center"><button class="primary" data-a="read">${ic('book-open', 18)} Оқу</button><button data-a="listen">${ic('headphones', 18)} Тыңдау</button></div>
        </div>` : `<div class="glass sec"><h3>Кітапханаң бос</h3><p class="muted">Бірінші кітабыңды жүкте: мұқабасы мен ақпараты файлдан өзі алынады.</p></div>`}
      </div>
      <div class="home-side">
        ${shelf('Оқып жатырмын', reading)}
        ${shelf('Жақында қосылғандар', recent)}
        ${uploadBox()}
      </div>
    </div>
    <div class="sec bare"><h3>Жинақтар</h3>${collectionsHTML(d, ['all', 'reading', 'done', 'plan', 'shelves'])}</div>`;

  bindCollections();
  $('#hSearch').onclick = () => { showList.q = ''; showList('all', null, true); };
  $('#hStats').onclick = showStats;
  view.querySelectorAll('[data-b]').forEach(x => x.onclick = () => showBook(x.dataset.b));
  bindUpload();
  const hero = view.querySelector('.hero');
  if (hero) hero.onclick = async e => {
    const a = e.target.closest('[data-a]'); if (!a) return showBook(cur.id);
    if (a.dataset.a === 'menu') return bookMenu(cur.id, a);
    if (a.dataset.a === 'share') return navigator.share({ title: cur.title, text: `«${cur.title}»${cur.author ? `, ${cur.author}` : ''}: оқып жатырмын (${pct}%)` }).catch(() => {});
    if (a.dataset.a === 'read') return continueReading(cur);
    if (a.dataset.a === 'listen') return Player.open(cur);
  };
  ensureCovers(books, () => view.dataset.page === 'home' && showHome());
}

/* ---------- Кітапхана: жинақтар және барлық кітап ---------- */
// Кітапхана сүзгілері: түрі, күйі, жанры, сөресі. Кілт: 'all' | 'books' | 'audio' | статус | 'g:жанр' | 't:сөре'.
function libFilters(d) {
  const has = new Set(d.vs.map(v => v.bookId));
  const base = [['all', 'Барлығы', () => true], ['books', 'Кітаптар', b => has.has(b.id)], ['audio', 'Аудиокітаптар', b => d.withAudio.has(b.id)]];
  const status = COLLECTIONS.filter(c => ['reading', 'done', 'plan'].includes(c[0])).map(([k, , t, f]) => [k, t, b => f(b, d)]);
  const genres = [...new Set(d.books.map(b => (b.genre || '').trim()).filter(Boolean))].sort((a, c) => a.localeCompare(c, 'kk')).map(g => ['g:' + g, g, b => (b.genre || '').trim() === g]);
  const tags = [...new Set(d.books.flatMap(b => b.tags || []))].sort((a, c) => a.localeCompare(c, 'kk')).map(t => ['t:' + t, '#' + t, b => (b.tags || []).includes(t)]);
  return { groups: [['Түрі', base], ['Күйі', status], ['Жанры', genres], ['Сөрелер', tags]], all: [...base, ...status, ...genres, ...tags] };
}

async function showLibrary() {
  setNav('lib'); rerender = () => showLibrary(); view.dataset.page = 'library';
  const d = await libData(), { books } = d, F = libFilters(d);
  let cur = F.all.find(f => f[0] === localStorage.kLibF) ? localStorage.kLibF : 'all';
  const chip = ([k, t]) => `<button class="fchip ${k === cur ? 'on' : ''}" data-f="${esc(k)}">${esc(t)}</button>`;

  view.innerHTML = `
    <header class="hd"><h1>Кітапхана</h1><div class="row" style="flex-wrap:nowrap">
      <button class="icon-btn glass" id="lSearch" aria-label="Іздеу">${ic('search', 20)}</button>
      <button class="icon-btn primary" id="lAdd" aria-label="Кітап қосу">${ic('plus', 22)}</button></div></header>
    <div class="chips-row"><button class="fchip sq" id="lAll" aria-label="Барлық сүзгілер">${ic('grid', 18)}</button><div id="lChips" class="chips-scroll"></div></div>
    <div class="grid" id="grid"></div>
    <div class="home-grid" style="margin-top:1.4rem">
      <div class="sec bare"><h3>Жинақтар</h3>${collectionsHTML(d, ['all', 'reading', 'done', 'plan', 'audio', 'shelves', 'authors'])}</div>
      <div>${uploadBox()}</div>
    </div>`;

  const draw = () => {
    localStorage.kLibF = cur;
    // таңдалған сүзгі әрдайым көрінсін: қатардың басына қоямыз
    const row = F.all.slice(0, 6), sel = F.all.find(f => f[0] === cur);
    if (!row.includes(sel)) row.splice(1, 0, sel);
    $('#lChips').innerHTML = row.map(chip).join('');
    const list = books.filter(sel[2]).sort((a, c) => (c.lastOpened || c.added) - (a.lastOpened || a.added));
    $('#grid').innerHTML = list.length ? list.map(b => bookCard(b, d)).join('')
      : `<div class="empty" style="grid-column:1/-1">${books.length ? (cur === 'audio' ? 'Аудиокітап жоқ. Кітап бетінен «Аудио жасау» арқылы mp3 жаса.' : 'Бұл сүзгі бойынша кітап жоқ') : 'Кітапхана бос. «+» арқылы бірінші кітабыңды қос.'}</div>`;
  };
  draw();
  $('#lChips').onclick = e => { const f = e.target.closest('[data-f]')?.dataset.f; if (f) { cur = f; draw(); } };
  $('#lAll').onclick = () => {
    const D = $('#fDlg');
    D.querySelector('.fs-body').innerHTML = F.groups.filter(g => g[1].length).map(([t, items]) => `<h4>${t}</h4><div class="fwrap">${items.map(chip).join('')}</div>`).join('');
    D.onclick = e => { const f = e.target.closest('[data-f]')?.dataset.f; if (f) { cur = f; draw(); D.close(); } else if (e.target === D) D.close(); };
    D.showModal();
  };
  $('#lSearch').onclick = () => { showList.q = ''; showList('all', null, true); };
  $('#lAdd').onclick = openAdd;
  bindCollections();
  $('#grid').onclick = e => { const k = e.target.closest('.card-k'); if (k) return bookMenu(k.dataset.k, k); const c = e.target.closest('.bcard'); if (c) showBook(c.dataset.id); };
  bindUpload();
  ensureCovers(books, () => view.dataset.page === 'library' && showLibrary());
}

// Соңғы оқыған нұсқаны ашады (жоқ болса — түпнұсқаны).
async function continueReading(b, speed) {
  const vs = await byBook('versions', b.id);
  if (!vs.length) return showBook(b.id);
  const v = vs.find(x => x.id === b.lastVersion) || vs.find(x => x.kind === 'original') || vs[0];
  await openReader(b, v);
  if (speed) readerSpeed();
}

// Файлдарды тікелей таңдап қосу: әр файл жеке кітап болады, атауы мен мұқабасы файлдан.
async function quickAdd(files) {
  if (!files.length) return;
  let last;
  for (const f of files) {
    const id = uid();
    const b = { id, title: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Атаусыз кітап', titleAuto: true, author: '', status: 'plan', rating: 0, added: Date.now() };
    await put('books', b);
    await addVersions(id, [f], '', 'original');
    toast('Мұқаба мен ақпарат оқылуда…');
    await enrichBook(b).catch(() => {});
    last = id;
  }
  files.length === 1 ? showBook(last) : rerender();
}

/* ---------- Кітаптар торы ---------- */
const SORTS = { recent: 'Соңғы ашылған', added: 'Қосылған күні', title: 'Атауы', progress: 'Прогресс' };

function bookCard(b, d) {
  const pct = bookPct(b, d.vs);
  const badge = d.withAudio.has(b.id) ? `<span class="cv-badge">${ic('headphones', 16)}</span>` : '';
  return `<div class="bcard" data-id="${b.id}">
    <div class="bcard-cv">${coverHTML(b, '', badge)}<button class="icon-btn kebab card-k" data-k="${b.id}" aria-label="Мәзір">${ic('more', 18)}</button></div>
    ${pct ? `<div class="bar-p thin"><i style="width:${pct}%"></i></div>` : ''}
    <b>${esc(b.title)}</b><small>${esc(b.author || '')}</small></div>`;
}

async function showList(kind, val, focus) {
  setNav('lib'); rerender = () => showList(kind, val); view.dataset.page = 'list';
  const d = await libData();
  const col = COLLECTIONS.find(c => c[0] === kind);
  const base = kind === 'tag' ? d.books.filter(b => (b.tags || []).includes(val))
    : kind === 'author' ? d.books.filter(b => authorsOf(b).includes(val))
    : d.books.filter(b => col ? col[3](b, d) : true);
  const title = kind === 'tag' ? '#' + val : kind === 'author' ? val : col?.[2] || 'Барлығы';
  const sort = localStorage.kSort || 'recent';
  const q0 = showList.q || '';

  view.innerHTML = `
    <button class="back" id="lBack">${ic('back', 22)} Артқа</button>
    <header class="hd"><h1>${esc(title)}</h1><span class="hd-n">${base.length}</span></header>
    <div class="bar"><label class="search glass">${ic('search', 18)}<input id="q" placeholder="Атауы, автор, жанр, тег…" value="${esc(q0)}"></label>
      <select id="srt" class="glass" aria-label="Сұрыптау">${Object.entries(SORTS).map(([k, t]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="grid" id="grid"></div>`;
  const draw = () => {
    const q = $('#q').value.toLowerCase(), s = $('#srt').value;
    const list = base.filter(b => `${b.title} ${b.author} ${b.genre || ''} ${b.publisher || ''} ${(b.tags || []).join(' ')}`.toLowerCase().includes(q));
    const by = { recent: (a, c) => (c.lastOpened || c.added) - (a.lastOpened || a.added), added: (a, c) => c.added - a.added, title: (a, c) => a.title.localeCompare(c.title, 'kk'), progress: (a, c) => bookPct(c, d.vs) - bookPct(a, d.vs) }[s];
    list.sort(by);
    $('#grid').innerHTML = list.length ? list.map(b => bookCard(b, d)).join('') : `<div class="empty" style="grid-column:1/-1">${base.length ? 'Ештеңе табылмады' : 'Бұл жерде әзірге кітап жоқ'}</div>`;
  };
  draw();
  $('#lBack').onclick = () => (kind === 'tag' || kind === 'author') ? showGroups(kind === 'tag' ? 'shelves' : 'authors') : showLibrary();
  $('#q').oninput = e => { showList.q = e.target.value; draw(); };
  $('#srt').onchange = e => { localStorage.kSort = e.target.value; draw(); };
  $('#grid').onclick = e => { const k = e.target.closest('.card-k'); if (k) return bookMenu(k.dataset.k, k); const c = e.target.closest('.bcard'); if (c) showBook(c.dataset.id); };
  if (focus) $('#q').focus();
}

// Сөрелер (тегтер) немесе авторлар тізімі.
async function showGroups(kind) {
  setNav('lib'); rerender = () => showGroups(kind); view.dataset.page = 'groups';
  const books = await all('books'), map = new Map();
  for (const b of books) for (const k of kind === 'shelves' ? (b.tags || []) : authorsOf(b)) map.set(k, (map.get(k) || 0) + 1);
  const items = [...map].sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0], 'kk'));
  view.innerHTML = `
    <button class="back" id="gBack">${ic('back', 22)} Артқа</button>
    <header class="hd"><h1>${kind === 'shelves' ? 'Менің сөрелерім' : 'Авторлар'}</h1></header>
    ${items.length ? `<div class="glass list">${items.map(([k, n]) => `<button class="lrow" data-k="${esc(k)}">${ic(kind === 'shelves' ? 'tag' : 'user', 22)}<span>${esc(k)}</span><em>${n}</em>${ic('chevron-right', 18)}</button>`).join('')}</div>`
      : `<div class="empty">${kind === 'shelves' ? 'Сөре жасау үшін кітаптың ⋮ мәзірінен «Өңдеу» ашып, «Тегтер» өрісіне сөре атын жаз (мысалы: психология, жазғы оқу).' : 'Авторы көрсетілген кітап әлі жоқ.'}</div>`}`;
  $('#gBack').onclick = showLibrary;
  view.querySelector('.list')?.addEventListener('click', e => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) { showList.q = ''; showList(kind === 'shelves' ? 'tag' : 'author', k); } });
}
