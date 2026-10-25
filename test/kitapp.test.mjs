import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chunkText, tfOf, rank } = createRequire(import.meta.url)("../kitapp/rag.js");

test("chunkText keeps every word and respects the limit", () => {
  const text = Array.from({ length: 300 }, (_, i) => `Сөйлем ${i} осында.`).join(" ");
  const parts = chunkText(text, 200);
  assert.ok(parts.every((p) => p.length <= 200));
  assert.equal(parts.join(" ").replace(/\s+/g, " "), text);
});

test("rank finds the chunk with the query word, even with a Kazakh suffix", () => {
  const mk = (text, n) => ({ text, n, tf: tfOf(text) });
  const chunks = [mk("Бүгін ауа райы жақсы, күн ашық.", 0), mk("Алгоритмдер есепті шешу қадамдары болып табылады.", 1), mk("Қала тұрғындары базарға барды.", 2)];
  assert.equal(rank("алгоритмнің мағынасы қандай?", chunks, 1)[0].n, 1);
});

test("rank falls back to an even sample when nothing matches", () => {
  const chunks = Array.from({ length: 20 }, (_, n) => ({ text: "x", n, tf: {} }));
  const out = rank("жоқсөзжоқ", chunks, 4);
  assert.deepEqual(out.map((c) => c.n), [0, 5, 10, 15]);
});

const KS = createRequire(import.meta.url)("../kitapp/kstats.js");
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const sess = (day, secs) => ({ day, secs });

test("summarize: streak counts back from today, or from yesterday if today is empty", () => {
  const now = at(2026, 10, 24);
  const s = KS.summarize([sess("2026-10-24", 300), sess("2026-10-23", 90), sess("2026-10-22", 60), sess("2026-10-20", 600)], now);
  assert.equal(s.streak, 3);
  assert.equal(s.today, 300);
  assert.equal(s.week, 1050);
  const y = KS.summarize([sess("2026-10-23", 120), sess("2026-10-22", 120)], now);
  assert.equal(y.streak, 2);
  assert.equal(KS.summarize([sess("2026-10-24", 30)], now).streak, 0); // 1 минуттан аз күн есепке кірмейді
});

test("daysAgo crosses month borders and remaining needs enough data", () => {
  assert.equal(KS.daysAgo(at(2026, 3, 1), 1), "2026-02-28");
  assert.equal(KS.remaining(60, 50), null);
  assert.equal(KS.remaining(3600, 25), 3600 / 25 * 75);
  assert.equal(KS.fmtDur(5400), "1 сағ 30 мин");
});

const KSP = createRequire(import.meta.url)("../kitapp/kspeed.js");

test("orp picks a letter inside the word, skipping leading punctuation", () => {
  assert.equal(KSP.orp("а"), 0);
  assert.equal(KSP.orp("кітап"), 1);
  assert.equal(KSP.orp("«кітап»"), 2);
  assert.equal(KSP.orp("информатика"), 3);
});

test("chunkAt stops at a sentence end and delayFor slows down there", () => {
  const w = ["Бүгін", "жақсы", "күн.", "Ертең", "жаңбыр"];
  assert.deepEqual(KSP.chunkAt(w, 0, 4).words, ["Бүгін", "жақсы", "күн."]);
  assert.equal(KSP.chunkAt(w, 5, 2), null);
  assert.ok(KSP.delayFor(["күн."], 300) > KSP.delayFor(["күн"], 300));
  assert.equal(KSP.delayFor(["күн."], 300, KSP.opts(0, false)), 200);
});

test("stagesFor grows with the baseline and every stage is faster than the last start", () => {
  const s = KSP.stagesFor(200);
  assert.equal(s[0].from, 200);
  assert.ok(s.every((x) => x.to > x.from));
  assert.ok(KSP.stagesFor(300)[3].from > s[3].from);
  assert.equal(KSP.rampWpm(200, 300, 2), 300);
});

