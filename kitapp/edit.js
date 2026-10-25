'use strict';
/* Kitapp: кітапты және оның нұсқаларын өңдеу, ⋮ мәзірлері, нұсқа қосу. */

const LANGS = { kk: 'Қазақша', ru: 'Орысша', en: 'Ағылшынша', tr: 'Түрікше', other: 'Басқа' };
const FIELDS = ['title', 'author', 'genre', 'year', 'lang', 'pages', 'isbn', 'publisher', 'series', 'seriesNo', 'tags', 'source', 'status', 'startDate', 'finishDate', 'summary'];
const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';

// Күйді өзгерткенде бос қалған күндерді өзі толтырады.
function applyStatus(b, st) {
  const t = KS.dayKey(Date.now());
  b.status = st;
  if (st === 'reading' && !b.startDate) b.startDate = t;
  if (st === 'done') { b.startDate = b.startDate || t; b.finishDate = b.finishDate || t; }
}

const refresh = () => rerender();

/* ---------- Нұсқалар ---------- */
async function addVersions(bookId, files, vname, kind) {
  const hasOriginal = (await byBook('versions', bookId)).some(v => v.kind === 'original');
  for (const f of files) {
    const type = typeOf(f);
    await put('versions', { id: uid(), bookId, name: vname || f.name.replace(/\.[^.]+$/, '') || type.toUpperCase(), type, kind: kind || (hasOriginal ? 'other' : 'original'), blob: f, pos: null, pct: 0, added: Date.now() });
  }
  if (files.length) toast('Нұсқа қосылды');
}

async function deleteVersion(v) {
  if (P.v?.id === v.id) pStop(); // ойнап тұрған нұсқа өшсе, плеер де жабылады
  await dropChunks(v.bookId, v.id); await del('versions', v.id);
}

// Нұсқа қосу терезесі: «Түпнұсқа», «Аударма» немесе «Басқа» деп белгілеуге болады.
async function openVerDialog(bookId, after) {
  const f = $('#verForm'); f.reset(); f.dataset.id = bookId; f._after = after;
  f.elements.kind.value = (await byBook('versions', bookId)).some(v => v.kind === 'original') ? 'translation' : 'original';
  $('#verDlg').showModal();
}
$('#verCancel').onclick = () => $('#verDlg').close();
$('#verForm').onsubmit = async e => {
  const f = e.target, id = f.dataset.id, d = new FormData(f);
  await addVersions(id, [...f.elements.file.files], d.get('vname').trim(), d.get('kind'));
  f._after ? f._after() : refresh();
};

