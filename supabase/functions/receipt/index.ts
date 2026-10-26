import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { okImage, parseReceipt, pickVision, PROMPT } from "./parse.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const OPENROUTER = "https://openrouter.ai/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

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
  if (!okImage(body.image)) return json({ error: "Кескін жарамсыз немесе тым үлкен." }, 400);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);

  const list = await fetch(`${OPENROUTER}/models`).then((r) => r.json()).catch(() => ({}));
  const chain = pickVision(list.data ?? [], body.models);
  if (!chain.length) return json({ error: "Кескінді оқитын тегін модель табылмады. Кейінірек қайталап көр." }, 502);

  const messages = [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: body.image } }] }];
  let last = "";
  for (let i = 0; i < chain.length; i += 3) { // OpenRouter үшеуінің ішінде өзі ауысады, сосын келесі үшеуі
    const res = await fetch(`${OPENROUTER}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "FinSaulyq" },
      body: JSON.stringify({ models: chain.slice(i, i + 3), messages, temperature: 0 }),
    });
    const out: any = await res.json().catch(() => ({}));
    const text = out.choices?.[0]?.message?.content;
    if (res.ok && text) {
      const r = parseReceipt(typeof text === "string" ? text : JSON.stringify(text), today);
      if (!("error" in r)) return json({ receipt: r, model: String(out.model ?? "") });
      last = r.error;
    } else last = out.error?.message ?? `HTTP ${res.status}`;
  }
  return json({ error: last || "Чек оқылмады." }, 502);
});
