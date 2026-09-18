import {defaults,migrateInputs,validate,validateAdditionalCosts,validateHistoricalInflation,validateOwnershipInflation} from "./model.mjs";

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
 validateOwnershipInflation(state,{allowDrafts:true});
 validateAdditionalCosts(state,{allowDrafts:true});
 validateHistoricalInflation(state,{allowDrafts:true});
 for(const [key,fallback] of Object.entries(defaults)){
  const value=state[key];
  if(Array.isArray(fallback))continue;
  if(typeof fallback==="number"){
   if(value===null)continue;
   if(!Number.isFinite(value)||value<0)throw new Error("Enter a non-negative number or leave the field empty.");
  }else if(typeof value!==typeof fallback)throw new Error("Invalid setting: "+key);
 }
 if(!["rate","payment"].includes(state.normalInputMode))throw new Error("Choose interest rate or monthly payment for the standard loan.");
 if(!["rate","payment"].includes(state.balloonInputMode))throw new Error("Choose interest rate or monthly payment for the balloon loan.");
 if(!["direct","relative"].includes(state.resaleMode))throw new Error("Choose direct resale or relative depreciation.");
 if(!["real","nominal"].includes(state.opportunityRateBasis))throw new Error("Choose a valid return basis.");
 if(state.carName.length>100)throw new Error("Keep the scenario name under 100 characters.");
 if(!["sell","keep"].includes(state.loanEnd)||!["return","buySell","buyKeep"].includes(state.leaseEnd)||!["gross","net"].includes(state.kintoVatMode))throw new Error("Choose a valid option.");
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
 if(!data||data.format!=="car-financing-calculator"||data.version!==1||!data.inputs||typeof data.inputs!=="object"||Array.isArray(data.inputs))throw new Error("Choose a calculator settings JSON file.");
 // Older saved scenarios and JSON exports may contain the retired running-cost VAT delay.
 const inputs={...data.inputs};delete inputs.invoiceVatDelay;
 for(const key of Object.keys(inputs))if(!Object.hasOwn(defaults,key))throw new Error("Unknown setting: "+key);
 const state=migrateInputs(inputs);validateSettings(state);return cloneSettings(state);
}

export function encodeSettings(state){
 validateSettings(state);return JSON.stringify({format:"car-financing-calculator",version:1,inputs:cloneSettings(state)},null,2);
}

export function decodeCollection(text){
 const data=JSON.parse(text);
 if(!data||data.format!=="car-financing-calculator"||data.version!==2||!Array.isArray(data.scenarios)||!data.scenarios.length)throw new Error("Choose a valid calculator scenario collection.");
 const ids=new Set();
 const items=data.scenarios.map(item=>{
  if(!item||typeof item.id!=="string"||!item.id||ids.has(item.id))throw new Error("The scenario collection contains invalid or duplicate IDs.");
  ids.add(item.id);
  return {id:item.id,inputs:decodeSettings(JSON.stringify({format:data.format,version:1,inputs:item.inputs}))};
 });
 if(!ids.has(data.activeId))throw new Error("The collection’s selected scenario is missing.");
 return {scenarios:items,activeId:data.activeId};
}

