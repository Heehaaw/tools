
export const variants = [
 {key:"balloonLoan",kind:"balloon",name:"Balloon loan",enabled:"balloonEnabled",months:"balloonMonths",resale:"balloonResale",fields:["downPct","balloonPct","rate","easyInsurance","easyExtra"]},
 {key:"standardLoan",kind:"normal",name:"Standard loan",enabled:"normalEnabled",months:"normalMonths",resale:"normalResale",fields:["normalDownPct","normalRate","normalInsurance","normalExtra"]},
 {key:"lease",kind:"lease",name:"Operating lease",enabled:"leaseEnabled",months:"leaseMonths",resale:"leaseResale",fields:["kintoMonthly","kintoInitial","kintoInsurance","kintoExtra","leaseBuyout"]},
 {key:"cashPurchase",kind:"cash",name:"Buy outright",enabled:"cashEnabled",months:"cashMonths",resale:"cashResale",fields:["cashInsurance","cashExtra"]}
];
export const defaults = {
 balloonEnabled:true,normalEnabled:true,leaseEnabled:true,cashEnabled:true,matchPeriods:true,
 balloonMonths:36,normalMonths:36,leaseMonths:36,cashMonths:36,
 balloonResale:1000000,normalResale:1000000,leaseResale:1000000,cashResale:1000000,
 cashInsurance:3700, cashExtra:0, vatEnabled:true, recoveryPct:100, purchaseVatEligible:true, purchaseVatDelay:3, leaseVatDelay:0, purchaseVatCap:420000, opportunityRate:6, loanEnd:"sell", leaseEnd:"return", leaseBuyout:0, buyoutVatEligible:true, leaseTaxablePct:100, carName:"Toyota RAV4 Executive PHEV AWD", normalDownPct:20, normalRate:5.99, normalInsurance:3700, normalExtra:0, months:36, annualKm:20000, price:1334000, downPct:20, balloonPct:46, rate:5.99, easyInsurance:3700,
 resale:1000000, easyExtra:0, kintoMonthly:16788, kintoVatMode:"gross", vatPct:21, kintoInitial:0,
 kintoInsuranceIncluded:true, kintoInsurance:3700, kintoMaintenance:false, kintoTyres:true, kintoExtra:0,
 serviceCost:12000, serviceKm:15000, serviceMonths:12, tyrePurchase:22000, tyreResale:3000,
 tyreVisits:6, tyreVisitCost:1880, tyreStorage:1100
};

// New fields inherit the original shared term and resale when reading older scenarios.
export function migrateInputs(inputs){
 const state={...defaults,...inputs};
 for(const v of variants){
  if(!Object.hasOwn(inputs,v.months))state[v.months]=state.months;
  if(!Object.hasOwn(inputs,v.resale))state[v.resale]=state.resale;
 }
 return state;
}
export function effectiveInputs(inputs){
 const s=migrateInputs(inputs);
 for(const v of variants){
  if(!s[v.enabled])for(const key of v.fields)s[key]=defaults[key];
  if(s.matchPeriods||!s[v.enabled]){s[v.months]=s.months;s[v.resale]=s.resale;}
 }
 if(!s.leaseEnabled)s.leaseEnd="return";
 if(s.leaseEnd==="return")s.leaseResale=s.resale;
 if(!s.balloonEnabled&&!s.normalEnabled&&!s.cashEnabled)s.purchaseVatEligible=false;
 return s;
}
export function comparisonValue(result,split=false){return result.adjusted/(split?result.months:1);}
export function hasDifferentPeriods(s){return new Set(variants.filter(v=>s[v.enabled]).map(v=>s.matchPeriods?s.months:s[v.months])).size>1;}

