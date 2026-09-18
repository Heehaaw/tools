
// --- Input schema and compatibility ---
export const variants = [
 {key:"balloonLoan",kind:"balloon",deductions:"balloonDeductions",taxValue:"balloonTaxValue",name:"Balloon loan",enabled:"balloonEnabled",months:"balloonMonths",matchPeriod:"balloonMatchPeriod",loanMonths:"balloonLoanMonths",matchLoanTerm:"balloonMatchOwnership",resale:"balloonResale",fields:["downPct","balloonPct","rate","easyInsurance","easyExtra"]},
 {key:"standardLoan",kind:"normal",deductions:"normalDeductions",taxValue:"normalTaxValue",name:"Standard loan",enabled:"normalEnabled",months:"normalMonths",matchPeriod:"normalMatchPeriod",loanMonths:"normalLoanMonths",matchLoanTerm:"normalMatchOwnership",resale:"normalResale",fields:["normalDownPct","normalRate","normalInsurance","normalExtra"]},
 {key:"lease",kind:"lease",deductions:"leaseDeductions",taxValue:"leaseTaxValue",name:"Operating lease",enabled:"leaseEnabled",months:"leaseMonths",matchPeriod:"leaseMatchPeriod",resale:"leaseResale",fields:["kintoMonthly","kintoInitial","kintoInsurance","kintoExtra","leaseBuyout"]},
 {key:"cashPurchase",kind:"cash",deductions:"cashDeductions",taxValue:"cashTaxValue",name:"Buy outright",enabled:"cashEnabled",months:"cashMonths",matchPeriod:"cashMatchPeriod",resale:"cashResale",fields:["cashInsurance","cashExtra"]}
];
export const defaults = {
 inflationSetup:"shared-v1",legacyInflationInputs:"",pastOwnership:false,resaleMode:"direct",relativeResaleSeeded:false,historicalNewPrice:0,historicalUsedPrice:0,historicalYears:3,historicalMonths:36,historicalMatchPeriod:true,historicalInflationMode:"total",pastHistoricalInflationMode:"main",historicalInflationAnnual:2.5,historicalInflationPct:0,historicalInflationYears:[],
 incomeTaxEnabled:false,incomeTaxRate:0,saleTaxRate:0,matchSaleTaxRate:true,
 balloonDeductions:0,normalDeductions:0,leaseDeductions:0,cashDeductions:0,
 balloonTaxValue:0,normalTaxValue:0,leaseTaxValue:0,cashTaxValue:0,
 opportunityRateBasis:"nominal",inflationRate:2.5,inflationMode:"annual",inflationTotalPct:0,inflationTotalSeeded:false,inflationYears:[],
 balloonInputMode:"rate",balloonMonthlyPayment:0,normalInputMode:"rate",normalMonthlyPayment:0,balloonEnabled:true,normalEnabled:true,leaseEnabled:true,cashEnabled:true,matchPeriods:true,balloonMatchPeriod:true,normalMatchPeriod:true,leaseMatchPeriod:true,cashMatchPeriod:true,pastHistoricalMatchPeriod:true,
 balloonMatchOwnership:true,normalMatchOwnership:true,balloonLoanMonths:36,normalLoanMonths:36,
 balloonMonths:36,normalMonths:36,leaseMonths:36,cashMonths:36,
 balloonResale:1000000,normalResale:1000000,leaseResale:1000000,cashResale:1000000,
 cashInsurance:3700, cashExtra:0, vatEnabled:true, recoveryPct:100, purchaseVatEligible:true, purchaseVatDelay:3, leaseVatDelay:0, purchaseVatCap:420000, opportunityRate:8.5, loanEnd:"sell", leaseEnd:"return", leaseBuyout:0, buyoutVatEligible:true, leaseTaxablePct:100, carName:"Toyota RAV4 Executive PHEV AWD", normalDownPct:20, normalRate:5.99, normalInsurance:3700, normalExtra:0, months:36, annualKm:20000, price:1334000, downPct:20, balloonPct:46, rate:5.99, easyInsurance:3700,
 resale:1000000, easyExtra:0, kintoMonthly:16788, kintoVatMode:"gross", vatPct:21, kintoInitial:0,
 kintoInsuranceIncluded:true, kintoInsurance:3700, kintoMaintenance:false, kintoTyres:true, kintoExtra:0,
 additionalSeparatePeriod:false, additionalCostMonths:36, additionalCostMode:"annual", additionalCostAnnual:0, additionalCostYears:[], leaseAdditionalCosts:false,
 serviceCost:12000, serviceKm:15000, serviceMonths:12, tyrePurchase:22000, tyreResale:3000,
 tyreVisits:6, tyreVisitCost:1880, tyreStorage:1100
};

