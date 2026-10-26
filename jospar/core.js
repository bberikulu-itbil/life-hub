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

const stepCount = (h) => Math.max(1, h.steps.length); // пунктсіз жақсы әдет — бір «пункт»
const logOf = (S, id, date) => S.logs.find((l) => l.habit === id && l.date === date);

// Жақсы: барлық пункт белгіленсе орындалды. Жаман: сүрінбесе — автоматты орындалды. Бейтарап: бақылау ғана.
function dayStatus(h, log) {
  if (h.kind === "good") { const d = new Set(log?.done); return Array.from({ length: stepCount(h) }, (_, i) => d.has(i)).every(Boolean) ? "done" : "todo"; }
  if (h.kind === "bad") return log?.slip ? "slip" : "done";
  return "tally";
}

// Серия/ең ұзақ серия. Жақсы әдетте бүгін де есептеледі; жаманда бүгін күн жабылғанша есептелмейді (ертең расталады)
function runs(S, h, today) {
  const m = new Map(S.logs.filter((l) => l.habit === h.id).map((l) => [l.date, l]));
  const ok = (d) => dayStatus(h, m.get(d)) === "done";
  const bad = h.kind === "bad", last = bad ? addDays(today, -1) : today;
  let cur = 0, best = 0, run = 0;
  for (let d = h.created; dnum(d) <= dnum(last); d = addDays(d, 1)) { run = ok(d) ? run + 1 : 0; best = Math.max(best, run); }
  if (h.kind === "neutral") return { cur: 0, best: 0 };
  cur = run; // соңғы күнге дейінгі қатар
  if (!bad && !ok(today)) { // жақсы әдет: бүгін әлі орындалмаса, серия үзілмейді — кешегіге дейін санаймыз
    cur = 0;
    for (let d = addDays(today, -1); dnum(d) >= dnum(h.created) && ok(d); d = addDays(d, -1)) cur++;
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
    const ok = dayStatus(h, m.get(d)) === "done";
    if (d === today && (h.kind === "bad" || !ok)) continue;
    total++; if (ok) done++;
  }
  return { done, total };
}

// Мақсат: байланған тапсырмалар бойынша прогресс
const goalProgress = (S, g) => { const t = S.tasks.filter((x) => x.goal === g.id); return { done: t.filter((x) => x.done).length, total: t.length }; };

// Басты бетке түсетін тапсырма: мерзімі бүгін, мерзімі өтіп орындалмаған, не бүгін орындалған
const todayTask = (t, today) => t.due === today || (!t.done && t.due !== "" && t.due < today) || (t.done && t.doneAt === today);

// Осы айдың статистикасы (ай басынан бүгінге дейін)
function monthStats(S, today) {
  const month = today.slice(0, 7), r = S.habits.filter((h) => h.kind === "good").map((h) => rate(S, h, today, Number(today.slice(8)))).filter((x) => x.total);
  const total = r.reduce((t, x) => t + x.total, 0);
  return { tasksDone: S.tasks.filter((t) => t.done && t.doneAt.startsWith(month)).length, goodPct: total ? Math.round(r.reduce((t, x) => t + x.done, 0) / total * 100) : null,
    fights: S.habits.reduce((t, h) => t + (h.kind === "bad" ? fightDays(S, h, month) : 0), 0), slips: S.logs.filter((l) => l.slip && l.date.startsWith(month)).length };
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

// ---- Supabase `items` ↔ жергілікті күй ----
const APP_OF = { habits: "jo_habit", logs: "jo_log", tasks: "jo_task", goals: "jo_goal" };
const KEY_OF = Object.fromEntries(Object.entries(APP_OF).map(([k, a]) => [a, k]));
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const text = (v) => typeof v === "string" && v.trim() !== "";
const nn = (v) => Number.isInteger(v) && v >= 0;

// Жарамсыз жол — null (интерфейсті бұзбау үшін)
function fromRow(r) {
  const k = KEY_OF[r.app], d = r.data || {};
  if (k === "habits") return typeof d.name === "string" && d.name.trim() && KINDS.includes(d.kind) && DATE.test(d.created)
    ? { id: r.id, name: d.name, kind: d.kind, steps: Array.isArray(d.steps) ? d.steps.filter((s) => typeof s === "string") : [], time: TIME.test(d.time) ? d.time : "", dur: nn(d.dur) ? d.dur : 0, created: d.created } : null;
  if (k === "tasks") return text(d.title)
    ? { id: r.id, title: d.title, goal: typeof d.goal === "string" ? d.goal : "", due: DATE.test(d.due) ? d.due : "", time: TIME.test(d.time) ? d.time : "", dur: nn(d.dur) ? d.dur : 0, done: r.done === true, doneAt: r.done === true && DATE.test(d.doneAt) ? d.doneAt : "" } : null;
  if (k === "goals") return text(d.title) && DATE.test(d.deadline) ? { id: r.id, title: d.title, why: typeof d.why === "string" ? d.why : "", deadline: d.deadline } : null;
  if (k === "logs") return typeof d.habit === "string" && DATE.test(d.date)
    ? { id: r.id, habit: d.habit, date: d.date, done: Array.isArray(d.done) ? d.done.filter(nn) : [], slip: d.slip === true, resist: nn(d.resist) ? d.resist : 0, count: nn(d.count) ? d.count : 0 } : null;
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

const JO = { addDays, daysBetween, stepCount, logOf, dayStatus, runs, rate, goalProgress, todayTask, monthStats, fightDays, RESIST, SLIP, pickMsg, APP_OF, fromRow, toRow, mergePull };
if (typeof module !== "undefined") module.exports = JO;
