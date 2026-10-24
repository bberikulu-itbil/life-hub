/* Оқу аналитикасының таза есептеулері (браузерсіз тексеруге болады). */
(function (g) {
  const pad = n => String(n).padStart(2, '0');
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const daysAgo = (now, n) => { const d = new Date(now); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n)); };

  // Күніне кемінде 1 минут оқыған күн «оқыған күн» саналады, серия бүгін немесе кеше басталады.
  function summarize(sessions, now = Date.now()) {
    const byDay = {}; let total = 0;
    for (const s of sessions) { byDay[s.day] = (byDay[s.day] || 0) + s.secs; total += s.secs; }
    const sum = n => { let t = 0; for (let i = 0; i < n; i++) t += byDay[daysAgo(now, i)] || 0; return t; };
    let streak = 0, i = (byDay[daysAgo(now, 0)] || 0) >= 60 ? 0 : 1;
    while ((byDay[daysAgo(now, i)] || 0) >= 60) { streak++; i++; }
    return { byDay, total, today: sum(1), week: sum(7), month: sum(30), avg30: sum(30) / 30, streak, best: Math.max(0, ...Object.values(byDay)), days: Object.keys(byDay).length };
  }

  const fmtDur = s => s < 60 ? `${Math.round(s)} сек` : s < 3600 ? `${Math.round(s / 60)} мин` : `${Math.floor(s / 3600)} сағ ${Math.round(s % 3600 / 60)} мин`;

  // Қазіргі қарқынмен кітапты аяқтауға қанша уақыт қалды; деректер аз болса null.
  const remaining = (secs, pct) => (pct < 3 || secs < 120) ? null : secs / pct * (100 - pct);

  // Кітапты мерзімге дейін аяқтау мақсаты. g = { by: 'YYYY-MM-DD', set: ts, p0: қойған кездегі % }.
  // Күнделікті қарқын (%, бет, минут) және жоспармен салыстыру күйін қайтарады.
  function goalPlan(g, pct, now = Date.now(), pages = 0, secsSoFar = 0) {
    if (pct >= 100) return { status: 'done', daysLeft: 0, pctPerDay: 0 };
    const end = new Date(g.by + 'T23:59:59').getTime(), dayMs = 864e5;
    const daysLeft = Math.ceil((end - now) / dayMs);
    if (daysLeft <= 0) return { status: 'late', daysLeft, pctPerDay: 100 - pct };
    const pctPerDay = (100 - pct) / daysLeft;
    const expected = g.p0 + (100 - g.p0) * Math.min(1, Math.max(0, (now - g.set) / Math.max(1, end - g.set)));
    const status = pct >= expected + 2 ? 'ahead' : pct >= expected - 3 ? 'on' : 'behind';
    return { status, daysLeft, pctPerDay, expected,
      pagesPerDay: pages ? pctPerDay / 100 * pages : null,
      minsPerDay: secsSoFar >= 120 && pct >= 3 ? secsSoFar / pct * pctPerDay / 60 : null };
  }

  const api = { dayKey, daysAgo, summarize, fmtDur, remaining, goalPlan };
  if (typeof module !== 'undefined') module.exports = api; else g.KS = api;
})(globalThis);
