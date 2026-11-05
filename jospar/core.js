"use strict";
/* Jospar есептеу ядросы: DOM-сыз, тестке ыңғайлы. Күндер — «YYYY-MM-DD» жолдары.
   Әдет: { id, name, kind: good|bad|neutral, steps: [ішкі пункттер], time: "HH:MM"|"", dur: минут, created }
   Күн жазбасы (әдет + күн үшін біреу): { id, habit, date, done: [орындалған пункт нөмірлері], slip, resist, count }
   Тапсырма: { id, title, goal: мақсат id|"", due: күн|"", time, dur, done (items.done бағаны), doneAt: күн|"" }
   Мақсат (SMART): { id, title, why, deadline } — өлшемі: оған байланған тапсырмалардың орындалуы */
const MS = 864e5;
const dnum = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / MS; };
const dstr = (n) => new Date(n * MS).toISOString().slice(0, 10);
const addDays = (s, n) => dstr(dnum(s) + n);
const daysBetween = (a, b) => dnum(b) - dnum(a);
const KINDS = ["good", "bad", "neutral"];

const scheduled = (h, date) => date >= h.created && !(h.breaks || []).some(b => date >= b.start && (!b.end || date < b.end)) && (!h.days?.length || h.days.includes(new Date(date + "T12:00:00Z").getUTCDay()));
const goalMetric = (g) => ({ current: Math.max(0, Number(g.current) || 0), target: Math.max(0, Number(g.target) || 0) });
const amount = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const trackingOf = h => ["check","timer","counter","steps"].includes(h.tracking) ? h.tracking : h.steps?.length || h.measures?.length ? "steps" : h.target > 0 ? "counter" : "check";
const stepCount = (h) => Math.max(1, h.steps.length); // пунктсіз жақсы әдет — бір «пункт»
const logOf = (S, id, date) => S.logs.find((l) => l.habit === id && l.date === date);

// Жақсы: барлық пункт белгіленсе орындалды. Жаман: сүрінбесе — автоматты орындалды. Бейтарап: бақылау ғана.
function dayStatus(h, log) {
  if(h.kind === "good" && h.tracking) {
    const mode=trackingOf(h);
    if(mode === "timer" || mode === "counter") return h.target > 0 && amount(log?.count) >= h.target ? "done" : "todo";
    if(mode === "check") return log?.done?.includes(0) ? "done" : "todo";
    const hasSteps=h.steps.length || h.measures?.length;
    return hasSteps && h.steps.every((_,i)=>log?.done?.includes(i)) && (h.measures || []).every(step=>amount(log?.values?.[step.id])>=step.target) ? "done" : "todo";
  }
  if (h.kind === "good") { const d = new Set(log?.done); const stepsDone = (!h.steps.length || h.steps.every((_, i) => d.has(i))) && (h.measures || []).every(step => amount(log?.values?.[step.id]) >= step.target); return (h.target > 0 ? amount(log?.count) >= h.target && stepsDone : (h.steps.length || h.measures?.length ? stepsDone : d.has(0))) ? "done" : "todo"; }
  if (h.kind === "bad") return log?.slip ? "slip" : "done";
  return "tally";
}

// Серия/ең ұзақ серия. Жақсы әдетте бүгін де есептеледі; жаманда бүгін күн жабылғанша есептелмейді (ертең расталады)
function runs(S, h, today) {
  const m = new Map(S.logs.filter((l) => l.habit === h.id).map((l) => [l.date, l]));
  const ok = (d) => dayStatus(h, m.get(d)) === "done";
  const bad = h.kind === "bad", last = bad ? addDays(today, -1) : today;
  let cur = 0, best = 0, run = 0;
  for (let d = h.created; dnum(d) <= dnum(last); d = addDays(d, 1)) { if (!scheduled(h, d)) continue; run = ok(d) ? run + 1 : 0; best = Math.max(best, run); }
  if (h.kind === "neutral") return { cur: 0, best: 0 };
  cur = run; // соңғы күнге дейінгі қатар
  if (!bad && !ok(today)) { // жақсы әдет: бүгін әлі орындалмаса, серия үзілмейді — кешегіге дейін санаймыз
    cur = 0;
    for (let d = addDays(today, -1); dnum(d) >= dnum(h.created) && (!scheduled(h, d) || ok(d)); d = addDays(d, -1)) { if (scheduled(h, d)) cur++; }
  }
  if (bad && m.get(today)?.slip) cur = 0;
  return { cur, best };
}

