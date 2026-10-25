'use strict';
/* Kitapp: кітапхананы Life Hub аккаунтының бұлтына сақтау (Supabase Storage, «kitapp» бакеті).
   Әр кітап: <user>/<bookId>/book.json (ақпарат, оқу орны, ескертпе, бетбелгі, статистика),
   <versionId>.pdf|.epub (файлдар) және cover.jpg. Құрылғыға тән деректер (мәтін индексі, mp3) жүктелмейді.
   Ереже: соңғы өзгеріс жеңеді; құрылғыда әлі жіберілмеген өзгеріс болса, сол жіберіледі. */

const CB = 'kitapp';
const SYNC_STORES = ['books', 'versions', 'notes', 'konspekt', 'marks', 'sessions'];
const PREP = ['indexed', 'chapters', 'words', 'prepV']; // әр құрылғы мәтінді өзі дайындайды
const Cl = { busy: false, timer: 0, quiet: false, err: '' };
const clState = () => { try { return { at: {}, files: [], cov: {}, dirty: [], ...JSON.parse(localStorage.kCloud || '{}') }; } catch { return { at: {}, files: [], cov: {}, dirty: [] }; } };
const clSave = s => { try { localStorage.kCloud = JSON.stringify(s); } catch { /* сақтау өшік */ } };
const cloudOn = () => localStorage.kCloudOff !== '1';
async function cloudUser() { try { return (await sb.auth.getSession()).data.session?.user || null; } catch { return null; } }

// put/del шақырады: кітап өзгерді, біраздан кейін бұлтқа жіберіледі
function cloudDirty(bookId) {
  if (Cl.quiet || !bookId || !cloudOn()) return;
  const s = clState(); if (!s.dirty.includes(bookId)) { s.dirty.push(bookId); clSave(s); }
  clearTimeout(Cl.timer); Cl.timer = setTimeout(cloudFlush, 4000);
}

const ok = ({ data, error }) => { if (error) throw new Error(error.message || String(error)); return data; };
const store = () => sb.storage.from(CB);

async function snapshot(id) {
  const b = await get('books', id); if (!b) return null;
  const { cover, ...book } = b;
  const strip = ({ blob, ...m }) => { for (const k of PREP) delete m[k]; return m; };
  const [vs, notes, marks, sessions] = await Promise.all(['versions', 'notes', 'marks', 'sessions'].map(n => byBook(n, id)));
  return { v: 1, at: Date.now(), book, versions: vs.map(strip), notes, marks, sessions, konspekt: (await get('konspekt', id)) || null };
}

