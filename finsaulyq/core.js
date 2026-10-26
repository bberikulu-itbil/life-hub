"use strict";
/* FinSaulyq есептеу ядросы: DOM-сыз, тестке ыңғайлы. Күндер — «YYYY-MM-DD» жолдары. */
const MS = 864e5;
const dnum = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / MS; };
const dstr = (n) => new Date(n * MS).toISOString().slice(0, 10);
const addDays = (s, n) => dstr(dnum(s) + n);
const daysBetween = (a, b) => dnum(b) - dnum(a);

// Цикл: { every: күн, last: соңғы сатып алу күні, price }
const cycleDaysLeft = (c, today) => c.every - daysBetween(c.last, today);
const stockPct = (c, today) => Math.max(0, Math.min(100, Math.round(cycleDaysLeft(c, today) / c.every * 100)));
const nextBuy = (c) => addDays(c.last, c.every);

// Бренд салыстыру: ₸/күн, үздігі және ең қымбатқа қарағандағы жылдық үнем
function brandMatch(brands) {
  const rows = brands.map((b) => ({ ...b, perDay: b.price / b.days }));
  const min = Math.min(...rows.map((r) => r.perDay));
  const max = Math.max(...rows.map((r) => r.perDay));
  return { rows, best: rows.findIndex((r) => r.perDay === min), yearSaving: Math.round((max - min) * 365) };
}

// Мақсат: { id, target, saved (бастапқы жинақ), months, start }; жарналар — { goalId, amount }
const goalSaved = (g, contribs = []) => g.saved + contribs.reduce((t, c) => t + (c.goalId === g.id ? c.amount : 0), 0);
const goalsView = (S) => S.goals.map((g) => ({ ...g, saved: goalSaved(g, S.contribs) }));

// → осы айға керек жарна (g.saved — жиналған толық сома, goalsView беретін)
function goalMonthly(g, today) {
  const [sy, sm] = g.start.split("-").map(Number), [ty, tm] = today.split("-").map(Number);
  const left = Math.max(1, g.months - ((ty - sy) * 12 + (tm - sm)));
  return Math.ceil(Math.max(0, g.target - g.saved) / left);
}

// [from, to] аралығындағы (күн нөмірлері) сатып алулар саны; мерзімі өтіп кеткені бүгін алынады
function buysIn(c, from, to, today) {
  let d = Math.max(dnum(nextBuy(c)), dnum(today)), n = 0;
  while (d <= to) { if (d >= from) n++; d += c.every; }
  return n;
}

// Алдағы айлардың болжамы: тұрақты шығын + циклдік тауарлар + мақсатты жарналар
function forecast(S, today, count = 3) {
  const [y, m] = today.split("-").map(Number);
  const goals = goalsView(S).reduce((t, g) => t + (g.saved >= g.target ? 0 : goalMonthly(g, today)), 0);
  return Array.from({ length: count }, (_, i) => {
    const from = Math.max(Date.UTC(y, m - 1 + i, 1) / MS, dnum(today)), to = Date.UTC(y, m + i, 0) / MS;
    const cycles = S.cycles.filter((c) => c.status !== "archived").reduce((t, c) => t + c.price * buysIn(c, from, to, today), 0);
    const fixed = S.settings.fixed;
    return { month: dstr(Date.UTC(y, m - 1 + i, 1) / MS).slice(0, 7), fixed, cycles, goals, total: fixed + cycles + goals };
  });
}

// «тамақ», «Тамақ », «ТАМАҚ» — бір санат
const normCat = (c) => { const t = String(c ?? "").trim(); return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : "Басқа"; };

// Осы айдың кірісі, шығыны және санат бойынша шығын
function monthTotals(tx, today) {
  const month = today.slice(0, 7), out = { income: 0, expense: 0, byCat: {} };
  for (const t of tx) {
    if (t.date.slice(0, 7) !== month) continue;
    out[t.kind] += t.amount;
    if (t.kind === "expense") { const k = normCat(t.category); out.byCat[k] = (out.byCat[k] || 0) + t.amount; }
  }
  return out;
}

