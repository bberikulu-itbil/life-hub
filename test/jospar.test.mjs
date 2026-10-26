import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const JO = createRequire(import.meta.url)("../jospar/core.js");

const T = "2026-10-26";
const good = { id: "g", name: "Таңғы жаттығу", kind: "good", steps: ["Шпагат 10 минут", "Отырып тұру 15 рет"], time: "", dur: 0, created: "2026-10-20" };
const bad = { id: "b", name: "Тырнақ тістеу", kind: "bad", steps: [], time: "", dur: 0, created: "2026-10-20" };
const log = (habit, date, o = {}) => ({ id: habit + date, habit, date, done: [], slip: false, resist: 0, count: 0, ...o });

test("жақсы әдет: тек барлық пункт белгіленгенде орындалды", () => {
  assert.equal(JO.dayStatus(good, undefined), "todo");
  assert.equal(JO.dayStatus(good, log("g", T, { done: [0] })), "todo");
  assert.equal(JO.dayStatus(good, log("g", T, { done: [0, 1] })), "done");
  const solo = { ...good, steps: [] }; // пунктсіз — бір белгі жеткілікті
  assert.equal(JO.dayStatus(solo, log("g", T, { done: [0] })), "done");
});

test("жаман әдет: автоматты орындалды, сүрінсе — slip", () => {
  assert.equal(JO.dayStatus(bad, undefined), "done");
  assert.equal(JO.dayStatus(bad, log("b", T, { resist: 2 })), "done");
  assert.equal(JO.dayStatus(bad, log("b", T, { slip: true })), "slip");
});

test("жақсы әдет сериясы: бүгін әлі орындалмаса, үзілмейді", () => {
  const S = { logs: ["2026-10-24", "2026-10-25"].map((d) => log("g", d, { done: [0, 1] })) };
  assert.deepEqual(JO.runs(S, good, T), { cur: 2, best: 2 });
  S.logs.push(log("g", T, { done: [0, 1] }));
  assert.deepEqual(JO.runs(S, good, T), { cur: 3, best: 3 });
  assert.deepEqual(JO.runs({ logs: [] }, good, T), { cur: 0, best: 0 });
});

test("жаман әдет сериясы: бүгін күн жабылғанша есептелмейді, сүрінсе 0, ең ұзақ сақталады", () => {
  assert.deepEqual(JO.runs({ logs: [] }, bad, T), { cur: 6, best: 6 }); // 20–25 қазан
  assert.deepEqual(JO.runs({ logs: [] }, { ...bad, created: T }, T), { cur: 0, best: 0 }); // бүгін ашылды
  const S = { logs: [log("b", "2026-10-23", { slip: true })] };
  assert.deepEqual(JO.runs(S, bad, T), { cur: 2, best: 3 }); // 24–25 және бұрынғы 20–22
  S.logs.push(log("b", T, { slip: true }));
  assert.deepEqual(JO.runs(S, bad, T), { cur: 0, best: 3 });
});

test("бейтарап әдетте серия жоқ", () => {
  assert.deepEqual(JO.runs({ logs: [] }, { ...bad, kind: "neutral" }, T), { cur: 0, best: 0 });
});

test("күрес күндері: бір күнде көп басса да бір күн; ай бойынша сүзгі", () => {
  const S = { logs: [log("b", "2026-10-24", { resist: 3 }), log("b", T, { resist: 1 }), log("b", "2026-09-30", { resist: 1 }), log("b", "2026-10-22")] };
  assert.equal(JO.fightDays(S, bad), 3);
  assert.equal(JO.fightDays(S, bad, "2026-10"), 2);
});

test("pickMsg: қайталанбайды, {best} тек 0-ден жоғары болғанда, сан орнына қойылады", () => {
  const r = JO.pickMsg(JO.RESIST, { n: 5 }, 1, () => 0);
  assert.notEqual(r.i, 1);
  assert.ok(!/\{/.test(r.text));
  for (let k = 0; k < 40; k++) assert.ok(!/NaN|undefined|\{/.test(JO.pickMsg(JO.SLIP, { best: 0 }, -1, Math.random).text));
  assert.match(JO.pickMsg(["{best} күн"], { best: 4 }).text, /^4 күн$/);
  for (const t of [...JO.RESIST, ...JO.SLIP]) assert.ok(!/\p{Extended_Pictographic}/u.test(t), "эмодзи болмауы керек");
});

test("fromRow: жарамсыз жолдар — null, жарамдылары түзетіледі", () => {
  const row = (app, data) => ({ id: "x", app, data });
  assert.equal(JO.fromRow(row("jo_habit", { name: " ", kind: "good", created: T })), null);
  assert.equal(JO.fromRow(row("jo_habit", { name: "А", kind: "evil", created: T })), null);
  assert.equal(JO.fromRow(row("jo_log", { habit: "g", date: "ертең" })), null);
  assert.equal(JO.fromRow(row("money", { amount: 1 })), null);
  assert.deepEqual(JO.fromRow(row("jo_habit", { name: "А", kind: "good", created: T, steps: ["a", 5], time: "9:00", dur: -1 })), { id: "x", name: "А", kind: "good", steps: ["a"], time: "", dur: 0, created: T });
  assert.deepEqual(JO.fromRow(row("jo_log", { habit: "g", date: T, done: [0, "1", -2], resist: "x" })).done, [0]);
});

test("toRow ↔ fromRow айналымы", () => {
  const r = JO.toRow("habits", good);
  assert.equal(r.app, "jo_habit");
  assert.deepEqual(JO.fromRow(r), good);
});

test("mergePull: сервер негіз, кезектегі өзгеріс жеңеді, кезектегі өшіру қайтып келмейді", () => {
  const rows = [JO.toRow("habits", good), JO.toRow("habits", bad), JO.toRow("logs", log("g", T, { done: [0] }))];
  const local = log("g", T, { done: [0, 1] });
  const S = { habits: [], logs: [local], pending: [{ k: "logs", id: local.id, op: "put", n: 1 }, { k: "habits", id: "b", op: "del", n: 2 }] };
  const m = JO.mergePull(S, [...rows.slice(0, 2), { ...rows[2], id: local.id }]);
  assert.deepEqual(m.habits.map((h) => h.id), ["g"]);
  assert.deepEqual(m.logs[0].done, [0, 1]);
});
