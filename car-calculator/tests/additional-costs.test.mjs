import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,calculate,variants} from '../src/model.mjs';
import {createScenarios,decodeSettings,encodeSettings,validateSettings} from '../src/scenarios.mjs';
import {context as uiContext,elements as uiElements} from './ui-harness.mjs?additional-costs';

const envelope=inputs=>JSON.stringify({format:'car-financing-calculator',version:1,inputs});
const copy=state=>({...state,additionalCostYears:[...state.additionalCostYears]});

function fakeElement(){
 return {
  value:'',textContent:'',dataset:{},children:[],listeners:{},files:[],
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);},
  async dispatch(type,event={}){for(const listener of this.listeners[type]??[])await listener({target:this,type,...event});},
  replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},
  focus(){},select(){},click(){},remove(){}
 };
}

function fakeDocument(){
 const elements=new Map();
 return {
  body:fakeElement(),elements,
  getElementById(id){
   if(!elements.has(id))elements.set(id,fakeElement());
   return elements.get(id);
  },
  createElement:fakeElement
 };
}

function memoryStorage(){
 const values=new Map();
 return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}

function fakeForm(initial=defaults){
 let state=copy(initial);
 return {
  read:()=>state,readSettings:()=>state,write:value=>{state=value;},
  get state(){return state;}
 };
}

test('settings codecs migrate old data and preserve annual and yearly drafts',()=>{
 const oldInputs={...defaults};
 for(const key of ['additionalSeparatePeriod','additionalCostMonths','additionalCostMode','additionalCostAnnual','additionalCostYears','leaseAdditionalCosts'])delete oldInputs[key];
 const migrated=decodeSettings(envelope(oldInputs));

 assert.equal(migrated.additionalSeparatePeriod,false);
 assert.equal(migrated.additionalCostMonths,36);
 assert.equal(migrated.additionalCostMode,'annual');
 assert.equal(migrated.additionalCostAnnual,0);
 assert.deepEqual(migrated.additionalCostYears,[]);
 assert.equal(migrated.leaseAdditionalCosts,false);
 assert.notEqual(migrated.additionalCostYears,defaults.additionalCostYears);

 const draft={...defaults,additionalCostMode:'annual',additionalCostAnnual:1200,additionalCostYears:[0,null,750],leaseAdditionalCosts:true};
 const restored=decodeSettings(encodeSettings(draft));
 assert.equal(restored.additionalCostMode,'annual');
 assert.equal(restored.additionalCostAnnual,1200);
 assert.deepEqual(restored.additionalCostYears,[0,null,750]);
 assert.equal(restored.leaseAdditionalCosts,true);

 draft.additionalCostYears[0]=999;
 assert.deepEqual(restored.additionalCostYears,[0,null,750]);
});

test('persistence rejects malformed additional-cost settings',()=>{
 const invalid=[
  {...defaults,additionalCostMode:'monthly'},
  {...defaults,additionalCostAnnual:-1},
  {...defaults,additionalCostYears:{}},
  {...defaults,additionalCostYears:Array(11).fill(0)},
  {...defaults,additionalCostYears:[0,'100']},
  {...defaults,additionalCostYears:[undefined]},
  {...defaults,leaseAdditionalCosts:'yes'}
 ];

 for(const state of invalid)assert.throws(()=>validateSettings(state));
 assert.doesNotThrow(()=>validateSettings({...defaults,additionalCostMode:'yearly',additionalCostAnnual:null,additionalCostYears:[0,null,300]}));
});

