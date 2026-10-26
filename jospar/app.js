"use strict";
/* Jospar интерфейсі: Басты бет, Тапсырмалар (+ әдеттер), Мақсат (+ аналитика), Профиль. Деректер осы құрылғыда (localStorage), Hub-қа кірсең бұлтпен синхрондалады; логика — core.js (JO). */
const KEY = "jospar.v1";
const DEF = { habits: [], logs: [], tasks: [], goals: [], pending: [], synced: false };
const LISTS = ["habits", "logs", "tasks", "goals"];
const WD = ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"];
const MO = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
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
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};

let S = structuredClone(DEF), tab = "home";
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
const dayLog = (hb) => JO.logOf(S, hb.id, today()) ?? { id: crypto.randomUUID(), habit: hb.id, date: today(), done: [], slip: false, resist: 0, count: 0 };
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
  const t = today(), l = JO.logOf(S, hb.id, t), st = JO.dayStatus(hb, l), r = JO.runs(S, hb, t), tl = timeLabel(hb);
  let body;
  if (hb.kind === "good") {
    const done = st === "done", d = new Set(l?.done), n = hb.steps.length, streak = r.cur ? `Серия: ${r.cur} күн` : "";
    if (!n) body = [h("button", { class: "line", "aria-pressed": done, onclick: () => toggleStep(hb, 0) }, dot(done ? "on" : "", done), main(hb.name, streak))];
    else body = [h("div", { class: "line" }, dot(done ? "on" : "", done), main(hb.name, [`${[...d].filter((i) => i < n).length}/${n}`, streak].filter(Boolean).join(" · "))),
      h("div", { class: "steps" }, hb.steps.map((s, i) => h("button", { class: "step", "aria-pressed": d.has(i), onclick: () => toggleStep(hb, i) }, dot(d.has(i) ? "on" : "", d.has(i)), s)))];
  } else if (hb.kind === "bad") {
    const slipped = st === "slip";
    body = [h("div", { class: "line" }, dot(slipped ? "slip" : "on", true), main(hb.name, `Серия: ${r.cur} күн · Күрес күндері: ${JO.fightDays(S, hb)}`), h("span", { class: "chip " + (slipped ? "bad" : "ok") }, slipped ? "Сүрінді" : "Орындалды")),
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
const bar = (p) => h("div", { class: "bar", role: "progressbar", "aria-valuenow": p, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${p}%` }));

// Басты беттегі тапсырма жолы: мерзімі өткені уақыт блогына емес, «Күні бойы» тізімінің басына түседі
function dayTask(t) {
  const tl = late(t) ? null : timeLabel(t);
  return h("div", { class: "habit" }, tl && h("div", { class: "when" }, tl), h("div", { class: "body" },
    h("button", { class: "line", "aria-pressed": t.done, onclick: () => toggleTask(t) }, dot(t.done ? "on" : "", t.done), main(t.title, [late(t) && `Мерзімі өтті: ${dshort(t.due)}`, goalName(t)].filter(Boolean).join(" · ")))));
}

function home() {
  const t = today(), d = new Date(), goods = S.habits.filter((x) => x.kind === "good"), tasks = S.tasks.filter((x) => JO.todayTask(x, t));
  const done = goods.filter((x) => JO.dayStatus(x, JO.logOf(S, x.id, t)) === "done").length + tasks.filter((x) => x.done).length, total = goods.length + tasks.length;
  const rows = [...S.habits.map((x) => ({ time: x.time, name: x.name, el: dayRow(x) })), ...tasks.map((x) => ({ time: late(x) ? "" : x.time, name: x.title, late: late(x), el: dayTask(x) }))]
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || !a.late - !b.late || a.name.localeCompare(b.name));
  const timed = rows.filter((r) => r.time), free = rows.filter((r) => !r.time);
  return [
    h("h1", {}, "Басты бет"), h("p", { class: "muted sub" }, `${d.getDate()} ${MO[d.getMonth()]}, ${WD[d.getDay()]}`),
    total > 0 && sec("Бүгінгі прогресс", h("span", { class: "num" }, `Жақсы әдеттер мен тапсырмалар: ${done}/${total}`), bar(Math.round(done / total * 100))),
    timed.length > 0 && sec("Күн жоспары", ...timed.map((r) => r.el)),
    free.length > 0 && sec(timed.length ? "Күні бойы" : "Бүгін", ...free.map((r) => r.el)),
    !rows.length && empty("Бүгінге ештеңе жоқ. Төмендегі «+» батырмасымен әдет не тапсырма қос."),
  ];
}

/* ---------- Әдеттер ---------- */
function habitForm(hb) {
  ask(hb ? "Әдетті өзгерту" : "Жаңа әдет", [
    { name: "name", label: "Атауы", value: hb?.name },
    { name: "kind", label: "Түрі", options: [["good", "Жақсы · қалыптастыру"], ["bad", "Жаман · арылу"], ["neutral", "Бейтарап · бақылау"]], value: hb?.kind ?? "good" },
    { name: "steps", label: "Ішкі пункттер: әр жолға біреу (тек жақсы әдетке)", type: "textarea", value: hb?.steps.join("\n") },
    { name: "time", label: "Басталу уақыты", type: "time", optional: true, value: hb?.time },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: hb?.dur || "" },
  ], (v) => {
    put("habits", { id: hb?.id ?? crypto.randomUUID(), name: v.name.trim(), kind: v.kind, steps: v.kind === "good" ? v.steps.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      time: v.time || "", dur: Math.round(Number(v.dur)) || 0, created: hb?.created ?? today() });
    save();
  }, hb && (() => {
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
  return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, hb.name), h("small", { class: "muted" }, [timeLabel(hb), sub].filter(Boolean).join(" · "))),
    h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${hb.name}`, onclick: () => habitForm(hb) }, ic("edit")));
}

