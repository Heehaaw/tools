import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,effectiveInputs,calculate,historicalInflationTotal,historicalInflationRate,validate} from '../src/model.mjs';
import {createScenarios,decodeSettings,encodeSettings,validateSettings} from '../src/scenarios.mjs';
import {context as uiContext,elements as uiElements} from './ui-harness.mjs?historical-inflation';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const displayed=id=>Number(uiElements[id].value.replace(/[\s,]/g,''));
const envelope=inputs=>JSON.stringify({format:'car-financing-calculator',version:1,inputs});
const arrayKeys=Object.keys(defaults).filter(key=>Array.isArray(defaults[key]));
function copy(state){
 const result={...state};
 for(const key of arrayKeys)result[key]=[...state[key]];
 return result;
}

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

test('settings codecs migrate old cumulative inflation and preserve yearly drafts',()=>{
 const oldInputs={...defaults,historicalInflationPct:37.5};
 delete oldInputs.historicalInflationMode;
 delete oldInputs.historicalInflationYears;
 delete oldInputs.historicalInflationAnnual;
 const migrated=decodeSettings(envelope(oldInputs));

 assert.equal(migrated.historicalInflationMode,'total');
 assert.equal(migrated.historicalInflationAnnual,2.5);
 assert.equal(migrated.historicalInflationPct,37.5);
 assert.deepEqual(migrated.historicalInflationYears,[]);
 assert.notEqual(migrated.historicalInflationYears,defaults.historicalInflationYears);

 const draft={...defaults,resaleMode:'direct',historicalInflationMode:'yearly',historicalInflationPct:18,historicalInflationYears:[3,null,0,100]};
 const restored=decodeSettings(encodeSettings(draft));
 assert.equal(restored.historicalInflationMode,'yearly');
 assert.equal(restored.historicalInflationPct,18);
 assert.deepEqual(restored.historicalInflationYears,[3,null,0,100]);

 draft.historicalInflationYears[0]=99;
 assert.deepEqual(restored.historicalInflationYears,[3,null,0,100]);
});

test('persistence validates historical inflation arrays while allowing blank drafts',()=>{
 const invalid=[
  {...defaults,historicalInflationMode:'monthly'},
  {...defaults,historicalInflationYears:{}},
  {...defaults,historicalInflationYears:Array(101).fill(2.5)},
  {...defaults,historicalInflationYears:[-0.1]},
  {...defaults,historicalInflationYears:[100.1]},
  {...defaults,historicalInflationYears:['2.5']},
  {...defaults,historicalInflationYears:[undefined]}
 ];
 for(const state of invalid)assert.throws(()=>validateSettings(state));

 const blank={...defaults,resaleMode:'relative',relativeResaleSeeded:true,historicalNewPrice:1000000,historicalUsedPrice:700000,
  historicalMonths:36,historicalYears:3,historicalInflationMode:'yearly',historicalInflationYears:[2.5,null,4]};
 assert.doesNotThrow(()=>validateSettings(blank));
});

test('example, saved and duplicated scenarios own their inflation arrays',async()=>{
 const document=fakeDocument(),form=fakeForm(),storage=memoryStorage();
 const scenarios=createScenarios({document,storage,form,onUpdate(){}});

 assert.ok(Object.isFrozen(scenarios.exampleInputs.historicalInflationYears));
 assert.throws(()=>scenarios.exampleInputs.historicalInflationYears.push(2.5),TypeError);
 scenarios.initialize();
 scenarios.restoreSettings();
 form.write(copy(defaults));
 await document.getElementById('reset').dispatch('click');
 assert.equal(scenarios.scenarios.length,0);

 const original={...defaults,carName:'Inflation history',resaleMode:'direct',historicalInflationMode:'yearly',historicalInflationYears:[2,null,4]};
 form.write(original);
 scenarios.saveSettings(form.state);
 original.historicalInflationYears[0]=9;
 assert.deepEqual(scenarios.scenarios[0].inputs.historicalInflationYears,[2,null,4]);

 form.write(copy(scenarios.scenarios[0].inputs));
 await document.getElementById('duplicateScenario').dispatch('click');
 form.state.historicalInflationYears[0]=7;
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.historicalInflationYears[0]),[2,2]);
 scenarios.saveSettings(form.state);
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.historicalInflationYears[0]),[2,7]);

 const exported=JSON.parse(scenarios.encodeCollection());
 exported.scenarios[0].inputs.historicalInflationYears[0]=50;
 const exposed=scenarios.scenarios;exposed[0].inputs.historicalInflationYears[0]=60;
 assert.deepEqual(scenarios.scenarios.map(item=>item.inputs.historicalInflationYears[0]),[2,7]);
});