test('the permanent example and duplicate scenarios do not share yearly arrays',async()=>{
 const document=fakeDocument(),form=fakeForm(),storage=memoryStorage();
 const scenarios=createScenarios({document,storage,form,onUpdate(){}});

 assert.ok(Object.isFrozen(scenarios.exampleInputs));
 assert.ok(Object.isFrozen(scenarios.exampleInputs.additionalCostYears));
 assert.throws(()=>scenarios.exampleInputs.additionalCostYears.push(1),TypeError);

 scenarios.initialize();
 scenarios.restoreSettings();
 form.state.additionalCostYears.push(999);
 assert.deepEqual(scenarios.exampleInputs.additionalCostYears,[]);
 await document.getElementById('reset').dispatch('click');
 assert.equal(scenarios.scenarios.length,0);

 const original={...defaults,carName:'Cost plan',additionalCostMode:'yearly',additionalCostAnnual:500,additionalCostYears:[100,null,300]};
 form.write(original);
 scenarios.saveSettings(form.state);
 original.additionalCostYears[0]=800;
 assert.deepEqual(scenarios.scenarios[0].inputs.additionalCostYears,[100,null,300]);

 await document.getElementById('duplicateScenario').dispatch('click');
 form.state.additionalCostYears[0]=900;
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.additionalCostYears[0]),[800,800]);
 scenarios.saveSettings(form.state);
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.additionalCostYears[0]),[800,900]);

 const exported=JSON.parse(scenarios.encodeCollection());
 exported.scenarios[0].inputs.additionalCostYears[0]=700;
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.additionalCostYears[0]),[800,900]);
});

test('imported yearly arrays stay isolated from the form draft',async()=>{
 const document=fakeDocument(),form=fakeForm(),storage=memoryStorage();
 const scenarios=createScenarios({document,storage,form,onUpdate(){}});
 scenarios.initialize();
 const json=encodeSettings({...defaults,carName:'Imported costs',additionalCostMode:'yearly',additionalCostAnnual:400,additionalCostYears:[125,250]});
 const input=document.getElementById('importFile');
 input.files=[{size:json.length,text:async()=>json}];

 await input.dispatch('change');
 assert.deepEqual(scenarios.scenarios[0].inputs.additionalCostYears,[125,250]);

 form.state.additionalCostYears[0]=999;
 assert.deepEqual(scenarios.scenarios[0].inputs.additionalCostYears,[125,250]);
});

test('the form bridge seeds yearly costs once and preserves hidden drafts',()=>{
 const app=uiContext.__testApp;
 const annual=uiElements.additionalModeAnnual,yearly=uiElements.additionalModeYearly;
 annual.id='additionalModeAnnual';annual.name='additionalMethod';annual.type='radio';annual.value='annual';
 yearly.id='additionalModeYearly';yearly.name='additionalMethod';yearly.type='radio';yearly.value='yearly';
 for(let index=0;index<10;index++){
  const amount=uiElements['additionalYearAmount'+(index+1)],slider=uiElements['additionalYearSlider'+(index+1)];
  amount.id='additionalYearAmount'+(index+1);amount.type='number';amount.dataset.additionalYear=String(index);
  slider.id='additionalYearSlider'+(index+1);slider.type='range';slider.dataset.additionalYear=String(index);
 }
 uiElements.months.id='months';

 assert.equal(app.scenarios.scenarios.length,0);
 uiElements.reset.listeners.click();
 assert.equal(app.scenarios.scenarios.length,0);

 app.form.write({...defaults,months:30,additionalCostAnnual:25000,additionalCostYears:[]});
 app.update();
 yearly.checked=true;
 app.form.handleInput({target:yearly,type:'change'});
 assert.equal(uiElements.additionalCostMode.value,'yearly');
 assert.equal(uiElements.additionalCostsDialog.open,true);
 uiElements.doneAdditionalYears.listeners.click();
 assert.equal(uiElements.additionalCostsDialog.open,false);
 uiElements.editAdditionalYears.listeners.click();
 assert.equal(uiElements.additionalCostsDialog.open,true);
 assert.deepEqual(JSON.parse(uiElements.additionalCostYears.value),[25000,25000,25000]);
 assert.match(uiElements.additionalYearPeriod3.textContent,/Months 25–30/);
 assert.match(uiElements.additionalYearTotal3.textContent,/12.?500 Kč · 6\/12 year/);

 const secondYear=uiElements.additionalYearAmount2;
 secondYear.value='30000';
 app.form.handleInput({target:secondYear,type:'input'});
 uiElements.months.value='12';
 app.form.handleInput({target:uiElements.months,type:'input'});
 assert.deepEqual(JSON.parse(uiElements.additionalCostYears.value),[25000,30000,25000]);
 assert.equal(uiElements.additionalYear2.hidden,true);

 annual.checked=true;
 app.form.handleInput({target:annual,type:'change'});
 assert.equal(uiElements.additionalCostMode.value,'annual');
 assert.equal(uiElements.additionalCostsDialog.open,false);
 yearly.checked=true;
 app.form.handleInput({target:yearly,type:'change'});
 assert.deepEqual(JSON.parse(uiElements.additionalCostYears.value),[25000,30000,25000]);

 secondYear.value='';
 app.form.handleInput({target:secondYear,type:'input'});
 const restored=decodeSettings(encodeSettings(app.form.readSettings()));
 assert.deepEqual(restored.additionalCostYears,[25000,null,25000]);
 annual.checked=true;
 app.form.handleInput({target:annual,type:'change'});
 assert.equal(uiElements.error.hidden,true);

 app.form.write({...defaults,pastOwnership:true});
 app.update();
 assert.equal(uiElements.additionalCostTitle.textContent,'Actual additional costs');
 assert.equal(uiElements.additionalCostsDialog.open,false);
 assert.equal(uiElements.additionalDialogTitle.textContent,'Actual yearly additional costs');
});