import vm from "node:vm";
import fs from "node:fs";

test("cleanText joins hyphenated words and drops bare page numbers", () => {
  const ctx = vm.createContext({ supabase: { createClient: () => ({}) }, esc: (s) => s, localStorage: {} });
  vm.runInContext(fs.readFileSync(new URL("../kitapp/chat.js", import.meta.url), "utf8") + ";this.cleanText=cleanText", ctx);
  assert.equal(ctx.cleanText("Кіта-\nпхана — бұл\n12\nорын.  Келесі\nжол"), "Кітапхана — бұл орын. Келесі жол");
});

const KC = createRequire(import.meta.url)("../kitapp/kconvert.js");
const it = (str, x, y, size = 10) => ({ str, transform: [size, 0, 0, size, x, y], width: str.length * size * .5, height: size });
const LINE = "Мұғалім сыныпқа кіріп балалармен әңгімені бастады және сұрақ қойды"; // ~65 таңба, толық жол

function fakeBook() {
  const pages = [];
  for (let p = 1; p <= 5; p++) {
    const items = [it("Тәрбие сағатынан естеліктер", 120, 800, 9)];
    let y = 760;
    if (p === 1 || p === 4) { items.push(it(p === 1 ? "1-тарау" : "2-тарау", 150, y, 18)); y -= 30; }
    const L = "абвгдежзик"[p];
    for (let k = 0; k < 6; k++, y -= 14) items.push(it(`${LINE} ${L}${"абвгде"[k]}`, 50, y));
    if (p === 2) { items.push(it("Бұл кіта-", 50, y)); y -= 14; items.push(it("пхана туралы әңгіме болды", 50, y), it("1", 190, y + 4, 6)); y -= 14; }
    items.push(it("Абзац соңы.", 50, y)); y -= 14;
    items.push(it(`Жаңа абзац басталды ${L} ${LINE}`, 62, y)); y -= 14;
    items.push(it(String(p), 300, 40, 9));
    pages.push(KC.linesFromItems(items));
  }
  return pages;
}

test("structure removes page numbers, running headers and footnote marks", () => {
  const { chapters, removed } = KC.structure(fakeBook());
  const text = chapters.flatMap((c) => c.paras).join("\n");
  assert.equal(removed.pageNum, 5);
  assert.equal(removed.header, 5);
  assert.ok(!/Тәрбие сағатынан/.test(text));
  assert.ok(text.includes("Бұл кітапхана туралы әңгіме болды Абзац") || text.includes("Бұл кітапхана туралы әңгіме болды"));
  assert.ok(!/болды 1\b/.test(text));
});

test("structure survives blank pages (picture pages, empty backs)", () => {
  const pages = fakeBook();
  pages.splice(2, 0, [], KC.linesFromItems([it("   ", 50, 700)]));
  const { chapters } = KC.structure(pages);
  assert.deepEqual(chapters.map((c) => c.title), ["1-тарау", "2-тарау"]);
});

test("structure splits chapters by large headings and paragraphs by indent", () => {
  const { chapters } = KC.structure(fakeBook());
  assert.deepEqual(chapters.map((c) => c.title), ["1-тарау", "2-тарау"]);
  assert.ok(chapters[0].paras.some((p) => p.startsWith("Жаңа абзац басталды")));
  assert.ok(chapters[0].paras.every((p) => !/^\d+$/.test(p)));
});

test("structure prefers the PDF outline for chapter titles", () => {
  const { chapters } = KC.structure(fakeBook(), [{ title: "Кіріспе", page: 0 }, { title: "Негізгі бөлім", page: 3 }]);
  assert.deepEqual(chapters.map((c) => c.title), ["Кіріспе", "Негізгі бөлім"]);
  assert.ok(!chapters[0].paras.includes("1-тарау")); // тарау атының қайталануы алынды
});