// Соңғы `days` күндегі орындалу: { done, total } (бейтараптан — null). Бүгін: жақсы әдет орындалса ғана есептеледі, жаман әдет бүгін есептелмейді
function rate(S, h, today, days = 30) {
  if (h.kind === "neutral") return null;
  const m = new Map(S.logs.filter((l) => l.habit === h.id).map((l) => [l.date, l]));
  let done = 0, total = 0;
  for (let d = dnum(h.created) > dnum(today) - days + 1 ? h.created : addDays(today, 1 - days); dnum(d) <= dnum(today); d = addDays(d, 1)) {
    if (!scheduled(h, d)) continue;
    const ok = dayStatus(h, m.get(d)) === "done";
    if (d === today && (h.kind === "bad" || !ok)) continue;
    total++; if (ok) done++;
  }
  return { done, total };
}

// Мақсат: байланған тапсырмалар бойынша прогресс
const goalProgress = (S, g) => { const t = S.tasks.filter((x) => x.goal === g.id); return { done: t.filter((x) => x.done).length, total: t.length }; };

// Мақсаттың қадамдары және бүгінге дейінгі жоспарланған әдет күндері.
function goalOverview(S, g, today) {
  const tasks = goalProgress(S, g), habits = S.habits.filter(h => h.goal === g.id && h.kind !== "neutral");
  let done = tasks.done, total = tasks.total;
  for (const hb of habits) {
    const end = g.deadline < today ? g.deadline : today;
    for (let d = hb.created; d <= end; d = addDays(d, 1)) {
      if (!scheduled(hb, d) || (hb.kind === "bad" && d === today)) continue;
      total++; if (dayStatus(hb, logOf(S, hb.id, d)) === "done") done++;
    }
  }
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}

// Басты бетке түсетін тапсырма: мерзімі бүгін, мерзімі өтіп орындалмаған, не бүгін орындалған
const todayTask = (t, today) => t.due === today;

// Осы айдың статистикасы (ай басынан бүгінге дейін)
function monthStats(S, today) {
  const month = today.slice(0, 7), r = S.habits.filter((h) => h.kind === "good").map((h) => rate(S, h, today, Number(today.slice(8)))).filter((x) => x.total);
  const total = r.reduce((t, x) => t + x.total, 0);
  return { tasksDone: S.tasks.filter((t) => t.done && t.doneAt.startsWith(month)).length, goodPct: total ? Math.round(r.reduce((t, x) => t + x.done, 0) / total * 100) : null,
    fights: S.habits.reduce((t, h) => t + (h.kind === "bad" ? fightDays(S, h, month) : 0), 0), slips: S.logs.filter((l) => l.slip && l.date.startsWith(month)).length };
}

// Күн ұпайы: орындалған тапсырмалар (doneAt) + орындалған жақсы әдеттер + сүрінбеген жаман әдеттер (күн жабылғанда) — әрқайсысы өз салмағымен
function dayPoints(S, date, today) {
  let p = S.tasks.reduce((t, x) => t + (x.done && x.doneAt === date ? wt(x.w) : 0), 0);
  for (const h of S.habits) {
    if (h.kind === "neutral" || !scheduled(h, date) || date > today) continue;
    if (dayStatus(h, logOf(S, h.id, date)) === "done" && (h.kind === "good" || date < today)) p += wt(h.w);
  }
  return p;
}
const weekday = (s) => (new Date(dnum(s) * MS).getUTCDay() + 6) % 7; // дүйсенбі = 0

