import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

// DOM harness tests event/state integration; real layout is checked separately.
function app() {
  class Element {
    constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.events={};this.value="";this.hidden=false;}
    setAttribute(k,v){this.attrs[k]=v;if(k==="value")this.value=v;}
    removeAttribute(k){delete this.attrs[k];}
    addEventListener(k,fn){this.events[k]=fn;}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    showModal(){this.open=true;}
    close(){this.open=false;this.events.close?.();}
    remove(){this.removed=true;}
    focus(){}
    click(){this.events.click?.({currentTarget:this,target:this});}
  }
  const body=new Element("body"),ids=Object.fromEntries(["view","nav","quick-add","toast"].map(id=>[id,new Element(id)]));body.append(...Object.values(ids));
  const walk=node=>[node,...(node.children || []).filter(x=>x instanceof Element).flatMap(walk)];
  const storage=new Map();let now=Date.parse("2026-11-05T04:00:00Z");
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const ctx=vm.createContext({Date:Clock,Intl,crypto:webcrypto,structuredClone,Blob,URL,
    document:{body,documentElement:new Element("html"),createElement:t=>new Element(t),getElementById:id=>ids[id] || walk(body).find(e=>e.attrs.id===id),querySelectorAll:()=>[],addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    navigator:{},Sync:{state:"local",busy:false,start(){},schedule(){}},addEventListener(){},scrollTo(){},setInterval(){},setTimeout(){},clearTimeout(){},alert(){},confirm:()=>true,
    FormData:class{constructor(form){this.entries=walk(form).filter(e=>e.attrs.name).map(e=>[e.attrs.name,e.value]);}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}
  });
  vm.runInContext(fs.readFileSync(new URL("../jospar/core.js",import.meta.url),"utf8"),ctx);
  vm.runInContext(fs.readFileSync(new URL("../jospar/app.js",import.meta.url),"utf8"),ctx);
  const run=code=>vm.runInContext(code,ctx);
  return {run,storage,advance:ms=>{now+=ms;},ids,walk,body};
}
const seed=`S.habits=[{id:'h',name:'Еркін әдет',kind:'good',steps:[],created:today(),w:1,goal:'g',measures:[{id:'timer',name:'Уақыт',mode:'timer',target:60,unit:'сек',increment:1},{id:'count',name:'Санақ',mode:'counter',target:10,unit:'рет',increment:1},{id:'volume',name:'Көлем',mode:'counter',target:2,unit:'л',increment:0.25}]}];S.goals=[{id:'g',title:'Бағыт',why:'Даму',deadline:'2027-01-01'}];checkpoint=JSON.stringify(Object.fromEntries(LISTS.map(k=>[k,S[k]])));`;

test("all pages and measured habit detail render; counters allow exceeding target and undo",()=>{
  const a=app();a.run(seed);
  a.run(`for(const t of ['home','tasks','goals','profile'])go(t);openHabit(S.habits[0]);`);
  assert.equal(a.ids.nav.children.length,5);
  a.run(`writeMeasure(S.habits[0],S.habits[0].measures[2],today(),2.25);`);
  assert.equal(a.run(`S.logs[0].values.volume`),2.25);
  a.run(`undoLast()`);assert.equal(a.run(`S.logs.length`),0);
});

test("timer saves elapsed wall time to its original day and survives reload",()=>{
  const a=app();a.run(seed);
  a.run(`startTimer(S.habits[0],S.habits[0].measures[0],today());`);a.advance(75000);
  assert.ok(a.storage.get("jospar.timer"));
  a.run(`runningTimer=JSON.parse(localStorage.getItem('jospar.timer'));habitDate=JO.addDays(today(),-1);stopTimer();`);
  assert.equal(a.run(`S.logs[0].values.timer`),75);
  assert.equal(a.run(`S.logs[0].date`),"2026-11-05");assert.equal(a.storage.has("jospar.timer"),false);
});

test("habit editor preserves measured step identities and saves edited fields",()=>{
  const a=app();a.run(seed);a.run(`habitForm(S.habits[0]);`);
  const forms=a.walk(a.body).filter(e=>e.tag==="form"),form=forms.at(-1),fields=a.walk(form);
  fields.find(e=>e.attrs.name==="name").value="Жаңарған атау";
  form.events.submit({preventDefault(){}});
  assert.equal(a.run(`S.habits[0].name`),"Жаңарған атау");
  assert.equal(a.run(`S.habits[0].measures[0].id`),"timer");
});

test("measured-step form adds generic volume with custom increment; archived habits leave planner",()=>{
  const a=app();a.run(seed);a.run(`measureForm(S.habits[0]);`);
  const form=a.walk(a.body).filter(e=>e.tag==="form").at(-1),fields=a.walk(form);
  for(const [k,v] of Object.entries({name:"Жаңа көлем",mode:"counter",target:"3",unit:"л",increment:"0.3"}))fields.find(e=>e.attrs.name===k).value=v;
  form.events.submit({preventDefault(){}});
  assert.equal(a.run(`S.habits[0].measures.at(-1).increment`),0.3);
  a.run(`changeHabitState(S.habits[0],'archived')`);
  assert.equal(a.run(`JO.scheduled(S.habits[0],today())`),false);
  a.run(`changeHabitState(S.habits[0],'active')`);assert.equal(a.run(`JO.scheduled(S.habits[0],today())`),true);
});