// New fields inherit the original shared term and resale when reading older scenarios.
export function migrateInputs(inputs){
 const state={...defaults,...inputs};
 // Retired quote basis: convert once, preserving the gross invoice of old saved leases.
 // A draft with a missing VAT rate stays pending until that rate is supplied.
 if(state.kintoVatMode==="net"&&(state.kintoMonthly===null||Number.isFinite(state.kintoMonthly)&&Number.isFinite(state.vatPct))){
  if(state.kintoMonthly!==null)state.kintoMonthly*=1+state.vatPct/100;
  state.kintoVatMode="gross";
 }
 // Never share the schema default or a caller-owned year array with an effective scenario.
 state.additionalCostYears=Object.hasOwn(inputs,"additionalCostYears")?(Array.isArray(inputs.additionalCostYears)?[...inputs.additionalCostYears]:inputs.additionalCostYears):[...defaults.additionalCostYears];
 state.historicalInflationYears=Object.hasOwn(inputs,"historicalInflationYears")?(Array.isArray(inputs.historicalInflationYears)?[...inputs.historicalInflationYears]:inputs.historicalInflationYears):[...defaults.historicalInflationYears];
 state.inflationYears=Object.hasOwn(inputs,"inflationYears")?(Array.isArray(inputs.inflationYears)?[...inputs.inflationYears]:inputs.inflationYears):[...defaults.inflationYears];
 // Keep old independent ages, including zero/null drafts, when migrating years to months.
 if(!Object.hasOwn(inputs,"historicalMonths"))state.historicalMonths=Object.hasOwn(inputs,"historicalYears")?(inputs.historicalYears===null?null:inputs.historicalYears*12):state.months;
 if(!Object.hasOwn(inputs,"historicalMatchPeriod"))state.historicalMatchPeriod=!Object.hasOwn(inputs,"historicalYears");
 // Preserve historical drafts from older versions; seed only an unused relative mode.
 if(!Object.hasOwn(inputs,"relativeResaleSeeded"))state.relativeResaleSeeded=inputs.resaleMode==="relative"||["historicalNewPrice","historicalUsedPrice"].some(key=>Object.hasOwn(inputs,key)&&inputs[key]!==0);
 if(!Object.hasOwn(inputs,"inflationRate"))state.inflationRate=0;
 // Older past-relative scenarios took inflation from the comparable history. Promote that source once.
 if(!Object.hasOwn(inputs,"inflationSetup")&&state.pastOwnership&&state.resaleMode==="relative"){
  state.legacyInflationInputs=JSON.stringify(Object.fromEntries(["inflationRate","inflationMode","inflationTotalPct","inflationTotalSeeded","inflationYears","historicalMonths"].map(key=>[key,state[key]])));
  state.inflationMode=state.historicalInflationMode;
  if(state.inflationMode==="annual")state.inflationRate=state.historicalInflationAnnual;
  else if(state.inflationMode==="total"){state.inflationTotalPct=state.historicalInflationPct;state.inflationTotalSeeded=true;}
  else if(Array.isArray(state.historicalInflationYears))state.inflationYears=state.historicalInflationYears.slice(0,10);
  // The old replay always used the ownership period, even when a hidden independent age was saved.
  if(!state.matchPeriods)state.historicalMonths=state.months;
 }
 // Previous scenarios used nominal returns; never reinterpret their saved percentage.
 if(!Object.hasOwn(inputs,"opportunityRateBasis"))state.opportunityRateBasis="nominal";
 if(!Object.hasOwn(inputs,"pastHistoricalMatchPeriod"))state.pastHistoricalMatchPeriod=state.matchPeriods;
 for(const v of variants){
  if(!Object.hasOwn(inputs,v.matchPeriod))state[v.matchPeriod]=state.matchPeriods;
  if(!Object.hasOwn(inputs,v.months))state[v.months]=state.months;
  if(!Object.hasOwn(inputs,v.resale))state[v.resale]=state.resale;
  if(v.loanMonths&&!Object.hasOwn(inputs,v.loanMonths))state[v.loanMonths]=state[v.matchPeriod]?state.months:state[v.months];
 }
 return state;
}
// --- Effective assumptions and validation ---
function historicalAgeMonths(s){
 if(s.pastOwnership)return (s.pastHistoricalMatchPeriod??s.matchPeriods)?s.months:s.historicalMonths;
 if(s.historicalMatchPeriod)return s.months;
 if(Object.hasOwn(s,"historicalMonths"))return s.historicalMonths;
 return s.historicalYears===null?null:s.historicalYears*12;
}

/** The historical entry method is remembered independently for past and future comparisons. */
export function historicalInflationEntryMode(s){return s.pastOwnership?(s.pastHistoricalInflationMode??"main"):(s.historicalInflationMode??"total");}
function historicalUsesMain(s){return s.pastOwnership&&(s.pastHistoricalMatchPeriod??s.matchPeriods)||historicalInflationEntryMode(s)==="main";}

/** Resolve historical inflation from its own inputs or the main annual equivalent. */
export function historicalInflationTotal(s){
 if(s.pastOwnership&&(s.pastHistoricalMatchPeriod??s.matchPeriods))return ownershipInflationTotal(s);
 const mode=historicalInflationEntryMode(s);
 if(mode==="main"){
  const months=historicalAgeMonths(s),rate=ownershipInflationRate(s);
  return Number.isFinite(months)&&months>0&&Number.isFinite(rate)&&rate>=0?Math.expm1(Math.log1p(rate/100)*months/12)*100:NaN;
 }
 if(mode==="total")return s.historicalInflationPct;
 if(mode==="annual"){
  const months=historicalAgeMonths(s),rate=s.historicalInflationAnnual;
  return Number.isFinite(months)&&months>0&&Number.isFinite(rate)&&rate>=0&&rate<=100?((1+rate/100)**(months/12)-1)*100:NaN;
 }
 if(mode!=="yearly")return NaN;
 const months=historicalAgeMonths(s),years=Array.isArray(s.historicalInflationYears)?s.historicalInflationYears:[];
 return compoundInflation(months,years);
}
function compoundInflation(months,years){
 if(!Number.isFinite(months)||months<0||months>1200)return NaN;
 let factor=1;
 for(let start=0;start<months;start+=12){
  const index=start/12,rate=Object.hasOwn(years,index)?years[index]:2.5;
  if(!Number.isFinite(rate)||rate<0||rate>100)return NaN;
  factor*=(1+rate/100)**(Math.min(12,months-start)/12);
 }
 return (factor-1)*100;
}

