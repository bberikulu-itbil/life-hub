/* Жылдам оқудың таза есептеулері: сөзге бөлу, ORP (көз тоқтайтын әріп), кідіріс, кезеңдер. */
(function (g) {
  const END = /[.!?…]["'»”)]*$/, MID = /[,;:–—]["'»”)]*$/;

  const tokenize = t => t.split(/\s+/).filter(Boolean);

  // Сөздегі ұстау әрпінің индексі: қысқа сөзде 2-әріп, ұзынында кейінірек.
  function orp(w) {
    const lead = w.match(/^[^\p{L}\p{N}]*/u)[0].length;
    const core = w.slice(lead).replace(/[^\p{L}\p{N}]+$/u, '').length || 1;
    const k = core <= 1 ? 0 : core <= 5 ? 1 : core <= 9 ? 2 : core <= 13 ? 3 : 4;
    return lead + Math.min(k, core - 1);
  }

  // i-ші сөзден бастап ең көбі per сөз, бірақ сөйлем соңында тоқтайды.
  function chunkAt(words, i, per) {
    if (i >= words.length) return null;
    const out = []; let j = i;
    while (j < words.length && out.length < per) { out.push(words[j++]); if (END.test(out[out.length - 1])) break; }
    return { words: out, end: j };
  }

  const PUNCT = [[1, 1], [1.8, 1.3], [2.6, 1.6]]; // тыныс белгі кідірісі: жоқ / қалыпты / ұзақ
  const opts = (punct, long) => ({ sent: PUNCT[punct]?.[0] ?? 1.8, comma: PUNCT[punct]?.[1] ?? 1.3, long: long !== false });

  function delayFor(ws, wpm, o = {}) {
    let ms = 60000 / wpm * ws.length;
    const last = ws[ws.length - 1];
    if (END.test(last)) ms *= o.sent ?? 1.8; else if (MID.test(last)) ms *= o.comma ?? 1.3;
    if (o.long !== false && ws.some(w => w.length >= 11)) ms *= 1.25;
    return ms;
  }

  const rampWpm = (from, to, p) => from + (to - from) * Math.max(0, Math.min(1, p));

  // Қарқын жеке бастапқы өлшемге (baseline) қатысты есептеледі.
  function stagesFor(B) {
    const r = x => Math.round(B * x / 10) * 10;
    return [
      { id: 1, title: 'Жылыну', desc: 'Бір сөз, қарқын баяу өседі', mode: 'rsvp', per: 1, from: r(1.0), to: r(1.3), mins: 2 },
      { id: 2, title: 'Қарқын', desc: 'Бір сөз, қарқын айқын өседі', mode: 'rsvp', per: 1, from: r(1.3), to: r(1.7), mins: 2 },
      { id: 3, title: 'Топтап оқу', desc: 'Екі сөзді бірден көр', mode: 'rsvp', per: 2, from: r(1.5), to: r(2.0), mins: 3 },
      { id: 4, title: 'Көру өрісі', desc: 'Үш сөзді бірден көр', mode: 'rsvp', per: 3, from: r(1.8), to: r(2.4), mins: 3 },
      { id: 5, title: 'Нұсқаушы', desc: 'Мәтін экранда, жарық көзді жетелейді', mode: 'pacer', per: 3, from: r(1.6), to: r(2.2), mins: 4 },
      { id: 6, title: 'Жарыс', desc: 'Ең жоғары қарқын, түсінуді сақта', mode: 'rsvp', per: 2, from: r(2.2), to: r(3.0), mins: 3 },
    ];
  }

  const api = { tokenize, orp, chunkAt, delayFor, rampWpm, stagesFor, opts };
  if (typeof module !== 'undefined') module.exports = api; else g.KSP = api;
})(globalThis);
