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

  const api = { dayKey, daysAgo, summarize, fmtDur, remaining };
  if (typeof module !== 'undefined') module.exports = api; else g.KS = api;
})(globalThis);
