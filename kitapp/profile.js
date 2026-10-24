'use strict';
/* Kitapp: профиль. Басты бетте тек бөлімдер тізімі тұрады, әр бөлім жеке бетте ашылады:
   тақырып және мақсаттар, жылдам оқу (speed.js), аудио баптаулары, кітапты өңдеу, жүктелгендер және интернетсіз режим. */

const size = n => !n ? '0 КБ' : n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' ГБ' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];

// Интернетсіз ашылуға керек файлдар кэште бар ма
async function offlineReady() {
  if (!('caches' in window)) return false;
  try { return (await Promise.all(['index.html', ...LIBS].map(u => caches.match(u, { ignoreSearch: true })))).every(Boolean); } catch { return false; }
}

const pageHead = (title) => `<button class="back" id="pBack">${ic('back', 22)} Профиль</button><header class="hd"><h1>${title}</h1></header>`;

async function showProfile(section) {
  if (section) return showProfileSec(section);
  setNav('profile'); view.dataset.page = 'profile';
  const S2 = spGet();
  const [books, vs, au, ss, dr] = await Promise.all([all('books'), all('versions'), all('audio'), all('sessions'), all('drills')]);
  const { data: { session } } = await sb.auth.getSession();
  const est = (await navigator.storage?.estimate?.().catch(() => null)) || {};
  const S = KS.summarize(ss), email = session?.user?.email, off = await offlineReady();
  const theme = { system: 'Жүйе', light: 'Жарық', dark: 'Қараңғы' }[localStorage.kTheme || 'system'];
  const row = (id, icon, title, sub) => `<button class="lrow" data-p="${id}">${ic(icon, 22)}<span>${title}<br><small class="muted">${sub}</small></span>${ic('chevron-right', 18)}</button>`;

  view.innerHTML = `
    <header class="hd"><h1>Профиль</h1><button class="icon-btn glass" id="pApps" aria-label="Life Hub қосымшалары">${ic('apps', 22)}</button></header>
    <div class="glass sec"><div class="row" style="flex-wrap:nowrap">
      <div class="avatar">${esc((email || 'K')[0].toUpperCase())}</div>
      <div style="min-width:0"><b>${email ? esc(email) : 'Hub-қа кірмегенсің'}</b><br>
        <small class="muted">${email ? 'Life Hub аккаунты: ЖИ чат, ЖИ тазарту және бұлттық аудио осы арқылы жұмыс істейді' : `ЖИ мүмкіндіктері үшін <a href="../">Life Hub</a>-қа кіру керек`}</small></div></div>
      <div class="stats" style="margin-top:.8rem"><div class="stat"><b>${books.length}</b><small>Кітап</small></div><div class="stat"><b>${KS.fmtDur(S.total)}</b><small>Оқу уақыты</small></div><div class="stat"><b>${dr.length}</b><small>Жылдам оқу жаттығуы</small></div></div></div>
    <div class="glass list" id="pList">
      ${row('theme', 'sun', 'Сыртқы түр және мақсаттар', `${theme} тақырып · ${curLogo().name.toLowerCase()} белгіше · күніне ${+(localStorage.kGoal || 20)} мин · жылына ${+(localStorage.kYearGoal || 12)} кітап`)}
      ${row('speed', 'zap', 'Жылдам оқу', `Бастапқы қарқын ${S2.baseline} сөз/мин · ${Math.min(S2.unlocked, 6)}/6 кезең ашық`)}
      ${row('audio', 'headphones', 'Аудио баптаулары', `${(localStorage.kGender || 'f') === 'm' ? 'Дәулет' : 'Айгүл'} дауысы · ${+(localStorage.kRate || 1)}× жылдамдық`)}
      ${row('convert', 'layers', 'Кітапты өңдеу', `Таза нұсқа жасау · ЖИ тазарту ${localStorage.kAiClean !== '0' ? 'қосулы' : 'өшірулі'}`)}
      ${row('downloads', 'drive', 'Жүктелгендер және интернетсіз', `${est.usage != null ? size(est.usage) + ' · ' : ''}${vs.length} файл, ${au.length} аудио · ${off ? 'интернетсіз дайын' : 'интернетсіз әлі дайын емес'}`)}
    </div>`;
  $('#pApps').onclick = e => openApps(e.currentTarget);
  $('#pList').onclick = e => {
    const p = e.target.closest('[data-p]')?.dataset.p; if (!p) return;
    p === 'speed' ? showSpeed() : p === 'downloads' ? showDownloads() : showProfileSec(p);
  };
}

