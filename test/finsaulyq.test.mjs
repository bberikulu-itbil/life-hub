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

test("normCat: регистр мен бос орын бір санатқа келеді", () => {
  assert.deepEqual(["тамақ", " ТАМАҚ ", "Тамақ"].map(FS.normCat), ["Тамақ", "Тамақ", "Тамақ"]);
  assert.equal(FS.normCat("  "), "Басқа");
  const m = FS.monthTotals([{ kind: "expense", amount: 1, category: "тамақ", date: "2026-10-01" }, { kind: "expense", amount: 2, category: "Тамақ", date: "2026-10-02" }], "2026-10-26");
  assert.deepEqual(m.byCat, { Тамақ: 3 });
});

test("жарна: қолжетімді қалдықтан шығады, мақсат жиналған соманы көрсетеді", () => {
  const s = S({ settings: { capital: 100000, income: 0, fixed: 0 }, goals: [{ id: "g", target: 300000, saved: 20000, months: 3, start: "2026-10-01" }], contribs: [{ goalId: "g", amount: 30000 }, { goalId: "x", amount: 5 }] });
  assert.equal(FS.balance(s), 100000 - 30000 - 5);
  assert.equal(FS.goalSaved(s.goals[0], s.contribs), 50000);
  assert.equal(FS.forecast(s, "2026-10-26", 1)[0].goals, Math.ceil(250000 / 3)); // жарна қалған соманы азайтады
});

test("fromRow: ассистент жазған money жолы (дата жоқ, аз әріппен, сома жолмен)", () => {
  const e = FS.fromRow({ id: "a", app: "money", created_at: "2026-10-20T10:00:00+05:00", data: { amount: "2500", kind: "expense", category: "тамақ", currency: "KZT" } });
  assert.deepEqual(e, { id: "a", kind: "expense", amount: 2500, category: "Тамақ", note: "", date: "2026-10-20" });
});

test("fromRow: жарамсыз жолдар және бөтен қолданбалар өткізіліп жіберіледі", () => {
  const r = (app, data) => FS.fromRow({ id: "z", app, data, created_at: "2026-10-01T00:00:00Z" });
  assert.equal(r("money", { amount: "abc", kind: "expense" }), null);
  assert.equal(r("money", { amount: 5, kind: "transfer" }), null);
  assert.equal(r("fs_cycle", { price: 5, every: -1, last: "2026-10-01" }), null);
  assert.equal(r("lang", { word: "x" }), null);
});

test("toRow ↔ fromRow: цикл мен tx айналып келеді, tx-ке валюта қосылады", () => {
  const c = { id: "c1", name: "Паста", price: 1500, every: 45, buffer: 3, cat: "Тұрмыс", last: "2026-10-01" };
  assert.deepEqual(FS.fromRow({ ...FS.toRow("cycles", c), created_at: "2026-10-01T00:00:00Z" }), c);
  const t = { id: "t1", kind: "income", amount: 5, category: "Жалақы", note: "", date: "2026-10-05" };
  const row = FS.toRow("tx", t);
  assert.equal(row.app, "money"); assert.equal(row.data.currency, "KZT"); assert.equal(row.data.id, undefined);
  assert.deepEqual(FS.fromRow({ ...row, created_at: "2026-10-05T00:00:00Z" }), t);
});

test("mergePull: сервер негіз, кезектегі put үстінен жазады, del жасырады, басқа құрылғыда өшкен кетеді", () => {
  const T = (id, amount) => ({ id, kind: "expense", amount, category: "Тамақ", note: "", date: "2026-10-01" });
  const row = (id, amount) => FS.toRow("tx", T(id, amount));
  const S0 = { settings: { capital: 1, income: 2, fixed: 3, hide: true }, settingsId: null, tx: [T("local-edit", 999), T("gone", 1), T("new-local", 7), T("del-me", 4)], cycles: [], goals: [], stock: [], matches: [], contribs: [],
    pending: [{ k: "tx", id: "local-edit", op: "put" }, { k: "tx", id: "new-local", op: "put" }, { k: "tx", id: "del-me", op: "del" }] };
  const rows = [row("local-edit", 10), row("del-me", 4), row("remote", 5), { id: "s", app: "fs_settings", created_at: "2026-10-01T00:00:00Z", data: { capital: 50, income: 60, fixed: 70 } }];
  const m = FS.mergePull(S0, rows);
  assert.deepEqual(m.tx.map((x) => [x.id, x.amount]).sort(), [["local-edit", 999], ["new-local", 7], ["remote", 5]]);
  assert.deepEqual(m.settings, { capital: 50, income: 60, fixed: 70, city: "Астана", hide: true }); // hide — тек құрылғыда
  assert.equal(m.settingsId, "s");
  const m2 = FS.mergePull({ ...S0, pending: [{ k: "settings", id: "s", op: "put" }] }, rows);
  assert.equal(m2.settings.capital, 1); // жіберілмеген баптау сервердікін ауыстырады
});

