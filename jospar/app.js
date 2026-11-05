"use strict";
/* Jospar интерфейсі: Басты бет, Тапсырмалар (+ әдеттер), Мақсат (+ аналитика), Профиль. Деректер осы құрылғыда (localStorage), Hub-қа кірсең бұлтпен синхрондалады; логика — core.js (JO). */
const KEY = "jospar.v1";
const DEF = { habits: [], logs: [], tasks: [], goals: [], pending: [], synced: false };
const LISTS = ["habits", "logs", "tasks", "goals"];
const WD = ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"];
const MO = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
let seg = "tasks", openId = null; // Тапсырмалар бетінің бөлімі және ашық әдет
const KIND = { good: "Жақсы әдеттер", bad: "Жаман әдеттер", neutral: "Бейтарап әдеттер" };
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  tasks: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};

let S = structuredClone(DEF), tab = "home", habitDate = "", basketTab = "tasks", selectedHabit = "";
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* бұзылған жазба — бос күйден бастаймыз */ }
if (!S.synced) S.pending = []; // алғашқы синхронда барлығы қайта кезекке қойылады

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { alert("Сақталмады: браузер жадына жазу мүмкін емес."); } };
const save = () => { persist(); render(); Sync.schedule(); };

// Әр өзгеріс кезекке түседі (бұлтқа жіберу үшін); n — кезектегі жазбаның бірегей нөмірі
let seq = Date.now();
function queue(k, id, op) { S.pending = S.pending.filter((p) => !(p.k === k && p.id === id)); S.pending.push({ k, id, op, n: ++seq }); }
function put(k, e) {
  const i = S[k].findIndex((x) => x.id === e.id);
  if (i < 0) S[k].push(e); else S[k][i] = e;
  queue(k, e.id, "put");
}
function rm(k, id) { S[k] = S[k].filter((x) => x.id !== id); queue(k, id, "del"); }

function h(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}
const ic = (n) => { const s = h("span", { class: "ic", "aria-hidden": "true" }); s.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[n]}</svg>`; return s; };
const sec = (title, ...body) => h("section", { class: "sec" }, h("header", {}, h("h2", {}, title)), ...body);
const empty = (t) => h("p", { class: "empty" }, t);

// Бір диалог — енгізу формалары үшін. fields: { name, label, type (text|number|time|textarea), value, options, optional, min, step }
function ask(title, fields, ok, onDel) {
  const form = h("form", { method: "dialog" }, h("h3", {}, title));
  const dlg = h("dialog", {}, form);
  for (const f of fields) {
    if (f.type === "weekdays") {
      const selected = f.value?.length ? f.value : [0, 1, 2, 3, 4, 5, 6];
      const hidden = h("input", { type: "hidden", name: f.name, value: selected.join(",") });
      const buttons = [1, 2, 3, 4, 5, 6, 0].map((d) => h("button", { type: "button", "aria-pressed": selected.includes(d), onclick: (e) => {
        const values = hidden.value.split(",").filter(Boolean).map(Number);
        if (values.includes(d) && values.length === 1) return;
        const next = values.includes(d) ? values.filter((n) => n !== d) : [...values, d];
        hidden.value = next.join(","); e.currentTarget.setAttribute("aria-pressed", String(next.includes(d)));
      } }, ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"][d]));
      form.append(h("fieldset", { class: "weekdays" }, h("legend", {}, f.label), hidden, h("div", {}, buttons)));
      continue;
    }
    const input = f.options ? h("select", { name: f.name }, f.options.map(([v, t]) => h("option", { value: v }, t)))
      : f.type === "textarea" ? h("textarea", { name: f.name, rows: 4 }, f.value ?? "")
      : h("input", { name: f.name, type: f.type || "text", value: f.value ?? "", required: !f.optional, pattern: f.type ? null : "\\S.*", ...(f.type === "number" ? { min: f.min ?? 0, step: f.step ?? "any", inputmode: "numeric" } : {}) });
    if (f.options) input.value = f.value;
    form.append(h("label", {}, f.label, input));
  }
  form.append(h("div", { class: "end" },
    onDel && h("button", { type: "button", class: "ghost danger", onclick: () => { dlg.close(); onDel(); } }, "Өшіру"),
    h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary" }, "Сақтау")));
  form.addEventListener("submit", () => ok(Object.fromEntries(new FormData(form))));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------- әрекеттер ---------- */
const selectedDay = () => tab === "tasks" && selectedHabit && habitDate ? habitDate : today();
const dayLog = (hb) => JO.logOf(S, hb.id, selectedDay()) ?? { id: crypto.randomUUID(), habit: hb.id, date: selectedDay(), done: [], slip: false, resist: 0, count: 0 };
function edit(hb, fn) { const l = dayLog(hb); fn(l); put("logs", l); save(); return l; }

const lastMsg = {};
function toast(text, icon) {
  const el = document.getElementById("toast");
  el.replaceChildren(ic(icon), h("span", {}, text)); el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500);
}
function say(hb, kind) { // кінәлаусыз қолдау хабары; қатарынан бірдей мәтін шықпайды
  const vars = { n: JO.fightDays(S, hb, today().slice(0, 7)), best: JO.runs(S, hb, today()).best };
  const m = JO.pickMsg(kind === "slip" ? JO.SLIP : JO.RESIST, vars, lastMsg[kind]);
  lastMsg[kind] = m.i;
  toast(m.text, kind === "slip" ? "heart" : "shield");
}
const toggleStep = (hb, i) => edit(hb, (l) => { l.done = l.done.includes(i) ? l.done.filter((x) => x !== i) : [...l.done, i]; });
const slip = (hb) => { if (edit(hb, (l) => { l.slip = !l.slip; }).slip) say(hb, "slip"); };
const resist = (hb) => { edit(hb, (l) => { l.resist++; }); say(hb, "resist"); };
const tally = (hb, d) => edit(hb, (l) => { l.count = Math.max(0, l.count + d); });

/* ---------- Күнделік ---------- */
const timeLabel = (hb) => {
  if (!hb.time) return null;
  if (!hb.dur) return hb.time;
  const [hh, mm] = hb.time.split(":").map(Number), e = (hh * 60 + mm + hb.dur) % 1440;
  return `${hb.time}–${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
};
const dot = (cls, on) => h("span", { class: "dot " + (cls || "") }, on && ic(cls === "slip" ? "x" : "check"));
const main = (name, sub) => h("span", { class: "main" }, h("b", {}, name), sub && h("small", { class: "muted" }, sub));

