'use strict';
/* Kitapp: сөрелер (өз жинақтарың, кітаптың tags өрісі) және сериялар (бір серияның кітаптары нөмір ретімен).
   Бос сөрелер де сақталуы үшін атаулары localStorage-та тұрады. */

const getShelfList = () => { try { return JSON.parse(localStorage.kShelves || '[]'); } catch { return []; } };
const setShelfList = a => { localStorage.kShelves = JSON.stringify([...new Set(a)]); };
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
async function renameGroup(kind, old) {
  const n = prompt(kind === 'tag' ? 'Сөренің жаңа атауы' : 'Серияның жаңа атауы', old)?.trim();
  if (!n || n === old) return null;
  for (const b of await all('books')) {
    if (kind === 'tag' && (b.tags || []).includes(old)) { b.tags = [...new Set(b.tags.map(t => t === old ? n : t))]; await put('books', b); }
    if (kind === 'series' && b.series === old) { b.series = n; await put('books', b); }
  }
  if (kind === 'tag') setShelfList(getShelfList().map(t => t === old ? n : t));
  return n;
}
async function deleteGroup(kind, name) {
  if (!confirm(kind === 'tag' ? `«${name}» сөресі өшеді. Кітаптар кітапханада қалады.` : `«${name}» сериясы өшеді. Кітаптар кітапханада қалады.`)) return false;
  for (const b of await all('books')) {
    if (kind === 'tag' && (b.tags || []).includes(name)) { b.tags = b.tags.filter(t => t !== name); await put('books', b); }
    if (kind === 'series' && b.series === name) { b.series = ''; b.seriesNo = ''; await put('books', b); }
  }
  if (kind === 'tag') setShelfList(getShelfList().filter(t => t !== name));
  return true;
}
// Жаңа сөре/серия: атауын сұрап, бірден кітаптарды таңдатады
async function createGroup(kind) {
  const n = prompt(kind === 'shelves' ? 'Жаңа сөренің атауы' : 'Жаңа серияның атауы (мыс: Абай жолы)')?.trim();
  if (!n) return;
  if (kind === 'shelves') setShelfList([...getShelfList(), n]);
  pickBooks(kind === 'shelves' ? `«${n}» сөресіне кітап қосу` : `«${n}» сериясы: кітаптарды ретімен таңда`, [], async ids => {
    if (kind === 'shelves') await shelfAssign(n, ids); else await seriesAssign(n, ids);
    showList.q = ''; showList(kind === 'shelves' ? 'tag' : 'series', n);
  });
}
