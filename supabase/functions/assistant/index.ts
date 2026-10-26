import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { buildChain, callOpenRouter, cleanHistory, freeToolModels, parseTranslation, runLoop, runTool, systemPrompt, templateMessages, translateMessages } from "./core.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // A client scoped to the caller, so every query runs under their row-level security.
  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? Deno.env.get("SUPABASE_ANON_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, publishable, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: owner } = await db.rpc("is_hub_owner");
  if (owner !== true) return json({ error: "Бұл Hub-қа тек оның иесі кіре алады." }, 403);

  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json({ error: "OpenRouter кілті әлі қосылмаған: Supabase → Edge Functions → Secrets бөліміне OPENROUTER_API_KEY қос." }, 500);

  const body = await req.json().catch(() => ({}));

  if (body.action === "status") {
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const d = (await res.json().catch(() => ({}))).data ?? {};
    return json({ ok: res.ok, free: d.free_model_daily_requests ?? null, usage_daily: d.usage_daily ?? null, limit_remaining: d.limit_remaining ?? null });
  }
  if (body.action === "models") return json({ models: await freeToolModels() });

  if (body.action === "template") {
    const info = String(body.info ?? "").trim();
    if (info.length < 10) return json({ error: "Сынып ақпараты тым қысқа." }, 400);
    // Template writing needs no tools; it uses the same model chain as the chat.
    const chain = buildChain(body.models, await freeToolModels().catch(() => []));
    try {
      const { message, model } = await callOpenRouter(key, chain, templateMessages(info, String(body.signature ?? "").slice(0, 120), Array.isArray(body.tags) ? body.tags : []), fetch, []);
      const text = String(message.content ?? "").trim();
      return text ? json({ template: text, model }) : json({ error: "Модель бос жауап берді, қайта көр." }, 502);
    } catch (e) {
      return json({ error: `Модельдер жауап бермеді: ${(e as Error).message}` }, 502);
    }
  }

  if (body.action === "translate") {
    const word = String(body.word ?? "").trim();
    if (!word || word.length > 80) return json({ error: "Сөз бос не тым ұзын." }, 400);
    const chain = buildChain(body.models, await freeToolModels().catch(() => []));
    try {
      // a model that answers with nonsense is skipped for the next one
      for (let i = 0; i < chain.length; i += 3) {
        const { message, model } = await callOpenRouter(key, chain.slice(i), translateMessages(word), fetch, []);
        const out = parseTranslation(String(message.content ?? ""));
        if (out) return json({ ...out, model });
      }
      return json({ error: "Модель дұрыс аударма бермеді. Аударманы өзің жаз." }, 502);
    } catch (e) {
      return json({ error: `Модельдер жауап бермеді: ${(e as Error).message}` }, 502);
    }
  }

  const history = cleanHistory(body.messages);
  if (history.at(-1)?.role !== "user") return json({ error: "Хабарлама бос." }, 400);

  const chain = buildChain(body.models, await freeToolModels().catch(() => []));
  try {
    const out = await runLoop(
      [{ role: "system", content: systemPrompt(String(body.now ?? "").slice(0, 80)) }, ...history],
      (messages) => callOpenRouter(key, chain, messages),
      (name, args) => runTool(db, name, args, String(body.now ?? "").slice(0, 10)),
    );
    return json(out);
  } catch (e) {
    return json({ error: `Модельдер жауап бермеді: ${(e as Error).message}` }, 502);
  }
});