test("direct timer and counter are mutually exclusive with steps; primary timer records seconds",()=>{
  const a=app();a.run(seed);a.run(`S.habits[0].tracking='timer';S.habits[0].target=60;openHabit(S.habits[0]);`);
  const text=node=>typeof node==='string' ? node : (node.children || []).map(text).join(' ');
  assert.ok(!text(a.ids.view).includes('Қадам қосу'));
  a.run(`startTimer(S.habits[0],habitMeasure(S.habits[0]),today());`);a.advance(75000);a.run(`stopTimer()`);
  assert.equal(a.run(`S.logs[0].count`),75);assert.equal(a.run(`JO.dayStatus(S.habits[0],S.logs[0])`),'done');
  a.run(`S.habits[0].tracking='counter';S.habits[0].target=2;S.habits[0].increment=0.25;writeMeasure(S.habits[0],habitMeasure(S.habits[0]),today(),2.25);`);
  assert.equal(a.run(`S.logs[0].count`),2.25);
  a.run(`S.habits[0].tracking='steps';render()`);assert.ok(text(a.ids.view).includes('Қадам қосу'));
});

test("habit form shows fields for selected mode and permits empty steps before adding measured ones",()=>{
  const a=app();a.run(seed);a.run(`habitForm(S.habits[0])`);
  const form=a.walk(a.body).filter(e=>e.tag==='form').at(-1),fields=a.walk(form);
  const mode=fields.find(e=>e.attrs.name==='tracking');
  const labelOf=name=>fields.find(e=>e.children?.some(c=>c.attrs?.name===name));
  assert.equal(labelOf('target').hidden,true);assert.equal(labelOf('steps').hidden,false);
  assert.ok(!fields.find(e=>e.attrs.name==='steps').attrs.required);
  mode.value='timer';mode.events.change();
  assert.equal(labelOf('target').hidden,false);assert.equal(labelOf('steps').hidden,true);assert.equal(labelOf('unit').hidden,true);
  mode.value='counter';mode.events.change();assert.equal(labelOf('increment').hidden,false);
});

test("task detail adds, edits and completes subtasks; undo restores parent and children",()=>{
  const a=app();a.run(`S.tasks=[{id:'task',title:'Негізгі тапсырма',due:today(),time:'',dur:0,w:1,goal:'',done:false,doneAt:''}];checkpoint=JSON.stringify(Object.fromEntries(LISTS.map(k=>[k,S[k]])));openTask(S.tasks[0]);subtaskForm(S.tasks[0]);`);
  const form=a.walk(a.body).filter(e=>e.tag==='form').at(-1);
  a.walk(form).find(e=>e.attrs.name==='title').value='Бірінші қадам';
  form.events.submit({preventDefault(){}});
  assert.equal(a.run(`S.tasks[0].subtasks[0].title`),'Бірінші қадам');
  a.run(`updateSubtasks('task',list=>list.map(s=>({...s,done:true})));`);
  assert.equal(a.run(`S.tasks[0].done`),true);
  a.run(`undoLast()`);assert.equal(a.run(`S.tasks[0].done`),false);assert.equal(a.run(`S.tasks[0].subtasks[0].done`),false);
  a.run(`toggleTask(S.tasks[0])`);assert.equal(a.run(`S.tasks[0].subtasks[0].done`),true);
  a.run(`go('home');openTask(S.tasks[0]);go('goals')`);assert.equal(a.run(`selectedTask`),'');
});


test("streak flame reflects current streak and resets on a slip",()=>{
  const a=app();a.run(`S.habits=[{id:'bad',name:'Таңдау',kind:'bad',steps:[],created:JO.addDays(today(),-9),w:1}];`);
  assert.equal(a.run(`streakBadge(S.habits[0]).attrs['aria-label']`),'9 күн қатарынан');
  a.run(`openHabit(S.habits[0]);slip(S.habits[0]);`);
  assert.equal(a.run(`streakBadge(S.habits[0]).attrs['aria-label']`),'0 күн қатарынан');
});

test("reading size is persistent and tabs expose correct selected states",()=>{
  const a=app();a.run(seed);a.run(`go('profile');profileTab='settings';render();`);
  const controls=a.walk(a.ids.view).find(e=>e.attrs['aria-label']==='Мәтін өлшемі');
  assert.equal(controls.children[1].attrs['aria-pressed'],'true');
  assert.equal(controls.children[0].attrs['aria-pressed'],'false');
  controls.children[2].click();
  assert.equal(JSON.parse(a.storage.get('jospar.preferences')).textSize,'extra');
  assert.equal(a.run(`document.documentElement.attrs['data-text-size']`),'extra');
  a.run(`profileTab='overview';render();`);
  assert.ok(a.walk(a.ids.view).some(e=>e.attrs['aria-label']==='Профиль бөлімі'));
});

test("task rows leave full width for title; rescheduling is available inside detail",()=>{
  const a=app();a.run(`S.tasks=[{id:'late',title:'Ұзын атауы бар тапсырма',due:JO.addDays(today(),-1),done:false,doneAt:'',time:'',goal:'',w:1}];go('tasks');`);
  const text=n=>typeof n==='string' ? n:(n.children || []).map(text).join(' ');
  assert.ok(!text(a.ids.view).includes('Күнін ауыстыру'));
  a.run(`openTask(S.tasks[0])`);assert.ok(text(a.ids.view).includes('Күнін ауыстыру'));
});
