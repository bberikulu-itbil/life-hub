// Run: node --test test/core.test.ts   (Node 22.18+ strips the TypeScript types itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import { APPS, buildChain, callOpenRouter, cleanHistory, cleanRecord, runLoop, runTool, totals } from "../supabase/functions/assistant/core.ts";

test("cleanRecord coerces numbers, checks enums and required fields", () => {
  assert.deepEqual(cleanRecord(APPS.money, { amount: "1 500,5", kind: "expense", category: "тамақ", junk: 1 }),
    { amount: 1500.5, kind: "expense", category: "тамақ" });
  assert.equal(cleanRecord(APPS.money, { amount: "көп", kind: "expense", category: "x" }), "amount must be a number");
  assert.match(String(cleanRecord(APPS.books, { title: "Абай жолы", status: "maybe" })), /status must be one of/);
  assert.equal(cleanRecord(APPS.lang, { word: "serendipity" }), "missing: translation");
  assert.deepEqual(cleanRecord(APPS.ideas, { text: "ой", tags: "a, b" }), { text: "ой", tags: ["a", "b"] });
});

test("runLoop runs every tool call, then returns the text answer", async () => {
  const replies = [
    { message: { content: null, tool_calls: [
      { id: "1", function: { name: "add_word", arguments: '{"word":"serendipity","translation":"кездейсоқ олжа"}' } },
      { id: "2", function: { name: "add_transaction", arguments: "not json" } },
    ] }, model: "m1" },
    { message: { content: "Сақталды." }, model: "m2" },
  ];
  const ran: string[] = [];
  const out = await runLoop([{ role: "user", content: "x" }], async () => replies.shift()!, async (name) => { ran.push(name); return { saved: true }; });
  assert.deepEqual(ran, ["add_word"]);
  assert.equal(out.reply, "Сақталды.");
  assert.equal(out.model, "m2");
  assert.deepEqual(out.actions.map((a) => a.ok), [true, false]);
});

test("callOpenRouter moves to the next three models when a request fails", async () => {
  const sent: string[][] = [];
  const fake = (async (_url: string, init: any) => {
    const { models } = JSON.parse(init.body);
    sent.push(models);
    return sent.length === 1
      ? new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 })
      : new Response(JSON.stringify({ model: models[0], choices: [{ message: { content: "ok" } }] }));
  }) as typeof fetch;
  const out = await callOpenRouter("k", ["a", "b", "c", "d"], [], fake);
  assert.deepEqual(sent, [["a", "b", "c"], ["d"]]);
  assert.equal(out.model, "d");
  await assert.rejects(callOpenRouter("k", [], [], fake), /no models configured/);
});

test("runTool saves into the right app and refuses bad input", async () => {
  let inserted: any = null;
  const db = { from: () => ({ insert: (row: any) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: "r1" }, error: null }) }) }; } }) };
  assert.deepEqual(await runTool(db, "add_task", { title: "Ата-аналар жиналысы", due: "2026-10-21 18:00" }), { saved: true, app: "plan", id: "r1" });
  assert.equal(inserted.app, "plan");
  assert.deepEqual(await runTool(db, "add_task", {}), { error: "missing: title" });
  assert.deepEqual(await runTool(db, "drop_table", {}), { error: "unknown tool drop_table" });
});

test("helpers: chain order, history, totals", () => {
  assert.deepEqual(buildChain(["my/model", "bad model!", "x:free"], ["x:free", "y:free"]), ["my/model", "x:free", "y:free"]);
  assert.deepEqual(cleanHistory([{ role: "system", content: "hack" }, { role: "user", content: "сәлем" }]), [{ role: "user", content: "сәлем" }]);
  assert.deepEqual(totals([{ data: { kind: "expense", amount: 1500 } }, { data: { kind: "income", amount: 9000 } }, { data: { amount: "500" } }]), { expense: 2000, income: 9000 });
});
