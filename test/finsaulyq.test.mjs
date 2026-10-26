import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const FS = createRequire(import.meta.url)("../finsaulyq/core.js");

const S = (over = {}) => ({ settings: { capital: 0, income: 0, fixed: 0 }, tx: [], cycles: [], goals: [], ...over });

test("brandMatch: ₸/күн және жылдық үнем (А 75.0, Б 48.9)", () => {
  const r = FS.brandMatch([{ name: "А", price: 1650, days: 22 }, { name: "Б", price: 2200, days: 45 }]);
  assert.equal(r.best, 1);
  assert.equal(r.rows[0].perDay, 75);
  assert.equal(r.rows[1].perDay.toFixed(1), "48.9");
  assert.equal(r.yearSaving, 9531);
});

test("цикл: қалған күн, қор пайызы, келесі сатып алу", () => {
  const c = { every: 45, last: "2026-10-01", price: 1000 };
  assert.equal(FS.cycleDaysLeft(c, "2026-10-26"), 20);
  assert.equal(FS.stockPct(c, "2026-10-26"), 44);
  assert.equal(FS.nextBuy(c), "2026-11-15");
  assert.equal(FS.stockPct(c, "2027-03-01"), 0); // мерзімі өтсе, теріс болмайды
});

test("goalMonthly: қалған соманы қалған айға бөледі, ең аз 1 ай", () => {
  const g = { target: 600000, saved: 0, months: 6, start: "2026-10-01" };
  assert.equal(FS.goalMonthly(g, "2026-10-26"), 100000);
  assert.equal(FS.goalMonthly(g, "2026-12-05"), 150000); // 4 ай қалды
  assert.equal(FS.goalMonthly({ ...g, saved: 700000 }, "2026-10-26"), 0);
  assert.equal(FS.goalMonthly(g, "2028-01-01"), 600000); // мерзімі өтті — бір айда
});

test("forecast: тұрақты шығын + циклдер + мақсат жарнасы", () => {
  const s = S({
    settings: { capital: 0, income: 0, fixed: 50000 },
    cycles: [{ every: 21, last: "2026-10-20", price: 3000 }], // келесісі 11-10, содан 12-01, 12-22
    goals: [{ target: 300000, saved: 0, months: 3, start: "2026-10-01" }],
  });
  const f = FS.forecast(s, "2026-10-26", 3);
  assert.deepEqual(f.map((x) => x.month), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(f.map((x) => x.cycles), [0, 3000, 6000]);
  assert.equal(f[1].total, 50000 + 3000 + 100000);
});

test("forecast: мерзімі өткен цикл бүгін алынады", () => {
  const s = S({ cycles: [{ every: 30, last: "2026-09-01", price: 500 }] }); // келесісі 10-01, өтіп кеткен
  assert.equal(FS.forecast(s, "2026-10-26", 1)[0].cycles, 500);
});

test("monthTotals және balance", () => {
  const s = S({
    settings: { capital: 10000, income: 0, fixed: 0 },
    tx: [
      { kind: "income", amount: 5000, category: "Жалақы", date: "2026-10-05" },
      { kind: "expense", amount: 1200, category: "Тамақ", date: "2026-10-10" },
      { kind: "expense", amount: 800, category: "Тамақ", date: "2026-10-12" },
      { kind: "expense", amount: 999, category: "Көлік", date: "2026-09-30" }, // басқа ай
    ],
  });
  const m = FS.monthTotals(s.tx, "2026-10-26");
  assert.deepEqual([m.income, m.expense, m.byCat["Тамақ"], m.byCat["Көлік"]], [5000, 2000, 2000, undefined]);
  assert.equal(FS.balance(s), 10000 + 5000 - 1200 - 800 - 999);
});
