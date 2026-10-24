/* PDF мәтінін «таза кітапқа» айналдырудың таза логикасы (браузерсіз тексеріледі):
   жолдарды жинау, бет нөмірі мен колонтитулдарды алу, абзац пен тарауларды қалпына келтіру. */
(function (g) {
  const PAGE_NUM = /^[\s\-–—.]*(\d{1,4}|[ivxlcdm]{1,7})[\s\-–—.]*$/i;
  const PAGE_OF = /^(бет|стр\.?|page|p\.)?\s*\d{1,4}\s*(\/|из|of)\s*\d{1,4}$/i;
  const TOC = /(\.{3,}|…{2,}|_{3,}|\s{4,})\s*\d{1,4}\s*$/;
  const END = /[.!?…:;»"”)]$/;
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const norm = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

  // pdf.js textContent.items -> жоғарыдан төмен сұрыпталған жолдар
  function linesFromItems(items) {
    const lines = [];
    for (const it of items) {
      if (typeof it.str !== 'string' || !it.transform) continue;
      const size = Math.abs(it.height || Math.hypot(it.transform[2], it.transform[3])) || 1;
      const x = it.transform[4], y = it.transform[5], w = it.width || 0;
      let L = lines.find(l => Math.abs(l.y - y) <= Math.max(2, size * .5));
      if (!L) { if (!it.str.trim()) continue; L = { y, x, xEnd: x + w, parts: [] }; lines.push(L); }
      L.parts.push({ str: it.str, size, x, y, w });
      L.x = Math.min(L.x, x); L.xEnd = Math.max(L.xEnd, x + w);
    }
    for (const L of lines) L.parts.sort((a, b) => a.x - b.x);
    return lines.sort((a, b) => b.y - a.y);
  }

  // body берілсе, кішкентай сілтеме белгілерін (¹, 2, *) алып тастайды
  function lineText(L, body) {
    let t = '', end = null;
    const base = Math.min(...L.parts.map(p => p.y ?? L.y));
    const hasWords = L.parts.some(p => /\p{L}/u.test(p.str));
    for (const p of L.parts) {
      // сілтеме белгісі: ұсақ цифр/жұлдызша, не жолдан жоғары көтерілген кіші цифр
      if (body && hasWords && /^\s*[\d*†‡]{1,3}\s*$/.test(p.str) && (p.size < body * .72 || (p.size < body * .92 && (p.y ?? base) - base > p.size * .2))) continue;
      if (t && end != null && p.x - end > p.size * .18 && !/\s$/.test(t) && !/^\s/.test(p.str)) t += ' ';
      t += p.str; end = p.x + p.w;
    }
    return t.replace(/\s+/g, ' ').trim();
  }
  const lineSize = L => Math.max(0, ...L.parts.filter(p => /[\p{L}\p{N}]/u.test(p.str)).map(p => p.size)) || L.parts[0]?.size || 0;

  function joinLine(p, t) {
    return /[-­]$/.test(p) && /^\p{Ll}/u.test(t) ? p.replace(/[-­]$/, '') + t : p + ' ' + t;
  }

  // pages: [[line]]; outline: [{title, page}] (page — 0-ден). Нәтиже: { chapters: [{title, paras}], removed, body }
  function structure(pages, outline = []) {
    const N = pages.length, removed = { pageNum: 0, header: 0, toc: 0, small: 0 };

    // 1. Колонтитул: беттердің жоғарғы/төменгі 2 жолында көп қайталанатын мәтін
    // шеткі жолдар: ең жоғарғы және ең төменгі; шеткі жол бет нөмірі болса — оның көршісі де
    const isNum = l => { const t = lineText(l); return PAGE_NUM.test(t) || PAGE_OF.test(t); };
    const edgeIdx = ls => { const n = ls.length, s = new Set([0, n - 1]); if (n > 1 && isNum(ls[0])) s.add(1); if (n > 1 && isNum(ls[n - 1])) s.add(n - 2); return s; };
    const edge = new Map();
    pages.forEach(ls => new Set([...edgeIdx(ls)].map(i => norm(lineText(ls[i])))).forEach(k => k && edge.set(k, (edge.get(k) || 0) + 1)));
    const rep = new Set([...edge].filter(([, c]) => N >= 4 && c >= Math.max(3, N * .3)).map(([k]) => k));

    // 2. Негізгі мәтіннің қаріп өлшемі (таңба санымен өлшенген медиана)
    const sizes = [];
    pages.forEach(ls => ls.forEach(l => { const n = Math.ceil(lineText(l).length / 20), s = lineSize(l); for (let i = 0; i < n; i++) sizes.push(s); }));
    const body = median(sizes) || 10;

    // 3. Сүзу және жол түрін анықтау
    const out = [];
    pages.forEach((ls, page) => {
      const keep = [], ei = edgeIdx(ls);
      ls.forEach((l, li) => {
        const t = lineText(l, body); if (!t) return;
        const atEdge = ei.has(li);
        if (atEdge && (PAGE_NUM.test(t) || PAGE_OF.test(t))) return removed.pageNum++;
        if (atEdge && rep.has(norm(t))) return removed.header++;
        if (TOC.test(t)) return removed.toc++;
        const size = lineSize(l);
        if (size < body * .8) return removed.small++;
        keep.push({ t, size, y: l.y, x: l.x, xEnd: l.xEnd });
      });
      const typ = median(keep.slice(1).map((l, i) => keep[i].y - l.y).filter(d => d > 0)) || body * 1.4;
      const left = Math.min(...keep.map(l => l.x)), right = Math.max(...keep.map(l => l.xEnd));
      keep.forEach((l, i) => {
        const prev = keep[i - 1], indent = l.x > left + body * 1.2;
        const brk = prev ? (prev.y - l.y > typ * 1.6 || indent || (END.test(prev.t) && prev.xEnd < left + (right - left) * .8)) : null;
        out.push({ page, text: l.t, head: l.size >= body * 1.2 && l.t.length <= 150 && /\p{L}/u.test(l.t), brk, indent });
      });
    });

    // 4. Абзацтар мен тараулар
    const starts = new Map();
    [...outline].sort((a, b) => a.page - b.page).forEach(o => { if (o.title && !starts.has(o.page)) starts.set(o.page, o.title.trim()); });
    const useOutline = starts.size >= 2;
    const chapters = []; let ch = null, open = false, lastText = '';
    const start = (title, fromHead) => { ch = { title, paras: [], fromHead }; chapters.push(ch); open = false; };
    for (const e of out) {
      if (useOutline && starts.has(e.page)) { start(starts.get(e.page), false); starts.delete(e.page); }
      if (e.head) {
        if (useOutline) { if (ch && !ch.paras.length) continue; }                // тарау атының қайталануы
        else if (ch && ch.fromHead && !ch.paras.length) { ch.title += '. ' + e.text; continue; }
        else { start(e.text, true); lastText = e.text; continue; }
        ch.paras.push(e.text); open = false; lastText = e.text; continue;     // ішкі тақырыпша
      }
      if (!ch) start('Басы', false);
      // бет басында: алдыңғы абзац сөйлеммен бітсе және жол шегіністен басталса — жаңа абзац
      const brk = e.brk ?? (END.test(lastText) && e.indent);
      if (!open || brk) { ch.paras.push(e.text); open = true; }
      else ch.paras[ch.paras.length - 1] = joinLine(ch.paras[ch.paras.length - 1], e.text);
      lastText = e.text;
    }

    // 5. Бос тарауларды алып тастау, тым қысқасын келесісіне қосу, тарау табылмаса бөліктерге бөлу
    let res = chapters.filter(c => c.paras.length);
    for (let i = 0; i < res.length - 1; i++) {
      if (res[i].paras.join(' ').length < 300) { res[i + 1].paras.unshift(...res[i].paras); res.splice(i--, 1); }
    }
    if (res.length < 2 && res[0]) {
      const all = res[0].paras, parts = [];
      let cur = [], len = 0;
      for (const p of all) { cur.push(p); len += p.length; if (len >= 4000) { parts.push(cur); cur = []; len = 0; } }
      if (cur.length) parts.push(cur);
      res = parts.map((paras, i) => ({ title: parts.length > 1 ? `Бөлім ${i + 1}` : res[0].title, paras }));
    }
    return { chapters: res.map(({ title, paras }) => ({ title, paras })), removed, body };
  }

  const api = { linesFromItems, lineText, structure, joinLine };
  if (typeof module !== 'undefined') module.exports = api; else g.KC = api;
})(globalThis);