async function showProfileSec(key) {
  setNav('profile'); view.dataset.page = 'profile-' + key;
  if (key === 'theme') {
    const theme = localStorage.kTheme || 'system', goal = +(localStorage.kGoal || 20);
    view.innerHTML = `${pageHead('Сыртқы түр және мақсаттар')}
      <div class="glass sec"><h3>Тақырып</h3>
        <div class="seg" id="thSeg">${[['system', 'monitor', 'Жүйе'], ['light', 'sun', 'Жарық'], ['dark', 'moon', 'Қараңғы']].map(([k, i, t]) => `<button data-t="${k}" class="${theme === k ? 'on' : ''}">${ic(i, 16)} ${t}</button>`).join('')}</div></div>
      ${logoPickerHTML()}
      <div class="glass sec"><h3>Мақсаттар</h3><div class="fgrid">
        <label>Күнделікті оқу мақсаты (минут) <input id="pGoal" type="number" min="1" max="600" value="${goal}"></label>
        <label>Жылдық мақсат (кітап) <input id="pYear" type="number" min="1" max="500" value="${+(localStorage.kYearGoal || 12)}"></label></div></div>`;
    bindLogoPicker(() => showProfileSec('theme'));
    $('#thSeg').onclick = e => { const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return; localStorage.kTheme = t; applyTheme(); showProfileSec('theme'); };
    $('#pGoal').onchange = e => { localStorage.kGoal = Math.max(1, +e.target.value || 20); toast('Мақсат сақталды'); };
    $('#pYear').onchange = e => { localStorage.kYearGoal = Math.max(1, +e.target.value || 12); toast('Мақсат сақталды'); };
  }
  if (key === 'audio') {
    view.innerHTML = `${pageHead('Аудио баптаулары')}${audioSettingsHTML()}
      <div class="glass sec"><small class="muted">Әр кітаптың mp3 файлдары кітап бетіндегі «Аудио жасау» арқылы жасалады. Жасалған аудио құрылғыда сақталады және интернетсіз тыңдалады.</small></div>`;
    bindAudioSettings();
  }
  if (key === 'convert') {
    view.innerHTML = `${pageHead('Кітапты өңдеу')}
      <div class="glass sec"><h3>${ic('layers', 18)} Таза нұсқа</h3>
        <p class="muted">Жүктелген PDF кітап тыңдау мен жылдам оқуға арналған таза EPUB-қа айналады: бет нөмірлері, колонтитулдар, мазмұн жолдары мен сілтеме белгілері алынады, тараулар бөлінеді. Түпнұсқа файл өзгермейді.</p>
        <label class="tgl"><input type="checkbox" id="pAi" ${localStorage.kAiClean !== '0' ? 'checked' : ''}><span>ЖИ-мен қосымша тазарту<br><small class="muted">Жергілікті тазартудан кейін қалған артық сөздер мен қате бөлінген сөздерді түзейді. Hub-қа кіру керек; кітапқа ~50-ге дейін сұрау жұмсалады. ЖИ мәтінді қысқартса, сол бөліктің түпнұсқасы қалады.</small></span></label></div>`;
    $('#pAi').onchange = e => { localStorage.kAiClean = e.target.checked ? '1' : '0'; };
  }
  $('#pBack').onclick = () => showProfile();
}