function dayRow(hb) {
  const t = selectedDay(), l = JO.logOf(S, hb.id, t), st = JO.dayStatus(hb, l), r = JO.runs(S, hb, t), tl = timeLabel(hb);
  let body;
  if (hb.kind === "good" && hb.target > 0) {
    const value = l?.count || 0, d = new Set(l?.done);
    body = [h("div", { class: "line" }, dot(st === "done" ? "on" : "", st === "done"), main(hb.name, `${value} / ${hb.target} ${hb.unit || ""}`)),
      bar(Math.min(100, Math.round(value / hb.target * 100))),
      h("div", { class: "quantity-actions" }, h("button", { "aria-label": `Азайту: ${hb.name}`, onclick: () => tally(hb, -1) }, ic("minus")),
        h("button", { class: "primary", onclick: () => tally(hb, 1) }, ic("plus"), `1 ${hb.unit || "рет"}`),
        h("button", { onclick: () => ask("Нәтижені енгізу", [{ name: "count", label: hb.unit || "Нәтиже", type: "number", min: 0, value }], v => edit(hb, log => { log.count = Number(v.count); })) }, "Нәтиже")),
      h("div", { class: "steps" }, hb.steps.map((step, i) => h("button", { class: "step", "aria-pressed": d.has(i), onclick: () => toggleStep(hb, i) }, dot(d.has(i) ? "on" : "", d.has(i)), step)))];
  } else if (hb.kind === "good") {
    const done = st === "done", d = new Set(l?.done), n = hb.steps.length, streak = r.cur ? `Серия: ${r.cur} күн` : "";
    if (!n) body = [h("button", { class: "line", "aria-pressed": done, onclick: () => toggleStep(hb, 0) }, dot(done ? "on" : "", done), main(hb.name, streak))];
    else body = [h("div", { class: "line" }, dot(done ? "on" : "", done), main(hb.name, [`${[...d].filter((i) => i < n).length}/${n}`, streak].filter(Boolean).join(" · "))),
      h("div", { class: "steps" }, hb.steps.map((s, i) => h("button", { class: "step", "aria-pressed": d.has(i), onclick: () => toggleStep(hb, i) }, dot(d.has(i) ? "on" : "", d.has(i)), s)))];
  } else if (hb.kind === "bad") {
    const slipped = st === "slip";
    body = [h("div", { class: "line" }, dot(slipped ? "slip" : "on", true), main(hb.name, `Серия: ${r.cur} күн · Күрес күндері: ${JO.fightDays(S, hb)}`), h("span", { class: "chip " + (slipped ? "bad" : "ok") }, slipped ? "Сүрінді" : t === today() ? "Бақылауда" : "Орындалды")),
      h("div", { class: "acts" }, h("button", { class: "primary", onclick: () => resist(hb) }, ic("shield"), "Шыдадым" + (l?.resist ? ` · ${l.resist}` : "")),
        h("button", { onclick: () => slip(hb) }, slipped ? "Сүріндім дегенді қайтару" : "Сүріндім"))];
  } else {
    body = [h("div", { class: "line" }, main(hb.name, "Бүгін"), h("button", { class: "sm", "aria-label": `Азайту: ${hb.name}`, onclick: () => tally(hb, -1) }, ic("minus")),
      h("span", { class: "count num" }, l?.count || 0), h("button", { class: "sm", "aria-label": `Көбейту: ${hb.name}`, onclick: () => tally(hb, 1) }, ic("plus")))];
  }
  return h("div", { class: "habit" }, tl && h("div", { class: "when" }, tl), h("div", { class: "body" }, body));
}

