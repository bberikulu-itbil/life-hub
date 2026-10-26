"use strict";
/* FinSaulyq интерфейсі. Деректер тек осы құрылғыда (localStorage); есептеу — core.js (FS). */
const KEY = "finsaulyq.v1";
const DEF = { settings: { capital: 0, income: 0, fixed: 0, city: "Астана", pad: true, hide: false }, settingsId: null, tx: [], cycles: [], items: [], goals: [], stock: [], matches: [], contribs: [], accounts: [], transfers: [], pending: [], synced: false };
const LISTS = ["tx", "cycles", "items", "goals", "stock", "matches", "contribs", "accounts", "transfers"];
const CATS = ["Тамақ", "Көлік", "Тұрмыс", "Кітап", "Күтім", "Жалақы"];
const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const COLORS = ["var(--acc)", "var(--star)", "var(--warn)", "var(--acc-2)", "var(--good)", "var(--mute)"];
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  back: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>',
  drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
};

let S = structuredClone(DEF), tab = "home", allTx = false;
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* бұзылған жазба — бос күйден бастаймыз */ }
S.settings = { ...DEF.settings, ...S.settings };
if (!S.synced) S.pending = []; // алғашқы синхронда барлығы қайта кезекке қойылады

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmt = (n) => new Intl.NumberFormat("kk-KZ", { maximumFractionDigits: 0 }).format(Math.round(n));
const tg = (n) => `${fmt(n)} ₸`;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { alert("Сақталмады: браузер жадына жазу мүмкін емес."); } };
const save = () => { persist(); render(); Sync.schedule(); };

