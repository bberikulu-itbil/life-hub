// The hub's brain: the app registry, the tools the model may call, and the tool-calling loop.
// Adding an app = one entry in APPS here + one display entry in index.html.

type Field = { type: "string" | "number" | "array"; description: string; enum?: string[] };
type App = { name: string; tool: string; about: string; fields: Record<string, Field>; required: string[] };

const s = (description: string, values?: string[]): Field =>
  values ? { type: "string", description, enum: values } : { type: "string", description };
const n = (description: string): Field => ({ type: "number", description });

export const APPS: Record<string, App> = {
  lang: {
    name: "Тіл", tool: "add_word",
    about: "Save an English word or phrase to the vocabulary of the language-learning app.",
    fields: { word: s("English word or phrase"), translation: s("Kazakh translation"), example: s("Short English example sentence"), note: s("Optional note") },
    required: ["word", "translation"],
  },
  books: {
    name: "Кітап", tool: "add_book",
    about: "Add a book to the reading app.",
    fields: { title: s("Book title"), author: s("Author"), status: s("Reading status", ["want", "reading", "done"]), note: s("Optional note") },
    required: ["title"],
  },
  money: {
    name: "Қаржы", tool: "add_transaction",
    about: "Record an expense or income in the finance app. Amounts are in tenge (KZT) unless the user names another currency.",
    fields: { amount: n("Amount, a positive number"), kind: s("expense or income", ["expense", "income"]), category: s("Category in Kazakh, e.g. тамақ, көлік, кітап"), currency: s("Currency code, default KZT"), note: s("Optional note"), date: s("Date YYYY-MM-DD, default today") },
    required: ["amount", "kind", "category"],
  },
  plan: {
    name: "Жоспар", tool: "add_task",
    about: "Add a task or plan item to the planner.",
    fields: { title: s("What to do"), due: s("When: YYYY-MM-DD or YYYY-MM-DD HH:MM"), note: s("Optional note") },
    required: ["title"],
  },
  health: {
    name: "Денсаулық", tool: "add_health_log",
    about: "Log a meal, water, workout, sleep or weight entry in the health app.",
    fields: { type: s("Entry type", ["meal", "water", "workout", "sleep", "weight"]), value: s("What or how much, e.g. '2 стақан', '30 мин жүгіру'"), note: s("Optional note") },
    required: ["type", "value"],
  },
  ideas: {
    name: "Ойлар", tool: "add_note",
    about: "Save a thought, idea or research note.",
    fields: { text: s("The note text"), tags: { type: "array", description: "Optional short tags" } },
    required: ["text"],
  },
};

const fn = (name: string, description: string, parameters: unknown) => ({ type: "function", function: { name, description, parameters } });

export const TOOLS = [
  ...Object.values(APPS).map((a) => fn(a.tool, a.about, {
    type: "object",
    properties: Object.fromEntries(Object.entries(a.fields).map(([k, f]) =>
      [k, f.type === "array" ? { type: "array", items: { type: "string" }, description: f.description } : f])),
    required: a.required,
  })),
  fn("list_items", "Read saved records of one app, newest first. Call it before answering any question about the user's saved data.", {
    type: "object",
    properties: {
      app: { type: "string", enum: Object.keys(APPS), description: Object.entries(APPS).map(([k, a]) => `${k}=${a.name}`).join(", ") },
      search: { type: "string", description: "Optional text to look for" },
      since: { type: "string", description: "Optional YYYY-MM-DD: only records created on or after this date" },
      limit: { type: "integer", description: "Max records, 1-50, default 20" },
    },
    required: ["app"],
  }),
  fn("update_item", "Change a saved record: mark a task done or fix a field.", {
    type: "object",
    properties: {
      id: { type: "string", description: "Record id from list_items or from a save result" },
      done: { type: "boolean", description: "Mark done or not done" },
      changes: { type: "object", description: "Fields to change, same names as when saving" },
    },
    required: ["id"],
  }),
];