test('an imported inflation schedule stays isolated from the form draft',async()=>{
 const document=fakeDocument(),form=fakeForm(),storage=memoryStorage();
 const scenarios=createScenarios({document,storage,form,onUpdate(){}});
 scenarios.initialize();
 const json=encodeSettings({...defaults,carName:'Imported inflation',resaleMode:'direct',historicalInflationMode:'yearly',historicalInflationYears:[1,2,3]});
 const input=document.getElementById('importFile');
 input.files=[{size:json.length,text:async()=>json}];

 await input.dispatch('change');
 assert.deepEqual(scenarios.scenarios[0].inputs.historicalInflationYears,[1,2,3]);
 form.state.historicalInflationYears[0]=99;
 assert.deepEqual(scenarios.scenarios[0].inputs.historicalInflationYears,[1,2,3]);
});

test('historical linked fields preserve raw inputs and promote results on source changes',()=>{
 const app=uiContext.__testApp;
 const state={...defaults,resaleMode:'relative',relativeResaleSeeded:true,pastOwnership:false,months:72,
  historicalNewPrice:defaults.price,historicalUsedPrice:defaults.resale,historicalInflationPct:45.6,
  historicalInflationMode:'total',historicalInflationYears:[]};
 app.form.write(state);
 app.update();
 const resaleBefore=effectiveInputs(app.form.read()).resale;
 assert.equal(uiElements.historicalInflationAnnual.disabled,true);assert.equal(uiElements.historicalInflationPct.disabled,false);
 close(displayed('historicalInflationAnnual'),(1.456**(1/6)-1)*100);
 assert.equal(app.form.readSettings().historicalInflationAnnual,2.5);
 const yearly={id:'historicalInflationYearlyMode',name:'historicalInflationMethod',value:'yearly',checked:true};

 app.form.handleInput({target:yearly,type:'change'});
 const seeded=JSON.parse(uiElements.historicalInflationYears.value);
 assert.equal(seeded.length,6);
 assert.ok(Math.abs((seeded.reduce((factor,rate)=>factor*(1+rate/100),1)-1)*100-45.6)<1e-9);
 close(effectiveInputs(app.form.read()).resale,resaleBefore);
 assert.equal(uiElements.historicalInflationDialog.open,true);
 assert.equal(uiElements.historicalInflationAnnual.disabled,true);assert.equal(uiElements.historicalInflationPct.disabled,true);
 assert.equal(uiElements.historicalInflationPct.value,'45.6');

 app.form.handleInput({target:{id:'historicalInflationYearAmount3',dataset:{historicalInflationYear:'2'},value:'7.5',type:'text'},type:'input'});
 assert.equal(JSON.parse(uiElements.historicalInflationYears.value)[2],7.5);
 assert.equal(app.form.readSettings().historicalInflationPct,45.6);
 const updatedTotal=historicalInflationTotal(app.form.readSettings());close(displayed('historicalInflationPct'),updatedTotal);
 const total={id:'historicalInflationTotalMode',name:'historicalInflationMethod',value:'total',checked:true};
 app.form.handleInput({target:total,type:'change'});
 assert.equal(uiElements.historicalInflationMode.value,'total');
 close(app.form.readSettings().historicalInflationPct,updatedTotal);
 app.form.handleInput({target:{id:'historicalInflationAnnualMode',name:'historicalInflationMethod',value:'annual',checked:true},type:'change'});
 assert.equal(uiElements.historicalInflationAnnual.disabled,false);assert.equal(uiElements.historicalInflationPct.disabled,true);
 uiElements.historicalInflationAnnual.value='10';app.form.handleInput({target:{id:'historicalInflationAnnual'},type:'change'});
 close(displayed('historicalInflationPct'),(1.1**6-1)*100);
 assert.equal(app.form.readSettings().historicalInflationAnnual,10);
 const roundTrip=decodeSettings(encodeSettings(app.form.readSettings()));assert.equal(roundTrip.historicalInflationMode,'annual');assert.equal(roundTrip.historicalInflationAnnual,10);
 close(roundTrip.historicalInflationPct,updatedTotal);
 assert.equal(uiElements.historicalInflationDialog.open,false);

 app.form.handleInput({target:yearly,type:'change'});
 app.form.handleInput({target:{id:'historicalInflationYearAmount2',dataset:{historicalInflationYear:'1'},value:'',type:'text'},type:'input'});
 const restored=decodeSettings(encodeSettings(app.form.readSettings()));
 assert.equal(restored.historicalInflationYears[1],null);
 assert.equal(uiElements.historicalInflationDialog.open,true);

 uiElements.scenarioSelect.value='';
 uiElements.scenarioSelect.listeners.change({target:uiElements.scenarioSelect});
 assert.equal(uiElements.historicalInflationDialog.open,false);
});

