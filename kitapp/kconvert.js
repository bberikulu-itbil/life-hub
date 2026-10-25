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

  // body берілсе, кішкентай сілтеме белгілерін (¹, 2, *) алып тастайды; L.drop — абзац басындағы ірі әріп
  function lineText(L, body) {
    let t = '', end = null;
    const base = Math.min(...L.parts.map(p => p.y ?? L.y));
    const hasWords = L.parts.some(p => /\p{L}/u.test(p.str));
    for (const p of L.parts) {
      // сілтеме белгісі: ұсақ цифр/жұлдызша, не жолдан жоғары көтерілген кіші цифр
      if (body && hasWords && /^\s*[\d*†‡¹²³⁴⁵⁶⁷⁸⁹]{1,3}\s*$/.test(p.str) && (p.size < body * .72 || (p.size < body * .92 && (p.y ?? base) - base > p.size * .2))) continue;
      if (t && end != null && p.x - end > p.size * .18 && !/\s$/.test(t) && !/^\s/.test(p.str)) t += ' ';
      t += p.str; end = p.x + p.w;
    }
    t = t.replace(/\s+/g, ' ').trim();
    return L.drop ? L.drop + t : t;
  }
  const lineSize = L => Math.max(0, ...L.parts.filter(p => /[\p{L}\p{N}]/u.test(p.str)).map(p => p.size)) || L.parts[0]?.size || 0;

  function joinLine(p, t) {
    return /[-­]$/.test(p) && /^\p{Ll}/u.test(t) ? p.replace(/[-­]$/, '') + t : p + ' ' + t;
  }

  // Тақырыпқа тән сөздер: «1-тарау», «II бөлім», «Кіріспе», «Глава 3» ...
  const B = '(?=$|[\\s.:,—–-])';
  const HEAD_RE = new RegExp(`^(\\d{1,3}\\s*[-–.]?\\s*(тарау|бөлім|бап|сабақ|глава|часть)${B}|(тарау|бөлім|бап|глава|часть|chapter|part)\\s+[\\divxlc]+${B}|(алғы сөз|кіріспе|қорытынды|соңғы сөз|сөз соңы|эпилог|пролог|предисловие|введение|заключение|послесловие|introduction|preface|epilogue|prologue|conclusion)${B})`, 'iu');
  const TOC_TITLE = /^(мазмұны|мазмұн|содержание|оглавление|contents|table of contents)[.:]?$/i;
  const FRONT = /ISBN|©|УДК|ББК|баспасы|издательство|all rights reserved|барлық құқықтар|құқықтары қорғалған|авторлық құқық|тираж|басуға қол қойылды|подписано в печать/i;
  const key = t => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  // «1-ТАРАУ. ТӘУБЕ ЕТУ» -> «1-тарау. Тәубе ету»: тек бас әріппен жазылған бөліктерді түзейміз
  const tidy = t => t.split(/(?<=[.:])\s+/).map(s => { const l = s.replace(/[^\p{L}]/gu, ''); return l.length > 1 && l === l.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; })
    .join(' ').replace(/^(\d+)\s*([-–.]?)\s*(\p{L})/u, (m, d, sep, c) => d + (sep || '-') + c.toLowerCase()).replace(/^\p{Ll}/u, c => c.toUpperCase());

  // Мазмұн жолы: «Атауы ........ 12» немесе атау мен оң жақтағы нөмір арасы алыс
  function tocEntry(L, t, body, right) {
    const m = t.match(/^(.*?\p{L}.*?)[\s.…·_]*\s(\d{1,4})$/u) || t.match(/^(.*?\p{L}.*?)[.…·_]{3,}\s*(\d{1,4})$/u);
    if (!m) return null;
    const ps = L.parts.filter(p => p.str.trim()), last = ps[ps.length - 1], prev = ps[ps.length - 2];
    const leaders = /[.…·_]{3,}/.test(t), farGap = prev && last && last.x - (prev.x + prev.w) > body * 2, rightAl = last && last.x + last.w > right - body * 2;
    if (!leaders && !farGap && !rightAl) return null;
    return { title: m[1].replace(/[\s.…·_]+$/u, '').trim(), num: +m[2] };
  }

  // pages: [[line]]; outline: [{title, page}] (page — 0-ден). Нәтиже: { chapters: [{title, paras}], removed, body, via }
  function structure(pages, outline = []) {
    const N = pages.length, removed = { pageNum: 0, header: 0, toc: 0, small: 0, front: 0 };

    // 0. Негізгі мәтіннің қаріп өлшемі (таңба санымен өлшенген медиана)
    const sizes = [];
    pages.forEach(ls => ls.forEach(l => { const n = Math.ceil(lineText(l).length / 20), s = lineSize(l); for (let i = 0; i < n; i++) sizes.push(s); }));
    const body = median(sizes) || 10;

    // 1. Ірі бас әріп (drop cap): бөлек тұрған 1–2 әріпті өз абзацының бірінші жолына қайтарамыз
    pages.forEach(ls => {
      for (const L of [...ls]) for (const p of [...L.parts]) {
        if (p.str.trim().length > 2 || !/\p{Lu}/u.test(p.str) || p.size < body * 1.8) continue;
        L.parts.splice(L.parts.indexOf(p), 1);
        const tgt = ls.filter(l => l.parts.length && l.y >= p.y - 1 && l.y <= p.y + p.size * 1.15 && l.parts.some(q => q.x > p.x)).sort((a, b) => b.y - a.y)[0];
        if (tgt) tgt.drop = p.str.trim();
        if (!L.parts.length) ls.splice(ls.indexOf(L), 1);
        else { L.x = Math.min(...L.parts.map(q => q.x)); }
      }
    });

    // 2. Әр беттің негізгі мәтін шекаралары мен жол аралығы
    const geo = pages.map(ls => {
      const big = ls.filter(l => lineSize(l) >= body * .9);
      const xs = big.map(l => l.x).sort((a, b) => a - b), xe = big.map(l => l.xEnd).sort((a, b) => a - b);
      const typ = median(big.slice(1).map((l, i) => big[i].y - l.y).filter(d => d > 0 && d < body * 4)) || body * 1.4;
      return { left: xs[Math.floor(xs.length * .1)] ?? 0, right: xe[Math.floor(xe.length * .9)] ?? 0, typ };
    });
    const R = median(geo.map(g => g.right).filter(Boolean));

    // 3. Мазмұн беттері және жолдары
    const isToc = new Set(), entries = [];
    pages.forEach((ls, pi) => {
      const txt = ls.map(l => lineText(l, body));
      const hasTitle = txt.some(t => TOC_TITLE.test(t.trim()));
      const ents = ls.map((l, i) => tocEntry(l, txt[i], body, R)).filter(Boolean);
      const cont = isToc.has(pi - 1) && ents.length >= Math.max(2, ls.length * .4);
      if (!(hasTitle && ents.length >= 2) && !(ents.length >= 4 && ents.length >= ls.length * .5) && !cont) return;
      isToc.add(pi);
      // «Мазмұны» сөзінен жоғарыдағы жолдар (колонтитул) есепке алынбайды
      const ti = txt.findIndex(t => TOC_TITLE.test(t.trim())), typ = geo[pi].typ;
      let pend = '', pendY = null;
      ls.forEach((l, i) => {
        if (i <= ti) return;
        const t = txt[i], e = tocEntry(l, t, body, R);
        // екі жолға созылған атау: тек тікелей үстіндегі жол қосылады
        if (e) { entries.push({ title: (pend && pendY - l.y < typ * 1.6 ? pend + ' ' : '') + e.title, num: e.num }); pend = ''; }
        else if (/\p{L}/u.test(t) && !PAGE_NUM.test(t)) { pend = pend && pendY - l.y < typ * 1.6 ? pend + ' ' + t : t; pendY = l.y; }
      });
    });

    // 4. Колонтитулдар: беттің шеткі жолдарында қайталанатын мәтін
    const isNum = l => { const t = lineText(l); return PAGE_NUM.test(t) || PAGE_OF.test(t); };
    // бос бет (сурет, ақ бет) — шеткі жолы жоқ
    const edgeIdx = ls => { const n = ls.length, s = new Set(n ? [0, n - 1] : []); if (n > 1 && isNum(ls[0])) s.add(1); if (n > 1 && isNum(ls[n - 1])) s.add(n - 2); return s; };
    const edge = new Map();
    pages.forEach((ls, pi) => !isToc.has(pi) && new Set([...edgeIdx(ls)].map(i => norm(lineText(ls[i])))).forEach(k => k && edge.set(k, (edge.get(k) || 0) + 1)));
    const rep = new Set([...edge].filter(([, c]) => N >= 4 && c >= Math.max(3, N * .3)).map(([k]) => k));
    const known = new Set([...entries.map(e => key(e.title)), ...outline.map(o => key(o.title || ''))].filter(k => k.length > 2));
    // тарау атымен ауысатын колонтитул: шетте, бірнеше бетте қайталанады және негізгі мәтіннен алшақ тұр
    const separated = (ls, i, g) => { const nb = ls[i === 0 ? 1 : i - 1]; return nb && Math.abs(ls[i].y - nb.y) > g.typ * 1.6; };

    // 5. Сүзу
    const lines = [];
    pages.forEach((ls, page) => {
      if (isToc.has(page)) { removed.toc += ls.length; return; }
      const ei = edgeIdx(ls), g = geo[page];
      const keep = [];
      ls.forEach((l, li) => {
        const t = lineText(l, body); if (!t) return;
        const atEdge = ei.has(li);
        if (atEdge && (PAGE_NUM.test(t) || PAGE_OF.test(t))) return removed.pageNum++;
        // кіші қаріпті шеткі жол бірнеше бетте қайталанса не тарау атына тең болса — колонтитул; тарау басындағы нақты тақырып (≥ негізгі қаріп) қалады
        if (atEdge && (rep.has(norm(t)) || (separated(ls, li, g) && t.length < 120 && lineSize(l) < body * .98 && ((edge.get(norm(t)) || 0) >= 2 || known.has(key(t)))))) return removed.header++;
        if (FRONT.test(t) && (page < 4 || page > N - 3)) return removed.front++;
        const size = lineSize(l);
        if (size < body * .8) return removed.small++;
        keep.push({ t, size, y: l.y, x: l.x, xEnd: l.xEnd, page });
      });
      // мұқаба/титул беті: кітаптың басындағы мәтіні аз беттер
      if (page < 3 && keep.reduce((a, l) => a + l.t.length, 0) < 300 && !keep.some(l => HEAD_RE.test(l.t))) { removed.front += keep.length; return; }
      const { left, right, typ } = g, center = (left + right) / 2, bw = Math.max(1, right - left);
      keep.forEach((l, i) => {
        const prev = keep[i - 1], gapAbove = prev ? prev.y - l.y : typ * 3, indent = l.x > left + body * 1.2;
        const letters = l.t.replace(/[^\p{L}]/gu, ''), caps = letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
        const centered = Math.abs((l.x + l.xEnd) / 2 - center) < bw * .07 && l.xEnd - l.x < bw * .8;
        const short = l.t.length <= 90 && !/[,;]$/.test(l.t);
        const head = /\p{L}{2}/u.test(l.t) && l.t.length <= 150 &&
          (l.size >= body * 1.15 || (HEAD_RE.test(l.t) && short && (centered || caps || gapAbove > typ * 1.6)) || (caps && short && (centered || gapAbove > typ * 1.8)));
        const brk = prev ? (gapAbove > typ * 1.6 || indent || (END.test(prev.t) && prev.xEnd < left + bw * .8)) : null;
        lines.push({ ...l, head, brk, indent });
      });
    });

    // 6. Тарау басталатын жерлер: мазмұн беті → PDF бетбелгілері → тақырыптар
    let starts = new Map(), via = 'headings';
    if (entries.length >= 2) {
      const found = [], match = (i, K) => {
        const k1 = key(lines[i].t), k2 = lines[i + 1] ? k1 + key(lines[i + 1].t) : null;
        if (k1 === K) return 1; if (k2 === K) return 2;
        if (k1.length >= 8 && K.startsWith(k1) && lines[i].head) return lines[i + 1]?.head && K.startsWith(k2) ? 2 : 1;
        if (K.length >= 8 && k1.startsWith(K)) return 1;
        return 0;
      };
      let cur = 0;
      for (const e of entries) {
        const K = key(e.title); let hit = null;
        for (const pass of [true, false]) {
          for (let i = cur; i < lines.length && !hit; i++) if ((!pass || lines[i].head) && match(i, K)) hit = { i, n: match(i, K) };
          if (hit) break;
        }
        found.push(hit ? { e, ...hit, page: lines[hit.i].page } : { e });
        if (hit) cur = hit.i + hit.n;
      }
      const ok = found.filter(f => f.i != null);
      if (ok.length >= 2) {
        via = 'toc';
        const off = median(ok.map(f => f.page - f.e.num));
        for (const f of found) {
          if (f.i == null) { const j = lines.findIndex(l => l.page >= f.e.num + off); if (j >= 0 && !starts.has(j)) starts.set(j, { title: f.e.title, skip: 0 }); }
          else starts.set(f.i, { title: f.e.title, skip: f.n });
        }
      }
    }
    if (via !== 'toc' && outline.filter(o => o.title).length >= 2) {
      via = 'outline';
      for (const o of [...outline].sort((a, b) => a.page - b.page)) {
        const j = lines.findIndex(l => l.page >= o.page); if (j < 0 || starts.has(j)) continue;
        const K = key(o.title); let skip = 0;
        while (skip < 3 && lines[j + skip]?.head) skip++;   // тарау басындағы тақырып — тарау атының қайталануы
        starts.set(j, { title: o.title.trim(), skip });
      }
    }

    // 7. Абзацтар мен тараулар
    const chapters = []; let ch = null, open = false, lastText = '';
    const start = (title, fromHead) => { ch = { title: tidy(title), paras: [], heads: [], fromHead }; chapters.push(ch); open = false; };
    for (let i = 0; i < lines.length; i++) {
      const e = lines[i];
      const st = starts.get(i);
      if (st) { start(st.title, false); if (st.skip) { i += st.skip - 1; lastText = ''; continue; } }
      if (e.head) {
        if (via !== 'headings') { ch ??= { title: 'Басы', paras: [], heads: [] }, chapters.includes(ch) || chapters.push(ch); ch.paras.push(tidy(e.t)); ch.heads.push(tidy(e.t)); open = false; lastText = e.t; continue; } // ішкі тақырыпша
        if (ch && ch.fromHead && !ch.paras.length) { ch.title = tidy(ch.title + '. ' + e.t); continue; }
        start(e.t, true); lastText = e.t; continue;
      }
      if (!ch) start('Басы', false);
      // бет басында: алдыңғы абзац сөйлеммен бітсе және жол шегіністен басталса — жаңа абзац
      const brk = e.brk ?? (END.test(lastText) && e.indent);
      if (!open || brk) { ch.paras.push(e.t); open = true; }
      else ch.paras[ch.paras.length - 1] = joinLine(ch.paras[ch.paras.length - 1], e.t);
      lastText = e.t;
    }

    // 8. Бос тарауларды алып тастау, тым қысқасын келесісіне қосу, тарау табылмаса бөліктерге бөлу
    let res = chapters.filter(c => c.paras.length);
    for (let i = 0; i < res.length - 1; i++) {
      if (res[i].paras.join(' ').length < 300 && via === 'headings') { res[i + 1].paras.unshift(...res[i].paras); res[i + 1].heads.unshift(...res[i].heads); res.splice(i--, 1); }
    }
    if (res.length < 2 && res[0]) {
      const all = res[0].paras, parts = [];
      let cur = [], len = 0;
      for (const p of all) { cur.push(p); len += p.length; if (len >= 4000) { parts.push(cur); cur = []; len = 0; } }
      if (cur.length) parts.push(cur);
      const hs = new Set(res[0].heads);
      res = parts.map((paras, i) => ({ title: parts.length > 1 ? `Бөлім ${i + 1}` : res[0].title, paras, heads: paras.filter(p => hs.has(p)) }));
      via = 'size';
    }
    return { chapters: res.map(({ title, paras, heads }) => ({ title, paras, heads: heads || [] })), removed, body, via, toc: entries };
  }

  const api = { linesFromItems, lineText, structure, joinLine, tidy };
  if (typeof module !== 'undefined') module.exports = api; else g.KC = api;
})(globalThis);
