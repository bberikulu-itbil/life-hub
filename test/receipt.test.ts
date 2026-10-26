// Run: node --test test/receipt.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { okImage, parseReceipt, pickVision } from "../supabase/functions/receipt/parse.ts";

const T = "2026-10-26";
test("parseReceipt: таза JSON, ``` ішіндегі және мәтінмен аралас жауап", () => {
  const want = { store: "Magnum", total: 12345.5, date: "2026-10-20", category: "Тамақ", items: [] };
  const j = JSON.stringify({ ...want });
  assert.deepEqual(parseReceipt(j, T), want);
  assert.deepEqual(parseReceipt("```json\n" + j + "\n```", T), want);
  assert.deepEqual(parseReceipt("Мына чек: " + j + " Дайын.", T), want);
});
test("parseReceipt: сома жолмен, бос орынмен, үтірмен", () => {
  assert.equal((parseReceipt('{"total":"12 345,50","date":null}', T) as any).total, 12345.5);
});
test("parseReceipt: сома жоқ/жарамсыз — қате; күн жоқ, болашақ не ескі — бүгін", () => {
  for (const bad of ['{"total":null}', '{"total":0}', '{"total":-5}', '{"total":"abc"}', '{"total":1e12}', "жоқ", "{сынық"]) assert.ok("error" in parseReceipt(bad, T), bad);
  for (const d of ["null", '"2027-01-01"', '"1999-01-01"', '"20.10.2026"']) assert.equal((parseReceipt(`{"total":5,"date":${d}}`, T) as any).date, T, d);
  assert.equal((parseReceipt('{"total":5}', T) as any).category, "Басқа");
});
test("parseReceipt: позициялар — жарамсыздары (атауы/бағасы жоқ, теріс) түседі", () => {
  const r = parseReceipt(JSON.stringify({ total: 900, items: [{ name: "Сүт  1л", price: "450", category: "Тамақ" }, { name: "", price: 5 }, { name: "Қате", price: -1 }, { name: "Нан", price: "1 000,5" }, null] }), T) as any;
  assert.deepEqual(r.items, [{ name: "Сүт 1л", price: 450, category: "Тамақ" }, { name: "Нан", price: 1000.5, category: "Басқа" }]);
});
test("okImage: тек JPEG/PNG/WebP data URL, көлемі шектелген", () => {
  assert.ok(okImage("data:image/jpeg;base64,AAAA"));
  for (const bad of ["http://x/y.jpg", "data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64,AA AA", 5, null, "data:image/png;base64," + "A".repeat(4_000_000)]) assert.equal(okImage(bad), false);
});
test("pickVision: тек тегін және кескінді оқитындар, gemini алдымен, өз модельдер ең алдымен", () => {
  const m = (id: string, img = true) => ({ id, architecture: { input_modalities: img ? ["text", "image"] : ["text"] } });
  const got = pickVision([m("x/llama-4-maverick:free"), m("g/gemini-2.0-flash:free"), m("a/text:free", false), m("p/gemini-pro"), m("q/qwen2.5-vl:free")], ["me/own:model", "bad model!"]);
  assert.deepEqual(got, ["me/own:model", "g/gemini-2.0-flash:free", "q/qwen2.5-vl:free", "x/llama-4-maverick:free"]);
});
