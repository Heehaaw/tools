import {createTranslator} from "./i18n.mjs";
import {defaults,variants as modelVariants,migrateInputs,monthlyPayment,historicalInflationEntryMode,ownershipInflationRate,ownershipInflationTotal,historicalInflationRate,historicalInflationTotal,relativeResaleEstimate,nominalOpportunityRate} from "./model.mjs";
import {ungroupNumber,parseNumber,formatNumberInput} from "./format.mjs";
import {createYearEditor} from "./year-editor.mjs";

/** Own raw form values, derived controls and forward-only suggestions. */
export function createForm({i18n=createTranslator(),document,views,onChange}){
 const variants=i18n.variants(modelVariants);
 const {t,money,num,ratePercent}=i18n;
 const $=id=>document.getElementById(id);
 // A calculated display must not overwrite an inactive saved input during ordinary renders.
 const loanQuotes=[{kind:"balloon",rate:"rate",down:"downPct"},{kind:"normal",rate:"normalRate",down:"normalDownPct"}];
 const calculatedLoanFields=new Map();
 const calculatedInflationFields=new Map();
 const additionalEditor=createYearEditor({document,i18n,prefix:"additionalYear",dialogId:"additionalCostsDialog",openerId:"editAdditionalYears",closeIds:["closeAdditionalYears","doneAdditionalYears"],datasetKey:"additionalYear",unit:()=>t("ui.kYearInclVat"),staticFields:true,describe:(value,duration)=>money(value*duration/12)+(duration<12?t("setup.12Year",{duration:duration}):t("setup.inThisYear"))});
 const historicalEditor=createYearEditor({document,i18n,prefix:"historicalInflationYear",dialogId:"historicalInflationDialog",openerId:"editHistoricalInflation",closeIds:["closeHistoricalInflation","doneHistoricalInflation"],gridId:"historicalInflationYearGrid",datasetKey:"historicalInflationYear",unit:()=>t("ui.pA"),maxYears:100,baseMax:20,step:.1,limit:100,describe:(value,duration)=>ratePercent(((1+value/100)**(duration/12)-1)*100)+(duration<12?t("setup.12Year",{duration:duration}):t("setup.inThisYear"))});

 const ownershipEditor=createYearEditor({document,i18n,prefix:"ownershipInflationYear",dialogId:"ownershipInflationDialog",openerId:"editOwnershipInflation",closeIds:["closeOwnershipInflation","doneOwnershipInflation"],gridId:"ownershipInflationYearGrid",datasetKey:"ownershipInflationYear",unit:()=>t("ui.pA"),baseMax:20,step:.1,limit:100,describe:(value,duration)=>ratePercent(((1+value/100)**(duration/12)-1)*100)+(duration<12?t("setup.12Year",{duration:duration}):t("setup.inThisYear"))});

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
  $("additionalCostFields").hidden=!s.additionalCostsEnabled;$("additionalCostFields").disabled=!s.additionalCostsEnabled;
  $("additionalCostsEnabled").setAttribute("aria-expanded",String(s.additionalCostsEnabled));
  const yearly=$("additionalCostMode").value==="yearly",raw=readSettings(),months=additionalPeriod(s),count=Math.ceil(months/12);
  $("additionalPeriodSettings").hidden=!s.additionalSeparatePeriod;
  $("additionalCostMonths").disabled=!s.additionalSeparatePeriod;
  $("additionalSeparatePeriod").setAttribute("aria-expanded",String(s.additionalSeparatePeriod));
  $("additionalDialogTitle").textContent=s.pastOwnership?t("setup.actualYearlyAdditionalCosts"):t("ui.estimatedYearlyAdditionalCosts");
  if(!yearly&&$("additionalCostsDialog").open)$("additionalCostsDialog").close();
  $("additionalCostTitle").textContent=s.pastOwnership?t("setup.actualAdditionalCosts"):t("ui.estimatedAdditionalCosts");
  $("additionalAnnualTitle").textContent=s.pastOwnership?t("setup.averageAnnualCosts"):t("ui.annualAllowance");
  $("additionalCostIntro").textContent=s.pastOwnership?t("setup.repairsAndOtherExpensesPaidDuringOwnershipOutside"):t("ui.repairsAndOtherExpensesOutsideScheduledMaintenanceEnter");
  $("additionalModeAnnual").checked=!yearly;$("additionalModeYearly").checked=yearly;
  $("additionalAnnualField").hidden=yearly;$("additionalYearlyFields").hidden=!yearly;$("additionalCostAnnual").disabled=yearly;
  const values=Array.from({length:count},(_,i)=>yearly&&i<raw.additionalCostYears.length?raw.additionalCostYears[i]:raw.additionalCostAnnual);
  additionalEditor.render({months,values,active:yearly&&s.additionalCostsEnabled});
  const total=values.reduce((sum,value,i)=>sum+(Number.isFinite(value)?value*Math.min(12,months-i*12)/12:NaN),0);
  $("additionalCostSummary").textContent=Number.isFinite(total)?t("setup.overMonthsBeforeVatRecovery",{total:money(total),months:months,description3:s.additionalSeparatePeriod?t("setup.costsStopAfterThisPeriodOrAtOwnership"):s.matchPeriods?"":t("setup.shorterOptionsUseOnlyTheirOwnPeriod"),description4:s.leaseAdditionalCosts?t("setup.alsoAppliedToOperatingLease"):t("setup.operatingLeaseExcluded")}):t("setup.completeTheAdditionalCostAmountsToCompareResults");
  $("additionalDialogSummary").textContent=$("additionalCostSummary").textContent;
  $("additionalYearlyTotal").textContent=Number.isFinite(total)?t("setup.totalMonthsInclVat",{total:money(total),months:num(months)}):t("setup.completeTheYearlyCosts");
  $("additionalYearlyTotal").title=t("setup.beforeVatRecoveryInflationAndOpportunityCostShorter");
  $("additionalCostSummary").hidden=yearly;
 }
 function historicalPeriod(s){return (s.pastOwnership?s.pastHistoricalMatchPeriod:s.historicalMatchPeriod)?s.months:s.historicalMonths;}
 function updateHistoricalInflation(s){
  const raw=readSettings(),mode=historicalInflationEntryMode(raw),annual=mode==="annual",yearly=mode==="yearly",main=mode==="main",relative=raw.resaleMode==="relative"&&!(raw.pastOwnership&&raw.pastHistoricalMatchPeriod),months=historicalPeriod(raw);
  $("historicalInflationAnnualMode").checked=annual;$("historicalInflationTotalMode").checked=mode==="total";$("historicalInflationMainMode").checked=main;$("historicalInflationYearlyMode").checked=yearly;
  $("historicalInflationAnnual").disabled=!relative||!annual;$("historicalInflationPct").disabled=!relative||mode!=="total";
  $("historicalInflationTotalUnit").textContent=t("setup.overMonths",{months:num(months)});$("editHistoricalInflation").hidden=!yearly;
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
  const note=months>1200?t("setup.useADirectTotalForPeriodsOver100"):Number.isFinite(total)?t("setup.compoundedTotalOverMonths",{total:ratePercent(total),months:num(months)}):t("setup.completeTheYearRatesAndComparableAgeTo");
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
   const timing=repay<keep?t("setup.repaymentsStopAtMonthInsuranceAndRunningCosts",{repay:repay}):repay>keep?(s.loanEnd==="sell"?t("setup.sellingAtMonthPaysOffTheRemainingPrincipal",{keep:keep}):t("setup.atMonthRemainingDebtReducesTheRetainedCar",{keep:keep})):t("setup.repaymentsEndWhenOwnershipEnds");
   $(v.kind+"LoanTermNote").textContent=Number.isFinite(keep)&&Number.isFinite(repay)?t("setup.keepForMonthsRepayOverMonths",{keep:keep,repay:repay,timing:timing,description4:v.kind==="balloon"&&s.balloonPct>0?t("setup.theBalloonIsDueAtMonthIfThe",{repay:repay}):""}):t("setup.enterOwnershipAndRepaymentPeriodsInWholeMonths");
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
   $(kind+"QuoteNote").textContent=paymentMode?t("setup.interestIsCalculatedFromTheMonthlyPaymentExcluding"):t("setup.monthlyPaymentIsCalculatedFromTheInterestRate",{description1:kind==="balloon"?t("setup.theBalloonIsAdditionalToTheLastInstalment"):t("setup.excludesInsuranceAndFees")});
  }
  $("globalVatFields").hidden=!s.vatEnabled;$("vatSettingsHint").hidden=!s.vatEnabled;
  $("purchaseVatField").hidden=!s.vatEnabled;$("buyoutVatField").hidden=!s.vatEnabled||s.leaseEnd==="return";
  for(const key of ["vatPct","recoveryPct","purchaseVatDelay","purchaseVatCap","purchaseVatEligible","buyoutVatEligible"])$(key).disabled=!s.vatEnabled;
  const pendingNet=$("kintoVatMode").value==="net";
  $("legacyLeaseQuoteNote").hidden=!pendingNet;
  $("legacyLeaseQuoteNote").textContent=pendingNet?t("setup.thisSavedQuoteExcludesVatEnableVatAnd"):"";
  for(const key of ["leaseTaxablePct"]){
   $(key+"Field").hidden=!s.vatEnabled;
   $(key).disabled=!s.vatEnabled||!s.leaseEnabled;
  }
  const relative=s.resaleMode==="relative",past=s.pastOwnership;
  $("ownershipModeNote").textContent=past?t("setup.replayOwnershipFromItsPurchaseDateEnterCosts"):t("setup.planOwnershipStartingTodayUsingCurrentPurchasePrices");
  $("ownershipPeriodTitle").textContent=past?t("setup.ownershipPeriod"):t("ui.comparisonPeriod");
  $("purchasePriceTitle").textContent=past?t("setup.pricePaidAtPurchase"):t("ui.purchasePrice");
  $("directResaleTitle").textContent=past?t("setup.saleRetainedValueAtEnd"):t("ui.expectedCarResale");
  $("derivedResaleTitle").textContent=past?t("setup.modelledEndValue"):t("ui.estimatedFutureResale");
  $("annualInflationTitle").textContent=t("ui.annualAverage");
  const rawInflation=readSettings(),inflationMode=rawInflation.inflationMode,annual=inflationMode==="annual",total=inflationMode==="total",yearly=inflationMode==="yearly";
  $("ownershipInflationOptions").hidden=false;
  $("inflationModeAnnual").checked=annual;$("inflationModeTotal").checked=total;$("inflationModeYearly").checked=yearly;
  $("inflationRate").hidden=false;$("inflationRate").disabled=!annual;
  $("inflationTotalPct").hidden=false;$("inflationTotalPct").disabled=!total;
  $("editOwnershipInflation").hidden=!yearly;
  $("inflationEntryUnit").textContent=t("ui.pA");
  $("inflationTotalUnit").textContent=t("setup.overMonths",{months:num(s.months)});
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
  const inflationSummary=Number.isFinite(cumulative)&&Number.isFinite(annualRate)?t("setup.cumulativeOverMonthsEquivalentAveragePA",{cumulative:ratePercent(cumulative),inflationMonths:num(inflationMonths),annualRate:ratePercent(annualRate)}):t("setup.completeTheInflationInputsAndOwnershipPeriod");
  $("ownershipInflationDialogSummary").textContent=inflationSummary;
  $("help-inflationRate").textContent=t("setup.enterAnAnnualCompoundedAverageACumulativeTotal");
  $("help-relativeResaleValue").textContent=past?t("setup.modelledValueAtTheOwnershipEndIncludingVat"):t("setup.calculatedVatInclusiveValueAtTheEndOf");
  $("help-resale").textContent=past?t("setup.actualSaleProceedsIncludingVatAfterSellingFees"):t("setup.yourExpectedSellingPriceIncludingVatAfterSelling");
  $("historicalPricesHint").textContent=past?t("setup.useTheOriginalPriceAndEndValueOf"):t("ui.theTwoPricesAreInitiallyCopiedFromYour");
  $("relativeMethodHint").textContent=past?t("setup.aLinkedComparablePeriodSharesTheMainInflation"):t("ui.differentOwnershipPeriodsUseTheSameCompoundedAnnual");
  $("timelineHint").textContent=!relative?t("setup.loanBalancesFollowTheRepaymentScheduleValueDots"):past?t("setup.replayTheOwnershipPeriodFromPurchaseToThe"):t("ui.historicalPointsBelongToTheComparableCarThe");
  $("help-resaleMode").textContent=past?t("setup.directResaleUsesTheKnownSaleOrRetained"):t("setup.directModeUsesYourExpectedFutureSellingPrice");
  $("heatmapHint").textContent=past?t("setup.whatIfInflationOrTheAlternativeInvestmentReturn"):t("ui.exploreFutureInflationAgainstAlternativeInvestmentReturnsHistorical");
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
  $("historicalInflationLinkedNote").textContent=t("setup.assumesTheSameAverageInflationAcrossBothPeriods");
  for(const v of variants)$(v.resale).disabled=!s[v.enabled]||s[v.matchPeriod]||relative;
  if(relative){
   // Historical purchasing-power conversions use cumulative inflation, independently of future projections.
   const factor=Number.isFinite(s.historicalInflationPct)&&s.historicalInflationPct>=0?1+s.historicalInflationPct/100:NaN;
   const newPriceToday=s.historicalNewPrice*factor,usedPriceThen=s.historicalUsedPrice/factor;
   $("historicalNewPriceToday").textContent=Number.isFinite(newPriceToday)?t("setup.inTodaySMoney",{newPriceToday:money(newPriceToday)}):"";
   $("historicalUsedPriceThen").textContent=Number.isFinite(usedPriceThen)?t("setup.inPurchaseTimeMoney",{usedPriceThen:money(usedPriceThen)}):"";
   const estimate=relativeResaleEstimate(s);
   const valid=estimate&&Number.isFinite(estimate.nominalValue);
   $("relativeResaleValue").textContent=valid?money(estimate.nominalValue):t("setup.completeTheHistoricalInputs");
   $("relativeResaleToday").textContent=valid?t("setup.months",{value1:money(estimate.todayValue)+(past?t("setup.inPurchaseDateMoney"):t("setup.inTodaySMoney2"))+s.months}):"";
   const previews=variants.filter(v=>s[v.enabled]&&(v.kind!=="lease"||s.leaseEnd!=="return")).map(v=>t("setup.atMonths",{name:v.name,value2:money(s[v.resale]),value3:s[v.months]}));
   $("relativeResaleExplanation").textContent=valid?t("setup.originalPriceInTodaySMoneyRealValue",{historicalPriceToday:money(estimate.historicalPriceToday),historicalMonths:s.historicalMonths,value3:ratePercent(estimate.retainedShare*100),value4:ratePercent(estimate.annualRetention*100),description5:past?t("setup.historicalInflationSuffix"):t("setup.futureInflationSuffix"),description6:ratePercent(past?historicalInflationRate(s):s.inflationRate),description7:s.matchPeriods?"":previews.join(" · ")}):t("setup.enterTheHistoricalNewPriceTodaySUsed");
  }
  updateHistoricalInflation(s);
  $("months").disabled=false;
  const pendingReturn=s.opportunityRateBasis==="real";
  $("opportunityRate").disabled=pendingReturn;
  $("opportunityRateUnit").textContent=pendingReturn?t("setup.savedAfterTaxAfterInflationRate"):t("ui.pAAfterTaxBeforeInflation");
  const realReturn=Number.isFinite(s.opportunityRate)&&Number.isFinite(s.inflationRate)&&s.opportunityRate>=0&&s.inflationRate>=0?(pendingReturn?s.opportunityRate:((1+s.opportunityRate/100)/(1+s.inflationRate/100)-1)*100):NaN;
  $("realReturnDescription").textContent=Number.isFinite(realReturn)?t("setup.effectiveReturnAfterInflationPAAfterTax",{realReturn:ratePercent(realReturn)}):t("setup.enterReturnAndInflationToSeeTheEffective");
  $("returnMigration").hidden=!pendingReturn;
  $("returnMigration").textContent=pendingReturn?t("setup.thisSavedReturnIsAfterInflationFinishEntering"):"";
  $("incomeTaxSettings").hidden=!s.incomeTaxEnabled;
  $("incomeTaxEnabled").setAttribute("aria-expanded",String(s.incomeTaxEnabled));
  $("incomeTaxRate").disabled=!s.incomeTaxEnabled;
  $("matchSaleTaxRate").disabled=!s.incomeTaxEnabled;
  $("saleTaxRateField").hidden=s.matchSaleTaxRate;
  $("saleTaxRate").disabled=!s.incomeTaxEnabled||s.matchSaleTaxRate;
  $("saleTaxRateNote").textContent=t("setup.rateOnTaxableCarSaleIncomeVatIs",{saleTaxRate:ratePercent(s.saleTaxRate)});
  for(const v of variants){
   const sold=v.kind==="lease"?s.leaseEnd==="buySell":s.loanEnd==="sell";
   $("tax-"+v.kind).hidden=!s.incomeTaxEnabled||!s[v.enabled];
   $(v.deductions).disabled=!s.incomeTaxEnabled||!s[v.enabled];
   $(v.taxValue).disabled=!s.incomeTaxEnabled||!s[v.enabled]||!sold;
   $(v.kind+"TaxValueField").hidden=!sold;
   $(v.kind+"TaxTerm").textContent=t("setup.months2",{period:t("common.months",{count:s[v.months]}),description2:sold?t("setup.carSoldAtTheEnd"):t("setup.noCarSaleTaxInThisTerm")});
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
  if(filled.length)$("prefillStatus").textContent=t("setup.suggestedYouCanEditTheseValues",{value1:filled.join("; ")});
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
