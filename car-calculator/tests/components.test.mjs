import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {app as browserlessApp,createApp} from '../src/app.mjs';
import {defaults} from '../src/model.mjs';
import {createScenarios} from '../src/scenarios.mjs';
import {createViews} from '../src/views.mjs';
// A distinct module URL keeps lifecycle instrumentation isolated from ui.test.mjs in the full runner.
import {context,elements} from './ui-harness.mjs?components';

const sourceDirectory=join(dirname(fileURLToPath(import.meta.url)),'../src');

function fakeElement(){
 return {
  value:'',checked:false,textContent:'',dataset:{},children:[],listeners:{},
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);},
  dispatch(type){for(const listener of this.listeners[type]??[])listener({target:this,type});},
  replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},
  focus(){},select(){}
 };
}

function fakeDocument(){
 const elements=new Map();
 return {
  elements,
  getElementById(id){
   if(!elements.has(id))elements.set(id,fakeElement());
   return elements.get(id);
  },
  createElement:fakeElement
 };
}

function memoryStorage(entries={}){
 const values=new Map(Object.entries(entries));
 return {
  values,
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>values.set(key,value)
 };
}

function fakeForm(){
 let state={...defaults};
 return {
  read:()=>({...state}),readSettings:()=>({...state}),write:value=>{state={...value};},
  get state(){return state;}
 };
}

test('every source module imports in Node without browser globals',async()=>{
 const names=(await readdir(sourceDirectory)).filter(name=>name.endsWith('.mjs'));
 const modules=await Promise.all(names.map(name=>import(pathToFileURL(join(sourceDirectory,name)))));

 assert.equal(modules.length,names.length);
 assert.equal(browserlessApp,null);
});

test('view factories own independent preference state',()=>{
 const opportunityKey='car-financing-calculator.opportunity-views.v1';
 const inflationKey='car-financing-calculator.inflation-views.v1';
 const firstDocument=fakeDocument(),secondDocument=fakeDocument();
 const firstStorage=memoryStorage({
  [opportunityKey]:JSON.stringify({summary:false}),
  [inflationKey]:JSON.stringify({summary:true})
 });
 const secondStorage=memoryStorage();
 const first=createViews({document:firstDocument,storage:firstStorage,onChange(){}});
 const second=createViews({document:secondDocument,storage:secondStorage,onChange(){}});

 first.initialize();
 second.initialize();

 assert.equal(first.opportunityViews.summary,false);
 assert.equal(second.opportunityViews.summary,true);
 assert.equal(first.inflationViews.summary,true);
 assert.equal(second.inflationViews.summary,false);

 const firstOpportunity=firstDocument.getElementById('opportunity-summary');
 firstOpportunity.checked=true;
 firstOpportunity.dispatch('change');
 const secondOpportunity=secondDocument.getElementById('opportunity-summary');
 secondOpportunity.checked=false;
 secondOpportunity.dispatch('change');

 assert.equal(first.opportunityViews.summary,true);
 assert.equal(second.opportunityViews.summary,false);
 assert.equal(JSON.parse(firstStorage.values.get(opportunityKey)).summary,true);
 assert.equal(JSON.parse(secondStorage.values.get(opportunityKey)).summary,false);
});

test('scenario factories own independent mutable collections',()=>{
 const first=createScenarios({document:fakeDocument(),storage:memoryStorage(),form:fakeForm(),onUpdate(){}});
 const second=createScenarios({document:fakeDocument(),storage:memoryStorage(),form:fakeForm(),onUpdate(){}});

 first.saveSettings({...defaults,carName:'First calculator'});
 assert.equal(first.scenarios.length,1);
 assert.equal(second.scenarios.length,0);

 second.saveSettings({...defaults,carName:'Second calculator'});
 assert.equal(first.scenarios[0].inputs.carName,'First calculator');
 assert.equal(second.scenarios[0].inputs.carName,'Second calculator');
});

test('scenario restore keeps working state when storage is unavailable',()=>{
 const document=fakeDocument(),form=fakeForm();
 let updates=0,setAttempts=0;
 const scenarios=createScenarios({
  document,
  storage:{
   getItem(){throw new Error('storage disabled');},
   setItem(){setAttempts++;throw new Error('storage disabled');}
  },
  form,
  onUpdate(){updates++;}
 });

 assert.doesNotThrow(()=>scenarios.restoreSettings());
 assert.deepEqual(form.state,defaults);
 assert.equal(updates,1);
 assert.equal(setAttempts,0);
 assert.match(document.getElementById('storageStatus').textContent,/Saved scenarios could not be loaded\. Original data preserved/);

 assert.equal(scenarios.saveSettings({...defaults,carName:'Session only'}),false);
 assert.equal(scenarios.scenarios[0].inputs.carName,'Session only');
 assert.equal(setAttempts,0);
 assert.match(document.getElementById('storageStatus').textContent,/Original browser data preserved/);
});

test('app initialization binds controls and registers its model tool once',()=>{
 let elementBindings=0,documentBindings=0,windowBindings=0,toolRegistrations=0;
 for(const element of Object.values(elements)){
  element.listeners={};
  element.addEventListener=function(type,listener){elementBindings++;this.listeners[type]=listener;};
 }
 context.document.addEventListener=()=>{documentBindings++;};
 context.window.addEventListener=()=>{windowBindings++;};
 context.document.modelContext={registerTool(){toolRegistrations++;return Promise.resolve();}};
 const app=createApp({
  document:context.document,
  window:context.window,
  storage:{getItem(){return null;},setItem(){}}
 });

 app.initialize();
 const firstCounts={elementBindings,documentBindings,windowBindings,toolRegistrations};
 app.initialize();

 assert.ok(firstCounts.elementBindings>0);
 assert.ok(firstCounts.documentBindings>0);
 assert.ok(firstCounts.windowBindings>0);
 assert.equal(firstCounts.toolRegistrations,1);
 assert.deepEqual({elementBindings,documentBindings,windowBindings,toolRegistrations},firstCounts);
});
