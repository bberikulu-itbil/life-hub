'use strict';
/* Kitapp 2-кезең: ЖИ чат. Кітап мәтіні құрылғыда бөлшектеніп сақталады, сұраққа керек үзінділер ғана Edge Function-ға кетеді. */

// Life Hub-пен бір сайт (origin), сондықтан Hub-қа кірген сессия осында да жұмыс істейді.
const sb = supabase.createClient('https://lcmnkcpkbkrktediyvpo.supabase.co', 'sb_publishable_Z0BZxemzhkUPo_lfgxMAbA_9TkVXL2q');
const ALL = '__all__';

const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });

async function dropChunks(bookId, versionId) {
  const cs = (await byBook('chunks', bookId)).filter(c => !versionId || c.versionId === versionId);
  const tx = db.transaction('chunks', 'readwrite');
  cs.forEach(c => tx.objectStore('chunks').delete(c.id));
  await done(tx);
}

async function extractParts(v, onProg) {
  const buf = await v.blob.arrayBuffer(), parts = [];
  if (v.type === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      parts.push({ ref: `бет ${p}`, text: tc.items.map(i => i.str).join(' ') });
      if (p % 10 === 0) onProg(`${p}/${pdf.numPages}`);
    }
    pdf.destroy();
  } else {
    const book = ePub(buf); await book.ready;
    const items = book.spine.spineItems;
    for (let i = 0; i < items.length; i++) {
      const c = await items[i].load(book.load.bind(book));
      parts.push({ ref: `бөлім ${i + 1}`, text: c?.textContent || '' });
      items[i].unload(); onProg(`${i + 1}/${items.length}`);
    }
    book.destroy();
  }
  return parts;
}

async function indexVersion(b, v, onProg) {
  const parts = await extractParts(v, onProg);
  if (parts.reduce((a, p) => a + p.text.length, 0) < 200) throw new Error('Мәтін табылмады (скан PDF болуы мүмкін, оған OCR керек)');
  let n = 0;
  const chunks = parts.flatMap(p => RAG.chunkText(p.text).map(text => ({ id: uid(), bookId: b.id, versionId: v.id, title: b.title, ref: p.ref, text, tf: RAG.tfOf(text), n: n++ })));
  await dropChunks(b.id, v.id);
  const tx = db.transaction('chunks', 'readwrite');
  chunks.forEach(c => tx.objectStore('chunks').put(c));
  await done(tx);
  v.indexed = chunks.length; await put('versions', v);
}

async function loadChunks(bookId) {
  const cs = bookId ? await byBook('chunks', bookId) : await all('chunks');
  return cs.sort((a, b) => a.bookId.localeCompare(b.bookId) || a.versionId.localeCompare(b.versionId) || a.n - b.n);
}

async function errText(error) {
  try { const j = await error.context.json(); if (j?.error) return j.error; } catch { /* дене JSON емес */ }
  return error.message || 'Белгісіз қате';
}