const dshort = (s) => `${Number(s.slice(8))} ${MO[Number(s.slice(5, 7)) - 1]}`;
const goalName = (t) => S.goals.find((g) => g.id === t.goal)?.title;
const toggleTask = (t) => { t.done = !t.done; t.doneAt = t.done ? today() : ""; put("tasks", t); save(); };
const late = (t) => !t.done && t.due !== "" && t.due < today();
const bar = (p) => h("div", { class: "bar", "aria-label": "Орындалу прогресі", role: "progressbar", "aria-valuenow": p, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${p}%` }));

// Басты беттегі тапсырма жолы: мерзімі өткені уақыт блогына емес, «Күні бойы» тізімінің басына түседі
function dayTask(t) {
  const tl = late(t) ? null : timeLabel(t);
  return h("div", { class: "habit" }, tl && h("div", { class: "when" }, tl), h("div", { class: "body" },
    h("button", { class: "line", "aria-pressed": t.done, onclick: () => toggleTask(t) }, dot(t.done ? "on" : "", t.done), main(t.title, [late(t) && `Мерзімі өтті: ${dshort(t.due)}`, goalName(t)].filter(Boolean).join(" · ")))));
}

function home() {
  const t = today(), d = new Date(), goods = S.habits.filter((x) => x.kind === "good" && JO.scheduled(x, t)), tasks = S.tasks.filter((x) => JO.todayTask(x, t));
  const done = goods.filter((x) => JO.dayStatus(x, JO.logOf(S, x.id, t)) === "done").length + tasks.filter((x) => x.done).length, total = goods.length + tasks.length;
  const rows = [...S.habits.filter((x) => JO.scheduled(x, t)).map((x) => ({ time: x.time, name: x.name, el: dayRow(x) })), ...tasks.map((x) => ({ time: late(x) ? "" : x.time, name: x.title, late: late(x), el: dayTask(x) }))]
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || !a.late - !b.late || a.name.localeCompare(b.name));
  const timed = rows.filter((r) => r.time), free = rows.filter((r) => !r.time);
  return [
    h("h1", {}, "Жоспаргер"), h("p", { class: "muted sub" }, `${d.getDate()} ${MO[d.getMonth()]}, ${WD[d.getDay()]}`),
    total > 0 && sec("Бүгінгі прогресс", h("span", { class: "num" }, `Жақсы әдеттер мен тапсырмалар: ${done}/${total}`), bar(Math.round(done / total * 100))),
    timed.length > 0 && sec("Күн жоспары", ...timed.map((r) => r.el)),
    free.length > 0 && sec(timed.length ? "Күні бойы" : "Бүгін", ...free.map((r) => r.el)),
    !rows.length && empty("Бүгінге ештеңе жоқ. Төмендегі «+» батырмасымен әдет не тапсырма қос."),
  ];
}

const WEIGHTS = [["1", "1 · жеңіл"], ["2", "2"], ["3", "3 · орташа"], ["4", "4"], ["5", "5 · маңызды"], ["0", "0 · міндетті емес, ұпай бермейді"]];
/* ---------- Әдеттер ---------- */
function habitForm(hb) {
  ask(hb?.id ? "Әдетті өзгерту" : "Жаңа әдет", [
    { name: "name", label: "Атауы", value: hb?.name },
    { name: "kind", label: "Түрі", options: [["good", "Жақсы · қалыптастыру"], ["bad", "Жаман · арылу"], ["neutral", "Бейтарап · бақылау"]], value: hb?.kind ?? "good" },
    { name: "target", label: "Күндік сандық меже (0 — белгімен бақылау)", type: "number", optional: true, min: 0, value: hb?.target || "" },
    { name: "current", label: "Бүгінгі нәтиже", type: "number", optional: true, min: 0, value: hb?.id ? JO.logOf(S, hb.id, today())?.count || "" : "" },
    { name: "unit", label: "Өлшем бірлігі: минут, бет, км, рет…", optional: true, value: hb?.unit },
    { name: "steps", label: "Ішкі пункттер: әр жолға біреу (тек жақсы әдетке)", type: "textarea", value: hb?.steps?.join("\n") },
    { name: "days", label: "Қай күндері қайталанады?", type: "weekdays", value: hb?.days },
    { name: "goal", label: "Қай мақсатқа көмектеседі?", options: [["", "Мақсатсыз"], ...S.goals.map((g) => [g.id, g.title])], value: hb?.goal || "" },
    { name: "time", label: "Басталу уақыты", type: "time", optional: true, value: hb?.time },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: hb?.dur || "" },
    { name: "w", label: "Салмағы · профильдегі ұпайға әсері", options: WEIGHTS, value: String(hb?.w ?? 1) },
  ], (v) => {
    const id = hb?.id ?? crypto.randomUUID();
    put("habits", { id, target: Math.max(0, Number(v.target) || 0), unit: v.unit.trim(), name: v.name.trim(), kind: v.kind, steps: v.kind === "good" ? v.steps.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      days: [...new Set(v.days.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))], goal: v.goal || "", time: v.time || "", dur: Math.round(Number(v.dur)) || 0, w: Number(v.w), created: hb?.created ?? today() });
    const log = JO.logOf(S, id, today()) || { id: crypto.randomUUID(), habit: id, date: today(), done: [], slip: false, resist: 0, count: 0 };
    if (Number(v.current) !== log.count) { log.count = Math.max(0, Number(v.current) || 0); put("logs", log); }
    save();
  }, hb?.id && (() => {
    if (!confirm(`«${hb.name}» және оның тарихы өшіріледі. Жалғастыру ма?`)) return;
    S.logs.filter((l) => l.habit === hb.id).forEach((l) => rm("logs", l.id));
    rm("habits", hb.id); save();
  }));
}

function habitRow(hb) {
  const r = JO.runs(S, hb, today()), month = today().slice(0, 7);
  const sub = hb.kind === "good" ? `Серия: ${r.cur} · ең ұзақ: ${r.best}` + (hb.steps.length ? ` · ${hb.steps.length} пункт` : "")
    : hb.kind === "bad" ? `Серия: ${r.cur} · ең ұзақ: ${r.best} · күрес күндері: ${JO.fightDays(S, hb)}`
    : `Осы айда: ${S.logs.filter((l) => l.habit === hb.id && l.date.startsWith(month)).reduce((t, l) => t + l.count, 0)}`;
  return h("div", { class: "row" }, h("button", { class: "line", onclick: () => { selectedHabit = hb.id; habitDate = today(); tab = "tasks"; render(); } }, main(hb.name, [timeLabel(hb), sub, hb.target > 0 && `${hb.target} ${hb.unit || ""} / күн`].filter(Boolean).join(" · "))),
    h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${hb.name}`, onclick: () => habitForm(hb) }, ic("edit")));
}