/** Own saved scenarios and recovery; render changes through the supplied callback. */
export function createScenarios({document,storage,form,onUpdate}){
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
  return scenarios.some(item=>item.inputs.carName===base)?uniqueScenarioName(base||"Scenario","variation"):base;
 }
 function rememberCurrentSettings(state){
  validateSettings(state);
  if(activeScenarioId===EXAMPLE_ID){
   if(sameSettings(state,exampleInputs))return;
   const inputs=cloneSettings({...state,carName:exampleCopyName(state.carName)});
   const copy={id:newScenarioId(),inputs};scenarios.push(copy);activeScenarioId=copy.id;
   // Change only the name when forking; preserve the user's caret and partially entered numbers.
   if($("carName").value!==inputs.carName)$("carName").value=inputs.carName;
   $("scenarioName").textContent=inputs.carName||"Your car";
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
  const example=document.createElement("option");example.value=EXAMPLE_ID;example.textContent=EXAMPLE_LABEL;example.className="example-option";select.appendChild(example);
  for(const scenario of scenarios){
   const option=document.createElement("option");option.value=scenario.id;option.textContent=scenario.inputs.carName.trim()||"Untitled scenario";
   select.appendChild(option);
  }
  select.value=activeScenarioId;select.dataset.example=String(activeScenarioId===EXAMPLE_ID);
  $("scenarioCount").textContent="1 built-in example · "+scenarios.length+" saved scenario"+(scenarios.length===1?"":"s");
 }
 function persistCollection(){
  if(storageReadFailed){$("storageStatus").textContent="Original browser data preserved after a loading error. Export JSON to save this session.";return false;}
  try{
   // The permanent example is never stored as a mutable scenario. Its selection is a UI preference.
   if(scenarios.length)storage.setItem(STORAGE_KEY,encodeCollection());
   storage.setItem(SELECTED_SCENARIO_KEY,activeScenarioId);
   $("storageStatus").textContent="";return true;
  }
  catch{$("storageStatus").textContent="Local saving is unavailable. These scenarios last for this session; use Export all JSON to keep them.";return false;}
 }
 function saveSettings(state){
  rememberCurrentSettings(state);renderScenarioSelector();return persistCollection();
 }
 function restoreSettings(){
  let message="";
  storageReadFailed=false;
  try{
   const stored=storage.getItem(STORAGE_KEY);
   if(stored){const restored=decodeCollection(stored);scenarios=restored.scenarios;activeScenarioId=restored.activeId;}
   else{
    const legacy=storage.getItem(LEGACY_STORAGE_KEY);
    scenarios=legacy?[{id:newScenarioId(),inputs:decodeSettings(legacy)}]:[];
    activeScenarioId=legacy?scenarios[0].id:EXAMPLE_ID;
    if(legacy)message="Your previously saved settings are now the first scenario.";
   }
   const selected=storage.getItem(SELECTED_SCENARIO_KEY);
   if(selected===EXAMPLE_ID){activeScenarioId=EXAMPLE_ID;}
   else if(scenarios.some(item=>item.id===selected))activeScenarioId=selected;
  }catch{storageReadFailed=true;scenarios=[];activeScenarioId=EXAMPLE_ID;message="Saved scenarios could not be loaded. Original data preserved; starting example shown for this session.";}
  renderScenarioSelector();write(cloneSettings(selectedInputs()));update();
  // Keep the old single-scenario record untouched while migrating to the collection.
  if(persistCollection()||storageReadFailed)$("storageStatus").textContent=message;
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
    const next=target===EXAMPLE_ID?exampleInputs:scenarios.find(item=>item.id===target)?.inputs;if(!next)throw new Error("Select an existing scenario.");
    rememberCurrentSettings(current);
    activeScenarioId=target;write(cloneSettings(next));update();renderScenarioSelector();persistCollection();
   }catch(e){$("scenarioSelect").value=activeScenarioId;$("storageStatus").textContent="Cannot switch yet: "+e.message;}
  });
  $("duplicateScenario").addEventListener("click",()=>{
   try{
    const state=currentValidSettings();
    const fromExample=activeScenarioId===EXAMPLE_ID;
    if(!fromExample)rememberCurrentSettings(state);
    const name=fromExample?exampleCopyName(state.carName):uniqueScenarioName(state.carName.trim()||"Scenario","copy");
    const copy={id:newScenarioId(),inputs:cloneSettings({...state,carName:name})};
    scenarios.push(copy);activeScenarioId=copy.id;write(cloneSettings(copy.inputs));update();renderScenarioSelector();
    if(persistCollection())$("storageStatus").textContent="Variation created. Edit its name and inputs; the original stays unchanged.";
    $("carName").focus();$("carName").select();
   }catch(e){$("storageStatus").textContent="Cannot duplicate yet: "+e.message;}
  });
  $("clearAll").addEventListener("click",()=>{
   const active=selectedInputs();
   const state=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,Array.isArray(value)?[]:typeof value==="number"?null:typeof value==="boolean"?false:value]));
   for(const key of ["balloonEnabled","normalEnabled","leaseEnabled","cashEnabled","matchPeriods","balloonMatchPeriod","normalMatchPeriod","leaseMatchPeriod","cashMatchPeriod","pastHistoricalMatchPeriod","historicalMatchPeriod","balloonMatchOwnership","normalMatchOwnership"])state[key]=true;
   state.carName=$("carName").value||active.carName;
   write(state);update();const persisted=saveSettings(state);
   $("prefillStatus").textContent="Numeric fields cleared. Select your VAT and coverage choices, then fill the form from the top. Related empty fields are suggested when you finish editing.";
   if(persisted)$("storageStatus").textContent="Cleared current scenario saved. Other scenarios are kept. Reset current restores the example values.";
  });
  $("reset").addEventListener("click",()=>{
   const name=selectedInputs().carName;
   const state=cloneSettings({...defaults,carName:name});write(state);update();
   if(saveSettings(state))$("storageStatus").textContent=activeScenarioId===EXAMPLE_ID?"The starting example already has its original values.":"Selected scenario reset to default assumptions. Other scenarios were kept.";
  });

  $("exportSettings").addEventListener("click",()=>{
   try{downloadSettings(encodeSettings(currentValidSettings()),"car-financing-settings.json");$("storageStatus").textContent="Selected scenario exported. Share its JSON together with the HTML calculator.";}
   catch(e){$("storageStatus").textContent="Export failed: "+e.message;}
  });
  $("exportAllSettings").addEventListener("click",()=>{
   try{
    const state=currentValidSettings();rememberCurrentSettings(state);renderScenarioSelector();
    downloadSettings(encodeCollection(),"car-financing-all-scenarios.json");$("storageStatus").textContent=scenarios.length?"Saved scenarios exported. The built-in example is always available in the calculator.":"Starting example exported as an editable snapshot.";
   }catch(e){$("storageStatus").textContent="Export failed: "+e.message;}
  });
  $("importSettings").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async()=>{
   const file=$("importFile").files?.[0];if(!file)return;
   try{
    if(file.size>1000000)throw new Error("The settings file is too large.");
    const text=await file.text(),data=JSON.parse(text);
    // Validate the whole import and current inputs before adding anything to the collection.
    const imported=data.version===2?decodeCollection(text):{scenarios:[{id:"imported",inputs:decodeSettings(text)}],activeId:"imported"};
    const current=currentValidSettings();
    const additions=imported.scenarios.map(item=>({id:newScenarioId(),inputs:cloneSettings(item.inputs),wasActive:item.id===imported.activeId}));
    rememberCurrentSettings(current);
    for(const item of additions){
     if(scenarios.some(existing=>existing.inputs.carName===item.inputs.carName))item.inputs.carName=uniqueScenarioName(item.inputs.carName||"Scenario","imported");
     scenarios.push({id:item.id,inputs:item.inputs});
    }
    activeScenarioId=additions.find(item=>item.wasActive).id;write(cloneSettings(scenarios.find(item=>item.id===activeScenarioId).inputs));update();renderScenarioSelector();
    if(persistCollection())$("storageStatus").textContent="Imported "+additions.length+" scenario"+(additions.length===1?"":"s")+". Existing scenarios were kept.";
   }catch(e){$("storageStatus").textContent="Import failed: "+e.message+" Current scenarios were kept.";}
   finally{$("importFile").value="";}
  });
 }
 return {initialize,validateSettings,decodeSettings,encodeSettings,decodeCollection,encodeCollection,currentValidSettings,saveSettings,restoreSettings,persistCollection,exampleInputs,
  get scenarios(){return scenarios.map(item=>({id:item.id,inputs:cloneSettings(item.inputs)}));}};
}
