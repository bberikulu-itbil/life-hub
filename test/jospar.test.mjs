import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const JO = createRequire(import.meta.url)("../jospar/core.js");

const T = "2026-10-26";
const good = { id: "g", name: "Таңғы жаттығу", kind: "good", steps: ["Шпагат 10 минут", "Отырып тұру 15 рет"], time: "", dur: 0, w: 1, created: "2026-10-20" };
const bad = { id: "b", name: "Тырнақ тістеу", kind: "bad", steps: [], time: "", dur: 0, w: 1, created: "2026-10-20" };
const log = (habit, date, o = {}) => ({ id: habit + date, habit, date, done: [], slip: false, resist: 0, count: 0, ...o });

test("жақсы әдет: тек барлық пункт белгіленгенде орындалды", () => {
  assert.equal(JO.dayStatus(good, undefined), "todo");
  assert.equal(JO.dayStatus(good, log("g", T, { done: [0] })), "todo");
  assert.equal(JO.dayStatus(good, log("g", T, { done: [0, 1] })), "done");
  const solo = { ...good, steps: [] }; // пунктсіз — бір белгі жеткілікті
  assert.equal(JO.dayStatus(solo, log("g", T, { done: [0] })), "done");
});

test("жаман әдет: автоматты орындалды, сүрінсе — slip", () => {
  assert.equal(JO.dayStatus(bad, undefined), "done");
  assert.equal(JO.dayStatus(bad, log("b", T, { resist: 2 })), "done");
  assert.equal(JO.dayStatus(bad, log("b", T, { slip: true })), "slip");
});

test("жақсы әдет сериясы: бүгін әлі орындалмаса, үзілмейді", () => {
  const S = { logs: ["2026-10-24", "2026-10-25"].map((d) => log("g", d, { done: [0, 1] })) };
  assert.deepEqual(JO.runs(S, good, T), { cur: 2, best: 2 });
  S.logs.push(log("g", T, { done: [0, 1] }));
  assert.deepEqual(JO.runs(S, good, T), { cur: 3, best: 3 });
  assert.deepEqual(JO.runs({ logs: [] }, good, T), { cur: 0, best: 0 });
});

test("жаман әдет сериясы: бүгін күн жабылғанша есептелмейді, сүрінсе 0, ең ұзақ сақталады", () => {
  assert.deepEqual(JO.runs({ logs: [] }, bad, T), { cur: 6, best: 6 }); // 20–25 қазан
  assert.deepEqual(JO.runs({ logs: [] }, { ...bad, created: T }, T), { cur: 0, best: 0 }); // бүгін ашылды
  const S = { logs: [log("b", "2026-10-23", { slip: true })] };
  assert.deepEqual(JO.runs(S, bad, T), { cur: 2, best: 3 }); // 24–25 және бұрынғы 20–22
  S.logs.push(log("b", T, { slip: true }));
  assert.deepEqual(JO.runs(S, bad, T), { cur: 0, best: 3 });
});

test("бейтарап әдетте серия жоқ", () => {
  assert.deepEqual(JO.runs({ logs: [] }, { ...bad, kind: "neutral" }, T), { cur: 0, best: 0 });
});

test("күрес күндері: бір күнде көп басса да бір күн; ай бойынша сүзгі", () => {
  const S = { logs: [log("b", "2026-10-24", { resist: 3 }), log("b", T, { resist: 1 }), log("b", "2026-09-30", { resist: 1 }), log("b", "2026-10-22")] };
  assert.equal(JO.fightDays(S, bad), 3);
  assert.equal(JO.fightDays(S, bad, "2026-10"), 2);
});