// Профиль: апта/ай ұпайы, белсенді күндер қатары және соңғы `weeks` аптаның жылу картасы (дүйсенбіден басталады)
function profileStats(S, today, weeks = 13) {
  const start = addDays(today, -weekday(today) - 7 * (weeks - 1)), days = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push({ date: d, p: dayPoints(S, d, today) });
  const sum = (from) => days.filter((x) => x.date >= from).reduce((t, x) => t + x.p, 0);
  let cur = 0, best = 0, run = 0;
  for (const x of days) { run = x.p > 0 ? run + 1 : 0; best = Math.max(best, run); }
  for (let i = days.length - 1 - (days.at(-1).p > 0 ? 0 : 1); i >= 0 && days[i].p > 0; i--) cur++; // бүгін әлі бос болса, серия үзілмейді
  return { days, week: sum(addDays(today, -weekday(today))), month: sum(today.slice(0, 8) + "01"), cur, best, max: Math.max(0, ...days.map((x) => x.p)) };
}

// Күрес күндері: «Шыдадым» кемінде бір рет басылған күндер (month: «YYYY-MM» болса, сол ай ғана)
const fightDays = (S, h, month = "") => S.logs.filter((l) => l.habit === h.id && l.resist > 0 && l.date.startsWith(month)).length;

// Қолдау хабарлары: тек қазақша, кінәлаусыз. {n} — осы айдағы күрес күні, {best} — ең ұзақ серия
const RESIST = ["Тоқтай алдың. Бұл — нағыз ерік-жігер.", "Бұл айдағы {n}-ші күрес күнің. Әр күн күшейте түседі.", "Қалау келді де өтті, ал таңдау өзіңде қалды.",
  "Мықтысың. Қазір тоқтау — ертеңгі еркіндік.", "Триггер келді — сен жеңдің. Мұны есепке жаздық.", "Сен әдеттің айтқанын емес, өз шешіміңді жасадың.",
  "Бір күрес — бір қадам. Жалғастыр.", "{n}-ші күрес күні тіркелді. Мақтануға татиды."];
const SLIP = ["Бір күн — бүкіл жол емес. Ертең қайта бастаймыз.", "Сүрінуге болады, ең бастысы — қайта тұру.", "Өзіңді кінәлама. Не болғанын байқадың — бұл да жұмыс.",
  "Ең ұзақ қатарың ({best} күн) өзгермейді. Қайта бастау — әлсіздік емес."];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k]);
function pickMsg(list, vars, last = -1, rand = Math.random) {
  const ok = list.map((t, i) => i).filter((i) => i !== last && (!/\{best\}/.test(list[i]) || vars.best > 0));
  const i = ok[Math.floor(rand() * ok.length)];
  return { i, text: fill(list[i], vars) };
}