/** Equivalent annual inflation over the comparable car's complete historical period. */
export function historicalInflationRate(s){
 if(historicalUsesMain(s))return ownershipInflationRate(s);
 const months=historicalAgeMonths(s),total=historicalInflationTotal(s);
 if(!Number.isFinite(months)||months<=0||!Number.isFinite(total)||total<0)return NaN;
 // Keep an entered average exact; recomputing it can cross the 100% validation boundary through rounding.
 if(historicalInflationEntryMode(s)==="annual")return s.historicalInflationAnnual;
 return Math.expm1(Math.log1p(total/100)*12/months)*100;
}
/** Compounded ownership inflation for the shared comparison period. */
export function ownershipInflationTotal(s){
 const mode=s.inflationMode??"annual",months=s.months;
 if(!Number.isFinite(months)||months<=0||months>120)return NaN;
 if(mode==="annual")return Number.isFinite(s.inflationRate)&&s.inflationRate>=0?Math.expm1(Math.log1p(s.inflationRate/100)*months/12)*100:NaN;
 if(mode==="total")return s.inflationTotalPct;
 return mode==="yearly"&&Array.isArray(s.inflationYears)?compoundInflation(months,s.inflationYears):NaN;
}
/** Equivalent annual rate from the main ownership-inflation controls. */
export function ownershipInflationRate(s){
 if((s.inflationMode??"annual")==="annual")return s.inflationRate;
 const total=ownershipInflationTotal(s);
 const rate=Number.isFinite(total)&&total>=0&&Number.isFinite(s.months)&&s.months>0?Math.expm1(Math.log1p(total/100)*12/s.months)*100:NaN;
 // Fractional-year compounding can round an exact 100% rate just above the supported limit.
 return rate>100&&rate<100+1e-10?100:rate;
}
/** Validate entry modes and yearly schedules without discarding inactive drafts. */
export function validateOwnershipInflation(s,{allowDrafts=false}={}){
 if(s.inflationSetup!=="shared-v1")throw new Error("Unsupported inflation setup version.");
 if(!["annual","total","yearly"].includes(s.inflationMode))throw new Error("Choose annual average, cumulative or yearly ownership inflation.");
 if(!Array.isArray(s.inflationYears)||s.inflationYears.length>10)throw new Error("Enter up to 10 yearly ownership inflation rates.");
 for(const rate of s.inflationYears)if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))throw new Error("Yearly ownership inflation must be between 0 and 100% or blank.");
 if(!allowDrafts&&s.inflationMode==="yearly"&&s.inflationYears.slice(0,Math.ceil(s.months/12)).includes(null))throw new Error("Complete each active ownership inflation year.");
}
/** Estimate nominal resale from a comparable car's annualised real value retention. */
export function relativeResaleEstimate(s,months=s.months){
 const ageMonths=historicalAgeMonths(s);
 const ageYears=Number.isFinite(ageMonths)?ageMonths/12:NaN;
 const inflationRate=ownershipInflationRate(s);
 const historicalTotal=historicalInflationTotal(s);
 const values=[s.price,s.historicalNewPrice,s.historicalUsedPrice,ageYears,historicalTotal,inflationRate,months];
 if(!values.every(value=>Number.isFinite(value)&&value>=0)||s.historicalNewPrice<=0||ageYears<=0)return null;
 const historicalPriceToday=s.historicalNewPrice*(1+historicalTotal/100);
 const retainedShare=s.historicalUsedPrice/historicalPriceToday;
 // Compound a constant real retention rate when ownership differs from the comparable's age.
 const annualRetention=retainedShare**(1/ageYears);
 const todayValue=s.price*retainedShare**(months/(12*ageYears));
 const nominalValue=todayValue*(1+inflationRate/100)**(months/12);
 return {historicalPriceToday,retainedShare,annualRetention,todayValue,nominalValue};
}
export function effectiveInputs(inputs){
 const s=migrateInputs(inputs);
 s.inflationRate=ownershipInflationRate(s);
 if(s.inflationMode!=="total")s.inflationTotalPct=defaults.inflationTotalPct;
 if(historicalInflationEntryMode(s)!=="annual"||s.resaleMode!=="relative"||historicalUsesMain(s))s.historicalInflationAnnual=defaults.historicalInflationAnnual;
 if(s.resaleMode!=="relative")for(const key of ["historicalNewPrice","historicalUsedPrice","historicalYears","historicalMonths","historicalInflationPct"])s[key]=defaults[key];
 if(s.resaleMode==="relative"){
  s.historicalMonths=historicalAgeMonths(s);
  // The legacy years field is retained in storage, but effective ages now come from months.
  s.historicalYears=Number.isFinite(s.historicalMonths)?s.historicalMonths/12:NaN;
  if(historicalUsesMain(s)||historicalInflationEntryMode(s)!=="total")s.historicalInflationPct=historicalInflationTotal(s);
 }
 // Retain the old saved count for round trips, but always budget two seasonal visits per year.
 s.tyreVisits=Math.ceil(s.months/6);
 // Hidden tax assumptions are retained in storage but excluded from calculations.
 if(!s.incomeTaxEnabled){s.incomeTaxRate=0;s.saleTaxRate=0;}
 else if(s.matchSaleTaxRate)s.saleTaxRate=s.incomeTaxRate;
 for(const v of variants){
  if(!s.incomeTaxEnabled||!s[v.enabled]){s[v.deductions]=0;s[v.taxValue]=0;}
  if(!s.saleTaxRate||(v.kind==="lease"?s.leaseEnd!=="buySell":s.loanEnd!=="sell"))s[v.taxValue]=0;
 }
 for(const v of variants){
  if(!s[v.enabled])for(const key of v.fields)s[key]=defaults[key];
  if(s[v.matchPeriod]||!s[v.enabled]){s[v.months]=s.months;s[v.resale]=s.resale;}
  if(v.loanMonths&&(s[v.matchLoanTerm]||!s[v.enabled]))s[v.loanMonths]=s[v.months];
 }
 // Retired global matching is only a derived summary in effective inputs. Raw saved values stay unchanged.
 s.matchPeriods=variants.every(v=>!s[v.enabled]||s[v.matchPeriod]);
 // Resolve quoted payments only after the independent repayment period is known.
 if(s.balloonEnabled&&s.balloonInputMode==="payment")s.rate=annualRateFromPayment(s.price*(1-s.downPct/100),s.price*s.balloonPct/100,s.balloonMonthlyPayment,s.balloonLoanMonths);
 else s.balloonMonthlyPayment=defaults.balloonMonthlyPayment;
 if(s.normalEnabled&&s.normalInputMode==="payment")s.normalRate=annualRateFromPayment(s.price*(1-s.normalDownPct/100),0,s.normalMonthlyPayment,s.normalLoanMonths);
 else s.normalMonthlyPayment=defaults.normalMonthlyPayment;
 if(!s.additionalSeparatePeriod)s.additionalCostMonths=defaults.additionalCostMonths;
 if(s.additionalCostMode==="yearly"){
  const years=Array.isArray(s.additionalCostYears)?s.additionalCostYears:[];
  const needsFallback=Array.from({length:activeAdditionalCostYearCount(s)},(_,index)=>!Object.hasOwn(years,index)).some(Boolean);
  // A blank annual field is inactive when every applicable year has an explicit amount.
  if(!needsFallback)s.additionalCostAnnual=defaults.additionalCostAnnual;
 }
 if(!s.vatEnabled){
  for(const key of ["recoveryPct","purchaseVatDelay","purchaseVatCap"])s[key]=defaults[key];
  // An unfinished legacy net quote still needs its rate to determine the actual invoice.
  if(s.kintoVatMode!=="net")s.vatPct=defaults.vatPct;
 }
 // Retain legacy delay drafts in storage; lease VAT always offsets the payment month.
 s.leaseVatDelay=0;
 // Inactive lease VAT fields may remain blank in saved drafts without blocking other results.
 if(!s.vatEnabled||!s.leaseEnabled)for(const key of ["leaseTaxablePct"])s[key]=defaults[key];
 if(!s.leaseEnabled)s.leaseEnd="return";
 if(s.leaseEnd==="return")s.leaseResale=s.resale;
 if(!s.balloonEnabled&&!s.normalEnabled&&!s.cashEnabled)s.purchaseVatEligible=false;
 if(s.resaleMode==="relative"){
  s.resale=relativeResaleEstimate(s)?.nominalValue??NaN;
  for(const v of variants)s[v.resale]=relativeResaleEstimate(s,s[v.months])?.nominalValue??NaN;
 }
 return s;
}
/** Convert the after-tax return to nominal annual percent for nominal cash flows. */
export function nominalOpportunityRate(s){
 return s.opportunityRateBasis==="real"?((1+s.opportunityRate/100)*(1+s.inflationRate/100)-1)*100:s.opportunityRate;
}
export function comparisonValue(result,split=false){return result.adjusted/(split?result.months:1);}
export function hasDifferentPeriods(s){s=migrateInputs(s);return new Set(variants.filter(v=>s[v.enabled]).map(v=>s[v.matchPeriod]?s.months:s[v.months])).size>1;}

