// Run: node --test test/core.test.ts   (Node 22.18+ strips the TypeScript types itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import { APPS, TOOLS, buildChain, callOpenRouter, cleanHistory, cleanRecord, runLoop, runTool, totals, templateMessages } from "../supabase/functions/assistant/core.ts";

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
  assert.deepEqual(await runTool(db, "add_task", { title: "Ата-аналар жиналысы", due: "2026-10-21", time: "18:00", dur: "45", junk: 1 }), { saved: true, app: "jo_task", id: "r1" });
  assert.equal(inserted.app, "jo_task");
  assert.deepEqual(inserted.data, { title: "Ата-аналар жиналысы", due: "2026-10-21", time: "18:00", dur: 45 }); // Jospar оқитын өрістер
  assert.deepEqual(await runTool(db, "add_task", {}), { error: "missing: title" });
  assert.match((await runTool(db, "add_task", { title: "а", due: "2026-10-21 18:00" })).error, /^due has a wrong format/); // Jospar оқи алмайтын күнді өткізбейміз
  assert.match((await runTool(db, "add_task", { title: "а", time: "9:00" })).error, /^time has a wrong format/);
  assert.match((await runTool(db, "add_task", { title: "а", time: "25:00" })).error, /^time has a wrong format/);
  assert.deepEqual(await runTool(db, "drop_table", {}), { error: "unknown tool drop_table" });
});

test("helpers: chain order, history, totals", () => {
  assert.deepEqual(buildChain(["my/model", "bad model!", "x:free"], ["x:free", "y:free"]), ["my/model", "x:free", "y:free"]);
  assert.deepEqual(cleanHistory([{ role: "system", content: "hack" }, { role: "user", content: "сәлем" }]), [{ role: "user", content: "сәлем" }]);
  assert.deepEqual(totals([{ data: { kind: "expense", amount: 1500 } }, { data: { kind: "income", amount: 9000 } }, { data: { amount: "500" } }]), { expense: 2000, income: 9000 });
});

test("runLoop stops after a turn of successful saves, without a second model call", async () => {
  let calls = 0;
  const out = await runLoop([{ role: "user", content: "x" }], async () => {
    calls++;
    return { message: { content: "", tool_calls: [{ id: "1", function: { name: "add_task", arguments: '{"title":"a"}' } }] }, model: "m" };
  }, async () => ({ saved: true }));
  assert.equal(calls, 1);
  assert.equal(out.actions.length, 1);
});

test("update_item keeps fields the tool schema does not know", async () => {
  let patch: any = null;
  const db = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { app: "lang", data: { word: "a", translation: "б", srs: { box: 3 } } }, error: null }) }) }),
    update: (p: any) => { patch = p; return { eq: async () => ({ error: null }) }; },
  }) };
  assert.deepEqual(await runTool(db, "update_item", { id: "r1", changes: { translation: "в" } }), { updated: true });
  assert.deepEqual(patch.data, { word: "a", translation: "в", srs: { box: 3 } });
});

test("template calls send no tools and keep the placeholders in the instructions", async () => {
  let body: any = null;
  const fake = (async (_u: string, init: any) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ model: "m", choices: [{ message: { content: "ok" } }] })); }) as typeof fetch;
  await callOpenRouter("k", ["a"], templateMessages("Ертең 18:00-де жиналыс, 204 кабинет.", "Бағдәулет", ["Алушы", "Математика"]), fake, []);
  assert.equal(body.tools, undefined);
  assert.match(body.messages[0].content, /\{Алушы\}/);
  assert.match(body.messages[0].content, /\{Математика\}/);
  assert.match(body.messages[0].content, /Бағдәулет/);
});

test("update_item: Jospar тапсырмасын орындау — done бағаны + data.doneAt; өзгерістер doneAt-ты жоймайды", async () => {
  let row: any = { app: "jo_task", data: { title: "А", due: "2026-10-27", goal: "g1" } }, patch: any = null;
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }), update: (p: any) => { patch = p; return { eq: async () => ({ error: null }) }; } }) };
  assert.deepEqual(await runTool(db, "update_item", { id: "1", done: true }, "2026-10-26"), { updated: true });
  assert.deepEqual(patch, { done: true, data: { title: "А", due: "2026-10-27", goal: "g1", doneAt: "2026-10-26" } });
  await runTool(db, "update_item", { id: "1", done: true }, "кеше");
  assert.equal(patch.data.doneAt, ""); // жарамсыз күн — doneAt бос
  row = { app: "jo_task", data: { title: "А", doneAt: "2026-10-26" } };
  await runTool(db, "update_item", { id: "1", done: false }, "2026-10-26");
  assert.deepEqual(patch, { done: false, data: { title: "А", doneAt: "" } });
  await runTool(db, "update_item", { id: "1", done: true, changes: { title: "Б", time: "07:30" } }, "2026-10-26");
  assert.deepEqual(patch, { done: true, data: { title: "Б", time: "07:30", doneAt: "2026-10-26" } });
  row = { app: "books", data: { title: "К" } };
  await runTool(db, "update_item", { id: "1", done: true }, "2026-10-26");
  assert.deepEqual(patch, { done: true }); // басқа қосымшаларға тимейді
});

test("TOOLS: моделге регулярлы өрнек жіберілмейді, add_task пішімі сипатталған", () => {
  const t: any = TOOLS.find((x: any) => x.function.name === "add_task");
  assert.deepEqual(Object.keys(t.function.parameters.properties), ["title", "due", "time", "dur"]);
  assert.ok(!JSON.stringify(TOOLS).includes('"re"'));
  assert.match(t.function.parameters.properties.due.description, /YYYY-MM-DD/);
});