/* Әдет күнтізбесі: өткен күнді түзетуге болады, келешек белгіленбейді. */
function habitsPage() {
  const t = today(), date = habitDate || t;
  const active = S.habits.filter((hb) => JO.scheduled(hb, date));
  const good = active.filter((hb) => hb.kind === "good");
  const done = good.filter((hb) => JO.dayStatus(hb, JO.logOf(S, hb.id, date)) === "done").length;
  return [h("div", { class: "page-heading" }, h("div", {}, h("h1", {}, "Әдеттер"), h("p", { class: "muted sub" }, "Кішкентай әрекет. Күн сайынғы ілгерілеу.")), h("button", { class: "primary", onclick: () => habitForm() }, ic("plus"), "Әдет қосу")),
    sec("Күнделік", h("div", { class: "date-toolbar" }, h("button", { "aria-label": "Алдыңғы күн", onclick: () => { habitDate = JO.addDays(date, -1); render(); } }, "←"), h("input", { type: "date", value: date, max: t, "aria-label": "Әдеттер күні", onchange: (e) => { if (e.target.value && e.target.value <= t) { habitDate = e.target.value; render(); } } }), h("button", { disabled: date >= t, "aria-label": "Келесі күн", onclick: () => { habitDate = JO.addDays(date, 1); render(); } }, "→"), h("button", { class: "ghost", onclick: () => { habitDate = t; render(); } }, "Бүгін")),
      h("p", { class: "num" }, `${done}/${good.length} жақсы әдет орындалды`), good.length > 0 && bar(Math.round(done / good.length * 100)),
      ...active.map(dayRow), !active.length && empty("Бұл күнге жоспарланған әдет жоқ.")),
    sec("Менің әдеттерім", h("p", { class: "muted calendar-hint" }, "Соңғы 28 күн · күнді басып, жазбаны өзгертіңіз"),
      ...S.habits.filter(hb => !selectedHabit || hb.id === selectedHabit).map((hb) => {
        const rate = JO.rate(S, hb, t), run = JO.runs(S, hb, t);
        return h("div", { class: "habit-card" }, habitRow(hb),
          h("small", { class: "muted" }, `${hb.days?.length ? hb.days.map((d) => WD[d]).join(", ") : "Күн сайын"} · Ең ұзақ қатар: ${run.best} күн`),
          rate && h("p", { class: "muted" }, `30 күн: ${rate.done}/${rate.total} · ${rate.total ? Math.round(rate.done / rate.total * 100) : 0}%`),
          h("div", { class: "habit-calendar", "aria-label": "Соңғы 28 күн" }, Array.from({ length: 28 }, (_, i) => {
            const d = JO.addDays(t, i - 27), planned = JO.scheduled(hb, d), log = JO.logOf(S, hb.id, d);
            const status = !planned ? "off" : hb.kind === "bad" && d === t && !log?.slip ? "todo" : JO.dayStatus(hb, log);
            return h("button", { class: "calendar-day " + status + (d === date ? " selected" : ""), "aria-pressed": d === date, title: `${d}: ${!planned ? "Жоспар жоқ" : status === "done" ? "Орындалды" : "Күнді ашу"}`, "aria-label": `${hb.name}, ${d}`, onclick: () => { habitDate = d; selectedHabit = hb.id; render(); } }, h("small", {}, ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"][new Date(d + "T12:00:00Z").getUTCDay()]), h("span", {}, Number(d.slice(8))));
          })));
      }), !S.habits.length && empty("Алғашқы әдетіңізді қосыңыз."))];
}

/* ---------- Тапсырмалар ---------- */
function taskForm(t) {
  ask(t?.id ? "Тапсырманы өзгерту" : "Жаңа тапсырма", [
    { name: "title", label: "Тапсырма", value: t?.title },
    { name: "goal", label: "Мақсат", options: [["", "Мақсатсыз"], ...S.goals.map((g) => [g.id, g.title])], value: t?.goal ?? "" },
    { name: "due", label: "Мерзімі", type: "date", optional: true, value: t ? t.due : today() },
    { name: "time", label: "Басталу уақыты", type: "time", optional: true, value: t?.time },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: t?.dur || "" },
    { name: "w", label: "Салмағы · профильдегі ұпайға әсері", options: WEIGHTS, value: String(t?.w ?? 1) },
  ], (v) => {
    put("tasks", { id: t?.id ?? crypto.randomUUID(), title: v.title.trim(), goal: v.goal || "", due: v.due || "", time: v.time || "", dur: Math.round(Number(v.dur)) || 0, w: Number(v.w), done: t?.done ?? false, doneAt: t?.doneAt ?? "" });
    save();
  }, t?.id && (() => { if (!confirm(`«${t.title}» өшіру ме?`)) return; rm("tasks", t.id); save(); }));
}

function taskLine(t) {
  const sub = [t.due && (late(t) ? `Мерзімі өтті: ${dshort(t.due)}` : dshort(t.due)), timeLabel(t), goalName(t)].filter(Boolean).join(" · ");
  return h("div", { class: "row" }, h("button", { class: "line", "aria-pressed": t.done, onclick: () => toggleTask(t) }, dot(t.done ? "on" : "", t.done), main(t.title, sub)),
    h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${t.title}`, onclick: () => taskForm(t) }, ic("edit")));
}

/* ---------- Әдет беті: тапсырмалар · жоспар · белсенділік ---------- */
function planForm(hb) {
  ask("Жоспар · " + hb.name, [
    { name: "time", label: "Басталу уақыты: бос қалдырсаң, күн тізімінде уақытсыз бекітіледі", type: "time", optional: true, value: hb.time },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: hb.dur || "" },
  ], (v) => { put("habits", { ...hb, time: v.time || "", dur: v.time ? Math.round(Number(v.dur)) || 0 : 0 }); save(); });
}

function habitPage(hb) {
  const t = today(), r = JO.runs(S, hb, t), rt = JO.rate(S, hb, t), row = (k, v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v));
  const start = JO.addDays(t, -JO.weekday(t) - 49), cells = [];
  for (let d = start; d <= t; d = JO.addDays(d, 1)) {
    const l = JO.logOf(S, hb.id, d), on = d >= hb.created && (hb.kind === "neutral" ? l?.count > 0 : JO.dayStatus(hb, l) === "done" && (hb.kind === "good" || d < t));
    cells.push(h("i", { "data-l": on ? 4 : 0, title: dshort(d) }));
  }
  const month = t.slice(0, 7), stat = hb.kind === "neutral" ? row("Осы айда", S.logs.filter((l) => l.habit === hb.id && l.date.startsWith(month)).reduce((s, l) => s + l.count, 0))
    : [row("Серия", r.cur), row("Ең ұзақ серия", r.best), rt?.total && row("Соңғы 30 күн", `${Math.round(rt.done / rt.total * 100)}%`), hb.kind === "bad" && row("Күрес күндері", JO.fightDays(S, hb))];
  return [
    h("div", { class: "end", style: "justify-content:space-between;margin:0" }, h("button", { class: "ghost", onclick: () => { openId = null; render(); } }, ic("back"), "Әдеттер"),
      h("button", { class: "ghost", onclick: () => habitForm(hb) }, ic("edit"), "Өзгерту")),
    h("h1", {}, hb.name), h("p", { class: "muted sub" }, KIND[hb.kind].replace("әдеттер", "әдет") + ` · салмағы: ${hb.w}`),
    sec("Тапсырмалар", hb.kind === "good" ? (hb.steps.length ? hb.steps.map((s) => h("div", { class: "row" }, h("span", {}, s))) : empty("Ішкі пункт жоқ: әдет бір қадам болып саналады. «Өзгерту» арқылы қос."))
      : empty("Ішкі пункттер тек жақсы әдетте болады.")),
    sec("Жоспар", h("div", { class: "row" }, h("span", {}, hb.time ? `Уақытпен: ${timeLabel(hb)}` : "Тізімде бекітілген, уақытсыз"), h("button", { class: "ghost sm", "aria-label": "Жоспарды өзгерту", onclick: () => planForm(hb) }, ic("edit")))),
    sec("Белсенділік · соңғы 8 апта", h("div", { class: "heat", role: "img", "aria-label": "Әдеттің күнделікті орындалуы" }, cells), ...[stat].flat().filter(Boolean)),
  ];
}

function tasksPage() {
  if (selectedHabit) {
    const hb = S.habits.find(x => x.id === selectedHabit);
    if (hb) return [h("button", { class: "ghost", onclick: () => { selectedHabit = ""; render(); } }, "← Қоржынға"),
      h("div", { class: "page-heading" }, h("h1", {}, hb.name), h("button", { onclick: () => habitForm(hb) }, ic("edit"), "Өңдеу")),
      sec("Күндік нәтиже", h("input", { type: "date", value: habitDate || today(), min: hb.created, max: today(), "aria-label": "Жазба күні", onchange: e => { if (e.target.value >= hb.created && e.target.value <= today()) { habitDate = e.target.value; render(); } } }), dayRow(hb)),
      ...habitsPage().slice(2)];
    selectedHabit = "";
  }
  const open = S.tasks.filter(t => !t.done).sort((a,b) => (a.due || "9").localeCompare(b.due || "9"));
  const done = S.tasks.filter(t => t.done).sort((a,b) => b.doneAt.localeCompare(a.doneAt));
  return [h("h1", {}, "Қоржын"), h("p", { class: "muted sub" }, "Барлық тапсырмалар мен әдеттер бір жерде"),
    h("div", { class: "segmented" }, ...[["tasks", "Тапсырмалар", S.tasks.length], ["habits", "Әдеттер", S.habits.length]].map(([id,label,count]) => h("button", { "aria-pressed": basketTab === id, onclick: () => { basketTab = id; render(); } }, `${label} · ${count}`))),
    ...(basketTab === "tasks" ? [sec("Тапсырмалар", h("button", { class: "primary", onclick: () => taskForm() }, ic("plus"), "Тапсырма қосу"), ...open.map(taskLine), !open.length && empty("Ашық тапсырма жоқ.")),
      done.length > 0 && sec("Орындалғандар", ...done.map(taskLine))] : [sec("Әдеттер", h("button", { class: "primary", onclick: () => habitForm() }, ic("plus"), "Әдет қосу"), ...S.habits.map(habitRow), !S.habits.length && empty("Алғашқы әдетіңізді қосыңыз."))])];
}

/* ---------- Мақсат (SMART) және аналитика ---------- */
function goalForm(g) {
  ask(g ? "Мақсатты өзгерту" : "Жаңа мақсат", [
    { name: "title", label: "Мақсат: нақты және өлшенетін", value: g?.title },
    { name: "why", label: "Неге маңызды", type: "textarea", value: g?.why },
    { name: "target", label: "Сандық меже (мысалы, 12 кітап)", type: "number", optional: true, value: g?.target || "", min: 0 },
    { name: "current", label: "Қазіргі нәтиже", type: "number", optional: true, value: g?.current || "", min: 0 },
    { name: "unit", label: "Өлшем бірлігі (кітап, км, сағат…)", optional: true, value: g?.unit },
    { name: "deadline", label: "Мерзімі", type: "date", value: g?.deadline },
  ], (v) => { put("goals", { id: g?.id ?? crypto.randomUUID(), title: v.title.trim(), why: v.why.trim(), target: Math.max(0, Number(v.target) || 0), current: Math.max(0, Number(v.current) || 0), unit: v.unit.trim(), deadline: v.deadline }); save(); },
  g && (() => {
    if (!confirm(`«${g.title}» өшіру ме? Тапсырмалар қалады, мақсатпен байланысы үзіледі.`)) return;
    S.tasks.filter((t) => t.goal === g.id).forEach((t) => { t.goal = ""; put("tasks", t); });
    S.habits.filter((hb) => hb.goal === g.id).forEach((hb) => { hb.goal = ""; put("habits", hb); });
    rm("goals", g.id); save();
  }));
}

function goalsPage() {
  const t = today(), ms = JO.monthStats(S, t), stat = (k, v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v));
  const goals = [...S.goals].sort((a, b) => a.deadline.localeCompare(b.deadline)), rated = S.habits.filter((x) => x.kind !== "neutral");
  return [
    h("div", { class: "page-heading" }, h("div", {}, h("h1", {}, "Мақсаттар"), h("p", { class: "muted sub" }, "Бағытыңыз, нәтижеңіз және келесі қадам")), h("button", { class: "primary", onclick: () => goalForm() }, ic("plus"), "Мақсат қосу")),
    sec("Мақсаттар", ...goals.map((g) => {
      const overview = JO.goalOverview(S, g, t), p = JO.goalProgress(S, g), metric = JO.goalMetric(g), linked = S.habits.filter((hb) => hb.goal === g.id), left = JO.daysBetween(t, g.deadline);
      return h("article", { class: "goal-card" }, h("div", { class: "main" }, h("b", { class: "goal-title" }, g.title),
        h("small", { class: "muted" }, [`${p.done}/${p.total} тапсырма`, left >= 0 ? `${left} күн қалды` : `Мерзімі ${-left} күн бұрын өтті`].join(" · ")), g.why && h("p", { class: "muted" }, g.why),
        metric.target > 0 && h("p", { class: "num" }, `${metric.current} / ${metric.target} ${g.unit || ""}`),
        h("p", { class: "num" }, `Әдеттер мен қадамдар: ${overview.done}/${overview.total} · ${overview.pct}%`), bar(overview.pct), metric.target > 0 && h("small", { class: "muted" }, `Сандық меже: ${Math.min(100, Math.round(metric.current / metric.target * 100))}%`),
        linked.length > 0 && h("small", { class: "muted" }, "Көмектесетін әдеттер: " + linked.map((hb) => hb.name).join(", ")),
        h("details", { class: "goal-contents" }, h("summary", {}, `Ішкі әдеттер (${linked.length}) және қадамдар (${p.total})`),
          ...linked.map(habitRow), ...S.tasks.filter(task => task.goal === g.id).map(taskLine),
          h("div", { class: "quantity-actions" }, h("button", { onclick: () => habitForm({ goal: g.id }) }, ic("repeat"), "Әдет қосу"),
          h("button", { onclick: () => taskForm({ goal: g.id, due: today() }) }, ic("plus"), "Қадам қосу")))),
        h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${g.title}`, onclick: () => goalForm(g) }, ic("edit")));
    }), !goals.length && empty("Алғашқы мақсатыңызды қосыңыз. Межені белгілеңіз де, оған жетелейтін әдеттер мен қадамдарды байланыстырыңыз.")),

  ];
}

