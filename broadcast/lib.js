// Pure helpers for class broadcasts: contacts, data tables, names, Kazakh genitive, audiences, filling templates.
// Nothing here talks to the network; the page feeds it data and renders the result.

// Kazakhstan numbers to the 11-digit international form WhatsApp links need ("77011234567"), or null.
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("7")) d = "7" + d;
  return /^7[0-9]{10}$/.test(d) ? d : null;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// Rows of cells. Excel / Google Sheets copies are tab-separated, and a cell with a line break comes in quotes.
export function rows(text) {
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

/* ---------- contacts ---------- */

// Contacts from a pasted class list. Two layouts:
//   table (5+ columns): Оқушы | Анасы | анасының нөмірі | Әкесі | әкесінің нөмірі   (either parent may be empty)
//   line:               Оқушы; Ата-ана; телефон   (or "Оқушы — телефон")
// Parents without a usable number are kept with phone: null, so audiences can fall back and reports can name them.
export function parseContacts(text) {
  const contacts = [], bad = [];
  for (const [i, raw] of rows(String(text)).entries()) {
    const cells = raw.map(clean);
    if (!cells.some(Boolean)) continue;
    const hasPhone = cells.some((c) => normalizePhone(c));
    if (cells.length >= 5) {
      if (!hasPhone && i === 0) continue; // header row
      if (!cells[0]) { bad.push({ line: i + 1, text: cells.filter(Boolean).join(" · ") }); continue; }
      for (const [name, phone, role] of [[cells[1], cells[2], "ана"], [cells[3], cells[4], "әке"]]) {
        if (!name && !phone) continue;
        const p = normalizePhone(phone);
        contacts.push({ student: cells[0], parent: name, phone: p, role, ...(phone && !p ? { note: phone } : {}) });
      }
      continue;
    }
    if (!hasPhone) { if (i > 0) bad.push({ line: i + 1, text: cells.filter(Boolean).join(" · ") }); continue; }
    const parts = cells.filter(Boolean), at = parts.findIndex((c) => normalizePhone(c));
    const names = parts.filter((_, k) => k !== at);
    contacts.push({ student: names[0] || "", parent: names[1] || "", phone: normalizePhone(parts[at]), role: "" });
  }
  return { contacts, bad };
}

/* ---------- data tables (grades, scores…) ---------- */

// The first row is a header when it holds no numbers or phones; otherwise columns get generic names.
export function parseTable(text) {
  const all = rows(String(text)).map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  if (!all.length) return { headers: [], rows: [] };
  const width = Math.max(...all.map((r) => r.length));
  const pad = (r) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  const looksLikeHeader = !all[0].some((c) => /\d/.test(c));
  const raw = looksLikeHeader ? pad(all.shift()) : Array(width).fill("");
  const seen = {};
  const headers = raw.map((h, i) => {
    const name = (h || `Баған ${i + 1}`).replace(/[{}:]/g, "");
    seen[name] = (seen[name] || 0) + 1;
    return seen[name] > 1 ? `${name} ${seen[name]}` : name;
  });
  return { headers, rows: all.map(pad) };
}

// Names match whatever the word order: "Арманұлы Рамазан" = "рамазан арманұлы".
export const nameKey = (s) => clean(s).toLowerCase().replace(/ё/g, "е").split(" ").sort().join(" ");

// Finds the column with student names and links each student to their row.
export function matchTable(table, students) {
  const full = new Map(students.map((s) => [nameKey(s), s]));
  const firstNames = new Map();
  for (const s of students) { const k = clean(s).toLowerCase().split(" ").at(-1); firstNames.set(k, firstNames.has(k) ? null : s); }
  const find = (cell) => full.get(nameKey(cell)) || (cell && !cell.includes(" ") ? firstNames.get(clean(cell).toLowerCase()) : null) || null;
  let col = -1, best = 0;
  table.headers.forEach((_, i) => { const n = table.rows.filter((r) => find(r[i])).length; if (n > best) { best = n; col = i; } });
  const byStudent = new Map(), unmatched = [];
  if (col >= 0) for (const r of table.rows) { const s = find(r[col]); if (s && !byStudent.has(s)) byStudent.set(s, r); else if (!s && r[col]) unmatched.push(r[col]); }
  return { col, byStudent, unmatched, missing: students.filter((s) => !byStudent.has(s)) };
}

/* ---------- names ---------- */

const cap = (w) => w.charAt(0).toLocaleUpperCase("kk") + w.slice(1);
const FEMALE = /(қызы|кызы|овна|евна|ична)$/i, MALE = /(ұлы|улы|ович|евич)$/i;
const PATRONYMIC = new RegExp(`${FEMALE.source}|${MALE.source}`, "i");
const genderOf = (w) => (FEMALE.test(w) ? "f" : MALE.test(w) ? "m" : null);

// Class lists put the surname first: "Айтбенбетова Маржан Саматовна", "Камигат Жанарбек", "Қабидолда қызы Гүлмира".
export function nameParts(fullName) {
  const w = clean(fullName).split(" ").filter(Boolean);
  if (!w.length) return { full: "", given: "", patronymic: "", gender: null };
  const full = w.map(cap).join(" ");
  const k = w.findIndex((t, i) => i > 0 && /^(қызы|кызы|ұлы|улы)$/i.test(t));
  if (k > 0) return { full, given: cap(w[k + 1] || w[0]), patronymic: "", gender: /^(қызы|кызы)$/i.test(w[k]) ? "f" : "m" };
  if (w.length >= 3) return { full, given: cap(w[1]), patronymic: cap(w[2]), gender: genderOf(w[2]) };
  if (w.length === 2 && PATRONYMIC.test(w[1])) return { full, given: cap(w[0]), patronymic: cap(w[1]), gender: genderOf(w[1]) };
  return { full, given: cap(w.at(-1)), patronymic: "", gender: null };
}

// How the message addresses its recipient.
export const NAMING = {
  name_patronymic: "Аты мен әкесінің аты",
  title: "Аты + апай / ағай",
  name: "Тек аты",
  full: "Толық аты-жөні",
};
export function addressName(fullName, style = "name_patronymic", role = "") {
  const n = nameParts(fullName);
  if (!n.given) return "";
  if (style === "full") return n.full;
  if (style === "name") return n.given;
  if (style === "title") {
    const g = role === "ана" ? "f" : role === "әке" ? "m" : n.gender;
    return g ? `${n.given} ${g === "f" ? "апай" : "ағай"}` : n.given;
  }
  return n.patronymic ? `${n.given} ${n.patronymic}` : n.given;
}

// A child's first name: "Арманұлы Рамазан" → "Рамазан".
export const firstName = (full) => cap(clean(full).split(" ").at(-1) || "");
// "Алдияр", "Алдияр мен Данияр", "А, Б мен В"
export const joinNames = (names) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} мен ${names.at(-1)}`;

// Kazakh genitive (ілік септік): Рамазанның, Әлидің, Салихтың, Беріктің, Нұрисламның.
// Vowel harmony follows the last clearly front/back vowel; и and у only decide when nothing else does.
export function genitive(word) {
  const w = clean(word);
  if (!w) return w;
  const lower = w.toLowerCase(), last = lower.at(-1);
  const vowels = [...lower].filter((c) => "аәеиоөұүыіэюяу".includes(c));
  const clear = vowels.filter((c) => !"иу".includes(c));
  const front = "әеіөүэ".includes(clear.at(-1) ?? vowels.at(-1) ?? "а") || (!clear.length && vowels.at(-1) === "и");
  const base = "аәеоөұүыіэюя".includes(last) || "мнң".includes(last) ? "н" : "лрйузжи".includes(last) ? "д" : "т";
  return w + base + (front ? "ің" : "ың");
}

/* ---------- templates ---------- */

// Tags every broadcast has; a pasted table adds its own column names.
export const BUILTIN_TAGS = ["Алушы", "Оқушы аты", "Оқушы аты-жөні", "Анасы", "Әкесі"];
const ALIASES = { "ата_ана": "Алушы", "оқушы": "Оқушы аты" }; // tags from the first version

const TAG = /\{([^{}:]{1,40})(?::(ның))?\}/g;
export const placeholders = (template) => [...new Set([...String(template).matchAll(TAG)].map((m) => m[1].trim()))];
export const unknownPlaceholders = (template, tags) => placeholders(template).filter((k) => !tags.includes(k) && !(k in ALIASES));

// {Оқушы аты} → value, {Оқушы аты:ның} → value in the genitive. Unknown tags stay visible so the preview shows them.
export function fill(template, values) {
  return String(template).replace(TAG, (m, key, mod) => {
    const k = key.trim(), v = values[k] ?? values[ALIASES[k]];
    if (v === undefined) return m;
    return mod ? genitive(String(v)) : String(v);
  });
}

/* ---------- audiences ---------- */

export const AUDIENCES = {
  mother_first: "Анасына (жоқ болса, әкесіне)",
  father: "Әкесіне",
  both: "Анасына да, әкесіне де",
  primary: "Негізгі жауаптысына",
  nearby: "Жақын тұратын жауаптысына",
  all: "Барлық байланысқа",
};

// Who gets a message for each student, plus notes for students nobody can be reached for.
// One phone gets one message (a parent of twins hears once) unless the template carries per-student data.
export function plan(contacts, audience, { perStudent = false } = {}) {
  const byStudent = new Map();
  for (const c of contacts) byStudent.set(c.student, [...(byStudent.get(c.student) || []), c]);
  const picks = [], notes = [];
  for (const [student, list] of byStudent) {
    const reach = list.filter((c) => c.phone);
    const mother = reach.find((c) => c.role === "ана"), father = reach.find((c) => c.role === "әке");
    const noPhone = (role) => list.some((c) => c.role === role && !c.phone);
    let chosen;
    if (audience === "mother_first") {
      chosen = [mother || father];
      if (!mother && father) notes.push({ student, text: noPhone("ана") ? "анасының нөмірі жоқ, әкесіне жіберіледі" : "анасы тізімде жоқ, әкесіне жіберіледі" });
    } else if (audience === "father") chosen = [father];
    else if (audience === "both") {
      chosen = [mother, father];
      if (mother && !father && noPhone("әке")) notes.push({ student, text: "әкесінің нөмірі жоқ" });
      if (father && !mother && noPhone("ана")) notes.push({ student, text: "анасының нөмірі жоқ" });
    } else if (audience === "primary") {
      const p = reach.find((c) => c.primary);
      chosen = [p || mother || father];
      if (!p && chosen[0]) notes.push({ student, text: `негізгі жауаптысы белгіленбеген, ${chosen[0].role === "әке" ? "әкесіне" : "анасына"} жіберіледі` });
    } else if (audience === "nearby") chosen = reach.filter((c) => c.nearby);
    else chosen = reach;
    chosen = chosen.filter(Boolean);
    if (!chosen.length) {
      const why = { father: noPhone("әке") ? "әкесінің нөмірі жоқ" : "әкесі тізімде жоқ", nearby: "жақын тұратын жауаптысы белгіленбеген" }[audience] || "нөмірі бар ата-анасы жоқ";
      notes.push({ student, text: why, unreached: true });
    }
    for (const c of chosen) picks.push({ student, contact: c });
  }
  const messages = new Map();
  for (const p of picks) {
    const key = perStudent ? `${p.contact.phone}|${p.student}` : p.contact.phone;
    const m = messages.get(key) || { key, phone: p.contact.phone, contact: p.contact, students: [] };
    if (!m.students.includes(p.student)) m.students.push(p.student);
    messages.set(key, m);
  }
  return { messages: [...messages.values()], notes };
}

// Every message of a broadcast, filled in and checked: what the teacher previews and sends.
export function messagesFor({ contacts, template = "", table = null, audience = "mother_first", naming = "name_patronymic" }) {
  const used = placeholders(template);
  const tableTags = table ? table.headers.filter((h) => used.includes(h)) : [];
  const { messages, notes } = plan(contacts, audience, { perStudent: tableTags.length > 0 });
  const match = table ? matchTable(table, [...new Set(contacts.map((c) => c.student))]) : null;
  for (const m of messages) {
    const one = m.students.length === 1 ? m.students[0] : null;
    const rel = (role) => (one ? contacts.find((c) => c.student === one && c.role === role)?.parent || "" : "");
    const values = {
      "Алушы": addressName(m.contact.parent, naming, m.contact.role) || "ата-ана",
      "Оқушы аты": joinNames(m.students.map(firstName)),
      "Оқушы аты-жөні": joinNames(m.students),
      "Анасы": addressName(rel("ана"), naming, "ана"),
      "Әкесі": addressName(rel("әке"), naming, "әке"),
    };
    const row = one && match?.byStudent.get(one);
    if (table) table.headers.forEach((h, i) => { if (!(h in values)) values[h] = row ? row[i] : ""; });
    m.text = fill(template, values);
    m.empty = used.filter((k) => (values[k] ?? values[ALIASES[k]]) === "");
    m.noRow = tableTags.length > 0 && !row;
  }
  return { messages, notes, match };
}

export const waLink = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
