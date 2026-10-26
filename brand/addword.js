'use strict';
/* Life Hub: белгіленген ағылшын сөзін «Тіл» сөздігіне қосу (items кестесі, app = 'lang').
   Қолдану: <script src="../brand/addword.js"> сосын AddWord.init({ sb: () => sb, toast, source: 'kitapp' }).
   Бетте ағылшынша 1–4 сөзді белгілесең, «Сөздікке қосу» батырмасы шығады. iframe ішіндегі мәтін (EPUB) үшін AddWord.watch(iframeDocument).
   ЖИ аудармасы тек ұсыныс: пайдаланушы тексеріп сақтайды (тегін модельдер қазақшаны жиі қателейді). */
(g => {
  // Тіл қосымшасындағы pickWord-пен бірдей ереже: тек 1–4 ағылшын сөзі, айналасындағы тыныс белгісі алынады.
  const W = "[A-Za-z]+(?:['’-][A-Za-z]+)*", RE = new RegExp(`^${W}(?: ${W}){0,3}$`);
  function pickWord(text) {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    return t.length <= 40 && RE.test(t) ? t : null;
  }
  const api = { pickWord };
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = api; return; }

  let cfg = null, cur = null, btn = null, dlg = null, timer = 0;
  const say = t => (cfg.toast ? cfg.toast(t) : alert(t));

  // Белгіленген мәтін: { word, doc, rect } (rect — негізгі беттің координатасында), болмаса null.
  function read(doc) {
    const s = doc.getSelection?.();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    if (s.anchorNode?.parentElement?.closest('input, textarea, select, [contenteditable=true], dialog#aw-dlg')) return null;
    const word = pickWord(s.toString()); if (!word) return null;
    const r = s.getRangeAt(0).getBoundingClientRect(), f = doc.defaultView?.frameElement?.getBoundingClientRect();
    return { word, doc, rect: { left: r.left + (f?.left || 0), bottom: r.bottom + (f?.top || 0) } };
  }
  function update(doc) {
    const sel = read(doc);
    if (!sel) { if (cur?.doc === doc) hide(); return; }
    cur = sel; btn ||= makeBtn();
    btn.hidden = false;
    btn.style.top = Math.max(8, Math.min(sel.rect.bottom + 10, innerHeight - 140)) + 'px'; // селекция астында: телефонның өз мәзірі жоғарыда шығады
    btn.style.left = Math.max(8, Math.min(sel.rect.left, innerWidth - btn.offsetWidth - 8)) + 'px';
  }
  function hide() { cur = null; if (btn) btn.hidden = true; }
  function makeBtn() {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'aw-btn'; b.textContent = 'Сөздікке қосу'; b.hidden = true;
    b.style.cssText = 'position:fixed;z-index:2147483000;min-height:40px;padding:0 1rem;border:0;border-radius:99px;font:600 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;background:var(--acc,#0a7586);color:var(--acc-ink,#fff);box-shadow:0 8px 24px rgba(0,0,0,.25)';
    b.onmousedown = e => e.preventDefault(); // басқанда белгілеу жоғалмасын
    b.onclick = () => { const w = cur?.word; cur?.doc.getSelection()?.removeAllRanges(); hide(); if (w) open(w); };
    document.body.append(b);
    return b;
  }

  async function suggest(word, tr, note) {
    let models = [];
    try { models = JSON.parse(localStorage.getItem('hub.models')) || []; } catch { /* сақтау өшік */ }
    try {
      const res = await cfg.sb().functions.invoke('assistant', { body: { action: 'translate', word, models } });
      if (res.error) { let m = res.error.message; try { m = (await res.error.context.json()).error; } catch { /* қалдырамыз */ } throw new Error(m); }
      if (!tr.value.trim() && dlg.open) { tr.value = res.data.translation; dlg._ex = res.data.example || ''; note.textContent = 'ЖИ ұсынысы. Дұрыс па? Қажет болса түзет те, «Сақтау» бас.'; tr.select(); }
      else note.textContent = '';
    } catch (e) { note.textContent = 'ЖИ аудара алмады: ' + e.message + '. Аударманы өзің жаз.'; }
  }

  function open(word) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'aw-dlg';
      dlg.innerHTML = `<form method="dialog"><h3>Сөздікке қосу</h3>
        <label>Ағылшынша сөз <input name="word" lang="en" autocomplete="off" required></label>
        <label>Аудармасы <input name="tr" autocomplete="off" required></label>
        <p class="muted" data-note role="status" style="font-size:.9rem;min-height:1.3em"></p>
        <div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="ghost" data-cancel>Бас тарту</button><button class="primary" value="ok">Сақтау</button></div></form>`;
      document.body.append(dlg);
      dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
      dlg.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const f = e.target.elements, word = f.word.value.trim(), translation = f.tr.value.trim(), note = dlg.querySelector('[data-note]');
        const ok = dlg.querySelector('.primary'); ok.disabled = true;
        try { await save(word, translation, dlg._ex); dlg.close(); say(`«${word}» сөздікке қосылды.`); }
        catch (err) { note.textContent = err.message; }
        ok.disabled = false;
      };
    }
    const f = dlg.querySelector('form').elements, note = dlg.querySelector('[data-note]');
    f.word.value = word; f.tr.value = ''; dlg._ex = ''; note.textContent = 'ЖИ аударып жатыр…';
    dlg.showModal(); f.tr.focus();
    suggest(word, f.tr, note);
  }

  async function save(word, translation, example) {
    const sb = cfg.sb();
    const { data: dup, error: e1 } = await sb.from('items').select('id').eq('app', 'lang').filter('data->>word', 'ilike', word.replace(/[\\%_]/g, '\\$&')).limit(1);
    if (e1) throw new Error('Сақталмады: ' + e1.message);
    if (dup?.length) throw new Error(`«${word}» сөздікте бар.`);
    const { error } = await sb.from('items').insert({ app: 'lang', data: { word, translation, ...(example ? { example } : {}), source: cfg.source || 'hub' } });
    if (error) throw new Error('Сақталмады: ' + (/row-level|JWT|auth/i.test(error.message) ? 'алдымен Life Hub-қа кір. ' : '') + error.message);
  }

  const watched = new WeakSet();
  function watch(doc) {
    if (!doc || watched.has(doc)) return; watched.add(doc);
    doc.addEventListener('selectionchange', () => { clearTimeout(timer); timer = setTimeout(() => update(doc), 250); });
  }
  api.init = c => { cfg = c; watch(document); };
  api.watch = watch;
  g.AddWord = api;
})(globalThis);