function activeAdditionalCostYearCount(s){
 return variants.filter(v=>s[v.enabled]&&(v.kind!=="lease"||s.leaseAdditionalCosts)).reduce((count,v)=>Math.max(count,Math.ceil((s.additionalSeparatePeriod?Math.min(s[v.months],s.additionalCostMonths):s[v.months])/12)),0);
}

function validateHistoricalInflationState(s,{allowDrafts=false}={}){
 if(!["annual","total","yearly","main"].includes(s.historicalInflationMode)||!["annual","total","yearly","main"].includes(s.pastHistoricalInflationMode))throw new Error("Choose annual average, total or year-specific historical inflation, or use the main annual average.");
 if(s.historicalInflationAnnual!==null&&(!Number.isFinite(s.historicalInflationAnnual)||s.historicalInflationAnnual<0||s.historicalInflationAnnual>100))throw new Error("Historical annual inflation must be between 0 and 100 or blank.");
 if(!Array.isArray(s.historicalInflationYears)||s.historicalInflationYears.length>100)throw new Error("Enter up to 100 yearly historical inflation rates.");
 for(let index=0;index<s.historicalInflationYears.length;index++){
  if(!Object.hasOwn(s.historicalInflationYears,index))continue;
  const rate=s.historicalInflationYears[index];
  if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))throw new Error("Yearly historical inflation rates must be between 0 and 100 or blank.");
 }
 if(allowDrafts||s.resaleMode!=="relative"||historicalUsesMain(s)||historicalInflationEntryMode(s)!=="yearly")return;
 const months=historicalAgeMonths(s);
 if(Number.isFinite(months)&&months>1200)throw new Error("Year-specific historical inflation supports up to 100 years; use total cumulative inflation for a longer comparable age.");
 const activeYears=Number.isFinite(months)&&months>0?Math.ceil(months/12):0;
 for(let index=0;index<activeYears;index++)if(Object.hasOwn(s.historicalInflationYears,index)&&s.historicalInflationYears[index]===null){
  throw new Error("Fill each active yearly historical inflation rate or remove the blank value.");
 }
}

/** Validate historical-inflation storage or the complete active comparable age. */
export function validateHistoricalInflation(inputs,options={}){validateHistoricalInflationState(effectiveInputs(inputs),options);}

function validateAdditionalCostState(s,{allowDrafts=false}={}){
 if(!["annual","yearly"].includes(s.additionalCostMode))throw new Error("Choose annual or year-specific additional costs.");
 if(!Array.isArray(s.additionalCostYears)||s.additionalCostYears.length>10)throw new Error("Enter up to 10 yearly additional-cost amounts.");
 for(let index=0;index<s.additionalCostYears.length;index++){
  if(!Object.hasOwn(s.additionalCostYears,index))continue;
  const value=s.additionalCostYears[index];
  if(value!==null&&(!Number.isFinite(value)||value<0))throw new Error("Yearly additional costs must be non-negative numbers or blank.");
 }
 if(s.additionalCostAnnual!==null&&(!Number.isFinite(s.additionalCostAnnual)||s.additionalCostAnnual<0))throw new Error("Enter a valid, non-negative annual additional cost.");
 if(s.additionalSeparatePeriod&&!(allowDrafts&&s.additionalCostMonths===null)&&(!Number.isInteger(s.additionalCostMonths)||s.additionalCostMonths<1||s.additionalCostMonths>120))throw new Error("Use an additional-cost period of 1 to 120 whole months.");
 if(allowDrafts)return;
 if(s.additionalCostMode==="annual"){
  if(!Number.isFinite(s.additionalCostAnnual))throw new Error("Enter an annual additional cost.");
  return;
 }
 for(let index=0;index<activeAdditionalCostYearCount(s);index++){
  if(Object.hasOwn(s.additionalCostYears,index)&&s.additionalCostYears[index]===null)throw new Error("Fill each active yearly additional cost or remove the blank value.");
  const value=Object.hasOwn(s.additionalCostYears,index)?s.additionalCostYears[index]:s.additionalCostAnnual;
  if(!Number.isFinite(value)||value<0)throw new Error("Enter an annual fallback for missing active years.");
 }
}

/** Validate additional-cost storage or the complete active calculation horizon. */
export function validateAdditionalCosts(inputs,options={}){validateAdditionalCostState(effectiveInputs(inputs),options);}