test("pickMsg: қайталанбайды, {best} тек 0-ден жоғары болғанда, сан орнына қойылады", () => {
  const r = JO.pickMsg(JO.RESIST, { n: 5 }, 1, () => 0);
  assert.notEqual(r.i, 1);
  assert.ok(!/\{/.test(r.text));
  for (let k = 0; k < 40; k++) assert.ok(!/NaN|undefined|\{/.test(JO.pickMsg(JO.SLIP, { best: 0 }, -1, Math.random).text));
  assert.match(JO.pickMsg(["{best} күн"], { best: 4 }).text, /^4 күн$/);
  for (const t of [...JO.RESIST, ...JO.SLIP]) assert.ok(!/\p{Extended_Pictographic}/u.test(t), "эмодзи болмауы керек");
});

test("fromRow: жарамсыз жолдар — null, жарамдылары түзетіледі", () => {
  const row = (app, data) => ({ id: "x", app, data });
  assert.equal(JO.fromRow(row("jo_habit", { name: " ", kind: "good", created: T })), null);
  assert.equal(JO.fromRow(row("jo_habit", { name: "А", kind: "evil", created: T })), null);
  assert.equal(JO.fromRow(row("jo_log", { habit: "g", date: "ертең" })), null);
  assert.equal(JO.fromRow(row("money", { amount: 1 })), null);
  assert.deepEqual(JO.fromRow(row("jo_habit", { name: "А", kind: "good", created: T, steps: ["a", 5], time: "9:00", dur: -1 })), { id: "x", name: "А", kind: "good", steps: ["a"], time: "", dur: 0, w: 1, created: T });
  assert.deepEqual(JO.fromRow(row("jo_log", { habit: "g", date: T, done: [0, "1", -2], resist: "x" })).done, [0]);
});

test("toRow ↔ fromRow айналымы", () => {
  const r = JO.toRow("habits", good);
  assert.equal(r.app, "jo_habit");
  assert.deepEqual(JO.fromRow(r), good);
});

test("mergePull: сервер негіз, кезектегі өзгеріс жеңеді, кезектегі өшіру қайтып келмейді", () => {
  const rows = [JO.toRow("habits", good), JO.toRow("habits", bad), JO.toRow("logs", log("g", T, { done: [0] }))];
  const local = log("g", T, { done: [0, 1] });
  const S = { habits: [], logs: [local], pending: [{ k: "logs", id: local.id, op: "put", n: 1 }, { k: "habits", id: "b", op: "del", n: 2 }] };
  const m = JO.mergePull(S, [...rows.slice(0, 2), { ...rows[2], id: local.id }]);
  assert.deepEqual(m.habits.map((h) => h.id), ["g"]);
  assert.deepEqual(m.logs[0].done, [0, 1]);
});

const task = (o = {}) => ({ id: "t", title: "ClassFlow коды", goal: "", due: "", time: "", dur: 0, w: 1, done: false, doneAt: "", ...o });

test("rate: жақсы әдет — бүгін тек орындалса есептеледі; жаман — бүгін есептелмейді; бейтарап — null", () => {
  const S = { logs: ["2026-10-24", "2026-10-25"].map((d) => log("g", d, { done: [0, 1] })) };
  assert.deepEqual(JO.rate(S, good, T), { done: 2, total: 6 }); // 20–25: екеуі орындалды, бүгін әлі орындалмады — санамайды
  S.logs.push(log("g", T, { done: [0, 1] }));
  assert.deepEqual(JO.rate(S, good, T), { done: 3, total: 7 });
  assert.deepEqual(JO.rate({ logs: [log("b", "2026-10-23", { slip: true })] }, bad, T), { done: 5, total: 6 }); // 20–25, бүгін жоқ
  assert.deepEqual(JO.rate({ logs: [] }, { ...good, created: "2026-09-01" }, T, 30), { done: 0, total: 29 }); // 30 күндік терезе: 27.09–25.10
  assert.equal(JO.rate({ logs: [] }, { ...bad, kind: "neutral" }, T), null);
});

test("goalProgress: тек осы мақсатқа байланған тапсырмалар", () => {
  const S = { tasks: [task({ id: "1", goal: "G", done: true }), task({ id: "2", goal: "G" }), task({ id: "3", goal: "X", done: true }), task({ id: "4" })] };
  assert.deepEqual(JO.goalProgress(S, { id: "G" }), { done: 1, total: 2 });
  assert.deepEqual(JO.goalProgress(S, { id: "Z" }), { done: 0, total: 0 });
});

test("todayTask: жоспаргерде тек бүгінге белгіленген тапсырмалар", () => {
  const y = "2026-10-25", tm = "2026-10-27";
  assert.ok(JO.todayTask(task({ due: T }), T));
  assert.ok(!JO.todayTask(task({ due: y }), T));
  assert.ok(!JO.todayTask(task({ due: y, done: true, doneAt: T }), T));
  assert.ok(JO.todayTask(task({ due: T, done: true, doneAt: y }), T)); // мерзімі бүгін болса, ертерек орындалса да көрінеді
  assert.ok(!JO.todayTask(task({ due: y, done: true, doneAt: y }), T));
  assert.ok(!JO.todayTask(task({ due: tm }), T));
  assert.ok(!JO.todayTask(task({}), T));
});

test("monthStats: тапсырма, жақсы әдет %, күрес күндері, сүрінулер — тек осы ай", () => {
  const S = {
    habits: [good, bad],
    tasks: [task({ done: true, doneAt: "2026-10-03" }), task({ id: "2", done: true, doneAt: "2026-09-30" }), task({ id: "3" })],
    logs: [log("g", "2026-10-24", { done: [0, 1] }), log("b", "2026-10-22", { resist: 2 }), log("b", "2026-10-23", { slip: true }), log("b", "2026-09-15", { slip: true, resist: 1 })],
  };
  assert.deepEqual(JO.monthStats(S, T), { tasksDone: 1, goodPct: 17, fights: 1, slips: 1 }); // 20–25 қазанда 1/6
  assert.equal(JO.monthStats({ habits: [], tasks: [], logs: [] }, T).goodPct, null);
});

test("fromRow: тапсырма мен мақсат", () => {
  const row = (app, data, done = false) => ({ id: "x", app, data, done });
  assert.equal(JO.fromRow(row("jo_task", { title: "  " })), null);
  assert.equal(JO.fromRow(row("jo_goal", { title: "А", deadline: "жақында" })), null);
  assert.deepEqual(JO.fromRow(row("jo_task", { title: "А", due: "2026-10-30", time: "9", doneAt: "2026-10-26" }, true)), { id: "x", title: "А", goal: "", due: "2026-10-30", time: "", dur: 0, w: 1, done: true, doneAt: "2026-10-26" });
  assert.equal(JO.fromRow(row("jo_task", { title: "А", done: false, doneAt: "2026-10-26" })).doneAt, ""); // орындалмаған — doneAt жоқ
  const g = { id: "x", title: "Олимпиада банкі", why: "Оқушыларға", deadline: "2026-12-20" };
  assert.deepEqual(JO.fromRow(JO.toRow("goals", g)), g);
  assert.deepEqual(JO.fromRow(JO.toRow("tasks", task({ id: "x" }))), task({ id: "x" }));
});

test("mergePull: тапсырма мен мақсат та біріктіріледі", () => {
  const t = task({ id: "t1", title: "Жергілікті", done: true, doneAt: T });
  const S = { habits: [], logs: [], tasks: [t], goals: [], pending: [{ k: "tasks", id: "t1", op: "put", n: 1 }] };
  const m = JO.mergePull(S, [JO.toRow("tasks", task({ id: "t1", title: "Серверде" })), JO.toRow("goals", { id: "g1", title: "М", why: "", deadline: "2026-12-01" })]);
  assert.equal(m.tasks[0].title, "Жергілікті");
  assert.equal(m.goals.length, 1);
});

test("тапсырманың «орындалды» белгісі — items.done бағанында (Hub пен ассистент те сол бағанды өзгертеді)", () => {
  const r = JO.toRow("tasks", task({ id: "x", done: true, doneAt: T }));
  assert.equal(r.done, true);
  assert.ok(!("done" in r.data) && r.data.doneAt === T);
  assert.equal(JO.toRow("goals", { id: "g", title: "М", why: "", deadline: T }).done, undefined); // басқа жазбаларға бағана жазылмайды
  const fromHub = { id: "x", app: "jo_task", data: { title: "А", done: false }, done: true }; // Hub белгілесе, дерек ішіндегі done есептелмейді
  assert.equal(JO.fromRow(fromHub).done, true);
  assert.equal(JO.fromRow({ ...fromHub, done: false, data: { title: "А", done: true } }).done, false);
  assert.equal(JO.fromRow({ id: "x", app: "jo_task", data: { title: "А" } }).done, false); // ассистент жазған жаңа тапсырма
});

test("салмақ: 0–5, жоқ не жарамсыз болса 1; 0 сақталады", () => {
  const r = (w) => JO.fromRow({ id: "x", app: "jo_task", data: { title: "А", w } }).w;
  assert.deepEqual([r(0), r(5), r(3), r(undefined), r(6), r(-1), r("5"), r(2.5)], [0, 5, 3, 1, 1, 1, 1, 1]);
  assert.equal(JO.fromRow(JO.toRow("habits", { ...good, w: 4 })).w, 4);
});

test("dayPoints: тапсырма, жақсы және жаман әдет салмағымен; 0 салмақ пен бейтарап ұпай бермейді", () => {
  const S = { habits: [{ ...good, steps: [], w: 5 }, bad, { id: "n", name: "Су", kind: "neutral", steps: [], time: "", dur: 0, w: 3, created: "2026-10-20" }],
    logs: [log("g", "2026-10-25", { done: [0] }), log("b", "2026-10-24", { slip: true })],
    tasks: [task({ id: "a", done: true, doneAt: "2026-10-25", w: 3 }), task({ id: "z", done: true, doneAt: "2026-10-25", w: 0 }), task({ id: "u", w: 5 })], goals: [], pending: [] };
  assert.equal(JO.dayPoints(S, "2026-10-25", T), 5 + 1 + 3); // жақсы 5 + жаман 1 (сүрінбеген) + тапсырма 3
  assert.equal(JO.dayPoints(S, "2026-10-24", T), 0); // сүрінген күн, ештеңе орындалмаған
  assert.equal(JO.dayPoints(S, T, T), 0); // бүгін: жаман әдет күн жабылғанша есептелмейді
  assert.equal(JO.dayPoints(S, "2026-10-19", T), 0); // әдет құрылғанға дейін
});

test("profileStats: апта/ай ұпайы, қатар, жылу картасы дүйсенбіден басталады", () => {
  const S = { habits: [], logs: [], goals: [], pending: [], tasks: ["2026-10-23", "2026-10-24", "2026-10-26"].map((d, i) => task({ id: "t" + i, done: true, doneAt: d, w: 2 })) };
  const st = JO.profileStats(S, T); // 2026-10-26 — дүйсенбі
  assert.equal(st.days.length, 13 * 7 - 6); // соңғы апта тек дүйсенбі
  assert.equal(new Date(st.days[0].date + "T00:00:00Z").getUTCDay(), 1);
  assert.equal(st.days.at(-1).date, T);
  assert.deepEqual([st.week, st.month, st.cur, st.best, st.max], [2, 6, 1, 2, 2]);
  assert.equal(JO.profileStats(S, "2026-10-27").cur, 1); // бүгін бос — кешегі қатар үзілмейді
  assert.equal(JO.profileStats({ ...S, tasks: [] }, T).max, 0);
});


test("апталық кесте: демалыс күні серияны үзбейді және пайызға кірмейді", () => {
  const hb = { id: "weekly", name: "Оқу", kind: "good", steps: [], created: "2026-11-02", days: [1, 3, 5] };
  const state = { habits: [hb], logs: ["2026-11-02", "2026-11-04"].map(date => ({ habit: hb.id, date, done: [0] })) };
  assert.equal(JO.scheduled(hb, "2026-11-03"), false);
  assert.equal(JO.scheduled(hb, "2026-11-04"), true);
  assert.deepEqual(JO.runs(state, hb, "2026-11-05"), { cur: 2, best: 2 });
  assert.deepEqual(JO.rate(state, hb, "2026-11-05"), { done: 2, total: 2 });
});

test("жаңа мақсат пен әдет өрістері бұлттан қайтқанда сақталады", () => {
  const hb = { id: "weekly", name: "Оқу", kind: "good", steps: [], time: "", dur: 0, created: "2026-11-02", w: 1, days: [1, 3], goal: "books" };
  const goal = { id: "books", title: "12 кітап", why: "Даму", deadline: "2026-12-31", current: 3, target: 12, unit: "кітап" };
  assert.deepEqual(JO.fromRow(JO.toRow("habits", hb)), hb);
  assert.deepEqual(JO.fromRow(JO.toRow("goals", goal)), goal);
});


test("сандық әдет: меже мен ішкі қадамдар бірге орындалады", () => {
  const hb = { ...good, target: 2.5, unit: "км", steps: ["Қыздырыну"] };
  assert.equal(JO.dayStatus(hb, { count: 2.5, done: [] }), "todo");
  assert.equal(JO.dayStatus(hb, { count: 2, done: [0] }), "todo");
  assert.equal(JO.dayStatus(hb, { count: 2.5, done: [0] }), "done");
  assert.equal(JO.dayStatus({ ...hb, steps: [] }, { count: 3 }), "done");
  const row = JO.toRow("habits", { ...hb, id: "metric" });
  assert.equal(JO.fromRow(row).target, 2.5);
  assert.equal(JO.fromRow(row).unit, "км");
  assert.equal(JO.fromRow(JO.toRow("logs", { id: "log", habit: "metric", date: T, count: 2.5 })).count, 2.5);
});

test("мақсаттың прогресіне өз қадамдары мен жоспарланған әдет күндері кіреді", () => {
  const hb = { ...good, id: "h", goal: "G", created: "2026-11-02", steps: [], days: [1,3,5] };
  const S = { habits: [hb], tasks: [task({ goal: "G", done: true }), task({ goal: "X" })], logs: [{ habit: "h", date: "2026-11-02", done: [0] }] };
  assert.deepEqual(JO.goalOverview(S, { id: "G", deadline: "2026-12-31" }, "2026-11-04"), { done: 2, total: 3, pct: 67 });
  assert.deepEqual(JO.goalOverview(S, { id: "empty", deadline: "2026-12-31" }, "2026-11-04"), { done: 0, total: 0, pct: 0 });
});

test("кез келген әдетте таймер, санақ және көлем қадамдары бірге өлшенеді, артығы сақталады", () => {
  const hb = {...good, steps:[], measures:[
    {id:"seconds",name:"Таймер қадамы",mode:"timer",target:60,unit:"сек",increment:1},
    {id:"reps",name:"Санақ қадамы",mode:"counter",target:10,unit:"рет",increment:1},
    {id:"volume",name:"Көлем қадамы",mode:"counter",target:2,unit:"л",increment:0.25}
  ]};
  const entry=log(hb.id,T,{values:{seconds:75,reps:12,volume:2.25}});
  assert.equal(JO.dayStatus(hb,entry),"done");
  assert.equal(JO.dayStatus(hb,{...entry,values:{...entry.values,volume:1.75}}),"todo");
  assert.equal(JO.dayStatus(hb,undefined),"todo");
  assert.deepEqual(JO.fromRow(JO.toRow("habits",hb)).measures,hb.measures);
  assert.deepEqual(JO.fromRow(JO.toRow("logs",entry)).values,entry.values);
  assert.equal(JO.dayStatus({...hb,steps:["Қарапайым қадам"]},entry),"todo");
  assert.equal(JO.dayStatus({...hb,steps:["Қарапайым қадам"]},{...entry,done:[0]}),"done");
});

test("кідіртілген күндер серияны бұзбайды, жалғастырғанда тарих сақталады", () => {
  const hb={...good,steps:[],breaks:[{start:"2026-10-23",end:"2026-10-26"}]};
  const state={habits:[hb],logs:[log(hb.id,"2026-10-20",{done:[0]}),log(hb.id,"2026-10-21",{done:[0]}),log(hb.id,"2026-10-22",{done:[0]})],tasks:[]};
  assert.equal(JO.scheduled(hb,"2026-10-24"),false);
  assert.equal(JO.scheduled(hb,T),true);
  assert.deepEqual(JO.runs(state,hb,T),{cur:3,best:3});
  assert.deepEqual(JO.rate(state,hb,T),{done:3,total:3});
  assert.deepEqual(JO.fromRow(JO.toRow("habits",hb)).breaks,hb.breaks);
});

test("күндік жазба, себеп және фокус бұлт айналымында сақталады", () => {
  const entry=log("g",T,{note:"Жазба",reason:"Себеп",focusSeconds:75,values:{m:2.25}});
  assert.deepEqual(JO.fromRow(JO.toRow("logs",entry)),entry);
});

test("аптаның басталу күні салыстыруға әсер етеді", () => {
  const state={habits:[],logs:[],tasks:[task({done:true,doneAt:"2026-11-01",w:3}),task({done:true,doneAt:"2026-11-02",w:2}),task({done:true,doneAt:"2026-10-26",w:4})]};
  const mon=JO.periodComparison(state,"2026-11-02",1),sun=JO.periodComparison(state,"2026-11-02",0);
  assert.equal(mon.week,2);assert.equal(mon.previousWeek,4);assert.equal(sun.week,5);assert.equal(sun.previousWeek,4);
});

test("көшірме толық тексеріледі: қате байланыс пен қайталанған жазба қабылданбайды", () => {
  const backup={version:1,habits:[good],logs:[log("g",T,{values:{a:75}})],tasks:[],goals:[]};
  assert.equal(JO.restoreEntries(backup).logs[0].values.a,75);
  assert.throws(()=>JO.restoreEntries({...backup,version:9}));
  assert.throws(()=>JO.restoreEntries({...backup,habits:[]}));
  assert.throws(()=>JO.restoreEntries({...backup,logs:[...backup.logs,{...backup.logs[0],id:"other"}]}));
});


test("әдеттің тікелей түрлері жасырын қадамдарға тәуелді емес",()=>{
  const hb={...good,target:60,tracking:"timer",measures:[{id:"old",target:100}]};
  assert.equal(JO.dayStatus(hb,log("g",T,{count:75})),"done");
  assert.equal(JO.dayStatus({...hb,tracking:"counter",target:10},log("g",T,{count:12})),"done");
  assert.equal(JO.dayStatus({...hb,tracking:"check"},log("g",T,{done:[0]})),"done");
  assert.equal(JO.dayStatus({...hb,tracking:"steps"},log("g",T,{count:75})),"todo");
  assert.equal(JO.fromRow(JO.toRow("habits",{...hb,increment:0.25})).tracking,"timer");
  assert.equal(JO.fromRow(JO.toRow("habits",{...hb,increment:0.25})).increment,0.25);
});