/* ---------- Кітапты өңдеу ---------- */
async function drawEditFiles(id) {
  const vs = (await byBook('versions', id)).sort((a, c) => a.added - c.added);
  $('#eFiles').innerHTML = vs.length ? vs.map(v => `<div class="ver" data-id="${v.id}"><div><b>${esc(v.name)}</b> <span class="badge">${v.type.toUpperCase()}</span><br><small style="color:var(--mute)">${mb(v.blob.size)}</small></div>
    <div class="row"><select data-k style="width:auto">${Object.entries(KIND).map(([k, t]) => `<option value="${k}" ${(v.kind || 'other') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <button type="button" class="danger" data-d aria-label="Өшіру">${ic('trash', 16)}</button></div></div>`).join('') : '<div class="empty">Файл жоқ</div>';
  $('#eFiles').onchange = async e => { if (e.target.dataset.k == null) return; const v = vs.find(x => x.id === e.target.closest('.ver').dataset.id); v.kind = e.target.value; await put('versions', v); };
  $('#eFiles').onclick = async e => {
    const btn = e.target.closest('[data-d]'); if (!btn) return;
    const v = vs.find(x => x.id === btn.closest('.ver').dataset.id);
    if (confirm(`«${v.name}» файлы мен оның дайын мәтіні, аудиосы өшеді. Жалғастырамыз ба?`)) { await deleteVersion(v); drawEditFiles(id); }
  };
}
async function openEdit(id) {
  const b = await get('books', id), f = $('#editForm');
  f.reset();
  for (const k of FIELDS) f.elements[k].value = k === 'tags' ? (b.tags || []).join(', ') : (b[k] ?? '');
  f.dataset.id = id;
  await drawEditFiles(id);
  $('#eCv').innerHTML = coverHTML(b, 'cv-sm');
  $('#editDlg').showModal();
}
$('#editCancel').onclick = () => $('#editDlg').close();
$('#eCvReset').onclick = async () => {
  const b = await get('books', $('#editForm').dataset.id);
  b.cover = null; b.coverTried = false; await enrichBook(b);
  $('#eCv').innerHTML = coverHTML(b, 'cv-sm'); toast(b.cover ? 'Мұқаба файлдан алынды' : 'Файлда мұқаба табылмады');
};
$('#eAddFile').onclick = () => openVerDialog($('#editForm').dataset.id, () => drawEditFiles($('#editForm').dataset.id));
$('#editForm').onsubmit = async e => {
  const f = e.target, id = f.dataset.id, b = await get('books', id), d = Object.fromEntries(new FormData(f));
  const old = b.status;
  Object.assign(b, {
    title: d.title.trim() || b.title, author: d.author.trim(), genre: d.genre.trim(), year: d.year ? +d.year : '', lang: d.lang,
    pages: d.pages ? +d.pages : '', isbn: d.isbn.trim(), publisher: d.publisher.trim(), series: d.series.trim(), seriesNo: d.series.trim() && d.seriesNo !== '' ? +d.seriesNo : '', source: d.source, startDate: d.startDate, finishDate: d.finishDate, summary: d.summary.trim(),
    tags: d.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
  });
  setShelfList([...getShelfList(), ...b.tags]);
  if (d.status !== old) applyStatus(b, d.status);
  if (d.title.trim()) b.titleAuto = false;
  const img = f.elements.coverFile.files[0];
  if (img) { try { b.cover = await shrink(img); b.coverAt = Date.now(); } catch { toast('Суретті оқу мүмкін болмады'); } }
  await put('books', b); toast('Сақталды'); refresh();
};

async function deleteBook(id, after) {
  if (!confirm('Кітап, барлық нұсқасы, конспект, ескертпелер және оқу статистикасы жойылады. Жалғастырамыз ба?')) return;
  await cloudRemove(id); // алдымен бұлттан: кезектегі жіберу кітапты қайта жүктемесін
  Cl.quiet = true;
  try { await wipeLocal(id); } finally { Cl.quiet = false; }
  try { delete localStorage['kPlay:' + id]; } catch { /* сақтау өшік */ }
  toast('Кітап өшірілді');
  (after || showLibrary)();
}

/* ---------- ⋮ мәзірлері ---------- */
function closeMenu() { document.querySelector('.menu')?.remove(); }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu, .kebab')) closeMenu(); });
document.addEventListener('keydown', e => e.key === 'Escape' && closeMenu());

// items: [{a, icon, text, cls}] немесе {sep: 'Тақырып'}
function popup(anchor, items, onPick) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = items.map(i => i.sep ? `<div class="msep">${esc(i.sep)}</div>` : `<button data-a="${i.a}" class="${i.cls || ''}">${ic(i.icon, 17)} <span>${esc(i.text)}</span></button>`).join('');
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
  m.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a) { closeMenu(); onPick(a); } };
}

async function bookMenu(id, anchor) {
  const b = await get('books', id);
  popup(anchor, [
    { a: 'edit', icon: 'edit', text: 'Өңдеу' },
    { a: 'addver', icon: 'file-plus', text: 'Нұсқа қосу' },
    { a: 'shelf', icon: 'shelves', text: 'Сөре және серия' },
    b.status !== 'done' ? { a: 'done', icon: 'check', text: 'Оқыдым деп белгілеу' } : { a: 'reading', icon: 'book-open', text: 'Қайта оқып жатырмын' },
    { a: 'listen', icon: 'headphones', text: 'Тыңдау' }, { a: 'speed', icon: 'zap', text: 'Жылдам оқу' }, { a: 'chat', icon: 'chat', text: 'ЖИ-мен талқылау' }, { a: 'audio', icon: 'music', text: 'Аудио жасау (mp3)' },
    { a: 'del', icon: 'trash', text: 'Жою', cls: 'danger' },
  ], async a => {
    if (a === 'edit') openEdit(id);
    if (a === 'addver') openVerDialog(id);
    if (a === 'shelf') openShelfDlg(id);
    if (a === 'chat') showChat(id);
    if (a === 'audio') showAudio(id);
    if (a === 'listen') Player.open(b);
    if (a === 'speed') continueReading(b, true);
    if (a === 'del') deleteBook(id);
    if (a === 'done' || a === 'reading') { applyStatus(b, a); await put('books', b); refresh(); }
  });
}

// Нұсқаның ⋮ мәзірі: оқу, мәтінді дайындау, атауы, түрі (түпнұсқа/аударма), жүктеп алу, жою.
async function versionMenu(v, anchor) {
  const b = await get('books', v.bookId), k = v.kind || 'other';
  popup(anchor, [
    { a: 'open', icon: 'book-open', text: 'Оқу' },
    ...(v.kind !== 'clean' ? [{ a: 'conv', icon: 'layers', text: 'Таза нұсқа жасау (EPUB)' }] : [{ a: 'conv', icon: 'list', text: 'Мазмұнды түзету' }, ...(v.sourceId ? [{ a: 'reconv', icon: 'refresh', text: 'Түпнұсқадан қайта жасау' }] : [])]),
    { a: 'prep', icon: 'refresh', text: isReady(v) ? 'Бөлімдерді қайта бөлу' : 'Бөлімдерге бөлу' },
    { a: 'ren', icon: 'edit', text: 'Атауын өзгерту' },
    { sep: 'Түрі' },
    ...Object.entries(KIND).map(([key, t]) => ({ a: 'k:' + key, icon: k === key ? 'check' : 'tag', text: t })),
    { a: 'dl', icon: 'download', text: 'Файлды жүктеп алу' },
    { a: 'del', icon: 'trash', text: 'Жою', cls: 'danger' },
  ], async a => {
    if (a === 'open') openReader(b, v);
    if (a === 'conv') showConvert(b, v, () => showBook(b.id));
    if (a === 'reconv') { const src = await get('versions', v.sourceId); src ? showConvert(b, src, () => showBook(b.id)) : toast('Түпнұсқа файл өшірілген'); }
    if (a === 'prep') renderPrep(b, v, () => showBook(b.id), () => showBook(b.id), 'мәтін');
    if (a === 'ren') { const n = prompt('Нұсқа аты', v.name); if (n) { v.name = n.trim(); await put('versions', v); showBook(b.id); } }
    if (a.startsWith('k:')) { v.kind = a.slice(2); await put('versions', v); showBook(b.id); }
    if (a === 'dl') saveBlob(v.blob, `${v.name}.${v.type}`);
    if (a === 'del' && confirm('Бұл нұсқа, оның дайын мәтіні және аудиосы өшеді. Жалғастырамыз ба?')) { await deleteVersion(v); showBook(b.id); }
  });
}