/* ---------- Профиль ---------- */
const CLOUD = { local: "Бұлт өшік: Hub-қа кіріп, осы бетті қайта аш", ok: "Бұлтпен синхрондалды", wait: "Бұлтқа жіберуге күтіп тұр", err: "Бұлт қатесі" };
function profilePage() {
  const t = today(), ms = JO.monthStats(S, t), rated = S.habits.filter(x => x.kind !== "neutral"), stat = (k,v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v));
  // «ok» ескіруі мүмкін: кейін жазба қосылса не желі жоқ болса, кезекте күтіп тұр. Кіргенбіз, бірақ желі жоқ — «local» емес
  const state = (Sync.state === "local" && S.synced) || (Sync.state === "ok" && S.pending.length) ? "wait" : Sync.state;
  const row = (k, v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v)), st = JO.profileStats(S, today());
  return [
    h("h1", {}, "Профиль"), h("p", { class: "muted sub" }, "Аналитика, нәтижелер және деректер"),
    sec("Осы ай", stat("Орындалған тапсырма", ms.tasksDone), stat("Жақсы әдеттердің орындалуы", ms.goodPct == null ? "—" : `${ms.goodPct}%`), stat("Күрес күндері", ms.fights), stat("Сүрінген күндер", ms.slips)),
    rated.length > 0 && sec("Әдеттер · соңғы 30 күн", ...rated.map((x) => {
      const r = JO.rate(S, x, t), s = JO.runs(S, x, t), p = r.total ? Math.round(r.done / r.total * 100) : null;
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, x.name), h("small", { class: "muted" }, `Серия: ${s.cur} · ең ұзақ: ${s.best}`), p != null && bar(p)), h("b", { class: "num" }, p == null ? "—" : `${p}%`));
    })),
    sec("Бұлт", h("p", { class: "muted" }, CLOUD[state] + (state === "wait" ? `: ${S.pending.length}` : "") + (state === "err" ? `: ${Sync.error}` : "")),
      h("div", { class: "end", style: "margin-top:0;justify-content:flex-start" }, state === "local" ? h("a", { class: "btn", href: "../" }, "Hub-қа кіру") : h("button", { onclick: () => Sync.now() }, "Қазір синхрондау"))),
    sec("Белсенділік · соңғы 13 апта", h("div", { class: "heat", role: "img", "aria-label": "Күн сайынғы ұпай картасы" }, st.days.map((x) => h("i", { "data-l": st.max ? Math.ceil(x.p / st.max * 4) : 0, title: `${dshort(x.date)}: ${x.p}` }))),
      row("Осы апта · ұпай", st.week), row("Осы ай · ұпай", st.month), row("Белсенді күндер қатары", st.cur), row("Ең ұзақ қатар", st.best)),
    sec("Жазбалар", row("Әдеттер", S.habits.length), row("Тапсырмалар", S.tasks.length), row("Мақсаттар", S.goals.length)),
  ];
}

