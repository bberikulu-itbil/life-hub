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

// Мақсат: { target, saved, months, start } → осы айға керек жарна
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
  const goals = S.goals.reduce((t, g) => t + (g.saved >= g.target ? 0 : goalMonthly(g, today)), 0);
  return Array.from({ length: count }, (_, i) => {
    const from = Math.max(Date.UTC(y, m - 1 + i, 1) / MS, dnum(today)), to = Date.UTC(y, m + i, 0) / MS;
    const cycles = S.cycles.reduce((t, c) => t + c.price * buysIn(c, from, to, today), 0);
    const fixed = S.settings.fixed;
    return { month: dstr(Date.UTC(y, m - 1 + i, 1) / MS).slice(0, 7), fixed, cycles, goals, total: fixed + cycles + goals };
  });
}

// Осы айдың кірісі, шығыны және санат бойынша шығын
function monthTotals(tx, today) {
  const month = today.slice(0, 7), out = { income: 0, expense: 0, byCat: {} };
  for (const t of tx) {
    if (t.date.slice(0, 7) !== month) continue;
    out[t.kind] += t.amount;
    if (t.kind === "expense") out.byCat[t.category] = (out.byCat[t.category] || 0) + t.amount;
  }
  return out;
}

const balance = (S) => S.settings.capital + S.tx.reduce((t, x) => t + (x.kind === "income" ? x.amount : -x.amount), 0);

const FS = { addDays, daysBetween, cycleDaysLeft, stockPct, nextBuy, brandMatch, goalMonthly, forecast, monthTotals, balance };
if (typeof module !== "undefined") module.exports = FS;