// Әр өзгеріс кезекке түседі (бұлтқа жіберу үшін); n — кезектегі жазбаның бірегей нөмірі
let seq = Date.now();
function queue(k, id, op) { S.pending = S.pending.filter((p) => !(p.k === k && p.id === id)); S.pending.push({ k, id, op, n: ++seq }); }
function put(k, e) {
  if (k === "settings") { S.settingsId ||= crypto.randomUUID(); return queue(k, S.settingsId, "put"); }
  const i = S[k].findIndex((x) => x.id === e.id);
  if (i < 0) S[k].push(e); else S[k][i] = e;
  queue(k, e.id, "put");
}
function rm(k, id) { S[k] = S[k].filter((x) => x.id !== id); queue(k, id, "del"); }
// Ескі циклдер (status жоқ) бір бастапқы item алады; sync.js те серверден оқығаннан кейін шақырады
function migrate() {
  const old = S.cycles.filter((c) => !c.status);
  if (!old.length) return;
  FS.migrate(S);
  for (const c of old) { queue("cycles", c.id, "put"); queue("items", FS.itemIdOf(c.id), "put"); }
  persist();
}
migrate();
const liveCycles = () => S.cycles.filter((c) => c.status !== "archived");
// Item қосу: цикл-күн, соңғы баға мен күн қайта есептеледі
function recordItem(c, o) {
  const it = { id: crypto.randomUUID(), cycleId: c.id, name: c.name, cost: o.cost, amount: o.qty || 1, store: o.store || "", discount: !!o.discount, note: o.note || "", time: o.date, city: S.settings.city, ...(o.txId ? { txId: o.txId } : {}), ...(o.receipt ? { receipt: o.receipt } : {}) };
  put("items", it); FS.recalcCycle(c, S.items); put("cycles", c);
  return it;
}
// Item өшсе, цикл қалған сатып алулардан қайта есептеледі
function dropItems(list) {
  const ids = new Set(list.map((i) => i.cycleId));
  for (const i of list) rm("items", i.id);
  for (const c of S.cycles) if (ids.has(c.id)) { FS.recalcCycle(c, S.items); put("cycles", c); }
}

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
const head = (t) => h("div", { class: "head" }, h("h1", {}, t), tab !== "set" && h("button", { class: "ghost sm", "aria-label": "Баптаулар", onclick: () => go("set") }, ic("sliders")));
const go = (t) => { tab = t; render(); scrollTo(0, 0); };
const sec = (title, action, ...body) => h("section", { class: "sec" }, h("header", {}, h("h2", {}, title), action), ...body);
const add = (fn) => h("button", { class: "ghost", onclick: fn }, ic("plus"), "Қосу");
const empty = (t) => h("p", { class: "empty" }, t);
const bar = (pct, low) => h("div", { class: "bar" + (low ? " low" : ""), role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${pct}%` }));
const del = (key, id, what) => h("button", { class: "ghost sm", "aria-label": `Өшіру: ${what}`, onclick: () => {
  const goal = key === "goals";
  if (!confirm(`«${what}» өшіру ме?` + (goal ? " Жиналған жарналар қолжетімді қалдыққа қайтады." : key === "cycles" ? " Сатып алу тарихы да өшеді." : key === "tx" ? " Байланысқан тауар жазбалары да өшеді." : ""))) return;
  if (goal) S.contribs.filter((c) => c.goalId === id).forEach((c) => rm("contribs", c.id));
  if (key === "tx") dropItems(S.items.filter((i) => i.txId === id)); // чектен/енгізуден түскен тауарлар да кетеді
  if (key === "cycles") S.items.filter((i) => i.cycleId === id).forEach((i) => rm("items", i.id));
  rm(key, id); save();
} }, ic("trash"));

// Бір диалог — барлық енгізу формалары үшін. fields: { name, label, type, value, options, min, step, optional }
function ask(title, fields, ok) {
  const form = h("form", { method: "dialog" }, h("h3", {}, title));
  const dlg = h("dialog", {}, form);
  for (const f of fields) {
    const input = f.options
      ? h("select", { name: f.name }, f.options.map(([v, t]) => h("option", { value: v }, t)))
      : h("input", { name: f.name, type: f.type || "text", value: f.value ?? "", required: !f.optional, ...(f.type === "number" ? { min: f.min ?? 0, step: f.step ?? "any", inputmode: "decimal" } : {}) });
    if (f.options && f.value != null) input.value = f.value;
    if (f.suggest) { const id = "dl-" + f.name; input.setAttribute("list", id); input.setAttribute("autocomplete", "off"); form.append(h("datalist", { id }, f.suggest.map((v) => h("option", { value: v })))); }
    form.append(h("label", {}, f.label, input));
  }
  form.append(h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary" }, "Сақтау")));
  form.addEventListener("submit", () => ok(Object.fromEntries(new FormData(form))));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
const num = (v) => Number(v);

/* ---------- енгізу формалары ---------- */
// Шот таңдауы: шоттар болса ғана көрсетіледі. Ескі (шотсыз) жазбаны өңдегенде «Шотсыз» таңдауы қалады
const hasAcc = () => S.accounts.length > 0;
const accOpts = (cur) => [...S.accounts.map((a) => [a.id, a.name]), ...(cur !== undefined && !S.accounts.some((a) => a.id === cur) ? [["", "Шотсыз"]] : [])];
const accField = (cur) => hasAcc() ? [{ name: "account", label: "Шот", options: accOpts(cur), value: cur ?? (S.accounts.some((a) => a.id === S.settings.lastAcc) ? S.settings.lastAcc : S.accounts[0].id) }] : [];
const withAcc = (e, v) => { if (v.account) { e.account = v.account; S.settings.lastAcc = v.account; } return e; };
const catList = () => [...new Set([...S.tx.map((t) => FS.normCat(t.category)), ...CATS])];
const stores = () => [...new Set([...S.tx.map((t) => t.store), ...S.items.map((i) => i.store)].filter(Boolean))];
const txForm = (t, pre) => { const d = t ?? pre ?? {}; ask(t ? "Транзакцияны өзгерту" : pre ? "Чектен оқылды: тексеріп сақта" : "Жаңа транзакция", [
  { name: "kind", label: "Түрі", options: [["expense", "Шығыс"], ["income", "Кіріс"]], value: d.kind },
  { name: "amount", label: "Сома, ₸", type: "number", min: 0.01, value: d.amount },
  { name: "category", label: "Санат", value: d.category ?? "Тамақ", suggest: catList() },
  { name: "store", label: "Дүкен", optional: true, value: d.store, suggest: stores() },
  { name: "note", label: "Ескертпе", optional: true, value: d.note },
  { name: "date", label: "Күні", type: "date", value: d.date ?? today() },
  ...accField(t ? (t.account ?? "") : undefined),
], (v) => { put("tx", withAcc({ id: t?.id ?? crypto.randomUUID(), kind: v.kind, amount: num(v.amount), category: FS.normCat(v.category), note: v.note.trim(), date: v.date, ...(v.store.trim() ? { store: v.store.trim() } : {}) }, v)); save(); }); };

// Чекті түсіру: суретті кішірейтіп, `receipt` функциясына жібереміз; нәтиже форманы толтырады, сақтауды өзің растайсың
async function shrink(file, max = 1800) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
function receiptFlow() {
  if (!navigator.onLine) return alert("Чекті оқуға интернет керек. Транзакцияны қолмен енгізе аласың.");
  // click() қолданушы басқан сәтте, await-сіз шақырылуы керек (iOS Safari әйтпесе файл таңдауын ашпайды)
  const input = h("input", { type: "file", accept: "image/*", hidden: true });
  document.body.append(input);
  input.addEventListener("change", async () => {
    const file = input.files[0]; input.remove();
    if (!file) return;
    if (!Sync.sb || !(await Sync.sb.auth.getSession()).data.session) return alert("Чекті оқу үшін алдымен Hub-қа кір, содан кейін осы бетті қайта аш.");
    const wait = h("dialog", {}, h("h3", {}, "Чекті оқып жатыр…"), h("p", { class: "muted" }, "Бұл біраз уақыт алуы мүмкін."));
    document.body.append(wait); wait.showModal();
    try {
      const { data, error } = await Sync.sb.functions.invoke("receipt", { body: { image: await shrink(file), today: today() } });
      if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message);
      if (!data?.receipt) throw new Error(data?.error || "Чек оқылмады.");
      wait.remove();
      receiptReview(data.receipt);
    } catch (e) { wait.remove(); alert(`${e.message}\nТранзакцияны қолмен енгізе аласың.`); }
  });
  input.addEventListener("cancel", () => input.remove());
  input.click();
}

const ICON_OPTS = [["box", "Қорап"], ["drop", "Сұйық"], ["bag", "Азық"], ["heart", "Күтім"], ["home", "Үй"]];
// pre берілсе (санпернеден) цикл ғана жасалады, item-ді сол санпернеден сақтау жалғасады; әйтпесе бастапқы item де қосылады
const addCycle = (pre, then) => ask("Жаңа тауар (цикл)", [
  { name: "name", label: "Тауар не қызмет" },
  { name: "icon", label: "Белгіше", options: ICON_OPTS, value: "box" },
  { name: "cat", label: "Санат", value: "Тұрмыс", suggest: catList() },
  { name: "unit", label: "Өлшем бірлігі", value: "дана" },
  { name: "price", label: "Бір реттік баға, ₸", type: "number", min: 0.01, value: pre?.price },
  { name: "every", label: "Бастапқы болжам: қанша күнге жетеді", type: "number", min: 1, step: 1 },
  { name: "buffer", label: "Неше күн бұрын ескерту", type: "number", value: 3, step: 1 },
  { name: "alert", label: "Ескерту", options: [["1", "Қосулы"], ["0", "Өшірулі"]], value: "1" },
  ...(pre ? [] : [{ name: "last", label: "Соңғы сатып алған күні", type: "date", value: today() }]),
], (v) => {
  const c = { id: crypto.randomUUID(), name: v.name.trim(), icon: v.icon, price: num(v.price), unit: v.unit.trim() || "дана", every: num(v.every), buffer: num(v.buffer), cat: FS.normCat(v.cat), last: v.last || today(), status: "active", alert: v.alert === "1" };
  put("cycles", c);
  if (!pre) put("items", { id: FS.itemIdOf(c.id), cycleId: c.id, name: c.name, cost: c.price, amount: 1, store: "", discount: false, note: "", time: c.last, city: S.settings.city });
  save(); then?.(c);
});

const addGoal = () => ask("Жаңа мақсат", [
  { name: "name", label: "Мақсат" },
  { name: "target", label: "Керек сома, ₸", type: "number", min: 1 },
  { name: "months", label: "Неше айда", type: "number", min: 1, step: 1 },
  { name: "saved", label: "Қазір жиналған, ₸", type: "number", value: 0 },
], (v) => { put("goals", { id: crypto.randomUUID(), name: v.name.trim(), target: num(v.target), months: num(v.months), saved: num(v.saved), start: today() }); save(); });

const addStock = () => ask("Жаңа өнім", [
  { name: "name", label: "Атауы" },
  { name: "qty", label: "Қордағы саны", type: "number", value: 1 },
  { name: "unit", label: "Өлшем бірлігі", value: "дана" },
  { name: "price", label: "Бағасы, ₸", type: "number", value: 0 },
], (v) => { put("stock", { id: crypto.randomUUID(), name: v.name.trim(), qty: num(v.qty), unit: v.unit.trim(), price: num(v.price) }); save(); });

const addMatch = () => ask("Брендтерді салыстыру", [
  { name: "name", label: "Өнім (мыс: тіс пастасы)" },
  { name: "an", label: "1-бренд" }, { name: "ap", label: "1-бренд бағасы, ₸", type: "number", min: 0.01 }, { name: "ad", label: "1-бренд қанша күнге жетеді", type: "number", min: 1, step: 1 },
  { name: "bn", label: "2-бренд" }, { name: "bp", label: "2-бренд бағасы, ₸", type: "number", min: 0.01 }, { name: "bd", label: "2-бренд қанша күнге жетеді", type: "number", min: 1, step: 1 },
], (v) => { put("matches", { id: crypto.randomUUID(), name: v.name.trim(), brands: [{ name: v.an.trim(), price: num(v.ap), days: num(v.ad) }, { name: v.bn.trim(), price: num(v.bp), days: num(v.bd) }] }); save(); });

const buyAgain = (c) => openAdd({ kind: "expense", amount: String(c.price), cycleId: c.id, step: 3 });

/* ---------- бөлшектер ---------- */
function cycleRow(c, full) {
  const T = today(), left = FS.cycleDaysLeft(c, T), pct = FS.stockPct(c, T), low = c.alert !== false && left <= (c.buffer ?? 3), gone = c.status === "archived";
  const status = gone ? "Архивте" : left < 0 ? `${-left} күн кешікті` : `${left} күн қалды`;
  return h("div", { class: "row" + (gone ? " gone" : "") },
    h("span", { class: "cic" }, ic(c.icon || "box")),
    h("div", { class: "main" }, h("b", {}, c.name), h("small", { class: "num " + (low ? "warn" : "muted") }, `${status} · ${pct}% · ${tg(c.price)} · ${FS.perDay(c).toFixed(1)} ₸/күн`), !gone && bar(pct, low)),
    !gone && h("button", { onclick: () => buyAgain(c) }, ic("check"), "Сатып алынды"),
    h("button", { class: "ghost sm", "aria-label": `Тарих: ${c.name}`, onclick: () => cycleDetail(c) }, ic("eye")),
    full && del("cycles", c.id, c.name));
}

function goalRow(g, full) {
  const done = g.saved >= g.target, pct = Math.min(100, Math.round(g.saved / g.target * 100));
  return h("div", { class: "row" + (done ? " gold" : "") },
    h("div", { class: "main" }, h("b", {}, g.name),
      h("small", { class: "num muted" }, `${tg(g.saved)} / ${tg(g.target)} · ${pct}%`),
      h("small", { class: done ? "" : "muted" }, done ? "Мақсатқа жеттің. Құттықтаймыз" : `Осы айға жарна: ${tg(FS.goalMonthly(g, today()))}`),
      bar(pct)),
    !done && h("button", { onclick: () => ask("Мақсатқа аудару", [{ name: "amount", label: "Сома, ₸", type: "number", min: 0.01 }, ...accField()], (v) => { put("contribs", withAcc({ id: crypto.randomUUID(), goalId: g.id, amount: num(v.amount), date: today() }, v)); save(); }) }, ic("plus"), "Жарна"),
    full && del("goals", g.id, g.name));
}

function donut(m) {
  const list = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
  const top = list.slice(0, 5), rest = list.slice(5).reduce((t, [, v]) => t + v, 0);
  if (rest) top.push(["Басқа", rest]);
  if (!m.expense) return empty("Осы айда шығын жоқ.");
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 42 42"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Шығындар санат бойынша");
  let off = 0;
  top.forEach(([, v], i) => {
    const p = v / m.expense * 100, c = document.createElementNS(NS, "circle");
    for (const [k, x] of Object.entries({ cx: 21, cy: 21, r: 15.9155, fill: "none", "stroke-width": 6, "stroke-dasharray": `${p} ${100 - p}`, "stroke-dashoffset": -off })) c.setAttribute(k, x);
    c.style.stroke = COLORS[i]; svg.append(c); off += p;
  });
  return h("div", { class: "donut" }, svg, h("ul", { class: "legend num" }, top.map(([k, v], i) =>
    h("li", {}, h("i", { style: `background:${COLORS[i]}` }), h("span", {}, k), h("span", {}, `${tg(v)} · ${Math.round(v / m.expense * 100)}%`)))));
}

/* ---------- беттер ---------- */
function home() {
  const T = today(), m = FS.monthTotals(S.tx, T), hide = S.settings.hide, mon = (n) => hide ? "*** ₸" : tg(n);
  const cycles = liveCycles().sort((a, b) => FS.cycleDaysLeft(a, T) - FS.cycleDaysLeft(b, T)).slice(0, 3);
  const gv = FS.goalsView(S), goals = gv.slice(0, 2), inGoals = gv.reduce((t, g) => t + g.saved, 0);
  const all = S.tx.slice().sort((a, b) => b.date.localeCompare(a.date)), recent = allTx ? all : all.slice(0, 5);
  return [
    head("FinSaulyq"),
    h("section", { class: "sec" },
      h("header", {}, h("span", { class: "muted" }, "Қолжетімді қалдық"),
        h("button", { class: "ghost sm", "aria-label": hide ? "Балансты көрсету" : "Балансты жасыру", onclick: () => { S.settings.hide = !hide; save(); } }, ic(hide ? "eye-off" : "eye"))),
      h("div", { class: "big num" }, mon(FS.balance(S))),
      h("div", { class: "split num" }, h("span", { class: "good" }, `Кіріс ${mon(m.income)}`), h("span", { class: "warn" }, `Шығын ${mon(m.expense)}`)),
      h("div", { class: "muted num" }, `Мақсаттарда: ${mon(inGoals)} · Барлығы: ${mon(FS.balance(S) + inGoals)}`),
    ),
    sec("Циклдер", null, cycles.length ? cycles.map((c) => cycleRow(c)) : empty("Цикл жоқ. «Қор» бөлімінде қос.")),
    sec("Мақсаттар", null, goals.length ? goals.map((g) => goalRow(g)) : empty("Мақсат жоқ. «Жоспар» бөлімінде қос.")),
    sec("Шығындар бөлінісі", null, donut(m)),
    sec(allTx ? "Барлық жазбалар" : "Соңғы жазбалар", all.length > 5 ? h("button", { class: "ghost", onclick: () => { allTx = !allTx; render(); } }, allTx ? "Жасыру" : "Барлығы") : null, recent.length ? recent.map((t) => h("div", { class: "row" },
      h("div", { class: "main" }, h("b", {}, t.category), h("small", { class: "muted" }, [t.note, t.date].filter(Boolean).join(" · "))),
      h("span", { class: "num " + (t.kind === "income" ? "good" : "") }, `${t.kind === "income" ? "+" : "−"}${tg(t.amount)}`),
      h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${t.category} ${tg(t.amount)}`, onclick: () => txForm(t) }, ic("edit")),
      del("tx", t.id, `${t.category} ${tg(t.amount)}`))) : empty("Әзірге жазба жоқ.")),
  ];
}