// Қолжетімді қалдық: жарна мақсатқа аударылған ақша, сондықтан одан шығады
const signed = (x) => (x.kind === "income" ? x.amount : -x.amount);
const balance = (S) => S.settings.capital + (S.accounts || []).reduce((t, a) => t + a.opening, 0) + S.tx.reduce((t, x) => t + signed(x), 0) - (S.contribs || []).reduce((t, c) => t + c.amount, 0);

// Әмиян: шоттар бойынша қалдық. Шоты жоқ (ескі, ассистент жазған) жазбалар «шотсыз» қалтаға түседі ("" — сол қалта).
function wallet(S) {
  const ids = new Set((S.accounts || []).map((a) => a.id)), own = (id) => (ids.has(id) ? id : "");
  const sum = { "": S.settings.capital }; // шотсыз қалта капиталдан басталады
  for (const a of S.accounts || []) sum[a.id] = a.opening;
  for (const x of S.tx) sum[own(x.account)] += signed(x);
  for (const c of S.contribs || []) sum[own(c.account)] -= c.amount;
  for (const t of S.transfers || []) { sum[own(t.from)] -= t.amount; sum[own(t.to)] += t.amount; }
  const loose = S.tx.some((x) => !ids.has(x.account)) || (S.contribs || []).some((c) => !ids.has(c.account));
  return { accounts: (S.accounts || []).map((a) => ({ ...a, balance: sum[a.id] })), loose: loose || sum[""] !== 0 ? sum[""] : null };
}

// ---- Supabase `items` ↔ жергілікті күй ----
// tx — ассистентпен ортақ `money` (data: kind, amount, category, note, date); қалғаны — fs_* қолданбасына тән
const APP_OF = { tx: "money", cycles: "fs_cycle", items: "fs_item", goals: "fs_goal", stock: "fs_stock", matches: "fs_match", contribs: "fs_contrib", accounts: "fs_account", transfers: "fs_transfer", settings: "fs_settings" };
const KEY_OF = Object.fromEntries(Object.entries(APP_OF).map(([k, a]) => [a, k]));
const localDate = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Жолды жергілікті жазбаға айналдырады; жарамсыз болса — null (интерфейсті бұзбау үшін)
function fromRow(r) {
  const k = KEY_OF[r.app], d = r.data || {}, n = (v) => Number.isFinite(Number(v)) && v !== "" && v != null;
  if (!k) return null;
  if (k === "tx") return n(d.amount) && (d.kind === "income" || d.kind === "expense")
    ? { id: r.id, kind: d.kind, amount: Number(d.amount), category: normCat(d.category), note: String(d.note ?? ""), date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : localDate(r.created_at), ...(typeof d.account === "string" && d.account ? { account: d.account } : {}), ...(typeof d.store === "string" && d.store ? { store: d.store } : {}) } : null;
  if (k === "settings") return { key: "settings", item: { capital: Number(d.capital) || 0, income: Number(d.income) || 0, fixed: Number(d.fixed) || 0, city: typeof d.city === "string" && d.city.trim() ? d.city.trim() : "Астана" }, id: r.id };
  const ok = { cycles: n(d.price) && n(d.every) && d.every > 0 && typeof d.last === "string", goals: n(d.target) && n(d.saved) && n(d.months) && typeof d.start === "string",
    stock: n(d.qty), matches: Array.isArray(d.brands) && d.brands.length > 1, contribs: n(d.amount) && typeof d.goalId === "string",
    items: typeof d.cycleId === "string" && n(d.cost) && /^\d{4}-\d{2}-\d{2}$/.test(d.time),
    accounts: typeof d.name === "string" && n(d.opening), transfers: n(d.amount) && d.amount > 0 && typeof d.from === "string" && typeof d.to === "string" && d.from !== d.to }[k];
  return ok ? { id: r.id, ...d } : null;
}
const toRow = (k, e, settingsId) => {
  if (k === "settings") return { id: settingsId, app: APP_OF[k], data: { capital: e.capital, income: e.income, fixed: e.fixed, city: e.city } };
  const { id, ...data } = e;
  return { id, app: APP_OF[k], data: k === "tx" ? { ...data, currency: "KZT" } : data };
};