export function validate(s){
 s=effectiveInputs(s);
 validateOwnershipInflation(s);
 if(!["rate","payment"].includes(s.normalInputMode))throw new Error("Choose interest rate or monthly payment for the standard loan.");
 if(s.normalEnabled&&s.normalInputMode==="payment"&&!Number.isFinite(s.normalRate))throw new Error("Enter a valid standard loan quote: positive borrowing, a whole repayment period, and a monthly payment supporting an interest rate from 0 to 100% p.a. Exclude insurance and fees.");
 if(!["rate","payment"].includes(s.balloonInputMode))throw new Error("Choose interest rate or monthly payment for the balloon loan.");
 if(s.balloonEnabled&&s.balloonInputMode==="payment"&&!Number.isFinite(s.rate))throw new Error("Enter a valid balloon loan quote: positive borrowing, a whole repayment period, and a monthly payment supporting an interest rate from 0 to 100% p.a. Exclude insurance and fees.");
 validateAdditionalCostState(s);
 validateHistoricalInflationState(s);
 if(!["direct","relative"].includes(s.resaleMode))throw new Error("Choose direct resale or relative depreciation.");
 if(s.resaleMode==="relative"&&(s.historicalNewPrice===0||s.historicalYears===0))throw new Error("Enter a positive original new price and age for the historical car.");
 for(const [key,fallback] of Object.entries(defaults)){
  if(typeof fallback==="number"&&(!Number.isFinite(s[key])||s[key]<0))throw new Error("Enter a valid, non-negative number in every numeric field.");
  if(typeof fallback==="boolean"&&typeof s[key]!=="boolean")throw new Error("Choose an option for each checkbox.");
 }
 if(!["real","nominal"].includes(s.opportunityRateBasis))throw new Error("Choose whether the return is before or after inflation.");
 if(typeof s.carName!=="string"||s.carName.length>100)throw new Error("Keep the car name under 100 characters.");
 if(!["sell","keep"].includes(s.loanEnd)||!["return","buySell","buyKeep"].includes(s.leaseEnd))throw new Error("Choose a valid end-of-term option.");
 if(!["gross","net"].includes(s.kintoVatMode))throw new Error("Choose the lease quote’s VAT basis.");
 if(!Number.isInteger(s.months)||s.months<1||s.months>120)throw new Error("Use a term of 1 to 120 whole months.");
 for(const v of variants)if(!Number.isInteger(s[v.months])||s[v.months]<1||s[v.months]>120)throw new Error("Use terms of 1 to 120 whole months.");
 for(const v of variants.filter(v=>v.loanMonths))if(!Number.isInteger(s[v.loanMonths])||s[v.loanMonths]<1||s[v.loanMonths]>120)throw new Error("Use loan repayment periods of 1 to 120 whole months.");
 if(s.serviceKm<=0||s.serviceMonths<=0)throw new Error("Service intervals must be greater than zero.");
 if(s.downPct+s.balloonPct>100||s.normalDownPct>100)throw new Error("Deposit plus balloon cannot exceed 100% of the price.");
 for(const k of ["rate","normalRate","vatPct","recoveryPct","leaseTaxablePct","inflationRate","incomeTaxRate","saleTaxRate"])if(s[k]>100)throw new Error("Rates and percentages must be between 0 and 100.");
 // Legacy real returns up to 100% with 100% inflation can convert to 300% nominal.
 if(s.opportunityRate>(s.opportunityRateBasis==="nominal"?300:100))throw new Error("The investment return exceeds the supported range.");
 for(const k of ["tyreVisits","purchaseVatDelay","leaseVatDelay"])if(!Number.isInteger(s[k]))throw new Error("Visits and refund delays must be whole numbers.");
 if(s.tyreResale>s.tyrePurchase)throw new Error("Tyre resale cannot exceed the tyre purchase budget.");
 if(s.leaseEnd!=="return"&&s.leaseBuyout<=0)throw new Error("Enter a positive, agreed lease buyout price.");
}
// --- Dated cash flows and valuation ---
/** Equal monthly instalment with a separate balloon alongside the final instalment. */
export function monthlyPayment(principal,balloon,annualRate,months){
 const r=annualRate/1200;
 // log1p/expm1 keep the break-even search stable for interest rates close to zero.
 return r===0?(principal-balloon)/months:(principal-balloon*Math.exp(-months*Math.log1p(r)))*r/-Math.expm1(-months*Math.log1p(r));
}
/** Infer nominal annual interest from a quoted instalment, excluding insurance and fees. */
export function annualRateFromPayment(principal,balloon,payment,months){
 if(![principal,balloon,payment,months].every(Number.isFinite)||principal<=0||balloon<0||balloon>principal||payment<0||!Number.isInteger(months)||months<1||months>120)return NaN;
 const minimum=monthlyPayment(principal,balloon,0,months),maximum=monthlyPayment(principal,balloon,100,months);
 if(payment<minimum-1e-8||payment>maximum+1e-8)return NaN;
 if(Math.abs(payment-minimum)<1e-8)return 0;
 // Instalments increase monotonically with the rate; bisection also handles interest-only loans.
 let low=0,high=100;
 for(let i=0;i<60;i++){const mid=(low+high)/2;if(monthlyPayment(principal,balloon,mid,months)<payment)low=mid;else high=mid;}
 return (low+high)/2;
}
// Value the remaining scheduled debt at the comparison end, excluding future interest.
function loanPlan(principal,balloon,rate,loanMonths,ownershipMonths){
 const payment=monthlyPayment(principal,balloon,rate,loanMonths),paidMonths=Math.min(loanMonths,ownershipMonths);
 const remainingMonths=loanMonths-paidMonths,r=rate/1200;
 const remainingPrincipal=remainingMonths===0?0:r===0?payment*remainingMonths+balloon:
  payment*-Math.expm1(-remainingMonths*Math.log1p(r))/r+balloon*Math.exp(-remainingMonths*Math.log1p(r));
 const balloonPaid=remainingMonths===0?balloon:0;
 const interest=payment*paidMonths+balloonPaid+remainingPrincipal-principal;
 return {payment,loanMonths,paidMonths,remainingPrincipal,balloonPaid,interest};
}
/** Monthly loan amortization through ownership, with final and early-exit payments separated. */
export function loanSchedule(inputs,kind){
 const s=effectiveInputs(inputs);validate(s);
 if(!["balloon","normal"].includes(kind))throw new Error("Choose a balloon or standard loan schedule.");
 const normal=kind==="normal",principal=s.price*(1-s[normal?"normalDownPct":"downPct"]/100);
 const balloon=normal?0:s.price*s.balloonPct/100,rate=s[normal?"normalRate":"rate"],months=s[kind+"LoanMonths"],ownership=s[kind+"Months"];
 const payment=monthlyPayment(principal,balloon,rate,months),rows=[];
 let balance=principal,totalInterest=0;
 for(let month=1;month<=Math.min(months,ownership);month++){
  const interest=balance*rate/1200,paidPrincipal=payment-interest;
  const finalBalloon=month===months?balloon:0;
  balance=month===months?0:Math.max(0,balance-paidPrincipal);
  totalInterest+=interest;
  // Remaining debt is shown before an ownership-end sale settles it.
  const settlement=month===ownership&&month<months&&s.loanEnd==="sell"?balance:0;
  rows.push({month,payment,principal:paidPrincipal,interest,totalInterest,balloon:finalBalloon,settlement,balance});
 }
 return {kind,principal,payment,months,ownership,rows};
}
/** Value one dated payment or receipt on the selected purchasing-power and return basis. */
export function cashFlowValue(event,months,nominalReturn,inflationRate,{opportunity=true,todayMoney=false}={}){
 const inflation=1+inflationRate/100;
 if(!opportunity)return event.amount/(todayMoney?inflation**(event.month/12):1);
 return event.amount*(1+nominalReturn/100)**((months-event.month)/12)/(todayMoney?inflation**(months/12):1);
}
/** Compare dated cash flows; valuation switches affect displayed cost, never contractual payments. */
export function calculate(s,valuation={}){
 s=effectiveInputs(s);validate(s);
 const nominalReturn=nominalOpportunityRate(s);
 const n=s.months,km=s.annualKm*n/12,down=s.price*s.downPct/100,balloon=s.price*s.balloonPct/100;
 const balloonPlan=loanPlan(s.price-down,balloon,s.rate,s.balloonLoanMonths,s.balloonMonths);
 const {payment,interest}=balloonPlan,normalDown=s.price*s.normalDownPct/100;
 const normalPlan=loanPlan(s.price-normalDown,0,s.normalRate,s.normalLoanMonths,s.normalMonths);
 const normalPayment=normalPlan.payment,normalInterest=normalPlan.interest;
 const servicePeriod=Math.min(s.serviceMonths,s.annualKm===0?Infinity:s.serviceKm*12/s.annualKm);
 const serviceCount=Math.floor(n/servicePeriod+1e-10),maintenance=serviceCount*s.serviceCost;
 const tyres=s.tyrePurchase+s.tyreVisits*(s.tyreVisitCost+s.tyreStorage)-s.tyreResale;
 const kRent=s.kintoMonthly*(s.kintoVatMode==="net"?1+s.vatPct/100:1),kInsurance=s.kintoInsuranceIncluded?0:s.kintoInsurance;
 const vf=s.vatPct/(100+s.vatPct),recovery=s.vatEnabled?s.recoveryPct/100:0;
 const inputVat=(gross,capital=false)=>Math.min(gross*vf,capital&&s.purchaseVatCap>0?s.purchaseVatCap:Infinity)*recovery;
 const saleVat=gross=>s.vatEnabled?gross*vf:0;
 const purchaseRefund=s.purchaseVatEligible?inputVat(s.price,true):0;
 function option(kind){
  // loanEnd retains its saved JSON key and now governs every non-lease purchase.
  const variant=variants.find(v=>v.kind===kind),n=s[variant.months],resale=s[variant.resale];
  const serviceCount=Math.floor(n/servicePeriod+1e-10),maintenance=serviceCount*s.serviceCost;
  // Each ownership period gets a visit at purchase and every six months before its end.
  const tyreVisits=Math.ceil(n/6),tyres=s.tyrePurchase+tyreVisits*(s.tyreVisitCost+s.tyreStorage)-s.tyreResale;
  const isLease=kind==="lease",isNormal=kind==="normal",isCash=kind==="cash",events=[];
  const plan=isLease||isCash?null:isNormal?normalPlan:balloonPlan;
  const add=(month,amount,category,type="cash")=>events.push({month,amount,category,type});
  // Treat next-month maintenance and tyre deductions as settled with the expense for this comparison.
  const refund=(month,amount,capital=false,delay=capital?s.purchaseVatDelay:0)=>{if(amount)add(month+delay,-amount,"vat");};
  const insured=isLease?kInsurance:isCash?s.cashInsurance:isNormal?s.normalInsurance:s.easyInsurance;
  if(isLease){add(0,s.kintoInitial,"initial");refund(0,inputVat(s.kintoInitial*s.leaseTaxablePct/100),false,0);}
  else{add(0,isCash?s.price:isNormal?normalDown:down,"capital");refund(0,purchaseRefund,true);}
  for(let m=1;m<=n;m++){
   if(isLease){add(m-1,kRent,"lease");refund(m-1,inputVat(kRent*s.leaseTaxablePct/100),false,0);}
   else if(plan&&m<=plan.paidMonths)add(m,plan.payment,"repayment");
   add(isLease?m-1:m,insured,"insurance");
  }
  // Loan principal already includes purchase VAT. Its refund does not reduce the loan balance.
  if(plan){
   if(plan.balloonPaid)add(plan.loanMonths,plan.balloonPaid,"capital");
   // Selling settles the debt in cash; keeping the car carries a terminal liability instead.
   if(plan.remainingPrincipal)add(n,plan.remainingPrincipal,"capital",s.loanEnd==="keep"?"asset":"cash");
  }
  if(!isLease||!s.kintoMaintenance){
   for(let i=1;i<=serviceCount;i++){add(i*servicePeriod,s.serviceCost,"maintenance");refund(i*servicePeriod,inputVat(s.serviceCost));}
  }
  if(!isLease||!s.kintoTyres){
   add(0,s.tyrePurchase,"tyres");refund(0,inputVat(s.tyrePurchase));
   for(let i=0;i<tyreVisits;i++){
    const m=i*6,amount=s.tyreVisitCost+s.tyreStorage;
    add(m,amount,"tyres");refund(m,inputVat(amount));
   }
   const keep=isLease?s.leaseEnd==="buyKeep":s.loanEnd==="keep";
   add(n,-s.tyreResale,"tyres",keep?"asset":"cash");add(n,saleVat(s.tyreResale),"vat",keep?"asset":"cash");
  }
  let additionalCosts=0;
  // A separate cost window caps expense dates without shortening ownership or later opportunity cost.
  const additionalMonths=s.additionalSeparatePeriod?Math.min(n,s.additionalCostMonths):n;
  if(!isLease||s.leaseAdditionalCosts)for(let start=0;start<additionalMonths;start+=12){
   const period=Math.min(12,additionalMonths-start),index=start/12;
   const annual=s.additionalCostMode==="annual"?s.additionalCostAnnual:Object.hasOwn(s.additionalCostYears,index)?s.additionalCostYears[index]:s.additionalCostAnnual;
   const amount=annual*period/12;additionalCosts+=amount;
   if(amount){add(start+period,amount,"additional");refund(start+period,inputVat(amount));}
  }
  const buyout=isLease&&s.leaseEnd!=="return";
  if(buyout){add(n,s.leaseBuyout,"buyout");refund(n,s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0,true);}
  if(!isLease||buyout){
   const keep=isLease?s.leaseEnd==="buyKeep":s.loanEnd==="keep";
   // Kept cars receive a non-cash terminal asset credit, net of estimated disposal VAT.
   add(n,-resale,"resale",keep?"asset":"cash");add(n,saleVat(resale),"vat",keep?"asset":"cash");
  }
  add(n,isLease?s.kintoExtra:isCash?s.cashExtra:isNormal?s.normalExtra:s.easyExtra,"other");
  const taxSavings=s[variant.deductions]*s.incomeTaxRate/100;
  const sold=isLease?s.leaseEnd==="buySell":s.loanEnd==="sell";
  const taxableSale=s.incomeTaxEnabled&&sold?Math.max(0,resale-saleVat(resale)-s[variant.taxValue]):0;
  const saleTax=taxableSale*s.saleTaxRate/100;
  // Spread the manual full-term deduction budget evenly; settle each year and the final partial year.
  if(taxSavings)for(let start=0;start<n;start+=12){
   const period=Math.min(12,n-start);add(start+period,-taxSavings*period/n,"taxSavings");
  }
  if(saleTax)add(n,saleTax,"saleTax");
  // Split repayments into principal and interest on their payment dates for the displayed breakdown.
  // Their sum must equal the existing cash-flow valuation; this does not add another inflation charge.
  const costComponents={purchase:0,resale:0,interest:0,lease:0,insurance:0,maintenance:0,tyres:0,additional:0,other:0,vat:0,taxSavings:0,saleTax:0};
  for(const event of events){
   const key=["capital","repayment","buyout"].includes(event.category)?"purchase":event.category==="initial"?"lease":event.category;
   costComponents[key]+=cashFlowValue(event,n,nominalReturn,s.inflationRate,{...valuation,opportunity:false});
  }
  if(plan){
   let valuedInterest=plan.interest;
   if(valuation.todayMoney){
    valuedInterest=0;
    const r=(isNormal?s.normalRate:s.rate)/1200,finalPrincipal=isNormal?0:balloon;
    for(let month=1;month<=plan.paidMonths;month++){
     const factor=-(plan.loanMonths-month+1)*Math.log1p(r);
     // Interest on the present value of payments still due avoids cancellation near maturity.
     const amount=plan.payment*-Math.expm1(factor)+finalPrincipal*Math.exp(factor)*r;
     valuedInterest+=cashFlowValue({month,amount},n,0,s.inflationRate,{opportunity:false,todayMoney:true});
    }
   }
   costComponents.interest=valuedInterest;costComponents.purchase-=valuedInterest;
  }
  const nominal=events.reduce((t,e)=>t+e.amount,0);
  // Carry every cash flow to the comparison end, including discounting later VAT refunds back.
  const opportunityBreakdown={upfront:0,payments:0,insurance:0,maintenance:0,tyres:0,additional:0,vatDuring:0,vatAfter:0,taxSavings:0,settlement:0,other:0};
  for(const e of events){
   // Refunds before the end offset foregone return; later refunds incur a timing cost.
   const group=e.category==="vat"?(e.amount<0?(e.month>n?"vatAfter":"vatDuring"):"settlement")
    :e.category==="initial"||e.category==="capital"&&e.month===0?"upfront"
    :e.category==="repayment"||e.category==="lease"?"payments"
    :["capital","buyout","resale","saleTax"].includes(e.category)?"settlement":e.category;
   opportunityBreakdown[group]+=cashFlowValue(e,n,nominalReturn,s.inflationRate,valuation)-cashFlowValue(e,n,nominalReturn,s.inflationRate,{...valuation,opportunity:false});
  }
  const opportunity=Object.values(opportunityBreakdown).reduce((t,v)=>t+v,0);
  const beforeOpportunity=events.reduce((sum,e)=>sum+cashFlowValue(e,n,nominalReturn,s.inflationRate,{...valuation,opportunity:false}),0);
  const inflationAdjustment=beforeOpportunity-nominal;
  const adjusted=beforeOpportunity+opportunity;
  const vat=events.filter(e=>e.category==="vat").reduce((t,e)=>t+e.amount,0);
  const futureRefund=-events.filter(e=>e.month>n&&e.category==="vat").reduce((t,e)=>t+e.amount,0);
  const cashToEnd=events.filter(e=>e.month<=n&&e.type==="cash").reduce((t,e)=>t+e.amount,0);
  const retainedValue=-events.filter(e=>e.type==="asset").reduce((t,e)=>t+e.amount,0);
  return {costComponents,loanMonths:plan?.loanMonths??0,paidMonths:plan?.paidMonths??0,remainingPrincipal:plan?.remainingPrincipal??0,balloonPaid:plan?.balloonPaid??0,loanInterest:plan?.interest??0,beforeOpportunity,inflationAdjustment,taxSavings,taxableSale,saleTax,months:n,km:s.annualKm*n/12,resale,carSaleVat:saleVat(resale),depreciation:s.price-resale,serviceCount,maintenance,tyreVisits,tyres,additionalCosts,enabled:s[variant.enabled],nominal,adjusted,opportunity,opportunityBreakdown,vat,futureRefund,cashToEnd,retainedValue,events};
 }
 const balloonLoan=option("balloon"),standardLoan=option("normal"),lease=option("lease"),cashPurchase=option("cash");
 const buyoutRefund=s.leaseEnd!=="return"&&s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0;
 return {nominalReturn,km,down,balloon,payment,interest,normalDown,normalPayment,normalInterest,serviceCount,maintenance,tyres,kRent,kInsurance,
 depreciation:s.price-s.resale,insuredPayment:payment+s.easyInsurance,equity:s.balloonResale-saleVat(s.balloonResale)-balloonPlan.remainingPrincipal-(s.balloonLoanMonths===s.balloonMonths?balloon:0),purchaseRefund,buyoutRefund,
 leaseVatPerPayment:inputVat(kRent*s.leaseTaxablePct/100),leaseInitialVat:inputVat(s.kintoInitial*s.leaseTaxablePct/100),carSaleVat:saleVat(s.resale),
 balloonLoan,standardLoan,lease,cashPurchase};
}
// --- Sensitivity and break-even comparisons ---
// For split periods, vary each option's resale by the same amount from its own estimate.
export function withResale(s,resale){
 // Sensitivity varies the resolved estimate, not the historical inputs that generated it.
 s=effectiveInputs(s);
 const next={...s,resaleMode:"direct",resale};
 if(!s.matchPeriods)for(const v of variants)next[v.resale]=s[v.resale]+resale-s.resale;
 return next;
}
/** Resale coordinates where a selected option starts paying the estimated sale tax. */
export function resaleTaxBreakpoints(inputs){
 const s=effectiveInputs(inputs);
 if(!s.incomeTaxEnabled||!s.saleTaxRate)return [];
 return variants.filter(v=>s[v.enabled]&&(v.kind==="lease"?s.leaseEnd==="buySell":s.loanEnd==="sell")).map(v=>
  s[v.taxValue]*(s.vatEnabled?1+s.vatPct/100:1)+(s.matchPeriods?0:s.resale-s[v.resale]));
}
/** Compare resale crossovers on full-term or duration-normalised cost; omitted basis preserves existing callers. */
export function resaleComparisons(s,valuation={},annualComparison=hasDifferentPeriods(s)){
 s=effectiveInputs(s);
 const split=annualComparison,value=c=>comparisonValue(c,split);
 const active=variants.filter(v=>s[v.enabled]),pairs=[];
 const origin=s.matchPeriods?0:Math.max(0,s.resale-Math.min(...active.map(v=>s[v.resale])));
 // Sale tax creates kinks at tax values. Solve each linear segment, including multiple crossings.
 const starts=[...new Set([origin,...resaleTaxBreakpoints(s).filter(x=>x>origin)])].sort((a,b)=>a-b);
 const samples=starts.map((start,i)=>{
  const end=starts[i+1]??Infinity,step=Number.isFinite(end)?end-start:1000000;
  return {start,end,step,low:calculate(withResale(s,start),valuation),high:calculate(withResale(s,start+step),valuation)};
 });
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const left=active[i].key,right=active[j].key,roots=[];
  for(const part of samples){
   const difference=value(part.low[left])-value(part.low[right]);
   const slope=(value(part.high[left])-value(part.high[right])-difference)/part.step;
   if(Math.abs(slope)<1e-10)continue;
   const resale=part.start-difference/slope;
   if(resale<part.start-1e-6||resale>part.end+1e-6||roots.some(p=>Math.abs(p.resale-resale)<.01))continue;
   roots.push({left,right,resale:Math.max(origin,resale),cost:value(calculate(withResale(s,Math.max(origin,resale)),valuation)[left]),cheaperAbove:slope<0?left:right});
  }
  if(roots.length)pairs.push(...roots);
  else{
   const difference=value(samples[0].low[left])-value(samples[0].low[right]);
   const tied=samples.every(part=>Math.abs(value(part.low[left])-value(part.low[right]))<.5&&Math.abs(value(part.high[left])-value(part.high[right]))<.5);
   pairs.push({left,right,resale:null,tied,cheaper:difference<0?left:right});
  }
 }
 return pairs;
}

