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
