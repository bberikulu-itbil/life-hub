'use strict';
/* Kitapp: сөрелер (өз жинақтарың, кітаптың tags өрісі) және сериялар (бір серияның кітаптары нөмір ретімен).
   Бос сөрелер де сақталуы үшін атаулары localStorage-та тұрады. */

// Сөре мен серия туралы қосымша ақпарат (сипаттама, белгіше) localStorage-та: [{ name, desc, icon }]
const META_KEY = { shelves: 'kShelves', series: 'kSeriesMeta' };
const metaList = k => { try { return JSON.parse(localStorage[META_KEY[k]] || '[]').map(x => typeof x === 'string' ? { name: x } : x); } catch { return []; } };
const metaSave = (k, list) => { const seen = new Set(); localStorage[META_KEY[k]] = JSON.stringify(list.filter(x => x.name && !seen.has(x.name) && seen.add(x.name))); };
const metaGet = (k, name) => metaList(k).find(x => x.name === name) || { name };
const getShelfList = () => metaList('shelves').map(x => x.name);
const setShelfList = names => { const m = metaList('shelves'); metaSave('shelves', names.map(n => m.find(x => x.name === n) || { name: n })); };
const SHELF_ICONS = ['folder', 'bookmark', 'edit', 'book-open', 'mic', 'smile', 'star', 'feather', 'music', 'coffee', 'heart', 'zap', 'globe', 'target', 'flag'];
const shelfIcon = (name, size = 22) => `<span class="sh-ic">${ic(metaGet('shelves', name).icon || 'folder', size)}</span>`;
const byKk = (a, c) => a.localeCompare(c, 'kk');
const shelfNames = books => [...new Set([...getShelfList(), ...books.flatMap(b => b.tags || [])])].sort(byKk);
const seriesNames = books => [...new Set(books.map(b => (b.series || '').trim()).filter(Boolean))].sort(byKk);
const seriesBooks = (books, name) => books.filter(b => b.series === name).sort((a, c) => (a.seriesNo ?? 1e9) - (c.seriesNo ?? 1e9) || byKk(a.title, c.title));
const seriesLabel = b => b.series ? `${b.seriesNo != null && b.seriesNo !== '' ? `${b.seriesNo}-кітап` : 'Серия'}` : '';

