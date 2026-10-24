'use strict';
/* Kitapp: профиль. Тақырып, күнделікті мақсат, Life Hub аккаунты және «Жүктелгендер»: құрылғыда сақталған файлдар мен орын. */

const size = n => n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' ГБ' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';

async function showProfile(focus) {
  setNav('profile'); view.dataset.page = 'profile';
  const S2 = spGet();
  const [books, vs, au, ss, dr] = await Promise.all([all('books'), all('versions'), all('audio'), all('sessions'), all('drills')]);
  const { data: { session } } = await sb.auth.getSession();
  const est = (await navigator.storage?.estimate?.().catch(() => null)) || {};
  const S = KS.summarize(ss);
  const theme = localStorage.kTheme || 'system', goal = +(localStorage.kGoal || 20);
  const book = id => books.find(b => b.id === id)?.title || 'Жойылған кітап';
  const fileTotal = vs.reduce((a, v) => a + v.blob.size, 0), audioTotal = au.reduce((a, x) => a + x.blob.size, 0);
  const email = session?.user?.email;

  // Аудиоңды нұсқа бойынша топтау
  const audioBy = {};
  for (const a of au) (audioBy[a.versionId] ||= []).push(a);
  const prepared = vs.filter(isReady);

  view.innerHTML = `
    <header class="hd"><h1>Профиль</h1></header>
    <div class="glass sec"><div class="row" style="flex-wrap:nowrap">
      <div class="avatar">${esc((email || 'K')[0].toUpperCase())}</div>
      <div style="min-width:0"><b>${email ? esc(email) : 'Hub-қа кірмегенсің'}</b><br>
        <small style="color:var(--mute)">${email ? 'Life Hub аккаунты: ЖИ чат пен бұлттық аудио осы арқылы жұмыс істейді' : `ЖИ чат пен бұлттық аудио үшін <a href="../">Life Hub</a>-қа кіру керек`}</small></div></div>
      <div class="stats" style="margin-top:.8rem"><div class="stat"><b>${books.length}</b><small>Кітап</small></div><div class="stat"><b>${KS.fmtDur(S.total)}</b><small>Оқу уақыты</small></div><div class="stat"><b>${dr.length}</b><small>Жылдам оқу жаттығуы</small></div></div></div>

    <div class="glass sec"><h3>Тақырып</h3>
      <div class="seg" id="thSeg">${[['system', 'monitor', 'Жүйе'], ['light', 'sun', 'Жарық'], ['dark', 'moon', 'Қараңғы']].map(([k, i, t]) => `<button data-t="${k}" class="${theme === k ? 'on' : ''}">${ic(i, 16)} ${t}</button>`).join('')}</div>
      <div class="fgrid"><label>Күнделікті оқу мақсаты (минут) <input id="pGoal" type="number" min="1" max="600" value="${goal}"></label>
      <label>Жылдық мақсат (кітап) <input id="pYear" type="number" min="1" max="500" value="${+(localStorage.kYearGoal || 12)}"></label></div></div>

    <div class="glass list"><button class="lrow" id="pSpeed">${ic('zap', 22)}<span>Жылдам оқу жаттығуы<br><small class="muted">Бастапқы қарқын ${S2.baseline} сөз/мин · ${Math.min(S2.unlocked, 6)}/6 кезең ашық</small></span>${ic('chevron-right', 18)}</button></div>

    ${audioSettingsHTML()}

    <div class="glass sec" id="pDl"><h3>${ic('drive')} Жүктелгендер</h3>
      <div class="bar-p" style="height:10px;border-radius:99px"><i style="width:${est.quota ? Math.min(100, est.usage / est.quota * 100) : 0}%;border-radius:99px"></i></div>
      <small style="color:var(--mute)">${est.usage != null ? `Қолданылған: ${size(est.usage)}${est.quota ? ` / ${size(est.quota)}` : ''}. ` : ''}Кітап файлдары ${size(fileTotal)}, аудио ${size(audioTotal)}. Бәрі тек осы құрылғыда сақталады.</small>

      <h4>Кітап файлдары (${vs.length})</h4>${vs.length ? vs.map(v => `<div class="ver" data-v="${v.id}"><div><b>${esc(book(v.bookId))}</b><br><small style="color:var(--mute)">${esc(v.name)} · ${v.type.toUpperCase()}${v.kind ? ' · ' + KIND[v.kind] : ''} · ${size(v.blob.size)}</small></div>
        <div class="row"><button data-a="vdl" aria-label="Жүктеп алу">${ic('download', 16)}</button><button class="danger" data-a="vdel" aria-label="Өшіру">${ic('trash', 16)}</button></div></div>`).join('') : '<div class="empty">Файл жоқ</div>'}

      <h4>Дайын мәтін (${prepared.length})</h4><small style="color:var(--mute)">Чат, аудио және жылдам оқу үшін дайындалған мәтін. Өшірсең, файл қалады, қажет болса қайта дайындалады.</small>
      ${prepared.length ? prepared.map(v => `<div class="ver" data-v="${v.id}"><div><b>${esc(book(v.bookId))}</b><br><small style="color:var(--mute)">${esc(v.name)} · ${v.indexed} үзінді · ${(v.words || 0).toLocaleString('kk')} сөз</small></div>
        <button class="danger" data-a="pdel" aria-label="Дайын мәтінді өшіру">${ic('trash', 16)}</button></div>`).join('') : '<div class="empty">Дайын мәтін жоқ</div>'}

      <h4>Аудио (${au.length} файл)</h4>${Object.keys(audioBy).length ? Object.entries(audioBy).map(([vid, list]) => { const v = vs.find(x => x.id === vid); return `<div class="ver" data-v="${vid}"><div><b>${esc(book(list[0].bookId))}</b><br><small style="color:var(--mute)">${v ? esc(v.name) : 'нұсқа жоқ'} · ${list.length} бөлім · ${size(list.reduce((a, x) => a + x.blob.size, 0))}</small></div>
        <button class="danger" data-a="adel" aria-label="Аудионы өшіру">${ic('trash', 16)}</button></div>`; }).join('') : '<div class="empty">Аудио файл жоқ</div>'}
    </div>

    <div class="glass sec"><h3>Жылдам оқу және аналитика</h3>
      <small style="color:var(--mute)">Оқу уақытының статистикасы «Аналитика» бетінде, жылдам оқу баптаулары кітаптың «Жылдам оқу» бетінде.</small></div>`;

  $('#pSpeed').onclick = showSpeed;
  bindAudioSettings();
  if (focus === 'audio') $('#audioSet').scrollIntoView({ block: 'start' });
  $('#thSeg').onclick = e => { const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return; localStorage.kTheme = t; applyTheme(); showProfile(); };
  $('#pGoal').onchange = e => { localStorage.kGoal = Math.max(1, +e.target.value || 20); toast('Мақсат сақталды'); };
  $('#pYear').onchange = e => { localStorage.kYearGoal = Math.max(1, +e.target.value || 12); toast('Мақсат сақталды'); };
  $('#pDl').onclick = async e => {
    const btn = e.target.closest('[data-a]'), row = e.target.closest('[data-v]'); if (!btn || !row) return;
    const v = vs.find(x => x.id === row.dataset.v), a = btn.dataset.a;
    if (a === 'vdl') saveBlob(v.blob, `${v.name}.${v.type}`);
    if (a === 'vdel' && confirm(`«${book(v.bookId)}», ${v.name}: файл, оның дайын мәтіні мен аудиосы өшеді. Жалғастырамыз ба?`)) { await deleteVersion(v); showProfile(); }
    if (a === 'pdel' && confirm('Дайын мәтін өшеді (файл қалады). Жалғастырамыз ба?')) {
      await dropChunks(v.bookId, v.id, true);
      Object.assign(v, { indexed: 0, prepV: 0, chapters: undefined, words: 0 }); await put('versions', v); showProfile();
    }
    if (a === 'adel' && confirm('Бұл нұсқаның барлық аудио файлы өшеді. Жалғастырамыз ба?')) {
      for (const x of audioBy[row.dataset.v]) await del('audio', x.id);
      showProfile();
    }
  };
}