// Серверден келген жолдар + әлі жіберілмеген өзгерістер → жаңа күй (сервер негіз, кезектегі өзгеріс үстінен жазылады)
function mergePull(S, rows) {
  const next = { tx: [], cycles: [], items: [], goals: [], stock: [], matches: [], contribs: [], accounts: [], transfers: [] }, pend = new Map((S.pending || []).map((p) => [p.k + ":" + p.id, p.op]));
  let settings = null, settingsId = null;
  for (const r of rows) {
    const e = fromRow(r);
    if (!e) continue;
    if (e.key === "settings") { settings = e.item; settingsId = e.id; continue; }
    if (pend.get(KEY_OF[r.app] + ":" + e.id) === "del") continue;
    next[KEY_OF[r.app]].push(e);
  }
  for (const p of S.pending || []) { // кезектегі жазбалар сервер нұсқасын ауыстырады
    if (p.op !== "put" || p.k === "settings") continue;
    const local = S[p.k].find((x) => x.id === p.id);
    if (!local) continue;
    const i = next[p.k].findIndex((x) => x.id === p.id);
    if (i >= 0) next[p.k][i] = local; else next[p.k].push(local);
  }
  next.accounts.reverse(); // жолдар жаңадан ескіге келеді, ал шоттар ашылған ретімен тұрады
  const pendingSettings = (S.pending || []).some((p) => p.k === "settings");
  return { ...next, settings: settings && !pendingSettings ? { ...S.settings, ...settings } : S.settings, settingsId: settingsId || S.settingsId };
}

// ---- Цикл + Item ----
// Item: { id, cycleId, name, cost, amount, store, discount, note, receipt, txId, time, city }
// Цикл-күн = сатып алулар арасындағы күндердің орташасы (бір сатып алу болса — алғашқы болжам сақталады)
function recalcCycle(c, items) {
  const its = items.filter((i) => i.cycleId === c.id).sort((a, b) => a.time.localeCompare(b.time));
  if (!its.length) return c;
  const gaps = its.slice(1).map((x, i) => daysBetween(its[i].time, x.time)).filter((g) => g > 0);
  c.last = its[its.length - 1].time; c.price = its[its.length - 1].cost;
  if (gaps.length) c.every = Math.max(1, Math.round(gaps.reduce((t, g) => t + g, 0) / gaps.length));
  return c;
}
const perDay = (c) => c.price / c.every; // баға тиімділігі, ₸/күн
// Ескі цикл (status жоқ) → бір бастапқы item; id цикл id-інен алынады, сондықтан екі құрылғыда да бірдей
const itemIdOf = (cid) => (cid[0] === "f" ? "e" : "f") + cid.slice(1);
function migrate(S) {
  let n = 0;
  for (const c of S.cycles) {
    if (c.status) continue;
    c.status = "active"; c.alert = true; n++;
    S.items.push({ id: itemIdOf(c.id), cycleId: c.id, name: c.name, cost: c.price, amount: 1, store: "", discount: false, note: "", time: c.last, city: S.settings.city });
  }
  return n;
}
const lc = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
function matchCycle(name, cycles) {
  const a = lc(name);
  if (a.length < 3) return null;
  return cycles.find((c) => c.status !== "archived" && (lc(c.name) === a || (lc(c.name).length >= 3 && (a.includes(lc(c.name)) || lc(c.name).includes(a))))) || null;
}
// Чек позициялары → цикл тауарлары мен санат бойынша жиындар
function groupReceipt(pos, cycles, fallbackCat = "Басқа") {
  const rows = pos.map((p) => { const c = matchCycle(p.name, cycles); return { ...p, cycleId: c?.id || "", category: normCat(c ? c.cat : p.category || fallbackCat) }; });
  const byCat = {};
  for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + r.price;
  return { rows, byCat };
}

const FS = { recalcCycle, perDay, migrate, itemIdOf, matchCycle, groupReceipt, addDays, daysBetween, cycleDaysLeft, stockPct, nextBuy, brandMatch, goalSaved, goalsView, goalMonthly, forecast, normCat, monthTotals, balance, wallet, APP_OF, fromRow, toRow, mergePull };
if (typeof module !== "undefined") module.exports = FS;