function plan() {
  const T = today(), next = liveCycles().sort((a, b) => FS.nextBuy(a).localeCompare(FS.nextBuy(b))), f = FS.forecast(S, T, 3);
  return [
    head("Жоспар"),
    sec("Мақсаттар", add(addGoal), S.goals.length ? FS.goalsView(S).map((g) => goalRow(g, true)) : empty("Мақсат жоқ.")),
    sec("Келесі сатып алулар", null, next.length ? next.map((c) => h("div", { class: "row" },
      h("div", { class: "main" }, h("b", {}, c.name), h("small", { class: "muted num" }, FS.nextBuy(c) < T ? "Мерзімі өтті" : FS.nextBuy(c))),
      h("span", { class: "num" }, tg(c.price)))) : empty("Цикл жоқ.")),
    sec("Алдағы 3 айдың болжамы", null,
      h("table", { class: "num" }, h("thead", {}, h("tr", {}, ["Ай", "Циклдер", "Мақсат", "Барлығы"].map((t) => h("th", {}, t)))),
        h("tbody", {}, f.map((r) => h("tr", {}, h("td", {}, MONTHS[Number(r.month.slice(5)) - 1]), h("td", {}, fmt(r.cycles)), h("td", {}, fmt(r.goals)), h("td", {}, h("b", {}, fmt(r.total))))))),
      h("p", { class: "muted" }, `Барлығы ішінде тұрақты шығын бар: ${tg(S.settings.fixed)} / ай. Айлық кіріс: ${tg(S.settings.income)}.`)),
  ];
}

