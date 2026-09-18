import {createTranslator} from "./i18n.mjs";
import {messageError} from "./message-errors.mjs";
import {currencies,defaults,migrateInputs,validate,validateAdditionalCosts,validateHistoricalInflation,validateOwnershipInflation} from "./model.mjs";

const arraySettingKeys=Object.keys(defaults).filter(key=>Array.isArray(defaults[key]));
// Scenario boundaries copy mutable inputs so controllers, forms and exports cannot share them.
function cloneSettings(state){
 const copy={...state};
 for(const key of arraySettingKeys)copy[key]=[...state[key]];
 return copy;
}
function sameSettings(left,right){
 return Object.keys(defaults).every(key=>Array.isArray(defaults[key])?
  left[key].length===right[key].length&&left[key].every((value,index)=>value===right[key][index]):left[key]===right[key]);
}

// Pure readers validate the whole input before the controller mutates stored scenarios.
export function validateSettings(state){
 if(!Object.hasOwn(currencies,state.currency))throw messageError("errors.chooseASupportedCurrency");
 validateOwnershipInflation(state,{allowDrafts:true});
 validateAdditionalCosts(state,{allowDrafts:true});
 validateHistoricalInflation(state,{allowDrafts:true});
 for(const [key,fallback] of Object.entries(defaults)){
  const value=state[key];
  if(Array.isArray(fallback))continue;
  if(typeof fallback==="number"){
   if(value===null)continue;
   if(!Number.isFinite(value)||value<0)throw messageError("scenarios.enterANonNegativeNumberOrLeaveThe");
  }else if(typeof value!==typeof fallback)throw messageError("scenarios.invalidSetting",{key:key});
 }
 if(!["rate","payment"].includes(state.normalInputMode))throw messageError("errors.chooseInterestRateOrMonthlyPaymentForThe");
 if(!["rate","payment"].includes(state.balloonInputMode))throw messageError("errors.chooseInterestRateOrMonthlyPaymentForThe2");
 if(!["direct","relative"].includes(state.resaleMode))throw messageError("errors.chooseDirectResaleOrRelativeDepreciation");
 if(!["real","nominal"].includes(state.opportunityRateBasis))throw messageError("scenarios.chooseAValidReturnBasis");
 if(state.carName.length>100)throw messageError("scenarios.keepTheScenarioNameUnder100Characters");
 if(!["sell","keep"].includes(state.loanEnd)||!["return","buySell","buyKeep"].includes(state.leaseEnd)||!["gross","net"].includes(state.kintoVatMode))throw messageError("scenarios.chooseAValidOption");
 const effective={...state};
 if(effective.leaseEnd==="return"&&effective.leaseBuyout===null)effective.leaseBuyout=0;
 if(effective.kintoInsuranceIncluded&&effective.kintoInsurance===null)effective.kintoInsurance=0;
 // Cleared historical inputs remain navigable and saveable as incomplete drafts.
 const historicalDraft=effective.resaleMode==="relative"&&(effective.historicalNewPrice===0||(!(effective.pastOwnership?effective.pastHistoricalMatchPeriod:effective.historicalMatchPeriod)&&effective.historicalMonths===0));
 const additionalCostDraft=effective.additionalCostYears.includes(null);
 const historicalInflationDraft=effective.historicalInflationYears.includes(null);
 const ownershipInflationDraft=effective.inflationYears.includes(null);
 if(!Object.values(effective).includes(null)&&!additionalCostDraft&&!historicalInflationDraft&&!ownershipInflationDraft&&!historicalDraft)validate(effective);
}

export function decodeSettings(text){
 const data=JSON.parse(text);
 if(!data||data.format!=="car-financing-calculator"||data.version!==1||!data.inputs||typeof data.inputs!=="object"||Array.isArray(data.inputs))throw messageError("scenarios.chooseACalculatorSettingsJsonFile");
 // Older saved scenarios and JSON exports may contain the retired running-cost VAT delay.
 const inputs={...data.inputs};delete inputs.invoiceVatDelay;
 for(const key of Object.keys(inputs))if(!Object.hasOwn(defaults,key))throw messageError("scenarios.unknownSetting",{key:key});
 const state=migrateInputs(inputs);validateSettings(state);return cloneSettings(state);
}

export function encodeSettings(state){
 validateSettings(state);return JSON.stringify({format:"car-financing-calculator",version:1,inputs:cloneSettings(state)},null,2);
}

