// Kitapp text-to-speech: turns one piece of book text (<= 4500 chars) into mp3. Owner-only, same check as the hub assistant.
// Provider by secret: Azure Speech (kk-KZ Aigul/Daulet, best for Kazakh) first, OpenAI as fallback.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const xmlEsc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

const audio = (res: Response) => new Response(res.body, { headers: { ...CORS, "Content-Type": "audio/mpeg" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? Deno.env.get("SUPABASE_ANON_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, publishable, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: owner } = await db.rpc("is_hub_owner");
  if (owner !== true) return json({ error: "Бұл қосымшаға тек Hub иесі кіре алады." }, 403);

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim().slice(0, 4500);
  if (text.length < 2) return json({ error: "Мәтін бос." }, 400);
  const male = body.gender === "m";

  const azKey = Deno.env.get("AZURE_SPEECH_KEY"), region = Deno.env.get("AZURE_SPEECH_REGION");
  if (azKey && region) {
    const voice = male ? "kk-KZ-DauletNeural" : "kk-KZ-AigulNeural";
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "kitapp",
      },
      body: `<speak version="1.0" xml:lang="kk-KZ"><voice name="${voice}">${xmlEsc(text)}</voice></speak>`,
    });
    return res.ok ? audio(res) : json({ error: `Azure Speech қатесі: HTTP ${res.status}` }, 502);
  }

  const oaKey = Deno.env.get("OPENAI_API_KEY");
  if (oaKey) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${oaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts", voice: male ? "onyx" : "nova", input: text, response_format: "mp3",
        instructions: "Мәтінді қазақ тілінде, анық және асықпай, аудиокітап сияқты оқы.",
      }),
    });
    return res.ok ? audio(res) : json({ error: `OpenAI қатесі: HTTP ${res.status}` }, 502);
  }

  return json({ error: "Дауыс кілті жоқ: Supabase → Edge Functions → Secrets бөліміне AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (немесе OPENAI_API_KEY) қос." }, 500);
});
