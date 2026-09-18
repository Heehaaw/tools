import {defaults,variants,migrateInputs,monthlyPayment,historicalInflationEntryMode,ownershipInflationRate,ownershipInflationTotal,historicalInflationRate,historicalInflationTotal,relativeResaleEstimate,nominalOpportunityRate} from "./model.mjs";
import {money,num,ratePercent,ungroupNumber,parseNumber,formatNumberInput} from "./format.mjs";
import {createYearEditor} from "./year-editor.mjs";

/** Own raw form values, derived controls and forward-only suggestions. */
export function createForm({document,views,onChange}){
 const $=id=>document.getElementById(id);
 const {applyTimeLabels}=views;
 // A calculated display must not overwrite an inactive saved input during ordinary renders.
 const loanQuotes=[{kind:"balloon",rate:"rate",down:"downPct"},{kind:"normal",rate:"normalRate",down:"normalDownPct"}];
 const calculatedLoanFields=new Map();
 const calculatedInflationFields=new Map();
 const additionalEditor=createYearEditor({document,prefix:"additionalYear",dialogId:"additionalCostsDialog",openerId:"editAdditionalYears",closeIds:["closeAdditionalYears","doneAdditionalYears"],datasetKey:"additionalYear",unit:"Kč / year incl. VAT",staticFields:true,describe:(value,duration)=>money(value*duration/12)+(duration<12?" · "+duration+"/12 year":" in this year")});
 const historicalEditor=createYearEditor({document,prefix:"historicalInflationYear",dialogId:"historicalInflationDialog",openerId:"editHistoricalInflation",closeIds:["closeHistoricalInflation","doneHistoricalInflation"],gridId:"historicalInflationYearGrid",datasetKey:"historicalInflationYear",unit:"% p.a.",maxYears:100,baseMax:20,step:.1,limit:100,describe:(value,duration)=>ratePercent(((1+value/100)**(duration/12)-1)*100)+(duration<12?" · "+duration+"/12 year":" in this year")});

 const ownershipEditor=createYearEditor({document,prefix:"ownershipInflationYear",dialogId:"ownershipInflationDialog",openerId:"editOwnershipInflation",closeIds:["closeOwnershipInflation","doneOwnershipInflation"],gridId:"ownershipInflationYearGrid",datasetKey:"ownershipInflationYear",unit:"% p.a.",baseMax:20,step:.1,limit:100,describe:(value,duration)=>ratePercent(((1+value/100)**(duration/12)-1)*100)+(duration<12?" · "+duration+"/12 year":" in this year")});

 function read(){
  const state=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,Array.isArray(v)?JSON.parse($(k).value||"[]"):typeof v==="boolean"?$(k).checked:typeof v==="number"?($(k).value.trim()===""?NaN:parseNumber($(k).value)):$(k).value]));
  for(const {key,raw} of [...calculatedLoanFields.values(),...calculatedInflationFields.values()])state[key]=raw===null?NaN:raw;
  // Hidden, unused charges are zero for calculation, but stay blank in saved drafts.
  if(state.leaseEnd==="return"&&$("leaseBuyout").value.trim()==="")state.leaseBuyout=0;
  if(state.kintoInsuranceIncluded&&$("kintoInsurance").value.trim()==="")state.kintoInsurance=0;
  return state;
 }

 function normalizeReturnInput(){
  if($("opportunityRateBasis").value!=="real")return;
  const rate=$("opportunityRate").value.trim();
  // A blank rate has no value to convert. Incomplete legacy real-rate drafts keep their basis until inflation is known.
  if(!rate){$("opportunityRateBasis").value="nominal";return;}
  if(!Number.isFinite(parseNumber(rate)))return;
  const inflationRate=ownershipInflationRate(read());
  if(!Number.isFinite(inflationRate))return;
  const nominal=nominalOpportunityRate({opportunityRateBasis:"real",opportunityRate:parseNumber(rate),inflationRate});
  $("opportunityRate").value=formatNumberInput(Number(nominal.toFixed(10)));
  $("opportunityRateBasis").value="nominal";
 }

 function write(s){
  s=migrateInputs(s);
  calculatedLoanFields.clear();calculatedInflationFields.clear();
  additionalEditor.close();historicalEditor.close();ownershipEditor.close();
  $("prefillStatus").textContent="";
  for(const [k,v] of Object.entries(s)){if(Array.isArray(v))$(k).value=JSON.stringify(v);else if(typeof v==="boolean")$(k).checked=v;else $(k).value=v===null?"":typeof v==="number"?formatNumberInput(v):v;}
  normalizeReturnInput();
 }

 function readSettings(){
  const rawCalculated=new Map([...calculatedLoanFields.values(),...calculatedInflationFields.values()].map(({key,raw})=>[key,raw]));
  return Object.fromEntries(Object.entries(read()).map(([key,value])=>[key,rawCalculated.has(key)?rawCalculated.get(key):typeof defaults[key]==="number"&&$(key).value.trim()===""?null:value]));
 }

 function additionalPeriod(s){
  const periods=variants.filter(v=>s[v.enabled]&&(v.kind!=="lease"||s.leaseAdditionalCosts)).map(v=>s[v.matchPeriod]?s.months:s[v.months]);
  const months=s.additionalSeparatePeriod?s.additionalCostMonths:Math.max(...(periods.length?periods:[s.months]));
  return Number.isFinite(months)?Math.max(1,Math.min(120,months)):s.months||12;
 }
 function updateAdditionalCosts(s){
  const yearly=$("additionalCostMode").value==="yearly",raw=readSettings(),months=additionalPeriod(s),count=Math.ceil(months/12);
  $("additionalPeriodSettings").hidden=!s.additionalSeparatePeriod;
  $("additionalCostMonths").disabled=!s.additionalSeparatePeriod;
  $("additionalSeparatePeriod").setAttribute("aria-expanded",String(s.additionalSeparatePeriod));
  $("additionalDialogTitle").textContent=s.pastOwnership?"Actual yearly additional costs":"Estimated yearly additional costs";
  if(!yearly&&$("additionalCostsDialog").open)$("additionalCostsDialog").close();
  $("additionalCostTitle").textContent=s.pastOwnership?"Actual additional costs":"Estimated additional costs";
  $("additionalAnnualTitle").textContent=s.pastOwnership?"Average annual costs":"Annual allowance";
  $("additionalCostIntro").textContent=s.pastOwnership?"Repairs and other expenses paid during ownership, outside scheduled maintenance. Use the year-by-year view to approximate their timing; payments are placed at each year end or the earlier cutoff.":"Repairs and other expenses outside scheduled maintenance. Enter amounts not already included elsewhere.";
  $("additionalModeAnnual").checked=!yearly;$("additionalModeYearly").checked=yearly;
  $("additionalAnnualField").hidden=yearly;$("additionalYearlyFields").hidden=!yearly;$("additionalCostAnnual").disabled=yearly;
  const values=Array.from({length:count},(_,i)=>yearly&&i<raw.additionalCostYears.length?raw.additionalCostYears[i]:raw.additionalCostAnnual);
  additionalEditor.render({months,values,active:yearly});
  const total=values.reduce((sum,value,i)=>sum+(Number.isFinite(value)?value*Math.min(12,months-i*12)/12:NaN),0);
  $("additionalCostSummary").textContent=Number.isFinite(total)?money(total)+" over "+months+" months before VAT recovery. "+(s.additionalSeparatePeriod?"Costs stop after this period or at ownership end, whichever comes first. ":s.matchPeriods?"":"Shorter options use only their own period. ")+(s.leaseAdditionalCosts?"Also applied to operating lease.":"Operating lease excluded."):"Complete the additional cost amounts to compare results.";
  $("additionalDialogSummary").textContent=$("additionalCostSummary").textContent;
  $("additionalYearlyTotal").textContent=Number.isFinite(total)?"Total: "+money(total)+" · "+num(months)+" months, incl. VAT":"Complete the yearly costs";
  $("additionalYearlyTotal").title="Before VAT recovery, inflation and opportunity cost. Shorter options use only their own ownership period.";
  $("additionalCostSummary").hidden=yearly;
 }
 function historicalPeriod(s){return (s.pastOwnership?s.pastHistoricalMatchPeriod:s.historicalMatchPeriod)?s.months:s.historicalMonths;}
 function updateHistoricalInflation(s){
  const raw=readSettings(),mode=historicalInflationEntryMode(raw),annual=mode==="annual",yearly=mode==="yearly",main=mode==="main",relative=raw.resaleMode==="relative"&&!(raw.pastOwnership&&raw.pastHistoricalMatchPeriod),months=historicalPeriod(raw);
  $("historicalInflationAnnualMode").checked=annual;$("historicalInflationTotalMode").checked=mode==="total";$("historicalInflationMainMode").checked=main;$("historicalInflationYearlyMode").checked=yearly;
  $("historicalInflationAnnual").disabled=!relative||!annual;$("historicalInflationPct").disabled=!relative||mode!=="total";
  $("historicalInflationTotalUnit").textContent="% over "+num(months)+" months";$("editHistoricalInflation").hidden=!yearly;
  const count=Number.isFinite(months)&&months>0?Math.min(100,Math.ceil(months/12)):0;
  const values=Array.from({length:count},(_,i)=>i<raw.historicalInflationYears.length?raw.historicalInflationYears[i]:2.5);
  historicalEditor.render({months,values,active:relative&&yearly});
  const total=historicalInflationTotal(raw),rate=historicalInflationRate(raw);
  // Calculated displays must not replace inactive historical inputs in saved scenarios.
  for(const [key,derived,value] of [["historicalInflationAnnual",!annual,rate],["historicalInflationPct",mode!=="total",total]]){
   if(derived){
    if(!calculatedInflationFields.has(key))calculatedInflationFields.set(key,{key,raw:raw[key]});
    $(key).value=Number.isFinite(value)?formatNumberInput(Number(value.toFixed(8))):"";
   }else if(calculatedInflationFields.has(key)){
    const {raw}=calculatedInflationFields.get(key);$(key).value=raw===null?"":formatNumberInput(raw);
    calculatedInflationFields.delete(key);
   }
  }
  const note=months>1200?"Use a direct total for periods over 100 years.":Number.isFinite(total)?"Compounded total: "+ratePercent(total)+" over "+num(months)+" months.":"Complete the year rates and comparable age to calculate cumulative inflation.";
  $("historicalInflationDialogSummary").textContent=note;
 }
 function updateSelection(s){
  updateAdditionalCosts(s);
  const visibleKinds=new Set(variants.filter(v=>s[v.enabled]).map(v=>v.kind));
  for(const element of document.querySelectorAll("#comparison thead [data-option],#comparison .total[data-option],.option-legend [data-option]"))element.hidden=!visibleKinds.has(element.dataset.option);
  for(const v of variants){
   const panel=document.querySelector('.option-panel[data-option="'+v.kind+'"]');
   if(panel)panel.dataset.excluded=String(!s[v.enabled]);
   for(const control of panel?.querySelectorAll("input,select")||[])if(control.id!==v.enabled)control.disabled=!s[v.enabled];
  }
  for(const v of variants){
   const separate=!s[v.matchPeriod];
   $(v.kind+"SeparatePeriod").checked=separate;$(v.kind+"SeparatePeriod").disabled=!s[v.enabled];
   $(v.kind+"SeparatePeriod").setAttribute("aria-expanded",String(separate));
   $(v.kind+"PeriodSettings").hidden=!separate;
   $(v.months).disabled=!s[v.enabled]||!separate;
   $(v.kind+"ResaleField").hidden=s.resaleMode==="relative"||(v.kind==="lease"&&s.leaseEnd==="return");
  }
  for(const v of variants.filter(v=>v.loanMonths)){
   $(v.kind+"SeparateRepayment").checked=!s[v.matchLoanTerm];$(v.kind+"SeparateRepayment").disabled=!s[v.enabled];
   $(v.kind+"RepaymentSettings").hidden=s[v.matchLoanTerm];
   $(v.kind+"SeparateRepayment").setAttribute("aria-expanded",String(!s[v.matchLoanTerm]));
   $(v.loanMonths).disabled=!s[v.enabled]||s[v.matchLoanTerm];
   const keep=s[v.months],repay=s[v.loanMonths];
   const timing=repay<keep?"Repayments stop at month "+repay+"; insurance and running costs continue.":repay>keep?(s.loanEnd==="sell"?"Selling at month "+keep+" pays off the remaining principal. Add any settlement fee to Other loan costs.":"At month "+keep+", remaining debt reduces the retained car value. Later payments and interest are outside this comparison."):"Repayments end when ownership ends.";
   $(v.kind+"LoanTermNote").textContent=Number.isFinite(keep)&&Number.isFinite(repay)?"Keep for "+keep+" months · repay over "+repay+" months. "+timing+(v.kind==="balloon"&&s.balloonPct>0?" The balloon is due at month "+repay+" if the loan reaches maturity.":""):"Enter ownership and repayment periods in whole months.";
  }
  for(const {kind,rate,down} of loanQuotes){
   const paymentMode=$(kind+"InputMode").value==="payment",payment=kind+"MonthlyPayment",enabled=s[kind+"Enabled"];
   $(kind+"ModeRate").checked=!paymentMode;$(kind+"ModePayment").checked=paymentMode;
   $(kind+"RateField").hidden=false;$(kind+"PaymentField").hidden=false;
   $(rate).disabled=!enabled||paymentMode;$(payment).disabled=!enabled||!paymentMode;
   const derivedKey=paymentMode?rate:payment;
   if(calculatedLoanFields.get(kind)?.key!==derivedKey)calculatedLoanFields.set(kind,{key:derivedKey,raw:readSettings()[derivedKey]});
   const balloon=kind==="balloon"?s.price*s.balloonPct/100:0;
   const derived=paymentMode?s[rate]:monthlyPayment(s.price*(1-s[down]/100),balloon,s[rate],s[kind+"LoanMonths"]);
   $(derivedKey).value=Number.isFinite(derived)?formatNumberInput(Number(derived.toFixed(paymentMode?4:2))):"";
   $(kind+"QuoteNote").textContent=paymentMode?"Interest is calculated from the monthly payment, excluding insurance and fees.":"Monthly payment is calculated from the interest rate."+(kind==="balloon"?" The balloon is additional to the last instalment.":" Excludes insurance and fees.");
  }
  $("globalVatFields").hidden=!s.vatEnabled;$("vatSettingsHint").hidden=!s.vatEnabled;
  $("purchaseVatField").hidden=!s.vatEnabled;$("buyoutVatField").hidden=!s.vatEnabled||s.leaseEnd==="return";
  for(const key of ["vatPct","recoveryPct","purchaseVatDelay","purchaseVatCap","purchaseVatEligible","buyoutVatEligible"])$(key).disabled=!s.vatEnabled;
  const pendingNet=$("kintoVatMode").value==="net";
  $("legacyLeaseQuoteNote").hidden=!pendingNet;
  $("legacyLeaseQuoteNote").textContent=pendingNet?"This saved quote excludes VAT. Enable VAT and enter its rate in the global settings to convert the quote to an inclusive amount.":"";
  for(const key of ["leaseTaxablePct"]){
   $(key+"Field").hidden=!s.vatEnabled;
   $(key).disabled=!s.vatEnabled||!s.leaseEnabled;
  }
  const relative=s.resaleMode==="relative",past=s.pastOwnership;
  $("ownershipModeNote").textContent=past?"Replay ownership from its purchase date. Enter costs and finance terms from that period. Inflation-adjusted results use purchase-date money.":"Plan ownership starting today, using current purchase prices and future resale estimates.";
  $("ownershipPeriodTitle").textContent=past?"Ownership period":"Comparison period";
  $("purchasePriceTitle").textContent=past?"Price paid at purchase":"Purchase price";
  $("directResaleTitle").textContent=past?"Sale / retained value at end":"Expected car resale";
  $("derivedResaleTitle").textContent=past?"Modelled end value":"Estimated future resale";
  $("annualInflationTitle").textContent="Annual average";
  const rawInflation=readSettings(),inflationMode=rawInflation.inflationMode,annual=inflationMode==="annual",total=inflationMode==="total",yearly=inflationMode==="yearly";
  $("ownershipInflationOptions").hidden=false;
  $("inflationModeAnnual").checked=annual;$("inflationModeTotal").checked=total;$("inflationModeYearly").checked=yearly;
  $("inflationRate").hidden=false;$("inflationRate").disabled=!annual;
  $("inflationTotalPct").hidden=false;$("inflationTotalPct").disabled=!total;
  $("editOwnershipInflation").hidden=!yearly;
  $("inflationEntryUnit").textContent="% p.a.";
  $("inflationTotalUnit").textContent="% over "+num(s.months)+" months";
  const inflationMonths=rawInflation.months,count=Number.isFinite(inflationMonths)&&inflationMonths>0?Math.min(10,Math.ceil(inflationMonths/12)):0;
  const inflationValues=Array.from({length:count},(_,i)=>i<rawInflation.inflationYears.length?rawInflation.inflationYears[i]:2.5);
  ownershipEditor.render({months:inflationMonths,values:inflationValues,active:yearly});
  const cumulative=ownershipInflationTotal(rawInflation),annualRate=ownershipInflationRate(rawInflation);
  // Cache inactive raw inputs separately from the calculated numbers shown in their fields.
  for(const [key,derived,value] of [["inflationRate",!annual,annualRate],["inflationTotalPct",!total,cumulative]]){
   if(derived){
    if(!calculatedInflationFields.has(key))calculatedInflationFields.set(key,{key,raw:rawInflation[key]});
    $(key).value=Number.isFinite(value)?formatNumberInput(Number(value.toFixed(8))):"";
   }else if(calculatedInflationFields.has(key)){
    const {raw}=calculatedInflationFields.get(key);$(key).value=raw===null?"":formatNumberInput(raw);
    calculatedInflationFields.delete(key);
   }
  }
  const inflationSummary=Number.isFinite(cumulative)&&Number.isFinite(annualRate)?"Cumulative: "+ratePercent(cumulative)+" over "+num(inflationMonths)+" months · equivalent average: "+ratePercent(annualRate)+" p.a.":"Complete the inflation inputs and ownership period.";
  $("ownershipInflationDialogSummary").textContent=inflationSummary;
  $("help-inflationRate").textContent="Enter an annual compounded average, a cumulative total over the comparison period, or annual rates in the yearly dialog. Annual rates compound rather than add; partial years are prorated using a fractional power. All modes resolve to one equivalent annual rate for money values and different option lengths, not a varying year-by-year purchasing-power path. The selected field is editable and the other is calculated; yearly mode calculates both. Selecting a calculated field promotes its displayed value to the new input. The yearly schedule is preserved. Past ownership uses this same inflation for relative depreciation: matched ages share its total, while a separate comparable age can use this annual equivalent or its own inflation inputs. Direct resale remains unchanged.";
  $("help-relativeResaleValue").textContent=past?"Modelled value at the ownership end, including VAT. Matching the original price, historical age and inflation reproduces the known used value. The smaller value uses purchasing power at purchase. Different prices or periods are scaled estimates.":"Calculated VAT-inclusive value at the end of the comparison period. The model applies the comparable car’s real depreciation to today’s purchase price, then adds estimated annual inflation. Separate periods get their own projected resale.";
  $("help-resale").textContent=past?"Actual sale proceeds including VAT, after selling fees, or the retained market value at the ownership end. This reduces ownership cost. Winter tyres are counted separately.":"Your expected selling price including VAT, after selling fees. This reduces ownership cost. If kept, it is estimated retained value. Winter tyres are counted separately.";
  $("historicalPricesHint").textContent=past?"Use the original price and end value of the historical car. Set Price paid at purchase above to the same original price, with matching age and inflation, to replay that car exactly. By default, its age and inflation come from Period and assumptions. Enable Use a separate period below to enter another comparable age and choose its inflation source. Other purchase prices or individual option periods model a scaled comparison.":"The two prices are initially copied from your purchase and direct resale estimates as starting suggestions. Replace them with a comparable car’s actual original new price and its used resale value today. The purchase price above is the new car’s price today. Enter actual prices on the same VAT basis and use comparable trim, condition and mileage.";
  $("relativeMethodHint").textContent=past?"A linked comparable period shares the main inflation setting. A separate comparable period can use independent inflation or the main average. Matching the original purchase price, comparable age and inflation reproduces the entered end value. Other periods use a constant compounded depreciation rate; they are estimates, not observed sale prices.":"Different ownership periods use the same compounded annual real depreciation rate. This is a simple extrapolation, not a forecast of market prices. Choose comparable mileage yourself; mileage does not adjust resale automatically. Future nominal resale uses the annual inflation estimate above, even when the results’ today’s-money switches are off.";
  $("timelineHint").textContent=!relative?"Loan balances follow the repayment schedule. Value dots show the purchase price and entered end value, with no assumed path between them. Choose Relative depreciation for an estimated value curve.":past?"Replay the ownership period from purchase to the end value. Solid and dashed lines show nominal value and purchasing power at purchase. The curve assumes constant compounded depreciation, not measured price history. Values include VAT, before settlement of VAT, sale taxes or remaining debt.":"Historical points belong to the comparable car; the shaded future belongs to the new car bought today. The dashed historical line only connects your two inputs, it is not a measured price history. Future solid and dashed lines show nominal resale and purchasing power today. Coloured vertical lines mark each selected option’s end month. Values include VAT, before VAT settlement, sale taxes or remaining debt. Both money bases are always shown; investment returns do not change the car’s market value.";
  $("help-resaleMode").textContent=past?"Direct resale uses the known sale or retained value unchanged. Relative depreciation replays the historical value change; matching the original price, age and inflation reproduces the known end value. Other prices or periods remain modelled comparisons. Inactive inputs are preserved.":"Direct mode uses your expected future selling price as entered. Relative depreciation estimates future resale from a comparable car’s historical prices, age and inflation. Switching methods preserves inactive inputs.";
  $("heatmapHint").textContent=past?"What if inflation or the alternative investment return had differed? Known or modelled end values, quotes and running costs stay fixed. This is sensitivity analysis, not a reconstruction of actual inflation. Compare per year divides each option’s cost by its own ownership years; switch it off to compare full-term costs. With opportunity cost off, investment return has no effect. Cells are sampled scenarios, not exact break-even boundaries. Hover, tap or use arrow keys to compare all selected options.":"Explore future inflation against alternative investment returns. Historical prices, finance quotes and running costs stay fixed. Relative mode recalculates future nominal resale. Independently entered historical inflation stays fixed; Use main annual average follows the tested inflation rate. Direct resale values stay fixed. Compare per year divides each option’s cost by its own ownership years; switch it off to compare full-term costs. With opportunity cost off, investment return has no effect. Cells are sampled scenarios, not exact break-even boundaries. Hover, tap or use arrow keys to compare all selected options.";
  $("resaleMode-direct").checked=!relative;$("resaleMode-relative").checked=relative;
  $("directResaleField").hidden=relative;$("resale").disabled=relative;
  $("relativeResaleSettings").hidden=!relative;$("relativeResaleOutput").hidden=!relative;$("relativeResaleExplanation").hidden=!relative;
  for(const key of ["historicalNewPrice","historicalUsedPrice","historicalInflationPct"])$(key).disabled=!relative;
  const historicalMatched=past?s.pastHistoricalMatchPeriod:s.historicalMatchPeriod;
  $("historicalSeparatePeriod").checked=!historicalMatched;
  $("historicalSeparatePeriod").disabled=!relative;
  $("historicalSeparatePeriod").setAttribute("aria-expanded",String(!historicalMatched));
  $("historicalPeriodSettings").hidden=historicalMatched;
  $("historicalMonths").disabled=!relative||historicalMatched;
  $("historicalInflationSection").hidden=past&&historicalMatched;
  $("historicalInflationLinkedNote").hidden=past&&historicalMatched||historicalInflationEntryMode(readSettings())!=="main";
  $("historicalInflationLinkedNote").textContent="Assumes the same average inflation across both periods. Cumulative inflation is calculated over the comparable car’s age; it is an estimate, not separate historical data.";
  for(const v of variants)$(v.resale).disabled=!s[v.enabled]||s[v.matchPeriod]||relative;
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
   $("relativeResaleExplanation").textContent=valid?"Original price in today’s money: "+money(estimate.historicalPriceToday)+". Real value retained after "+s.historicalMonths+" months: "+ratePercent(estimate.retainedShare*100)+". Annual real value retained: "+ratePercent(estimate.annualRetention*100)+(past?". Annualised historical inflation: ":". Future inflation: ")+ratePercent(past?historicalInflationRate(s):s.inflationRate)+" p.a. "+(s.matchPeriods?"":previews.join(" · ")):"Enter the historical new price, today’s used value, age and cumulative inflation to calculate resale. No historical market prices are supplied.";
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
   if(targetIndex<=sourceIndex||$(target).disabled||$(target).value.trim()!=="")continue;
   $(target).value=formatNumberInput(value);
   const label=document.querySelector('label[for="'+target+'"] .field-title');
   filled.push((label?.textContent||target)+": "+value);
  }
  if(filled.length)$("prefillStatus").textContent="Suggested "+filled.join("; ")+". You can edit these values.";
 }

 function handleInput(event){
  const target=event?.target;
  for(const v of variants){
   if(target?.id===v.kind+"SeparatePeriod")$(v.matchPeriod).checked=!target.checked;
   if(v.matchLoanTerm&&target?.id===v.kind+"SeparateRepayment")$(v.matchLoanTerm).checked=!target.checked;
  }
  if(target?.id==="historicalSeparatePeriod")$($("pastOwnership").checked?"pastHistoricalMatchPeriod":"historicalMatchPeriod").checked=!target.checked;

  for(const {kind} of loanQuotes)if(target?.name===kind+"QuoteMethod"&&target.checked&&target.value!==$(kind+"InputMode").value){
   // Choosing the other source promotes its displayed result to an editable quote.
   calculatedLoanFields.delete(kind);
   $(kind+"InputMode").value=target.value;
  }
  if(target?.name==="additionalMethod"&&target.checked){
   $("additionalCostMode").value=target.value;
   // Seed once; switching back or shortening ownership never erases the yearly schedule.
   if(target.value==="yearly"&&!JSON.parse($("additionalCostYears").value||"[]").length){
    const raw=readSettings();$("additionalCostYears").value=JSON.stringify(Array(Math.ceil(additionalPeriod(raw)/12)).fill(raw.additionalCostAnnual));
   }
  }
  if(target?.name==="ownershipInflationMethod"&&target.checked){
   const before=readSettings(),rate=ownershipInflationRate(before);
   // Explicitly choosing a calculated field makes its displayed result the new input.
   if(target.value!==before.inflationMode&&target.value!=="yearly"){
    calculatedInflationFields.delete(target.value==="annual"?"inflationRate":"inflationTotalPct");
    if(target.value==="total")$("inflationTotalSeeded").checked=true;
   }
   if(target.value==="yearly"&&!before.inflationYears.length){
    const count=Number.isFinite(before.months)&&before.months>0?Math.min(10,Math.ceil(before.months/12)):0;
    $("inflationYears").value=JSON.stringify(Array(count).fill(Number.isFinite(rate)?rate:null));
   }
   $("inflationMode").value=target.value;
  }
  if(target?.id==="inflationTotalPct")$("inflationTotalSeeded").checked=true;
  // Wait for the completed VAT rate; typing its first digit must not fix the invoice basis.
  if(event?.type==="change"&&$("kintoVatMode").value==="net"){
   const migrated=migrateInputs(readSettings());
   if(migrated.kintoVatMode==="gross"){$("kintoVatMode").value="gross";$("kintoMonthly").value=migrated.kintoMonthly===null?"":formatNumberInput(migrated.kintoMonthly);}
  }
  const raw=readSettings();
  const inflationValues=ownershipEditor.editedValues(target,raw.inflationYears,2.5);
  if(inflationValues)$("inflationYears").value=JSON.stringify(inflationValues);
  const additionalValues=additionalEditor.editedValues(target,raw.additionalCostYears,raw.additionalCostAnnual);
  if(additionalValues)$("additionalCostYears").value=JSON.stringify(additionalValues);
  if(target?.name==="historicalInflationMethod"&&target.checked){
   const mode=historicalInflationEntryMode(raw);
   if(target.value!==mode&&["annual","total"].includes(target.value))calculatedInflationFields.delete(target.value==="annual"?"historicalInflationAnnual":"historicalInflationPct");
   $(raw.pastOwnership?"pastHistoricalInflationMode":"historicalInflationMode").value=target.value;
   if(target.value==="yearly"&&!raw.historicalInflationYears.length){
    const months=historicalPeriod(raw),count=Math.ceil(months/12);
    // Equal compounded rates reproduce the user's existing total on first opening.
    if(Number.isFinite(count)&&count>0&&count<=100){
     const resolved=historicalInflationRate(raw),rate=Number.isFinite(resolved)?resolved:null;
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
    if(!$("pastOwnership").checked&&$("historicalInflationMode").value==="total"&&($("historicalInflationPct").value.trim()===""||inflation===0)&&Number.isFinite(age)&&age>0)$("historicalInflationPct").value=formatNumberInput(2.5*age);
    $("relativeResaleSeeded").checked=true;
   }
  }
  if(["historicalNewPrice","historicalUsedPrice","historicalInflationPct","historicalInflationAnnual"].includes(event?.target?.id))$("relativeResaleSeeded").checked=true;
  if(event?.type==="change")normalizeReturnInput();
  $("prefillStatus").textContent="";
  // Wait for a committed change so typing "5.99" does not copy its first digit.
  if(event?.type==="change")prefillRelated(event.target.id);
  const result=onChange();
  if(target?.name==="additionalMethod"&&target.checked&&target.value==="yearly")additionalEditor.open();
  if(target?.name==="historicalInflationMethod"&&target.checked&&target.value==="yearly")historicalEditor.open();
  if(target?.name==="ownershipInflationMethod"&&target.checked&&target.value==="yearly")ownershipEditor.open();
  return result;
 }
 function initialize(){
  additionalEditor.initialize();historicalEditor.initialize();ownershipEditor.initialize();
  // Editing uses ungrouped text so typing and caret movement stay predictable.
  $("inputs").addEventListener("focusin",event=>{
   if(typeof defaults[event.target.id]==="number"||event.target.type!=="range"&&(event.target.dataset?.additionalYear!==undefined||event.target.dataset?.historicalInflationYear!==undefined||event.target.dataset?.ownershipInflationYear!==undefined))event.target.value=ungroupNumber(event.target.value);
  });
  $("inputs").addEventListener("focusout",event=>{
   if(typeof defaults[event.target.id]==="number"||event.target.type!=="range"&&(event.target.dataset?.additionalYear!==undefined||event.target.dataset?.historicalInflationYear!==undefined||event.target.dataset?.ownershipInflationYear!==undefined))event.target.value=formatNumberInput(event.target.value);
  });
  $("inputs").addEventListener("input",handleInput);
  $("inputs").addEventListener("change",handleInput);
  $("inputs").addEventListener("submit",e=>e.preventDefault());
 }
 return {read,write,readSettings,normalizeReturnInput,updateSelection,prefillRelated,handleInput,initialize};
}