/* ---------- Кітапты сөрелер мен серияға қосу ---------- */
async function openShelfDlg(id) {
  const [b, books] = [await get('books', id), await all('books')];
  const D = $('#shelfDlg'), F = $('#shelfForm');
  const chip = (n, on) => `<label class="fchip ${on ? 'on' : ''}"><input type="checkbox" value="${esc(n)}" ${on ? 'checked' : ''} hidden>${esc(n)}</label>`;
  F.dataset.id = id;
  F.querySelector('.sd-body').innerHTML = `
    <h4>Сөрелер</h4><div class="fwrap" id="sdShelves">${shelfNames(books).map(n => chip(n, (b.tags || []).includes(n))).join('') || '<small class="muted" id="sdNone">Әзірге сөре жоқ: төменде жаса.</small>'}</div>
    <div class="row" style="margin-top:.6rem;flex-wrap:nowrap"><input id="sdNew" placeholder="Жаңа сөре: мыс. Жазғы оқу"><button type="button" id="sdAdd" aria-label="Сөре қосу">${ic('plus', 18)}</button></div>
    <h4>Серия</h4>
    <div class="fgrid"><label>Серия атауы <input id="sdSeries" list="seriesList" value="${esc(b.series || '')}" placeholder="мыс: Абай жолы"></label>
      <label>Сериядағы нөмірі <input id="sdNo" type="number" min="0" step="1" value="${b.seriesNo ?? ''}" placeholder="бос болса — соңына"></label></div>
    <datalist id="seriesList">${seriesNames(books).map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  $('#sdShelves').onchange = e => e.target.closest('label')?.classList.toggle('on', e.target.checked);
  $('#sdAdd').onclick = () => {
    const n = $('#sdNew').value.trim(); if (!n) return;
    $('#sdNone')?.remove();
    if (![...$('#sdShelves').querySelectorAll('input')].some(i => i.value === n)) $('#sdShelves').insertAdjacentHTML('beforeend', chip(n, true));
    $('#sdNew').value = '';
  };
  $('#sdNew').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#sdAdd').click(); } };
  D.showModal();
}
$('#shelfCancel').onclick = () => $('#shelfDlg').close();
$('#shelfForm').onsubmit = async e => {
  const id = e.target.dataset.id, b = await get('books', id), books = await all('books');
  b.tags = [...$('#sdShelves').querySelectorAll('input:checked')].map(i => i.value);
  setShelfList([...getShelfList(), ...b.tags]);
  const s = $('#sdSeries').value.trim(), no = $('#sdNo').value;
  b.series = s;
  b.seriesNo = !s ? '' : no !== '' ? +no : (b.series === s && b.seriesNo !== '' && b.seriesNo != null ? b.seriesNo : Math.max(0, ...seriesBooks(books.filter(x => x.id !== id), s).map(x => +x.seriesNo || 0)) + 1);
  await put('books', b); toast('Сақталды'); rerender();
};

/* ---------- Бірнеше кітапты таңдау терезесі (сөреге не серияға қосу үшін) ---------- */
// selected — бастапқы таңдалғандар; onSave(ids) — таңдау реті сақталады (серия нөмірлеу үшін)
async function pickBooks(title, selected, onSave) {
  const books = (await all('books')).sort((a, c) => byKk(a.title, c.title));
  const order = [...selected], D = $('#pickDlg');
  D.querySelector('h3').textContent = title;
  const draw = () => D.querySelector('.pk-body').innerHTML = books.map(b => {
    const k = order.indexOf(b.id);
    return `<button type="button" class="pk-row ${k >= 0 ? 'on' : ''}" data-id="${b.id}">${coverHTML(b, 'cv-xs')}<span><b>${esc(b.title)}</b><small class="muted">${esc(b.author || '')}</small></span><em>${k >= 0 ? k + 1 : ''}</em></button>`;
  }).join('') || '<div class="empty">Кітап жоқ</div>';
  draw();
  D.querySelector('.pk-body').onclick = e => {
    const r = e.target.closest('[data-id]'); if (!r) return;
    const k = order.indexOf(r.dataset.id); k >= 0 ? order.splice(k, 1) : order.push(r.dataset.id); draw();
  };
  $('#pickOk').onclick = async () => { D.close(); await onSave(order); };
  $('#pickCancel').onclick = () => D.close();
  D.showModal();
}

/* ---------- Сөре мен серияны басқару ---------- */
async function shelfAssign(name, ids) {
  for (const b of await all('books')) {
    const has = (b.tags || []).includes(name), want = ids.includes(b.id);
    if (has !== want) { b.tags = want ? [...(b.tags || []), name] : b.tags.filter(t => t !== name); await put('books', b); }
  }
}
async function seriesAssign(name, ids) {
  for (const b of await all('books')) {
    const k = ids.indexOf(b.id);
    if (k >= 0) { b.series = name; b.seriesNo = k + 1; await put('books', b); }
    else if (b.series === name) { b.series = ''; b.seriesNo = ''; await put('books', b); }
  }
}
// Атауын өзгерткенде кітаптардағы сілтемелер де жаңарады
async function renameGroup(kind, old, n) {
  for (const b of await all('books')) {
    if (kind === 'tag' && (b.tags || []).includes(old)) { b.tags = [...new Set(b.tags.map(t => t === old ? n : t))]; await put('books', b); }
    if (kind === 'series' && b.series === old) { b.series = n; await put('books', b); }
  }
}
async function deleteGroup(kind, name) {
  if (!confirm(kind === 'tag' ? `«${name}» сөресі өшеді. Кітаптар кітапханада қалады.` : `«${name}» сериясы өшеді. Кітаптар кітапханада қалады.`)) return false;
  for (const b of await all('books')) {
    if (kind === 'tag' && (b.tags || []).includes(name)) { b.tags = b.tags.filter(t => t !== name); await put('books', b); }
    if (kind === 'series' && b.series === name) { b.series = ''; b.seriesNo = ''; await put('books', b); }
  }
  const k = kind === 'tag' ? 'shelves' : 'series';
  metaSave(k, metaList(k).filter(x => x.name !== name));
  return true;
}
/* ---------- Сөре/серия жасау және өңдеу терезесі ---------- */
// kind: 'shelves' | 'series'; old — өңделетін атау (жаңасы үшін бос)
async function openGroupDlg(kind, old) {
  const books = await all('books'), D = $('#colDlg'), shelf = kind === 'shelves';
  const meta = old ? metaGet(kind, old) : { name: '', desc: '', icon: 'folder' };
  let icon = meta.icon || 'folder';
  const sample = (old ? (shelf ? books.filter(b => (b.tags || []).includes(old)) : seriesBooks(books, old)) : [...books].sort((a, c) => c.added - a.added)).slice(0, 3);
  D.querySelector('.col-hd b').textContent = old ? (shelf ? 'Сөрені өңдеу' : 'Серияны өңдеу') : (shelf ? 'Сөре жасау' : 'Серия жасау');
  D.querySelector('.col-prev').innerHTML = `<div class="fan">${sample.map(b => coverHTML(b, 'cv-sm')).join('') || ic(shelf ? 'shelves' : 'layers', 48)}</div>
    <small class="muted">${shelf ? 'Кітаптарыңды оңай табылатын тізімдерге жина' : 'Бір серияның кітаптарын ретімен байланыстыр'}</small>`;
  $('#colName').value = meta.name; $('#colDesc').value = meta.desc || '';
  $('#colName').placeholder = shelf ? 'мыс: Жазғы оқу' : 'мыс: Абай жолы';
  const drawIcons = () => $('#colIcons').innerHTML = SHELF_ICONS.map(n => `<button type="button" class="${n === icon ? 'on' : ''}" data-i="${n}" aria-label="${n}">${ic(n, 22)}</button>`).join('');
  $('#colIconsWrap').hidden = !shelf;
  drawIcons();
  $('#colIcons').onclick = e => { const n = e.target.closest('[data-i]')?.dataset.i; if (n) { icon = n; drawIcons(); } };
  const ok = $('#colOk'), check = () => { ok.disabled = !$('#colName').value.trim(); };
  ok.textContent = old ? 'Сақтау' : shelf ? 'Сөре жасау' : 'Серия жасау';
  $('#colName').oninput = check; check();
  $('#colX').onclick = () => D.close();
  ok.onclick = async () => {
    const name = $('#colName').value.trim(), existing = shelf ? shelfNames(books) : seriesNames(books);
    if (name !== old && existing.includes(name)) return toast('Бұл атаумен ' + (shelf ? 'сөре' : 'серия') + ' бар');
    if (old && name !== old) await renameGroup(shelf ? 'tag' : 'series', old, name);
    metaSave(kind, [...metaList(kind).filter(x => x.name !== old && x.name !== name), { name, desc: $('#colDesc').value.trim(), icon: shelf ? icon : undefined }]);
    D.close();
    if (old) return showList(shelf ? 'tag' : 'series', name);
    pickBooks(shelf ? `«${name}» сөресіне кітап қосу` : `«${name}» сериясы: кітаптарды ретімен таңда`, [], async ids => {
      if (shelf) await shelfAssign(name, ids); else await seriesAssign(name, ids);
      showList.q = ''; showList(shelf ? 'tag' : 'series', name);
    });
  };
  D.showModal(); setTimeout(() => $('#colName').focus(), 50);
}
const createGroup = kind => openGroupDlg(kind);
