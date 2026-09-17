import {defaults,variants,effectiveInputs,calculate,hasDifferentPeriods,validate,resaleComparisons} from "./model.mjs";
import {createViews} from "./views.mjs";
import {createForm} from "./form.mjs";
import {createScenarios} from "./scenarios.mjs";
import {createResults} from "./results.mjs";
import {createCharts} from "./charts.mjs";
import {createShell} from "./shell.mjs";

/** Wire one calculator instance; initialization is explicit and runs at most once. */
export function createApp({document,window,storage}){
 const $=id=>document.getElementById(id);
 const views=createViews({document,storage,onChange:()=>update()});
 const form=createForm({document,views,onChange:()=>commitFormChange()});
 const scenarios=createScenarios({document,storage,form,onUpdate:()=>update()});
 // Callbacks run only after both controllers exist, keeping their module dependencies acyclic.
 const results=createResults({document,window,views,onShowTooltip:()=>charts.hideGraphTooltip()});
 const charts=createCharts({document,window,views,onShowTooltip:()=>results.hideResultExplanation()});
 const shell=createShell({document,storage,onNavigate:()=>{results.hideResultExplanation();charts.hideGraphTooltip();}});
 let initialized=false;

 function update(){
  charts.hideGraphTooltip();results.hideResultExplanation();
  const s=effectiveInputs(form.read());form.updateSelection(s);$("kInsuranceField").hidden=s.kintoInsuranceIncluded;
  $("buyoutField").hidden=s.leaseEnd==="return";$("buyoutVatField").hidden=s.leaseEnd==="return";
  const missing=Object.entries(defaults).filter(([key,value])=>typeof value==="number"&&!Number.isFinite(s[key])&&$(key).value.trim()==="");
  if(!variants.some(v=>s[v.enabled])){
   $("error").textContent="Select at least one option in Setup to see results and graphs.";$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;
  }
  if(missing.length){
   $("error").textContent="Fill in the remaining "+missing.length+" numeric fields to compare costs. Enter 0 when a cost does not apply.";
   $("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;$("serviceNote").textContent="Complete the term and service inputs.";
   return null;
  }
  let c;try{c=calculate(s);}catch(e){$("error").textContent=e.message;$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;}
  results.render(s,c);
  charts.renderGraphs(s,c,variants.filter(v=>s[v.enabled]),hasDifferentPeriods(s));
  views.applyTimeLabels($("comparison"));views.applyTimeLabels($("graphs"));
  return c;
 }
 function commitFormChange(){
  const complete=update();
  try{
   if(scenarios.saveSettings(scenarios.currentValidSettings())&&!complete)$("storageStatus").textContent="Incomplete scenario saved. Continue filling fields, or switch scenarios and return later.";
  }catch{$("storageStatus").textContent="Fix the invalid value to save these changes.";}
  return complete;
 }
 function initialize(){
  if(initialized)return;
  initialized=true;
  views.initialize();form.initialize();scenarios.initialize();results.initialize();charts.initialize();
  scenarios.restoreSettings();
  shell.initialize();
  if(document.modelContext?.registerTool){
   const lifecycle=new AbortController();
   // Agent input uses the same validation and rendering path as the visible controls.
   try{Promise.resolve(document.modelContext.registerTool({
   name:"compare_car_financing",title:"Compare car financing",description:"Update assumptions and compare a balloon loan, standard loan, operating lease and outright purchase, including VAT timing, end choices and opportunity cost.",
   inputSchema:{type:"object",properties:Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Array.isArray(v)?{type:"array",maxItems:k==="historicalInflationYears"?100:10,items:{type:["number","null"],minimum:0,...(k==="historicalInflationYears"?{maximum:100}:{})}}:{type:typeof v==="number"?"number":typeof v==="boolean"?"boolean":"string"}])),additionalProperties:false},
   annotations:{readOnlyHint:false,untrustedContentHint:false},
   execute(input){if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Provide an object of calculator inputs.");for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new Error("Unknown input: "+key);const s={...form.read(),...input};validate(s);form.write(s);const c=update();scenarios.saveSettings(s);return {balloonLoanTotal:c.balloonLoan.adjusted,standardLoanTotal:c.standardLoan.adjusted,operatingLeaseTotal:c.lease.adjusted,outrightPurchaseTotal:c.cashPurchase.adjusted,resaleBreakEven:resaleComparisons(s)};}
   },{signal:lifecycle.signal})).catch(()=>{});}catch{}
   window.addEventListener("pagehide",()=>lifecycle.abort(),{once:true});
  }
 }
 return {initialize,update,form,views,scenarios,results,charts,shell};
}

// Defer storage access until the controllers' recovery guards can handle unavailable storage.
export const app=typeof document==="undefined"?null:createApp({document,window,storage:{
 getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)
}});
app?.initialize();
