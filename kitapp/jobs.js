'use strict';
/* Kitapp: аудио дайындау кезегі. Бір кезек бүкіл қосымшаға ортақ: беттер ауысса да жалғасады,
   Профильде («Дайындау және жүктеу») және «Аудио жасау» бетінде көрінеді. Қосымша жабылса,
   аяқталмаған бөлімдер сақталады және келесі ашқанда жалғасады. */

const JB = { q: [], cur: null, f: 0, done: [], stop: false, run: false, err: '' };
const JB_KEY = 'kJobs';
const jobKey = (vid, ci) => `${vid}:${ci}`;
const chCache = new Map(); // нұсқа -> аудио бөлімдері (мәтін қайта жиналмасын)
async function jobChapters(vid) {
  if (!chCache.has(vid)) { const v = await get('versions', vid); chCache.set(vid, v && isReady(v) ? await audioChapters(v) : []); }
  return chCache.get(vid);
}
const jobsSave = () => { try { localStorage[JB_KEY] = JSON.stringify(JB.q.map(({ text, ...j }) => j)); } catch { /* сақтау өшік */ } };
const jobsEmit = () => document.dispatchEvent(new Event('kjobs'));

// Қалған уақыт (сек): қазіргі бөліктің қалғаны + кезектегілер
const jobsLeft = () => prepSecs((JB.cur ? JB.cur.chars * (1 - JB.f) : 0) + JB.q.reduce((a, j) => a + j.chars, 0));
const jobState = (vid, ci) => JB.cur && JB.cur.key === jobKey(vid, ci) ? 'run' : JB.q.some(j => j.key === jobKey(vid, ci)) ? 'wait' : null;

// Бөлімдерді кезекке қосу. auto — тыңдау кезінде алдағы бөлімдер өзі қосылады (сұрақсыз)
async function jobAdd(b, v, idxs, { auto = false } = {}) {
  chCache.set(v.id, await audioChapters(v)); // мәтін қайта дайындалған болуы мүмкін
  const chs = chCache.get(v.id), have = new Set((await byBook('audio', b.id)).filter(a => a.versionId === v.id).map(a => a.ci));
  let n = 0;
  for (const ci of idxs) {
    const key = jobKey(v.id, ci);
    if (!chs[ci] || have.has(ci) || JB.cur?.key === key || JB.q.some(j => j.key === key)) continue;
    JB.q.push({ key, bookId: b.id, vid: v.id, ci, title: chs[ci].title, book: b.title, chars: chs[ci].text.length, auto });
    n++;
  }
  if (n) { jobsSave(); jobsEmit(); jobsRun(); }
  return n;
}
function jobCancel(key) {
  if (JB.cur?.key === key) JB.stop = true;
  JB.q = JB.q.filter(j => j.key !== key); jobsSave(); jobsEmit();
}
function jobsStopAll() { JB.q = []; if (JB.cur) JB.stop = true; jobsSave(); jobsEmit(); }

async function jobsRun() {
  if (JB.run) return;
  JB.run = true; JB.err = '';
  let lock = null; try { lock = await navigator.wakeLock?.request('screen'); } catch { /* қолдамайды */ }
  try {
    while (JB.q.length) {
      const j = JB.cur = JB.q.shift(); JB.f = 0; JB.stop = false; jobsSave(); jobsEmit();
      const v = await get('versions', j.vid), ch = (await jobChapters(j.vid))[j.ci];
      if (!v || !ch || await get('audio', j.key)) continue;
      if (!voiceHave()) await issaiInit(); // модель жоқ болса, алдымен жүктеледі (прогресі Профильде)
      try {
        const rec = await genAudio(v, j.ci, ch.text, f => { JB.f = f; jobsEmit(); }, JB);
        if (rec) {
          JB.done.unshift({ ...j, at: Date.now(), dur: rec.dur }); JB.done.length = Math.min(JB.done.length, 30);
          if (P.v?.id === j.vid) { P.has.add(j.ci); P.durs[j.ci] = rec.dur || P.durs[j.ci]; }
        }
      } catch (e) { JB.err = `«${j.title}»: ${e.message}`; toast('Аудио дайындалмады: ' + e.message); JB.q.unshift(j); break; }
    }
  } finally {
    JB.cur = null; JB.run = false; lock?.release?.(); jobsSave(); jobsEmit();
  }
}

// Қысқаша күй: Профиль тізімі мен плеер үшін
function jobsSummary() {
  const n = JB.q.length + (JB.cur ? 1 : 0), dl = Object.keys(DL)[0];
  if (dl) { const d = DL[dl]; return `Дауыс моделі жүктелуде: ${Math.round((d.loaded || 0) / (d.total || 1) * 100)}%`; }
  if (n) return `${n} бөлім дайындалуда · ~${fmtLeft(jobsLeft())} қалды`;
  return JB.err ? 'Тоқтады: ' + JB.err : 'Кезек бос';
}
const fmtLeft = s => s < 60 ? `${Math.max(1, Math.round(s))} сек` : s < 3600 ? `${Math.round(s / 60)} мин` : `${Math.floor(s / 3600)} сағ ${Math.round(s % 3600 / 60)} мин`;

// Іске қосылғанда: аяқталмаған кезек жалғасады
addEventListener('DOMContentLoaded', () => setTimeout(async () => {
  let saved = []; try { saved = JSON.parse(localStorage[JB_KEY] || '[]'); } catch { /* бүлінген */ }
  if (!saved.length || !db) return;
  JB.q = saved; jobsEmit();
  if (voiceHave() || (await checkModels(), voiceHave())) jobsRun(); // модель жоқ болса, сұрамай жүктемейміз
}, 1500));