function stock() {
  const matchCard = (m) => {
    const r = FS.brandMatch(m.brands);
    return h("div", { class: "row", style: "align-items:flex-start" }, h("div", { class: "main" }, h("b", {}, m.name),
      h("table", { class: "num" }, h("thead", {}, h("tr", {}, ["Бренд", "Баға", "Күн", "₸/күн"].map((t) => h("th", {}, t)))),
        h("tbody", {}, r.rows.map((x, i) => h("tr", { class: i === r.best ? "best" : "" }, h("td", {}, i === r.best ? `${x.name} · үздік` : x.name), h("td", {}, fmt(x.price)), h("td", {}, x.days), h("td", {}, x.perDay.toFixed(1)))))),
      h("small", { class: "good" }, `Үздігін таңдасаң, жылына ${tg(r.yearSaving)} үнем`)), del("matches", m.id, m.name));
  };
  return [
    head("Қор"),
    sec("Циклдер", add(() => addCycle()), liveCycles().length ? liveCycles().map((c) => cycleRow(c, true)) : empty("Цикл жоқ. Мысалы: тіс пастасы, 45 күн.")),
    S.cycles.some((c) => c.status === "archived") ? sec("Архив", null, S.cycles.filter((c) => c.status === "archived").map((c) => cycleRow(c, true))) : null,
    sec("Өнімдер қоры", add(addStock), S.stock.length ? S.stock.map((s) => h("div", { class: "row" },
      h("div", { class: "main" }, h("b", {}, s.name), h("small", { class: "muted num" }, `${fmt(s.qty)} ${s.unit} · ${tg(s.price)}`)),
      h("button", { class: "sm", "aria-label": "Азайту", onclick: () => { s.qty = Math.max(0, s.qty - 1); put("stock", s); save(); } }, ic("minus")),
      h("button", { class: "sm", "aria-label": "Көбейту", onclick: () => { s.qty += 1; put("stock", s); save(); } }, ic("plus")),
      del("stock", s.id, s.name))) : empty("Қор бос.")),
    sec("Смарт-салыстыру", add(addMatch), S.matches.length ? S.matches.map(matchCard) : empty("Екі брендті қатар қойып, ₸/күн бойынша үздігін тап.")),
  ];
}

