"use strict";
/* Jospar есептеу ядросы: DOM-сыз, тестке ыңғайлы. Күндер — «YYYY-MM-DD» жолдары.
   Әдет: { id, name, kind: good|bad|neutral, steps: [ішкі пункттер], time: "HH:MM"|"", dur: минут, created }
   Күн жазбасы (әдет + күн үшін біреу): { id, habit, date, done: [орындалған пункт нөмірлері], slip, resist, count } */
const MS = 864e5;
const dnum = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / MS; };
const dstr = (n) => new Date(n * MS).toISOString().slice(0, 10);
const addDays = (s, n) => dstr(dnum(s) + n);
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
const APP_OF = { habits: "jo_habit", logs: "jo_log" };
const KEY_OF = Object.fromEntries(Object.entries(APP_OF).map(([k, a]) => [a, k]));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const nn = (v) => Number.isInteger(v) && v >= 0;

// Жарамсыз жол — null (интерфейсті бұзбау үшін)
function fromRow(r) {
  const k = KEY_OF[r.app], d = r.data || {};
  if (k === "habits") return typeof d.name === "string" && d.name.trim() && KINDS.includes(d.kind) && DATE.test(d.created)
    ? { id: r.id, name: d.name, kind: d.kind, steps: Array.isArray(d.steps) ? d.steps.filter((s) => typeof s === "string") : [], time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : "", dur: nn(d.dur) ? d.dur : 0, created: d.created } : null;
  if (k === "logs") return typeof d.habit === "string" && DATE.test(d.date)
    ? { id: r.id, habit: d.habit, date: d.date, done: Array.isArray(d.done) ? d.done.filter(nn) : [], slip: d.slip === true, resist: nn(d.resist) ? d.resist : 0, count: nn(d.count) ? d.count : 0 } : null;
  return null;
}
const toRow = (k, e) => { const { id, ...data } = e; return { id, app: APP_OF[k], data }; };

// Сервер негіз; әлі жіберілмеген жергілікті өзгерістер оның үстінен жазылады
function mergePull(S, rows) {
  const next = { habits: [], logs: [] }, pend = new Map((S.pending || []).map((p) => [p.k + ":" + p.id, p.op]));
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

const JO = { addDays, stepCount, logOf, dayStatus, runs, fightDays, RESIST, SLIP, pickMsg, APP_OF, fromRow, toRow, mergePull };
if (typeof module !== "undefined") module.exports = JO;
