// Pure helpers for the parents broadcast: phone numbers, pasted lists, filling the approved template.

// Kazakhstan numbers to the 11-digit international form WhatsApp links need ("77011234567"), or null.
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("7")) d = "7" + d;
  return /^7[0-9]{10}$/.test(d) ? d : null;
}

// One parent per line: "Оқушы; Ата-ана; телефон" (";", tab or "," between parts, as pasted from Excel or a note).
export function parseList(text) {
  const ok = [], bad = [];
  for (const [i, line] of String(text).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parts = line.split(/\t|;|,(?=\s*[+\d(])|\s[-–—]\s/).map((s) => s.trim()).filter(Boolean);
    const phoneAt = parts.findIndex((p) => normalizePhone(p));
    if (phoneAt < 0 || parts.length < 2) { bad.push({ line: i + 1, text: line.trim() }); continue; }
    const names = parts.filter((_, k) => k !== phoneAt);
    ok.push({ student: names[0], parent: names[1] || "", phone: normalizePhone(parts[phoneAt]) });
  }
  return { ok, bad };
}

export const PLACEHOLDERS = ["{ата_ана}", "{оқушы}"];

// Puts one family's names into the template. Without a parent's name the greeting falls back to a neutral form.
export function fill(template, p) {
  return template
    .replaceAll("{ата_ана}", p.parent || "ата-ана")
    .replaceAll("{оқушы}", p.student || "");
}

// Placeholders the AI or the teacher typed that fill() would leave in the message.
export const unknownPlaceholders = (template) => [...new Set(template.match(/\{[^}\s]{1,30}\}/g) || [])].filter((p) => !PLACEHOLDERS.includes(p));

export const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