export function decodeCollection(text){
 const data=JSON.parse(text);
 if(!data||data.format!=="car-financing-calculator"||data.version!==2||!Array.isArray(data.scenarios)||!data.scenarios.length)throw messageError("scenarios.chooseAValidCalculatorScenarioCollection");
 const ids=new Set();
 const items=data.scenarios.map(item=>{
  if(!item||typeof item.id!=="string"||!item.id||ids.has(item.id))throw messageError("scenarios.theScenarioCollectionContainsInvalidOrDuplicateIDs");
  ids.add(item.id);
  return {id:item.id,inputs:decodeSettings(JSON.stringify({format:data.format,version:1,inputs:item.inputs}))};
 });
 if(!ids.has(data.activeId))throw messageError("scenarios.theCollectionSSelectedScenarioIsMissing");
 return {scenarios:items,activeId:data.activeId};
}

/** Own saved scenarios and recovery; render changes through the supplied callback. */
export function createScenarios({i18n=createTranslator(),document,storage,form,onUpdate}){
 const {t,errorMessage}=i18n;
 const $=id=>document.getElementById(id);
 const {read,write,readSettings}=form;
 const update=onUpdate;
 const STORAGE_KEY="car-financing-calculator.scenarios.v2";
 const LEGACY_STORAGE_KEY="car-financing-calculator.settings.v1";
 const SELECTED_SCENARIO_KEY="car-financing-calculator.selected-scenario.v1";
 // Empty IDs are invalid in saved collections, so the built-in choice cannot collide with user IDs.
 const EXAMPLE_ID="",EXAMPLE_LABEL=defaults.carName+" (example)";
 const exampleInputs=cloneSettings(defaults);for(const key of arraySettingKeys)Object.freeze(exampleInputs[key]);Object.freeze(exampleInputs);
 function selectedInputs(){return activeScenarioId===EXAMPLE_ID?exampleInputs:scenarios.find(item=>item.id===activeScenarioId).inputs;}
 function exampleCopyName(name){
  const base=name===EXAMPLE_LABEL?exampleInputs.carName:name;
  return scenarios.some(item=>item.inputs.carName===base)?uniqueScenarioName(base||t("scenarios.scenario"),"variation"):base;
 }
 function rememberCurrentSettings(state){
  validateSettings(state);
  if(activeScenarioId===EXAMPLE_ID){
   if(sameSettings(state,exampleInputs))return;
   const inputs=cloneSettings({...state,carName:exampleCopyName(state.carName)});
   const copy={id:newScenarioId(),inputs};scenarios.push(copy);activeScenarioId=copy.id;
   // Change only the name when forking; preserve the user's caret and partially entered numbers.
   if($("carName").value!==inputs.carName)$("carName").value=inputs.carName;
   $("scenarioName").dataset.userText=String(Boolean(inputs.carName));$("scenarioName").textContent=inputs.carName||t("scenarios.yourCar");
  }else scenarios.find(item=>item.id===activeScenarioId).inputs=cloneSettings(state);
 }
 let scenarios=[],activeScenarioId="",storageReadFailed=false;
 const newScenarioId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);

 function encodeCollection(){
  // Keep the version 2 collection envelope; exports contain ordinary editable snapshots only.
  const items=scenarios.length?scenarios.map(item=>({id:item.id,inputs:cloneSettings(item.inputs)})):[{id:"example-snapshot",inputs:cloneSettings(exampleInputs)}];
  const activeId=items.some(item=>item.id===activeScenarioId)?activeScenarioId:items[0].id;
  return JSON.stringify({format:"car-financing-calculator",version:2,activeId,scenarios:items},null,2);
 }
 function renderScenarioSelector(){
  const select=$("scenarioSelect");select.replaceChildren();
  const example=document.createElement("option");example.value=EXAMPLE_ID;example.textContent=t("scenarios.exampleName",{name:defaults.carName});example.className="example-option";select.appendChild(example);
  for(const scenario of scenarios){
   const option=document.createElement("option");option.value=scenario.id;option.dataset.userText=String(Boolean(scenario.inputs.carName.trim()));option.textContent=scenario.inputs.carName.trim()||t("scenarios.untitledScenario");
   select.appendChild(option);
  }
  select.value=activeScenarioId;select.dataset.example=String(activeScenarioId===EXAMPLE_ID);
  $("scenarioCount").textContent=t("scenarios.count",{count:scenarios.length});
 }
 function persistCollection(){
  if(storageReadFailed){i18n.setMessage($("storageStatus"),()=>t("scenarios.originalBrowserDataPreservedAfterALoadingError"));return false;}
  try{
   // The permanent example is never stored as a mutable scenario. Its selection is a UI preference.
   if(scenarios.length)storage.setItem(STORAGE_KEY,encodeCollection());
   storage.setItem(SELECTED_SCENARIO_KEY,activeScenarioId);
   i18n.setMessage($("storageStatus"),()=>"");return true;
  }
  catch{i18n.setMessage($("storageStatus"),()=>t("scenarios.localSavingIsUnavailableTheseScenariosLastFor"));return false;}
 }
 function saveSettings(state){
  rememberCurrentSettings(state);renderScenarioSelector();return persistCollection();
 }
 function restoreSettings(){
  let message=()=>"";
  storageReadFailed=false;
  try{
   const stored=storage.getItem(STORAGE_KEY);
   if(stored){const restored=decodeCollection(stored);scenarios=restored.scenarios;activeScenarioId=restored.activeId;}
   else{
    const legacy=storage.getItem(LEGACY_STORAGE_KEY);
    scenarios=legacy?[{id:newScenarioId(),inputs:decodeSettings(legacy)}]:[];
    activeScenarioId=legacy?scenarios[0].id:EXAMPLE_ID;
    if(legacy)message=()=>t("scenarios.yourPreviouslySavedSettingsAreNowTheFirst");
   }
   const selected=storage.getItem(SELECTED_SCENARIO_KEY);
   if(selected===EXAMPLE_ID){activeScenarioId=EXAMPLE_ID;}
   else if(scenarios.some(item=>item.id===selected))activeScenarioId=selected;
  }catch{storageReadFailed=true;scenarios=[];activeScenarioId=EXAMPLE_ID;message=()=>t("scenarios.savedScenariosCouldNotBeLoadedOriginalData");}
  renderScenarioSelector();write(cloneSettings(selectedInputs()));update();
  // Keep the old single-scenario record untouched while migrating to the collection.
  if(persistCollection()||storageReadFailed)i18n.setMessage($("storageStatus"),message);
 }
 function currentValidSettings(){
  const state=readSettings();validateSettings(state);return cloneSettings(state);
 }
 function uniqueScenarioName(base,suffix){
  let index=1,name;
  do{const tail=" · "+suffix+(index===1?"":" "+index);name=base.slice(0,100-tail.length)+tail;index++;}
  while(scenarios.some(item=>item.inputs.carName===name));
  return name;
 }

 function downloadSettings(json,filename){
  const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function initialize(){
  $("scenarioSelect").addEventListener("change",()=>{
   const target=$("scenarioSelect").value;
   try{
    const current=currentValidSettings();
    const next=target===EXAMPLE_ID?exampleInputs:scenarios.find(item=>item.id===target)?.inputs;if(!next)throw messageError("scenarios.selectAnExistingScenario");
    rememberCurrentSettings(current);
    activeScenarioId=target;write(cloneSettings(next));update();renderScenarioSelector();persistCollection();
   }catch(e){$("scenarioSelect").value=activeScenarioId;i18n.setMessage($("storageStatus"),()=>t("scenarios.cannotSwitchYet",{message:errorMessage(e)}));}
  });
  $("duplicateScenario").addEventListener("click",()=>{
   try{
    const state=currentValidSettings();
    const fromExample=activeScenarioId===EXAMPLE_ID;
    if(!fromExample)rememberCurrentSettings(state);
    const name=fromExample?exampleCopyName(state.carName):uniqueScenarioName(state.carName.trim()||t("scenarios.scenario"),"copy");
    const copy={id:newScenarioId(),inputs:cloneSettings({...state,carName:name})};
    scenarios.push(copy);activeScenarioId=copy.id;write(cloneSettings(copy.inputs));update();renderScenarioSelector();
    if(persistCollection())i18n.setMessage($("storageStatus"),()=>t("scenarios.variationCreatedEditItsNameAndInputsThe"));
    $("carName").focus();$("carName").select();
   }catch(e){i18n.setMessage($("storageStatus"),()=>t("scenarios.cannotDuplicateYet",{message:errorMessage(e)}));}
  });
  $("clearAll").addEventListener("click",()=>{
   const active=selectedInputs();
   const state=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,Array.isArray(value)?[]:typeof value==="number"?null:typeof value==="boolean"?false:value]));
   for(const key of ["balloonEnabled","normalEnabled","leaseEnabled","cashEnabled","matchPeriods","balloonMatchPeriod","normalMatchPeriod","leaseMatchPeriod","cashMatchPeriod","pastHistoricalMatchPeriod","historicalMatchPeriod","balloonMatchOwnership","normalMatchOwnership"])state[key]=true;
   state.carName=$("carName").value||active.carName;state.currency=$("currency").value;
   write(state);update();const persisted=saveSettings(state);
   $("prefillStatus").textContent=t("scenarios.numericFieldsClearedSelectYourVatAndCoverage");
   if(persisted)i18n.setMessage($("storageStatus"),()=>t("scenarios.clearedCurrentScenarioSavedOtherScenariosAreKept"));
  });
  $("reset").addEventListener("click",()=>{
   const {carName,currency}=selectedInputs();
   const state=cloneSettings({...defaults,carName,currency});write(state);update();
   if(saveSettings(state))i18n.setMessage($("storageStatus"),()=>activeScenarioId===EXAMPLE_ID?t("scenarios.theStartingExampleAlreadyHasItsOriginalValues"):t("scenarios.selectedScenarioResetToDefaultAssumptionsOtherScenarios"));
  });

  $("exportSettings").addEventListener("click",()=>{
   try{downloadSettings(encodeSettings(currentValidSettings()),"car-financing-settings.json");i18n.setMessage($("storageStatus"),()=>t("scenarios.selectedScenarioExportedShareItsJsonTogetherWith"));}
   catch(e){i18n.setMessage($("storageStatus"),()=>t("scenarios.exportFailed",{message:errorMessage(e)}));}
  });
  $("exportAllSettings").addEventListener("click",()=>{
   try{
    const state=currentValidSettings();rememberCurrentSettings(state);renderScenarioSelector();
    downloadSettings(encodeCollection(),"car-financing-all-scenarios.json");i18n.setMessage($("storageStatus"),()=>scenarios.length?t("scenarios.savedScenariosExportedTheBuiltInExampleIs"):t("scenarios.startingExampleExportedAsAnEditableSnapshot"));
   }catch(e){i18n.setMessage($("storageStatus"),()=>t("scenarios.exportFailed",{message:errorMessage(e)}));}
  });
  $("importSettings").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async()=>{
   const file=$("importFile").files?.[0];if(!file)return;
   try{
    if(file.size>1000000)throw messageError("scenarios.theSettingsFileIsTooLarge");
    const text=await file.text(),data=JSON.parse(text);
    // Validate the whole import and current inputs before adding anything to the collection.
    const imported=data.version===2?decodeCollection(text):{scenarios:[{id:"imported",inputs:decodeSettings(text)}],activeId:"imported"};
    const current=currentValidSettings();
    const additions=imported.scenarios.map(item=>({id:newScenarioId(),inputs:cloneSettings(item.inputs),wasActive:item.id===imported.activeId}));
    rememberCurrentSettings(current);
    for(const item of additions){
     if(scenarios.some(existing=>existing.inputs.carName===item.inputs.carName))item.inputs.carName=uniqueScenarioName(item.inputs.carName||t("scenarios.scenario"),"imported");
     scenarios.push({id:item.id,inputs:item.inputs});
    }
    activeScenarioId=additions.find(item=>item.wasActive).id;write(cloneSettings(scenarios.find(item=>item.id===activeScenarioId).inputs));update();renderScenarioSelector();
    if(persistCollection())i18n.setMessage($("storageStatus"),()=>t("scenarios.imported",{count:additions.length}));
   }catch(e){i18n.setMessage($("storageStatus"),()=>t("scenarios.importFailedCurrentScenariosWereKept",{message:errorMessage(e)}));}
   finally{$("importFile").value="";}
  });
 }
 return {initialize,renderScenarioSelector,validateSettings,decodeSettings,encodeSettings,decodeCollection,encodeCollection,currentValidSettings,saveSettings,restoreSettings,persistCollection,exampleInputs,
  get scenarios(){return scenarios.map(item=>({id:item.id,inputs:cloneSettings(item.inputs)}));}};
}
