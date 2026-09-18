import {createTranslator} from "./i18n.mjs";
import {messageError} from "./message-errors.mjs";
import {defaults,variants,effectiveInputs,calculate,hasDifferentPeriods,validate,resaleComparisons} from "./model.mjs";
import {createViews} from "./views.mjs";
import {createForm} from "./form.mjs";
import {createScenarios} from "./scenarios.mjs";
import {createResults} from "./results.mjs";
import {createCharts} from "./charts.mjs";
import {createLocalization} from "./localization.mjs";
import {createShell} from "./shell.mjs";

/** Wire one calculator instance; initialization is explicit and runs at most once. */
export function createApp({document,window,storage}){
 const i18n=createTranslator(),{t,errorMessage}=i18n;
 const $=id=>document.getElementById(id);
 const localization=createLocalization({document,storage,i18n,onLanguageChange:()=>{update();scenarios.renderScenarioSelector();shell.refresh();}});
 const views=createViews({document,i18n,storage,onChange:()=>update()});
 const form=createForm({document,i18n,views,onChange:()=>commitFormChange()});
 const scenarios=createScenarios({document,i18n,storage,form,onUpdate:()=>update()});
 // Callbacks run only after both controllers exist, keeping their module dependencies acyclic.
 const results=createResults({document,i18n,window,views,onShowTooltip:()=>charts.hideGraphTooltip()});
 const charts=createCharts({document,i18n,window,views,onShowTooltip:()=>results.hideResultExplanation()});
 const shell=createShell({document,i18n,storage,onNavigate:()=>{results.hideResultExplanation();charts.hideGraphTooltip();}});
 let initialized=false;

 function update(){
  i18n.configure({currency:$("currency").value,past:$("pastOwnership").checked});
  localization.apply();
  const result=renderUpdate();shell.refresh();return result;
 }
 function renderUpdate(){
  charts.hideGraphTooltip();results.hideResultExplanation();
  const s=effectiveInputs(form.read());form.updateSelection(s);$("kInsuranceField").hidden=s.kintoInsuranceIncluded;
  $("buyoutField").hidden=s.leaseEnd==="return";$("buyoutVatField").hidden=!s.vatEnabled||s.leaseEnd==="return";
  const missing=Object.entries(defaults).filter(([key,value])=>typeof value==="number"&&!Number.isFinite(s[key])&&$(key).value.trim()==="");
  if(!variants.some(v=>s[v.enabled])){
   $("error").textContent=t("app.selectAtLeastOneOptionInSetupTo");$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;
  }
  if(missing.length){
   $("error").textContent=t("app.fillInTheRemainingNumericFieldsToCompare",{length:missing.length});
   $("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;$("serviceNote").textContent=t("app.completeTheTermAndServiceInputs");
   return null;
  }
  let c;try{c=calculate(s);}catch(e){$("error").textContent=errorMessage(e);$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;}
  results.render(s,c);
  charts.renderGraphs(s,c,i18n.variants(variants).filter(v=>s[v.enabled]),hasDifferentPeriods(s));
  return c;
 }
 function commitFormChange(){
  const complete=update();
  try{
   if(scenarios.saveSettings(scenarios.currentValidSettings())&&!complete)i18n.setMessage($("storageStatus"),()=>t("app.incompleteScenarioSavedContinueFillingFieldsOrSwitch"));
  }catch{i18n.setMessage($("storageStatus"),()=>t("app.fixTheInvalidValueToSaveTheseChanges"));}
  return complete;
 }
 function initialize(){
  if(initialized)return;
  initialized=true;
  views.initialize();form.initialize();scenarios.initialize();results.initialize();charts.initialize();
  scenarios.restoreSettings();
  shell.initialize();localization.initialize();
  if(document.modelContext?.registerTool){
   const lifecycle=new AbortController();
   // Agent input uses the same validation and rendering path as the visible controls.
   try{Promise.resolve(document.modelContext.registerTool({
   name:"compare_car_financing",title:t("app.compareCarFinancing"),description:t("app.updateAssumptionsAndCompareABalloonLoanStandard"),
   inputSchema:{type:"object",properties:Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Array.isArray(v)?{type:"array",maxItems:k==="historicalInflationYears"?100:10,items:{type:["number","null"],minimum:0,...(["historicalInflationYears","inflationYears"].includes(k)?{maximum:100}:{})}}:{type:typeof v==="number"?"number":typeof v==="boolean"?"boolean":"string"}])),additionalProperties:false},
   annotations:{readOnlyHint:false,untrustedContentHint:false},
   execute(input){if(!input||typeof input!=="object"||Array.isArray(input))throw messageError("app.provideAnObjectOfCalculatorInputs");for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw messageError("app.unknownInput",{key:key});const s={...form.read(),...input};validate(s);form.write(s);const c=update();scenarios.saveSettings(s);return {balloonLoanTotal:c.balloonLoan.adjusted,standardLoanTotal:c.standardLoan.adjusted,operatingLeaseTotal:c.lease.adjusted,outrightPurchaseTotal:c.cashPurchase.adjusted,resaleBreakEven:resaleComparisons(s)};}
   },{signal:lifecycle.signal})).catch(()=>{});}catch{}
   window.addEventListener("pagehide",()=>lifecycle.abort(),{once:true});
  }
 }
 return {initialize,update,form,views,scenarios,results,charts,shell,localization};
}

// Defer storage access until the controllers' recovery guards can handle unavailable storage.
export const app=typeof document==="undefined"?null:createApp({document,window,storage:{
 getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)
}});
app?.initialize();