export function validate(s){
 s=effectiveInputs(s);
 for(const [key,fallback] of Object.entries(defaults)){
  if(typeof fallback==="number"&&(!Number.isFinite(s[key])||s[key]<0))throw new Error("Enter a valid, non-negative number in every numeric field.");
  if(typeof fallback==="boolean"&&typeof s[key]!=="boolean")throw new Error("Choose an option for each checkbox.");
 }
 if(typeof s.carName!=="string"||s.carName.length>100)throw new Error("Keep the car name under 100 characters.");
 if(!["sell","keep"].includes(s.loanEnd)||!["return","buySell","buyKeep"].includes(s.leaseEnd))throw new Error("Choose a valid end-of-term option.");
 if(!["gross","net"].includes(s.kintoVatMode))throw new Error("Choose the lease quote’s VAT basis.");
 if(!Number.isInteger(s.months)||s.months<1||s.months>120)throw new Error("Use a term of 1 to 120 whole months.");
 for(const v of variants)if(!Number.isInteger(s[v.months])||s[v.months]<1||s[v.months]>120)throw new Error("Use terms of 1 to 120 whole months.");
 if(s.serviceKm<=0||s.serviceMonths<=0)throw new Error("Service intervals must be greater than zero.");
 if(s.downPct+s.balloonPct>100||s.normalDownPct>100)throw new Error("Deposit plus balloon cannot exceed 100% of the price.");
 for(const k of ["rate","normalRate","vatPct","recoveryPct","leaseTaxablePct","opportunityRate"])if(s[k]>100)throw new Error("Rates and percentages must be between 0 and 100.");
 for(const k of ["tyreVisits","purchaseVatDelay","leaseVatDelay"])if(!Number.isInteger(s[k]))throw new Error("Visits and refund delays must be whole numbers.");
 if(s.tyreResale>s.tyrePurchase)throw new Error("Tyre resale cannot exceed the tyre purchase budget.");
 if(s.leaseEnd!=="return"&&s.leaseBuyout<=0)throw new Error("Enter a positive, agreed lease buyout price.");
}
function monthlyPayment(principal,balloon,annualRate,months){
 const r=annualRate/1200;
 // log1p/expm1 keep the break-even search stable for interest rates close to zero.
 return r===0?(principal-balloon)/months:(principal-balloon*Math.exp(-months*Math.log1p(r)))*r/-Math.expm1(-months*Math.log1p(r));
}
export function calculate(s){
 s=effectiveInputs(s);validate(s);
 const n=s.months,km=s.annualKm*n/12,down=s.price*s.downPct/100,balloon=s.price*s.balloonPct/100;
 const payment=monthlyPayment(s.price-down,balloon,s.rate,s.balloonMonths),interest=payment*s.balloonMonths+balloon-(s.price-down);
 const normalDown=s.price*s.normalDownPct/100,normalPayment=monthlyPayment(s.price-normalDown,0,s.normalRate,s.normalMonths);
 const normalInterest=normalPayment*s.normalMonths-(s.price-normalDown);
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
  // Preserve the shared seasonal frequency when an option uses a different term.
  const tyreVisits=Math.ceil(s.tyreVisits*n/s.months),tyres=s.tyrePurchase+tyreVisits*(s.tyreVisitCost+s.tyreStorage)-s.tyreResale;
  const isLease=kind==="lease",isNormal=kind==="normal",isCash=kind==="cash",events=[];
  const add=(month,amount,category,type="cash")=>events.push({month,amount,category,type});
  // Treat next-month maintenance and tyre deductions as settled with the expense for this comparison.
  const refund=(month,amount,capital=false,delay=capital?s.purchaseVatDelay:0)=>{if(amount)add(month+delay,-amount,"vat");};
  const insured=isLease?kInsurance:isCash?s.cashInsurance:isNormal?s.normalInsurance:s.easyInsurance;
  if(isLease){add(0,s.kintoInitial,"initial");refund(0,inputVat(s.kintoInitial*s.leaseTaxablePct/100),false,s.leaseVatDelay);}
  else{add(0,isCash?s.price:isNormal?normalDown:down,"capital");refund(0,purchaseRefund,true);}
  for(let m=1;m<=n;m++){
   if(isLease){add(m-1,kRent,"lease");refund(m-1,inputVat(kRent*s.leaseTaxablePct/100),false,s.leaseVatDelay);}
   else if(!isCash)add(m,isNormal?normalPayment:payment,"repayment");
   add(isLease?m-1:m,insured,"insurance");
  }
  // Loan principal already includes purchase VAT. Its refund does not reduce the loan balance.
  if(!isLease&&!isNormal&&!isCash)add(n,balloon,"capital");
  if(!isLease||!s.kintoMaintenance){
   for(let i=1;i<=serviceCount;i++){add(i*servicePeriod,s.serviceCost,"maintenance");refund(i*servicePeriod,inputVat(s.serviceCost));}
  }
  if(!isLease||!s.kintoTyres){
   add(0,s.tyrePurchase,"tyres");refund(0,inputVat(s.tyrePurchase));
   for(let i=0;i<tyreVisits;i++){
    const m=i*n/tyreVisits,amount=s.tyreVisitCost+s.tyreStorage;
    add(m,amount,"tyres");refund(m,inputVat(amount));
   }
   const keep=isLease?s.leaseEnd==="buyKeep":s.loanEnd==="keep";
   add(n,-s.tyreResale,"tyres",keep?"asset":"cash");add(n,saleVat(s.tyreResale),"vat",keep?"asset":"cash");
  }
  const buyout=isLease&&s.leaseEnd!=="return";
  if(buyout){add(n,s.leaseBuyout,"buyout");refund(n,s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0,true);}
  if(!isLease||buyout){
   const keep=isLease?s.leaseEnd==="buyKeep":s.loanEnd==="keep";
   // Kept cars receive a non-cash terminal asset credit, net of estimated disposal VAT.
   add(n,-resale,"resale",keep?"asset":"cash");add(n,saleVat(resale),"vat",keep?"asset":"cash");
  }
  add(n,isLease?s.kintoExtra:isCash?s.cashExtra:isNormal?s.normalExtra:s.easyExtra,"other");
  const nominal=events.reduce((t,e)=>t+e.amount,0);
  // Carry every cash flow to the comparison end, including discounting later VAT refunds back.
  const opportunityBreakdown={upfront:0,payments:0,insurance:0,maintenance:0,tyres:0,vatDuring:0,vatAfter:0,settlement:0,other:0};
  for(const e of events){
   // Refunds before the end offset foregone return; later refunds incur a timing cost.
   const group=e.category==="vat"?(e.amount<0?(e.month>n?"vatAfter":"vatDuring"):"settlement")
    :e.category==="initial"||e.category==="capital"&&e.month===0?"upfront"
    :e.category==="repayment"||e.category==="lease"?"payments"
    :["capital","buyout","resale"].includes(e.category)?"settlement":e.category;
   opportunityBreakdown[group]+=e.amount*((1+s.opportunityRate/100)**((n-e.month)/12)-1);
  }
  const opportunity=Object.values(opportunityBreakdown).reduce((t,v)=>t+v,0);
  const adjusted=nominal+opportunity;
  const vat=events.filter(e=>e.category==="vat").reduce((t,e)=>t+e.amount,0);
  const futureRefund=-events.filter(e=>e.month>n&&e.category==="vat").reduce((t,e)=>t+e.amount,0);
  const cashToEnd=events.filter(e=>e.month<=n&&e.type==="cash").reduce((t,e)=>t+e.amount,0);
  const retainedValue=-events.filter(e=>e.type==="asset").reduce((t,e)=>t+e.amount,0);
  return {months:n,km:s.annualKm*n/12,resale,carSaleVat:saleVat(resale),depreciation:s.price-resale,serviceCount,maintenance,tyreVisits,tyres,enabled:s[variant.enabled],nominal,adjusted,opportunity,opportunityBreakdown,vat,futureRefund,cashToEnd,retainedValue,events};
 }
 const balloonLoan=option("balloon"),standardLoan=option("normal"),lease=option("lease"),cashPurchase=option("cash");
 const buyoutRefund=s.leaseEnd!=="return"&&s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0;
 return {km,down,balloon,payment,interest,normalDown,normalPayment,normalInterest,serviceCount,maintenance,tyres,kRent,kInsurance,
 depreciation:s.price-s.resale,insuredPayment:payment+s.easyInsurance,equity:s.resale-saleVat(s.resale)-balloon,purchaseRefund,buyoutRefund,
 leaseVatPerPayment:inputVat(kRent*s.leaseTaxablePct/100),leaseInitialVat:inputVat(s.kintoInitial*s.leaseTaxablePct/100),carSaleVat:saleVat(s.resale),
 balloonLoan,standardLoan,lease,cashPurchase};
}
// For split periods, vary each option's resale by the same amount from its own estimate.
export function withResale(s,resale){
 const next={...s,resale};
 if(!s.matchPeriods)for(const v of variants)next[v.resale]=s[v.resale]+resale-s.resale;
 return next;
}
export function resaleComparisons(s){
 s=effectiveInputs(s);
 const split=hasDifferentPeriods(s),value=c=>comparisonValue(c,split);
 const origin=s.matchPeriods?0:Math.max(0,s.resale-Math.min(...variants.filter(v=>s[v.enabled]).map(v=>s[v.resale])));
 const zero=calculate(withResale(s,origin)),high=calculate(withResale(s,origin+1000000));
 const active=variants.filter(v=>s[v.enabled]),pairs=[];
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const left=active[i].key,right=active[j].key,difference=value(zero[left])-value(zero[right]);
  const slope=(value(high[left])-value(high[right])-difference)/1000000;
  if(Math.abs(slope)<1e-10){pairs.push({left,right,resale:null,tied:Math.abs(difference)<.5,cheaper:difference<0?left:right});continue;}
  const resale=origin-difference/slope;
  if(resale<origin){pairs.push({left,right,resale:null,tied:false,cheaper:difference<0?left:right});continue;}
  pairs.push({left,right,resale,cost:value(calculate(withResale(s,resale))[left]),cheaperAbove:slope<0?left:right});
 }
 return pairs;
}

/** Find the non-negative nominal loan rate matching a selected benchmark, including opportunity cost. */
export function interestComparisons(s){
 s=effectiveInputs(s);
 const split=hasDifferentPeriods(s),base=calculate(s),rows=[];
 for(const loan of variants.slice(0,2).filter(v=>s[v.enabled]))for(const target of variants.slice(2).filter(v=>s[v.enabled])){
  const rateKey=loan.kind==="balloon"?"rate":"normalRate";
  const targetCost=comparisonValue(base[target.key],split);
  const difference=rate=>comparisonValue(calculate({...s,[rateKey]:rate})[loan.key],split)-targetCost;
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
