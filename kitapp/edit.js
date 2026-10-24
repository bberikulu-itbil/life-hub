'use strict';
/* Kitapp 4-кезең: кітапты өңдеу (⋮ мәзірі арқылы), қосымша деректер өрістері. */

const LANGS = { kk: 'Қазақша', ru: 'Орысша', en: 'Ағылшынша', tr: 'Түрікше', other: 'Басқа' };
const FIELDS = ['title', 'author', 'genre', 'year', 'lang', 'pages', 'isbn', 'tags', 'source', 'status', 'startDate', 'finishDate', 'summary'];

// Күйді өзгерткенде бос қалған күндерді өзі толтырады.
function applyStatus(b, st) {
  const t = KS.dayKey(Date.now());
  b.status = st;
  if (st === 'reading' && !b.startDate) b.startDate = t;
  if (st === 'done') { b.startDate = b.startDate || t; b.finishDate = b.finishDate || t; }
}

function chips(b) {
  const c = [b.genre, b.year, LANGS[b.lang], b.pages && `${b.pages} бет`, b.isbn && `ISBN ${b.isbn}`, b.source, ...(b.tags || []).map(t => '#' + t),
    b.startDate && `Басталды: ${b.startDate}`, b.finishDate && `Аяқталды: ${b.finishDate}`].filter(Boolean);
  return c.map(x => `<span class="badge">${esc(x)}</span>`).join(' ');
}

const refresh = id => $('#grid') ? showLibrary() : showBook(id);

async function openEdit(id) {
  const b = await get('books', id), f = $('#editForm');
  f.reset();
  for (const k of FIELDS) f.elements[k].value = k === 'tags' ? (b.tags || []).join(', ') : (b[k] ?? '');
  f.dataset.id = id;
  $('#editDlg').showModal();
}
$('#editCancel').onclick = () => $('#editDlg').close();
$('#editForm').onsubmit = async e => {
  const f = e.target, id = f.dataset.id, b = await get('books', id), d = Object.fromEntries(new FormData(f));
  const old = b.status;
  Object.assign(b, {
    title: d.title.trim() || b.title, author: d.author.trim(), genre: d.genre.trim(), year: d.year ? +d.year : '', lang: d.lang,
    pages: d.pages ? +d.pages : '', isbn: d.isbn.trim(), source: d.source, startDate: d.startDate, finishDate: d.finishDate, summary: d.summary.trim(),
    tags: d.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
  });
  if (d.status !== old) applyStatus(b, d.status);
  await put('books', b); toast('Сақталды'); refresh(id);
};

async function deleteBook(id) {
  if (!confirm('Кітап, барлық нұсқасы, конспект, ескертпелер және оқу статистикасы жойылады. Жалғастырамыз ба?')) return;
  for (const n of ['versions', 'notes', 'sessions', 'drills']) for (const r of await byBook(n, id)) await del(n, r.id);
  await dropChunks(id); await del('chats', id); await del('konspekt', id); await del('books', id);
  showLibrary();
}

/* ---------- ⋮ мәзірі ---------- */
function closeMenu() { document.querySelector('.menu')?.remove(); }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu, .kebab')) closeMenu(); });
document.addEventListener('keydown', e => e.key === 'Escape' && closeMenu());

async function bookMenu(id, anchor) {
  closeMenu();
  const b = await get('books', id);
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = `<button data-a="edit">✏️ Өңдеу</button>
    ${b.status !== 'done' ? '<button data-a="done">✅ Оқыдым деп белгілеу</button>' : '<button data-a="reading">📖 Қайта оқып жатырмын</button>'}
    <button data-a="chat">💬 ЖИ-мен талқылау</button><button data-a="audio">🎧 Аудио</button><button data-a="speed">⚡ Жылдам оқу</button>
    <button data-a="del" class="danger">🗑 Жою</button>`;
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
  m.onclick = async e => {
    const a = e.target.dataset.a; if (!a) return;
    closeMenu();
    if (a === 'edit') openEdit(id);
    if (a === 'chat') showChat(id);
    if (a === 'audio') showAudio(id);
    if (a === 'speed') showSpeed(id);
    if (a === 'del') deleteBook(id);
    if (a === 'done' || a === 'reading') { applyStatus(b, a); await put('books', b); refresh(id); }
  };
}