test("wallet: шоттар, аударым, шотсыз қалта; жиынтық balance-пен тең", () => {
  const s = S({
    settings: { capital: 1000, income: 0, fixed: 0 },
    accounts: [{ id: "cash", name: "Қолма-қол", opening: 500 }, { id: "card", name: "Карта", opening: 2000 }],
    tx: [
      { id: "1", kind: "expense", amount: 300, category: "Тамақ", date: "2026-10-01", account: "cash" },
      { id: "2", kind: "income", amount: 5000, category: "Жалақы", date: "2026-10-02", account: "card" },
      { id: "3", kind: "expense", amount: 100, category: "Көлік", date: "2026-10-03" }, // шоты жоқ (ассистент)
      { id: "4", kind: "expense", amount: 7, category: "Көлік", date: "2026-10-03", account: "deleted" }, // шоты өшкен
    ],
    contribs: [{ goalId: "g", amount: 400, account: "card" }],
    transfers: [{ id: "t", from: "card", to: "cash", amount: 1000 }, { id: "u", from: "", to: "cash", amount: 200 }],
  });
  const w = FS.wallet(s), by = Object.fromEntries(w.accounts.map((a) => [a.id, a.balance]));
  assert.equal(by.cash, 500 - 300 + 1000 + 200);
  assert.equal(by.card, 2000 + 5000 - 400 - 1000);
  assert.equal(w.loose, 1000 - 100 - 7 - 200);
  assert.equal(by.cash + by.card + w.loose, FS.balance(s)); // аударым жиынтықты өзгертпейді
});

test("wallet: шот жоқ, жазба жоқ — шотсыз қалта көрінбейді; ескі күйде balance өзгермейді", () => {
  assert.equal(FS.wallet(S()).loose, null);
  const old = S({ settings: { capital: 10, income: 0, fixed: 0 }, tx: [{ id: "1", kind: "income", amount: 5, category: "x", date: "2026-10-01" }] });
  assert.equal(FS.wallet(old).loose, 15); assert.equal(FS.balance(old), 15);
});

test("fromRow: шот және аударым; жарамсыз аударым өткізіледі", () => {
  const r = (app, data) => FS.fromRow({ id: "z", app, data, created_at: "2026-10-01T00:00:00Z" });
  assert.equal(r("money", { amount: 5, kind: "expense", category: "x", date: "2026-10-01", account: "a1" }).account, "a1");
  assert.equal("account" in r("money", { amount: 5, kind: "expense", category: "x", date: "2026-10-01" }), false);
  assert.equal(r("fs_account", { name: "Карта", opening: 0 }).name, "Карта");
  assert.equal(r("fs_transfer", { from: "a", to: "a", amount: 5 }), null);
  assert.equal(r("fs_transfer", { from: "a", to: "b", amount: 0 }), null);
  assert.equal(r("fs_transfer", { from: "", to: "b", amount: 5 }).from, "");
});

test("mergePull: шоттар ашылған ретімен", () => {
  const a = (id) => ({ id, app: "fs_account", created_at: "2026-10-01T00:00:00Z", data: { name: id, opening: 0 } });
  assert.deepEqual(FS.mergePull(S({ pending: [] }), [a("жаңа"), a("ескі")]).accounts.map((x) => x.id), ["ескі", "жаңа"]);
});

test("recalcCycle: цикл-күн — сатып алулар арасындағы күндердің орташасы; бір item болса болжам сақталады", () => {
  const c = { id: "c", every: 45, last: "2026-01-01", price: 1000 };
  const it = (time, cost) => ({ cycleId: "c", time, cost });
  FS.recalcCycle(c, [it("2026-01-01", 1000)]);
  assert.equal(c.every, 45);
  FS.recalcCycle(c, [it("2026-02-20", 1200), it("2026-01-01", 1000), it("2026-03-12", 1100), { cycleId: "x", time: "2030-01-01", cost: 1 }]);
  assert.deepEqual([c.every, c.last, c.price], [Math.round((50 + 20) / 2), "2026-03-12", 1100]);
  assert.equal(FS.perDay({ price: 1100, every: 35 }).toFixed(1), "31.4");
});

