// Pure helpers for the parents broadcast: phone numbers, pasted lists, names, filling the approved template.

// Kazakhstan numbers to the 11-digit international form WhatsApp links need ("77011234567"), or null.
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("7")) d = "7" + d;
  return /^7[0-9]{10}$/.test(d) ? d : null;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// Rows of cells. Excel / Google Sheets copies are tab-separated, and a cell with a line break comes in quotes.
function rows(text) {
  if (!text.includes("\t")) return text.split(/\r?\n/).map((l) => l.split(/;|,(?=\s*[+\d(])|\s[-–—]\s/));
  const out = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  row.push(cell); out.push(row);
  return out;
}

// One family per row. Two layouts:
//   table (5+ columns): Оқушы | Анасы | анасының нөмірі | Әкесі | әкесінің нөмірі   (either parent may be empty)
//   line:               Оқушы; Ата-ана; телефон   (or "Оқушы — телефон")
// Returns one entry per parent with a phone; parents without a usable number are listed in `skipped`.
export function parseList(text) {
  const ok = [], bad = [], skipped = [];
  for (const [i, raw] of rows(String(text)).entries()) {
    const cells = raw.map(clean);
    if (!cells.some(Boolean)) continue;
    const hasPhone = cells.some((c) => normalizePhone(c));
    if (!hasPhone) { if (i > 0) bad.push({ line: i + 1, text: cells.filter(Boolean).join(" · ") }); continue; } // row 1 without phones = header
    if (cells.length >= 5) {
      const student = cells[0];
      for (const [name, phone, role] of [[cells[1], cells[2], "ана"], [cells[3], cells[4], "әке"]]) {
        if (!name && !phone) continue;
        const p = normalizePhone(phone);
        if (p) ok.push({ student, parent: name, phone: p, role });
        else skipped.push({ student, parent: name, role, reason: phone ? `«${phone}» телефон емес` : "телефон жоқ" });
      }
      continue;
    }
    const parts = cells.filter(Boolean), at = parts.findIndex((c) => normalizePhone(c));
    const names = parts.filter((_, k) => k !== at);
    ok.push({ student: names[0] || "", parent: names[1] || "", phone: normalizePhone(parts[at]), role: "" });
  }
  return { ok, bad, skipped };
}

const cap = (w) => w.charAt(0).toLocaleUpperCase("kk") + w.slice(1);
const PATRONYMIC = /(ұлы|улы|қызы|кызы|овна|евна|ович|евич|ична)$/i;

// How to address a parent: "Айтбенбетова Маржан Саматовна" → "Маржан Саматовна", "Камигат Жанарбек" → "Жанарбек",
// "Қабидолда қызы Гүлмира" → "Гүлмира". Surname first is the class-list convention.
export function callName(full) {
  let w = clean(full).split(" ").filter(Boolean);
  if (w.length >= 3) w = w.slice(1);
  else if (w.length === 2 && !PATRONYMIC.test(w[1])) w = w.slice(1);
  if (w.length >= 2 && /^(қызы|кызы|ұлы|улы)$/i.test(w[0])) w = w.slice(1);
  return w.map(cap).join(" ");
}
// A child's first name: "Арманұлы Рамазан" → "Рамазан".
export const firstName = (full) => cap(clean(full).split(" ").at(-1) || "");

// "Алдияр", "Алдияр мен Данияр", "А, Б мен В"
export const joinNames = (names) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} мен ${names.at(-1)}`;

// One message per phone: a parent with two children in the class gets one message naming both.
export function recipients(list) {
  const byPhone = new Map();
  for (const r of list) {
    const g = byPhone.get(r.data.phone) || { phone: r.data.phone, parent: "", role: r.data.role || "", students: [], ids: [] };
    if (!g.parent) g.parent = r.data.parent;
    if (!g.students.includes(r.data.student)) g.students.push(r.data.student);
    g.ids.push(r.id);
    byPhone.set(r.data.phone, g);
  }
  return [...byPhone.values()];
}

export const PLACEHOLDERS = ["{ата_ана}", "{оқушы}"];

// Puts one family's names into the template. Without a parent's name the greeting falls back to a neutral form.
export function fill(template, r) {
  return template
    .replaceAll("{ата_ана}", callName(r.parent) || "ата-ана")
    .replaceAll("{оқушы}", joinNames((r.students || []).map(firstName)));
}

// Placeholders the AI or the teacher typed that fill() would leave in the message.
export const unknownPlaceholders = (template) => [...new Set(template.match(/\{[^}\s]{1,30}\}/g) || [])].filter((p) => !PLACEHOLDERS.includes(p));

export const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
