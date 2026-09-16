
import {defaults,calculate,resaleThresholds,resaleComparisons,validate} from "./model.mjs";
const $=id=>document.getElementById(id);
const absValue=n=>Math.abs(n)<.5?0:n;
const money=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(absValue(n))+" Kč";
const num=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(n);
function read(){
 const state=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,typeof v==="boolean"?$(k).checked:typeof v==="number"?($(k).value.trim()===""?NaN:Number($(k).value)):$(k).value]));
 // Hidden, unused charges are zero for calculation, but stay blank in saved drafts.
 if(state.leaseEnd==="return"&&$("leaseBuyout").value.trim()==="")state.leaseBuyout=0;
 if(state.kintoInsuranceIncluded&&$("kintoInsurance").value.trim()==="")state.kintoInsurance=0;
 return state;
}
function write(s){$("ownershipYears").value=s.months===null?"":Number((s.months/12).toFixed(6));for(const [k,v] of Object.entries(s)){if(typeof v==="boolean")$(k).checked=v;else $(k).value=v===null?"":v;}}
function row(label,b,n,l,c,cls=""){return '<tr class="'+cls+'"><th scope="row">'+label+'</th><td data-option="balloon">'+b+'</td><td data-option="normal">'+n+'</td><td data-option="lease">'+l+'</td><td data-option="cash">'+c+'</td></tr>';}
const detail=(amount,note)=>'<span class="cell-amount">'+money(amount)+'</span><small>'+note+'</small>';
const phase=label=>'<tr class="phase"><th colspan="5" scope="rowgroup">'+label+'</th></tr>';
function ranked(c){return [{name:"Balloon loan",value:c.balloonLoan.adjusted,style:"easy-text",key:"balloon"},{name:"Standard loan",value:c.standardLoan.adjusted,style:"normal-text",key:"normal"},{name:"Operating lease",value:c.lease.adjusted,style:"kinto-text",key:"lease"},{name:"Buy outright",value:c.cashPurchase.adjusted,key:"cash"}].sort((a,b)=>a.value-b.value);}
function update(){
 const s=read();$("kInsuranceField").hidden=s.kintoInsuranceIncluded;
 $("buyoutField").hidden=s.leaseEnd==="return";$("buyoutVatField").hidden=s.leaseEnd==="return";
 const missing=Object.entries(defaults).filter(([key,value])=>typeof value==="number"&&!Number.isFinite(s[key])&&$(key).value.trim()==="");
 if(missing.length){
  $("error").textContent="Fill in the remaining "+missing.length+" numeric fields to compare costs. Enter 0 when a cost does not apply.";
  $("error").hidden=false;$("resultContent").hidden=true;$("serviceNote").textContent="Complete the term and service inputs.";
  return null;
 }
 let c;try{c=calculate(s);}catch(e){$("error").textContent=e.message;$("error").hidden=false;$("resultContent").hidden=true;return null;}
 $("error").hidden=true;$("resultContent").hidden=false;
 const b=c.balloonLoan,n=c.standardLoan,l=c.lease,cash=c.cashPurchase;
 $("scenarioName").textContent=s.carName||"Your car";
 $("termLabel").textContent=s.months+" MONTHS / "+num(c.km)+" KM / "+(s.vatEnabled?"AFTER VAT RECOVERY":"NO VAT RECOVERY");
 const sorted=ranked(c),gap=sorted[1].value-sorted[0].value,tie=gap<.5;
 $("verdict").dataset.winner=tie?"tie":sorted[0].key;
 $("winner").textContent=tie?"The lowest-cost options tie":sorted[0].name+" costs least";
 $("saving").textContent=money(sorted[0].value);
 $("savingNote").textContent=(tie?"Lowest cost over the full term.":money(gap)+" less than "+sorted[1].name.toLowerCase()+".")+" Includes opportunity cost at "+s.opportunityRate+"% p.a.";
 $("easyTotal").textContent=money(b.adjusted);$("easyMonthly").textContent=money(b.adjusted/s.months)+" / month effective";
 $("normalTotal").textContent=money(n.adjusted);$("normalMonthly").textContent=money(n.adjusted/s.months)+" / month effective";
 $("kintoTotal").textContent=money(l.adjusted);$("kintoEffective").textContent=money(l.adjusted/s.months)+" / month effective";
 $("cashTotal").textContent=money(cash.adjusted);$("cashMonthly").textContent=money(cash.adjusted/s.months)+" / month effective";
 // Compare the same cash flows before VAT settlement, without dividing VAT-free costs by the VAT rate.
 const beforeVat=s.vatEnabled?calculate({...s,vatEnabled:false}):c;
 for(const [prefix,key] of [["easy","balloonLoan"],["normal","standardLoan"],["kinto","lease"],["cash","cashPurchase"]]){
  $(prefix+"VatBasis").textContent=s.vatEnabled?"Total, net after VAT settlement":"Total including VAT · recovery off";
  $(prefix+"Annual").textContent=money(c[key].adjusted*12/s.months)+" / year effective";
  const gross=beforeVat[key].adjusted;
  $(prefix+"Gross").innerHTML='<span class="gross-total">'+money(gross)+' total</span><small>'+money(gross*12/s.months)+' / year<br>'+money(gross/s.months)+' / month</small>';
 }
 $("resultsVatNote").textContent="All figures include opportunity cost. Annual and monthly amounts spread the full cost over the selected term. "+
  (s.vatEnabled?"Net after VAT includes eligible deductions and sale VAT; any non-recoverable VAT remains in the cost. The comparison below each total excludes VAT refunds and sale-tax payments.":"VAT recovery is off, so both views include VAT without refunds or sale-tax payments.");
 const thresholds=resaleThresholds(s);
 thresholds.forEach((t,i)=>$(["breakEven","normalBreakEven","cashBreakEven"][i]).textContent=t.value===null?t.relation:money(Math.max(0,t.value)));
 $("breakNote").textContent=s.leaseEnd==="return"?"Break-even includes VAT and opportunity cost. Each purchase option is cheaper above its threshold. Your resale estimate is "+money(s.resale)+".":"All options end with the same car value, so changing resale alone generally does not change their ranking.";
 $("monthlyRows").innerHTML=[
 row("Loan payment / lease invoice",money(c.payment),money(c.normalPayment),money(c.kRent),"0 Kč"),
 row("Insurance paid separately",money(s.easyInsurance),money(s.normalInsurance),s.kintoInsuranceIncluded?"Included in invoice":money(c.kInsurance),money(s.cashInsurance)),
 row("Monthly bill incl. insurance",money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),money(c.kRent+c.kInsurance),money(s.cashInsurance),"emphasis"),
 row("VAT deduction per regular payment","0 Kč","0 Kč",money(c.leaseVatPerPayment),"0 Kč"),
 row("Monthly bill after regular VAT credit",money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),detail(c.kRent+c.kInsurance-c.leaseVatPerPayment,s.leaseVatDelay?"VAT credit arrives "+s.leaseVatDelay+" months later":"VAT deducted with each payment"),money(s.cashInsurance)),
 row("Effective monthly ownership cost",money(b.adjusted/s.months),money(n.adjusted/s.months),money(l.adjusted/s.months),money(cash.adjusted/s.months),"sum")
 ].join("");
 $("opportunityIntro").textContent="At "+s.opportunityRate+"% annual return, measured at month "+s.months+". Each payment is weighted by how long that cash could have stayed invested.";
 const opportunityGroups=[
 ["upfront","Deposit / initial payment / outright purchase"],["payments","Regular loan / lease payments"],["insurance","Separately paid insurance"],
 ["maintenance","Maintenance payments"],["tyres","Tyre purchase and seasonal service"],
 ["vatDuring","VAT refunds during the term"],["vatAfter","VAT refunds after the term"],
 ["settlement","Final balloon, buyout, sale and sale tax"],["other","Other payments"]
 ];
 $("opportunityRows").innerHTML=opportunityGroups.map(([key,label])=>row(label,money(b.opportunityBreakdown[key]),money(n.opportunityBreakdown[key]),money(l.opportunityBreakdown[key]),money(cash.opportunityBreakdown[key]))).join("")+
 row("Total opportunity cost",money(b.opportunity),money(n.opportunity),money(l.opportunity),money(cash.opportunity),"sum");
 $("opportunityExample").innerHTML='<span data-option="balloon">Balloon loan example</span>: the '+money(c.down)+' deposit is paid at month zero. At '+s.opportunityRate+'% over '+s.months+' months, its foregone return is '+money(b.opportunityBreakdown.upfront)+'.';
 $("serviceNote").textContent=c.serviceCount+" services · "+money(c.maintenance);
 const leaseResale=s.leaseEnd==="return"?0:-s.resale;
 $("costRows").innerHTML=[
 row("Depreciation / car value credit",money(c.depreciation),money(c.depreciation),s.leaseEnd==="return"?"In lease":money(leaseResale),money(c.depreciation)),
 row("Financing interest",money(c.interest),money(c.normalInterest),"In lease","0 Kč"),
 row("Lease payments + initial","—","—",money(c.kRent*s.months+s.kintoInitial),"—"),
 row("Lease buyout","—","—",s.leaseEnd==="return"?"—":money(s.leaseBuyout),"—"),
 row("Insurance incl. GAP",money(s.easyInsurance*s.months),money(s.normalInsurance*s.months),s.kintoInsuranceIncluded?"In lease":money(c.kInsurance*s.months),money(s.cashInsurance*s.months)),
 row("Maintenance",money(c.maintenance),money(c.maintenance),s.kintoMaintenance?"In lease":money(c.maintenance),money(c.maintenance)),
 row("Tyres & service, less resale",money(c.tyres),money(c.tyres),s.kintoTyres?"In lease":money(c.tyres),money(c.tyres)),
 row("Other costs",money(s.easyExtra),money(s.normalExtra),money(s.kintoExtra),money(s.cashExtra)),
 row("Net VAT adjustment",money(b.vat),money(n.vat),money(l.vat),money(cash.vat)),
 row("Cost before opportunity",money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal)),
 row("Opportunity cost",money(b.opportunity),money(n.opportunity),money(l.opportunity),money(cash.opportunity)),
 row("Total economic cost",money(b.adjusted),money(n.adjusted),money(l.adjusted),money(cash.adjusted),"sum")].join("");

 const comparisonNames={balloonLoan:{name:"Balloon loan",color:"balloon"},standardLoan:{name:"Standard loan",color:"normal"},lease:{name:"Operating lease",color:"lease"},cashPurchase:{name:"Buy outright",color:"cash"}};
 const label=key=>'<span class="option-label" data-option="'+comparisonNames[key].color+'">'+comparisonNames[key].name+'</span>';
 const pairs=resaleComparisons(s);
 const optionKeys=Object.keys(comparisonNames);
 $("versusRows").innerHTML=optionKeys.map(left=>{
  const cells=optionKeys.map(right=>{
   if(left===right)return '<td class="versus-diagonal" aria-label="Same option">—</td>';
   const difference=c[left].adjusted-c[right].adjusted;
   if(Math.abs(difference)<.5)return '<td class="versus-tie">Same cost</td>';
   const direction=difference<0?"less":"more";
   return '<td class="versus-'+direction+'"><span>'+money(Math.abs(difference))+'</span><small>'+direction+'</small></td>';
  }).join("");
  return '<tr><th scope="row" data-option="'+comparisonNames[left].color+'">'+label(left)+'</th>'+cells+'</tr>';
 }).join("");
 // Show crossovers explicitly alongside the five resale estimates.
 const resalePoints=[...new Set([...[-100000,-50000,0,50000,100000].map(offset=>Math.max(0,s.resale+offset)),...pairs.filter(p=>p.resale!==null).map(p=>p.resale)])].sort((a,b)=>a-b);
 $("sensitivity").innerHTML=resalePoints.map(resale=>{
  const next=calculate({...s,resale}),r=ranked(next);
  const matching=pairs.filter(p=>p.resale!==null&&Math.abs(p.resale-resale)<.01);
  const note=matching.map(p=>label(p.left)+" = "+label(p.right)).join("<br>");
  const tiedOptions=r.filter(item=>Math.abs(item.value-r[0].value)<.5);
  const winner=tiedOptions.length>1?tiedOptions.map(item=>'<span data-option="'+item.key+'">'+item.name+'</span>').join(" + ")+" tie":'<span data-option="'+r[0].key+'">'+r[0].name+'</span>';
  return '<tr class="'+(Math.abs(resale-s.resale)<.01?"selected ":"")+(matching.length?"breakpoint":"")+'"><th scope="row">'+money(resale)+(note?'<small class="breakpoint-note">Break-even<br>'+note+'</small>':"")+'</th><td data-option="balloon">'+money(next.balloonLoan.adjusted)+'</td><td data-option="normal">'+money(next.standardLoan.adjusted)+'</td><td data-option="lease">'+money(next.lease.adjusted)+'</td><td data-option="cash">'+money(next.cashPurchase.adjusted)+'</td><td>'+winner+'</td></tr>';
 }).join("");
 const loanSold=s.loanEnd==="sell",leaseSold=s.leaseEnd==="buySell",leaseBought=s.leaseEnd!=="return";
 const endNote="Month "+s.months;
 const refundNote=amount=>amount?"Month "+s.purchaseVatDelay:"No eligible deduction";
 const saleCell=(sold,amount,description)=>sold?detail(amount,description):"No sale";
 const otherInvoiceRefund=(o,capital,leaseVat)=>Math.max(0,-o.events.filter(e=>e.category==="vat"&&e.amount<0).reduce((sum,e)=>sum+e.amount,0)-capital-leaseVat);
 $("vatTimeline").innerHTML=[
 phase("01 · Purchase and lease start"),
 row("Purchase VAT refund",detail(c.purchaseRefund,refundNote(c.purchaseRefund)),detail(c.purchaseRefund,refundNote(c.purchaseRefund)),"Not a purchase",detail(c.purchaseRefund,refundNote(c.purchaseRefund))),
 row("Initial lease payment VAT","—","—",detail(c.leaseInitialVat,c.leaseInitialVat?"Month "+s.leaseVatDelay:"No initial VAT deduction"),"—"),
 phase("02 · During the agreement"),
 row("VAT on regular lease invoices","No VAT on loan repayments","No VAT on loan repayments",detail(c.leaseVatPerPayment,s.vatEnabled?"Per payment · months "+s.leaseVatDelay+"–"+(s.months-1+s.leaseVatDelay):"VAT recovery off"),"No regular purchase payments"),
 row("Maintenance / tyre VAT refunds",detail(otherInvoiceRefund(b,c.purchaseRefund,0),"Netted against the expense"),detail(otherInvoiceRefund(n,c.purchaseRefund,0),"Netted against the expense"),detail(otherInvoiceRefund(l,c.buyoutRefund,c.leaseInitialVat+c.leaseVatPerPayment*s.months),"Netted against the expense"),detail(otherInvoiceRefund(cash,c.purchaseRefund,0),"Netted against the expense")),
 phase("03 · End of term, month "+s.months),
 row("Gross car sale proceeds",loanSold?detail(s.resale,"Received from buyer"):"Car kept",loanSold?detail(s.resale,"Received from buyer"):"Car kept",leaseSold?detail(s.resale,"Received from buyer"):leaseBought?"Car kept":"Car returned",detail(s.resale,"Received from buyer")),
 row("VAT collected within sale price",saleCell(loanSold,c.carSaleVat,"Already part of gross proceeds"),saleCell(loanSold,c.carSaleVat,"Already part of gross proceeds"),saleCell(leaseSold,c.carSaleVat,"Already part of gross proceeds"),detail(c.carSaleVat,"Already part of gross proceeds")),
 row("Sale VAT paid to tax authority",saleCell(loanSold,c.carSaleVat,endNote),saleCell(loanSold,c.carSaleVat,endNote),saleCell(leaseSold,c.carSaleVat,endNote),detail(c.carSaleVat,endNote)),
 row("Car sale proceeds after VAT",saleCell(loanSold,s.resale-c.carSaleVat,"Before loan settlement"),saleCell(loanSold,s.resale-c.carSaleVat,"Loan fully repaid"),saleCell(leaseSold,s.resale-c.carSaleVat,"Before deducting buyout price"),detail(s.resale-c.carSaleVat,"No loan to settle")),
 row("Lease buyout VAT refund","No new VAT on balloon repayment","—",leaseBought?detail(c.buyoutRefund,c.buyoutRefund?"Month "+(s.months+s.purchaseVatDelay):"No eligible deduction"):"No buyout","—"),
 phase("04 · Refunds outstanding at end of term"),
 row("Total VAT still to be received",detail(b.futureRefund,"Already included in total cost"),detail(n.futureRefund,"Already included in total cost"),detail(l.futureRefund,"Already included in total cost"),detail(cash.futureRefund,"Already included in total cost"))
 ].join("");
 $("cashflow").innerHTML=[
 row("Deposit / initial payment / outright purchase",money(c.down),money(c.normalDown),money(s.kintoInitial),money(s.price)),
 row("Final balloon / lease buyout",money(c.balloon),"0 Kč",leaseBought?money(s.leaseBuyout):"No buyout","0 Kč"),
 row("Net cash spent through month "+s.months,money(b.cashToEnd),money(n.cashToEnd),money(l.cashToEnd),money(cash.cashToEnd)),
 row("Retained asset value, net of sale VAT",money(b.retainedValue),money(n.retainedValue),money(l.retainedValue),money(cash.retainedValue)),
 row("VAT refunds due after month "+s.months,money(b.futureRefund),money(n.futureRefund),money(l.futureRefund),money(cash.futureRefund)),
 row("Economic cost before opportunity",money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal),"sum")
 ].join("");
 return c;
}



