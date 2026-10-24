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
