import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,effectiveInputs} from '../src/model.mjs';
import {createScenarios,decodeSettings,encodeSettings,validateSettings} from '../src/scenarios.mjs';
import {context as uiContext,elements as uiElements} from './ui-harness.mjs?historical-inflation';

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
 const migrated=decodeSettings(envelope(oldInputs));

 assert.equal(migrated.historicalInflationMode,'total');
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

test('the form bridge preserves cumulative inflation while editing yearly rates',()=>{
 const app=uiContext.__testApp;
 const state={...defaults,resaleMode:'relative',relativeResaleSeeded:true,pastOwnership:true,months:72,
  historicalNewPrice:defaults.price,historicalUsedPrice:defaults.resale,historicalInflationPct:45.6,
  historicalInflationMode:'total',historicalInflationYears:[]};
 app.form.write(state);
 app.update();
 const resaleBefore=effectiveInputs(app.form.read()).resale;
 const yearly={id:'historicalInflationYearlyMode',name:'historicalInflationMethod',value:'yearly',checked:true};

 app.form.handleInput({target:yearly,type:'change'});
 const seeded=JSON.parse(uiElements.historicalInflationYears.value);
 assert.equal(seeded.length,6);
 assert.ok(Math.abs((seeded.reduce((factor,rate)=>factor*(1+rate/100),1)-1)*100-45.6)<1e-9);
 assert.equal(effectiveInputs(app.form.read()).resale,resaleBefore);
 assert.equal(uiElements.historicalInflationDialog.open,true);
 assert.equal(uiElements.historicalInflationPct.value,'45.6');

 app.form.handleInput({target:{id:'historicalInflationYearAmount3',dataset:{historicalInflationYear:'2'},value:'7.5',type:'text'},type:'input'});
 assert.equal(JSON.parse(uiElements.historicalInflationYears.value)[2],7.5);
 const total={id:'historicalInflationTotalMode',name:'historicalInflationMethod',value:'total',checked:true};
 app.form.handleInput({target:total,type:'change'});
 assert.equal(uiElements.historicalInflationMode.value,'total');
 assert.equal(uiElements.historicalInflationPct.value,'45.6');
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