/* ---------- Тапсырмалар ---------- */
function taskForm(t) {
  ask(t ? "Тапсырманы өзгерту" : "Жаңа тапсырма", [
    { name: "title", label: "Тапсырма", value: t?.title },
    { name: "goal", label: "Мақсат", options: [["", "Мақсатсыз"], ...S.goals.map((g) => [g.id, g.title])], value: t?.goal ?? "" },
    { name: "due", label: "Мерзімі", type: "date", optional: true, value: t ? t.due : today() },
    { name: "time", label: "Басталу уақыты", type: "time", optional: true, value: t?.time },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: t?.dur || "" },
  ], (v) => {
    put("tasks", { id: t?.id ?? crypto.randomUUID(), title: v.title.trim(), goal: v.goal || "", due: v.due || "", time: v.time || "", dur: Math.round(Number(v.dur)) || 0, done: t?.done ?? false, doneAt: t?.doneAt ?? "" });
    save();
  }, t && (() => { if (!confirm(`«${t.title}» өшіру ме?`)) return; rm("tasks", t.id); save(); }));
}

function taskLine(t) {
  const sub = [t.due && (late(t) ? `Мерзімі өтті: ${dshort(t.due)}` : dshort(t.due)), timeLabel(t), goalName(t)].filter(Boolean).join(" · ");
  return h("div", { class: "row" }, h("button", { class: "line", "aria-pressed": t.done, onclick: () => toggleTask(t) }, dot(t.done ? "on" : "", t.done), main(t.title, sub)),
    h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${t.title}`, onclick: () => taskForm(t) }, ic("edit")));
}

function tasksPage() {
  const open = S.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9") || a.title.localeCompare(b.title));
  const done = S.tasks.filter((t) => t.done).sort((a, b) => b.doneAt.localeCompare(a.doneAt)).slice(0, 10); // shortcut: тек соңғы 10 орындалған көрінеді, тарих керек болса — бөлек бет
  return [
    h("h1", {}, "Тапсырмалар"), h("p", { class: "muted sub" }, "Бір реттік істер мен әдеттер"),
    open.length > 0 && sec("Орындалмаған", ...open.map(taskLine)),
    done.length > 0 && sec("Соңғы орындалғандар", ...done.map(taskLine)),
    ...["good", "bad", "neutral"].map((k) => S.habits.some((x) => x.kind === k) && sec(KIND[k], ...S.habits.filter((x) => x.kind === k).map(habitRow))),
    !S.tasks.length && !S.habits.length && empty("Әлі ештеңе жоқ. Төмендегі «+» батырмасымен қос."),
  ];
}

/* ---------- Мақсат (SMART) және аналитика ---------- */
function goalForm(g) {
  ask(g ? "Мақсатты өзгерту" : "Жаңа мақсат", [
    { name: "title", label: "Мақсат: нақты және өлшенетін", value: g?.title },
    { name: "why", label: "Неге маңызды", type: "textarea", value: g?.why },
    { name: "deadline", label: "Мерзімі", type: "date", value: g?.deadline },
  ], (v) => { put("goals", { id: g?.id ?? crypto.randomUUID(), title: v.title.trim(), why: v.why.trim(), deadline: v.deadline }); save(); },
  g && (() => {
    if (!confirm(`«${g.title}» өшіру ме? Тапсырмалар қалады, мақсатпен байланысы үзіледі.`)) return;
    S.tasks.filter((t) => t.goal === g.id).forEach((t) => { t.goal = ""; put("tasks", t); });
    rm("goals", g.id); save();
  }));
}

function goalsPage() {
  const t = today(), ms = JO.monthStats(S, t), stat = (k, v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v));
  const goals = [...S.goals].sort((a, b) => a.deadline.localeCompare(b.deadline)), rated = S.habits.filter((x) => x.kind !== "neutral");
  return [
    h("h1", {}, "Мақсат"), h("p", { class: "muted sub" }, "SMART мақсаттар мен аналитика"),
    sec("Мақсаттар", ...goals.map((g) => {
      const p = JO.goalProgress(S, g), left = JO.daysBetween(t, g.deadline);
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, g.title),
        h("small", { class: "muted" }, [`${p.done}/${p.total} тапсырма`, left >= 0 ? `${left} күн қалды` : `Мерзімі ${-left} күн бұрын өтті`].join(" · ")), p.total > 0 && bar(Math.round(p.done / p.total * 100))),
        h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${g.title}`, onclick: () => goalForm(g) }, ic("edit")));
    }), !goals.length && empty("Мақсат әлі жоқ. «+» арқылы қос: нақты, өлшенетін, мерзімі бар. Өлшемі — оған байланған тапсырмалар.")),
    sec("Осы ай", stat("Орындалған тапсырма", ms.tasksDone), stat("Жақсы әдеттердің орындалуы", ms.goodPct == null ? "—" : `${ms.goodPct}%`), stat("Күрес күндері", ms.fights), stat("Сүрінген күндер", ms.slips)),
    rated.length > 0 && sec("Әдеттер · соңғы 30 күн", ...rated.map((x) => {
      const r = JO.rate(S, x, t), s = JO.runs(S, x, t), p = r.total ? Math.round(r.done / r.total * 100) : null;
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, x.name), h("small", { class: "muted" }, `Серия: ${s.cur} · ең ұзақ: ${s.best}`), p != null && bar(p)), h("b", { class: "num" }, p == null ? "—" : `${p}%`));
    })),
  ];
}