test('separate cost periods stop dated expenses and VAT while valuation runs to ownership end',()=>{
 const raw={...defaults,months:36,additionalSeparatePeriod:true,additionalCostMonths:18,additionalCostAnnual:12100,leaseAdditionalCosts:true,normalMatchPeriod:false,normalMonths:9,cashMatchPeriod:false,cashMonths:48};
 const expectedMonths={balloonLoan:[12,18],standardLoan:[9],lease:[12,18],cashPurchase:[12,18]};
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const result=calculate(raw,{opportunity,todayMoney}),baseline=calculate({...raw,additionalCostAnnual:0},{opportunity,todayMoney});
  for(const v of variants){
   const r=result[v.key],events=r.events.filter(e=>e.category==='additional');
   assert.deepEqual(events.map(e=>e.month),expectedMonths[v.key]);
   close(r.additionalCosts,12100*Math.min(r.months,18)/12);
   let expected=0;
   for(const e of events){
    const net=e.amount/1.21;
    const value=opportunity?net*1.085**((r.months-e.month)/12):net;
    expected+=value/(todayMoney?1.025**((opportunity?r.months:e.month)/12):1);
    const vatDelta=r.events.filter(x=>x.category==='vat'&&x.month===e.month).reduce((sum,x)=>sum+x.amount,0)-baseline[v.key].events.filter(x=>x.category==='vat'&&x.month===e.month).reduce((sum,x)=>sum+x.amount,0);
    close(vatDelta,net-e.amount);
   }
   close(r.adjusted-baseline[v.key].adjusted,expected);
  }
 }
 const yearly={...raw,additionalCostMode:'yearly',additionalCostAnnual:null,additionalCostYears:[12100,24200,null]};
 assert.equal(calculate(yearly).cashPurchase.additionalCosts,24200);
 assert.equal(calculate({...yearly,leaseAdditionalCosts:false}).lease.additionalCosts,0);
 assert.throws(()=>calculate({...yearly,additionalCostMonths:30}));
 for(const months of [0,1.5,121])assert.throws(()=>calculate({...raw,additionalCostMonths:months}));
 assert.doesNotThrow(()=>calculate({...raw,additionalSeparatePeriod:false,additionalCostMonths:null}));
});

test('additional-cost period controls preserve custom months and inactive yearly drafts',()=>{
 const app=uiContext.__testApp;
 const toggle=checked=>{uiElements.additionalSeparatePeriod.checked=checked;app.form.handleInput({type:'change',target:{id:'additionalSeparatePeriod',checked}});};
 app.form.write({...defaults,pastOwnership:true,additionalCostMode:'yearly',additionalCostAnnual:0,additionalCostYears:[12000,24000,null],additionalCostMonths:18});app.update();
 assert.equal(uiElements.additionalPeriodSettings.hidden,true);
 assert.equal(uiElements.additionalCostMonths.disabled,true);
 toggle(true);
 assert.equal(uiElements.additionalPeriodSettings.hidden,false);
 assert.equal(uiElements.additionalCostMonths.disabled,false);
 assert.equal(uiElements.error.hidden,true);
 assert.equal(uiElements.additionalYear3.hidden,true);
 assert.match(uiElements.additionalYearPeriod2.textContent,/Months 13–18/);
 assert.match(uiElements.additionalYearlyTotal.textContent,/24.?000 Kč.*18 months/);
 toggle(false);
 assert.equal(uiElements.additionalPeriodSettings.hidden,true);
 assert.equal(uiElements.additionalYear3.hidden,false);
 assert.equal(app.form.readSettings().additionalCostMonths,18);
 toggle(true);
 const restored=decodeSettings(encodeSettings(app.form.readSettings()));
 assert.equal(restored.additionalSeparatePeriod,true);
 assert.equal(restored.additionalCostMonths,18);
 assert.deepEqual(restored.additionalCostYears,[12000,24000,null]);
 const draft={...restored,additionalCostMonths:null};
 assert.equal(decodeSettings(encodeSettings(draft)).additionalCostMonths,null);
});