async function pushBook(u, id, s) {
  const snap = await snapshot(id); if (!snap) return;
  const dir = `${u.id}/${id}`;
  for (const v of await byBook('versions', id)) {
    if (s.files.includes(v.id) || !v.blob) continue;
    ok(await store().upload(`${dir}/${v.id}.${v.type}`, v.blob, { upsert: true, contentType: v.type === 'pdf' ? 'application/pdf' : 'application/epub+zip' }));
    s.files.push(v.id); clSave(s);
  }
  const b = await get('books', id);
  if (b?.cover && s.cov[id] !== (b.coverAt || 1)) { ok(await store().upload(`${dir}/cover.jpg`, b.cover, { upsert: true, contentType: b.cover.type || 'image/jpeg' })); s.cov[id] = b.coverAt || 1; }
  // өшірілген нұсқалардың файлдары бұлттан да алынады
  const keep = new Set(['book.json', 'cover.jpg', ...snap.versions.map(v => `${v.id}.${v.type}`)]);
  const old = (ok(await store().list(dir, { limit: 1000 })) || []).filter(f => f.id && !keep.has(f.name)).map(f => `${dir}/${f.name}`);
  if (old.length) ok(await store().remove(old));
  ok(await store().upload(`${dir}/book.json`, new Blob([JSON.stringify(snap)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' }));
  s.at[id] = snap.at;
}

// Кезектегі өзгерістерді жіберу
async function cloudFlush() {
  if (Cl.busy || !cloudOn()) return;
  const u = await cloudUser(); if (!u) return;
  Cl.busy = true;
  try {
    const s = clState();
    while (s.dirty.length) { await pushBook(u, s.dirty[0], s); s.dirty.shift(); clSave(s); }
    s.last = Date.now(); clSave(s); Cl.err = '';
  } catch (e) { Cl.err = e.message; console.warn('cloud push', e); }
  finally { Cl.busy = false; }
}

// Бұлттағы өзгерістерді құрылғыға алу; өзгеріс болса true
async function applyBook(u, id, snap) {
  const dir = `${u.id}/${id}`, s = clState(), lb = await get('books', id);
  const book = { ...snap.book, cover: lb?.cover };
  if (snap.book.coverAt && snap.book.coverAt !== lb?.coverAt) { try { book.cover = ok(await store().download(`${dir}/cover.jpg`)); s.cov[id] = snap.book.coverAt; } catch { /* мұқабасыз */ } }
  const files = {};
  for (const m of snap.versions) if (!(await get('versions', m.id))) files[m.id] = ok(await store().download(`${dir}/${m.id}.${m.type}`)); // алдымен бәрін жүктеп аламыз: үзілсе, жартылай кітап қалмайды
  Cl.quiet = true;
  try {
    await put('books', book);
    const remote = new Set(snap.versions.map(v => v.id));
    for (const lv of await byBook('versions', id)) if (!remote.has(lv.id)) await deleteVersion(lv);
    for (const m of snap.versions) {
      const lv = await get('versions', m.id);
      await put('versions', lv ? { ...lv, ...m, blob: lv.blob } : { ...m, blob: files[m.id] });
      if (!s.files.includes(m.id)) s.files.push(m.id);
    }
    for (const n of ['notes', 'marks', 'sessions']) {
      const ids = new Set(snap[n].map(r => r.id));
      for (const r of await byBook(n, id)) if (!ids.has(r.id)) await del(n, r.id);
      for (const r of snap[n]) await put(n, r);
    }
    if (snap.konspekt) await put('konspekt', snap.konspekt); else await del('konspekt', id);
  } finally { Cl.quiet = false; }
  s.at[id] = snap.at; clSave(s);
}

async function cloudSync({ manual } = {}) {
  if (Cl.busy || !cloudOn() || !db) return false;
  const u = await cloudUser(); if (!u) { if (manual) toast('Бұлтқа сақтау үшін Life Hub-қа кіру керек'); return false; }
  Cl.busy = true; let changed = false;
  try {
    const list = ok(await store().list(u.id, { limit: 1000 })) || [];
    const remote = new Set(list.filter(f => !f.id).map(f => f.name));
    const s = clState();
    for (const id of remote) {
      if (s.dirty.includes(id)) continue; // құрылғыдағы өзгеріс жеңеді
      let snap; try { snap = JSON.parse(await ok(await store().download(`${u.id}/${id}/book.json`)).text()); } catch { continue; }
      if (snap.at > (s.at[id] || 0)) { await applyBook(u, id, snap); changed = true; }
    }
    // бұлтта болған, бірақ енді жоқ кітап басқа құрылғыда өшірілген
    for (const b of await all('books')) {
      if (remote.has(b.id)) continue;
      const st = clState();
      if (st.at[b.id] && !st.dirty.includes(b.id)) { Cl.quiet = true; try { await wipeLocal(b.id); } finally { Cl.quiet = false; } delete st.at[b.id]; clSave(st); changed = true; }
      else if (!st.dirty.includes(b.id)) { st.dirty.push(b.id); clSave(st); } // әлі бұлтқа жүктелмеген кітап
    }
    Cl.err = '';
  } catch (e) { Cl.err = e.message; console.warn('cloud pull', e); if (manual) toast('Бұлт: ' + cloudErr(e.message)); }
  finally { Cl.busy = false; }
  await cloudFlush();
  if (changed && typeof rerender === 'function') rerender();
  return changed;
}

const cloudErr = m => /bucket not found/i.test(m) ? 'бұлттық сақтау әлі бапталмаған (kitapp бакеті жоқ)' : /exceeded the maximum allowed size|too large/i.test(m) ? 'файл тым үлкен (бір файлға 50 МБ шегі)' : /row-level security|unauthorized|403/i.test(m) ? 'рұқсат жоқ: Hub иесінің аккаунтымен кіру керек' : m;

async function wipeLocal(id) {
  for (const n of ['versions', 'notes', 'sessions', 'drills', 'marks']) for (const r of await byBook(n, id)) await del(n, r.id);
  if (P.b?.id === id) pStop();
  await dropChunks(id); await del('chats', id); await del('konspekt', id); await del('books', id);
}

// Кітап өшірілгенде бұлттағы көшірмесі де өшеді
async function cloudRemove(id) {
  const s = clState(); s.dirty = s.dirty.filter(x => x !== id); delete s.at[id]; delete s.cov[id]; clSave(s);
  const u = await cloudUser(); if (!u) return;
  try {
    const dir = `${u.id}/${id}`, fs = ok(await store().list(dir, { limit: 1000 })) || [];
    if (fs.length) ok(await store().remove(fs.map(f => `${dir}/${f.name}`)));
  } catch (e) { console.warn('cloud remove', e); }
}

// Іске қосылғанда және қосымшаға қайта оралғанда (ең жиі минутына бір рет)
let lastPull = 0;
const autoSync = () => { if (Date.now() - lastPull < 60000) return; lastPull = Date.now(); cloudSync(); };
document.addEventListener('visibilitychange', () => document.hidden ? cloudFlush() : autoSync());
addEventListener('online', autoSync);