/* ---------- Жүктелгендер: кітап бойынша файл, дайын мәтін, аудио; интернетсіз режим ---------- */
async function showDownloads() {
  setNav('profile'); view.dataset.page = 'downloads';
  const [books, vs, au, chunks] = await Promise.all([all('books'), all('versions'), all('audio'), all('chunks')]);
  const est = (await navigator.storage?.estimate?.().catch(() => null)) || {};
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const off = await offlineReady();
  const ids = new Set(books.map(b => b.id));
  const sum = list => list.reduce((a, x) => a + (x.blob?.size || 0), 0);
  const per = books.map(b => {
    const bv = vs.filter(v => v.bookId === b.id), ba = au.filter(a => a.bookId === b.id), chs = bv.filter(isReady);
    return { b, bv, ba, chs, total: sum(bv) + sum(ba) };
  }).sort((a, c) => c.total - a.total);
  const orphan = { v: vs.filter(v => !ids.has(v.bookId)), a: au.filter(a => !ids.has(a.bookId)), c: chunks.filter(c => !ids.has(c.bookId)) };
  const orphanN = orphan.v.length + orphan.a.length + orphan.c.length;

  view.innerHTML = `${pageHead('Жүктелгендер')}
    <div class="glass sec"><h3>${ic('drive', 18)} Құрылғыдағы орын</h3>
      <div class="bar-p" style="height:10px"><i style="width:${est.quota ? Math.min(100, est.usage / est.quota * 100) : 0}%"></i></div>
      <small class="muted">${est.usage != null ? `Қолданылған: ${size(est.usage)}${est.quota ? ` / ${size(est.quota)}` : ''}. ` : ''}Кітап файлдары ${size(sum(vs))}, аудио ${size(sum(au))}.</small>
      <div class="row" style="margin-top:.6rem">${au.length ? `<button class="danger" id="dAllAudio">${ic('trash', 16)} Барлық аудионы өшіру (${size(sum(au))})</button>` : ''}
        ${orphanN ? `<button class="danger" id="dOrphan">${ic('trash', 16)} Иесіз файлдарды тазарту (${orphanN})</button>` : ''}</div></div>

    <div class="glass sec"><h3>${ic(off ? 'check-circle' : 'info', 18)} Интернетсіз режим</h3>
      <dl class="info">
        <div><dt>Қосымша</dt><dd>${off ? 'Интернетсіз ашылады' : 'Әлі дайын емес: қосымшаны интернетпен бір рет ашып, бетті жаңарт'}</dd></div>
        <div><dt>Кітап оқу</dt><dd>${books.filter(b => vs.some(v => v.bookId === b.id)).length} кітап құрылғыда</dd></div>
        <div><dt>Тыңдау</dt><dd>mp3: ${new Set(au.map(a => a.bookId)).size} кітап · браузер дауысы интернетсіз де оқиды</dd></div>
        <div><dt>Деректерді сақтау</dt><dd>${persisted ? 'Тұрақты (браузер өзі өшірмейді)' : 'Уақытша: браузер орын тапшы болса өшіруі мүмкін'}</dd></div>
      </dl>
      <small class="muted">ЖИ чат, ЖИ тазарту және жаңа mp3 жасау үшін интернет керек.</small>
      ${persisted ? '' : `<div class="row" style="margin-top:.5rem"><button id="dPersist">${ic('check', 16)} Тұрақты сақтауды сұрау</button></div>`}</div>

    <div id="dBooks">${per.length ? per.map(({ b, bv, ba, chs, total }) => `
      <div class="glass sec dl" data-b="${b.id}">
        <div class="dl-hd">${coverHTML(b, 'cv-xs')}<div><b>${esc(b.title)}</b><small class="muted">${size(total)}${ba.length ? ` · ${ic('headphones', 12)} ${ba.length} бөлім mp3` : ''}</small></div></div>
        ${bv.map(v => `<div class="ver" data-v="${v.id}"><div>${esc(v.name)} <span class="badge">${v.type.toUpperCase()}</span><br><small class="muted">${KIND[v.kind] || ''} · ${size(v.blob.size)}${isReady(v) ? ` · мәтін дайын (${(v.words || 0).toLocaleString('kk')} сөз)` : ''}</small></div>
          <div class="row"><button class="icon-btn" data-a="vdl" aria-label="Файлды жүктеп алу">${ic('download', 18)}</button>${isReady(v) ? `<button class="icon-btn" data-a="pdel" aria-label="Дайын мәтінді өшіру" title="Дайын мәтінді өшіру">${ic('layers', 18)}</button>` : ''}<button class="icon-btn danger" data-a="vdel" aria-label="Файлды өшіру">${ic('trash', 18)}</button></div></div>`).join('')}
        ${ba.length ? `<div class="ver"><div>${ic('headphones', 15)} Аудио<br><small class="muted">${ba.length} бөлім · ${size(sum(ba))}</small></div><button class="danger" data-a="adel">${ic('trash', 16)} Аудионы өшіру</button></div>` : ''}
        <div class="row end" style="margin-top:.4rem"><button class="ghost danger" data-a="bdel">${ic('trash', 16)} Кітапты толық өшіру</button></div>
      </div>`).join('') : '<div class="empty">Құрылғыда кітап жоқ</div>'}</div>`;

  $('#pBack').onclick = () => showProfile();
  const again = () => showDownloads();
  $('#dPersist') && ($('#dPersist').onclick = async () => { const ok = await navigator.storage?.persist?.(); toast(ok ? 'Деректер тұрақты сақталады' : 'Браузер рұқсат бермеді. Қосымшаны басты экранға қосып көр.'); again(); });
  $('#dAllAudio') && ($('#dAllAudio').onclick = async () => {
    if (!confirm(`Барлық кітаптың ${au.length} аудио файлы өшеді. Жалғастырамыз ба?`)) return;
    if (P.b) pStop();
    for (const a of au) await del('audio', a.id);
    toast('Аудио өшірілді'); again();
  });
  $('#dOrphan') && ($('#dOrphan').onclick = async () => {
    for (const [n, list] of [['versions', orphan.v], ['audio', orphan.a], ['chunks', orphan.c]]) for (const x of list) await del(n, x.id);
    toast('Тазартылды'); again();
  });
  $('#dBooks').onclick = async e => {
    const btn = e.target.closest('[data-a]'), card = e.target.closest('[data-b]'); if (!btn || !card) return;
    const a = btn.dataset.a, bk = per.find(x => x.b.id === card.dataset.b), v = bk.bv.find(x => x.id === btn.closest('[data-v]')?.dataset.v);
    if (a === 'vdl') saveBlob(v.blob, `${v.name}.${v.type}`);
    if (a === 'vdel' && confirm(`«${bk.b.title}», ${v.name}: файл, оның дайын мәтіні мен аудиосы өшеді. Кітаптың өзі қалады.`)) { await deleteVersion(v); again(); }
    if (a === 'pdel' && confirm('Дайын мәтін өшеді (файл қалады, қажет болса қайта дайындалады).')) {
      await dropChunks(v.bookId, v.id, true);
      Object.assign(v, { indexed: 0, prepV: 0, chapters: undefined, words: 0 }); await put('versions', v); again();
    }
    if (a === 'adel' && confirm(`«${bk.b.title}» кітабының ${bk.ba.length} аудио файлы өшеді.`)) {
      if (P.b?.id === bk.b.id) pStop();
      for (const x of bk.ba) await del('audio', x.id);
      again();
    }
    if (a === 'bdel') deleteBook(bk.b.id, again);
  };
}