/* ---------- Профиль ---------- */
const CLOUD = { local: "Бұлт өшік: Hub-қа кіріп, осы бетті қайта аш", ok: "Бұлтпен синхрондалды", wait: "Бұлтқа жіберуге күтіп тұр", err: "Бұлт қатесі" };
function profilePage() {
  // «ok» ескіруі мүмкін: кейін жазба қосылса не желі жоқ болса, кезекте күтіп тұр. Кіргенбіз, бірақ желі жоқ — «local» емес
  const state = (Sync.state === "local" && S.synced) || (Sync.state === "ok" && S.pending.length) ? "wait" : Sync.state;
  const row = (k, v) => h("div", { class: "row" }, h("span", {}, k), h("b", { class: "num" }, v));
  return [
    h("h1", {}, "Профиль"), h("p", { class: "muted sub" }, "Деректер мен бұлт"),
    sec("Бұлт", h("p", { class: "muted" }, CLOUD[state] + (state === "wait" ? `: ${S.pending.length}` : "") + (state === "err" ? `: ${Sync.error}` : "")),
      h("div", { class: "end", style: "margin-top:0;justify-content:flex-start" }, state === "local" ? h("a", { class: "btn", href: "../" }, "Hub-қа кіру") : h("button", { onclick: () => Sync.now() }, "Қазір синхрондау"))),
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

const PAGES = { home, tasks: tasksPage, goals: goalsPage, profile: profilePage };
const NAV = [["home", "Басты бет", "home"], ["tasks", "Тапсырмалар", "tasks"], ["+"], ["goals", "Мақсат", "target"], ["profile", "Профиль", "user"]];
const go = (t) => { tab = t; render(); scrollTo(0, 0); };

function render() {
  document.getElementById("view").replaceChildren(...PAGES[tab]().filter(Boolean));
  document.getElementById("nav").replaceChildren(...NAV.map(([id, label, icon]) => id === "+"
    ? h("button", { class: "plus", "aria-label": "Қосу", onclick: plusMenu }, ic("plus"))
    : h("button", { "aria-current": id === tab ? "page" : null, onclick: () => go(id) }, ic(icon), label)));
}
addEventListener("online", render);
addEventListener("offline", render);
render();
Sync.start();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
