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
    document:{body,createElement:t=>new Element(t),getElementById:id=>ids[id] || walk(body).find(e=>e.attrs.id===id),querySelectorAll:()=>[],addEventListener(){}},
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