test('historical annual average matches total and yearly modes across linked and separate ages',()=>{
 const base={...defaults,resaleMode:'relative',relativeResaleSeeded:true,historicalNewPrice:1000000,historicalUsedPrice:700000,
  historicalMatchPeriod:false,historicalMonths:30,months:36,historicalInflationMode:'annual',historicalInflationAnnual:10,historicalInflationPct:null};
 close(historicalInflationTotal(base),(1.1**2.5-1)*100);close(historicalInflationRate(base),10);
 for(const pastOwnership of [false,true]){
  const annual={...base,pastOwnership},total={...annual,historicalInflationMode:'total',historicalInflationPct:historicalInflationTotal(annual),historicalInflationAnnual:null};
  const yearly={...annual,historicalInflationMode:'yearly',historicalInflationYears:[10,10,10],historicalInflationAnnual:null};
  for(const state of [annual,total,yearly]){
   assert.doesNotThrow(()=>validate(state));assert.deepEqual(effectiveInputs(effectiveInputs(state)),effectiveInputs(state));
   close(effectiveInputs(state).resale,effectiveInputs(annual).resale);
   close(calculate(state,{todayMoney:true,opportunity:true}).cashPurchase.adjusted,calculate(annual,{todayMoney:true,opportunity:true}).cashPurchase.adjusted);
  }
 }
 close(historicalInflationTotal({...base,historicalInflationAnnual:0}),0);
 for(const months of [1,6,18,30,120])assert.doesNotThrow(()=>validate({...base,pastOwnership:true,months,historicalInflationAnnual:100}));
 const blank={...base,historicalInflationAnnual:null};
 assert.doesNotThrow(()=>validateSettings(blank));assert.throws(()=>validate(blank));
 assert.doesNotThrow(()=>validate({...blank,resaleMode:'direct'}));
 for(const historicalInflationAnnual of [-1,101])assert.throws(()=>validateSettings({...base,historicalInflationAnnual}));
});