function updateThemeButton(){
 const dark=document.documentElement.dataset.theme==="dark";
 $("themeToggle").setAttribute("aria-pressed",String(dark));
 $("themeToggle").textContent=dark?"Dark mode: on":"Dark mode: off";
}
updateThemeButton();
$("themeToggle").addEventListener("click",()=>{
 const theme=document.documentElement.dataset.theme==="dark"?"light":"dark";
 document.documentElement.dataset.theme=theme;updateThemeButton();
 try{localStorage.setItem("car-financing-calculator.theme",theme);$("themeToggle").title="Theme choice saved in this browser.";}
 catch{$("themeToggle").title="Theme applies for this session. Browser storage is unavailable.";}
});

const STORAGE_KEY="car-financing-calculator.scenarios.v2";
const LEGACY_STORAGE_KEY="car-financing-calculator.settings.v1";
let scenarios=[],activeScenarioId="";
const newScenarioId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
function validateSettings(state){
 for(const [key,fallback] of Object.entries(defaults)){
  const value=state[key];
  if(typeof fallback==="number"){
   if(value===null)continue;
   if(!Number.isFinite(value)||value<0)throw new Error("Enter a non-negative number or leave the field empty.");
  }else if(typeof value!==typeof fallback)throw new Error("Invalid setting: "+key);
 }
 if(state.carName.length>100)throw new Error("Keep the scenario name under 100 characters.");
 if(!["sell","keep"].includes(state.loanEnd)||!["return","buySell","buyKeep"].includes(state.leaseEnd)||!["gross","net"].includes(state.kintoVatMode))throw new Error("Choose a valid option.");
 const effective={...state};
 if(effective.leaseEnd==="return"&&effective.leaseBuyout===null)effective.leaseBuyout=0;
 if(effective.kintoInsuranceIncluded&&effective.kintoInsurance===null)effective.kintoInsurance=0;
 if(!Object.values(effective).includes(null))validate(effective);
}
function readSettings(){
 return Object.fromEntries(Object.entries(read()).map(([key,value])=>[key,typeof defaults[key]==="number"&&$(key).value.trim()===""?null:value]));
}
function decodeSettings(text){
 const data=JSON.parse(text);
 if(!data||data.format!=="car-financing-calculator"||data.version!==1||!data.inputs||typeof data.inputs!=="object"||Array.isArray(data.inputs))throw new Error("Choose a calculator settings JSON file.");
 // Older saved scenarios and JSON exports may contain the retired running-cost VAT delay.
 const inputs={...data.inputs};delete inputs.invoiceVatDelay;
 for(const key of Object.keys(inputs))if(!Object.hasOwn(defaults,key))throw new Error("Unknown setting: "+key);
 const state={...defaults,...inputs};validateSettings(state);return state;
}
function encodeSettings(state){
 validateSettings(state);return JSON.stringify({format:"car-financing-calculator",version:1,inputs:state},null,2);
}
function decodeCollection(text){
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
function encodeCollection(){
 return JSON.stringify({format:"car-financing-calculator",version:2,activeId:activeScenarioId,scenarios},null,2);
}
function renderScenarioSelector(){
 const select=$("scenarioSelect");select.replaceChildren();
 for(const scenario of scenarios){
  const option=document.createElement("option");option.value=scenario.id;option.textContent=scenario.inputs.carName.trim()||"Untitled scenario";
  select.appendChild(option);
 }
 select.value=activeScenarioId;
 $("scenarioCount").textContent=scenarios.length+" saved scenario"+(scenarios.length===1?"":"s");
}
function persistCollection(){
 try{localStorage.setItem(STORAGE_KEY,encodeCollection());$("storageStatus").textContent="All scenarios saved in this browser. Export all JSON to back them up.";return true;}
 catch{$("storageStatus").textContent="Local saving is unavailable. These scenarios last for this session; use Export all JSON to keep them.";return false;}
}
function saveSettings(state){
 validateSettings(state);
 const active=scenarios.find(item=>item.id===activeScenarioId);
 active.inputs={...state};renderScenarioSelector();return persistCollection();
}
function restoreSettings(){
 let message="Changes save automatically to the selected scenario.";
 try{
  const stored=localStorage.getItem(STORAGE_KEY);
  if(stored){const restored=decodeCollection(stored);scenarios=restored.scenarios;activeScenarioId=restored.activeId;message="Saved scenarios restored from this browser.";}
  else{
   const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
   const inputs=legacy?decodeSettings(legacy):{...defaults};
   scenarios=[{id:newScenarioId(),inputs}];activeScenarioId=scenarios[0].id;
   message=legacy?"Your previously saved settings are now the first scenario.":"Changes save automatically to the selected scenario.";
  }
 }catch{message="Saved scenarios could not be loaded. Defaults shown; JSON import and export are available.";}
 if(!scenarios.length){scenarios=[{id:newScenarioId(),inputs:{...defaults}}];activeScenarioId=scenarios[0].id;}
 renderScenarioSelector();write(scenarios.find(item=>item.id===activeScenarioId).inputs);update();
 // Keep the old single-scenario record untouched while migrating to the collection.
 if(persistCollection())$("storageStatus").textContent=message;
}
function currentValidSettings(){
 const state=readSettings();validateSettings(state);return state;
}
function uniqueScenarioName(base,suffix){
 let index=1,name;
 do{const tail=" · "+suffix+(index===1?"":" "+index);name=base.slice(0,100-tail.length)+tail;index++;}
 while(scenarios.some(item=>item.inputs.carName===name));
 return name;
}
restoreSettings();
function prefillRelated(source){
 const controls=[...$("inputs").querySelectorAll("input[id],select[id]")];
 const sourceIndex=controls.findIndex(control=>control.id===source);
 const sourceValue=Number($(source)?.value);
 if(sourceIndex<0||$(source).value.trim()===""||!Number.isFinite(sourceValue)||sourceValue<0)return;
 const groups=[["downPct","normalDownPct"],["rate","normalRate"],["easyInsurance","normalInsurance","kintoInsurance","cashInsurance"]];
 const suggestions=[];
 for(const group of groups)if(group.includes(source)){
  if(["downPct","rate","normalRate"].includes(source)&&sourceValue>100)return;
  for(const target of group)suggestions.push([target,sourceValue]);
 }
 if((source==="months"||source==="ownershipYears")&&Number.isInteger(Number($("months").value))&&Number($("months").value)>0&&Number($("months").value)<=120){
  suggestions.push(["tyreVisits",Math.ceil(Number($("months").value)/6)]);
 }
 const filled=[];
 // DOM order follows the setup cards from top to bottom and left to right.
 for(const [target,value] of suggestions){
  const targetIndex=controls.findIndex(control=>control.id===target);
  if(targetIndex<=sourceIndex||$(target).value.trim()!=="")continue;
  $(target).value=value;
  const label=document.querySelector('label[for="'+target+'"] .field-title');
  filled.push((label?.textContent||target)+": "+value);
 }
 if(filled.length)$("prefillStatus").textContent="Suggested "+filled.join("; ")+". You can edit these values.";
}
function handleInput(event){
 if(event?.target.id==="ownershipYears"){
  const years=$("ownershipYears").value,months=Number(years)*12;
  // A whole-month term may display as rounded fractional years.
  $("months").value=years.trim()===""?"":Math.abs(months-Math.round(months))<.00001?Math.round(months):months;
 }else if(event?.target.id==="months"){
  $("ownershipYears").value=$("months").value.trim()===""?"":Number((Number($("months").value)/12).toFixed(6));
 }
 // Wait for a committed change so typing "5.99" does not copy its first digit.
 if(event?.type==="change")prefillRelated(event.target.id);
 const complete=update();
 try{
  if(saveSettings(currentValidSettings())&&!complete)$("storageStatus").textContent="Incomplete scenario saved. Continue filling fields, or switch scenarios and return later.";
 }catch{$("storageStatus").textContent="Fix the invalid value to save these changes.";}
}
$("inputs").addEventListener("input",handleInput);
$("inputs").addEventListener("change",handleInput);
$("inputs").addEventListener("submit",e=>e.preventDefault());
$("scenarioSelect").addEventListener("change",()=>{
 const target=$("scenarioSelect").value;
 try{
  const current=currentValidSettings();
  const next=scenarios.find(item=>item.id===target);if(!next)throw new Error("Select an existing scenario.");
  scenarios.find(item=>item.id===activeScenarioId).inputs={...current};
  activeScenarioId=target;write(next.inputs);update();renderScenarioSelector();persistCollection();
 }catch(e){$("scenarioSelect").value=activeScenarioId;$("storageStatus").textContent="Cannot switch yet: "+e.message;}
});
$("duplicateScenario").addEventListener("click",()=>{
 try{
  const state=currentValidSettings();
  scenarios.find(item=>item.id===activeScenarioId).inputs={...state};
  const copy={id:newScenarioId(),inputs:{...state,carName:uniqueScenarioName(state.carName.trim()||"Scenario","copy")}};
  scenarios.push(copy);activeScenarioId=copy.id;write(copy.inputs);update();renderScenarioSelector();
  if(persistCollection())$("storageStatus").textContent="Variation created. Edit its name and inputs; the original stays unchanged.";
  $("carName").focus();$("carName").select();
 }catch(e){$("storageStatus").textContent="Cannot duplicate yet: "+e.message;}
});
$("clearAll").addEventListener("click",()=>{
 const active=scenarios.find(item=>item.id===activeScenarioId);
 const state=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof value==="number"?null:typeof value==="boolean"?false:value]));
 state.carName=$("carName").value||active.inputs.carName;
 write(state);update();saveSettings(state);
 $("prefillStatus").textContent="Numeric fields cleared. Select your VAT and coverage choices, then fill the form from the top. Related empty fields are suggested when you finish editing.";
 $("storageStatus").textContent="Cleared current scenario saved. Other scenarios are kept. Reset current restores the example values.";
});
$("reset").addEventListener("click",()=>{
 const name=scenarios.find(item=>item.id===activeScenarioId).inputs.carName;
 const state={...defaults,carName:name};write(state);update();
 if(saveSettings(state))$("storageStatus").textContent="Selected scenario reset to default assumptions. Other scenarios were kept.";
});
function downloadSettings(json,filename){
 const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("exportSettings").addEventListener("click",()=>{
 try{downloadSettings(encodeSettings(currentValidSettings()),"car-financing-settings.json");$("storageStatus").textContent="Selected scenario exported. Share its JSON together with the HTML calculator.";}
 catch(e){$("storageStatus").textContent="Export failed: "+e.message;}
});
$("exportAllSettings").addEventListener("click",()=>{
 try{
  const state=currentValidSettings();scenarios.find(item=>item.id===activeScenarioId).inputs={...state};
  downloadSettings(encodeCollection(),"car-financing-all-scenarios.json");$("storageStatus").textContent="All scenarios exported, including the current selection.";
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
  const additions=imported.scenarios.map(item=>({id:newScenarioId(),inputs:{...item.inputs},wasActive:item.id===imported.activeId}));
  scenarios.find(item=>item.id===activeScenarioId).inputs={...current};
  for(const item of additions){
   if(scenarios.some(existing=>existing.inputs.carName===item.inputs.carName))item.inputs.carName=uniqueScenarioName(item.inputs.carName||"Scenario","imported");
   scenarios.push({id:item.id,inputs:item.inputs});
  }
  activeScenarioId=additions.find(item=>item.wasActive).id;write(scenarios.find(item=>item.id===activeScenarioId).inputs);update();renderScenarioSelector();
  if(persistCollection())$("storageStatus").textContent="Imported "+additions.length+" scenario"+(additions.length===1?"":"s")+". Existing scenarios were kept.";
 }catch(e){$("storageStatus").textContent="Import failed: "+e.message+" Current scenarios were kept.";}
 finally{$("importFile").value="";}
});
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 // Agent input uses the same validation and rendering path as the visible controls.
 try{Promise.resolve(document.modelContext.registerTool({
 name:"compare_car_financing",title:"Compare car financing",description:"Update assumptions and compare a balloon loan, standard loan, operating lease and outright purchase, including VAT timing, end choices and opportunity cost.",
 inputSchema:{type:"object",properties:Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,{type:typeof v==="number"?"number":typeof v==="boolean"?"boolean":"string"}])),additionalProperties:false},
 annotations:{readOnlyHint:false,untrustedContentHint:false},
 execute(input){if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Provide an object of calculator inputs.");for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new Error("Unknown input: "+key);const s={...read(),...input};validate(s);write(s);const c=update();saveSettings(s);return {balloonLoanTotal:c.balloonLoan.adjusted,standardLoanTotal:c.standardLoan.adjusted,operatingLeaseTotal:c.lease.adjusted,outrightPurchaseTotal:c.cashPurchase.adjusted,resaleBreakEven:resaleThresholds(s)};}
 },{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener("pagehide",()=>lifecycle.abort(),{once:true});
}


// Escape dismisses a keyboard-focused explanation without changing any inputs.
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&document.activeElement?.classList.contains("help-button"))document.activeElement.blur();
});


