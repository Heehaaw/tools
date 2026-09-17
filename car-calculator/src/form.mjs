import {defaults,variants,historicalInflationRate,historicalInflationTotal,relativeResaleEstimate,nominalOpportunityRate} from "./model.mjs";
import {money,num,ratePercent,ungroupNumber,parseNumber,formatNumberInput} from "./format.mjs";
import {createYearEditor} from "./year-editor.mjs";

/** Own raw form values, derived controls and forward-only suggestions. */
export function createForm({document,views,onChange}){
 const $=id=>document.getElementById(id);
 const {applyTimeLabels}=views;
 const additionalEditor=createYearEditor({document,prefix:"additionalYear",dialogId:"additionalCostsDialog",openerId:"editAdditionalYears",closeIds:["closeAdditionalYears","doneAdditionalYears"],datasetKey:"additionalYear",unit:"Kč / year incl. VAT",staticFields:true,describe:(value,duration)=>money(value*duration/12)+(duration<12?" · "+duration+"/12 year":" in this year")});
 const historicalEditor=createYearEditor({document,prefix:"historicalInflationYear",dialogId:"historicalInflationDialog",openerId:"editHistoricalInflation",closeIds:["closeHistoricalInflation","doneHistoricalInflation"],gridId:"historicalInflationYearGrid",datasetKey:"historicalInflationYear",unit:"% p.a.",maxYears:100,baseMax:20,step:.1,limit:100,describe:(value,duration)=>ratePercent(((1+value/100)**(duration/12)-1)*100)+(duration<12?" · "+duration+"/12 year":" in this year")});

 function read(){
  const state=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Array.isArray(v)?JSON.parse($(k).value||"[]"):typeof v==="boolean"?$(k).checked:typeof v==="number"?($(k).value.trim()===""?NaN:parseNumber($(k).value)):$(k).value]));
  // Hidden, unused charges are zero for calculation, but stay blank in saved drafts.
  if(state.leaseEnd==="return"&&$("leaseBuyout").value.trim()==="")state.leaseBuyout=0;
  if(state.kintoInsuranceIncluded&&$("kintoInsurance").value.trim()==="")state.kintoInsurance=0;
  return state;
 }

 function normalizeReturnInput(){
  if($("opportunityRateBasis").value!=="real")return;
  const rate=$("opportunityRate").value.trim(),inflation=$("inflationRate").value.trim();
  // A blank rate has no value to convert. Incomplete legacy real-rate drafts keep their basis until inflation is known.
  if(!rate){$("opportunityRateBasis").value="nominal";return;}
  if(!inflation||!Number.isFinite(parseNumber(rate))||!Number.isFinite(parseNumber(inflation)))return;
  const inflationRate=$("pastOwnership").checked&&$("resaleMode").value==="relative"?historicalInflationRate(read()):parseNumber(inflation);
  if(!Number.isFinite(inflationRate))return;
  const nominal=nominalOpportunityRate({opportunityRateBasis:"real",opportunityRate:parseNumber(rate),inflationRate});
  $("opportunityRate").value=formatNumberInput(Number(nominal.toFixed(10)));
  $("opportunityRateBasis").value="nominal";
 }

 function write(s){
  additionalEditor.close();historicalEditor.close();
  $("prefillStatus").textContent="";
  for(const [k,v] of Object.entries(s)){if(Array.isArray(v))$(k).value=JSON.stringify(v);else if(typeof v==="boolean")$(k).checked=v;else $(k).value=v===null?"":typeof v==="number"?formatNumberInput(v):v;}
  normalizeReturnInput();
 }

 function readSettings(){
  return Object.fromEntries(Object.entries(read()).map(([key,value])=>[key,typeof defaults[key]==="number"&&$(key).value.trim()===""?null:value]));
 }

 function additionalPeriod(s){
  const periods=variants.filter(v=>s[v.enabled]&&(v.kind!=="lease"||s.leaseAdditionalCosts)).map(v=>s.matchPeriods?s.months:s[v.months]);
  const months=Math.max(...(periods.length?periods:[s.months]));
  return Number.isFinite(months)?Math.max(1,Math.min(120,months)):s.months||12;
 }
 function updateAdditionalCosts(s){
  const yearly=$("additionalCostMode").value==="yearly",raw=readSettings(),months=additionalPeriod(s),count=Math.ceil(months/12);
  $("additionalDialogTitle").textContent=s.pastOwnership?"Actual yearly additional costs":"Estimated yearly additional costs";
  if(!yearly&&$("additionalCostsDialog").open)$("additionalCostsDialog").close();
  $("additionalCostTitle").textContent=s.pastOwnership?"Actual additional costs":"Estimated additional costs";
  $("additionalAnnualTitle").textContent=s.pastOwnership?"Average annual costs":"Annual allowance";
  $("additionalCostIntro").textContent=s.pastOwnership?"Repairs and other expenses paid during ownership, outside scheduled maintenance. Use the year-by-year view to reflect when you paid them.":"Repairs and other expenses outside scheduled maintenance. Enter amounts not already included elsewhere.";
  $("additionalModeAnnual").checked=!yearly;$("additionalModeYearly").checked=yearly;
  $("additionalAnnualField").hidden=yearly;$("additionalYearlyFields").hidden=!yearly;$("additionalCostAnnual").disabled=yearly;
  const values=Array.from({length:count},(_,i)=>yearly&&i<raw.additionalCostYears.length?raw.additionalCostYears[i]:raw.additionalCostAnnual);
  additionalEditor.render({months,values,active:yearly});
  const total=values.reduce((sum,value,i)=>sum+(Number.isFinite(value)?value*Math.min(12,months-i*12)/12:NaN),0);
  $("additionalCostSummary").textContent=Number.isFinite(total)?money(total)+" over "+months+" months before VAT recovery. "+(s.matchPeriods?"":"Shorter options use only their own period. ")+(s.leaseAdditionalCosts?"Also applied to operating lease.":"Operating lease excluded."):"Complete the additional cost amounts to compare results.";
  $("additionalDialogSummary").textContent=$("additionalCostSummary").textContent;
  $("additionalYearlyTotal").textContent=Number.isFinite(total)?"Total: "+money(total)+" · "+num(months)+" months, incl. VAT":"Complete the yearly costs";
  $("additionalYearlyTotal").title="Before VAT recovery, inflation and opportunity cost. Shorter options use only their own ownership period.";
  $("additionalCostSummary").hidden=yearly;
 }
 function historicalPeriod(s){return s.pastOwnership||s.historicalMatchPeriod?s.months:s.historicalMonths;}
 function updateHistoricalInflation(s){
  const raw=readSettings(),yearly=raw.historicalInflationMode==="yearly",relative=raw.resaleMode==="relative",months=historicalPeriod(raw);
  $("historicalInflationTotalMode").checked=!yearly;$("historicalInflationYearlyMode").checked=yearly;
  $("historicalInflationPct").hidden=yearly;$("historicalInflationPct").disabled=!relative||yearly;$("editHistoricalInflation").hidden=!yearly;
  const count=Number.isFinite(months)&&months>0?Math.min(100,Math.ceil(months/12)):0;
  const values=Array.from({length:count},(_,i)=>i<raw.historicalInflationYears.length?raw.historicalInflationYears[i]:2.5);
  historicalEditor.render({months,values,active:relative&&yearly});
  const total=historicalInflationTotal(raw);
  const note=months>1200?"Use a direct total for periods over 100 years.":Number.isFinite(total)?"Compounded total: "+ratePercent(total)+" over "+num(months)+" months.":"Complete the year rates and comparable age to calculate cumulative inflation.";
  $("historicalInflationComputed").hidden=!yearly;$("historicalInflationComputed").textContent=note;
  $("historicalInflationDialogSummary").textContent=note;
 }
 function updateSelection(s){
  updateAdditionalCosts(s);
  const visibleKinds=new Set(variants.filter(v=>s[v.enabled]).map(v=>v.kind));
  for(const element of document.querySelectorAll("#comparison thead [data-option],#comparison .total[data-option],.option-legend [data-option]"))element.hidden=!visibleKinds.has(element.dataset.option);
  for(const element of document.querySelectorAll(".individual-term"))element.hidden=s.matchPeriods;
  for(const v of variants){
   const panel=document.querySelector('.option-panel[data-option="'+v.kind+'"]');
   if(panel)panel.dataset.excluded=String(!s[v.enabled]);
   for(const control of panel?.querySelectorAll("input,select")||[])if(control.id!==v.enabled)control.disabled=!s[v.enabled];
  }
  for(const v of variants.filter(v=>v.loanMonths)){
   $(v.kind+"LoanTermField").hidden=s[v.matchLoanTerm];
   $(v.loanMonths).disabled=!s[v.enabled]||s[v.matchLoanTerm];
   $(v.matchLoanTerm).setAttribute("aria-expanded",String(!s[v.matchLoanTerm]));
   const keep=s[v.months],repay=s[v.loanMonths];
   const timing=repay<keep?"Repayments stop at month "+repay+"; insurance and running costs continue.":repay>keep?(s.loanEnd==="sell"?"Selling at month "+keep+" pays off the remaining principal. Add any settlement fee to Other loan costs.":"At month "+keep+", remaining debt reduces the retained car value. Later payments and interest are outside this comparison."):"Repayments end when ownership ends.";
   $(v.kind+"LoanTermNote").textContent=Number.isFinite(keep)&&Number.isFinite(repay)?"Keep for "+keep+" months · repay over "+repay+" months. "+timing+(v.kind==="balloon"&&s.balloonPct>0?" The balloon is due at month "+repay+" if the loan reaches maturity.":""):"Enter ownership and repayment periods in whole months.";
  }
  for(const key of ["leaseVatDelay","leaseTaxablePct"]){
   $(key+"Field").hidden=!s.vatEnabled;
   $(key).disabled=!s.vatEnabled||!s.leaseEnabled;
  }
  const relative=s.resaleMode==="relative",past=s.pastOwnership,derivedInflation=past&&relative;
  $("ownershipModeNote").textContent=past?"Replay ownership from its purchase date. Enter costs and finance terms from that period. Inflation-adjusted results use purchase-date money.":"Plan ownership starting today, using current purchase prices and future resale estimates.";
  $("ownershipPeriodTitle").textContent=past?"Ownership period":"Comparison period";
  $("purchasePriceTitle").textContent=past?"Price paid at purchase":"Purchase price";
  $("directResaleTitle").textContent=past?"Sale / retained value at end":"Expected car resale";
  $("derivedResaleTitle").textContent=past?"Modelled end value":"Estimated future resale";
  $("annualInflationTitle").textContent=derivedInflation?"Annualised historical inflation":past?"Average inflation over ownership":"Estimated inflation";
  $("inflationRate").hidden=derivedInflation;$("inflationRate").disabled=derivedInflation;
  $("inflationRateDerived").hidden=!derivedInflation;$("inflationDerivation").hidden=!derivedInflation;
  $("inflationRateDerived").value=Number.isFinite(s.inflationRate)?formatNumberInput(Number(s.inflationRate.toFixed(4))):"";
  $("inflationDerivation").textContent="Calculated from "+ratePercent(s.historicalInflationPct)+" cumulative inflation over "+num(s.historicalMonths)+" months.";
  document.querySelector('label[for="inflationRate"],label[for="inflationRateDerived"]')?.setAttribute('for',derivedInflation?'inflationRateDerived':'inflationRate');
  $("help-inflationRate").textContent=derivedInflation?"Read-only in past ownership with relative depreciation. Annual rate = (1 + cumulative inflation / 100) raised to (12 / ownership period in months), minus 1. This keeps historical purchasing-power conversions consistent. It is a constant annual approximation; actual inflation varied during the period. Edit cumulative inflation below or the ownership period above. The saved forecast rate is preserved.":past?"Average annual compounded inflation over the actual ownership period. Used to value dated payments and receipts in purchase-date money. Direct sale and retained values stay exactly as entered.":"Used by the today’s-money toggles to adjust future payments and receipts for purchasing power. The 2.5% starting value is an editable planning assumption. Relative depreciation uses this rate to project future nominal resale. Direct resale estimates and quoted costs remain exactly as entered.";
  $("help-relativeResaleValue").textContent=past?"Modelled value at the ownership end, including VAT. Matching the original price and historical age reproduces the known used value. The smaller value uses purchasing power at purchase. Different prices or periods are scaled estimates.":"Calculated VAT-inclusive value at the end of the comparison period. The model applies the comparable car’s real depreciation to today’s purchase price, then adds estimated annual inflation. Separate periods get their own projected resale.";
  $("help-resale").textContent=past?"Actual sale proceeds including VAT, after selling fees, or the retained market value at the ownership end. This reduces ownership cost. Winter tyres are counted separately.":"Your expected selling price including VAT, after selling fees. This reduces ownership cost. If kept, it is estimated retained value. Winter tyres are counted separately.";
  $("historicalPricesHint").textContent=past?"Use the original price and end value of the historical car. Set Price paid at purchase above to the same original price to replay that car exactly. Its age follows the ownership period automatically. Cumulative inflation must cover that whole period. Other purchase prices or individual option periods model a scaled comparison.":"The two prices are initially copied from your purchase and direct resale estimates as starting suggestions. Replace them with a comparable car’s actual original new price and its used resale value today. The purchase price above is the new car’s price today. Enter actual prices on the same VAT basis and use comparable trim, condition and mileage.";
  $("relativeMethodHint").textContent=past?"The derived annual inflation reconciles cumulative inflation with the ownership period. Matching the original purchase price reproduces the entered end value. Other periods use a constant compounded depreciation rate; they are estimates, not observed sale prices.":"Different ownership periods use the same compounded annual real depreciation rate. This is a simple extrapolation, not a forecast of market prices. Choose comparable mileage yourself; mileage does not adjust resale automatically. Future nominal resale uses the annual inflation estimate above, even when the results’ today’s-money switches are off.";
  $("timelineHint").textContent=past?"Replay the ownership period from purchase to the end value. Solid and dashed lines show nominal value and purchasing power at purchase. The curve assumes constant compounded depreciation, not measured price history. Values include VAT, before settlement of VAT, sale taxes or remaining debt.":"Historical points belong to the comparable car; the shaded future belongs to the new car bought today. The dashed historical line only connects your two inputs, it is not a measured price history. Future solid and dashed lines show nominal resale and purchasing power today. Coloured vertical lines mark each selected option’s end month. Values include VAT, before VAT settlement, sale taxes or remaining debt. Both money bases are always shown; investment returns do not change the car’s market value.";
  $("help-resaleMode").textContent=past?"Direct resale uses the known sale or retained value unchanged. Relative depreciation replays the historical value change; matching the original price and age reproduces the known end value. Other prices or periods remain modelled comparisons. Inactive inputs are preserved.":"Direct mode uses your expected future selling price as entered. Relative depreciation estimates future resale from a comparable car’s historical prices, age and inflation. Switching methods preserves inactive inputs.";
  $("heatmapHint").textContent=past?"What if inflation or the alternative investment return had differed? Known or modelled end values, quotes and running costs stay fixed. This is sensitivity analysis, not a reconstruction of actual inflation. Different ownership terms are compared per month.":"Explore future inflation against alternative investment returns. Historical prices, historical inflation, finance quotes and running costs stay fixed. Relative mode recalculates future nominal resale; direct resale estimates stay fixed. Different terms are compared per month. With opportunity cost off, investment return has no effect. Cells are sampled scenarios, not exact break-even boundaries. Hover, tap or use arrow keys to compare all selected options.";
  $("resaleMode-direct").checked=!relative;$("resaleMode-relative").checked=relative;
  $("directResaleField").hidden=relative;$("resale").disabled=relative;
  $("relativeResaleSettings").hidden=!relative;$("relativeResaleOutput").hidden=!relative;$("relativeResaleExplanation").hidden=!relative;
  for(const key of ["historicalNewPrice","historicalUsedPrice","historicalInflationPct"])$(key).disabled=!relative;
  $("historicalPeriodControls").hidden=past;
  $("historicalMatchPeriod").disabled=past;
  $("historicalMonthsField").hidden=past||s.historicalMatchPeriod;
  $("historicalMonths").disabled=past||!relative||s.historicalMatchPeriod;
  $("historicalPeriodNote").textContent=s.historicalMatchPeriod?"Looking back "+s.months+" months, matching the comparison period above. Uncheck to use a different age.":(past?"The comparable car’s age is independent of the ownership period being replayed.":"The comparable car’s age is independent of how long you plan to own the new car.");
  for(const element of document.querySelectorAll(".individual-resale"))element.hidden=s.matchPeriods||relative;
  for(const v of variants)$(v.resale).disabled=!s[v.enabled]||relative;
  $("periodMatchText").textContent=relative?"Match all ownership periods":"Match all periods and resale estimates";
  $("periodMatchHelp").textContent=relative?"Uncheck to set each option’s ownership period. Resale is calculated for each period; different periods are compared by effective monthly cost.":"Uncheck to set each option’s term and end value. Different ownership terms are compared by effective monthly cost; no replacement contracts are assumed. Loan repayment length can be changed separately below.";
  if(relative){
   // Historical purchasing-power conversions use cumulative inflation, independently of future projections.
   const factor=Number.isFinite(s.historicalInflationPct)&&s.historicalInflationPct>=0?1+s.historicalInflationPct/100:NaN;
   const newPriceToday=s.historicalNewPrice*factor,usedPriceThen=s.historicalUsedPrice/factor;
   $("historicalNewPriceToday").textContent=Number.isFinite(newPriceToday)?"In today’s money: "+money(newPriceToday)+".":"";
   $("historicalUsedPriceThen").textContent=Number.isFinite(usedPriceThen)?"In purchase-time money: "+money(usedPriceThen)+".":"";
   const estimate=relativeResaleEstimate(s);
   const valid=estimate&&Number.isFinite(estimate.nominalValue);
   $("relativeResaleValue").textContent=valid?money(estimate.nominalValue):"Complete the historical inputs";
   $("relativeResaleToday").textContent=valid?money(estimate.todayValue)+(past?" in purchase-date money · ":" in today’s money · ")+s.months+" months":"";
   const previews=variants.filter(v=>s[v.enabled]&&(v.kind!=="lease"||s.leaseEnd!=="return")).map(v=>v.name+": "+money(s[v.resale])+" at "+s[v.months]+" months");
   $("relativeResaleExplanation").textContent=valid?"Original price in today’s money: "+money(estimate.historicalPriceToday)+". Real value retained after "+s.historicalMonths+" months: "+ratePercent(estimate.retainedShare*100)+". Annual real value retained: "+ratePercent(estimate.annualRetention*100)+(past?". Annualised historical inflation: ":". Future inflation: ")+ratePercent(s.inflationRate)+" p.a. "+(s.matchPeriods?"":previews.join(" · ")):"Enter the historical new price, today’s used value, age and cumulative inflation to calculate resale. No historical market prices are supplied.";
  }
  updateHistoricalInflation(s);
  applyTimeLabels($("inputs"));
  $("months").disabled=false;
  const pendingReturn=s.opportunityRateBasis==="real";
  $("opportunityRate").disabled=pendingReturn;
  $("opportunityRateUnit").textContent=pendingReturn?"Saved after-tax, after-inflation rate":"% p.a. after tax, before inflation";
  const realReturn=Number.isFinite(s.opportunityRate)&&Number.isFinite(s.inflationRate)&&s.opportunityRate>=0&&s.inflationRate>=0?(pendingReturn?s.opportunityRate:((1+s.opportunityRate/100)/(1+s.inflationRate/100)-1)*100):NaN;
  $("realReturnDescription").textContent=Number.isFinite(realReturn)?"Effective return after inflation: "+ratePercent(realReturn)+" p.a. after tax.":"Enter return and inflation to see the effective return after inflation.";
  $("returnMigration").hidden=!pendingReturn;
  $("returnMigration").textContent=pendingReturn?"This saved return is after inflation. Finish entering the inflation estimate to convert it to a before-inflation return without changing its meaning.":"";
  $("incomeTaxSettings").hidden=!s.incomeTaxEnabled;
  $("incomeTaxEnabled").setAttribute("aria-expanded",String(s.incomeTaxEnabled));
  $("incomeTaxRate").disabled=!s.incomeTaxEnabled;
  $("matchSaleTaxRate").disabled=!s.incomeTaxEnabled;
  $("saleTaxRateField").hidden=s.matchSaleTaxRate;
  $("saleTaxRate").disabled=!s.incomeTaxEnabled||s.matchSaleTaxRate;
  $("saleTaxRateNote").textContent="Rate on taxable car-sale income: "+ratePercent(s.saleTaxRate)+". VAT is calculated separately.";
  for(const v of variants){
   const sold=v.kind==="lease"?s.leaseEnd==="buySell":s.loanEnd==="sell";
   $("tax-"+v.kind).hidden=!s.incomeTaxEnabled||!s[v.enabled];
   $(v.deductions).disabled=!s.incomeTaxEnabled||!s[v.enabled];
   $(v.taxValue).disabled=!s.incomeTaxEnabled||!s[v.enabled]||!sold;
   $(v.kind+"TaxValueField").hidden=!sold;
   $(v.kind+"TaxTerm").textContent=s[v.months]+" months"+(sold?" · car sold at the end":" · no car-sale tax in this term");
  }
 }

 function prefillRelated(source){
  const controls=[...$("inputs").querySelectorAll("input[id],select[id]")];
  const sourceIndex=controls.findIndex(control=>control.id===source);
  const sourceValue=parseNumber($(source)?.value);
  if(sourceIndex<0||$(source).value.trim()===""||!Number.isFinite(sourceValue)||sourceValue<0)return;
  const groups=[["downPct","normalDownPct"],["rate","normalRate"],["easyInsurance","normalInsurance","kintoInsurance","cashInsurance"]];
  const suggestions=[];
  for(const group of groups)if(group.includes(source)){
   if(["downPct","rate","normalRate"].includes(source)&&sourceValue>100)return;
   for(const target of group)suggestions.push([target,sourceValue]);
  }
  const filled=[];
  // DOM order follows the setup cards from top to bottom and left to right.
  for(const [target,value] of suggestions){
   const targetIndex=controls.findIndex(control=>control.id===target);
   if(targetIndex<=sourceIndex||$(target).value.trim()!=="")continue;
   $(target).value=formatNumberInput(value);
   const label=document.querySelector('label[for="'+target+'"] .field-title');
   filled.push((label?.textContent||target)+": "+value);
  }
  if(filled.length)$("prefillStatus").textContent="Suggested "+filled.join("; ")+". You can edit these values.";
 }

 function handleInput(event){
  const target=event?.target;
  if(target?.name==="additionalMethod"&&target.checked){
   $("additionalCostMode").value=target.value;
   // Seed once; switching back or shortening ownership never erases the yearly schedule.
   if(target.value==="yearly"&&!JSON.parse($("additionalCostYears").value||"[]").length){
    const raw=readSettings();$("additionalCostYears").value=JSON.stringify(Array(Math.ceil(additionalPeriod(raw)/12)).fill(raw.additionalCostAnnual));
   }
  }
  const raw=readSettings();
  const additionalValues=additionalEditor.editedValues(target,raw.additionalCostYears,raw.additionalCostAnnual);
  if(additionalValues)$("additionalCostYears").value=JSON.stringify(additionalValues);
  if(target?.name==="historicalInflationMethod"&&target.checked){
   $("historicalInflationMode").value=target.value;
   if(target.value==="yearly"&&!raw.historicalInflationYears.length){
    const months=historicalPeriod(raw),count=Math.ceil(months/12);
    // Equal compounded rates reproduce the user's existing total on first opening.
    if(Number.isFinite(count)&&count>0&&count<=100){
     const rate=Number.isFinite(raw.historicalInflationPct)?Math.expm1(Math.log1p(raw.historicalInflationPct/100)*12/months)*100:null;
     $("historicalInflationYears").value=JSON.stringify(Array(count).fill(rate));
    }
   }
  }
  const historicalValues=historicalEditor.editedValues(target,raw.historicalInflationYears,2.5);
  if(historicalValues)$("historicalInflationYears").value=JSON.stringify(historicalValues);


  if(event?.target?.name==="resaleMethod"&&event.target.checked){
   $("resaleMode").value=event.target.value;
   if(event.target.value==="relative"&&!$("relativeResaleSeeded").checked){
    // Suggest historical inputs once; later mode changes retain explicit zeros and blank drafts.
    for(const [target,source] of [["historicalNewPrice","price"],["historicalUsedPrice","resale"]]){
     const current=parseNumber($(target).value),suggested=parseNumber($(source).value);
     if(($(target).value.trim()===""||current===0)&&Number.isFinite(suggested)&&suggested>=0)$(target).value=formatNumberInput(suggested);
    }
    const age=parseNumber($($("pastOwnership").checked||$("historicalMatchPeriod").checked?"months":"historicalMonths").value)/12,inflation=parseNumber($("historicalInflationPct").value);
    if(($("historicalInflationPct").value.trim()===""||inflation===0)&&Number.isFinite(age)&&age>0)$("historicalInflationPct").value=formatNumberInput(2.5*age);
    $("relativeResaleSeeded").checked=true;
   }
  }
  if(["historicalNewPrice","historicalUsedPrice","historicalInflationPct"].includes(event?.target?.id))$("relativeResaleSeeded").checked=true;
  if(event?.type==="change")normalizeReturnInput();
  $("prefillStatus").textContent="";
  if($("matchPeriods").checked){
   for(const v of variants){$(v.months).value=$("months").value;if($("resaleMode").value==="direct")$(v.resale).value=$("resale").value;}
  }
  // Wait for a committed change so typing "5.99" does not copy its first digit.
  if(event?.type==="change")prefillRelated(event.target.id);
  const result=onChange();
  if(target?.name==="additionalMethod"&&target.checked&&target.value==="yearly")additionalEditor.open();
  if(target?.name==="historicalInflationMethod"&&target.checked&&target.value==="yearly")historicalEditor.open();
  return result;
 }
 function initialize(){
  additionalEditor.initialize();historicalEditor.initialize();
  // Editing uses ungrouped text so typing and caret movement stay predictable.
  $("inputs").addEventListener("focusin",event=>{
   if(typeof defaults[event.target.id]==="number"||event.target.type!=="range"&&(event.target.dataset?.additionalYear!==undefined||event.target.dataset?.historicalInflationYear!==undefined))event.target.value=ungroupNumber(event.target.value);
  });
  $("inputs").addEventListener("focusout",event=>{
   if(typeof defaults[event.target.id]==="number"||event.target.type!=="range"&&(event.target.dataset?.additionalYear!==undefined||event.target.dataset?.historicalInflationYear!==undefined))event.target.value=formatNumberInput(event.target.value);
  });
  $("inputs").addEventListener("input",handleInput);
  $("inputs").addEventListener("change",handleInput);
  $("inputs").addEventListener("submit",e=>e.preventDefault());
 }
 return {read,write,readSettings,normalizeReturnInput,updateSelection,prefillRelated,handleInput,initialize};
}
