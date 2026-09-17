import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults} from '../src/model.mjs';
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
 for(const key of ['additionalCostMode','additionalCostAnnual','additionalCostYears','leaseAdditionalCosts'])delete oldInputs[key];
 const migrated=decodeSettings(envelope(oldInputs));

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