// UI expansion belongs to this browser, independently of financial scenarios.
const CARD_STATE_KEY="car-financing-calculator.cards.v1";
function initializeCards(){
 let saved={};
 try{const value=JSON.parse(localStorage.getItem(CARD_STATE_KEY)||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))saved=value;}catch{}
 const states={};
 function remember(key,expanded){
  states[key]=expanded;
  try{localStorage.setItem(CARD_STATE_KEY,JSON.stringify(states));}
  catch{$("storageStatus").textContent="Card state applies for this session. Browser storage is unavailable.";}
 }
 for(const card of document.querySelectorAll("section.panel,section.total,section.verdict,section.scenario-toolbar")){
  const original=card.querySelector(":scope > .section-title")||card.querySelector(":scope > h2")||card.querySelector(":scope > .eyebrow");
  const title=card.id==="verdict"?"Overall result":card.classList.contains("scenario-toolbar")?"Saved scenarios":
   original?.querySelector("h2")?.firstChild.textContent.trim()||original?.firstChild.textContent.trim()||"Card";
  const key=card.id||card.querySelector("input[id],select[id],tbody[id]")?.id||(card.dataset.option?"total-"+card.dataset.option:title.toLowerCase().replace(/[^a-z0-9]+/g,"-"));
  const header=document.createElement("div");header.className="card-heading";
  const heading=card.id==="verdict"||card.classList.contains("scenario-toolbar")?null:original;
  if(heading)header.appendChild(heading);
  else{const label=document.createElement("h2");label.textContent=title;header.appendChild(label);}
  const body=document.createElement("div");body.className="card-body";body.id="card-body-"+key;
  while(card.firstChild)body.appendChild(card.firstChild);
  const button=document.createElement("button");button.type="button";button.className="card-toggle";
  button.setAttribute("aria-controls",body.id);header.appendChild(button);
  card.append(header,body);card.classList.add("collapsible-card");card.dataset.card=key;
  function expand(open){
   body.hidden=!open;card.dataset.collapsed=String(!open);button.setAttribute("aria-expanded",String(open));
   button.textContent=open?"−":"+";button.setAttribute("aria-label",(open?"Collapse ":"Expand ")+title);
   states[key]=open;
  }
  expand(typeof saved[key]==="boolean"?saved[key]:true);
  button.addEventListener("click",()=>{expand(body.hidden);remember(key,!body.hidden);});
 }
 for(const card of document.querySelectorAll("details")){
  const summary=card.querySelector(":scope > summary");
  const key="details-"+summary.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-");
  card.dataset.card=key;card.open=typeof saved[key]==="boolean"?saved[key]:true;states[key]=card.open;
  card.addEventListener("toggle",()=>remember(key,card.open));
 }
}
initializeCards();