test("structure keeps headings inside a chapter as sub-headings", () => {
  const { chapters } = KC.structure(fakeBook(), [{ title: "Кіріспе", page: 0 }, { title: "Соңы", page: 4 }]);
  assert.deepEqual(chapters[0].heads, ["2-тарау"]);
  assert.ok(chapters[0].paras.includes("2-тарау"));
});

test("chunkAt stops at a chapter boundary", () => {
  const w = ["бір", "екі", "үш", "төрт"];
  assert.deepEqual(KSP.chunkAt(w, 0, 4, new Map([[2, {}]])).words, ["бір", "екі"]);
});

test("goalPlan: daily pace, status against the plan, done and late", () => {
  const set = at(2026, 10, 1), now = at(2026, 10, 11); // 10 күн өтті, мерзім 30 қазан
  const g = { by: "2026-10-30", set, p0: 0 };
  const p = KS.goalPlan(g, 20, now, 300, 3600);
  assert.equal(p.daysLeft, 20);
  assert.equal(p.pctPerDay, 4);                 // (100-20)/20
  assert.equal(p.pagesPerDay, 12);              // 4% × 300 бет
  assert.equal(p.minsPerDay, 3600 / 20 * 4 / 60); // 1% = 180 сек
  assert.equal(p.status, "behind");             // жоспар бойынша ~34% болуы керек еді
  assert.equal(KS.goalPlan(g, 40, now).status, "ahead");
  assert.equal(KS.goalPlan(g, 100, now).status, "done");
  assert.equal(KS.goalPlan({ by: "2026-10-05", set, p0: 0 }, 50, now).status, "late");
});

test("structure uses a table-of-contents page and its page-number offset to find chapters", () => {
  const P = (items) => KC.linesFromItems(items);
  const body = (p, title) => {
    const items = [];
    let y = 760;
    if (title) { items.push(it(title, 150, y, 10)); y -= 40; }       // тақырып мәтінмен бірдей өлшемде
    for (let k = 0; k < 8; k++, y -= 14) items.push(it(`${LINE} ${"абвгдежзик"[p]}${"абвгдеж"[k]}`, 50, y));
    items.push(it(String(p + 10), 200, 40, 9));                     // басылған нөмір = физикалық + 10
    return P(items);
  };
  const toc = P([it("МАЗМҰНЫ", 150, 780, 12), it("Кіріспе", 50, 740), it("..............", 120, 740), it("10", 330, 740),
    it("Бірінші бөлім атауы", 50, 720), it("..............", 160, 720), it("12", 330, 720)]);
  const pages = [toc, body(0, "КІРІСПЕ"), body(1), body(2, "БІРІНШІ БӨЛІМ АТАУЫ"), body(3)];
  const r = KC.structure(pages);
  assert.equal(r.via, "toc");
  assert.deepEqual(r.chapters.map((c) => c.title), ["Кіріспе", "Бірінші бөлім атауы"]);
  assert.ok(!r.chapters.flatMap((c) => c.paras).some((p) => /МАЗМҰНЫ|КІРІСПЕ|\.{5}/.test(p)));
});

test("structure puts a drop cap back at the start of its paragraph", () => {
  const items = [it("Ұ", 50, 732, 34)];
  let y = 760;
  for (let k = 0; k < 6; k++, y -= 14) items.push(it(`${k ? "" : "стаз "}${LINE} ${"абвгде"[k]}`, k < 2 ? 80 : 50, y));
  const r = KC.structure([KC.linesFromItems(items)]);
  assert.ok(r.chapters[0].paras[0].startsWith("Ұстаз " + LINE));
});

test("tidy turns all-caps headings into sentence case", () => {
  assert.equal(KC.tidy("1-ТАРАУ. ТӘУБЕ ЕТУ"), "1-тарау. Тәубе ету");
  assert.equal(KC.tidy("АЛҒЫ СӨЗ"), "Алғы сөз");
  assert.equal(KC.tidy("Абай жолы"), "Абай жолы");
});
