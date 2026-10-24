'use strict';
/* Kitapp: жүктелген кітапты «таза нұсқаға» айналдыру.
   PDF/EPUB → құрылым (тараулар, абзацтар) → қаласаң ЖИ-мен тазарту → EPUB файл → бөлімдерге бөлу.
   Нәтиже кітапқа kind: 'clean' нұсқа болып қосылады; тыңдау, жылдам оқу, чат осыны қолданады. */

const AI_BATCH = 9000; // ЖИ-ге бір сұраумен жіберілетін таңба саны

async function pdfOutline(pdf) {
  const out = [];
  try {
    for (const o of (await pdf.getOutline()) || []) {
      let d = o.dest; if (typeof d === 'string') d = await pdf.getDestination(d);
      if (Array.isArray(d)) out.push({ title: o.title, page: await pdf.getPageIndex(d[0]) });
    }
  } catch { /* мазмұн жоқ */ }
  return out;
}

async function pdfStructure(v, ctl) {
  const pdf = await pdfjsLib.getDocument({ data: await v.blob.arrayBuffer() }).promise;
  try {
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      if (ctl.stopped) throw STOP;
      pages.push(KC.linesFromItems((await (await pdf.getPage(p)).getTextContent()).items));
      ctl.prog(p / pdf.numPages * .5, `Бет ${p} / ${pdf.numPages}`);
      if (p % 8 === 0) await tick();
    }
    return KC.structure(pages, await pdfOutline(pdf));
  } finally { pdf.destroy(); }
}

async function epubStructure(v, ctl) {
  const book = ePub(await v.blob.arrayBuffer());
  try {
    await book.ready;
    const toc = new Map();
    const walk = list => (list || []).forEach(t => { const h = t.href.split('#')[0]; if (!toc.has(h)) toc.set(h, t.label.trim()); walk(t.subitems); });
    walk(book.navigation?.toc);
    const items = book.spine.spineItems, chapters = [];
    for (let i = 0; i < items.length; i++) {
      if (ctl.stopped) throw STOP;
      const root = await items[i].load(book.load.bind(book));
      const els = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')].filter(e => !e.parentElement.closest('p,li,blockquote'));
      const paras = []; let title = toc.get(items[i].href) || '';
      for (const e of els) {
        const t = e.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
        if (/^H[1-3]$/.test(e.tagName) && !title) { title = t; continue; }
        if (/^H/.test(e.tagName) && t === title) continue;
        paras.push(t);
      }
      if (!els.length) paras.push(...(root.textContent || '').split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean));
      if (paras.length) chapters.push({ title: title || `Бөлім ${chapters.length + 1}`, paras });
      items[i].unload(); ctl.prog((i + 1) / items.length * .5, `Бөлім ${i + 1} / ${items.length}`);
    }
    return { chapters, removed: {} };
  } finally { book.destroy(); }
}

// Әр тарауды ~9000 таңбалық бөліктермен ЖИ-ге жібереді. Жауап түпнұсқадан тым қысқа/ұзын болса — сол бөлікке тимейді.
async function aiClean(chapters, ctl) {
  const jobs = [];
  chapters.forEach((ch, ci) => {
    let cur = [], len = 0, from = 0;
    ch.paras.forEach((p, i) => {
      if (len + p.length > AI_BATCH && cur.length) { jobs.push({ ci, from, n: cur.length, text: cur.join('\n\n') }); cur = []; len = 0; from = i; }
      cur.push(p); len += p.length + 2;
    });
    if (cur.length) jobs.push({ ci, from, n: cur.length, text: cur.join('\n\n') });
  });
  let ok = 0, kept = 0;
  // соңынан бастаймыз: абзацтар саны өзгергенде алдыңғы бөліктердің индексі ығыспайды
  for (let k = jobs.length - 1, done = 0; k >= 0; k--, done++) {
    if (ctl.stopped) throw STOP;
    const j = jobs[k];
    ctl.prog(.5 + done / jobs.length * .3, `ЖИ тазартуда: ${done + 1} / ${jobs.length}`);
    let res = null;
    for (let a = 0; a < 3 && !res; a++) {
      const { data, error } = await sb.functions.invoke('book-chat', { body: { action: 'clean', text: j.text } });
      if (!error && data?.text) { res = data.text; break; }
      const msg = error ? await errText(error) : 'бос жауап';
      if (error?.context?.status && error.context.status < 500 && error.context.status !== 429) throw new Error(msg);
      await sleep(2000 * (a + 1));
    }
    const r = res ? res.length / j.text.length : 0;
    if (r >= .75 && r <= 1.15) {
      const paras = res.split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
      chapters[j.ci].paras.splice(j.from, j.n, ...paras); ok++;
    } else kept++;
  }
  return { ok, kept, total: jobs.length };
}

