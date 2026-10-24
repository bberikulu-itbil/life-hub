/* Кітап мәтінін іздеу: бөлшектеу + кілт сөз бойынша рейтинг. Қазақ тілі жалғамалы, сондықтан сөздің алғашқы 5 әрпі негіз ретінде алынады. */
(function (g) {
  const stem = w => w.slice(0, 5);
  const words = t => t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];

  function chunkText(text, max = 1100) {
    text = text.replace(/\s+/g, ' ').trim();
    const out = [];
    while (text.length > max) {
      let cut = text.lastIndexOf('. ', max);
      if (cut < max * 0.5) cut = text.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      out.push(text.slice(0, cut + 1).trim());
      text = text.slice(cut + 1).trim();
    }
    if (text) out.push(text);
    return out;
  }

  function tfOf(text) {
    const tf = {};
    for (const w of words(text)) { const s = stem(w); tf[s] = (tf[s] || 0) + 1; }
    return tf;
  }

  // Бірдей аралықпен таңдау: сұрақта сәйкес сөз табылмаса кітаптың бүкіл ауқымынан көрсетеміз.
  function sample(chunks, k) {
    if (chunks.length <= k) return chunks.slice();
    const step = chunks.length / k;
    return Array.from({ length: k }, (_, i) => chunks[Math.floor(i * step)]);
  }

  function rank(query, chunks, k = 8) {
    const q = [...new Set(words(query).map(stem))];
    if (!q.length || !chunks.length) return sample(chunks, k);
    const N = chunks.length, df = Object.fromEntries(q.map(s => [s, 0]));
    for (const c of chunks) for (const s of q) if (c.tf[s]) df[s]++;
    const hits = chunks
      .map(c => ({ c, s: q.reduce((a, s) => a + (c.tf[s] ? (1 + Math.log(c.tf[s])) * Math.log(1 + N / (1 + df[s])) : 0), 0) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
    return hits.length ? hits : sample(chunks, k);
  }

  const api = { chunkText, tfOf, rank, words };
  if (typeof module !== 'undefined') module.exports = api; else g.RAG = api;
})(globalThis);
