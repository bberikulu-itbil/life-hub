"use strict";
/* FinSaulyq интерфейсі. Деректер тек осы құрылғыда (localStorage); есептеу — core.js (FS). */
const KEY = "finsaulyq.v1";
const DEF = { settings: { capital: 0, income: 0, fixed: 0, city: "Астана", pad: true, hide: false, payerRecentCount: 4, payerReminderDays: 3, payerAutoLink: true }, settingsId: null, tx: [], cycles: [], items: [], categories: [], incomes: [], goals: [], installments: [], wishes: [], stock: [], matches: [], contribs: [], accounts: [], transfers: [], pending: [], synced: false };
const LISTS = ["tx", "cycles", "items", "categories", "incomes", "goals", "installments", "wishes", "stock", "matches", "contribs", "accounts", "transfers"];
const CATS = ["Тамақ", "Көлік", "Тұрмыс", "Кітап", "Күтім", "Жалақы"];
const MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const COLORS = ["var(--acc)", "var(--star)", "var(--warn)", "var(--acc-2)", "var(--good)", "var(--mute)"];
const ICONS = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  soda: '<path d="M6 8h12l-1.5 13h-9z"/><path d="M5 8h14"/><path d="M13.5 8L15 3h3"/><circle cx="10.5" cy="13" r=".6"/><circle cx="13.5" cy="15" r=".6"/><circle cx="11" cy="18" r=".6"/>',
  gamepad: '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-2 3-4 2.5S8 20 8 18z"/>',
  fuel: '<path d="M4 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M3 22h12"/><path d="M14 10h2a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0V8l-3-3"/><rect x="6" y="6" width="6" height="4"/>',
  shirt: '<path d="M20.4 6.4L16 3a4 4 0 0 1-8 0L3.6 6.4a1 1 0 0 0-.3 1.3l1.6 2.6a1 1 0 0 0 1.2.4L7 10.3V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9.7l.9.4a1 1 0 0 0 1.2-.4l1.6-2.6a1 1 0 0 0-.3-1.3z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M14 9l2 2"/>',
  bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 17h20M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>',
  tv: '<rect x="2" y="7" width="20" height="13" rx="2"/><polyline points="8 2 12 6 16 2"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2"/>',
  tree: '<polygon points="12 3 5 13 9 13 6 19 18 19 15 13 19 13"/><line x1="12" y1="19" x2="12" y2="22"/>',
  cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
  umbrella: '<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  coin: '<circle cx="12" cy="12" r="10"/><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2a3 3 0 0 1-3-1.5M12 6v2M12 16v2"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.7 4.7 0 0 0 22 11c0-5-4.5-9-10-9z"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 20h20"/>',
  baby: '<circle cx="12" cy="10" r="7"/><path d="M9 10h.01M15 10h.01M10 13c1 1 3 1 4 0M12 3c0-1.5 1.5-2 2.5-1.5"/><path d="M5 21c1-3 3.5-4 7-4s6 1 7 4"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
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
  chev: '<polyline points="9 18 15 12 9 6"/>',
  chevl: '<polyline points="15 18 9 12 15 6"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  bus: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 11h18"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  grad: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  pill: '<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  bars: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
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
  let changed = false;
  for (const c of S.cycles) if (!c.type) { c.type = "cycle"; changed = true; queue("cycles", c.id, "put"); }
  if (!old.length) { if (changed) persist(); return; }
  FS.migrate(S);
  for (const c of old) { queue("cycles", c.id, "put"); queue("items", FS.itemIdOf(c.id), "put"); }
  persist();
}
migrate();
const liveCycles = () => S.cycles.filter((c) => c.status !== "archived");
// Item қосу: цикл-күн, соңғы баға мен күн қайта есептеледі
function recordItem(c, o) {
  const it = { id: crypto.randomUUID(), cycleId: c.id, name: c.name, cost: o.cost, amount: o.qty || 1, store: o.store || "", discount: !!o.discount, note: o.note || "", time: o.date, city: S.settings.city, ...(o.txId ? { txId: o.txId } : {}), ...(o.receipt ? { receipt: o.receipt } : {}) };
  put("items", it); FS.recalcCycle(c, S.items, S.settings.payerRecentCount); put("cycles", c);
  return it;
}
// Item өшсе, цикл қалған сатып алулардан қайта есептеледі
function dropItems(list) {
  const ids = new Set(list.map((i) => i.cycleId));
  for (const i of list) rm("items", i.id);
  for (const c of S.cycles) if (ids.has(c.id)) { FS.recalcCycle(c, S.items, S.settings.payerRecentCount); put("cycles", c); }
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
const head = (t) => h("div", { class: "head" }, h("h1", {}, t));
let sub = null; // Профильдің ішкі беті
const go = (t) => { tab = t; sub = null; catView = null; render(); document.getElementById("view").scrollTo(0, 0); };
const sec = (title, action, ...body) => h("section", { class: "sec" }, h("header", {}, h("h2", {}, title), action), ...body);
const add = (fn) => h("button", { class: "ghost", onclick: fn }, ic("plus"), "Қосу");
const empty = (t) => h("p", { class: "empty" }, t);
const bar = (pct, low) => h("div", { class: "bar" + (low ? " low" : ""), role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${pct}%` }));
// чектен/енгізуден түскен тауарлар да кетеді
const removeTx = (id) => { dropItems(S.items.filter((i) => i.txId === id)); rm("tx", id); save(); };
const delNow = (key, id, what) => {
  const goal = key === "goals";
  if (!confirm(`«${what}» өшіру ме?` + (goal ? " Жиналған жарналар қолжетімді қалдыққа қайтады." : key === "cycles" ? " Төлем тарихы да өшеді." : key === "tx" ? " Байланысқан тауар жазбалары да өшеді." : ""))) return false;
  if (goal) S.contribs.filter((c) => c.goalId === id).forEach((c) => rm("contribs", c.id));
  if (key === "tx") { removeTx(id); return true; }
  if (key === "cycles") S.items.filter((i) => i.cycleId === id).forEach((i) => rm("items", i.id));
  rm(key, id); save(); return true;
};
const del = (key, id, what) => h("button", { class: "ghost sm", "aria-label": `Өшіру: ${what}`, onclick: () => delNow(key, id, what) }, ic("trash"));

// Бір диалог — барлық енгізу формалары үшін. fields: { name, label, type, value, options, min, step, optional }
function ask(title, fields, ok, extra, setup) {
  const form = h("form", { method: "dialog" }, h("h3", {}, title));
  const dlg = h("dialog", {}, form);
  for (const f of fields) {
    const input = f.type === "file" ? h("input", { name: f.name, type: "file", accept: "image/*" }) : f.options
      ? h("select", { name: f.name }, f.options.map(([v, t]) => h("option", { value: v }, t)))
      : h("input", { name: f.name, type: f.type || "text", value: f.value ?? "", required: !f.optional, ...(f.type === "number" ? { min: f.min ?? 0, max: f.max, step: f.step ?? "any", inputmode: "decimal" } : {}) });
    if (f.options && f.value != null) input.value = f.value;
    if (f.suggest) { const id = "dl-" + f.name; input.setAttribute("list", id); input.setAttribute("autocomplete", "off"); form.append(h("datalist", { id }, f.suggest.map((v) => h("option", { value: v })))); }
    form.append(h("label", {}, f.label, input));
  }
  form.append(h("div", { class: "end" }, extra && h("button", { type: "button", class: "ghost warn", style: "margin-right:auto", onclick: () => { dlg.close(); extra.fn(); } }, extra.label), h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { class: "primary" }, "Сақтау")));
  form.addEventListener("submit", () => ok(Object.fromEntries(new FormData(form))));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  setup?.(form.elements);
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
const subsOf = (cat) => catInfo(cat).subs.map((x) => x.name);
const stores = () => [...new Set([...S.tx.map((t) => t.store), ...S.items.map((i) => i.store)].filter(Boolean))];
const catOpts = (kind, cur) => { const n = allCats(kind).map((c) => c.name), c = cur && FS.normCat(cur); if (c && !n.includes(c)) n.unshift(c); return n.map((x) => [x, x]); };
const subOpts = (cat, cur) => { const n = subsOf(cat); if (cur && !n.includes(cur)) n.push(cur); return [["", "—"], ...n.map((x) => [x, x])]; };
const fillSel = (sel, opts, val) => { sel.replaceChildren(...opts.map(([v, t]) => h("option", { value: v }, t))); sel.value = opts.some(([v]) => v === val) ? val : opts[0][0]; };
const txForm = (t, pre) => { const d = t ?? pre ?? {}; ask(t ? "Транзакцияны өзгерту" : pre ? "Чектен оқылды: тексеріп сақта" : "Жаңа транзакция", [
  { name: "kind", label: "Түрі", options: [["expense", "Шығыс"], ["income", "Кіріс"]], value: d.kind },
  { name: "amount", label: "Сома, ₸", type: "number", min: 0.01, value: d.amount },
  { name: "category", label: "Санат", value: FS.normCat(d.category ?? "Тамақ"), options: catOpts(d.kind ?? "expense", d.category ?? "Тамақ") },
  { name: "sub", label: "Ішкі санат", optional: true, value: d.sub ?? "", options: subOpts(FS.normCat(d.category ?? "Тамақ"), d.sub) },
  { name: "store", label: "Дүкен", optional: true, value: d.store, suggest: stores() },
  { name: "note", label: "Ескертпе", optional: true, value: d.note },
  { name: "date", label: "Күні", type: "date", value: d.date ?? today() },
  ...accField(t ? (t.account ?? "") : undefined),
], (v) => { put("tx", withAcc({ id: t?.id ?? crypto.randomUUID(), kind: v.kind, amount: num(v.amount), category: FS.normCat(v.category), note: v.note.trim(), date: v.date, ...(v.store.trim() ? { store: v.store.trim() } : {}), ...(v.sub.trim() ? { sub: v.sub.trim() } : {}) }, v)); save(); },
  t && { label: "Өшіру", fn: () => confirm(`«${t.category} ${tg(t.amount)}» өшіру ме? Байланысқан тауар жазбалары да өшеді.`) && removeTx(t.id) },
  (el) => { // түрі өзгерсе — санаттар, санат өзгерсе — ішкі санаттар жаңарады
    el.kind.addEventListener("change", () => { fillSel(el.category, catOpts(el.kind.value), el.category.value); fillSel(el.sub, subOpts(el.category.value), ""); });
    el.category.addEventListener("change", () => fillSel(el.sub, subOpts(el.category.value), ""));
  }); };

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

// Төлемгер: циклді немесе циклсіз жиі шығын. Алғашқы сома мен күн тарихтағы алғашқы төлем ретінде жазылады.
const cycTile = (c) => h("span", { class: "tile", style: `background:${c.color || catInfo(c.cat || c.name).color}`, "aria-hidden": "true" }, ic(c.icon || "box"));
const addCycle = (pre = {}, then) => {
  const editing = !!pre.id;
  const st = { name: pre.name ?? "", type: pre.type || "cycle", icon: pre.icon || "box", color: pre.color || COLORS_PICK[Math.floor(Math.random() * COLORS_PICK.length)], cat: FS.normCat(pre.cat || "Тұрмыс"), sub: pre.sub || "",
    unit: pre.unit || "рет", price: pre.avgRecent || pre.avgAll || pre.price || "", every: pre.every || "", buffer: pre.buffer ?? S.settings.payerReminderDays ?? 3, alert: pre.alert !== false, first: pre.first || pre.last || today() };
  const dlg = h("dialog", { class: "sheet catdlg" });
  const inp = (label, key, a = {}) => h("label", { class: "inl" }, label, h("input", { name: key, value: st[key], "aria-label": label, oninput: (e) => { st[key] = e.target.value; }, ...a }));
  const nm = { type: "number", min: 0, step: "any", inputmode: "decimal" };
  const draw = () => dlg.replaceChildren(
    h("h2", { class: "ctitle" }, editing ? "Төлемгерді өзгерту" : "Жаңа Төлемгер"),
    h("div", { class: "cprev", style: `background:${st.color}` }, ic(st.icon)),
    h("div", { class: "sec crow" }, inp("Атауы", "name", { placeholder: "Тауар, қызмет немесе жазылым" }),
      h("div", { class: "seg2" }, [["cycle", "Циклді төлем"], ["tracked", "Бақыланатын төлем"]].map(([k, t]) => h("button", { type: "button", "aria-pressed": String(st.type === k), onclick: () => { st.type = k; draw(); } }, t)))),
    h("div", { class: "sec crow" }, inp("Орташа сома, ₸", "price", { ...nm, min: 0.01, placeholder: "0" }), inp("Өлшем бірлігі", "unit"),
      st.type === "cycle" && inp("Цикл аралығы, күн (8, 25, 40…)", "every", { ...nm, step: 1, placeholder: "—" }),
      !editing && inp("Алғашқы төлем күні", "first", { type: "date" })),
    h("div", { class: "sec crow" },
      h("label", { class: "inl" }, "Негізгі санат", h("select", { name: "cat", "aria-label": "Негізгі санат", onchange: (e) => { st.cat = e.target.value; st.sub = ""; draw(); } }, catOpts("expense", st.cat).map(([v, t]) => h("option", { value: v, selected: v === st.cat }, t)))),
      h("label", { class: "inl" }, "Ішкі санат", h("select", { name: "sub", "aria-label": "Ішкі санат", onchange: (e) => { st.sub = e.target.value; } }, subOpts(st.cat, st.sub).map(([v, t]) => h("option", { value: v, selected: v === st.sub }, t))))),
    h("div", { class: "sec crow" }, inp("Неше күн бұрын ескерту", "buffer", { ...nm, step: 1 }),
      h("label", { class: "inl" }, "Ескерту", h("input", { type: "checkbox", name: "alert", checked: st.alert, "aria-label": "Ескерту", onchange: (e) => { st.alert = e.target.checked; } }))),
    h("div", { class: "sec swatches" }, ...COLORS_PICK.map((c) => h("button", { type: "button", class: "sw" + (c === st.color ? " on" : ""), style: `background:${c}`, "aria-label": `Түс ${c}`, onclick: () => { st.color = c; draw(); } })),
      h("label", { class: "sw rainbow", "aria-label": "Басқа түс" }, h("input", { type: "color", value: st.color, onchange: (e) => { st.color = e.target.value; draw(); } }))),
    h("div", { class: "sec swatches" }, ...ICON_KEYS.map((k) => h("button", { type: "button", class: "ib" + (k === st.icon ? " on" : ""), "aria-label": `Белгіше ${k}`, onclick: () => { st.icon = k; draw(); } }, ic(k)))),
    h("div", { class: "end sticky" }, h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"),
      h("button", { type: "button", class: "primary", onclick: () => {
        if (!st.name.trim()) return alert("Атауын жаз.");
        if (!(num(st.price) > 0)) return alert("Орташа соманы жаз.");
        const every = st.type === "cycle" ? Math.max(0, Math.round(num(st.every) || 0)) : 0, first = pre.first || pre.last || st.first || today();
        const c = { ...pre, id: pre.id || crypto.randomUUID(), name: st.name.trim(), type: st.type, icon: st.icon, color: st.color, price: num(st.price), unit: st.unit.trim() || "рет", every, buffer: Math.max(0, num(st.buffer) || 0), cat: FS.normCat(st.cat), sub: st.sub, first, last: editing ? (pre.last || "") : "", status: pre.status || "active", alert: st.alert, intervalLocked: true };
        put("cycles", c); dlg.close(); save(); then?.(c); } }, editing ? "Сақтау" : "Қосу")));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); draw(); dlg.showModal();
};

const incForm = (i) => ask(i ? "Кіріс көзін өзгерту" : "Жаңа кіріс көзі", [
  { name: "name", label: "Көзі (жалақы, репетиторлық…)", value: i?.name },
  { name: "amount", label: "Айлық сома, ₸", type: "number", min: 0.01, value: i?.amount },
], (v) => { put("incomes", { id: i?.id ?? crypto.randomUUID(), name: v.name.trim(), amount: num(v.amount) }); save(); });
const gotIncome = (i) => ask(`Түсті: ${i.name}`, [{ name: "amount", label: "Сома, ₸", type: "number", min: 0.01, value: i.amount }, ...accField(), { name: "date", label: "Күні", type: "date", value: today() }],
  (v) => { put("tx", withAcc({ id: crypto.randomUUID(), kind: "income", amount: num(v.amount), category: FS.normCat(i.name), note: "", date: v.date }, v)); save(); });
const addGoal = () => ask("Жаңа мақсат", [
  { name: "name", label: "Мақсат" },
  { name: "target", label: "Керек сома, ₸", type: "number", min: 1 },
  { name: "months", label: "Неше айда", type: "number", min: 1, step: 1 },
  { name: "saved", label: "Қазір жиналған, ₸", type: "number", value: 0 },
], (v) => { put("goals", { id: crypto.randomUUID(), name: v.name.trim(), target: num(v.target), months: num(v.months), saved: num(v.saved), start: today() }); save(); });


const addMatch = () => ask("Брендтерді салыстыру", [
  { name: "name", label: "Өнім (мыс: тіс пастасы)" },
  { name: "an", label: "1-бренд" }, { name: "ap", label: "1-бренд бағасы, ₸", type: "number", min: 0.01 }, { name: "ad", label: "1-бренд қанша күнге жетеді", type: "number", min: 1, step: 1 },
  { name: "bn", label: "2-бренд" }, { name: "bp", label: "2-бренд бағасы, ₸", type: "number", min: 0.01 }, { name: "bd", label: "2-бренд қанша күнге жетеді", type: "number", min: 1, step: 1 },
], (v) => { put("matches", { id: crypto.randomUUID(), name: v.name.trim(), brands: [{ name: v.an.trim(), price: num(v.ap), days: num(v.ad) }, { name: v.bn.trim(), price: num(v.bp), days: num(v.bd) }] }); save(); });

const buyAgain = (c) => openAdd({ kind: "expense", amount: String(FS.cyclePrice(c, S.items, S.settings.payerRecentCount)), cycleId: c.id, step: 3 });

/* ---------- бөлшектер ---------- */
function payerCard(c) {
  const T = today(), state = FS.payerState(c, T), left = FS.cycleDaysLeft(c, T), reminder = c.buffer ?? S.settings.payerReminderDays ?? 3, gone = c.status === "archived";
  const low = c.alert !== false && c.every > 0 && left <= reminder, price = FS.cyclePrice(c, S.items, S.settings.payerRecentCount);
  const status = gone ? "Архивте" : c.type === "tracked" || !c.every ? "Циклсіз бақылау" : state.status === "unpaid" ? `Төленбеді · ${state.next}` : `Келесі: ${state.next}`;
  return h("div", { class: "pcard" + (gone ? " gone" : "") },
    h("button", { class: "pbody", "aria-label": `Ішіне кіру: ${c.name}`, onclick: () => cycleDetail(c) }, cycTile(c), h("b", {}, c.name), h("small", { class: "num muted" }, `${tg(price)} · ${c.every > 0 ? c.every + " күн" : "цикл жоқ"}`), h("small", { class: "num " + (low ? "warn" : "muted") }, status),
      !gone && c.every > 0 && bar(Math.max(0, Math.min(100, Math.round(left / c.every * 100))), low)),
    !gone && h("button", { class: "pbuy", "aria-label": `Төлемді тіркеу: ${c.name}`, onclick: () => buyAgain(c) }, ic("check"), "Төлем енгізу"));
}

function goalRow(g, full, tag) {
  const done = g.saved >= g.target, pct = Math.min(100, Math.round(g.saved / g.target * 100));
  return h("div", { class: "row" + (done ? " gold" : "") + (tag ? " kx k-goal" : "") },
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
let jMonth = ""; // көрсетілген кезеңнің аты (басталған ай, YYYY-MM)
// Журнал сүзгісі: шот ("" = барлығы, "_" = шотсыз) және аралық (1/3/6/12 ай не 0 = өз аралығың); құрылғыда сақталады
let jv = (() => { try { const v = JSON.parse(localStorage.getItem("fs-jv")); return { acc: typeof v?.acc === "string" ? v.acc : "", span: [0, 1, 3, 6, 12].includes(v?.span) ? v.span : 1, from: typeof v?.from === "string" ? v.from : "", to: typeof v?.to === "string" ? v.to : "" }; } catch { return { acc: "", span: 1, from: "", to: "" }; } })();
const setJv = (patch) => { jv = { ...jv, ...patch }; try { localStorage.setItem("fs-jv", JSON.stringify(jv)); } catch {} render(); };
const WD = ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
const shiftMonth = (key, k) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5)) - 1 + k, 1)).toISOString().slice(0, 7);
const dm = (d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
// Күнтізбе батырмасы: не ай (1/3/6 ай, жыл), не өз аралығың
function pickPeriod(ym, from, to, custom) {
  const st = { mode: custom ? "range" : "month", m: ym, span: jv.span || 1, from, to }, dlg = h("dialog", { class: "sheet catdlg" });
  const seg = (list, key, cur) => h("div", { class: "seg2" + (list.length > 2 ? " four" : "") }, list.map(([k, t]) => h("button", { type: "button", "aria-pressed": String(cur === k), onclick: () => { st[key] = k; draw(); } }, t)));
  const draw = () => dlg.replaceChildren(h("h2", { class: "ctitle" }, "Кезең"), seg([["month", "Ай"], ["range", "Аралық"]], "mode", st.mode),
    st.mode === "month" ? h("div", { class: "sec crow" }, h("label", { class: "inl" }, "Ай", h("input", { type: "month", name: "m", value: st.m, "aria-label": "Ай", onchange: (e) => { st.m = e.target.value; } })), seg([[1, "1 ай"], [3, "3 ай"], [6, "6 ай"], [12, "Жыл"]], "span", st.span))
      : h("div", { class: "sec crow" }, h("label", { class: "inl" }, "Басы", h("input", { type: "date", name: "from", value: st.from, "aria-label": "Басы", onchange: (e) => { st.from = e.target.value; } })), h("label", { class: "inl" }, "Соңы", h("input", { type: "date", name: "to", value: st.to, "aria-label": "Соңы", onchange: (e) => { st.to = e.target.value; } }))),
    h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"), h("button", { type: "button", class: "primary", onclick: () => {
      if (st.mode === "month") { if (!st.m) return; jMonth = st.m; dlg.close(); return setJv({ span: st.span, from: "", to: "" }); }
      if (!st.from || !st.to || st.from > st.to) return alert("Басы соңынан кейін болмауы керек.");
      dlg.close(); setJv({ span: 0, from: st.from, to: st.to }); } }, "Қолдану")));
  dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); draw(); dlg.showModal();
}
// Қазақстан банктері: ресми логотип емес — шамамен бренд түсі мен қысқа әріп. Файл берсең, нақты логотипке ауыстырамыз
const KZ_CITIES = ["Астана", "Алматы", "Шымкент", "Қарағанды", "Ақтөбе", "Тараз", "Павлодар", "Өскемен", "Семей", "Қостанай", "Қызылорда", "Орал", "Атырау", "Петропавл", "Ақтау", "Көкшетау", "Түркістан", "Талдықорған", "Қонаев", "Теміртау", "Екібастұз", "Рудный", "Жезқазған", "Балқаш", "Арқалық", "Ақсу", "Жаңаөзен", "Сәтбаев", "Лисаков", "Степногорск", "Көкшетау", "Шу", "Ұштөбе"].filter((c, i, a) => a.indexOf(c) === i);
const BANKS = [["cash", "Қолма-қол", "#16a34a", "coin"], ["kaspi", "Kaspi", "#f14635", "K"], ["halyk", "Halyk", "#2fa84f", "H"], ["jusan", "Jusan", "#ff7a1a", "J"], ["forte", "ForteBank", "#c8102e", "F"], ["freedom", "Freedom", "#00a3e0", "Fr"], ["bereke", "Bereke", "#00833e", "B"], ["eurasian", "Eurasian", "#1e4ea1", "E"], ["homecredit", "Home Credit", "#e30613", "HC"], ["cenc", "CenterCredit", "#0a8f6b", "CC"], ["alatau", "Alatau City", "#2a3f8f", "AC"], ["rbk", "RBK", "#7a1fa2", "R"], ["nurbank", "Nurbank", "#e2231a", "N"], ["other", "Басқа", "#5b6470", "wallet"]];
const bankMark = (key) => { const b = BANKS.find((x) => x[0] === key) ?? ["", "", "#5b6470", "wallet"]; return h("span", { class: "bk", style: `background:${b[2]}`, "aria-hidden": "true" }, ICONS[b[3]] ? ic(b[3]) : b[3]); };
const AC = ["#0d7a52", "#5b6470", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899", "#06b6d4"]; // Журналдағы шот карталарының түсі
function home() {
  const T = today(), hide = S.settings.hide, mon = (n) => hide ? "••••• ₸" : tg(n), ms = S.settings.monthStart || 1, cur = FS.periodKey(T, ms), ym = jMonth || cur;
  const custom = jv.span === 0 && jv.from && jv.to, span = jv.span || 1;
  const from = custom ? jv.from : FS.periodRange(shiftMonth(ym, 1 - span), ms).from, to = custom ? jv.to : FS.periodRange(ym, ms).to;
  const ids = new Set(S.accounts.map((a) => a.id)), wal = FS.wallet(S), accId = jv.acc && (jv.acc === "_" || ids.has(jv.acc)) ? jv.acc : "";
  const inAcc = (id) => !accId || (ids.has(id) ? id : "_") === accId, inRange = (d) => d >= from && d <= to;
  const txs = S.tx.filter((t) => inAcc(t.account) && inRange(t.date)), trs = S.transfers.filter((t) => (!accId || inAcc(t.from) || inAcc(t.to)) && inRange(t.date));
  const stat = (id) => S.tx.filter((t) => (!id || (ids.has(t.account) ? t.account : "_") === id) && inRange(t.date)).reduce((a, t) => { a[t.kind] += t.amount; return a; }, { income: 0, expense: 0 });
  const days = {}, at = (d) => (days[d] ??= { tx: [], tr: [] });
  for (const t of txs) at(t.date).tx.push(t);
  for (const t of trs) at(t.date).tr.push(t);
  if (inRange(T)) at(T); // бүгінгі күнде әрқашан «+» бар
  const nm = (id) => S.accounts.find((a) => a.id === id)?.name ?? "Шотсыз";
  const [y2, m2] = ym.split("-");
  const title = custom ? `${dm(from)} – ${dm(to)}` : span === 1 ? `${MONTHS[Number(m2) - 1]} ${y2}` : `${MONTHS[Number(shiftMonth(ym, 1 - span).slice(5)) - 1]} – ${MONTHS[Number(m2) - 1]} ${y2}`;
  const sub = custom ? "" : `${dm(from)} – ${dm(to)}`;
  const go = (k) => { jMonth = shiftMonth(ym, k * span); if (jMonth >= cur) jMonth = ""; render(); };
  const chips = [["", "Барлығы", FS.balance(S)], ...(ids.size ? [...wal.accounts.map((a) => [a.id, a.name, a.balance]), ...(wal.loose != null ? [["_", "Шотсыз", wal.loose]] : [])] : [])];
  const mk = (t) => { const c = catInfo(t.category), sgn = t.kind === "income" ? "+" : "";
    return h("button", { class: "jt", style: `background:${c.color}`, "aria-label": `${t.category} ${tg(t.amount)}`, onclick: () => txForm(t) },
      h("span", { class: "wm", "aria-hidden": "true" }, ic(c.subs.find((x) => x.name === t.sub)?.icon || c.icon)), h("small", {}, t.sub || t.category), h("b", { class: "num" }, `${sgn}${mon(t.amount)}`)); };
  return [
    h("div", { class: "head" }, h("div", { class: "jtitle" }, h("h1", {}, title), sub && h("small", { class: "muted" }, sub)),
      h("div", { class: "hbtns" }, !custom && h("button", { class: "ghost round", "aria-label": "Бұрынғы кезең", onclick: () => go(-1) }, ic("chevl")), !custom && h("button", { class: "ghost round", "aria-label": "Кейінгі кезең", disabled: ym >= cur, onclick: () => go(1) }, ic("chev")),
        h("button", { class: "ghost round", "aria-label": "Кезеңді таңдау", onclick: () => pickPeriod(ym, from, to, custom) }, ic("calendar")),
        h("button", { class: "ghost round", "aria-label": hide ? "Сандарды көрсету" : "Сандарды жасыру", "aria-pressed": String(hide), onclick: () => { S.settings.hide = !hide; save(); } }, ic(hide ? "eye-off" : "eye")))),
    h("div", { class: "jcards", "aria-label": "Шот", onpointerdown: (e) => { e.currentTarget._u = 1; }, onwheel: (e) => { e.currentTarget._u = 1; }, onscroll: (e) => { // қолмен сырғытқанда ортадағы карта таңдалады (бағдарламалық жылжытуды елемейді)
        const el = e.currentTarget; if (!el._u) return; clearTimeout(el._t); el._t = setTimeout(() => { el._u = 0; if (!el.isConnected) return; const mid = el.scrollLeft + el.clientWidth / 2, c = [...el.children].reduce((p, x) => (Math.abs(x.offsetLeft + x.offsetWidth / 2 - mid) < Math.abs(p.offsetLeft + p.offsetWidth / 2 - mid) ? x : p));
          if (c.dataset.id !== (jv.acc || "")) setJv({ acc: c.dataset.id }); }, 140); } },
      chips.map(([id, name, b], k) => { const st = stat(id === "_" ? "_" : id);
        return h("button", { class: "jcard", "data-id": id, "data-sel": String(id === accId), style: `--cc:${BANKS.find((x) => x[0] === S.accounts.find((y) => y.id === id)?.bank)?.[2] ?? AC[id === "" ? 0 : id === "_" ? 1 : 2 + Math.max(0, S.accounts.findIndex((x) => x.id === id)) % (AC.length - 2)]}`, "aria-pressed": String(id === accId), "aria-label": `Шот: ${name}`, onclick: () => setJv({ acc: id }) },
          S.accounts.find((x) => x.id === id)?.bank ? h("span", { class: "jcb" }, bankMark(S.accounts.find((x) => x.id === id).bank)) : h("span", { class: "jcw", "aria-hidden": "true" }, ic("wallet")), h("small", {}, name), h("b", { class: "num" }, mon(b)),
          h("span", { class: "jcs num" }, h("span", {}, `+${mon(st.income)}`), h("span", {}, `−${mon(st.expense)}`))); })),
    chips.length > 1 ? h("div", { class: "jdots", "aria-hidden": "true" }, chips.map(([id]) => h("i", { class: id === accId ? "on" : "" }))) : null,
    ...Object.keys(days).sort().reverse().map((d) => { const x = days[d], tot = x.tx.reduce((a, t) => a + (t.kind === "income" ? t.amount : -t.amount), 0);
      return h("section", { class: "jday" },
        h("div", { class: "jh" }, h("b", {}, `${Number(d.slice(8))} ${WD[new Date(d + "T00:00:00").getDay()]}`), h("span", { class: "num " + (tot < 0 ? "warn" : "good") }, x.tx.length ? `${tot > 0 ? "+" : "−"}${mon(Math.abs(tot))}` : "")),
        h("div", { class: "jgrid" }, ...x.tx.map(mk),
          ...x.tr.map((t) => h("div", { class: "jt tr", "aria-label": `${nm(t.from)} → ${nm(t.to)} ${tg(t.amount)}` }, h("span", { class: "wm", "aria-hidden": "true" }, ic("swap")), h("small", {}, `${nm(t.from)} → ${nm(t.to)}`), h("b", { class: "num" }, mon(t.amount)))),
          h("button", { class: "jt jadd", "aria-label": `Қосу: ${d}`, onclick: () => openAdd({ date: d }) }, ic("plus"))));
    }),
    Object.keys(days).length ? null : empty("Бұл аралықта жазба жоқ."),
  ];
}

function plan() {
  const T = today(), m = FS.monthTotals(S.tx, T, S.settings.monthStart), w = FS.wallet(S), hide = S.settings.hide, mon = (n) => hide ? "*** ₸" : tg(n), next = liveCycles().filter((c) => c.every > 0).sort((a, b) => FS.nextBuy(a).localeCompare(FS.nextBuy(b))), f = FS.forecast(S, T, 3);
  return [
    head("Summary"),
    sec("Шығындар бөлінісі", null, donut(m)),
    Object.keys(m.byCat).length ? sec("Санаттар", null, h("div", { class: "cards" }, Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => h("div", { class: "card2" },
      h("span", { class: "nm" }, h("i", { style: `background:${catInfo(k).color}` }), k), h("b", { class: "num" }, mon(v)),
      h("small", { class: "muted" }, (catInfo(k).budget ? `Бюджет ${mon(catInfo(k).budget)} · ${Math.round(v / catInfo(k).budget * 100)}%\n` : "") + Object.entries(m.bySub[k] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([sk, sv]) => `${sk} · ${mon(sv)}`).join("\n") || " "))))) : null,
    S.incomes.length ? sec("Кіріс көздері", null, S.incomes.map((i) => { const got = S.tx.filter((t) => t.kind === "income" && FS.periodKey(t.date, S.settings.monthStart) === FS.periodKey(T, S.settings.monthStart) && FS.normCat(t.category) === FS.normCat(i.name)).reduce((a, t) => a + t.amount, 0), pct = Math.min(100, Math.round(got / i.amount * 100));
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, i.name), h("small", { class: "num muted" }, `${mon(got)} / ${mon(i.amount)} · ${pct}%`), bar(pct))); })) : null,
    S.goals.length ? sec("Жинақтар", null, FS.goalsView(S).map((g) => goalRow(g))) : null,
    sec("Шоттар", null, S.accounts.length || w.loose !== null ? h("div", { class: "cards" }, [...w.accounts.map((a) => [a.name, a.balance]), ...(w.loose !== null ? [["Шотсыз", w.loose]] : [])].map(([n, b]) => h("div", { class: "card2" },
      h("span", { class: "nm" }, h("i", { style: `background:${catColor(n)}` }), n), h("b", { class: "num " + (b < 0 ? "warn" : "") }, mon(b)), h("small", {}, " ")))) : empty("Шот жоқ. «Профиль» бөлімінде қос.")),
    sec("Келесі төлемдер", null, next.length ? next.map((c) => h("div", { class: "row" },
      h("div", { class: "main" }, h("b", {}, c.name), h("small", { class: "muted num" }, FS.nextBuy(c) < T ? "Мерзімі өтті" : FS.nextBuy(c))),
      h("span", { class: "num" }, tg(FS.cyclePrice(c, S.items, S.settings.payerRecentCount))))) : empty("Циклді төлем жоқ.")),
    sec("Алдағы 3 айдың болжамы", null,
      h("table", { class: "num" }, h("thead", {}, h("tr", {}, ["Ай", "Циклді төлемдер", "Мақсат", "Бөліп-төлем", "Барлығы"].map((t) => h("th", {}, t)))),
        h("tbody", {}, f.map((r) => h("tr", {}, h("td", {}, MONTHS[Number(r.month.slice(5)) - 1]), h("td", {}, fmt(r.cycles)), h("td", {}, fmt(r.goals)), h("td", {}, fmt(r.installments)), h("td", {}, h("b", {}, fmt(r.total))))))),
      h("p", { class: "muted" }, `Барлығы ішінде тұрақты шығын бар: ${tg(S.settings.fixed)} / ай. Айлық кіріс: ${tg(S.settings.income)}.`)),
  ];
}

let accTab = (() => { try { return localStorage.getItem("fs-acc") === "goal" ? "goal" : "freq"; } catch { return "freq"; } })();
const addInst = (pre = {}, then) => ask("Жаңа бөліп-төлем", [
  { name: "name", label: "Не үшін", value: pre.name ?? "" },
  { name: "total", label: "Жалпы сома, ₸", type: "number", min: 1, value: pre.total ?? "" },
  { name: "months", label: "Неше ай", type: "number", min: 1, step: 1 },
  { name: "start", label: "Бірінші төлем күні", type: "date", value: today() },
], (v) => { put("installments", { id: crypto.randomUUID(), name: v.name.trim(), total: num(v.total), months: Math.round(num(v.months)), start: v.start, paid: 0 }); then?.(); save(); });
const arc = { payer: false, fin: false, wish: false }; // «Архив» белгішесі: аяқталғандарды көрсету/жасыру
const arcBtn = (k) => h("button", { class: "ghost round sm" + (arc[k] ? " on" : ""), "aria-label": "Архив", "aria-pressed": String(arc[k]), onclick: () => { arc[k] = !arc[k]; render(); } }, ic("archive"));
const hdr = (k, addFn) => h("div", { class: "hbtns" }, arcBtn(k), addFn && add(addFn));
const payInst = (x) => ask(`Төлем: ${x.name}`, [{ name: "amount", label: "Сома, ₸", type: "number", min: 0.01, value: FS.instPay(x) }, ...accField()], (v) => {
  put("tx", withAcc({ id: crypto.randomUUID(), kind: "expense", amount: num(v.amount), category: "Бөліп-төлем", note: x.name, date: today() }, v));
  put("installments", { ...x, paid: x.paid + 1 }); save(); });
function instRow(x) {
  const done = FS.instDone(x), paidSum = Math.min(x.total, x.total - FS.instLeft(x)), pct = Math.round(paidSum / x.total * 100), due = FS.instDue(x);
  return h("div", { class: "row kx k-inst" + (done ? " gold" : "") }, h("div", { class: "main" }, h("b", {}, x.name),
    h("small", { class: "num muted" }, `${tg(paidSum)} / ${tg(x.total)} · ${x.paid}/${x.months} ай`),
    h("small", { class: done ? "" : due < today() ? "warn" : "muted" }, done ? "Толық төленді" : `${due < today() ? "Мерзімі өтті" : "Келесі"}: ${due} · ${tg(FS.instPay(x))}`), bar(pct)),
    !done && h("button", { onclick: () => payInst(x) }, ic("check"), "Төледім"), del("installments", x.id, x.name));
}
const addFin = () => {
  const dlg = h("dialog", {}), go = (f) => () => { dlg.close(); f(); };
  dlg.append(h("h3", {}, "Не қосасың?"), h("div", { class: "kpick" },
    h("button", { class: "k-inst", onclick: go(() => addInst()) }, h("b", {}, "Бөліп-төлем"), h("small", {}, "Алынған затты ай сайын жабу")),
    h("button", { class: "k-goal", onclick: go(addGoal) }, h("b", {}, "Жинақ"), h("small", {}, "Мақсатқа ақша жинау"))),
  h("div", { class: "end" }, h("button", { class: "ghost", onclick: () => dlg.close() }, "Бас тарту")));
  dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal();
};

// Тілек: екі бөлек шкала (қажеттілік, қалау) → приоритет (FS.wishScore)
const WN = [["0", "Қажет емес"], ["1", "Ыңғайсыздау болады"], ["2", "Тұрмыс қиындайды"], ["3", "Жұмыс не оқу бұзылады"], ["4", "Денсаулыққа не қауіпсіздікке зиян"], ["5", "Негізгі қажеттілік: тамақ, баспана, ем"]];
const WW = [["0", "Қаламаймын"], ["1", "Жай ғана ұнайды"], ["2", "Біраз қалаймын"], ["3", "Қатты қалаймын"], ["4", "Өте қатты қалаймын"], ["5", "Үнемі ойлаймын"]], WL = ["Жоғары", "Орташа", "Төмен"];
const wishForm = (w) => { const sc = w ? FS.wishScores(w) : { need: 0, want: 3 }; return ask(w ? "Тілекті өзгерту" : "Жаңа тілек", [
  { name: "name", label: "Не қалайсың", value: w?.name ?? "" },
  { name: "price", label: "Бағасы, ₸", type: "number", min: 1, value: w?.price ?? "" },
  { name: "need", label: "Қажеттілік шкаласы: онсыз не болады?", options: WN, value: String(sc.need) },
  { name: "want", label: "Қалау шкаласы: қаншалықты қалайсың?", options: WW, value: String(sc.want) },
  { name: "image", label: w?.image ? "Суретті ауыстыру" : "Сурет", type: "file", optional: true }],
async (v) => { const image = v.image?.size ? await shrink(v.image, 480).catch(() => "") : w?.image;
  const { kind, when, ...rest } = w ?? {};
  put("wishes", { ...rest, id: w?.id ?? crypto.randomUUID(), name: v.name.trim(), price: num(v.price), need: num(v.need), want: num(v.want), created: w?.created ?? today(), ...(image ? { image } : {}) }); save(); }); };
const wishChips = (w) => { const x = FS.wishScores(w); return h("div", { class: "wchips" }, h("span", { class: "wchip p" + FS.wishLevel(w) }, WL[FS.wishLevel(w)]), h("span", { class: "wchip" }, `Қажет ${x.need}/5`), h("span", { class: "wchip" }, `Қалау ${x.want}/5`)); };
const buyWish = (w) => ask(`Сатып алу: ${w.name}`, [{ name: "amount", label: "Сома, ₸", type: "number", min: 0.01, value: w.price }, { name: "category", label: "Санат", options: catOpts("expense", "Басқа"), value: "Басқа" }, ...accField()], (v) => {
  put("tx", withAcc({ id: crypto.randomUUID(), kind: "expense", amount: num(v.amount), category: FS.normCat(v.category), note: w.name, date: today() }, v));
  put("wishes", { ...w, status: "done", to: "tx" }); save(); });
// Қалау уақыт өте басылуы мүмкін: жаңа, бірақ қатты қалауға 30 күн күту — практикалық кеңес (ғылыми дәлелденген ереже емес)
const wishAge = (w) => { if (!w.created || w.status === "done") return null; const d = FS.daysBetween(w.created, today()), x = FS.wishScores(w);
  return h("p", { class: "muted" }, `Тізімде ${d} күн.`, x.want > x.need && x.need < 3 && d < 30 ? " Қалау жаңа: 30 күн күтіп, әлі қаласаң сатып ал." : ""); };
function wishDetail(w) {
  const done = w.status === "done", dlg = h("dialog", {}), mark = (to) => { put("wishes", { ...w, status: "done", to }); save(); }, go = (f) => () => { dlg.close(); f(); };
  dlg.append(...[w.image ? h("img", { class: "wimg", src: w.image, alt: w.name }) : null, h("h3", {}, w.name), h("p", { class: "num" }, tg(w.price)), wishChips(w), wishAge(w),
    done ? h("p", { class: "good" }, w.to === "inst" ? "Бөліп-төлемге өтті" : w.to === "tx" ? "Сатып алынды" : "Жинаққа өтті") : null,
    h("div", { class: "end wrap" },
      !done && h("button", { class: "primary", onclick: go(() => buyWish(w)) }, "Сатып алдым"),
      !done && h("button", { onclick: go(() => ask("Неше айда жинайсың?", [{ name: "months", label: "Неше ай", type: "number", min: 1, step: 1 }], (v) => { put("goals", { id: crypto.randomUUID(), name: w.name, target: w.price, months: Math.round(num(v.months)), saved: 0, start: today() }); mark("goal"); })) }, "Жинауды бастау"),
      !done && h("button", { onclick: go(() => addInst({ name: w.name, total: w.price }, () => mark("inst"))) }, "Бөліп-төлемге алдым"),
      h("button", { onclick: go(() => wishForm(w)) }, "Өзгерту"),
      h("button", { class: "warn", onclick: () => { if (delNow("wishes", w.id, w.name)) dlg.close(); } }, "Өшіру"),
      h("button", { class: "ghost", onclick: () => dlg.close() }, "Жабу"))].filter(Boolean));
  dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal();
}
function wishRow(w) {
  const done = w.status === "done";
  return h("button", { class: "wcard" + (done ? " gone" : ""), "aria-label": `Ішіне кіру: ${w.name}`, onclick: () => wishDetail(w) },
    w.image ? h("img", { src: w.image, alt: "", loading: "lazy" }) : h("div", { class: "wph", "aria-hidden": "true" }, ic("gift")),
    h("b", {}, w.name), h("small", { class: "num muted" }, tg(w.price)),
    done ? h("small", { class: "good" }, w.to === "inst" ? "Бөліп-төлемге өтті" : w.to === "tx" ? "Сатып алынды" : "Жинаққа өтті") : wishChips(w));
}
function stock() {
  const matchCard = (m) => {
    const r = FS.brandMatch(m.brands);
    return h("div", { class: "row", style: "align-items:flex-start" }, h("div", { class: "main" }, h("b", {}, m.name),
      h("table", { class: "num" }, h("thead", {}, h("tr", {}, ["Бренд", "Баға", "Күн", "₸/күн"].map((t) => h("th", {}, t)))),
        h("tbody", {}, r.rows.map((x, i) => h("tr", { class: i === r.best ? "best" : "" }, h("td", {}, i === r.best ? `${x.name} · үздік` : x.name), h("td", {}, fmt(x.price)), h("td", {}, x.days), h("td", {}, x.perDay.toFixed(1)))))),
      h("small", { class: "good" }, `Үздігін таңдасаң, жылына ${tg(r.yearSaving)} үнем`)), del("matches", m.id, m.name));
  };
  const T = today(), soon = FS.addDays(T, 14), seg = h("div", { class: "seg tabs", role: "tablist" }, ...[["freq", "Жиі-төлем"], ["goal", "Мақсат"]].map(([k, t]) =>
    h("button", { type: "button", role: "tab", "aria-selected": String(accTab === k), "aria-pressed": String(accTab === k), onclick: () => { accTab = k; try { localStorage.setItem("fs-acc", k); } catch {} render(); } }, t)));
  if (accTab === "goal") {
    const fin = [...S.installments.filter((x) => FS.instDone(x) === arc.fin).sort((a, b) => FS.instDue(a).localeCompare(FS.instDue(b))).map(instRow), ...FS.goalsView(S).filter((g) => (g.saved >= g.target) === arc.fin).map((g) => goalRow(g, true, true))];
    const wishes = S.wishes.filter((w) => (w.status === "done") === arc.wish).sort((a, b) => FS.wishScore(b) - FS.wishScore(a) || (a.created || "").localeCompare(b.created || "") || a.price - b.price);
    return [head("Есеп"), seg,
      sec(arc.fin ? "Бөліп-төлем және жинақ · архив" : "Бөліп-төлем және жинақ", hdr("fin", addFin), fin.length ? fin : empty(arc.fin ? "Архив бос." : "Бөліп-төлем не жинақ жоқ. Мысалы: Mac 12 ай, саяхат.")),
      sec(arc.wish ? "Wish List · архив" : "Wish List", hdr("wish", () => wishForm()), wishes.length ? h("div", { class: "wgrid" }, wishes.map(wishRow)) : empty(arc.wish ? "Архив бос." : "Арманыңды жаз, кейін сатып аласың, жинайсың не бөліп-төлемге аласың."))];
  }
  const upcoming = [...liveCycles().filter((c) => c.every > 0 && FS.nextBuy(c) <= soon).map((c) => ({ date: FS.nextBuy(c), name: c.name, sum: FS.cyclePrice(c, S.items, S.settings.payerRecentCount), ok: () => buyAgain(c), label: "Төлем енгізу" })),
    ...S.installments.filter((x) => !FS.instDone(x) && FS.instDue(x) <= soon).map((x) => ({ date: FS.instDue(x), name: x.name, sum: FS.instPay(x), ok: () => payInst(x), label: "Төледім" }))].sort((a, b) => a.date.localeCompare(b.date));
  const pl = arc.payer ? S.cycles.filter((c) => c.status === "archived") : liveCycles();
  return [head("Есеп"), seg,
    sec("Алда күтілетін (14 күн)", null, upcoming.length ? upcoming.map((u) => h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, u.name), h("small", { class: "num " + (u.date < T ? "warn" : "muted") }, `${u.date < T ? "Мерзімі өтті" : u.date} · ${tg(u.sum)}`)), h("button", { onclick: u.ok }, ic("check"), u.label))) : empty("Жақын 14 күнде төлем жоқ.")),
    sec(arc.payer ? "Төлемгерлер · архив" : "Төлемгерлер", hdr("payer", () => addCycle()),
      pl.length ? h("div", { class: "pgrid" }, pl.map(payerCard)) : empty(arc.payer ? "Архив бос." : "Төлемгер — қайталанатын шығын: шаш қию, Netflix, кофе. Қосымша орташа бағасын, келесі күнін есептеп, ескертеді.")),
    sec("Смарт-салыстыру", add(addMatch), S.matches.length ? S.matches.map(matchCard) : empty("Екі брендті қатар қойып, ₸/күн бойынша үздігін тап.")),
  ];
}

let walletRange = "month";
let walletCustom = { from: "", to: "" };
function walletPage() {
  const T = today(), w = FS.wallet(S), hide = S.settings.hide, mon = (n) => hide ? "••••••" : tg(n), total = FS.balance(S);
  const range = walletRangeInfo(T);
  const pockets = [...w.accounts, ...(w.loose !== null ? [{ id: "", name: "Шотсыз", balance: w.loose }] : [])];
  const inRange = (date) => !date || ((!range.from || date >= range.from) && (!range.to || date <= range.to));
  const metric = (id) => {
    const own = (x) => (x.account || "") === id;
    const out = { income: 0, expense: 0, goals: 0, in: 0, out: 0 };
    for (const x of S.tx) if (inRange(x.date) && own(x)) out[x.kind] += x.amount;
    for (const x of S.contribs || []) if (inRange(x.date) && own(x)) out.goals += x.amount;
    for (const x of S.transfers || []) if (inRange(x.date)) {
      if ((x.to || "") === id) out.in += x.amount;
      if ((x.from || "") === id) out.out += x.amount;
    }
    out.net = out.income - out.expense - out.goals + out.in - out.out;
    return out;
  };
  const customRange = () => ask("Уақыт аралығы", [
    { name: "from", label: "Басталуы", type: "date", value: walletCustom.from || range.from || T },
    { name: "to", label: "Аяқталуы", type: "date", value: walletCustom.to || range.to || T },
  ], (v) => {
    if (v.from > v.to) return alert("Басталу күні аяқталу күнінен кейін болмауы керек.");
    walletCustom = { from: v.from, to: v.to }; walletRange = "custom"; render();
  });
  const chooseRange = (key) => { if (key === "custom") return customRange(); walletRange = key; render(); };
  const rangeBar = h("div", { class: "wallet-range", role: "tablist", "aria-label": "Уақыт аралығы" },
    [["month", "Осы ай"], ["30d", "30 күн"], ["90d", "90 күн"], ["year", "Жыл"], ["all", "Барлығы"], ["custom", "Өзім"]].map(([key, label]) =>
      h("button", { type: "button", role: "tab", "aria-selected": String(walletRange === key), "aria-pressed": String(walletRange === key), onclick: () => chooseRange(key) }, label)));
  const cards = pockets.map((a) => {
    const m = metric(a.id), sign = m.net > 0 ? "+" : m.net < 0 ? "−" : "";
    return h("article", { class: "account-card" },
      h("div", { class: "account-card-head" }, bankMark(a.bank), h("b", {}, a.name), a.id && h("button", { class: "ghost sm acts", "aria-label": `Әрекеттер: ${a.name}`, onclick: () => acctMenu(a) }, ic("more"))),
      h("div", { class: "account-balance num " + (a.balance < 0 ? "warn" : "") }, mon(a.balance)),
      h("small", { class: "muted" }, range.label),
      h("div", { class: "account-net num " + (m.net < 0 ? "warn" : m.net > 0 ? "good" : "muted") }, `${sign}${mon(Math.abs(m.net))}`),
      h("div", { class: "account-breakdown" },
        h("span", {}, h("small", { class: "muted" }, "Кіріс"), h("b", { class: "num" }, mon(m.income))),
        h("span", {}, h("small", { class: "muted" }, "Шығыс"), h("b", { class: "num" }, mon(m.expense)))));
  });
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
    h("div", { class: "wallet-head" }, h("div", {}, h("h1", {}, "Шоттар"), h("p", { class: "muted" }, `${pockets.length || 0} шот · ${range.label}`)), h("button", { class: "ghost round", "aria-label": hide ? "Сомаларды көрсету" : "Сомаларды жасыру", "aria-pressed": String(hide), onclick: () => { S.settings.hide = !hide; save(); } }, ic(hide ? "eye-off" : "eye"))),
    h("section", { class: "wallet-total" }, h("div", { class: "wallet-total-top" }, h("span", { class: "muted" }, "Барлық қаражат"), h("span", { class: "chip" }, "Қазір")),
      h("div", { class: "wallet-total-value num" }, mon(total)), h("small", { class: "muted" }, "Мақсаттарға аударылған сома кірмейді")),
    h("section", { class: "sec wallet-filter-card" }, h("header", {}, h("h2", {}, "Кезең"), h("small", { class: "muted" }, range.detail)), rangeBar),
    sec("Шоттар", add(() => acctForm()),
      pockets.length ? h("div", { class: "account-grid" }, cards) : empty("Шот жоқ. Қолма-қол, карта сияқты шоттарды қос: әр транзакция шотқа байланады.")),
    S.accounts.length ? h("div", { class: "end wallet-actions", style: "margin-top:0" }, h("button", { onclick: trForm }, ic("swap"), "Шоттар арасында аудару")) : null,
    S.transfers.length ? sec("Аударымдар", null, [...S.transfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((t) => {
      const nm = (id) => S.accounts.find((a) => a.id === id)?.name ?? "Шотсыз";
      return h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, `${nm(t.from)} → ${nm(t.to)}`), h("small", { class: "muted" }, t.date)), h("span", { class: "num" }, mon(t.amount)), del("transfers", t.id, `${nm(t.from)} → ${nm(t.to)}`));
    })) : null,
  ];
  function acctForm(a) { const cur = a?.balance ?? 0, bankOpts = [["", "—"], ...BANKS.map((b) => [b[0], b[1]])];
    return ask(a ? "Шотты өзгерту" : "Жаңа шот", [{ name: "name", label: "Атауы (бос болса — банк аты)", optional: true, value: a?.name ?? "" }, { name: "bank", label: "Банк не түрі", options: bankOpts, value: a?.bank ?? "" },
      a ? { name: "cur", label: "Қазіргі қалдық, ₸", type: "number", min: -1e12, value: cur } : { name: "opening", label: "Қазіргі қалдық, ₸", type: "number", min: -1e12, value: 0 }],
    (v) => { const name = v.name.trim() || BANKS.find((b) => b[0] === v.bank)?.[1] || "Шот";
      put("accounts", a ? { ...a, name, bank: v.bank, opening: a.opening + (num(v.cur) - cur) } : { id: crypto.randomUUID(), name, bank: v.bank, opening: num(v.opening) }); save(); }); }
  function acctMenu(a) { const dlg = h("dialog", {}), go = (f) => () => { dlg.close(); f(); };
    dlg.append(h("h3", {}, a.name), h("div", { class: "end wrap" }, h("button", { onclick: go(() => acctForm(a)) }, "Өзгерту"), h("button", { class: "warn", onclick: go(() => delAcc(a)) }, "Өшіру"), h("button", { class: "ghost", onclick: () => dlg.close() }, "Жабу")));
    dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal(); }
}

function walletRangeInfo(T) {
  const month = `${T.slice(0, 7)}-01`;
  const ranges = {
    month: { from: month, to: T, label: "Осы ай", detail: `${month.slice(8)}.${month.slice(5, 7)} — ${T.slice(8)}.${T.slice(5, 7)}` },
    "30d": { from: FS.addDays(T, -29), to: T, label: "Соңғы 30 күн", detail: `${FS.addDays(T, -29)} — ${T}` },
    "90d": { from: FS.addDays(T, -89), to: T, label: "Соңғы 90 күн", detail: `${FS.addDays(T, -89)} — ${T}` },
    year: { from: `${T.slice(0, 4)}-01-01`, to: T, label: "Осы жыл", detail: `01.01.${T.slice(0, 4)} — ${T}` },
    all: { from: "", to: T, label: "Барлық уақыт", detail: "Барлық жазбалар" },
  };
  if (walletRange === "custom") return { from: walletCustom.from, to: walletCustom.to, label: "Таңдалған кезең", detail: `${walletCustom.from} — ${walletCustom.to}` };
  return ranges[walletRange] || ranges.month;
}

/* ---------- санпернелі енгізу: 1) сома 2) санат не тауар 3) егжей-тегжей ---------- */
const PALETTE = ["#f59e0b", "#6d4ad8", "#3b82f6", "#10b981", "#ec4899", "#84cc16", "#06b6d4", "#ef4444"];
const catColor = (n) => PALETTE[[...FS.normCat(n)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
// Санат көрінісі: сақталған жазба, болмаса әдепкі стиль; ішкі санат — { name, icon }
const DEF_STYLE = { "Тамақ": ["utensils", "#ef9b37"], "Көлік": ["car", "#5b3cc4"], "Тұрмыс": ["home", "#8ecb3e"], "Кітап": ["book", "#ec4899"], "Күтім": ["heart", "#62d6c0"], "Жалақы": ["wallet", "#8ecb3e"], "Басқа": ["tag", "#d9d9d9"] };
const COLORS_PICK = ["#e5534b", "#f43f5e", "#f97316", "#ef9b37", "#e3be40", "#a3e635", "#8ecb3e", "#22c55e", "#10b981", "#62d6c0", "#06b6d4", "#38bdf8", "#3b82f6", "#6366f1", "#5b3cc4", "#a21cf3", "#d946ef", "#ec4899", "#b45309", "#78716c", "#5b6470", "#334155", "#d9d9d9", "#0f172a"];
const ICON_KEYS = ["utensils", "coffee", "soda", "bag", "cart", "car", "bus", "plane", "home", "book", "grad", "heart", "pill", "smile", "film", "music", "gift", "phone", "monitor", "wifi", "zap", "drop", "scissors", "briefcase", "star", "moon", "sun", "tag", "card", "trend", "shield", "tool", "pin", "box", "wallet", "camera", "target",
  "fuel", "truck", "bike", "shirt", "bed", "key", "tv", "laptop", "headphones", "gamepad", "dumbbell", "paw", "baby", "tree", "cake", "umbrella", "bell", "clock", "globe", "cloud", "percent", "coin", "palette", "pen", "flag", "flame", "ticket", "sparkles"];
function catInfo(name) {
  const n = FS.normCat(name), rec = S.categories.find((c) => FS.normCat(c.name) === n), d = DEF_STYLE[n];
  return { name: n, rec, color: rec?.color || d?.[1] || catColor(n), icon: rec?.icon || d?.[0] || "tag", budget: rec?.budget || 0, subs: (rec?.subs ?? []).map((x) => (typeof x === "string" ? { name: x, icon: "" } : x)) };
}
// Санаттар тізімі: сақталғандар, қолданылғандар, әдепкілер
function allCats(kind) {
  const used = {}; for (const t of S.tx) if (t.kind === kind) used[FS.normCat(t.category)] = (used[FS.normCat(t.category)] || 0) + 1;
  const dflt = kind === "income" ? ["Жалақы", ...S.incomes.map((i) => i.name)] : CATS.filter((c) => c !== "Жалақы");
  const gone = new Set(S.categories.filter((c) => c.hidden).map((c) => FS.normCat(c.name))); // өшірілген санаттар қайта шықпайды
  const names = [...S.categories.filter((c) => !c.hidden && (c.kind || "expense") === kind).map((c) => c.name), ...Object.keys(used).sort((a, b) => used[b] - used[a]), ...dflt];
  return [...new Set(names.map(FS.normCat))].filter((n) => !gone.has(n)).map(catInfo);
}
const tile = (name, inner, big) => { const c = catInfo(name); return h("span", { class: "tile" + (big ? " big" : ""), style: `background:${c.color}`, "aria-hidden": "true" }, inner ?? (ICONS[c.icon] ? ic(c.icon) : [...name][0]?.toUpperCase())); };
const grp = (s) => { const [a, b] = String(s || "0").split("."); return a.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (b !== undefined ? "." + b : ""); };
const topCats = (kind) => {
  const m = {}; for (const t of S.tx) if (t.kind === kind) m[FS.normCat(t.category)] = (m[FS.normCat(t.category)] || 0) + 1;
  return allCats(kind).map((c) => c.name).sort((a, b) => (m[b] || 0) - (m[a] || 0));
};
const sel = (name, opts, val) => h("select", { name }, opts.map(([v, t]) => h("option", { value: v, selected: v === val }, t)));
const fld = (label, input) => h("label", {}, label, input);
const KINDS = [["expense", "Шығыс"], ["income", "Кіріс"], ["transfer", "Аударым"]];

function openAdd(init = {}) {
  const st = { mode: init.cycleId ? "item" : "tx", kind: "expense", amount: "", step: 1, cat: "", cycleId: "", ...init };
  st.expr ??= st.amount; if (!st.amount) st.expr = "";
  const dlg = h("dialog", { class: "sheet" });
  const draw = () => { dlg.className = "sheet" + (st.step === 1 ? " pk" : ""); dlg.replaceChildren(...[view1, view2, view3][st.step - 1]().flat().filter(Boolean)); };
  const OPS = "+−×÷", lastNum = () => st.expr.split(/[+−×÷]/).pop();
  const calc = (e) => { const t = e.replace(/[+−×÷]$/, "").split(/([+−×÷])/); if (!t[0]) return NaN; const v = [Number(t[0])], o = [];
    for (let i = 1; i < t.length; i += 2) { const x = Number(t[i + 1]); if (t[i] === "×") v[v.length - 1] *= x; else if (t[i] === "÷") v[v.length - 1] /= x; else { o.push(t[i]); v.push(x); } }
    return v.reduce((a, x, i) => (o[i - 1] === "−" ? a - x : a + x)); };
  const key = (k) => {
    const a = st.expr, n = lastNum();
    if (k === "back") st.expr = a.slice(0, -1);
    else if (OPS.includes(k)) { if (a) st.expr = OPS.includes(a.at(-1)) ? a.slice(0, -1) + k : a + k; }
    else if (k === ".") { if (!n.includes(".")) st.expr = a + (n ? "." : "0."); }
    else if (/^\d$/.test(k) && (n.includes(".") ? n.split(".")[1].length < 2 : n.length < 9)) st.expr = n === "0" ? a.slice(0, -1) + k : a + k;
    const r = calc(st.expr); st.amount = r > 0 && isFinite(r) ? String(Math.round(r * 100) / 100) : "";
    draw();
  };
  const ok = () => num(st.amount) > 0;
  const next = () => { if (!ok()) return; if (/[+−×÷]/.test(st.expr)) { st.expr = st.amount; draw(); } else { st.step = 2; draw(); } };
  const shown = () => st.expr.replace(/\d+(\.\d*)?/g, (m) => grp(m));
  const MODES = [["tx", "Транзакция", "wallet"], ["item", "Төлемгер", "box"]], KICON = { expense: "minus", income: "plus", transfer: "swap" };
  const view1 = () => [
    h("div", { class: "phead" }, h("div", { class: "seg modes" }, ...MODES.map(([m, t, i]) => h("button", { type: "button", "aria-label": t, title: t, "aria-pressed": String(st.mode === m), onclick: () => { st.mode = m; st.kind = "expense"; st.cycleId = ""; draw(); } }, ic(i)))),
      h("div", { class: "ptitle" }, h("b", {}, st.mode === "item" ? "Төлемгер" : { expense: "Төледім", income: "Түсті", transfer: "Аударым" }[st.kind]), h("span", { class: "amtchip num" }, `₸${grp(st.amount)}`)),
      h("button", { type: "button", class: "ghost round", "aria-label": "Чек сканерлеу", onclick: () => { dlg.close(); receiptFlow(); } }, ic("camera"))),
    h("div", { class: "ppanel" },
      h("div", { class: "amt num", "aria-live": "polite" }, (shown() || "0") + " ₸"),
      h("div", { class: "krow" }, st.mode === "tx" ? h("div", { class: "kseg" }, ...KINDS.map(([k, t]) => h("button", { type: "button", "aria-label": t, title: t, "aria-pressed": String(st.kind === k), onclick: () => { st.kind = k; draw(); } }, ic(KICON[k])))) : h("div"),
        h("button", { type: "button", class: "op", "aria-label": "Бөлу", onclick: () => key("÷") }, "÷")),
      h("div", { class: "pad" }, ...[["7"], ["8"], ["9"], ["×", "Көбейту"], ["4"], ["5"], ["6"], ["−", "Алу"], ["1"], ["2"], ["3"], ["+", "Қосу"], [".", "Нүкте"], ["0"], ["back", "Өшіру"], ["ok", "Келесі"]].map(([k, l]) =>
        k === "ok" ? h("button", { type: "button", class: "okb", "aria-label": l, disabled: !ok(), onclick: next }, ic("check"))
          : h("button", { type: "button", class: OPS.includes(k) ? "op" : "", "aria-label": l || k, onclick: () => key(k) }, k === "back" ? ic("back") : k === "." ? "," : k))))];
  const pick = (patch) => { Object.assign(st, patch, { step: 3 }); draw(); };
  const view2 = () => {
    const back = h("button", { type: "button", class: "ghost", onclick: () => { st.step = 1; draw(); } }, "Артқа");
    if (st.kind === "transfer") {
      const w = FS.wallet(S), opts = [...S.accounts.map((a) => [a.id, a.name]), ...(w.loose !== null ? [["", "Шотсыз"]] : [])];
      if (opts.length < 2) return [h("h3", {}, "Аударым"), h("p", { class: "muted" }, "Аударым үшін кемінде екі шот керек. Шотты «Профиль» бөлімінде қос."), h("div", { class: "end" }, back)];
      const f = h("form", { onsubmit: (e) => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        if (v.from === v.to) return alert("Қайдан және қайда бірдей болмауы керек.");
        put("transfers", { id: crypto.randomUUID(), from: v.from, to: v.to, amount: num(st.amount), date: v.date }); save(); dlg.close();
      } }, fld("Қайдан", sel("from", opts, opts[0][0])), fld("Қайда", sel("to", opts, opts[1][0])), fld("Күні", h("input", { type: "date", name: "date", value: today(), required: true })),
      h("div", { class: "end" }, back, h("button", { class: "primary" }, "Сақтау")));
      return [h("h3", {}, `Аударым · ${tg(num(st.amount))}`), f];
    }
    const inc = st.kind === "income", isItem = st.mode === "item", catb = (label, fn, t) => h("button", { type: "button", class: "catb", onclick: fn }, t, h("span", {}, label));
    const own = h("input", { placeholder: "Өз санатың", "aria-label": "Өз санатың", list: "dl-own", autocomplete: "off" });
    const ownGo = () => own.value.trim() && pick({ cat: FS.normCat(own.value), cycleId: "" });
    own.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ownGo(); } });
    return [h("h3", {}, `${inc ? "Кіріс" : "Шығыс"} · ${tg(num(st.amount))}`),
      h("p", { class: "muted" }, isItem ? "Қай Төлемгерге?" : inc ? "Қайдан түсті?" : "Не үшін жұмсадың?"),
      isItem ? h("div", { class: "catgrid" }, liveCycles().map((c) => catb(c.name, () => pick({ cycleId: c.id }), cycTile(c))),
        catb("Жаңа Төлемгер", () => addCycle({ price: num(st.amount) }, (c) => pick({ cycleId: c.id })), h("span", { class: "tile add", "aria-hidden": "true" }, ic("plus")))) : [
      h("datalist", { id: "dl-own" }, catList().map((v) => h("option", { value: v }))),
      h("div", { class: "own" }, own, h("button", { type: "button", onclick: ownGo }, "Таңдау")),
      h("div", { class: "catgrid" }, topCats(st.kind).map((c) => catb(c, () => pick({ cat: c, cycleId: "" }), tile(c))))],
      h("div", { class: "end" }, back)];
  };
  const view3 = () => {
    const c = S.cycles.find((x) => x.id === st.cycleId), cat = c ? FS.normCat(c.cat || "Тұрмыс") : st.cat, inc = st.kind === "income";
    const f = h("form", { onsubmit: (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(f)), note = v.note.trim(), store = v.store.trim();
      const tx = withAcc({ id: crypto.randomUUID(), kind: st.kind, amount: num(st.amount), category: cat, note: c ? [c.name, note].filter(Boolean).join(" · ") : note, date: v.date, ...(store ? { store } : {}), ...(c?.sub ? { sub: c.sub } : v.sub ? { sub: v.sub } : {}) }, v);
      put("tx", tx);
      if (c) recordItem(c, { cost: tx.amount, qty: num(v.qty) || 1, store, discount: v.discount === "1", note, date: v.date, txId: tx.id });
      save(); dlg.close();
    } },
      ...accField().map((a) => fld(a.label, sel("account", a.options, a.value))),
      fld("Дүкен", h("input", { name: "store", list: "dl-store", autocomplete: "off" })), h("datalist", { id: "dl-store" }, stores().map((v) => h("option", { value: v }))),
      c && fld(`Саны, ${c.unit || "дана"}`, h("input", { name: "qty", type: "number", min: 0.01, step: "any", value: 1, inputmode: "decimal" })),
      c && fld("Жеңілдікпен алдың ба?", sel("discount", [["0", "Жоқ"], ["1", "Иә"]], "0")),
      !c && subsOf(cat).length > 0 && fld("Ішкі санат", sel("sub", [["", "—"], ...subsOf(cat).map((x) => [x, x])], "")),
      fld(c ? "Баға/пікір" : "Ескертпе", h("input", { name: "note" })),
      fld("Күні", h("input", { type: "date", name: "date", value: st.date || today(), required: true })),
      h("div", { class: "end" }, h("button", { type: "button", class: "ghost", onclick: () => { st.step = 2; draw(); } }, "Артқа"), h("button", { class: "primary" }, "Сақтау")));
    return [h("h3", { class: "paid" }, inc ? "Түсті " : "Төледім ", h("span", { class: "amtchip num" }, tg(num(st.amount)))),
      h("p", { class: "kv" }, h("span", { class: "muted" }, c ? "Төлемгер" : "Санат"), h("span", { class: "pill" }, tile(c ? c.name : cat), c ? c.name : cat)),
      h("p", { class: "muted" }, "Төмендегілер міндетті емес."), f];
  };
  dlg.addEventListener("keydown", (e) => {
    if (st.step !== 1 || e.target.closest?.("input,select,textarea") || e.ctrlKey || e.metaKey) return;
    if (/^[0-9.]$/.test(e.key)) key(e.key); else if ("+-*/".includes(e.key) && e.key.length === 1) key("+−×÷"["+-*/".indexOf(e.key)]); else if (e.key === "Backspace") key("back"); else if (e.key === "Enter" && ok()) { e.preventDefault(); next(); }
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg && st.step === 1) dlg.close(); }); // қара аймаққа басса жабылады
  document.querySelectorAll("dialog.sheet").forEach((d) => d.remove());
  document.body.append(dlg); draw(); dlg.showModal();
}

// Төлемгердің тарихы: нақты төлемдер, екі орташа сома және цикл ұсынысы
function cycleDetail(c) {
  const its = S.items.filter((i) => i.cycleId === c.id).sort((a, b) => b.time.localeCompare(a.time)), gone = c.status === "archived", stats = FS.payerStats(c, S.items, S.settings.payerRecentCount), state = FS.payerState(c, today());
  const dlg = h("dialog", {}), again = () => { dlg.close(); cycleDetail(c); };
  const hist = its.length ? its.map((i, k) => { const gap = k ? FS.daysBetween(i.time, its[k - 1].time) : 0;
    return h("div", { class: "row" }, h("div", { class: "main" }, h("b", { class: "num" }, `${i.time} · ${tg(i.cost)}`),
      h("small", { class: "muted" }, [i.store, i.discount && "жеңілдікпен", i.receipt && "чекпен", gap > 0 && `${gap} күн аралығы`, i.city].filter(Boolean).join(" · ") || " ")),
      h("button", { class: "ghost sm", "aria-label": `Өшіру: ${i.time}`, onclick: () => { if (!confirm("Бұл сатып алуды тарихтан өшіру ме? Транзакция қалады.")) return; dropItems([i]); save(); again(); } }, ic("trash"))); }) : [empty("Тарих жоқ.")];
  const stateText = c.type === "tracked" || !c.every ? "Циклсіз бақыланады" : state.status === "unpaid" ? `Төленбеді · келесі күн: ${state.next}` : `Келесі төлем: ${state.next}`;
  dlg.append(h("h3", {}, c.name),
    h("p", { class: "num muted" }, `${stateText} · бекітілген аралық: ${c.every ? `${c.every} күн` : "жоқ"}`),
    h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, "Негізгі орташа"), h("small", { class: "muted" }, `Соңғы ${S.settings.payerRecentCount} төлем`)), h("span", { class: "num" }, tg(stats.avgRecent || c.price))),
    h("div", { class: "row" }, h("div", { class: "main" }, h("b", {}, "Барлық тарих орташа"), h("small", { class: "muted" }, `${stats.count} төлем`)), h("span", { class: "num" }, tg(stats.avgAll || c.price))),
    stats.suggestedEvery ? h("p", { class: "muted" }, `Ұсыныс: шамамен әр ${stats.suggestedEvery} күн сайын`) : "",
    ...hist,
    h("div", { class: "end wrap" },
      h("button", { onclick: () => { c.alert = c.alert === false; put("cycles", c); save(); again(); } }, `Ескерту: ${c.alert === false ? "өшірулі" : "қосулы"}`),
      !gone && h("button", { onclick: () => { dlg.close(); addCycle(c, () => cycleDetail(c)); } }, "Өзгерту"),
      h("button", { onclick: () => { c.status = gone ? "active" : "archived"; put("cycles", c); save(); dlg.close(); } }, gone ? "Архивтен қайтару" : "Архивке"),
      !gone && h("button", { class: "primary", onclick: () => { dlg.close(); buyAgain(c); } }, "Төлем енгізу"),
      h("button", { class: "warn", onclick: () => { if (delNow("cycles", c.id, c.name)) dlg.close(); } }, "Өшіру"),
      h("button", { class: "ghost", onclick: () => dlg.close() }, "Жабу")));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

// Чек позициялары: циклге не санатқа өздігінен бөлінеді, пайдаланушы тексеріп «Растау» басады
function receiptReview(r) {
  const pos = [...(r.items || [])], sum = pos.reduce((t, p) => t + p.price, 0);
  if (!pos.length || sum > r.total + 1) return txForm(null, { kind: "expense", amount: r.total, category: r.category, note: r.store, store: r.store, date: r.date }); // позиция оқылмады — жалпы сома
  if (r.total - sum > 1) pos.push({ name: "Танылмаған қалдық", price: Math.round((r.total - sum) * 100) / 100, category: "Басқа" });
  const { rows } = FS.groupReceipt(pos, S.settings.payerAutoLink === false ? [] : S.cycles, r.category, r.store), cats = [...new Set([...catList(), ...rows.map((x) => x.category)])];
  const opts = [...cats.map((c) => ["k:" + c, c]), ...liveCycles().map((c) => ["c:" + c.id, "Төлемгер: " + c.name])];
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

/* ---------- санаттар беті (Gem үлгісінде): тізім → санат ішіне кіру → жаңа санат ---------- */
let catKind = "expense", catView = null;
const ensureCat = (name) => {
  const i = catInfo(name); if (i.rec) return i.rec;
  const rec = { id: crypto.randomUUID(), name: i.name, kind: catKind, color: i.color, icon: i.icon, subs: [], budget: 0 }; put("categories", rec); return rec;
};
const isDefaultCat = (n) => CATS.includes(n) || n in DEF_STYLE;
const hideCat = (name, rec) => put("categories", { ...(rec ?? { id: crypto.randomUUID(), name, kind: catKind }), hidden: true, subs: [], budget: 0 }); // әдепкі атау қайта шықпасын деп белгі қалады
// Санат атын ауыстыру: транзакциялар мен циклдер соңынан ере жаңарады
function renameCat(c, newName) {
  for (const t of S.tx) if (FS.normCat(t.category) === c.name) put("tx", { ...t, category: newName });
  for (const x of S.cycles) if (FS.normCat(x.cat ?? "") === c.name) put("cycles", { ...x, cat: newName });
  const rec = ensureCat(c.name); put("categories", { ...rec, name: newName });
  if (isDefaultCat(c.name)) hideCat(c.name);
}
// Санатты өшіру: жазбалары «Басқа» санатына көшеді
function deleteCat(c) {
  for (const t of S.tx) if (FS.normCat(t.category) === c.name) { const { sub, ...rest } = t; put("tx", { ...rest, category: "Басқа" }); }
  if (c.rec && !isDefaultCat(c.name)) rm("categories", c.rec.id); else hideCat(c.name, c.rec);
}
// opts: { cat } санатты өзгерту · { parent } ішкі санат қосу · { parent, sub } ішкі санатты өзгерту
function catForm(opts = {}) {
  const info = opts.cat, parent0 = opts.parent ? catInfo(opts.parent) : null, sub0 = opts.sub;
  const st = { name: sub0?.name ?? info?.name ?? "", parent: parent0?.name ?? "", budget: info?.budget || "", color: info?.color ?? parent0?.color ?? COLORS_PICK[Math.floor(Math.random() * COLORS_PICK.length)], icon: sub0?.icon || info?.icon || "tag" };
  const dlg = h("dialog", { class: "sheet catdlg" });
  const editing = !!(info || sub0), usedBy = info ? S.tx.filter((t) => FS.normCat(t.category) === info.name).length : 0;
  const draw = () => {
    const par = st.parent ? catInfo(st.parent) : null, color = par && !info ? par.color : st.color;
    dlg.replaceChildren(
      h("h2", { class: "ctitle" }, sub0 ? "Ішкі санатты өзгерту" : info ? "Санатты өзгерту" : st.parent ? "Жаңа ішкі санат" : "Жаңа санат"),
      h("div", { class: "cprev", style: `background:${color}` }, ic(st.icon)),
      h("div", { class: "sec crow" },
        h("label", { class: "inl" }, "Атауы", h("input", { value: st.name, placeholder: "Қысқа әрі нақты", "aria-label": "Атауы", oninput: (e) => { st.name = e.target.value; } })),
        !info && h("label", { class: "inl" }, "Орны", h("select", { "aria-label": "Орны", onchange: (e) => { st.parent = e.target.value; draw(); } }, [["", "Санаттар"], ...allCats(catKind).map((c) => [c.name, c.name])].map(([v, t]) => h("option", { value: v, selected: v === st.parent }, t))))),
      !st.parent && h("div", { class: "sec crow" }, h("label", { class: "inl" }, "Бюджет", h("input", { type: "number", min: 0, step: "any", inputmode: "decimal", value: st.budget, placeholder: "₸0", "aria-label": "Бюджет", oninput: (e) => { st.budget = e.target.value; } }))),
      !st.parent && h("div", { class: "sec swatches" }, ...COLORS_PICK.map((c) => h("button", { type: "button", class: "sw" + (c === st.color ? " on" : ""), style: `background:${c}`, "aria-label": `Түс ${c}`, onclick: () => { st.color = c; draw(); } })),
        h("label", { class: "sw rainbow", "aria-label": "Басқа түс" }, h("input", { type: "color", value: st.color, onchange: (e) => { st.color = e.target.value; draw(); } }))),
      h("div", { class: "sec swatches" }, ...ICON_KEYS.map((k) => h("button", { type: "button", class: "ib" + (k === st.icon ? " on" : ""), "aria-label": `Белгіше ${k}`, onclick: () => { st.icon = k; draw(); } }, ic(k)))),
      h("div", { class: "end sticky" }, editing && (sub0 || info.name !== "Басқа") && h("button", { type: "button", class: "ghost warn", style: "margin-right:auto", onclick: () => {
          if (!confirm(sub0 ? `«${sub0.name}» ішкі санатын өшіру ме?` : `«${info.name}» санатын өшіру ме?` + (usedBy ? ` ${usedBy} жазба «Басқа» санатына көшеді.` : ""))) return;
          if (sub0) { const r = ensureCat(parent0.name); r.subs = r.subs.filter((x) => (x.name ?? x) !== sub0.name); put("categories", r); } else { deleteCat(info); catView = null; }
          dlg.close(); save(); } }, "Өшіру"),
        h("button", { type: "button", class: "ghost", onclick: () => dlg.close() }, "Бас тарту"),
        h("button", { type: "button", class: "primary", onclick: () => {
          const name = FS.normCat(st.name); if (!st.name.trim()) return alert("Атауын жаз.");
          if (!st.parent && allCats(catKind).some((c) => c.name === name && c.name !== info?.name)) return alert("Мұндай санат бар.");
          if (st.parent) { const r = ensureCat(st.parent), subs = r.subs.map((x) => (typeof x === "string" ? { name: x, icon: "" } : x)).filter((x) => x.name !== (sub0?.name ?? "")); if (subs.some((x) => x.name.toLowerCase() === st.name.trim().toLowerCase())) return alert("Мұндай ішкі санат бар.");
            r.subs = [...subs, { name: st.name.trim(), icon: st.icon }]; put("categories", r);
            if (sub0 && sub0.name !== st.name.trim()) for (const t of S.tx) if (FS.normCat(t.category) === parent0.name && t.sub === sub0.name) put("tx", { ...t, sub: st.name.trim() }); }
          else { if (info && name !== info.name) { renameCat(info, name); catView = name; }
            const r = catInfo(name).rec ?? { id: crypto.randomUUID(), name, kind: catKind, subs: [] }; // өшірілген санатты қайта қосса — жаңғырады
            put("categories", { ...r, name, hidden: false, color: st.color, icon: st.icon, budget: num(st.budget) || 0, kind: r.kind || catKind }); }
          dlg.close(); save(); } }, editing ? "Сақтау" : "Қосу")));
  };
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); draw(); dlg.showModal();
}

const backBtn = (label, fn) => h("button", { class: "ghost back round", "aria-label": label, onclick: fn }, ic("chevl"));
function catsPage() {
  return [h("div", { class: "head" }, backBtn("Артқа", () => { sub = null; render(); document.getElementById("view").scrollTo(0, 0); })),
    h("section", { class: "sec chead" }, h("span", { class: "tile big", style: "background:var(--glass-2);color:var(--acc)" }, ic("grid")), h("h2", {}, "Санаттар"), h("p", { class: "muted" }, "Санаттар арқылы тамаққа, жолға, үйге кететін шығынды қадағала.")),
    h("section", { class: "sec menu" }, allCats(catKind).map((c) => h("button", { class: "mrow", onclick: () => { catView = c.name; render(); document.getElementById("view").scrollTo(0, 0); } }, tile(c.name), h("span", { class: "ml" }, c.name), h("small", { class: "muted mr" }, c.subs.length || ""), ic("chev")))),
    h("div", { class: "fbar" }, h("button", { class: "fnew", onclick: () => catForm() }, ic("plus"), "Жаңа"),
      h("div", { class: "seg2" }, [["expense", "Шығыс"], ["income", "Кіріс"]].map(([k, t]) => h("button", { "aria-pressed": String(catKind === k), onclick: () => { catKind = k; render(); } }, t))))];
}
function catDetail(name) {
  const c = catInfo(name), list = S.tx.filter((t) => FS.normCat(t.category) === c.name).sort((a, b) => b.date.localeCompare(a.date));
  const summary = () => { const dlg = h("dialog", {}, h("h3", {}, `${c.name} · Summary`)), mon = {};
    for (const t of list) mon[t.date.slice(0, 7)] = (mon[t.date.slice(0, 7)] || 0) + t.amount;
    dlg.append(...(Object.keys(mon).sort().reverse().slice(0, 6).map((k) => h("div", { class: "row" }, h("span", {}, `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`), h("b", { class: "num" }, tg(mon[k])))) || []), !list.length && empty("Әзірге жазба жоқ."), c.budget ? h("p", { class: "muted" }, `Бюджет: ${tg(c.budget)} / ай`) : null, h("div", { class: "end" }, h("button", { onclick: () => dlg.close() }, "Жабу")));
    dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal(); };
  const act = (label, icon, fn) => h("button", { class: "hact", onclick: fn }, ic(icon), label);
  return [h("div", { class: "chdr", style: `background:${c.color}` }, h("span", { class: "wm", "aria-hidden": "true" }, ic(c.icon)),
      h("div", { class: "head" }, backBtn("Артқа", () => { catView = null; render(); document.getElementById("view").scrollTo(0, 0); })), h("h1", {}, c.name),
      h("div", { class: "hacts" }, act("Өзгерту", "edit", () => catForm({ cat: c })), act("Тарих", "grid", () => document.getElementById("hist")?.scrollIntoView({ behavior: "smooth" })), act("Summary", "bars", summary))),
    c.subs.length ? h("section", { class: "sec menu" }, c.subs.map((x) => h("button", { class: "mrow", "aria-label": `Ішкі санат: ${x.name}`, onclick: () => catForm({ parent: c.name, sub: x }) }, h("span", { class: "tile", style: `background:${c.color}`, "aria-hidden": "true" }, ic(x.icon || "tag")), h("span", { class: "ml" }, x.name), ic("chev")))) : h("section", { class: "sec" }, empty("Ішкі санат жоқ. «Жаңа» арқылы қос.")),
    h("h3", { id: "hist", class: "muted hh" }, "Тарих"),
    h("section", { class: "sec menu" }, list.length ? list.slice(0, 30).map((t) => h("div", { class: "mrow" }, h("span", { class: "tile", style: `background:${c.color}`, "aria-hidden": "true" }, ic(c.icon)), h("span", { class: "ml" }, h("b", {}, t.sub || t.note || c.name), h("small", { class: "muted" }, t.date)), h("span", { class: "num" }, tg(t.amount)))) : empty("Әзірге жазба жоқ.")),
    h("p", { class: "muted" }, `${list.length} жазбада қолданылған`),
    h("div", { class: "fbar" }, h("button", { class: "fnew", onclick: () => catForm({ parent: c.name }) }, ic("plus"), "Жаңа"))];
}

const valid = (x) => {
  const n = Number.isFinite, s = (v) => typeof v === "string", a = (k, f) => Array.isArray(x[k] ?? []) && (x[k] ?? []).every((i) => i && s(i.id) && f(i));
  return x && typeof x === "object" && (!x.settings || [x.settings.capital, x.settings.income, x.settings.fixed].every((v) => v == null || n(v))) &&
    a("tx", (t) => s(t.date) && n(t.amount) && s(t.category) && (t.kind === "income" || t.kind === "expense")) &&
    a("cycles", (c) => (s(c.last) || s(c.first)) && n(c.every) && c.every >= 0 && n(c.price) && (!c.type || c.type === "cycle" || c.type === "tracked")) &&
    a("items", (i) => s(i.cycleId) && n(i.cost) && s(i.time)) &&
    a("installments", (i) => s(i.name) && n(i.total) && i.total > 0 && n(i.months) && i.months >= 1 && n(i.paid) && s(i.start)) &&
    a("wishes", (w) => s(w.name) && n(w.price) && w.price > 0) &&
    a("goals", (g) => s(g.start) && n(g.target) && n(g.saved) && n(g.months)) &&
    a("stock", (i) => n(i.qty)) &&
    a("matches", (m) => Array.isArray(m.brands) && m.brands.length > 1 && m.brands.every((b) => n(b.price) && n(b.days) && b.days > 0)) &&
    a("contribs", (c) => n(c.amount) && s(c.goalId)) &&
    a("categories", (c) => s(c.name) && Array.isArray(c.subs ?? [])) &&
    a("incomes", (c) => s(c.name) && n(c.amount) && c.amount > 0) &&
    a("accounts", (c) => s(c.name) && n(c.opening)) &&
    a("transfers", (t) => n(t.amount) && t.amount > 0 && s(t.from) && s(t.to));
};

const CLOUD = { local: "Бұлт өшік: Hub-қа кіріп, осы бетті қайта аш", ok: "Бұлтпен синхрондалды", wait: "Бұлтқа жіберуге күтіп тұр", err: "Бұлт қатесі" };

// Аккаунт: Hub-пен ортақ Supabase сессиясы. Кіру Hub-та, мұнда — шығу, email және құпиясөзді өзгерту
const authDone = (error, ok) => alert(error ? error.message : ok);
function changeEmail() {
  ask("Email өзгерту", [{ name: "email", label: "Жаңа email", type: "email" }], async (v) => {
    const { error } = await Sync.sb.auth.updateUser({ email: v.email.trim() });
    authDone(error, "Растау сілтемесі жіберілді. Поштаңды (жаңа және ескі) тексеріп, сілтемені бас: сонда email ауысады.");
  });
}
function changePass() {
  ask("Құпиясөзді өзгерту", [{ name: "p1", label: "Жаңа құпиясөз (кемінде 8 таңба)", type: "password" }, { name: "p2", label: "Қайталап жаз", type: "password" }], async (v) => {
    if (v.p1.length < 8) { alert("Құпиясөз кемінде 8 таңба болуы керек."); return changePass(); }
    if (v.p1 !== v.p2) { alert("Құпиясөздер сәйкес емес."); return changePass(); }
    const { error } = await Sync.sb.auth.updateUser({ password: v.p1 });
    authDone(error, "Құпиясөз өзгертілді.");
  });
}
// Шыққанда құрылғы тазаланады: келесі кірген адамның деректері араласпасын. Алдымен жіберілмеген өзгерістер бұлтқа кетеді
async function signOut() {
  if (!confirm("Шығу ма? Құрылғыдағы деректер тазаланады, бұлттағылары қалады. Hub пен басқа қосымшалардан да шығасың.")) return;
  await Sync.now();
  if (S.pending.length || Sync.state === "err") return alert("Кейбір өзгерістер бұлтқа жіберілмеген (желі жоқ немесе қате). Алдымен синхрондап ал, содан кейін шық.");
  const { error } = await Sync.sb.auth.signOut({ scope: "local" });
  if (error) return alert(error.message);
  Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, structuredClone(DEF));
  Sync.state = "local"; persist(); tab = "home"; sub = null; render();
}
const accountSec = () => sec("Аккаунт", null,
  h("div", { class: "row" }, h("span", {}, "Email"), h("span", { class: "num" }, S.email)),
  h("div", { class: "end", style: "margin-top:0;justify-content:flex-start;flex-wrap:wrap" }, h("button", { onclick: changeEmail }, "Email өзгерту"), h("button", { onclick: changePass }, "Құпиясөзді өзгерту"), h("button", { class: "ghost warn", onclick: signOut }, "Шығу")));
function settings() {
  const st = S.settings, file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    try {
      const x = JSON.parse(await file.files[0].text());
      if (!valid(x)) throw new Error("пішім қате");
      if (!confirm("Файлдағы жазбалар қазіргілерге қосылады (id бірдей болса, жаңартылады). Жалғастыру ма?")) return;
      for (const k of LISTS) for (const e of x[k] ?? []) put(k, k === "tx" ? { ...e, category: FS.normCat(e.category) } : e);
      if (x.settings) { Object.assign(S.settings, { capital: Number(x.settings.capital) || 0, income: Number(x.settings.income) || 0, fixed: Number(x.settings.fixed) || 0, payerRecentCount: Math.max(1, Math.round(Number(x.settings.payerRecentCount) || S.settings.payerRecentCount)), payerReminderDays: Math.max(0, Math.round(Number(x.settings.payerReminderDays) || S.settings.payerReminderDays)), payerAutoLink: x.settings.payerAutoLink !== false }); put("settings"); }
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
  const incSec = sec("Кіріс көздері", add(() => incForm()), S.incomes.length ? S.incomes.map((i) => h("div", { class: "row" },
      h("div", { class: "main" }, h("b", {}, i.name), h("small", { class: "muted num" }, `${tg(i.amount)} / ай`)),
      h("button", { onclick: () => gotIncome(i) }, ic("check"), "Түсті"),
      h("button", { class: "ghost sm", "aria-label": `Өзгерту: ${i.name}`, onclick: () => incForm(i) }, ic("edit")), del("incomes", i.id, i.name))) : empty("Кіріс көзі жоқ."));
  const savSec = sec("Жинақтар", add(addGoal), S.goals.length ? FS.goalsView(S).map((g) => goalRow(g, true)) : empty("Жинақ жоқ. Мысалы: ноутбук, демалыс."));
  const finSec = sec("Қаржылық параметрлер", h("button", { class: "ghost", onclick: () => ask("Қаржылық параметрлер", [
      { name: "capital", label: "Бастапқы капитал, ₸", type: "number", min: -1e12, value: st.capital },
      { name: "income", label: "Айлық тұрақты кіріс, ₸", type: "number", value: st.income },
      { name: "fixed", label: "Айлық тұрақты шығын, ₸", type: "number", value: st.fixed },
      { name: "monthStart", label: "Айдың басы (айдың қай күні, 1–28)", type: "number", min: 1, max: 28, step: 1, value: st.monthStart || 1 },
    ], (v) => { Object.assign(S.settings, { capital: num(v.capital), income: num(v.income), fixed: num(v.fixed), monthStart: Math.min(28, Math.max(1, Math.round(num(v.monthStart)) || 1)) }); put("settings"); save(); }) }, "Өзгерту"),
    h("div", { class: "row" }, h("span", {}, "Бастапқы капитал"), h("span", { class: "num" }, tg(st.capital))),
    h("div", { class: "row" }, h("span", {}, "Айлық кіріс"), h("span", { class: "num" }, tg(st.income))),
    h("div", { class: "row" }, h("span", {}, "Айлық тұрақты шығын"), h("span", { class: "num" }, tg(st.fixed))),
    h("div", { class: "row" }, h("span", {}, "Айдың басы"), h("span", { class: "num" }, `${st.monthStart || 1}-ші күн`)));
  const payerSec = sec("Төлемгер баптаулары", h("button", { class: "ghost", onclick: () => ask("Төлемгер баптаулары", [
      { name: "recentCount", label: "Негізгі орташаға алынатын соңғы төлем саны", type: "number", min: 1, max: 20, step: 1, value: st.payerRecentCount },
      { name: "reminderDays", label: "Әдепкі ескерту: қанша күн бұрын", type: "number", min: 0, max: 365, step: 1, value: st.payerReminderDays },
      { name: "autoLink", label: "Чекпен Төлемгерді автоматты байланыстыру", options: [["1", "Қосулы"], ["0", "Өшірулі"]], value: st.payerAutoLink === false ? "0" : "1" },
    ], (v) => { Object.assign(S.settings, { payerRecentCount: Math.min(20, Math.max(1, Math.round(num(v.recentCount) || 4))), payerReminderDays: Math.min(365, Math.max(0, Math.round(num(v.reminderDays) || 0))), payerAutoLink: v.autoLink === "1" }); put("settings"); save(); }) }, "Өзгерту"),
    h("div", { class: "row" }, h("span", {}, "Негізгі орташа"), h("span", { class: "num" }, `Соңғы ${st.payerRecentCount} төлем`)),
    h("div", { class: "row" }, h("span", {}, "Әдепкі ескерту"), h("span", { class: "num" }, `${st.payerReminderDays} күн бұрын`)),
    h("div", { class: "row" }, h("span", {}, "Чекпен автоматты байланыстыру"), h("span", {}, st.payerAutoLink === false ? "Өшірулі" : "Қосулы")));
  const citySec = sec("Қала және енгізу", h("button", { class: "ghost", onclick: () => ask("Қала", [{ name: "city", label: "Қала (Төлемгер жазбаларына жазылады, салыстыру үшін)", options: (KZ_CITIES.includes(st.city) ? KZ_CITIES : [st.city, ...KZ_CITIES]).map((c) => [c, c]), value: st.city }], (v) => { S.settings.city = v.city || "Астана"; put("settings"); save(); }) }, "Өзгерту"),
      h("div", { class: "row" }, h("span", {}, "Қала"), h("span", {}, st.city)),
      h("div", { class: "row" }, h("span", {}, "Ашылғанда санперне"), h("button", { onclick: () => { S.settings.pad = st.pad === false; save(); } }, st.pad === false ? "Өшірулі" : "Қосулы")));
  const cloudSec = [S.email ? accountSec() : null, sec("Бұлт", null, h("p", { class: "muted" }, cloud),
      h("div", { class: "end", style: "margin-top:0;justify-content:flex-start" }, state === "local" ? h("a", { class: "btn", href: "../" }, "Hub-қа кіру") : h("button", { onclick: () => Sync.now() }, "Қазір синхрондау")),
      h("p", { class: "muted" }, "Қосымша интернетсіз де жұмыс істейді: өзгерістер құрылғыда сақталып, желі мен кіру болғанда бұлтқа жіберіледі.")),
    sec("Байланыс", null, h("span", { class: "chip" }, navigator.onLine ? "Желіде" : "Офлайн режим"))];
  const SUBS = { wallets: ["Шоттар", walletPage().slice(1)], income: ["Кіріс көздері", [incSec]], savings: ["Жинақтар", [savSec]], fin: ["Қаржылық параметрлер", [finSec]], payer: ["Төлемгер баптаулары", [payerSec]], about: ["Қосымша туралы", ABOUT.map(([t, p]) => h("section", { class: "sec" }, h("h2", {}, t), h("p", { class: "muted" }, p)))], city: ["Қала және енгізу", [citySec]], cloud: ["Бұлт", cloudSec] };
  if (sub === "cats") return catView ? catDetail(catView) : catsPage();
  if (sub && SUBS[sub]) return [h("button", { class: "ghost back", onclick: () => { sub = null; render(); document.getElementById("view").scrollTo(0, 0); } }, ic("chevl"), "Профиль"), head(SUBS[sub][0]), ...SUBS[sub][1]];
  const mrow = (label, key, icon, color, right) => h("button", { class: "mrow", onclick: () => { sub = key; render(); document.getElementById("view").scrollTo(0, 0); } }, h("span", { class: "tile", style: `background:${color}`, "aria-hidden": "true" }, ic(icon)), h("span", { class: "ml" }, label), right && h("small", { class: "muted mr" }, right), ic("chev"));
  return [
    head("Профиль"),
    h("section", { class: "sec tiles2" },
      h("button", { onclick: () => file.click() }, ic("up"), "Файлдан қосу"), h("button", { onclick: exportJson }, ic("down"), "Көшірме жүктеу"), file),
    h("section", { class: "sec menu" }, mrow("Санаттар", "cats", "grid", "#f59e0b", String(allCats("expense").length)), mrow("Шоттар", "wallets", "wallet", "#3b82f6", tg(FS.balance(S)))),
    h("section", { class: "sec menu" }, mrow("Кіріс көздері", "income", "plus", "#84cc16", String(S.incomes.length || "")), mrow("Жинақтар", "savings", "target", "#10b981", String(S.goals.length || "")), mrow("Қаржылық параметрлер", "fin", "sliders", "#6b7280"), mrow("Төлемгер баптаулары", "payer", "calendar", "#0d7a52", `${st.payerRecentCount} төлем`)),
    h("section", { class: "sec menu" }, mrow("Қала және енгізу", "city", "home", "#8b5cf6", st.city), mrow(S.email ? "Бұлт және аккаунт" : "Бұлт", "cloud", "swap", "#ec4899", cloud), mrow("Қосымша туралы", "about", "book", "#0ea5e9")),
  ];
}

const ABOUT = [
  ["FinSaulyq не үшін", "Ақшаң қайда кетіп жатқанын көріп, келесі айдағы шығынды алдын ала білу үшін. Әр жазба — бір транзакция: орталықтағы «+» арқылы қосасың."],
  ["Журнал мен Summary", "Журнал — күн сайынғы жазбалар, шоттар бойынша қалдық және таңдалған аралықтағы баланс. Summary — айдағы шығынның санат бойынша бөлінісі, шоттар және алдағы айлардың болжамы."],
  ["Төлемгер дегеніміз не", "Төлемгер — өмірде қайталанатын шығын: тіс пастасы, шаш қию, Netflix, кофе, абонемент. Әр төлемді енгізгенде қосымша орташа бағаны мен төлемдер арасындағы күнді есептейді. Сонда келесі төлемнің қашан болатыны, айына қанша кететіні және ескерту алдын ала белгілі болады."],
  ["Төлемгер не береді", "Ұмытпайсың: мерзімі жақындағанда «Алда күтілетін» тізімінде шығады. Бағаны салыстырасың: орташа баға мен цикл өзгерсе, көресің. Болжам: Summary-де келесі айлардағы жалпы міндетті шығын есептеледі. Циклі жоқ төлемді «Бақыланатын» деп белгіле — ол тек тарихты жинайды."],
  ["Бөліп-төлем, жинақ, Wish List", "Бөліп-төлем (қызыл) — алынған затты ай сайын жабу. Жинақ (көк) — мақсатқа ақша жинау. Wish List — әлі алмаған арманың: қажеттілік пе, қалау ма екенін белгілесең, приоритет өздігінен қойылады; кейін сатып аласың, жинайсың не бөліп-төлемге аласың."],
  ["Деректер", "Қолданба интернетсіз де жұмыс істейді. Hub аккаунтына кірсең, деректер бұлтқа сақталады және басқа құрылғыда көрінеді. «Көшірме жүктеу» файлды өзіңе сақтайды."],
];
const PAGES = { home, plan, stock, set: settings };
const NAV = [["home", "Журнал", "home"], ["plan", "Summary", "bars"], ["+"], ["stock", "Есеп", "box"], ["set", "Профиль", "user"]];

function render() {
  document.getElementById("view").replaceChildren(...PAGES[tab]().filter(Boolean));
  const jc = document.querySelector(".jcards [data-sel=true]"); if (jc) jc.parentElement.scrollLeft = jc.offsetLeft - (jc.parentElement.clientWidth - jc.offsetWidth) / 2; // таңдалған шот картасы ортада
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
