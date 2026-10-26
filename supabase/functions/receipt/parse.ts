// Чек: модель жауабынан қауіпсіз түрде { store, total, date, category } алу. Модельге сенбейміз: сома мен күн тексеріледі.
export type Receipt = { store: string; total: number; date: string; category: string };

export const PROMPT = [
  "You read a photographed shop receipt (Kazakhstan, amounts in tenge, ₸ / тг / KZT).",
  "Reply with ONE JSON object and nothing else, no markdown:",
  '{"store":"shop name","total":12345.5,"date":"YYYY-MM-DD","category":"one Kazakh word"}',
  "total = the final amount paid (ИТОГО / К оплате / Жиыны), a plain number without spaces or currency.",
  "category = one Kazakh word for what was bought, e.g. Тамақ, Көлік, Тұрмыс, Киім, Дәрі, Кітап, Күтім. Use Тамақ for groceries.",
  "If the date is not visible, use null. If the total cannot be read, use null. Never invent values.",
].join("\n");

export function parseReceipt(text: string, today: string): Receipt | { error: string } {
  const m = String(text ?? "").match(/\{[\s\S]*\}/); // модель JSON-ды мәтінмен не ``` ішінде берсе де
  if (!m) return { error: "Чектен ештеңе оқылмады." };
  let d: any;
  try { d = JSON.parse(m[0]); } catch { return { error: "Модель жауабы түсініксіз." }; }
  const total = Number(String(d.total ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(total) || total <= 0 || total > 1e9) return { error: "Жалпы сома оқылмады. Чекті жақынырақ, жарықта түсір не қолмен енгіз." };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date)) && String(d.date) <= today && String(d.date) >= "2000-01-01" ? String(d.date) : today;
  const clean = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  return { store: clean(d.store, 60), total: Math.round(total * 100) / 100, date, category: clean(d.category, 30) || "Басқа" };
}

// Кескін: тек JPEG/PNG/WebP data URL, шамамен 3 МБ-қа дейін
export const okImage = (s: unknown) => typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 4_000_000;

// Тегін модельдерден кескінді оқитындарын таңдау: сапасы белгілілер алдымен
const PREFER = [/gemini/, /qwen.*vl/, /llama-4/, /gemma-3/, /pixtral/, /vision|vl/];
export function pickVision(models: any[], mine: unknown = []): string[] {
  const rank = (id: string) => { const i = PREFER.findIndex((r) => r.test(id)); return i < 0 ? 99 : i; };
  const free = models.filter((m) => String(m.id).endsWith(":free") && m.architecture?.input_modalities?.includes("image")).map((m) => String(m.id)).sort((a, b) => rank(a) - rank(b));
  const own = (Array.isArray(mine) ? mine : []).map((m) => String(m).trim()).filter((m) => /^[\w.\-\/:~]{3,100}$/.test(m)).slice(0, 3);
  return [...new Set([...own, ...free])].slice(0, 9);
}
