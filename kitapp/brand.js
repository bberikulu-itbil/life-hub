'use strict';
/* Kitapp: қосымша логосы (баптаудан ауыстырылады) және Life Hub қосымшаларына өту панелі. */

const LOGOS = [
  { id: 'book', icon: 'book', bg: ['#6d93f7', '#3b6ef5'], name: 'Көк' },
  { id: 'open', icon: 'book-open', bg: ['#34d399', '#059669'], name: 'Жасыл' },
  { id: 'head', icon: 'headphones', bg: ['#f472b6', '#db2777'], name: 'Қызғылт' },
  { id: 'zap', icon: 'zap', bg: ['#fcd34d', '#f59e0b'], name: 'Сары' },
  { id: 'feather', icon: 'feather', bg: ['#a78bfa', '#7c3aed'], name: 'Күлгін' },
  { id: 'moon', icon: 'moon', bg: ['#334155', '#0f172a'], name: 'Түнгі' },
  { id: 'layers', icon: 'layers', bg: ['#fdba74', '#ea580c'], name: 'Қызғылт сары' },
  { id: 'star', icon: 'star', bg: ['#67e8f9', '#0891b2'], name: 'Көгілдір' },
];
const curLogo = () => LOGOS.find(l => l.id === localStorage.kLogo) || LOGOS[0];

// round=false: iOS бұрыштарды өзі дөңгелектейді
const logoSVG = (l, round = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${l.bg[0]}"/><stop offset="1" stop-color="${l.bg[1]}"/></linearGradient></defs><rect width="512" height="512" rx="${round ? 116 : 0}" fill="url(#g)"/><g transform="translate(128 128) scale(10.67)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[l.icon]}</g></svg>`;
const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const logoImg = (l, size = 28) => `<img class="logo" src="${svgURL(logoSVG(l))}" width="${size}" height="${size}" alt="">`;

function toPng(svg, size) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size); res(c.toDataURL('image/png')); };
    img.onerror = () => res(null);
    img.src = svgURL(svg);
  });
}
function setLink(rel, href, type) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.append(el); }
  el.href = href; if (type) el.type = type;
}

// Белгішені браузер қойындысына, «Басты экранға қосу» белгішесіне және манифестке қояды
async function applyLogo() {
  const l = curLogo();
  setLink('icon', svgURL(logoSVG(l)), 'image/svg+xml');
  const [touch, p192, p512] = await Promise.all([toPng(logoSVG(l, false), 180), toPng(logoSVG(l, false), 192), toPng(logoSVG(l, false), 512)]);
  if (touch) setLink('apple-touch-icon', touch);
  if (p192 && p512) {
    const m = { name: 'Kitapp', short_name: 'Kitapp', start_url: location.href.split(/[?#]/)[0], display: 'standalone', background_color: '#eef1f7', theme_color: l.bg[1],
      icons: [{ src: p192, sizes: '192x192', type: 'image/png' }, { src: p512, sizes: '512x512', type: 'image/png' }] };
    setLink('manifest', URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })));
  }
  document.querySelectorAll('.nav-brand i, .nav-brand .logo').forEach(e => e.outerHTML = logoImg(l, 26));
}

function logoPickerHTML() {
  const cur = curLogo().id;
  return `<div class="glass sec"><h3>Қосымша белгішесі</h3>
    <div class="logo-grid" id="logoGrid">${LOGOS.map(l => `<button class="${l.id === cur ? 'on' : ''}" data-l="${l.id}" aria-label="${l.name}">${logoImg(l, 56)}<small>${l.name}</small></button>`).join('')}</div>
    <small class="muted">${ic('info', 13)} Браузер қойындысында бірден ауысады. Телефонның басты экранындағы белгіше үшін Kitapp-ты басты экраннан өшіріп, Safari-дан «Бөлісу → Басты экранға қосу» арқылы қайта қос.</small></div>`;
}
function bindLogoPicker(after) {
  $('#logoGrid').onclick = e => { const id = e.target.closest('[data-l]')?.dataset.l; if (!id) return; localStorage.kLogo = id; applyLogo(); toast('Белгіше ауыстырылды'); after(); };
}

/* ---------- Life Hub қосымшалары ---------- */
const HUB_APPS = [
  { name: 'Life Hub', sub: 'Ассистент', icon: 'home', url: '../', color: '#3b6ef5' },
  { name: 'Kitapp', sub: 'Кітаптар', icon: 'book', url: './', color: '#059669', here: true },
  { name: 'Тіл', sub: 'Сөздік', icon: 'globe', url: '../til/', color: '#0891b2', check: true },
  { name: 'Сынып хабарлары', sub: 'Ата-аналарға', icon: 'megaphone', url: '../broadcast/', color: '#db2777' },
  { name: 'Қаржы', sub: 'Hub ішінде', icon: 'wallet', url: '../', color: '#f59e0b' },
  { name: 'Жоспар', sub: 'Hub ішінде', icon: 'check2', url: '../', color: '#7c3aed' },
  { name: 'Денсаулық', sub: 'Hub ішінде', icon: 'activity', url: '../', color: '#e5484d' },
  { name: 'Ойлар', sub: 'Hub ішінде', icon: 'bulb', url: '../', color: '#ea580c' },
];
async function openApps(anchor) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu apps-pop';
  m.innerHTML = `<div class="apps-hd"><b>Life Hub қосымшалары</b></div><div class="apps-grid">${HUB_APPS.map((a, i) => `<a href="${a.url}" class="app ${a.here ? 'here' : ''}" data-i="${i}"><span style="--c:${a.color}">${ic(a.icon, 24)}</span><b>${a.name}</b><small>${a.here ? 'Осы қосымша' : a.sub}</small></a>`).join('')}</div>`;
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
  m.querySelector('.here').onclick = e => { e.preventDefault(); closeMenu(); };
  // әлі жарияланбаған қосымшаны «жақында» деп белгілейміз
  HUB_APPS.forEach((a, i) => a.check && fetch(a.url, { method: 'HEAD' }).then(r => { if (!r.ok) throw 0; }).catch(() => {
    const el = m.querySelector(`[data-i="${i}"]`); if (!el) return;
    el.classList.add('soon'); el.querySelector('small').textContent = 'Жақында'; el.onclick = e => { e.preventDefault(); toast(`${a.name} әлі жарияланбаған`); };
  }));
}