test('additional-cost switch preserves old budgets and excludes disabled expenses and timing effects',()=>{
 const budget={...defaults,additionalCostMode:'yearly',additionalCostAnnual:15000,additionalCostYears:[12100,24200,36300],additionalSeparatePeriod:true,additionalCostMonths:30,leaseAdditionalCosts:true};
 const legacy={...budget};delete legacy.additionalCostsEnabled;
 const restored=decodeSettings(envelope(legacy));
 assert.equal(restored.additionalCostsEnabled,true);
 assert.ok(calculate(restored).balloonLoan.additionalCosts>0);
 const disabled={...budget,additionalCostsEnabled:false};
 assert.deepEqual(decodeSettings(encodeSettings(disabled)),disabled);
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const actual=calculate(disabled,{opportunity,todayMoney});
  const zero=calculate({...budget,additionalCostMode:'annual',additionalCostAnnual:0},{opportunity,todayMoney});
  for(const v of variants){
   assert.equal(actual[v.key].additionalCosts,0);
   assert.equal(actual[v.key].opportunityBreakdown.additional,0);
   assert.equal(actual[v.key].adjusted,zero[v.key].adjusted);
   assert.ok(!actual[v.key].events.some(event=>event.category==='additional'));
  }
 }
 const draft={...disabled,additionalCostAnnual:null,additionalCostMonths:null,additionalCostYears:[null,0,300]};
 assert.deepEqual(decodeSettings(encodeSettings(draft)),draft);
 assert.doesNotThrow(()=>calculate(draft));
 assert.throws(()=>calculate({...draft,additionalCostsEnabled:true}));
 assert.throws(()=>validateSettings({...disabled,additionalCostYears:['bad']}));
});

test('additional-cost controls hide without losing entries and the result row remains at zero',()=>{
 const app=uiContext.__testApp,toggle=uiElements.additionalCostsEnabled;
 toggle.id='additionalCostsEnabled';toggle.type='checkbox';
 const budget={...defaults,pastOwnership:true,additionalCostMode:'yearly',additionalCostAnnual:15000,additionalCostYears:[10000,20000,30000],additionalSeparatePeriod:true,additionalCostMonths:30,leaseAdditionalCosts:true};
 app.form.write(budget);app.update();
 uiElements.editAdditionalYears.listeners.click();assert.equal(uiElements.additionalCostsDialog.open,true);
 toggle.checked=false;app.form.handleInput({target:toggle,type:'change'});
 assert.equal(uiElements.additionalCostFields.hidden,true);
 assert.equal(uiElements.additionalCostFields.disabled,true);
 assert.equal(uiElements.additionalCostsDialog.open,false);
 assert.equal(uiElements.editAdditionalYears.disabled,true);
 assert.equal(uiElements.error.hidden,true);
 const row=uiElements.costRows.innerHTML.match(/<th scope="row">Actual additional costs<\/th>(.*?)<\/tr>/)[1];
 assert.equal([...row.matchAll(/data-full-term="0"/g)].length,4);
 assert.deepEqual(app.form.readSettings(),{...budget,additionalCostsEnabled:false});
 toggle.checked=true;app.form.handleInput({target:toggle,type:'change'});
 assert.equal(uiElements.additionalCostFields.hidden,false);
 assert.equal(uiElements.additionalCostFields.disabled,false);
 assert.equal(uiElements.editAdditionalYears.disabled,false);
 assert.deepEqual(app.form.readSettings(),budget);
 assert.ok(calculate(app.form.read()).balloonLoan.additionalCosts>0);
});