function plusMenu() {
  const dlg = h("dialog", {}, h("h3", {}, "Не қосамыз?"),
    ...[["Тапсырма", "tasks", taskForm], ["Әдет", "repeat", habitForm], ["Мақсат", "target", goalForm]].map(([t, i, f]) =>
      h("button", { class: "menu", onclick: () => { dlg.close(); f(); } }, ic(i), t)),
    h("div", { class: "end" }, h("button", { class: "ghost", onclick: () => dlg.close() }, "Бас тарту")));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

const PAGES = { habits: habitsPage, home, tasks: tasksPage, goals: goalsPage, profile: profilePage };
const NAV = [["home", "Жоспаргер", "home"], ["tasks", "Қоржын", "tasks"], ["+"], ["goals", "Мақсат", "target"], ["profile", "Профиль", "user"]];
const go = (t) => { selectedHabit = ""; habitDate = ""; tab = t; render(); scrollTo(0, 0); };

function render() {
  document.getElementById("view").replaceChildren(...PAGES[tab]().filter(Boolean));
  document.getElementById("quick-add").onclick = plusMenu;
  document.getElementById("nav").replaceChildren(...NAV.map(([id, label, icon]) => id === "+"
    ? h("button", { class: "plus", "aria-label": "Қосу", onclick: plusMenu }, ic("plus"))
    : h("button", { "aria-current": id === tab ? "page" : null, onclick: () => go(id) }, ic(icon), label)));
}
addEventListener("online", render);
addEventListener("offline", render);
render();
Sync.start();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