// Өлшенетін қадамдар: секунд, рет немесе еркін өлшем; нәтиже межемен шектелмейді.
function measuresOf(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.filter(x => x && typeof x.id === "string" && x.id && !ids.has(x.id) && ids.add(x.id) && typeof x.name === "string" && x.name.trim() && ["timer", "counter"].includes(x.mode) && Number.isFinite(x.target) && x.target > 0).map(x => ({ id:x.id, name:x.name.trim(), mode:x.mode, target:x.target, unit:x.mode === "timer" ? "сек" : typeof x.unit === "string" ? x.unit : "рет", increment:Number.isFinite(x.increment) && x.increment > 0 ? x.increment : 1 }));
}
function periodComparison(S, today, weekStart = 1) {
  const day = new Date(today + "T12:00:00Z").getUTCDay(), offset = (day - weekStart + 7) % 7;
  const week = addDays(today, -offset), month = today.slice(0,8) + "01";
  const prevEnd = addDays(month, -1), prevMonth = prevEnd.slice(0,8) + "01";
  const sum = (from, to) => { let n=0; for(let d=from; d<=to; d=addDays(d,1)) n+=dayPoints(S,d,today); return n; };
  const elapsed = daysBetween(month,today);
  return { week:sum(week,today), previousWeek:sum(addDays(week,-7),addDays(today,-7)), month:sum(month,today), previousMonth:sum(prevMonth, addDays(prevMonth, Math.min(elapsed,daysBetween(prevMonth,prevEnd)))) };
}
function restoreEntries(data) {
  if (!data || data.version !== 1) throw new Error("Сақтық көшірме нұсқасы танылмады.");
  const result = {}, allIds = new Set(), logKeys = new Set();
  for(const k of Object.keys(APP_OF)) {
    if(!Array.isArray(data[k])) throw new Error("Сақтық көшірме толық емес.");
    result[k] = data[k].map(e => {
      if(!e || typeof e.id !== "string" || !e.id || allIds.has(e.id)) throw new Error("Жазба нөмірі жарамсыз немесе қайталанған.");
      allIds.add(e.id);
      const decoded = fromRow(toRow(k,e));
      if(!decoded) throw new Error("Сақтық көшірмеде жарамсыз жазба бар.");
      if(k === "logs") { const key = decoded.habit + ":" + decoded.date; if(logKeys.has(key)) throw new Error("Бір күнге екі жазба бар."); logKeys.add(key); }
      return decoded;
    });
  }
  const habits = new Set(result.habits.map(h => h.id)), goals = new Set(result.goals.map(g => g.id));
  if(result.logs.some(l => !habits.has(l.habit)) || [...result.habits,...result.tasks].some(e => e.goal && !goals.has(e.goal))) throw new Error("Жазбалар арасындағы байланыс толық емес.");
  return result;
}
// ---- Supabase `items` ↔ жергілікті күй ----
const APP_OF = { habits: "jo_habit", logs: "jo_log", tasks: "jo_task", goals: "jo_goal" };
const KEY_OF = Object.fromEntries(Object.entries(APP_OF).map(([k, a]) => [a, k]));
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const wt = (v) => (Number.isInteger(v) && v >= 0 && v <= 5 ? v : 1); // салмақ 0–5; 0 — міндетті емес, ұпай бермейді; жоқ болса 1
const text = (v) => typeof v === "string" && v.trim() !== "";
const nn = (v) => Number.isInteger(v) && v >= 0;