function walletPage() {
  const w = FS.wallet(S), hide = S.settings.hide, mon = (n) => hide ? "*** ₸" : tg(n);
  const total = FS.balance(S);
  const pocket = (name, balance, extra) => h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, name), h("small", { class: "muted" }, balance < 0 ? "Қалдық теріс" : " ")), h("span", { class: "num " + (balance < 0 ? "warn" : "") }, mon(balance)), extra);
  const pockets = [{ id: "", name: "Шотсыз" }, ...S.accounts];
  const trForm = () => {
    const opts = [...S.accounts.map((a) => [a.id, a.name]), ...(w.loose !== null ? [["", "Шотсыз"]] : [])];
    if (opts.length < 2) return alert("Аударым үшін кемінде екі шот керек.");
    ask("Шоттар арасындағы аударым", [
      { name: "from", label: "Қайдан", options: opts, value: opts[0][0] }, { name: "to", label: "Қайда", options: opts, value: opts[1][0] },
      { name: "amount", label: "Сома, ₸", type: "number", min: 0.01 }, { name: "date", label: "Күні", type: "date", value: today() },
    ], (v) => { if (v.from === v.to) return alert("Қайдан және қайда бірдей болмауы керек."); put("transfers", { id: crypto.randomUUID(), from: v.from, to: v.to, amount: num(v.amount), date: v.date }); save(); });
  };
  const delAcc = (a) => { if (!confirm(`«${a.name}» шотын өшіру ме? Жазбалар «Шотсыз» қалтаға өтеді, осы шоттың аударымдары өшеді.`)) return;
    for (const k of ["tx", "contribs"]) S[k].filter((x) => x.account === a.id).forEach((x) => { delete x.account; put(k, x); });
    S.transfers.filter((t) => t.from === a.id || t.to === a.id).forEach((t) => rm("transfers", t.id));
    rm("accounts", a.id); save(); };
  return [
    head("Әмиян"),
    h("section", { class: "sec" }, h("header", {}, h("span", { class: "muted" }, "Барлық қаражат"), h("button", { class: "ghost sm", "aria-label": hide ? "Балансты көрсету" : "Балансты жасыру", onclick: () => { S.settings.hide = !hide; save(); } }, ic(hide ? "eye-off" : "eye"))),
      h("div", { class: "big num" }, mon(total)), h("small", { class: "muted" }, "Мақсаттарға аударылған сома кірмейді")),
    sec("Шоттар", add(() => ask("Жаңа шот", [{ name: "name", label: "Атауы (қолма-қол, карта…)" }, { name: "opening", label: "Қазіргі қалдық, ₸", type: "number", min: -1e12, value: 0 }],
      (v) => { put("accounts", { id: crypto.randomUUID(), name: v.name.trim(), opening: num(v.opening) }); save(); })),
      S.accounts.length ? w.accounts.map((a) => pocket(a.name, a.balance, del2(a))) : empty("Шот жоқ. Қолма-қол, карта сияқты шоттарды қос: әр транзакция шотқа байланады."),
      w.loose !== null && S.accounts.length ? pocket("Шотсыз", w.loose) : null),
    S.accounts.length ? h("div", { class: "end", style: "margin-top:0" }, h("button", { onclick: trForm }, ic("swap"), "Аударым")) : null,
    S.transfers.length ? sec("Аударымдар", null, [...S.transfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((t) => {
      const nm = (id) => S.accounts.find((a) => a.id === id)?.name ?? "Шотсыз";
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, `${nm(t.from)} → ${nm(t.to)}`), h("small", { class: "muted" }, t.date)), h("span", { class: "num" }, tg(t.amount)), del("transfers", t.id, `${nm(t.from)} → ${nm(t.to)}`));
    })) : null,
  ];
  function del2(a) { return h("button", { class: "ghost sm", "aria-label": `Өшіру: ${a.name}`, onclick: () => delAcc(a) }, ic("trash")); }
}

/* ---------- санпернелі енгізу: 1) сома 2) санат не тауар 3) егжей-тегжей ---------- */
const grp = (s) => { const [a, b] = String(s || "0").split("."); return a.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (b !== undefined ? "." + b : ""); };
const topCats = (kind) => {
  const m = {}; for (const t of S.tx) if (t.kind === kind) m[FS.normCat(t.category)] = (m[FS.normCat(t.category)] || 0) + 1;
  return [...new Set([...Object.keys(m), ...(kind === "income" ? ["Жалақы"] : CATS.filter((c) => c !== "Жалақы"))])].sort((a, b) => (m[b] || 0) - (m[a] || 0));
};
const sel = (name, opts, val) => h("select", { name }, opts.map(([v, t]) => h("option", { value: v, selected: v === val }, t)));
const fld = (label, input) => h("label", {}, label, input);
const KINDS = [["expense", "Шығыс"], ["income", "Кіріс"], ["transfer", "Аударым"]];

