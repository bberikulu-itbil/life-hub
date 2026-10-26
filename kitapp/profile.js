'use strict';
/* Kitapp: профиль. Басты бетте тек бөлімдер тізімі тұрады, әр бөлім жеке бетте ашылады:
   тақырып және мақсаттар, жылдам оқу (speed.js), аудио баптаулары, кітапты өңдеу, жүктелгендер және интернетсіз режим. */

const size = n => !n ? '0 КБ' : n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' ГБ' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
const LIBS = ['vendor/lib/pdf.min.js', 'vendor/lib/pdf.worker.min.js', 'vendor/lib/epub.min.js', 'vendor/lib/jszip.min.js'];

// Интернетсіз ашылуға керек файлдар кэште бар ма
async function offlineReady() {
  if (!('caches' in window)) return false;
  try { return (await Promise.all(['index.html', ...LIBS].map(u => caches.match(u, { ignoreSearch: true })))).every(Boolean); } catch { return false; }
}

const pageHead = (title) => `<button class="back" id="pBack">${ic('back', 22)} Профиль</button><header class="hd"><h1>${title}</h1></header>`;

async function showProfile(section) {
  if (section) return section === 'jobs' ? showJobs() : showProfileSec(section);
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
      ${row('audio', 'headphones', 'Аудио баптаулары', `${esc(voiceLabel())} · ${+(localStorage.kRate || 1)}× жылдамдық`)}
      ${row('convert', 'layers', 'Кітапты өңдеу', `Таза нұсқа жасау · ЖИ тазарту ${localStorage.kAiClean !== '0' ? 'қосулы' : 'өшірулі'}`)}
      ${row('jobs', 'download', 'Дайындау және жүктеу', esc(jobsSummary()))}
      ${row('cloud', 'cloud-up', 'Бұлтқа сақтау', !email ? 'Life Hub-қа кіргенде қосылады' : !cloudOn() ? 'өшірулі' : Cl.err ? 'қате: ' + esc(cloudErr(Cl.err)) : clState().last ? `соңғы синхрондау ${new Date(clState().last).toLocaleString('kk', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}` : 'қосулы')}
      ${row('downloads', 'drive', 'Жүктелгендер және интернетсіз', `${est.usage != null ? size(est.usage) + ' · ' : ''}${vs.length} файл, ${au.length} аудио · ${off ? 'интернетсіз дайын' : 'интернетсіз әлі дайын емес'}`)}
    </div><p class="app-ver">Kitapp ${APP_VERSION}</p>`;
  $('#pApps').onclick = e => openApps(e.currentTarget);
  $('#pList').onclick = e => {
    const p = e.target.closest('[data-p]')?.dataset.p; if (!p) return;
    p === 'speed' ? showSpeed() : p === 'downloads' ? showDownloads() : p === 'jobs' ? showJobs() : showProfileSec(p);
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
  if (key === 'cloud') {
    const u = await cloudUser(), s = clState();
    view.innerHTML = `${pageHead('Бұлтқа сақтау')}
      <div class="glass sec"><h3>${ic('cloud-up', 18)} Life Hub аккаунты</h3>
        <p class="muted">${u ? `Кітаптар ${esc(u.email || '')} аккаунтына сақталады: файлдар, мұқаба, оқу орны, бетбелгі, ескертпе, конспект және оқу статистикасы. Басқа құрылғыда кірсеңіз, кітапхана сол күйінде ашылады. Аудио mp3 мен дайындалған мәтін әр құрылғыда бөлек жасалады.` : `Бұлтқа сақтау үшін <a href="../">Life Hub</a>-қа кіріңіз.`}</p>
        <label class="tgl"><input type="checkbox" id="cOn" ${cloudOn() ? 'checked' : ''}><span>Кітапхананы бұлтпен синхрондау<br><small class="muted">Өзгеріс бірнеше секундтан кейін жіберіледі. Бір файлға 50 МБ шегі бар.</small></span></label>
        <div class="row"><button class="primary" id="cNow" ${u ? '' : 'disabled'}>${ic('cloud-up', 16)} Қазір синхрондау</button></div>
        <small class="muted" id="cSt">${Cl.err ? 'Соңғы қате: ' + esc(cloudErr(Cl.err)) : s.last ? 'Соңғы синхрондау: ' + new Date(s.last).toLocaleString('kk') : ''}${s.dirty.length ? ` · жіберуді күтіп тұр: ${s.dirty.length} кітап` : ''}</small></div>`;
    $('#cOn').onchange = e => { localStorage.kCloudOff = e.target.checked ? '0' : '1'; if (e.target.checked) cloudSync({ manual: true }).then(() => showProfileSec('cloud')); };
    $('#cNow').onclick = async e => { e.currentTarget.disabled = true; $('#cSt').textContent = 'Синхрондалуда…'; await cloudSync({ manual: true }); if (!Cl.err) toast('Бұлтпен синхрондалды'); showProfileSec('cloud'); };
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

/* ---------- Дайындау және жүктеу: дауыс модельдері және аудио дайындау кезегі ---------- */
async function showJobs() {
  setNav('profile'); view.dataset.page = 'jobs';
  await checkModels();
  const draw = () => {
    if (view.dataset.page !== 'jobs') { document.removeEventListener('kjobs', tick); onDl.delete(tick); return; }
    const vo = voiceCur();
    const models = Object.entries(MODELS).map(([id, m]) => {
      const d = DL[id], have = haveModels.has(id), pct = d ? Math.round((d.loaded || 0) / (d.total || 1) * 100) : 0;
      return `<div class="jb-row"><div><b>${m.name}</b>${vo.model === id && ttsEngine() === 'issai' ? ' <span class="badge">таңдалған</span>' : ''}<br>
        <small class="muted">${d ? `Жүктелуде ${pct}% · ${size(d.loaded || 0)} / ${m.mb} МБ${d.bps ? ` · ~${fmtLeft((d.total - d.loaded) / d.bps)} қалды` : ''}` : have ? `Жүктелген · ${m.mb} МБ · интернетсіз жұмыс істейді` : `Жүктелмеген · ${m.mb} МБ (4G-де ~${fmtLeft(m.mb * 8 / 10)}, Wi-Fi-да ~${fmtLeft(m.mb * 8 / 40)})`}</small>
        ${d ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}</div>
        ${d ? '' : have ? `<button class="icon-btn danger" data-rm="${id}" aria-label="Өшіру">${ic('trash', 18)}</button>` : `<button class="icon-btn" data-dl="${id}" aria-label="Жүктеу">${ic('download', 18)}</button>`}</div>`;
    }).join('');
    const c = JB.cur, left = jobsLeft();
    $('#jbBody').innerHTML = `
      <div class="glass sec"><h3>${ic('headphones', 18)} Дауыс модельдері</h3>
        <small class="muted">Модель бір рет жүктеледі; одан кейін дауыс интернетсіз, тегін жасалады. Осы құрылғыда 10 минут аудио дайындауға: ${Object.entries(MODELS).map(([id, m]) => `${m.name.split(' · ')[1] || 'жоғары сапа'} ~${fmtLeft(10 * 60 * CPS / speedOf(id))}`).join(', ')}.</small>
        ${models}</div>
      <div class="glass sec"><h3>${ic('music', 18)} Аудио дайындау</h3>
        ${c ? `<div class="jb-row"><div><b>${esc(c.title)}</b><br><small class="muted">${esc(c.book)} · ${Math.round(JB.f * 100)}% · бөлімге ~${fmtLeft(prepSecs(c.chars * (1 - JB.f)))} қалды</small>
            <div class="prog"><i style="width:${Math.round(JB.f * 100)}%"></i></div></div><button class="icon-btn" data-x="${c.key}" aria-label="Тоқтату">${ic('x', 18)}</button></div>
          <small class="muted">Барлығы ~${fmtLeft(left)} қалды. Бет ауысса да жалғасады; қосымша жабылса, келесі ашқанда жалғасады. Экран сөнбейді.</small>`
          : `<p class="muted">${JB.err ? 'Тоқтады: ' + esc(JB.err) : JB.q.length ? 'Басталуда…' : 'Қазір ештеңе дайындалып жатқан жоқ. Кітаптың «Аудио жасау» бетінен немесе плеердің «Бөлімдер» тізімінен қосыңыз.'}</p>`}
        ${JB.err && JB.q.length ? `<button class="primary" id="jbGo">${ic('play', 16)} Жалғастыру</button>` : ''}
        ${JB.q.length ? `<h4>Кезекте · ${JB.q.length}</h4>${JB.q.map(j => `<div class="jb-row"><div>${esc(j.title)}<br><small class="muted">${esc(j.book)} · ~${fmtLeft(prepSecs(j.chars))}${j.auto ? ' · тыңдау үшін алдын ала' : ''}</small></div><button class="icon-btn" data-x="${j.key}" aria-label="Кезектен алу">${ic('x', 18)}</button></div>`).join('')}
          <button id="jbStop">${ic('x', 16)} Барлығын тоқтату</button>` : ''}
        ${JB.done.length ? `<h4>Дайын болғандар</h4>${JB.done.map(j => `<div class="jb-row"><div>${ic('check-circle', 14)} ${esc(j.title)}<br><small class="muted">${esc(j.book)} · ${fmtT(j.dur)} аудио</small></div></div>`).join('')}` : ''}
      </div>`;
  };
  let pend = 0; const tick = () => { pend ||= setTimeout(() => { pend = 0; draw(); }, 300); }; // жүктелу оқиғалары жиі келеді
  view.innerHTML = `${pageHead('Дайындау және жүктеу')}<div id="jbBody"></div>`;
  $('#pBack').onclick = () => showProfile();
  $('#jbBody').onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.dl) { const id = t.dataset.dl; issaiInit(id).then(() => toast('Модель жүктелді'), err => toast(err.message)).finally(draw); setTimeout(draw, 50); }
    if (t.dataset.rm && confirm('Модель құрылғыдан өшеді. Жасалған mp3 файлдар қалады.')) { await issaiRemove(t.dataset.rm); draw(); }
    if (t.dataset.x) jobCancel(t.dataset.x);
    if (t.id === 'jbStop') jobsStopAll();
    if (t.id === 'jbGo') jobsRun();
  };
  document.addEventListener('kjobs', tick); onDl.add(tick);
  draw();
}
