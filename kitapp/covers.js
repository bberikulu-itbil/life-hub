'use strict';
/* Мұқаба мен метадеректер: файлдың өзінен алынады (PDF — 1-бет, EPUB — cover суреті және OPF ақпараты). */

const toBlob = (c, q = .85) => new Promise(r => c.toBlob(r, 'image/jpeg', q));

async function shrink(blob, w = 360) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, w / bmp.width), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return toBlob(c);
}

const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim();

// { cover: Blob|null, meta: {title, author, publisher, year, lang, isbn, summary, pages} }
async function readFileInfo(v) {
  const buf = await v.blob.arrayBuffer(), meta = {};
  let cover = null;
  if (v.type === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    try {
      meta.pages = pdf.numPages;
      const info = (await pdf.getMetadata().catch(() => null))?.info || {};
      meta.title = info.Title; meta.author = info.Author;
      const p = await pdf.getPage(1), vp0 = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: 360 / vp0.width });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      cover = await toBlob(c);
    } finally { pdf.destroy(); }
  } else {
    const book = ePub(buf);
    try {
      const m = await book.loaded.metadata;
      Object.assign(meta, { title: m.title, author: m.creator, publisher: m.publisher, lang: (m.language || '').slice(0, 2), summary: stripHtml(m.description) });
      const y = String(m.pubdate || '').match(/\d{4}/); if (y) meta.year = +y[0];
      const isbn = String(m.identifier || '').replace(/^urn:isbn:/i, ''); if (/^[\d-]{10,17}X?$/i.test(isbn)) meta.isbn = isbn;
      const url = await book.coverUrl();
      if (url) cover = await shrink(await (await fetch(url)).blob());
    } finally { book.destroy(); }
  }
  return { cover, meta };
}

// Бос өрістерді файлдағы ақпаратпен толтырады; қолмен жазылғанына тимейді.
async function enrichBook(b) {
  const vs = (await byBook('versions', b.id)).sort((x, y) => (x.kind === 'original' ? -1 : 0) - (y.kind === 'original' ? -1 : 0) || x.added - y.added);
  let changed = false;
  for (const v of vs) {
    let r;
    try { r = await readFileInfo(v); } catch (e) { console.warn('cover', e); continue; }
    const m = r.meta;
    if (b.titleAuto && m.title?.trim()) { b.title = m.title.trim(); b.titleAuto = false; changed = true; }
    for (const k of ['author', 'publisher', 'year', 'isbn', 'summary', 'pages']) if (!b[k] && m[k]) { b[k] = typeof m[k] === 'string' ? m[k].trim() : m[k]; changed = true; }
    if (!b.lang && LANGS[m.lang]) { b.lang = m.lang; changed = true; }
    if (!b.cover && r.cover) { b.cover = r.cover; b.coverAt = Date.now(); changed = true; }
    if (b.cover) break;
  }
  b.coverTried = true;
  await put('books', b);
  return changed;
}

// Бұрын қосылған, мұқабасы жоқ кітаптар үшін бір рет фонда іздейді.
let coversBusy = false;
async function ensureCovers(books, onChanged) {
  if (coversBusy) return;
  coversBusy = true;
  let any = false;
  for (const b of books.filter(x => !x.cover && !x.coverTried)) any = (await enrichBook(b).catch(() => false)) || any;
  coversBusy = false;
  if (any) onChanged();
}

const coverCache = new Map();
function coverURL(b) {
  if (!b?.cover) return null;
  const k = `${b.id}:${b.coverAt || 0}`;
  if (!coverCache.has(k)) coverCache.set(k, URL.createObjectURL(b.cover));
  return coverCache.get(k);
}
function coverHTML(b, cls = '', badge = '') {
  const u = coverURL(b);
  return u ? `<div class="cv ${cls}"><img src="${u}" alt="" loading="lazy" decoding="async">${badge}</div>`
    : `<div class="cv cv-gen ${cls}" style="${cover(b.title)}"><span>${esc(b.title)}</span><small>${esc(b.author || '')}</small>${badge}</div>`;
}