/** Find the non-negative nominal loan rate matching a selected benchmark, including opportunity cost; annualComparison selects duration-normalised costs. */
export function interestComparisons(s,valuation={},annualComparison=hasDifferentPeriods(s)){
 s=effectiveInputs(s);
 const split=annualComparison,base=calculate(s,valuation),rows=[];
 for(const loan of variants.slice(0,2).filter(v=>s[v.enabled]))for(const target of variants.slice(2).filter(v=>s[v.enabled])){
  const rateKey=loan.kind==="balloon"?"rate":"normalRate";
  const targetCost=comparisonValue(base[target.key],split);
  const difference=rate=>comparisonValue(calculate({...s,balloonInputMode:"rate",normalInputMode:"rate",[rateKey]:rate},valuation)[loan.key],split)-targetCost;
  const low=difference(0),high=difference(100);
  let rate=null,status;
  if(Math.abs(high-low)<1e-7)status=Math.abs(low)<.005?"equal":"unaffected";
  else if(low>.005)status="below-zero";
  else if(high<-.005)status="above-range";
  else if(Math.abs(low)<1e-7){rate=0;status="match";}
  else if(Math.abs(high)<1e-7){rate=100;status="match";}
  else{
   let left=0,right=100;
   for(let i=0;i<50;i++){const mid=(left+right)/2;if(difference(mid)>0)right=mid;else left=mid;}
   rate=(left+right)/2;status="match";
  }
  rows.push({loan:loan.key,target:target.key,rate,status,currentRate:s[rateKey],targetCost});
 }
 return rows;
}