async function showChat(bookId) {
  const b = bookId ? await get('books', bookId) : null;
  const key = bookId || ALL;
  const vs = bookId ? await byBook('versions', bookId) : [];
  const chat = (await get('chats', key)) || { bookId: key, messages: [] };
  const { data: { session } } = await sb.auth.getSession();

  view.innerHTML = `
    <button class="ghost" id="cBack">← ${b ? 'Кітапқа' : 'Кітапхана'}</button>
    <div class="sec"><h3>💬 ${b ? esc(b.title) : 'Бүкіл кітапхана бойынша чат'}</h3>
      <small style="color:var(--mute)">Чат кітап мәтінінен сұраққа керек үзінділерді тауып, ЖИ-ға жібереді. Мәтіннің қалған бөлігі құрылғыдан шықпайды.</small>
      <div id="idx" style="margin-top:.6rem"></div>
      ${session ? '' : '<p style="color:var(--warn)">ЖИ жұмыс істеуі үшін алдымен <a href="../">Life Hub</a>-қа кіру керек.</p>'}
    </div>
    <div class="chat" id="msgs"></div>
    <div class="composer"><textarea id="cIn" rows="2" placeholder="Кітап туралы сұра…"></textarea>
      <div class="row end"><button class="ghost" id="cClear">Тазалау</button><button class="primary" id="cSend">Жіберу</button></div></div>`;

  $('#cBack').onclick = () => b ? showBook(bookId) : showLibrary();

  const drawIdx = async () => {
    if (b) {
      $('#idx').innerHTML = vs.length ? vs.map(v => `<div class="ver" data-id="${v.id}"><div><b>${esc(v.name)}</b> <span class="badge">${v.type.toUpperCase()}</span> <small style="color:var(--mute)">${v.indexed ? `✓ ${v.indexed} үзінді` : 'мәтін дайындалмаған'}</small></div><button data-a="idx">${v.indexed ? 'Қайта дайындау' : 'Мәтінді дайындау'}</button></div>`).join('') : '<div class="empty">Алдымен кітапқа нұсқа қос</div>';
    } else {
      const bs = new Set((await all('chunks')).map(c => c.bookId));
      $('#idx').innerHTML = `<small>Мәтіні дайын кітаптар: <b>${bs.size}</b>. Қалғанын кітап бетіндегі «💬» арқылы дайында.</small>`;
    }
  };
  await drawIdx();
  $('#idx').onclick = async e => {
    if (e.target.dataset.a !== 'idx') return;
    const btn = e.target, v = vs.find(x => x.id === btn.closest('.ver').dataset.id);
    btn.disabled = true;
    try { await indexVersion(b, v, p => btn.textContent = `Оқуда… ${p}`); toast('Мәтін дайын'); }
    catch (err) { console.error(err); toast(err.message); }
    drawIdx();
  };

  const draw = () => {
    $('#msgs').innerHTML = chat.messages.length ? chat.messages.map((m, i) => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}">${fmt(m.content)}${m.role === 'assistant' && b ? `<div><button class="ghost" data-k="${i}">→ Конспектке</button></div>` : ''}</div>`).join('') : '<div class="empty">Мысалы: «Негізгі идеясы қандай?», «3-тараудың қысқаша мазмұнын айт»</div>';
    window.scrollTo(0, document.body.scrollHeight);
  };
  draw();
  $('#msgs').onclick = async e => {
    const i = e.target.dataset.k; if (i == null) return;
    const m = chat.messages[i], q = chat.messages[i - 1];
    const ks = (await get('konspekt', bookId)) || { bookId, text: '' };
    ks.text += `${ks.text ? '\n\n' : ''}**${q?.content || ''}**\n${m.content}`; ks.updated = Date.now();
    await put('konspekt', ks); toast('Конспектке қосылды');
  };
  $('#cClear').onclick = async () => { if (!confirm('Чат тарихы өшеді. Жалғастырамыз ба?')) return; chat.messages = []; await put('chats', chat); draw(); };

  let busy = false;
  const send = async () => {
    const q = $('#cIn').value.trim(); if (!q || busy) return;
    if (!session) return toast('Алдымен Life Hub-қа кір');
    busy = true; $('#cSend').disabled = true; $('#cIn').value = '';
    chat.messages.push({ role: 'user', content: q }); draw();
    try {
      const chunks = await loadChunks(bookId);
      const recent = chat.messages.filter(m => m.role === 'user').slice(-2).map(m => m.content).join(' ');
      const picks = RAG.rank(recent, chunks, 8);
      const [ks, notes] = bookId ? await Promise.all([get('konspekt', bookId), byBook('notes', bookId)]) : [null, []];
      if (!chunks.length) toast('Мәтін дайындалмаған: жауап конспект пен ескертпеге ғана сүйенеді');
      const { data, error } = await sb.functions.invoke('book-chat', { body: {
        title: b?.title || '', author: b?.author || '', konspekt: ks?.text || '',
        excerpts: picks.map(c => ({ ref: c.ref, text: c.text, title: c.title })),
        notes: notes.map(n => `${n.ref}: ${n.text}`),
        messages: chat.messages.filter(m => !m.content.startsWith('⚠️')).map(({ role, content }) => ({ role, content })),
        models: JSON.parse(localStorage.getItem('hub.models') || '[]'),
      } });
      if (error) throw new Error(await errText(error));
      chat.messages.push({ role: 'assistant', content: data.text, model: data.model });
    } catch (err) {
      chat.messages.push({ role: 'assistant', content: '⚠️ ' + err.message });
    }
    await put('chats', chat); busy = false; $('#cSend').disabled = false; draw();
  };
  $('#cSend').onclick = send;
  $('#cIn').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
}
