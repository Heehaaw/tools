import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../src/model.mjs';

function element(){
 let value='';
 return {get value(){return value},set value(v){value=String(v)},checked:false,hidden:false,textContent:'',innerHTML:'',dataset:{},listeners:{},children:[],
 classList:{add(){},remove(){},contains(){return false}},closest(){return null},querySelectorAll(){return []},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn},replaceChildren(){this.children=[]},appendChild(e){this.children.push(e)},focus(){},select(){},click(){},remove(){},open:false,showModal(){this.open=true;},close(){this.open=false;}};
}

export const html=fs.readFileSync(new URL('../car-financing-calculator.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
export const elements=Object.fromEntries(ids.map(id=>[id,element()]));
export const saved=new Map();
export const context=vm.createContext({console,Intl,Math,Date,JSON,Number,Object,Set,Error,AbortController,URL,Blob,setTimeout,
 document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){},getElementById(id){assert.ok(elements[id],'Missing element '+id);return elements[id]},documentElement:{dataset:{}},createElement:element,body:element()},
 localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},
 window:{matchMedia:()=>({matches:false}),addEventListener(){}}
});

for(const script of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],context);

const app=vm.runInContext("typeof __modules==='undefined'?null:__modules['./app.mjs']?.app??null",context);
if(app){
 const format=vm.runInContext("__modules['./format.mjs']",context);
 Object.assign(context,{__testApp:app,__testFormat:format,__testModel:{...model}});
 vm.runInContext(`
  Object.assign(globalThis,{
   $:id=>document.getElementById(id),
   defaults:__testModel.defaults,
   calculate:__testModel.calculate,
   parseNumber:__testFormat.parseNumber,
   formatNumberInput:__testFormat.formatNumberInput,
   read:__testApp.form.read,
   write:__testApp.form.write,
   readSettings:__testApp.form.readSettings,
   handleInput:__testApp.form.handleInput,
   initializeOpportunityViews:__testApp.views.initializeOpportunityViews,
   initializeInflationViews:__testApp.views.initializeInflationViews,
   viewInputs:__testApp.views.viewInputs,
   chartData:__testApp.charts.chartData,
   graphTooltipValues:__testApp.charts.graphTooltipValues,
   chartPositions:__testApp.charts.chartPositions,
   vatTableValues:__testApp.results.vatTableValues,
   decodeSettings:__testApp.scenarios.decodeSettings,
   encodeSettings:__testApp.scenarios.encodeSettings,
   decodeCollection:__testApp.scenarios.decodeCollection,
   encodeCollection:__testApp.scenarios.encodeCollection,
   currentValidSettings:__testApp.scenarios.currentValidSettings,
   saveSettings:__testApp.scenarios.saveSettings,
   restoreSettings:__testApp.scenarios.restoreSettings,
   persistCollection:__testApp.scenarios.persistCollection,
   update:__testApp.update
  });
  Object.defineProperties(globalThis,{
   scenarios:{configurable:true,get:()=>__testApp.scenarios.scenarios},
   exampleInputs:{configurable:true,get:()=>__testApp.scenarios.exampleInputs}
  });
 `,context);
}

export {ids};