test('split past inflation can use the main average or independent annual, total and yearly inputs',()=>{
 const base={...defaults,pastOwnership:true,resaleMode:'relative',relativeResaleSeeded:true,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,months:36,historicalMonths:24,
  price:340000,historicalNewPrice:340000,historicalUsedPrice:240000,inflationRate:10,historicalInflationMode:'total',historicalInflationPct:999,historicalInflationAnnual:5};
 close(historicalInflationTotal(base),21);
 const independent={...base,pastHistoricalInflationMode:'annual'};
 close(historicalInflationTotal(independent),10.25);close(effectiveInputs(independent).inflationRate,10);
 close(effectiveInputs(independent).resale,340000*(240000/(340000*1.05**2))**1.5*1.1**3);
 for(const state of [{...base,pastHistoricalInflationMode:'total',historicalInflationPct:10.25},{...base,pastHistoricalInflationMode:'yearly',historicalInflationYears:[5,5]}]){
  close(effectiveInputs(state).resale,effectiveInputs(independent).resale);
  close(calculate(state,{opportunity:true,todayMoney:true}).cashPurchase.adjusted,calculate(independent,{opportunity:true,todayMoney:true}).cashPurchase.adjusted);
 }
 const blank={...base,pastHistoricalInflationMode:'yearly',historicalInflationYears:[null]};
 assert.throws(()=>calculate(blank),/active yearly historical/);
 assert.doesNotThrow(()=>calculate({...blank,matchPeriods:true,balloonMatchPeriod:true,normalMatchPeriod:true,leaseMatchPeriod:true,cashMatchPeriod:true,pastHistoricalMatchPeriod:true}));
 assert.doesNotThrow(()=>calculate({...blank,pastHistoricalInflationMode:'main'}));
 const legacy={...base};delete legacy.pastHistoricalInflationMode;
 const restored=decodeSettings(envelope(legacy));assert.equal(restored.pastHistoricalInflationMode,'main');close(effectiveInputs(restored).resale,effectiveInputs(base).resale);
 const app=uiContext.__testApp;app.form.write(base);app.update();
 const choose=value=>app.form.handleInput({type:'change',target:{id:'historicalInflation'+value[0].toUpperCase()+value.slice(1)+'Mode',name:'historicalInflationMethod',value,checked:true}});
 assert.equal(uiElements.historicalInflationMainMode.checked,true);
 assert.equal(uiElements.historicalInflationAnnual.disabled,true);assert.equal(uiElements.historicalInflationPct.disabled,true);
 close(displayed('historicalInflationAnnual'),10);close(displayed('historicalInflationPct'),21);
 choose('annual');close(app.form.readSettings().historicalInflationAnnual,10);assert.equal(uiElements.historicalInflationAnnual.disabled,false);
 uiElements.historicalInflationAnnual.value='5';app.form.handleInput({type:'change',target:{id:'historicalInflationAnnual'}});
 close(displayed('historicalInflationPct'),10.25);assert.equal(app.form.readSettings().inflationRate,10);
 assert.match(uiElements.relativeResaleExplanation.textContent,/Annualised historical inflation: 5%/);
 choose('total');close(app.form.readSettings().historicalInflationPct,10.25);
 choose('yearly');assert.equal(uiElements.historicalInflationDialog.open,true);assert.equal(uiElements.historicalInflationAnnual.disabled,true);assert.equal(uiElements.historicalInflationPct.disabled,true);
 choose('main');assert.equal(uiElements.historicalInflationDialog.open,false);close(displayed('historicalInflationPct'),21);
 close(app.form.readSettings().historicalInflationAnnual,5);close(app.form.readSettings().historicalInflationPct,10.25);
 const settings=decodeSettings(encodeSettings(app.form.readSettings()));assert.equal(settings.pastHistoricalInflationMode,'main');assert.equal(settings.historicalInflationMode,'total');
 choose('annual');uiElements.historicalInflationAnnual.value='5';app.form.handleInput({type:'change',target:{id:'historicalInflationAnnual'}});
 uiElements.historicalSeparatePeriod.checked=false;app.form.handleInput({type:'change',target:{id:'historicalSeparatePeriod',checked:false}});assert.equal(uiElements.historicalInflationSection.hidden,true);close(effectiveInputs(app.form.readSettings()).historicalInflationPct,33.1);
 uiElements.historicalSeparatePeriod.checked=true;app.form.handleInput({type:'change',target:{id:'historicalSeparatePeriod',checked:true}});assert.equal(uiElements.historicalInflationSection.hidden,false);close(effectiveInputs(app.form.readSettings()).historicalInflationPct,10.25);
 uiElements.pastOwnership.checked=false;app.form.handleInput({type:'change',target:{id:'pastOwnership'}});assert.equal(uiElements.historicalInflationTotalMode.checked,true);
});