export function systemPrompt(now: string): string {
  return [
    "You are Hub, the personal assistant at the center of the user's ecosystem of apps.",
    `Apps you control: ${Object.values(APPS).map((a) => `${a.name} (${a.tool})`).join(", ")}.`,
    `User's local time: ${now || "unknown"}.`,
    "Rules:",
    "- Reply in the user's language (Kazakh by default), briefly and warmly.",
    "- When the user asks to save, add, remember, plan or log something, call the matching tool right away without asking permission. Fill obvious fields yourself: Kazakh translation and an example sentence for an English word, a category for money, real dates for words like 'ертең'.",
    "- One message may need several tools (for example an expense and a task): call all of them.",
    "- To answer questions about saved data, call list_items first and never invent records. For money questions use the totals it returns.",
    "- Ask back only when a required field truly cannot be inferred.",
    "- After acting, confirm in one short sentence what was saved and in which app.",
  ].join("\n");
}

// Returns clean data for an app record, or an error message for the model.
export function cleanRecord(app: App, args: Record<string, unknown>): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(app.fields)) {
    let v: unknown = args[k];
    if (v === undefined || v === null || v === "") continue;
    if (f.type === "number") {
      v = Number(String(v).replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(v)) return `${k} must be a number`;
    } else if (f.type === "array") {
      v = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 10);
    } else {
      v = String(v).trim().slice(0, 4000);
      if (f.enum && !f.enum.includes(v as string)) return `${k} must be one of: ${f.enum.join(", ")}`;
    }
    out[k] = v;
  }
  const missing = app.required.filter((k) => out[k] === undefined);
  return missing.length ? `missing: ${missing.join(", ")}` : out;
}

// shortcut: sums ignore currency (all treated as KZT); split by currency when other currencies show up.
export const totals = (rows: { data: any }[]) =>
  rows.reduce((t, r) => {
    t[r.data?.kind === "income" ? "income" : "expense"] += Number(r.data?.amount) || 0;
    return t;
  }, { expense: 0, income: 0 });

// Runs one tool call against the database (a supabase-js client scoped to the user, so RLS applies).
export async function runTool(db: any, name: string, args: any): Promise<any> {
  const appId = Object.keys(APPS).find((k) => APPS[k].tool === name);
  if (appId) {
    const data = cleanRecord(APPS[appId], args);
    if (typeof data === "string") return { error: data };
    const { data: row, error } = await db.from("items").insert({ app: appId, data }).select("id").single();
    return error ? { error: error.message } : { saved: true, app: appId, id: row.id };
  }
  if (name === "list_items") {
    if (!APPS[args.app]) return { error: "unknown app" };
    let q = db.from("items").select("id, data, done, created_at").eq("app", args.app).order("created_at", { ascending: false }).limit(200);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(args.since ?? ""))) q = q.gte("created_at", args.since);
    const { data: rows, error } = await q;
    if (error) return { error: error.message };
    // shortcut: search scans the latest 200 rows in memory; move it into SQL when an app outgrows that.
    const needle = String(args.search ?? "").toLowerCase();
    const hits = needle ? rows.filter((r: any) => JSON.stringify(r.data).toLowerCase().includes(needle)) : rows;
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
    const out: any = { count: hits.length, items: hits.slice(0, limit) };
    if (args.app === "money") out.totals = totals(hits);
    return out;
  }
  if (name === "update_item") {
    const { data: row, error } = await db.from("items").select("app, data").eq("id", args.id).maybeSingle();
    if (error || !row) return { error: error?.message ?? "record not found" };
    const patch: Record<string, unknown> = {};
    if (typeof args.done === "boolean") patch.done = args.done;
    if (args.changes && typeof args.changes === "object" && APPS[row.app]) {
      const data = cleanRecord(APPS[row.app], { ...row.data, ...args.changes });
      if (typeof data === "string") return { error: data };
      patch.data = { ...row.data, ...data }; // keep fields other apps add, e.g. the Til app's review state (srs)
    }
    if (!Object.keys(patch).length) return { error: "nothing to change" };
    const { error: e2 } = await db.from("items").update(patch).eq("id", args.id);
    return e2 ? { error: e2.message } : { updated: true };
  }
  return { error: `unknown tool ${name}` };
}