function openAdd(init = {}) {
  const st = { kind: "expense", amount: "", step: 1, cat: "", cycleId: "", ...init };
  const dlg = h("dialog", { class: "sheet" });
  const draw = () => dlg.replaceChildren(...[view1, view2, view3][st.step - 1]());
  const key = (k) => {
    const a = st.amount;
    if (k === "back") st.amount = a.slice(0, -1);
    else if (k === ".") { if (!a.includes(".")) st.amount = (a || "0") + "."; }
    else if (/^\d$/.test(k) && (a.includes(".") ? a.split(".")[1].length < 2 : a.length < 9) && !(a === "0")) st.amount = a + k;
    else if (k === "0" && a === "") st.amount = "0";
    else if (/^\d$/.test(k) && a === "0") st.amount = k;
    draw();
  };
  const ok = () => num(st.amount) > 0;
  const next = () => { if (ok()) { st.step = 2; draw(); } };
  const tabs = () => h("div", { class: "seg" },
    ...KINDS.map(([k, t]) => h("button", { type: "button", "aria-pressed": String(st.kind === k), onclick: () => { st.kind = k; st.cycleId = ""; draw(); } }, t)),
    h("button", { type: "button", class: "ghost sm", "aria-label": "Чек сканерлеу", onclick: () => { dlg.close(); receiptFlow(); } }, ic("camera")),
    h("button", { type: "button", class: "ghost sm", "aria-label": "Тауар енгізу", onclick: () => { st.kind = "expense"; if (ok()) { st.step = 2; } draw(); } }, ic("box")));
  const view1 = () => [tabs(),
    h("div", { class: "amt num", "aria-live": "polite" }, grp(st.amount) + " ₸"),
    h("div", { class: "pad" }, ...["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) =>
      h("button", { type: "button", "aria-label": k === "back" ? "Өшіру" : k === "." ? "Нүкте" : k, onclick: () => key(k) }, k === "back" ? ic("back") : k))),
    h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary", disabled: !ok(), onclick: next }, "Келесі"))];
  const pick = (patch) => { Object.assign(st, patch, { step: 3 }); draw(); };
  const view2 = () => {
    const back = h("button", { type: "button", class: "ghost", onclick: () => { st.step = 1; draw(); } }, "Артқа");
    if (st.kind === "transfer") {
      const w = FS.wallet(S), opts = [...S.accounts.map((a) => [a.id, a.name]), ...(w.loose !== null ? [["", "Шотсыз"]] : [])];
      if (opts.length < 2) return [h("h3", {}, "Аударым"), h("p", { class: "muted" }, "Аударым үшін кемінде екі шот керек. Шотты «Әмиян» бөлімінде қос."), h("div", { class: "end" }, back)];
      const f = h("form", { onsubmit: (e) => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        if (v.from === v.to) return alert("Қайдан және қайда бірдей болмауы керек.");
        put("transfers", { id: crypto.randomUUID(), from: v.from, to: v.to, amount: num(st.amount), date: v.date }); save(); dlg.close();
      } }, fld("Қайдан", sel("from", opts, opts[0][0])), fld("Қайда", sel("to", opts, opts[1][0])), fld("Күні", h("input", { type: "date", name: "date", value: today(), required: true })),
      h("div", { class: "end" }, back, h("button", { class: "primary" }, "Сақтау")));
      return [h("h3", {}, `Аударым · ${tg(num(st.amount))}`), f];
    }
    const inc = st.kind === "income", chip = (label, fn, icon) => h("button", { type: "button", class: "chipb", onclick: fn }, icon && ic(icon), label);
    const own = h("input", { placeholder: "Өз санатың", "aria-label": "Өз санатың", list: "dl-own", autocomplete: "off" });
    const ownGo = () => own.value.trim() && pick({ cat: FS.normCat(own.value), cycleId: "" });
    own.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ownGo(); } });
    return [h("h3", {}, `${inc ? "Кіріс" : "Шығыс"} · ${tg(num(st.amount))}`),
      h("p", { class: "muted" }, inc ? "Қайдан түсті?" : "Не үшін жұмсадың?"),
      h("div", { class: "chips" }, topCats(st.kind).map((c) => chip(c, () => pick({ cat: c, cycleId: "" })))),
      !inc && liveCycles().length ? h("p", { class: "muted" }, "Циклді тауарлар") : null,
      !inc && h("div", { class: "chips" }, liveCycles().map((c) => chip(c.name, () => pick({ cycleId: c.id }), c.icon || "box")),
        chip("Жаңа тауар", () => addCycle({ price: num(st.amount) }, (c) => pick({ cycleId: c.id })), "plus")),
      h("datalist", { id: "dl-own" }, catList().map((v) => h("option", { value: v }))),
      h("div", { class: "own" }, own, h("button", { type: "button", onclick: ownGo }, "Таңдау")),
      h("div", { class: "end" }, back)];
  };
  const view3 = () => {
    const c = S.cycles.find((x) => x.id === st.cycleId), cat = c ? FS.normCat(c.cat || "Тұрмыс") : st.cat, inc = st.kind === "income";
    const f = h("form", { onsubmit: (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(f)), note = v.note.trim(), store = v.store.trim();
      const tx = withAcc({ id: crypto.randomUUID(), kind: st.kind, amount: num(st.amount), category: cat, note: c ? [c.name, note].filter(Boolean).join(" · ") : note, date: v.date, ...(store ? { store } : {}) }, v);
      put("tx", tx);
      if (c) recordItem(c, { cost: tx.amount, qty: num(v.qty) || 1, store, discount: v.discount === "1", note, date: v.date, txId: tx.id });
      save(); dlg.close();
    } },
      ...accField().map((a) => fld(a.label, sel("account", a.options, a.value))),
      fld("Дүкен", h("input", { name: "store", list: "dl-store", autocomplete: "off" })), h("datalist", { id: "dl-store" }, stores().map((v) => h("option", { value: v }))),
      c && fld(`Саны, ${c.unit || "дана"}`, h("input", { name: "qty", type: "number", min: 0.01, step: "any", value: 1, inputmode: "decimal" })),
      c && fld("Жеңілдікпен алдың ба?", sel("discount", [["0", "Жоқ"], ["1", "Иә"]], "0")),
      fld(c ? "Баға/пікір" : "Ескертпе", h("input", { name: "note" })),
      fld("Күні", h("input", { type: "date", name: "date", value: today(), required: true })),
      h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => { st.step = 2; draw(); } }, "Артқа"), h("button", { class: "primary" }, "Сақтау")));
    return [h("h3", {}, `${inc ? "+" : "−"}${tg(num(st.amount))} · ${c ? c.name : cat}`), h("p", { class: "muted" }, "Төмендегілер міндетті емес."), f];
  };
  dlg.addEventListener("keydown", (e) => {
    if (st.step !== 1 || e.target.closest?.("input,select,textarea") || e.ctrlKey || e.metaKey) return;
    if (/^[0-9.]$/.test(e.key)) key(e.key); else if (e.key === "Backspace") key("back"); else if (e.key === "Enter" && ok()) { e.preventDefault(); next(); }
  });
  dlg.addEventListener("close", () => dlg.remove());
  document.querySelectorAll("dialog.sheet").forEach((d) => d.remove());
  document.body.append(dlg); draw(); dlg.showModal();
}