// Жарамсыз жол — null (интерфейсті бұзбау үшін)
function fromRow(r) {
  const k = KEY_OF[r.app], d = r.data || {};
  if (k === "habits") return typeof d.name === "string" && d.name.trim() && KINDS.includes(d.kind) && DATE.test(d.created)
    ? { id: r.id, name: d.name, kind: d.kind, steps: Array.isArray(d.steps) ? d.steps.filter((s) => typeof s === "string") : [], time: TIME.test(d.time) ? d.time : "", dur: nn(d.dur) ? d.dur : 0, w: wt(d.w), created: d.created,
      ...(["check","timer","counter","steps"].includes(d.tracking) ? {tracking:d.tracking} : {}),
      ...(d.increment !== undefined ? {increment:amount(d.increment) || 1} : {}),
      ...(Array.isArray(d.measures) ? { measures: measuresOf(d.measures) } : {}),
      ...(Array.isArray(d.breaks) ? { breaks:d.breaks.filter(b => b && DATE.test(b.start) && (!b.end || DATE.test(b.end))).map(b => ({start:b.start,end:b.end || ""})) } : {}),
      ...(d.state === "paused" || d.state === "archived" ? {state:d.state} : {}),
      ...(Array.isArray(d.days) ? { days: [...new Set(d.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))] } : {}), ...(typeof d.goal === "string" ? { goal: d.goal } : {}), ...(d.target !== undefined ? { target: amount(d.target), unit: typeof d.unit === "string" ? d.unit : "" } : {}) } : null;
  if (k === "tasks") return text(d.title)
    ? { id: r.id, title: d.title, goal: typeof d.goal === "string" ? d.goal : "", due: DATE.test(d.due) ? d.due : "", time: TIME.test(d.time) ? d.time : "", dur: nn(d.dur) ? d.dur : 0, w: wt(d.w), ...(d.milestone === true ? {milestone:true} : {}), done: r.done === true, doneAt: r.done === true && DATE.test(d.doneAt) ? d.doneAt : "" } : null;
  if (k === "goals") return text(d.title) && DATE.test(d.deadline) ? { id: r.id, title: d.title, why: typeof d.why === "string" ? d.why : "", deadline: d.deadline, ...(Array.isArray(d.history) ? {history:d.history.filter(e => e && DATE.test(e.date) && Number.isFinite(e.current)).map(e => ({date:e.date,current:amount(e.current)}))} : {}), ...(d.target !== undefined || d.current !== undefined ? goalMetric(d) : {}), ...(typeof d.unit === "string" ? { unit: d.unit } : {}) } : null;
  if (k === "logs") return typeof d.habit === "string" && DATE.test(d.date)
    ? { id: r.id, habit: d.habit, date: d.date, done: Array.isArray(d.done) ? d.done.filter(nn) : [], slip: d.slip === true, resist: nn(d.resist) ? d.resist : 0, count: amount(d.count),
      ...(d.values && typeof d.values === "object" && !Array.isArray(d.values) ? {values:Object.fromEntries(Object.entries(d.values).filter(([k,v]) => !["__proto__","constructor","prototype"].includes(k) && Number.isFinite(v) && v >= 0))} : {}),
      ...(d.focusSeconds !== undefined ? {focusSeconds:amount(d.focusSeconds)} : {}),
      ...(typeof d.note === "string" ? {note:d.note} : {}), ...(typeof d.reason === "string" ? {reason:d.reason} : {}) } : null;
  return null;
}
const toRow = (k, e) => {
  const { id, ...data } = e;
  if (k !== "tasks") return { id, app: APP_OF[k], data };
  const { done, ...rest } = data; // «орындалды» — items.done бағанында: Hub пен ассистент те сол бағанды өзгертеді
  return { id, app: APP_OF[k], data: rest, done };
};

// Сервер негіз; әлі жіберілмеген жергілікті өзгерістер оның үстінен жазылады
function mergePull(S, rows) {
  const next = Object.fromEntries(Object.keys(APP_OF).map((k) => [k, []])), pend = new Map((S.pending || []).map((p) => [p.k + ":" + p.id, p.op]));
  for (const r of rows) {
    const e = fromRow(r);
    if (e && pend.get(KEY_OF[r.app] + ":" + e.id) !== "del") next[KEY_OF[r.app]].push(e);
  }
  for (const p of S.pending || []) {
    const local = p.op === "put" && S[p.k].find((x) => x.id === p.id);
    if (!local) continue;
    const i = next[p.k].findIndex((x) => x.id === p.id);
    if (i >= 0) next[p.k][i] = local; else next[p.k].push(local);
  }
  next.habits.sort((a, b) => a.created.localeCompare(b.created) || a.name.localeCompare(b.name)); // жолдар жаңадан ескіге келеді
  return next;
}

const JO = { trackingOf, measuresOf, periodComparison, restoreEntries, weekday, dayPoints, profileStats, goalOverview, scheduled, goalMetric, addDays, daysBetween, stepCount, logOf, dayStatus, runs, rate, goalProgress, todayTask, monthStats, fightDays, RESIST, SLIP, pickMsg, APP_OF, fromRow, toRow, mergePull };
if (typeof module !== "undefined") module.exports = JO;