const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function buildEpub(b, chapters) {
  const z = new JSZip(), id = 'urn:uuid:' + uid(), lang = b.lang || 'kk';
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const page = (t, body) => `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}"><head><meta charset="utf-8"/><title>${xe(t)}</title></head><body>${body}</body></html>`;
  chapters.forEach((c, i) => z.file(`OEBPS/c${i}.xhtml`, page(c.title, `<section epub:type="chapter"><h1>${xe(c.title)}</h1>\n${c.paras.map(p => `<p>${xe(p)}</p>`).join('\n')}</section>`)));
  z.file('OEBPS/nav.xhtml', page('Мазмұны', `<nav epub:type="toc"><h1>Мазмұны</h1><ol>${chapters.map((c, i) => `<li><a href="c${i}.xhtml">${xe(c.title)}</a></li>`).join('')}</ol></nav>`));
  if (b.cover) z.file('OEBPS/cover.jpg', b.cover);
  z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${xe(b.title)}</dc:title>${b.author ? `<dc:creator>${xe(b.author)}</dc:creator>` : ''}<dc:language>${lang}</dc:language>
${b.publisher ? `<dc:publisher>${xe(b.publisher)}</dc:publisher>` : ''}${b.summary ? `<dc:description>${xe(b.summary)}</dc:description>` : ''}<meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>${b.cover ? '<meta name="cover" content="cover"/>' : ''}</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${b.cover ? '<item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>' : ''}${chapters.map((c, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest>
<spine>${chapters.map((c, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  return z.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

// Жүктелген кітап үшін: PDF әрқашан, EPUB тек ЖИ тазарту қосулы болса түрленеді.
async function autoConvert(b, then) {
  const vs = await byBook('versions', b.id);
  if (vs.some(v => v.kind === 'clean')) return then();
  const aiOn = localStorage.kAiClean !== '0' && !!(await sb.auth.getSession()).data.session;
  const src = vs.find(v => v.type === 'pdf') || (aiOn && vs.find(v => v.type === 'epub'));
  return src ? showConvert(b, src, then) : then();
}

async function showConvert(b, v, done) {
  setNav('lib'); view.dataset.page = 'convert';
  const session = (await sb.auth.getSession()).data.session;
  const ai = localStorage.kAiClean !== '0' && !!session;
  const steps = [['read', 'Мәтінді оқу және тазарту'], ...(ai ? [['ai', 'ЖИ-мен қосымша тазарту']] : []), ['epub', 'EPUB кітап жасау'], ['index', 'Бөлімдерге бөлу']];
  const ctl = { stopped: false, prog(f, label) { if (!$('#cf')) return; $('#cf').style.width = Math.round(f * 100) + '%'; $('#cl').textContent = `${label} · ${Math.round(f * 100)}%`; } };
  const mark = (k, st) => { const el = view.querySelector(`[data-step="${k}"]`); if (el) el.className = 'step ' + st; };
  view.innerHTML = `<header class="hd"><h1>Таза нұсқа</h1></header>
    <div class="glass sec ab-hero">${coverHTML(b, 'cv-sm')}<div><b>${esc(b.title)}</b><small>${esc(v.name)} · ${v.type.toUpperCase()}</small>
      <small>Тыңдау мен жылдам оқуға арналған таза кітап: бет нөмірлерісіз, колонтитулсыз, тараулары бөлінген.</small></div></div>
    <div class="glass sec"><div class="steps">${steps.map(([k, t]) => `<div class="step" data-step="${k}"><i></i><span>${t}</span></div>`).join('')}</div>
      <div class="prog"><i id="cf"></i></div><small id="cl" class="muted">Басталуда…</small>
      ${ai ? '' : `<p class="muted" style="margin-top:.6rem">${ic('info', 14)} ${session ? 'ЖИ тазарту Профильде өшірулі.' : 'ЖИ тазарту үшін Life Hub-қа кір; әзірге тек жергілікті тазарту жасалады.'}</p>`}
      <div class="row end" style="margin-top:.6rem"><button id="cStop">${ic('x', 16)} Тоқтату</button></div></div>
    <div id="cRes"></div>`;
  $('#cStop').onclick = () => { ctl.stopped = true; done(); };
  try {
    mark('read', 'run');
    const st = v.type === 'pdf' ? await pdfStructure(v, ctl) : await epubStructure(v, ctl);
    const chars = st.chapters.reduce((a, c) => a + c.paras.join('').length, 0);
    if (chars < 200) throw new Error('Файлдан мәтін табылмады. Бұл скан PDF болуы мүмкін: оған OCR (суреттен мәтін оқу) керек, ол әзірге жоқ.');
    mark('read', 'ok');
    let aiRes = null;
    if (ai) {
      mark('ai', 'run');
      try { aiRes = await aiClean(st.chapters, ctl); mark('ai', aiRes.ok ? 'ok' : 'warn'); }
      catch (err) { if (err === STOP) throw err; aiRes = { error: err.message }; mark('ai', 'warn'); }
    }
    mark('epub', 'run'); ctl.prog(.82, 'EPUB жасалуда');
    const blob = await buildEpub(b, st.chapters);
    for (const old of (await byBook('versions', b.id)).filter(x => x.kind === 'clean')) await deleteVersion(old);
    const nv = { id: uid(), bookId: b.id, name: 'Таза нұсқа', type: 'epub', kind: 'clean', blob, pos: null, pct: 0, added: Date.now(), sourceId: v.id, conv: { removed: st.removed, ai: aiRes } };
    await put('versions', nv);
    mark('epub', 'ok'); mark('index', 'run');
    await indexVersion(b, nv, { stopped: false, prog: (f, l) => ctl.prog(.85 + f * .15, l) });
    mark('index', 'ok'); ctl.prog(1, 'Дайын');
    const r = st.removed, words = nv.words || 0;
    $('#cStop').remove();
    $('#cRes').innerHTML = `<div class="glass sec"><h3>${ic('check-circle', 18)} Дайын</h3>
      <dl class="info"><div><dt>Тараулар</dt><dd>${st.chapters.length}</dd></div><div><dt>Сөз</dt><dd>${words.toLocaleString('kk')}</dd></div>
      ${r.pageNum != null ? `<div><dt>Алынып тасталды</dt><dd>${r.pageNum} бет нөмірі, ${r.header} колонтитул, ${r.toc} мазмұн жолы, ${r.small} сілтеме/ұсақ жол</dd></div>` : ''}
      ${aiRes ? `<div><dt>ЖИ тазарту</dt><dd>${aiRes.error ? `жасалмады: ${esc(aiRes.error)}` : `${aiRes.ok}/${aiRes.total} бөлік${aiRes.kept ? `, ${aiRes.kept} бөлік өзгеріссіз қалды` : ''}`}</dd></div>` : ''}</dl>
      <div class="row"><button class="primary" id="cDone">${ic('book-open', 16)} Кітапқа өту</button><button id="cRead">Таза нұсқаны оқу</button></div></div>`;
    $('#cDone').onclick = done;
    $('#cRead').onclick = () => openReader(b, nv);
  } catch (err) {
    if (err === STOP || ctl.stopped) return;
    console.error(err);
    view.querySelectorAll('.step.run').forEach(e => e.className = 'step err');
    $('#cStop')?.remove();
    $('#cRes').innerHTML = `<div class="glass sec"><h3>${ic('alert', 18)} Таза нұсқа жасалмады</h3><p>${esc(err.message)}</p>
      <div class="row"><button class="primary" id="cDone">Түпнұсқамен жалғастыру</button><button id="cRetry">${ic('refresh', 16)} Қайталау</button></div></div>`;
    $('#cDone').onclick = done; $('#cRetry').onclick = () => showConvert(b, v, done);
  }
}