test("migrate: ескі цикл бір item алады, қайта жүргізсе қайталанбайды, id тұрақты", () => {
  const s = { settings: { city: "Астана" }, items: [], cycles: [{ id: "abc", name: "Паста", price: 900, every: 40, last: "2026-10-01" }] };
  assert.equal(FS.migrate(s), 1); assert.equal(FS.migrate(s), 0);
  assert.equal(s.items.length, 1);
  assert.deepEqual([s.items[0].id, s.items[0].cycleId, s.items[0].cost, s.items[0].time, s.cycles[0].every, s.cycles[0].status], ["fbc", "abc", 900, "2026-10-01", 40, "active"]);
  assert.equal(FS.itemIdOf("fbc"), "ebc");
});

test("matchCycle және groupReceipt: чек позициясы циклге, қалғаны санатқа; архивтелген цикл сәйкес келмейді", () => {
  const cycles = [{ id: "c1", name: "Тіс пастасы", cat: "күтім" }, { id: "c2", name: "Сүт", cat: "Тамақ", status: "archived" }];
  assert.equal(FS.matchCycle("Паста тіс пастасы 75мл", cycles)?.id, "c1");
  assert.equal(FS.matchCycle("Сүт 1л", cycles), null);
  assert.equal(FS.matchCycle("ab", cycles), null);
  const g = FS.groupReceipt([{ name: "тіс пастасы", price: 900, category: "Тұрмыс" }, { name: "Нан", price: 100, category: "тамақ" }, { name: "Сүт", price: 400, category: "Тамақ" }], cycles);
  assert.deepEqual(g.byCat, { Күтім: 900, Тамақ: 500 });
  assert.deepEqual(g.rows.map((r) => r.cycleId), ["c1", "", ""]);
});

test("fromRow: item жарамды болса ғана; tx.store және settings.city сақталады", () => {
  const r = (app, data) => FS.fromRow({ id: "z", app, data, created_at: "2026-10-01T00:00:00Z" });
  assert.equal(r("fs_item", { cycleId: "c", cost: 5, time: "2026-10-01" }).cost, 5);
  assert.equal(r("fs_item", { cycleId: "c", cost: "x", time: "2026-10-01" }), null);
  assert.equal(r("fs_item", { cycleId: "c", cost: 5, time: "ертең" }), null);
  assert.equal(r("money", { amount: 5, kind: "expense", category: "x", date: "2026-10-01", store: "Magnum" }).store, "Magnum");
  assert.equal(r("fs_settings", { city: " Алматы " }).item.city, "Алматы");
  assert.equal(FS.toRow("settings", { capital: 1, income: 2, fixed: 3, city: "Алматы" }, "s").data.city, "Алматы");
});

test("санат/ішкі санат және кіріс көзі: fromRow, monthTotals.bySub", () => {
  const r = (app, data) => FS.fromRow({ id: "z", app, data, created_at: "2026-10-01T00:00:00Z" });
  assert.deepEqual(r("fs_category", { name: "Тамақ", subs: ["Азық", "Кафе"] }).subs, ["Азық", "Кафе"]);
  assert.equal(r("fs_category", { name: " " }), null);
  assert.equal(r("fs_income", { name: "Жалақы", amount: 400000 }).amount, 400000);
  assert.equal(r("fs_income", { name: "Жалақы", amount: 0 }), null);
  assert.equal(r("money", { amount: 5, kind: "expense", category: "тамақ", date: "2026-10-01", sub: "Кафе" }).sub, "Кафе");
  const m = FS.monthTotals([{ kind: "expense", amount: 5, category: "Тамақ", sub: "Кафе", date: "2026-10-01" }, { kind: "expense", amount: 7, category: "тамақ", sub: "Кафе", date: "2026-10-02" }, { kind: "expense", amount: 1, category: "Тамақ", date: "2026-10-02" }], "2026-10-26");
  assert.deepEqual([m.byCat["Тамақ"], m.bySub["Тамақ"]], [13, { Кафе: 12 }]);
});

test("цикл-күн белгісіз (every=0): ескерту/болжам жоқ, 2 сатып алудан кейін өздігінен есептеледі", () => {
  const c = { id: "c", every: 0, last: "2026-10-01", price: 1000 };
  assert.equal(FS.cycleDaysLeft(c, "2026-10-26"), Infinity);
  assert.equal(FS.nextBuy(c), ""); assert.equal(FS.perDay(c), 0);
  assert.equal(FS.forecast({ settings: { fixed: 0 }, cycles: [c], goals: [] }, "2026-10-26", 1)[0].cycles, 0); // әйтпесе шексіз цикл болар еді
  assert.equal(FS.fromRow({ id: "z", app: "fs_cycle", data: { price: 5, every: 0, last: "2026-10-01" }, created_at: "2026-10-01T00:00:00Z" }).every, 0);
  FS.recalcCycle(c, [{ cycleId: "c", time: "2026-10-01", cost: 1000 }, { cycleId: "c", time: "2026-10-31", cost: 1100 }]);
  assert.equal(c.every, 30);
});
