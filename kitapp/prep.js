'use strict';
/* Мәтінді дайындаудың ортақ ағыны: аудио, жылдам оқу және чат бір жерден пайдаланады. Бір рет жасалады, құрылғыда сақталады. */

const KIND = { clean: 'Таза нұсқа', original: 'Түпнұсқа', translation: 'Аударма', other: 'Басқа' };
const isReady = v => v.prepV === 3; // 3 = тазартылған мәтін + бөлімдер (+ ішкі тақырыпшалар) + бөлшек нөмірлері
const verOrder = v => v.kind === 'clean' ? 0 : v.kind === 'original' ? 1 : 2; // таза нұсқа бірінші
const prepError = err => /object can not be found|notfounderror/i.test(`${err?.name || ''} ${err?.message || ''}`)
  ? 'Кітап файлы браузер жадынан табылмады. Кітап нұсқасын қайта жүктеп, тағы бір рет дайындап көріңіз.'
  : (err?.message || 'Белгісіз қате. Қайтадан байқап көріңіз.');

// Дайын нұсқаны қайтарады. Дайын нұсқа жоқ болса, прогресс-панельді көрсетіп, өзі дайындайды
// және аяқталғанда again() шақырады; бұл жағдайда null қайтады.
async function withPrepared(b, versionId, again, back, what) {
  const vs = (await byBook('versions', b.id)).sort((a, c) => verOrder(a) - verOrder(c));
  const v = vs.filter(isReady).find(x => x.id === versionId) || vs.find(isReady);
  if (v) return v;
  if (!vs.length) {
    view.innerHTML = `<button class="back" id="pBack">${ic('back')} Кітапқа</button><div class="glass sec"><h3>${esc(b.title)}</h3><p>Алдымен кітапқа файл қос: кітап бетінің жоғарғы оң жағындағы мәзірден «Нұсқа қосу».</p></div>`;
    $('#pBack').onclick = back; return null;
  }
  renderPrep(b, vs.find(x => x.id === versionId) || vs.find(x => x.kind === 'original') || vs[0], again, back, what);
  return null;
}

function renderPrep(b, v, again, back, what) {
  const ctl = { stopped: false, prog(f, label) { if (!$('#pf')) return; $('#pf').style.width = Math.round(f * 100) + '%'; $('#pl').textContent = `${label} · ${Math.round(f * 100)}%`; } };
  const stop = () => { ctl.stopped = true; back(); };
  view.innerHTML = `<button class="back" id="pBack">${ic('back')} Кітапқа</button>
    <div class="glass sec"><h3>${ic('layers')} Мәтінді дайындау</h3>
      <p>«${esc(b.title)}», ${esc(v.name)}: мәтін оқылып, тазартылып, ${esc(what)} үшін бөлімдерге бөлінеді. Бұл бір рет жасалады, нәтиже құрылғыда сақталады.</p>
      <div class="prog"><i id="pf"></i></div><small id="pl" style="color:var(--mute)">Басталуда…</small>
      <div class="row end" style="margin-top:.6rem"><button id="pStop">${ic('x', 16)} Тоқтату</button></div></div>`;
  $('#pBack').onclick = $('#pStop').onclick = stop;
  indexVersion(b, v, ctl).then(() => { if (!ctl.stopped) again(); }).catch(err => {
    if (err === STOP || ctl.stopped) return;
    console.error(err);
    view.innerHTML = `<button class="back" id="pBack">${ic('back')} Кітапқа</button><div class="glass sec"><h3>${ic('alert')} Дайындау сәтсіз</h3><p>${esc(prepError(err))}</p>
      <div class="row"><button class="primary" id="pRetry">${ic('refresh', 16)} Қайталау</button></div></div>`;
    $('#pBack').onclick = back; $('#pRetry').onclick = () => renderPrep(b, v, again, back, what);
  });
}