// Циклдің тарихы: сатып алулар, цикл-күн, ₸/күн, архив, ескерту
function cycleDetail(c) {
  const its = S.items.filter((i) => i.cycleId === c.id).sort((a, b) => b.time.localeCompare(a.time)), gone = c.status === "archived";
  const dlg = h("dialog", {}), again = () => { dlg.close(); cycleDetail(c); };
  const hist = its.length ? its.map((i, k) => { const gap = k ? FS.daysBetween(i.time, its[k - 1].time) : 0;
    return h("div", { class: "row" }, h("div", { class: "main" }, h("b", { class: "num" }, `${i.time} · ${tg(i.cost)}`),
      h("small", { class: "muted" }, [i.store, i.discount && "жеңілдікпен", gap > 0 && `${(i.cost / gap).toFixed(1)} ₸/күн`, i.city].filter(Boolean).join(" · ") || " ")),
      h("button", { class: "ghost sm", "aria-label": `Өшіру: ${i.time}`, onclick: () => { if (!confirm("Бұл сатып алуды тарихтан өшіру ме? Транзакция қалады.")) return; dropItems([i]); save(); again(); } }, ic("trash"))); }) : empty("Тарих жоқ.");
  dlg.append(h("h3", {}, c.name),
    h("p", { class: "num muted" }, `Цикл-күн: ${c.every} · Баға: ${tg(c.price)} · ${FS.perDay(c).toFixed(1)} ₸/күн`), ...hist,
    h("div", { class: "end" },
      h("button", { onclick: () => { c.alert = c.alert === false; put("cycles", c); save(); again(); } }, `Ескерту: ${c.alert === false ? "өшірулі" : "қосулы"}`),
      h("button", { onclick: () => { c.status = gone ? "active" : "archived"; put("cycles", c); save(); dlg.close(); } }, gone ? "Архивтен қайтару" : "Архивке"),
      !gone && h("button", { class: "primary", onclick: () => { dlg.close(); buyAgain(c); } }, "Сатып алынды"),
      h("button", { class: "ghost", onclick: () => dlg.close() }, "Жабу")));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

// Чек позициялары: циклге не санатқа өздігінен бөлінеді, пайдаланушы тексеріп «Растау» басады
function receiptReview(r) {
  const pos = [...(r.items || [])], sum = pos.reduce((t, p) => t + p.price, 0);
  if (!pos.length || sum > r.total + 1) return txForm(null, { kind: "expense", amount: r.total, category: r.category, note: r.store, store: r.store, date: r.date }); // позиция оқылмады — жалпы сома
  if (r.total - sum > 1) pos.push({ name: "Танылмаған қалдық", price: Math.round((r.total - sum) * 100) / 100, category: "Басқа" });
  const { rows } = FS.groupReceipt(pos, S.cycles, r.category), cats = [...new Set([...catList(), ...rows.map((x) => x.category)])];
  const opts = [...cats.map((c) => ["k:" + c, c]), ...liveCycles().map((c) => ["c:" + c.id, "Цикл: " + c.name])];
  const f = h("form", { method: "dialog", onsubmit: (e) => {
    e.preventDefault(); const v = new FormData(f), rid = crypto.randomUUID(), store = v.get("store").trim(), date = v.get("date"), txs = {}, cyc = [];
    rows.forEach((x, i) => {
      const [t, id] = [v.get("r" + i).slice(0, 1), v.get("r" + i).slice(2)], c = t === "c" ? S.cycles.find((y) => y.id === id) : null, cat = c ? FS.normCat(c.cat || "Тұрмыс") : id;
      txs[cat] = Math.round(((txs[cat] || 0) + x.price) * 100) / 100;
      if (c) cyc.push([c, x.price, cat]);
    });
    const ids = Object.fromEntries(Object.keys(txs).map((k) => [k, crypto.randomUUID()]));
    for (const [cat, amount] of Object.entries(txs)) put("tx", withAcc({ id: ids[cat], kind: "expense", amount, category: cat, note: store || "Чек", date, ...(store ? { store } : {}) }, { account: v.get("account") }));
    for (const [c, cost, cat] of cyc) recordItem(c, { cost, qty: 1, store, date, txId: ids[cat], receipt: rid });
    save(); dlg.close();
  } }, h("h3", {}, `Чек · ${tg(r.total)}`), h("p", { class: "muted" }, "Позициялар өздігінен бөлінді. Қате болса, санатын өзгерт."),
    ...rows.map((x, i) => h("label", {}, `${x.name} · ${tg(x.price)}`, sel("r" + i, opts, x.cycleId ? "c:" + x.cycleId : "k:" + x.category))),
    fld("Дүкен", h("input", { name: "store", value: r.store })), fld("Күні", h("input", { type: "date", name: "date", value: r.date, required: true })),
    ...accField().map((a) => fld(a.label, sel("account", a.options, a.value))),
    h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary" }, "Растау")));
  const dlg = h("dialog", {}, f); dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

const valid = (x) => {
  const n = Number.isFinite, s = (v) => typeof v === "string", a = (k, f) => Array.isArray(x[k] ?? []) && (x[k] ?? []).every((i) => i && s(i.id) && f(i));
  return x && typeof x === "object" && (!x.settings || [x.settings.capital, x.settings.income, x.settings.fixed].every((v) => v == null || n(v))) &&
    a("tx", (t) => s(t.date) && n(t.amount) && s(t.category) && (t.kind === "income" || t.kind === "expense")) &&
    a("cycles", (c) => s(c.last) && n(c.every) && c.every > 0 && n(c.price)) &&
    a("items", (i) => s(i.cycleId) && n(i.cost) && s(i.time)) &&
    a("goals", (g) => s(g.start) && n(g.target) && n(g.saved) && n(g.months)) &&
    a("stock", (i) => n(i.qty)) &&
    a("matches", (m) => Array.isArray(m.brands) && m.brands.length > 1 && m.brands.every((b) => n(b.price) && n(b.days) && b.days > 0)) &&
    a("contribs", (c) => n(c.amount) && s(c.goalId)) &&
    a("accounts", (c) => s(c.name) && n(c.opening)) &&
    a("transfers", (t) => n(t.amount) && t.amount > 0 && s(t.from) && s(t.to));
};

const CLOUD = { local: "Бұлт өшік: Hub-қа кіріп, осы бетті қайта аш", ok: "Бұлтпен синхрондалды", wait: "Бұлтқа жіберуге күтіп тұр", err: "Бұлт қатесі" };

function settings() {
  const st = S.settings, file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    try {
      const x = JSON.parse(await file.files[0].text());
      if (!valid(x)) throw new Error("пішім қате");
      if (!confirm("Файлдағы жазбалар қазіргілерге қосылады (id бірдей болса, жаңартылады). Жалғастыру ма?")) return;
      for (const k of LISTS) for (const e of x[k] ?? []) put(k, k === "tx" ? { ...e, category: FS.normCat(e.category) } : e);
      if (x.settings) { Object.assign(S.settings, { capital: Number(x.settings.capital) || 0, income: Number(x.settings.income) || 0, fixed: Number(x.settings.fixed) || 0 }); put("settings"); }
      save();
    } catch { alert("Файл оқылмады: FinSaulyq көшірмесі емес немесе бүлінген."); }
  });
  const exportJson = () => {
    const out = Object.fromEntries(["settings", ...LISTS].map((k) => [k, S[k]]));
    const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" })), download: `finsaulyq-${today()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  // «ok» ескіруі мүмкін: кейін жазба қосылса не желі жоқ болса, кезекте күтіп тұр. Кіргенбіз, бірақ желі жоқ — «local» емес
  const state = (Sync.state === "local" && S.synced) || (Sync.state === "ok" && S.pending.length) ? "wait" : Sync.state;
  const cloud = CLOUD[state] + (state === "wait" ? `: ${S.pending.length}` : "") + (state === "err" ? `: ${Sync.error}` : "");
  return [
    head("Баптаулар"),
    sec("Қаржылық параметрлер", h("button", { class: "ghost", onclick: () => ask("Қаржылық параметрлер", [
      { name: "capital", label: "Бастапқы капитал, ₸", type: "number", min: -1e12, value: st.capital },
      { name: "income", label: "Айлық тұрақты кіріс, ₸", type: "number", value: st.income },
      { name: "fixed", label: "Айлық тұрақты шығын, ₸", type: "number", value: st.fixed },
    ], (v) => { Object.assign(S.settings, { capital: num(v.capital), income: num(v.income), fixed: num(v.fixed) }); put("settings"); save(); }) }, "Өзгерту"),
    h("div", { class: "row" }, h("span", {}, "Бастапқы капитал"), h("span", { class: "num" }, tg(st.capital))),
    h("div", { class: "row" }, h("span", {}, "Айлық кіріс"), h("span", { class: "num" }, tg(st.income))),
    h("div", { class: "row" }, h("span", {}, "Айлық тұрақты шығын"), h("span", { class: "num" }, tg(st.fixed)))),
    sec("Қала және енгізу", h("button", { class: "ghost", onclick: () => ask("Қала", [{ name: "city", label: "Қала (тауар жазбаларына жазылады)", value: st.city }], (v) => { S.settings.city = v.city.trim() || "Астана"; put("settings"); save(); }) }, "Өзгерту"),
      h("div", { class: "row" }, h("span", {}, "Қала"), h("span", {}, st.city)),
      h("div", { class: "row" }, h("span", {}, "Ашылғанда санперне"), h("button", { onclick: () => { S.settings.pad = st.pad === false; save(); } }, st.pad === false ? "Өшірулі" : "Қосулы"))),
    sec("Бұлт", null, h("p", { class: "muted" }, cloud),
      h("div", { class: "end", style: "margin-top:0;justify-content:flex-start" }, state === "local" ? h("a", { class: "btn", href: "../" }, "Hub-қа кіру") : h("button", { onclick: () => Sync.now() }, "Қазір синхрондау"))),
    sec("Көшірме", null, h("p", { class: "muted" }, "Қосымша интернетсіз де жұмыс істейді: өзгерістер құрылғыда сақталып, желі мен кіру болғанда бұлтқа жіберіледі. Көшірмені файлға жүктеп қоюға да болады."),
      h("div", { class: "end", style: "margin-top:0;justify-content:flex-start" }, h("button", { onclick: exportJson }, "Көшірме жүктеу"), h("button", { onclick: () => file.click() }, "Қосу файлдан"), file)),
    sec("Байланыс", null, h("span", { class: "chip" }, navigator.onLine ? "Желіде" : "Офлайн режим")),
  ];
}

const PAGES = { home, plan, stock, wallet: walletPage, set: settings };
const NAV = [["home", "Басты бет", "home"], ["plan", "Жоспар", "target"], ["+"], ["stock", "Қор", "box"], ["wallet", "Әмиян", "wallet"]];

function render() {
  document.getElementById("view").replaceChildren(...PAGES[tab]());
  document.getElementById("nav").replaceChildren(...NAV.map(([id, label, icon]) => id === "+"
    ? h("button", { class: "plus primary", "aria-label": "Қосу", onclick: () => openAdd() }, ic("plus"))
    : h("button", { "aria-current": id === tab ? "page" : null, onclick: () => go(id) }, ic(icon), label)));
}
addEventListener("online", render);
addEventListener("offline", render);
render();
Sync.start();
if (S.settings.pad !== false) openAdd(); // қолданба ашылғанда санпернеден бастаймыз
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