/** Compare inflation/return assumptions without changing the scenario's saved inputs. */
export function inflationReturnGrid(inputs,inflations,returns,options={opportunity:true,todayMoney:false},annualComparison=hasDifferentPeriods(inputs)){
 const s=effectiveInputs(inputs),active=variants.filter(v=>s[v.enabled]),split=annualComparison;
 // Inflation changes projected resale and sale tax. Return only revalues those same dated flows.
 const columns=inflations.map(inflation=>calculate({...s,...(s.pastOwnership?{resaleMode:"direct"}:{}),inflationMode:"annual",inflationRate:inflation,opportunityRateBasis:"nominal"}));
 return returns.flatMap(rate=>inflations.map((inflation,index)=>{
  const result=columns[index];
  const costs=active.map(v=>{
   const o=result[v.key],total=o.events.reduce((sum,e)=>sum+cashFlowValue(e,o.months,rate,inflation,options),0);
   return {...v,total,value:total/(split?o.months:1),months:o.months,resale:o.resale};
  }).sort((a,b)=>a.value-b.value);
  const leaders=costs.filter(o=>Math.abs(o.value-costs[0].value)<.5);
  return {inflation,rate,costs,leaders:leaders.map(v=>v.key),gap:costs.length>1?costs[1].value-costs[0].value:0};
 }));
}

/** Display samples and exact crossings on the same nominal resale axis. */
export function resaleSamples(s,pairs){
 s=effectiveInputs(s);
 const active=variants.filter(v=>s[v.enabled]);
 const minimum=s.matchPeriods?0:Math.max(0,s.resale-Math.min(...active.map(v=>s[v.resale])));
 return [...new Set([...[-100000,-50000,0,50000,100000].map(offset=>Math.max(minimum,s.resale+offset)),...pairs.filter(p=>p.resale!==null).map(p=>p.resale),...resaleTaxBreakpoints(s).filter(value=>value>=minimum)])].sort((a,b)=>a-b);
}

/** Rank selected options on the common total or monthly comparison basis. */
export function ranked(c,split=false){return variants.filter(v=>c[v.key].enabled).map(v=>({name:v.name,value:comparisonValue(c[v.key],split),key:v.kind})).sort((a,b)=>a.value-b.value);}
