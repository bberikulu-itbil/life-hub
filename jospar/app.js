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
  flame: '<path d="M12 2c1 5-4 5-2 10 1-2 3-2 3-5 4 3 7 6 7 10a8 8 0 0 1-16 0c0-3 2-6 4-8-1 5 1 5 1 7 3-3 0-8 3-14z"/>',
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
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};

let S = structuredClone(DEF), selectedGoal = "", tab = "home", habitDate = "", basketTab = "tasks", selectedHabit = "", habitOrigin = "home", selectedTask = "", taskOrigin = "home", profileTab = "overview";
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* бұзылған жазба — бос күйден бастаймыз */ }
if (!S.synced) S.pending = []; // алғашқы синхронда барлығы қайта кезекке қойылады

let preferences = { name:"", avatar:"🌱", timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qostanay", weekStart:1, textSize:"large" };
try { Object.assign(preferences, JSON.parse(localStorage.getItem("jospar.preferences") || "{}")); new Intl.DateTimeFormat("en", {timeZone:preferences.timeZone}).format(); } catch { preferences.timeZone = "Asia/Qostanay"; }
preferences.name = typeof preferences.name === "string" ? preferences.name : "";
preferences.avatar = typeof preferences.avatar === "string" ? preferences.avatar : "🌱";
preferences.weekStart = preferences.weekStart === 0 ? 0 : 1;
preferences.textSize = ["standard","large","extra"].includes(preferences.textSize) ? preferences.textSize : "large";
const dateParts = () => new Intl.DateTimeFormat("en-CA", {timeZone:preferences.timeZone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date()).reduce((p,x) => (p[x.type]=x.value,p), {});
const localDate = dateParts;
// Күн барлық бетте профильдің уақыт белдеуімен бірдей есептеледі.
const today = () => { const p = localDate(); return `${p.year}-${p.month}-${p.day}`; };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { alert("Сақталмады: браузер жадына жазу мүмкін емес."); } };
let undoState = null, checkpoint = JSON.stringify(Object.fromEntries(LISTS.map(k => [k,S[k]])));
const save = () => { undoState = JSON.parse(checkpoint); persist(); checkpoint = JSON.stringify(Object.fromEntries(LISTS.map(k => [k,S[k]]))); render(); Sync.schedule(); };

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
    if (k.startsWith("aria-") && typeof v === "boolean") { e.setAttribute(k,String(v)); continue; }
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
  const visibility = []; let more = null; // f.more: сирек қажет өрістер «Қосымша» ішінде жиналады
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
    if (f.type === "icons") { // белгіше торы: радио-батырмалар
      form.append(h("fieldset", { class: "icon-grid" }, h("legend", {}, f.label), ...f.options.map(([k, t]) => h("label", { "aria-label": t, title: t }, h("input", { type: "radio", name: f.name, value: k, checked: k === f.value }), ic(k)))));
      continue;
    }
    const input = f.options ? h("select", { name: f.name }, f.options.map(([v, t]) => h("option", { value: v }, t)))
      : f.type === "textarea" ? h("textarea", { name: f.name, rows: 4 }, f.value ?? "")
      : h("input", { name: f.name, type: f.type || "text", value: f.value ?? "", required: !f.optional, pattern: f.type ? null : "\\S.*", ...(f.type === "number" ? { min: f.min ?? 0, step: f.step ?? "any", inputmode: "numeric" } : {}) });
    if (f.options) input.value = f.value;
    const label = h("label", {}, f.label, input), box = f.more ? (more ??= h("details", { class: "more" }, h("summary", {}, "Қосымша"))) : form;
    box.append(label); visibility.push({f,label,input});
    if (f.quick) box.append(h("div", { class: "quick" }, f.quick.map(([t, v]) => h("button", { type: "button", onclick: () => { input.value = v; } }, t)))); // жылдам күн таңдау
  }
  if (more) form.append(more);
  const updateVisibility = () => {
    const mode = visibility.find(x=>x.f.name === "tracking")?.input.value;
    const kind = visibility.find(x=>x.f.name === "kind")?.input.value;
    for(const {f,label,input} of visibility) {
      const hidden = (f.modes && !f.modes.includes(mode)) || (f.kinds && !f.kinds.includes(kind));
      label.hidden=Boolean(hidden);
      if(f.modes || f.kinds) { if(hidden || f.optional) input.removeAttribute("required"); else input.setAttribute("required",""); }
    }
  };
  visibility.find(x=>x.f.name === "tracking")?.input.addEventListener("change",updateVisibility);
  visibility.find(x=>x.f.name === "kind")?.input.addEventListener("change",updateVisibility);
  updateVisibility();
  form.append(h("div", { class: "end" },
    onDel && h("button", { type: "button", class: "ghost danger", onclick: () => { dlg.close(); onDel(); } }, "Өшіру"),
    h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary" }, "Сақтау")));
  form.addEventListener("submit", e => { e.preventDefault(); if(ok(Object.fromEntries(new FormData(form))) !== false) dlg.close(); });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------- әрекеттер ---------- */
const selectedDay = () => selectedHabit && habitDate ? habitDate : today();
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

function streakBadge(hb, big=false) {
  const n=JO.runs(S,hb,today()).cur, neutral=hb.kind === "neutral";
  return h("span",{class:"streak-badge"+(n>0 ? " burning":"")+(big ? " big":""),"aria-label":neutral ? "Бақылау әдеті: қатар есептелмейді" : `${n} күн қатарынан`,title:neutral ? "Бұл әдетте тек мөлшер есептеледі" : `Қазіргі қатар: ${n} күн`},ic("flame"),h("b",{class:"num"},neutral ? "—":n));
}

function openHabit(hb) { selectedTask=""; habitOrigin = tab; selectedHabit = hb.id; habitDate = today(); render(); document.getElementById("view").scrollTop = 0; }
function closeHabit() { selectedHabit = ""; habitDate = ""; tab = habitOrigin; render(); }
function dayRow(hb, detail = false) {
  const t = selectedDay(), l = JO.logOf(S, hb.id, t), st = JO.dayStatus(hb, l), r = JO.runs(S, hb, t), tl = timeLabel(hb);
  if (!detail) {
    const mode=JO.trackingOf(hb);
    const sub = [mode === "steps" && hb.measures?.length ? `${hb.measures.filter(step => (l?.values?.[step.id] || 0) >= step.target).length}/${hb.measures.length} қадам` : ["timer","counter"].includes(mode) ? `${mode === "timer" ? clockText(l?.count || 0) : numberText(l?.count || 0)} / ${mode === "timer" ? clockText(hb.target || 0) : hb.target} ${mode === "timer" ? "" : hb.unit || ""}` : hb.kind === "bad" ? (l?.slip ? "Сүрінді" : "Бақылауда") : st === "done" ? "Орындалды" : "Орындау керек", tl || ""].filter(Boolean).join(" · ");
    return h("div", { class: "habit habit-overview" },
      h("button", { class: "line", onclick: () => openHabit(hb), "aria-label": `${hb.name}: ашу` }, dot(st === "done" && hb.kind === "good" ? "on" : "", st === "done" && hb.kind === "good"), main(hb.name, sub), streakBadge(hb), ic("chevron")));
  }
  const mode=JO.trackingOf(hb);
  if(hb.kind === "good" && hb.tracking && ["timer","counter"].includes(mode)) return measureRow(hb,habitMeasure(hb),t);
  if(hb.kind === "good" && hb.tracking === "check") return h("button",{class:"line","aria-pressed":st === "done",onclick:()=>toggleStep(hb,0)},dot(st === "done" ? "on":"",st === "done"),main(hb.name,st === "done" ? "Орындалды":"Белгілеу"));
  if(hb.kind === "good" && hb.tracking === "steps" && !hb.steps.length && !hb.measures?.length) return empty("Әзірге қадам жоқ. Төмендегі «Қадам қосу» батырмасын басыңыз.");
  let body;
  if (hb.kind === "good" && hb.measures?.length) return h("div", {class:"measured-habit"}, ...hb.measures.map(step => measureRow(hb,step,t)),
    ...hb.steps.map((step,i) => h("button", {class:"step", "aria-pressed":l?.done?.includes(i) || false, onclick:() => toggleStep(hb,i)}, dot(l?.done?.includes(i) ? "on" : "",l?.done?.includes(i)),step)),
    !hb.tracking && hb.target > 0 && h("button", {onclick:() => ask("Жалпы нәтиже", [{name:"count",label:`${hb.target} ${hb.unit || ""}`,type:"number",min:0,value:l?.count || 0}],v => edit(hb,log => {log.count=Number(v.count);} ))}, `${l?.count || 0}/${hb.target} ${hb.unit || ""}`));
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
const toggleTask = (t) => { put("tasks",JO.toggleTaskState(t,today())); save(); };
const late = (t) => !t.done && t.due !== "" && t.due < today();
const bar = (p) => h("div", { class: "bar", "aria-label": "Орындалу прогресі", role: "progressbar", "aria-valuenow": p, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${p}%` }));

// Басты беттегі тапсырма жолы: мерзімі өткені уақыт блогына емес, «Күні бойы» тізімінің басына түседі
function dayTask(t) {
  const tl=timeLabel(t);
  return h("div",{class:"habit"},tl && h("div",{class:"when"},tl),h("div",{class:"body"},taskLine(t)));
}

function planPicker() {
  const t = today(), list = h("div", {}), title = h("h3", { tabindex: "-1" }, "Жоспарға қосу");
  const dlg = h("dialog", { class: "add-sheet" }, h("div", { class: "sheet-heading" }, title, h("button", { class: "ghost sm", "aria-label": "Жабу", onclick: () => dlg.close() }, ic("x"))),
    h("p", { class: "muted" }, "Қоржыннан таңда: тапсырманың күні бүгінге ауысады."), list,
    h("div", { class: "end" }, h("button", { class: "primary", onclick: () => { dlg.close(); taskForm({ due: t }); } }, ic("plus"), "Жаңа тапсырма")));
  const draw = () => {
    const items = S.tasks.filter((x) => !x.done && x.due !== t).sort((a, b) => (a.due || "").localeCompare(b.due || "") || a.title.localeCompare(b.title)); // күнсіздер бірінші
    list.replaceChildren(...(items.length ? items.map((x) => h("button", { class: "menu", onclick: () => { put("tasks", { ...x, due: t }); save(); draw(); } },
      main(x.title, [x.due ? dshort(x.due) : "Күнсіз", x.time, goalName(x)].filter(Boolean).join(" · ")), ic("plus"))) : [empty("Қоржында жоспарлайтын тапсырма жоқ.")]));
  };
  draw(); dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal(); title.focus();
}

function home() {
  const t=today(),d=new Date(t+"T12:00:00"), habits=S.habits.filter(hb=>JO.scheduled(hb,t)).sort((a,b)=>(a.time || "99").localeCompare(b.time || "99"));
  const tasks=S.tasks.filter(x=>JO.todayTask(x,t)).sort((a,b)=>Number(a.done)-Number(b.done)||(a.time || "99").localeCompare(b.time || "99"));
  const loose=S.tasks.filter(x=>!x.due && !x.done); // күнсіз істер бүгінгі санға кірмейді, бірақ көзден таса қалмайды
  const goods=habits.filter(hb=>hb.kind === "good"), done=goods.filter(hb=>JO.dayStatus(hb,JO.logOf(S,hb.id,t)) === "done").length+tasks.filter(x=>x.done).length,total=goods.length+tasks.length;
  return [h("h1",{},"Жоспаргер"),h("p",{class:"muted sub"},`${d.getDate()} ${MO[d.getMonth()]}, ${WD[d.getDay()]}`),
    total>0 && h("section",{class:"sec today-summary"},h("div",{class:"summary-heading"},h("span",{class:"eyebrow"},"Бүгін орындалды"),h("strong",{class:"summary-number num"},`${done}`,h("span",{class:"muted"},` / ${total}`))),bar(Math.round(done/total*100)),h("p",{class:"muted"},done === total ? "Бүгінгі жоспар орындалды ✓" : `${total-done} іс қалды. Бір қадамнан бастаңыз.`)),
    h("button",{class:"add-plan",onclick:planPicker},ic("plus"),"Жоспарға қосу"),
    habits.length>0 && sec(`Әдеттер · ${habits.length}`,...habits.map(hb=>dayRow(hb))),
    tasks.length>0 && sec(`Тапсырмалар · ${tasks.length}`,...tasks.map(taskLine)),
    loose.length>0 && sec(`Күні жоқ істер · ${loose.length}`,...loose.map(taskLine)),
    !habits.length && !tasks.length && !loose.length && empty("Бүгінгі жоспарыңыз бос. Төмендегі «+» арқылы алғашқы ісіңізді қосыңыз.")];
}

const GOAL_ICON_NAMES = { target: "Нысана", book: "Кітап", briefcase: "Жұмыс", activity: "Денсаулық", star: "Жұлдыз", globe: "Тіл, әлем", award: "Жетістік", heart: "Жүрек", home: "Үй", flame: "Жалын", code: "Код", sun: "Күн" };
const WEIGHTS = [["1", "1 · жеңіл"], ["2", "2"], ["3", "3 · орташа"], ["4", "4"], ["5", "5 · маңызды"], ["0", "0 · міндетті емес, ұпай бермейді"]];
/* ---------- Әдеттер ---------- */
function habitForm(hb) {
  if(hb?.id && runningTimer?.habit === hb.id) stopTimer();
  ask(hb?.id ? "Әдетті өзгерту" : "Жаңа әдет", [
    { name: "name", label: "Атауы", value: hb?.name },
    { name: "kind", label: "Түрі", options: [["good", "Жақсы · қалыптастыру"], ["bad", "Жаман · арылу"], ["neutral", "Бейтарап · бақылау"]], value: hb?.kind ?? "good" },
    { name:"tracking", label:"Өлшеу тәсілі", kinds:["good"], options:[["check","Белгілеу"],["timer","Таймер"],["counter","Санақ"],["steps","Қадамдар"]], value:JO.trackingOf(hb || {}) },
    { name: "target", label: "Күндік меже · таймерге секундпен (1 мин = 60)", type: "number", min: 0.001, modes:["timer","counter"], kinds:["good"], value: hb?.target || 1 },
    { name: "current", label: "Бүгінгі нәтиже · таймерге секундпен", type: "number", optional: true, modes:["timer","counter"], kinds:["good"], min: 0, value: hb?.id ? JO.logOf(S, hb.id, today())?.count || "" : "" },
    { name: "unit", label: "Өлшем бірлігі: бет, км, л, рет…", optional: true, modes:["counter"], kinds:["good"], value: hb?.unit },
    { name:"increment",label:"Бір басқанда қосылатын мөлшер",type:"number",min:0.001,modes:["counter"],kinds:["good"],value:hb?.increment || 1 },
    { name: "steps", label: "Қарапайым қадамдар: әр жолға біреу. Таймер мен санақты әдет ішіндегі «Қадам қосу» арқылы қосыңыз", type: "textarea", optional:true, modes:["steps"], kinds:["good"], value: hb?.steps?.join("\n") },
    { name: "days", label: "Қай күндері қайталанады?", type: "weekdays", value: hb?.days },
    { name: "goal", label: "Қай мақсатқа көмектеседі?", options: [["", "Мақсатсыз"], ...S.goals.map((g) => [g.id, g.title])], value: hb?.goal || "", more: true },
    { name: "time", label: "Басталу уақыты", type: "time", optional: true, value: hb?.time, more: true },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: hb?.dur || "", more: true },
    { name: "w", label: "Салмағы · профильдегі ұпайға әсері", options: WEIGHTS, value: String(hb?.w ?? 1), more: true },
  ], (v) => {
    const id = hb?.id ?? crypto.randomUUID();
    put("habits", { ...hb, id, tracking:v.tracking, increment:Math.max(0.001,Number(v.increment) || 1), target: Math.max(0, Number(v.target) || 0), unit:v.tracking === "timer" ? "сек" : v.unit.trim(), name:v.name.trim(), kind:v.kind, steps: v.kind === "good" ? v.steps.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      days: [...new Set(v.days.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))], goal: v.goal || "", time: v.time || "", dur: Math.round(Number(v.dur)) || 0, w: Number(v.w), created: hb?.created ?? today() });
    const log = JO.logOf(S, id, today()) || { id: crypto.randomUUID(), habit: id, date: today(), done: [], slip: false, resist: 0, count: 0 };
    if (["timer","counter"].includes(v.tracking) && Number(v.current) !== log.count) { log.count = Math.max(0, Number(v.current) || 0); put("logs", log); }
    save();
  }, hb?.id && (() => {
    if (!confirm(`«${hb.name}» және оның тарихы өшіріледі. Жалғастыру ма?`)) return;
    if(runningTimer?.habit === hb.id) stopTimer();
    S.logs.filter((l) => l.habit === hb.id).forEach((l) => rm("logs", l.id));
    rm("habits", hb.id); save();
  }));
}

function habitRow(hb) {
  const mode=JO.trackingOf(hb), label=hb.state === "archived" ? "Архивте" : hb.state === "paused" ? "Кідіртілген" : hb.days?.length && hb.days.length<7 ? hb.days.map(d=>WD[d].slice(0,2)).join(", ") : "Күн сайын";
  return h("div",{class:"row habit-overview"},h("button",{class:"line",onclick:()=>openHabit(hb)},main(hb.name,[label,["timer","counter"].includes(mode) && `${hb.target} ${hb.unit || "рет"}`].filter(Boolean).join(" · ")),streakBadge(hb),ic("chevron")));
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
      ...active.map(hb => dayRow(hb)), !active.length && empty("Бұл күнге жоспарланған әдет жоқ.")),
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
  const d = today();
  ask(t?.id ? "Тапсырманы өзгерту" : "Жаңа тапсырма", [
    { name: "title", label: "Тапсырма", value: t?.title },
    { name: "due", label: "Күні · бос қалдырсаң, қоржында күнсіз тұрады", type: "date", optional: true, value: t ? t.due : "", quick: [["Бүгін", d], ["Ертең", JO.addDays(d, 1)], ["Күнсіз", ""]] },
    { name: "time", label: "Басталу уақыты (күні болса ғана)", type: "time", optional: true, value: t?.time, more: true },
    { name: "dur", label: "Ұзақтығы, минут", type: "number", optional: true, min: 0, step: 1, value: t?.dur || "", more: true },
    { name: "goal", label: "Мақсат", options: [["", "Мақсатсыз"], ...S.goals.map((g) => [g.id, g.title])], value: t?.goal ?? "", more: true },
    { name: "w", label: "Салмағы · профильдегі ұпайға әсері", options: WEIGHTS, value: String(t?.w ?? 1), more: true },
  ], (v) => {
    put("tasks", { ...t, id: t?.id ?? crypto.randomUUID(), title: v.title.trim(), goal: v.goal || "", due: v.due || "", time: v.due ? v.time || "" : "", dur: v.due && v.time ? Math.round(Number(v.dur)) || 0 : 0, w: Number(v.w), done: t?.done ?? false, doneAt: t?.doneAt ?? "" });
    save();
  }, t?.id && (() => { if (!confirm(`«${t.title}» өшіру ме?`)) return; rm("tasks", t.id); save(); }));
}

function taskLine(t) {
  const p=JO.taskStepProgress(t);
  const sub=[t.due && (late(t) ? `Мерзімі өтті: ${dshort(t.due)}` : dshort(t.due)),timeLabel(t),goalName(t),p.total && `${p.done}/${p.total} қадам`].filter(Boolean).join(" · ");
  return h("div",{class:"row task-row"+(late(t) ? " overdue":"")},
    h("button",{class:"ghost sm","aria-label":`${t.done ? "Қайта ашу" : "Орындау"}: ${t.title}`,"aria-pressed":t.done,onclick:()=>toggleTask(t)},dot(t.done ? "on":"",t.done)),
    h("button",{class:"line",onclick:()=>openTask(t),"aria-label":`${t.title}: ашу`},main(t.title,sub),ic("chevron")),
    );
}
function openTask(t) {taskOrigin=tab;selectedHabit="";selectedTask=t.id;render();document.getElementById("view").scrollTop = 0;}
function updateSubtasks(id,fn) {
  const t=S.tasks.find(t=>t.id===id);if(!t)return;
  const subtasks=(t.subtasks || []).map(s=>({...s}));
  put("tasks",JO.taskWithSubtasks(t,fn(subtasks),today()));save();
}
function subtaskForm(t,step) {
  ask(step ? "Қосалқы қадамды өзгерту":"Қосалқы қадам",[{name:"title",label:"Не істеу керек?",value:step?.title}],v=>updateSubtasks(t.id,list=>step ? list.map(s=>s.id===step.id ? {...s,title:v.title.trim()}:s) : [...list,{id:crypto.randomUUID(),title:v.title.trim(),done:false}]),
    step && (()=>{if(confirm("Осы қадамды өшіру керек пе?"))updateSubtasks(t.id,list=>list.filter(s=>s.id!==step.id));}));
}
function taskDetail() {
  const t=S.tasks.find(t=>t.id===selectedTask);if(!t){selectedTask="";return PAGES[tab]();}
  const p=JO.taskStepProgress(t);
  return [h("button",{class:"ghost",onclick:()=>{selectedTask="";tab=taskOrigin;render();}},"← Артқа"),
    h("div",{class:"page-heading"},h("h1",{},t.title),h("button",{onclick:()=>taskForm(t)},ic("edit"),"Өңдеу")),
    sec("Тапсырма",h("button",{class:"ghost date-action",onclick:()=>ask("Күнін ауыстыру",[{name:"due",label:"Жаңа күн",type:"date",value:t.due || today()}],v=>{put("tasks",{...t,due:v.due});save();})},"Күнін ауыстыру"),h("p",{class:"muted"},[t.due ? `Мерзімі: ${dshort(t.due)}`:"Мерзімсіз",timeLabel(t),goalName(t)].filter(Boolean).join(" · ")),
      h("button",{class:t.done ? "":"primary","aria-pressed":t.done,onclick:()=>toggleTask(t)},ic("check"),t.done ? "Қайта ашу":"Толық орындау")),
    sec("Қосалқы қадамдар",h("p",{class:"muted"},p.total ? `${p.done}/${p.total} қадам орындалды. Барлық қадам біткенде тапсырма автоматты аяқталады.`:"Тапсырманы шағын қадамдарға бөліңіз."),
      p.total > 0 && bar(Math.round(p.done/p.total*100)),
      ...(t.subtasks || []).map(step=>h("div",{class:"row"},h("button",{class:"line","aria-pressed":step.done,onclick:()=>updateSubtasks(t.id,list=>list.map(s=>s.id===step.id ? {...s,done:!s.done}:s))},dot(step.done ? "on":"",step.done),main(step.title)),h("button",{class:"ghost sm","aria-label":`Қадамды өңдеу: ${step.title}`,onclick:()=>subtaskForm(t,step)},ic("edit")))),
      h("button",{class:"primary",onclick:()=>subtaskForm(t)},ic("plus"),"Қадам қосу"))];
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
    if (hb) return [h("button", { class: "ghost", onclick: closeHabit }, "← Артқа"),
      h("div", { class: "page-heading" }, h("h1", {}, hb.name), streakBadge(hb,true), h("button", { onclick: () => habitForm(hb) }, ic("edit"), "Өңдеу")),
      sec("Күндік нәтиже", h("input", { type: "date", value: habitDate || today(), min: hb.created, max: today(), "aria-label": "Жазба күні", onchange: e => { if (e.target.value >= hb.created && e.target.value <= today()) { habitDate = e.target.value; render(); } } }), dayRow(hb, true)),
      sec("Нәтижелер", h("div", { class: "metric-grid" }, ...[["Қазіргі қатар", JO.runs(S, hb, today()).cur], ["Ең ұзақ қатар", JO.runs(S, hb, today()).best], [hb.measures?.length ? "Қадам орындалды" : "30 күн жиыны", hb.measures?.length ? hb.measures.filter(step => (JO.logOf(S,hb.id,selectedDay())?.values?.[step.id] || 0) >= step.target).length + "/" + hb.measures.length : S.logs.filter(l => l.habit === hb.id && l.date >= JO.addDays(today(), -29) && l.date <= today()).reduce((n,l) => n + l.count, 0)]].map(([label,value]) => h("div", {}, h("b", { class: "num" }, value), h("small", { class: "muted" }, label))))),
      hb.kind === "good" && JO.trackingOf(hb) === "steps" && sec("Қадамдар", h("p", {class:"muted"}, "Әр қадамға таймер немесе санақ таңдаңыз. Межеден артық нәтиже де сақталады."), h("button", {class:"primary",onclick:() => measureForm(hb)}, ic("plus"), "Қадам қосу")),
      sec("Күндік жазба", h("p", {class:"muted"}, JO.logOf(S,hb.id,selectedDay())?.note || "Жазба жоқ"),
        hb.kind === "bad" && h("p", {class:"muted"}, "Сүріну себебі: " + (JO.logOf(S,hb.id,selectedDay())?.reason || "Көрсетілмеген")),
        h("button", {onclick:() => noteForm(hb)}, "Жазба қосу / өзгерту")),
      sec("Фокус", h("p",{class:"muted"},`Осы күні: ${clockText(JO.logOf(S,hb.id,selectedDay())?.focusSeconds || 0)}`), h("button", {onclick:() => startTimer(hb,null,selectedDay())}, "Фокус таймерін бастау")),
      sec("Әдетті басқару", h("p", {class:"muted"}, hb.state === "archived" ? "Архивте" : hb.state === "paused" ? "Кідіртілген" : "Белсенді"),
        h("div", {class:"quantity-actions"}, h("button", {onclick:() => changeHabitState(hb,hb.state ? "active" : "paused")}, hb.state ? "Жалғастыру" : "Кідірту"),
        hb.state !== "archived" && h("button", {onclick:() => changeHabitState(hb,"archived")}, "Архивтеу"))),
      ...habitsPage().slice(2)];
    selectedHabit = "";
  }
  const open=S.tasks.filter(t=>!t.done && basketMatches(t)).sort((a,b)=>(a.due || "9").localeCompare(b.due || "9")),done=S.tasks.filter(t=>t.done && basketMatches(t)).sort((a,b)=>b.doneAt.localeCompare(a.doneAt));
  const loose=open.filter(t=>!t.due), overdue=open.filter(late), upcoming=open.filter(t=>t.due && !late(t)), habits=S.habits.filter(basketMatches);
  return [h("h1",{},"Қоржын"),h("p",{class:"muted sub"},"Барлық істеріңіз бір жерде"),
    h("div",{class:"segmented",role:"group","aria-label":"Жазба түрі"},...[["tasks","Тапсырмалар",S.tasks.length],["habits","Әдеттер",S.habits.length]].map(([id,label,count])=>h("button",{"aria-pressed":basketTab===id,onclick:()=>{basketTab=id;basketFilter="all";render();}},`${label} · ${count}`))),basketControls(),
    ...(basketTab === "tasks" ? [loose.length>0 && sec(`Күні жоқ · ${loose.length}`,...loose.map(taskLine)),overdue.length>0 && sec(`Мерзімі өткен · ${overdue.length}`,...overdue.map(taskLine)),upcoming.length>0 && sec(`Алдағы істер · ${upcoming.length}`,...upcoming.map(taskLine)),
      done.length>0 && h("details",{class:"sec completed-tasks"},h("summary",{},`Орындалғандар · ${done.length}`),...done.map(taskLine)),
      !open.length && !done.length && empty("Тапсырма табылмады. Іздеу не сүзгіні өзгертіңіз немесе «+» арқылы қосыңыз.")]
      : [habits.length>0 ? sec(`Әдеттер · ${habits.length}`,...habits.map(habitRow)) : empty("Әдет табылмады. Іздеу не сүзгіні өзгертіңіз немесе «+» арқылы қосыңыз.")])];
}

/* ---------- Мақсат (SMART) және аналитика ---------- */
function goalForm(g) {
  ask(g ? "Мақсатты өзгерту" : "Жаңа мақсат", [
    { name: "title", label: "Мақсат: нақты және өлшенетін", value: g?.title },
    { name: "icon", label: "Белгіше", type: "icons", options: JO.GOAL_ICONS.map((k) => [k, GOAL_ICON_NAMES[k]]), value: g?.icon ?? "target" },
    { name: "why", label: "Неге маңызды", type: "textarea", value: g?.why, more: true },
    { name: "target", label: "Сандық меже (мысалы, 12 кітап)", type: "number", optional: true, value: g?.target || "", min: 0, more: true },
    { name: "current", label: "Қазіргі нәтиже", type: "number", optional: true, value: g?.current || "", min: 0, more: true },
    { name: "unit", label: "Өлшем бірлігі (кітап, км, сағат…)", optional: true, value: g?.unit, more: true },
    { name: "deadline", label: "Мерзімі", type: "date", value: g?.deadline ?? JO.addDays(today(), 30), quick: [["1 ай", JO.addDays(today(), 30)], ["3 ай", JO.addDays(today(), 90)], ["Жыл соңы", today().slice(0, 4) + "-12-31"]] },
  ], (v) => { put("goals", { ...g, history:[...(g?.history || []), {date:today(),current:Math.max(0,Number(v.current)||0)}], id: g?.id ?? crypto.randomUUID(), title: v.title.trim(), icon: v.icon || "target", why: v.why.trim(), target: Math.max(0, Number(v.target) || 0), current: Math.max(0, Number(v.current) || 0), unit: v.unit.trim(), deadline: v.deadline }); save(); },
  g && (() => {
    if (!confirm(`«${g.title}» өшіру ме? Тапсырмалар қалады, мақсатпен байланысы үзіледі.`)) return;
    S.tasks.filter((t) => t.goal === g.id).forEach((t) => { t.goal = ""; put("tasks", t); });
    S.habits.filter((hb) => hb.goal === g.id).forEach((hb) => { hb.goal = ""; put("habits", hb); });
    rm("goals", g.id); save();
  }));
}

function goalCard(g, t) {
  const o = JO.goalOverview(S, g, t), left = JO.daysBetween(t, g.deadline);
  return h("button", { class: "goal-card", onclick: () => { selectedGoal = g.id; render(); document.getElementById("view").scrollTop = 0; } },
    h("span", { class: "menu-icon" }, ic(g.icon || "target")), h("span", { class: "main" }, h("b", { class: "goal-title" }, g.title),
      h("small", { class: "muted" }, [`${o.pct}%`, left >= 0 ? `${left} күн қалды` : `Мерзімі ${-left} күн бұрын өтті`].join(" · ")), bar(o.pct)), ic("chevron"));
}

function goalPage(g) {
  const t = today(), o = JO.goalOverview(S, g, t), p = JO.goalProgress(S, g), metric = JO.goalMetric(g), left = JO.daysBetween(t, g.deadline);
  const linked = S.habits.filter((hb) => hb.goal === g.id), steps = S.tasks.filter((x) => x.goal === g.id).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9").localeCompare(b.due || "9"));
  return [
    h("div", { class: "page-heading" }, h("button", { class: "ghost", onclick: () => { selectedGoal = ""; render(); } }, ic("back"), "Мақсаттар"), h("button", { class: "ghost", onclick: () => goalForm(g) }, ic("edit"), "Өзгерту")),
    h("div", { class: "goal-head" }, h("span", { class: "menu-icon" }, ic(g.icon || "target")), h("div", {}, h("h1", {}, g.title),
      h("p", { class: "muted sub" }, left >= 0 ? `Мерзімі: ${dshort(g.deadline)} · ${left} күн қалды` : `Мерзімі ${-left} күн бұрын өтті`))),
    g.why && h("p", { class: "muted" }, g.why),
    h("section", { class: "sec" }, h("p", { class: "num" }, `Орындалуы: ${o.pct}% · ${o.done}/${o.total}`), bar(o.pct),
      metric.target > 0 && h("p", { class: "num" }, `${metric.current} / ${metric.target} ${g.unit || ""}`)),
    sec(`Қадамдар · ${p.done}/${p.total}`, ...steps.map(taskLine), !steps.length && empty("Қадам жоқ: мақсатқа апаратын бір реттік істерді қос."),
      h("button", { onclick: () => taskForm({ goal: g.id, due: "" }) }, ic("plus"), "Қадам қосу")),
    sec(`Әдеттер · ${linked.length}`, ...linked.map(habitRow), !linked.length && empty("Әдет жоқ: мақсатқа көмектесетін тұрақты әдетті қос."),
      h("button", { onclick: () => habitForm({ goal: g.id }) }, ic("repeat"), "Әдет қосу")),
    sec("Келесі қадам және тарих", goalExtras(g)),
  ];
}

function goalsPage() {
  const g = selectedGoal && S.goals.find((x) => x.id === selectedGoal);
  if (g) return goalPage(g);
  selectedGoal = "";
  const t = today(), goals = [...S.goals].sort((a, b) => a.deadline.localeCompare(b.deadline));
  return [
    h("div", { class: "page-heading" }, h("div", {}, h("h1", {}, "Мақсаттар"), h("p", { class: "muted sub" }, "Әр мақсатқа бір қадам жақынырақ"))),
    h("div", { class: "goal-list" }, ...goals.map((x) => goalCard(x, t)),
      !goals.length && h("section", { class: "sec empty-state" }, ic("target"), h("h2", {}, "Алғашқы мақсатыңыз"), empty("Межені белгілеңіз. Әдеттер мен тапсырмаларды сол мақсатқа байланыстырыңыз."), h("button", { class: "primary", onclick: () => goalForm() }, "Мақсат қосу"))),
  ];
}

/* ---------- Профиль ---------- */
const CLOUD = { local: "Бұлт өшік: Hub-қа кіріп, осы бетті қайта аш", ok: "Бұлтпен синхрондалды", wait: "Бұлтқа жіберуге күтіп тұр", err: "Бұлт қатесі" };
function exportBackup() {
  const blob = new Blob([JSON.stringify({ version: 1, preferences, exportedAt: new Date().toISOString(), habits: S.habits, logs: S.logs, tasks: S.tasks, goals: S.goals }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), a = h("a", { href: url, download: `jospar-${today()}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readingControls() {
  return h("div",{class:"reading-controls",role:"group","aria-label":"Мәтін өлшемі"},...[["standard","Қалыпты"],["large","Ірі"],["extra","Өте ірі"]].map(([id,label])=>h("button",{"aria-pressed":preferences.textSize===id,onclick:()=>{preferences.textSize=id;localStorage.setItem("jospar.preferences",JSON.stringify(preferences));render();}},label)));
}
function profilePage() {
  const t=today(),ms=JO.monthStats(S,t),st=JO.profileStats(S,t);
  const state=(Sync.state === "local" && S.synced) || (Sync.state === "ok" && S.pending.length) ? "wait":Sync.state;
  const activity=Array.from({length:90},(_,i)=>{const date=JO.addDays(t,i-89);return {date,p:JO.dayPoints(S,date,t)};}),max=Math.max(0,...activity.map(x=>x.p));
  const tabs=h("div",{class:"segmented profile-tabs",role:"group","aria-label":"Профиль бөлімі"},...[["overview","Шолу"],["analytics","Аналитика"],["settings","Баптаулар"]].map(([id,label])=>h("button",{"aria-pressed":profileTab===id,onclick:()=>{profileTab=id;render();document.getElementById("view").scrollTop=0;}},label)));
  const identity=h("button",{class:"profile-identity profile-link",onclick:profileForm},h("span",{class:"avatar","aria-hidden":"true"},preferences.avatar),main(preferences.name || "Есіміңізді қосыңыз",preferences.timeZone),ic("chevron"));
  const stats=h("div",{class:"stats-grid"},...[[ms.tasksDone,"Тапсырма орындалды"],[ms.goodPct==null ? "—":`${ms.goodPct}%`,"Әдеттердің орындалуы"],[st.cur,"Белсенді күн қатары"],[st.month,"Осы айдағы ұпай"]].map(([value,label])=>h("div",{class:"stat-tile"},h("b",{class:"num"},value),h("span",{class:"muted"},label))));
  const analytics=[sec("Белсенділік · 90 күн",h("div",{class:"heat",role:"img","aria-label":"Соңғы 90 күннің белсенділігі"},activity.map(x=>h("i",{"data-l":max ? Math.ceil(x.p/max*4):0,title:`${x.date}: ${x.p} ұпай` }))),h("p",{class:"muted helper"},"Қою түс — сол күні көбірек іс орындалған.")),
    sec("Әр әдеттің нәтижесі",...S.habits.map(hb=>{const r=JO.rate(S,hb,t),p=r?.total ? Math.round(r.done/r.total*100):null;return h("div",{class:"analytics-habit"},habitRow(hb),h("p",{class:"muted"},r ? `30 күн: ${r.done}/${r.total} · ${p==null ? "—":p+"%"}`:"Мөлшер бойынша бақылау"),p!=null && bar(p));}),!S.habits.length && empty("Әдет қосқаннан кейін нәтижелер осы жерде көрінеді."))];
  const settings=[sec("Оқу ыңғайлылығы",h("p",{class:"muted"},"Мәтін өлшемін өзіңізге ыңғайлаңыз."),readingControls()),
    sec("Жеке параметрлер",identity,h("p",{class:"muted"},`Апта ${preferences.weekStart===0 ? "жексенбіден":"дүйсенбіден"} басталады`),h("button",{onclick:profileForm},"Параметрлерді өзгерту")),
    sec("Синхрондау",h("p",{class:"muted"},CLOUD[state]+(state === "wait" ? ` · ${S.pending.length} өзгеріс`:"")+(state === "err" ? `: ${Sync.error}`:"")),state === "local" ? h("a",{class:"btn",href:"../"},"Hub-қа кіру"):h("button",{disabled:Sync.busy,onclick:()=>Sync.now()},Sync.busy ? "Синхрондалып жатыр…":"Қазір синхрондау")),
    sec("Деректер",h("div",{class:"settings-actions"},h("button",{onclick:exportBackup},"Сақтық көшірме жүктеу"),h("button",{onclick:importBackup},"Көшірмеден қалпына келтіру"),h("button",{disabled:!undoState,onclick:undoLast},"Соңғы әрекетті қайтару")),h("p",{class:"muted helper"},`${S.habits.length} әдет · ${S.tasks.length} тапсырма · ${S.goals.length} мақсат`))];
  return [h("h1",{},"Профиль"),h("p",{class:"muted sub"},"Өз ырғағыңыз бен нәтижелеріңіз"),tabs,...(profileTab === "settings" ? settings:profileTab === "analytics" ? analytics:[h("section",{class:"sec"},identity),stats,comparisonPanel()])];
}

function plusMenu() {
  const title=h("h3",{tabindex:"-1"},"Жаңа жазба");
  const dlg=h("dialog",{class:"add-sheet"},h("div",{class:"sheet-heading"},title,h("button",{class:"ghost sm","aria-label":"Жабу",onclick:()=>dlg.close()},ic("x"))),
    h("p",{class:"muted"},"Не жоспарлағыңыз келеді?"),
    ...[["Тапсырма","Бір реттік іс және қосалқы қадамдар","tasks",taskForm],["Әдет","Қайталау, таймер немесе санақ","repeat",habitForm],["Мақсат","Әдеттер мен істерді бір мақсатқа біріктіру","target",goalForm]].map(([label,sub,icon,fn])=>
      h("button",{class:"menu",onclick:()=>{dlg.close();fn();}},h("span",{class:"menu-icon"},ic(icon)),main(label,sub),ic("chevron"))));
  dlg.addEventListener("close",()=>dlg.remove());document.body.append(dlg);dlg.showModal();title.focus();
}

const PAGES = { habits: habitsPage, home, tasks: tasksPage, goals: goalsPage, profile: profilePage };
const NAV = [["home", "Жоспаргер", "home"], ["tasks", "Қоржын", "tasks"], ["+"], ["goals", "Мақсат", "target"], ["profile", "Профиль", "user"]];
const go = (t) => { selectedGoal = ""; selectedTask = ""; selectedHabit = ""; habitDate = ""; tab = t; render(); document.getElementById("view").scrollTop = 0; };

function render() {
  document.documentElement?.setAttribute("data-text-size",preferences.textSize);
  if (Sync.busy === false && !S.pending.length) checkpoint = JSON.stringify(Object.fromEntries(LISTS.map(k => [k,S[k]])));
  document.getElementById("view").replaceChildren(...(selectedTask ? taskDetail() : selectedHabit ? tasksPage() : PAGES[tab]()).filter(Boolean));
  renderTimerDock();
  document.getElementById("nav").replaceChildren(...NAV.map(([id, label, icon]) => id === "+"
    ? h("button", { class: "plus", "aria-label": "Қосу", onclick: plusMenu }, ic("plus"))
    : h("button", { "aria-current": id === tab ? "page" : null, onclick: () => go(id) }, ic(icon), label)));
}
/* Өлшенетін қадамдар, құрылғы параметрлері және деректерді басқару. */
let runningTimer = null, basketQuery = "", basketFilter = "all";
try { const saved = JSON.parse(localStorage.getItem("jospar.timer") || "null"); if(saved && typeof saved.habit === "string" && typeof saved.date === "string" && Number.isFinite(saved.startedAt)) runningTimer = saved; } catch {}
const numberText = n => Number(n.toFixed(3)).toLocaleString("kk-KZ");
const clockText = n => `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`;
const timerDelta = timer => Math.max(0,Math.floor((Date.now()-timer.startedAt)/1000));
function editAt(hb,date,fn) {
  const log = JO.logOf(S,hb.id,date) || {id:crypto.randomUUID(),habit:hb.id,date,done:[],slip:false,resist:0,count:0};
  fn(log);put("logs",log);save();
}
function habitMeasure(hb) { return {id:"$habit", name:hb.name, mode:JO.trackingOf(hb) === "timer" ? "timer":"counter", target:hb.target || 1,unit:hb.unit || "рет",increment:hb.increment || 1}; }
const measureValue=(hb,step,date)=>step.id === "$habit" ? JO.logOf(S,hb.id,date)?.count || 0 : JO.logOf(S,hb.id,date)?.values?.[step.id] || 0;
function writeMeasure(hb,step,date,value) {
  editAt(hb,date,log => { const next=Math.max(0,Number(value.toFixed(6))); if(step.id === "$habit") log.count=next;else log.values = {...log.values,[step.id]:next}; });
}
function measureRow(hb,step,date) {
  const value=measureValue(hb,step,date), active = runningTimer?.habit === hb.id && runningTimer?.step === step.id && runningTimer?.date === date;
  return h("article",{class:"measure-card"},h("div",{class:"row"},main(step.name,step.mode === "timer" ? "Таймер · меже орындалған соң да жалғасады" : "Санақ · межеден артық қосуға болады"),h("button",{class:"ghost sm","aria-label":`Қадамды өңдеу: ${step.name}`,onclick:() => step.id === "$habit" ? habitForm(hb) : measureForm(hb,step)},ic("edit"))),
    h("p",{class:"measure-value num",...(active ? {"data-timer-value":""} : {})},step.mode === "timer" ? `${clockText(value + (active ? timerDelta(runningTimer):0))} / ${clockText(step.target)}` : `${numberText(value)} / ${numberText(step.target)} ${step.unit}`),
    bar(Math.min(100,Math.round(value/step.target*100))),
    h("div",{class:"quantity-actions"},step.mode === "timer" ? h("button",{class:"primary",onclick:() => active ? stopTimer() : startTimer(hb,step,date)},active ? "Кідірту және сақтау" : "▶ Таймерді бастау") : [
      h("button",{"aria-label":`${step.name}: азайту`,onclick:() => writeMeasure(hb,step,date,value-step.increment)},ic("minus")),
      h("button",{class:"primary",onclick:() => writeMeasure(hb,step,date,value+step.increment)},ic("plus"),`${numberText(step.increment)} ${step.unit}${step.name.toLowerCase().includes("су") ? " · стакан" : ""}`)],
      h("button",{disabled:active,onclick:() => ask("Нәтиже · "+step.name,[{name:"value",label:step.mode === "timer" ? "Нәтиже, секунд" : `Нәтиже, ${step.unit}`,type:"number",value,min:0}],v => writeMeasure(hb,step,date,Number(v.value)))},"Нәтижені енгізу")));
}
function measureForm(hb,step) {
  if(JO.trackingOf(hb) !== "steps") {alert("Қадам қосу үшін әдеттің өлшеу тәсілін «Қадамдар» деп таңдаңыз.");return;}
  ask(step ? "Қадамды өзгерту" : "Өлшенетін қадам",[
    {name:"name",label:"Қадам атауы",value:step?.name},
    {name:"mode",label:"Өлшеу тәсілі",options:[["counter","Санақ"],["timer","Таймер"]],value:step?.mode || "counter"},
    {name:"target",label:"Меже · таймерге секундпен (1 мин = 60)",type:"number",min:0.001,value:step?.target || 1},
    {name:"unit",label:"Өлшем бірлігі (л, рет, км…). Таймер секундпен өлшенеді",optional:true,value:step?.unit || "рет"},
    {name:"increment",label:"Бір басқанда қосылатын мөлшер / стакан көлемі",type:"number",min:0.001,value:step?.increment || 1}
  ],v => { const updated={id:step?.id || crypto.randomUUID(),name:v.name.trim(),mode:v.mode,target:Number(v.target),unit:v.mode === "timer" ? "сек" : v.unit.trim(),increment:Number(v.increment)};
    if(runningTimer?.habit === hb.id && runningTimer?.step === step?.id) stopTimer();
    const current=S.habits.find(x=>x.id === hb.id) || hb;
    put("habits",{...current,measures:step ? (current.measures || []).map(x=>x.id===step.id ? updated:x) : [...(current.measures || []),updated]});save();
  },step && (() => {if(!confirm("Қадамды алып тастау керек пе?")) return; if(runningTimer?.step===step.id) stopTimer();const current=S.habits.find(x=>x.id===hb.id) || hb;put("habits",{...current,measures:(current.measures || []).filter(x=>x.id!==step.id)});save();}));
}
function startTimer(hb,step,date) {
  if(runningTimer) { if(!confirm("Қазір жүріп тұрған таймерді сақтап, жаңасын бастау керек пе?")) return; stopTimer(); }
  runningTimer={habit:hb.id,step:step?.id || "",date,startedAt:Date.now()};localStorage.setItem("jospar.timer",JSON.stringify(runningTimer));render();
}
function stopTimer() {
  if(!runningTimer) return;
  const timer=runningTimer,hb=S.habits.find(x=>x.id === timer.habit),delta=timerDelta(timer);
  runningTimer=null;localStorage.removeItem("jospar.timer");
  if(hb) editAt(hb,timer.date,log => {if(timer.step === "$habit") log.count+=delta;else if(timer.step) log.values={...log.values,[timer.step]:(log.values?.[timer.step] || 0)+delta};else log.focusSeconds=(log.focusSeconds || 0)+delta;});else render();
}
function renderTimerDock() {
  let dock=document.getElementById("timer-dock");if(!dock){dock=h("aside",{id:"timer-dock","aria-label":"Жүріп тұрған таймер"});document.body.append(dock);}
  if(!runningTimer){dock.hidden=true;return;}dock.hidden=false;
  const hb=S.habits.find(x=>x.id===runningTimer.habit),step=runningTimer.step === "$habit" && hb ? habitMeasure(hb) : hb?.measures?.find(x=>x.id===runningTimer.step);
  const base=runningTimer.step === "$habit" ? JO.logOf(S,runningTimer.habit,runningTimer.date)?.count || 0 : runningTimer.step ? JO.logOf(S,runningTimer.habit,runningTimer.date)?.values?.[runningTimer.step] || 0 : 0;
  dock.replaceChildren(h("button",{class:"ghost",onclick:() => {if(hb){openHabit(hb);habitDate=runningTimer.date;render();}}},main(step?.name || "Фокус",hb?.name || "Әдет")),h("b",{class:"num","data-timer-dock":""},clockText(base+timerDelta(runningTimer))),h("button",{onclick:stopTimer},"Кідірту"));
}
setInterval(() => {
  if(!runningTimer) return;
  const base=runningTimer.step === "$habit" ? JO.logOf(S,runningTimer.habit,runningTimer.date)?.count || 0 : runningTimer.step ? JO.logOf(S,runningTimer.habit,runningTimer.date)?.values?.[runningTimer.step] || 0 : 0;
  document.querySelectorAll("[data-timer-dock]").forEach(el=>{el.textContent=clockText(base+timerDelta(runningTimer));});
  const hb=S.habits.find(x=>x.id===runningTimer.habit),step=runningTimer.step === "$habit" && hb ? habitMeasure(hb) : hb?.measures?.find(x=>x.id===runningTimer.step);
  document.querySelectorAll("[data-timer-value]").forEach(el=>{el.textContent=`${clockText(base+timerDelta(runningTimer))} / ${clockText(step?.target || 0)}`;});
},1000);
function noteForm(hb) {
  const log=JO.logOf(S,hb.id,selectedDay());
  ask("Күндік жазба",[{name:"note",label:"Бүгін қалай өтті?",type:"textarea",value:log?.note,optional:true},...(hb.kind === "bad" ? [{name:"reason",label:"Сүріну себебі немесе байқаған триггер",type:"textarea",optional:true,value:log?.reason}] : [])],v=>edit(hb,l=>{l.note=v.note.trim();if(hb.kind === "bad")l.reason=v.reason.trim();}));
}
function changeHabitState(hb,state) {
  const breaks=[...(hb.breaks || []).map(b=>({...b}))];
  if(state === "active") {const last=breaks.at(-1);if(last && !last.end)last.end=today();}
  else if(!breaks.at(-1) || breaks.at(-1).end) breaks.push({start:today(),end:""});
  put("habits",{...hb,state:state === "active" ? undefined:state,breaks});save();
}
function profileForm() {
  ask("Профиль параметрлері",[
    {name:"name",label:"Атыңыз",optional:true,value:preferences.name},
    {name:"avatar",label:"Аватар белгісі (мысалы, 🌱)",optional:true,value:preferences.avatar},
    {name:"timeZone",label:"Уақыт белдеуі (мысалы, Asia/Qostanay)",value:preferences.timeZone},
    {name:"weekStart",label:"Аптаның бірінші күні",options:[["1","Дүйсенбі"],["0","Жексенбі"]],value:String(preferences.weekStart)}
  ],v=>{try{new Intl.DateTimeFormat("en",{timeZone:v.timeZone.trim()}).format();}catch{alert("Уақыт белдеуі танылмады. Мысалы: Asia/Qostanay");return false;}
    preferences={...preferences,name:v.name.trim(),avatar:[...v.avatar.trim()].slice(0,8).join("") || "🌱",timeZone:v.timeZone.trim(),weekStart:Number(v.weekStart)};
    localStorage.setItem("jospar.preferences",JSON.stringify(preferences));render();});
}
function comparisonPanel() {
  const c=JO.periodComparison(S,today(),preferences.weekStart);
  const card=(label,current,previous)=>h("div",{class:"comparison-tile"},h("span",{class:"eyebrow"},label),h("strong",{class:"num"},`${current} `,h("small",{},"ұпай")),h("p",{class:"muted"},`Бұрын: ${previous} ұпай`),h("span",{class:"change-chip"+(current>=previous ? " positive":"")},`${current-previous>=0 ? "+":""}${current-previous} ұпай`));
  return sec("Алдыңғы кезеңмен салыстыру",h("div",{class:"comparison-grid"},card("Осы апта",c.week,c.previousWeek),card("Осы ай",c.month,c.previousMonth)),h("p",{class:"muted helper"},"Екі кезеңнің бірдей күндері салыстырылады."));
}

function goalExtras(g) {
  const tasks=S.tasks.filter(x=>x.goal===g.id),next=tasks.filter(x=>!x.done).sort((a,b)=>(a.due || "9").localeCompare(b.due || "9"))[0];
  const history=[...tasks.filter(x=>x.done).map(x=>({date:x.doneAt,label:`✓ ${x.title}`})),...(g.history || []).map(x=>({date:x.date,label:`Нәтиже: ${x.current} ${g.unit || ""}`}))].sort((a,b)=>b.date.localeCompare(a.date));
  return h("div",{},h("p",{},next ? `Келесі қадам: ${next.title}` : "Ашық қадам жоқ"),
    h("button",{onclick:()=>taskForm({goal:g.id,due:"",milestone:true})},"Аралық меже қосу"),
    ...tasks.filter(x=>x.milestone).map(x=>h("p",{class:"muted"},`${x.done ? "✓" : "○"} Аралық меже: ${x.title}`)),
    h("details",{},h("summary",{},"Орындалу тарихы және динамика"),...history.slice(0,30).map(e=>h("p",{class:"muted"},`${e.date} · ${e.label}`)),...S.habits.filter(hb=>hb.goal===g.id).map(hb=>{
      const previous=JO.rate(S,hb,JO.addDays(today(),-7),7),current=JO.rate(S,hb,today(),7);
      return h("p",{class:"muted"},`${hb.name}: осы 7 күн ${current ? `${current.done}/${current.total}`:"—"} · алдыңғы 7 күн ${previous ? `${previous.done}/${previous.total}`:"—"}`);
    }),!history.length && empty("Тарих әлі жоқ.")));
}
function undoLast() {
  if(!undoState) return;
  if(runningTimer) {alert("Қайтару алдында таймерді кідіртіңіз.");return;}
  const previous=undoState;undoState=null;
  for(const k of LISTS) {const ids=new Set(previous[k].map(x=>x.id));for(const e of [...S[k]])if(!ids.has(e.id))rm(k,e.id);for(const e of previous[k])put(k,e);}
  persist();checkpoint=JSON.stringify(Object.fromEntries(LISTS.map(k=>[k,S[k]])));render();Sync.schedule();
}
function importBackup() {
  const input=h("input",{type:"file",accept:"application/json,.json"});
  input.addEventListener("change",async()=>{const file=input.files?.[0];if(!file)return;
    try{if(file.size>15*1024*1024)throw new Error("Файл 15 МБ-тан үлкен.");const decoded=JO.restoreEntries(JSON.parse(await file.text()));
      if(runningTimer)throw new Error("Қалпына келтіру алдында таймерді кідіртіңіз.");
      if(!confirm("Көшірмедегі жазбалар қосылады. Бірдей нөмірі бар жазбалар жаңарады, басқа жазбалар сақталады. Жалғастыру керек пе?"))return;
      for(const k of LISTS)for(const entry of decoded[k]) {
        if(k === "logs"){const existing=S.logs.find(l=>l.habit===entry.habit && l.date===entry.date);if(existing && existing.id!==entry.id)rm("logs",existing.id);}
        put(k,entry);
      }save();toast("Сақтық көшірме қалпына келтірілді","check");
    }catch(e){alert(e.message || "Көшірмені оқу мүмкін емес.");}});input.click();
}
function basketControls() {
  return h("div",{class:"basket-tools"},h("input",{id:"basket-search",type:"search",placeholder:"Іздеу…","aria-label":"Қоржыннан іздеу",value:basketQuery,oninput:e=>{basketQuery=e.target.value;render();const field=document.getElementById("basket-search");field?.focus();}}),
    h("select",{"aria-label":"Қоржын сүзгісі",onchange:e=>{basketFilter=e.target.value;render();}},...[['all','Барлығы'],['active','Белсенді'],['late','Мерзімі өткен'],['important','Маңызды · 4–5'],['paused','Кідіртілген'],['archived','Архив']].map(([value,label])=>h("option",{value,selected:basketFilter===value},label))));
}
function basketMatches(e) {
  if(!(e.title || e.name || "").toLocaleLowerCase().includes(basketQuery.toLocaleLowerCase()))return false;
  if(basketFilter === "late")return Boolean(e.due && !e.done && e.due<today());
  if(basketFilter === "important")return e.w>=4;
  if(basketFilter === "paused" || basketFilter === "archived")return e.state===basketFilter;
  if(basketFilter === "active")return !e.done && !e.state;
  return true;
}

addEventListener("online", render);
addEventListener("offline", render);
render();
Sync.start();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