// The tool-calling loop: ask the model, run the tools it calls, repeat until it answers in text.
export async function runLoop(
  messages: any[],
  callModel: (messages: any[]) => Promise<{ message: any; model: string }>,
  exec: (name: string, args: any) => Promise<any>,
  maxSteps = 6,
) {
  const actions: { tool: string; args: any; ok: boolean; error?: string }[] = [];
  let model = "";
  for (let step = 0; step < maxSteps; step++) {
    const res = await callModel(messages);
    model = res.model;
    const calls = res.message.tool_calls ?? [];
    messages.push({ role: "assistant", content: res.message.content ?? "", ...(calls.length ? { tool_calls: calls } : {}) });
    if (!calls.length) return { reply: String(res.message.content ?? "").trim(), actions, model };
    let allSaved = true;
    for (const c of calls) {
      let args: any = null;
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* reported to the model below */ }
      const result = args && typeof args === "object" ? await exec(c.function.name, args) : { error: "arguments are not valid JSON" };
      actions.push({ tool: c.function.name, args, ok: !result.error, ...(result.error ? { error: String(result.error) } : {}) });
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
      if (!result.saved) allSaved = false;
    }
    // Plain saves need no confirming model call (the client shows what was saved): one request per message instead of two.
    if (allSaved) return { reply: String(res.message.content ?? "").trim(), actions, model };
  }
  return { reply: "", actions, model };
}

const OPENROUTER = "https://openrouter.ai/api/v1";

// Tries the chain three models per request (OpenRouter falls back inside each request), next three on failure.
export async function callOpenRouter(key: string, chain: string[], messages: any[], fetcher: typeof fetch = fetch, tools: unknown[] = TOOLS) {
  let last = "no models configured";
  for (let i = 0; i < chain.length; i += 3) {
    const res = await fetcher(`${OPENROUTER}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Life Hub" },
      body: JSON.stringify({ models: chain.slice(i, i + 3), messages, ...(tools.length ? { tools, provider: { require_parameters: true } } : {}) }),
    });
    const body: any = await res.json().catch(() => ({}));
    const message = body.choices?.[0]?.message;
    if (res.ok && message) return { message, model: String(body.model ?? "") };
    last = body.error?.message ?? `HTTP ${res.status}`;
  }
  throw new Error(last);
}

let freeCache = { at: 0, ids: [] as string[] };

// Free OpenRouter models that support tool calling, cached for an hour.
export async function freeToolModels(fetcher: typeof fetch = fetch): Promise<string[]> {
  if (freeCache.ids.length && Date.now() - freeCache.at < 3_600_000) return freeCache.ids;
  const res = await fetcher(`${OPENROUTER}/models`);
  const { data = [] } = await res.json().catch(() => ({}));
  const ids = data.filter((m: any) => String(m.id).endsWith(":free") && m.supported_parameters?.includes("tools")).map((m: any) => String(m.id));
  freeCache = { at: Date.now(), ids };
  return ids;
}

// The user's own chain first, then free models, without duplicates.
export function buildChain(userModels: unknown, free: string[]): string[] {
  const mine = (Array.isArray(userModels) ? userModels : [])
    .map((m) => String(m).trim()).filter((m) => /^[\w.\-\/:~]{3,100}$/.test(m)).slice(0, 6);
  return [...new Set([...mine, ...free.slice(0, 6)])];
}

// Only user/assistant text turns from the client; the system prompt is always ours.
export function cleanHistory(messages: unknown) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

// Class broadcasts: turns general class information into one WhatsApp message with {tags}.
// Only the information and the tag names reach the model; names, phones and grades are filled in on the teacher's device.
export function templateMessages(info: string, signature: string, tags: string[] = []) {
  const list = tags.map((t) => String(t).replace(/[{}:]/g, "").slice(0, 40)).filter(Boolean).slice(0, 30);
  return [
    { role: "system", content: [
      "You write WhatsApp messages from a school class teacher to the parents of the class.",
      "Write in the language of the information (Kazakh by default), polite and warm, short and clear.",
      "Start with: Құрметті {Алушы}! ({Алушы} becomes the recipient's name).",
      "Refer to the child as {Оқушы аты}. When the child's name needs the genitive case (-ның/-нің/-дың/-дің/-тың/-тің), write {Оқушы аты:ның} and never add a suffix yourself.",
      list.length ? `Placeholders you may use, written exactly with curly braces: ${list.map((t) => `{${t}}`).join(", ")}. Use the data ones (grades, scores…) where the information calls for them.` : "",
      "Use no other placeholders or blanks.",
      "Keep every fact exactly: dates, times, places, amounts, requirements. Never invent facts.",
      "Plain text with short paragraphs; WhatsApp *bold* is allowed for the key date or deadline. At most one emoji.",
      "At most 900 characters.",
      signature ? `End with this signature on its own line: ${signature}` : "End with: Сынып жетекшісі",
      "Return only the message text.",
    ].filter(Boolean).join("\n") },
    { role: "user", content: info.slice(0, 6000) },
  ];
}
