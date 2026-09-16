
export const defaults = {
 cashInsurance:3700, cashExtra:0, vatEnabled:true, recoveryPct:100, purchaseVatEligible:true, purchaseVatDelay:3, leaseVatDelay:0, purchaseVatCap:420000, opportunityRate:6, loanEnd:"sell", leaseEnd:"return", leaseBuyout:0, buyoutVatEligible:true, leaseTaxablePct:100, carName:"Toyota RAV4 Executive PHEV AWD", normalDownPct:20, normalRate:5.99, normalInsurance:3700, normalExtra:0, months:36, annualKm:20000, price:1334000, downPct:20, balloonPct:46, rate:5.99, easyInsurance:3700,
 resale:1000000, easyExtra:0, kintoMonthly:16788, kintoVatMode:"gross", vatPct:21, kintoInitial:0,
 kintoInsuranceIncluded:true, kintoInsurance:3700, kintoMaintenance:false, kintoTyres:true, kintoExtra:0,
 serviceCost:12000, serviceKm:15000, serviceMonths:12, tyrePurchase:22000, tyreResale:3000,
 tyreVisits:6, tyreVisitCost:1880, tyreStorage:1100
};

export function validate(s){
 for(const [key,fallback] of Object.entries(defaults)){
  if(typeof fallback==="number"&&(!Number.isFinite(s[key])||s[key]<0))throw new Error("Enter a valid, non-negative number in every numeric field.");
  if(typeof fallback==="boolean"&&typeof s[key]!=="boolean")throw new Error("Choose an option for each checkbox.");
 }
 if(typeof s.carName!=="string"||s.carName.length>100)throw new Error("Keep the car name under 100 characters.");
 if(!["sell","keep"].includes(s.loanEnd)||!["return","buySell","buyKeep"].includes(s.leaseEnd))throw new Error("Choose a valid end-of-term option.");
 if(!["gross","net"].includes(s.kintoVatMode))throw new Error("Choose the lease quote’s VAT basis.");
 if(!Number.isInteger(s.months)||s.months<1||s.months>120)throw new Error("Use a term of 1 to 120 whole months.");
 if(s.serviceKm<=0||s.serviceMonths<=0)throw new Error("Service intervals must be greater than zero.");
 if(s.downPct+s.balloonPct>100||s.normalDownPct>100)throw new Error("Deposit plus balloon cannot exceed 100% of the price.");
 for(const k of ["rate","normalRate","vatPct","recoveryPct","leaseTaxablePct","opportunityRate"])if(s[k]>100)throw new Error("Rates and percentages must be between 0 and 100.");
 for(const k of ["tyreVisits","purchaseVatDelay","leaseVatDelay"])if(!Number.isInteger(s[k]))throw new Error("Visits and refund delays must be whole numbers.");
 if(s.tyreResale>s.tyrePurchase)throw new Error("Tyre resale cannot exceed the tyre purchase budget.");
 if(s.leaseEnd!=="return"&&s.leaseBuyout<=0)throw new Error("Enter a positive, agreed lease buyout price.");
}
function monthlyPayment(principal,balloon,annualRate,months){
 const r=annualRate/1200;
 return r===0?(principal-balloon)/months:(principal-balloon/(1+r)**months)*r/(1-(1+r)**(-months));
}
export function calculate(s){
 validate(s);
 const n=s.months,km=s.annualKm*n/12,down=s.price*s.downPct/100,balloon=s.price*s.balloonPct/100;
 const payment=monthlyPayment(s.price-down,balloon,s.rate,n),interest=payment*n+balloon-(s.price-down);
 const normalDown=s.price*s.normalDownPct/100,normalPayment=monthlyPayment(s.price-normalDown,0,s.normalRate,n);
 const normalInterest=normalPayment*n-(s.price-normalDown);
 const servicePeriod=Math.min(s.serviceMonths,s.annualKm===0?Infinity:s.serviceKm*12/s.annualKm);
 const serviceCount=Math.floor(n/servicePeriod+1e-10),maintenance=serviceCount*s.serviceCost;
 const tyres=s.tyrePurchase+s.tyreVisits*(s.tyreVisitCost+s.tyreStorage)-s.tyreResale;
 const kRent=s.kintoMonthly*(s.kintoVatMode==="net"?1+s.vatPct/100:1),kInsurance=s.kintoInsuranceIncluded?0:s.kintoInsurance;
 const vf=s.vatPct/(100+s.vatPct),recovery=s.vatEnabled?s.recoveryPct/100:0;
 const inputVat=(gross,capital=false)=>Math.min(gross*vf,capital&&s.purchaseVatCap>0?s.purchaseVatCap:Infinity)*recovery;
 const saleVat=gross=>s.vatEnabled?gross*vf:0;
 const purchaseRefund=s.purchaseVatEligible?inputVat(s.price,true):0;
 function option(kind){
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
   for(let i=0;i<s.tyreVisits;i++){
    const m=i*n/s.tyreVisits,amount=s.tyreVisitCost+s.tyreStorage;
    add(m,amount,"tyres");refund(m,inputVat(amount));
   }
   const keep=isLease?s.leaseEnd==="buyKeep":!isCash&&s.loanEnd==="keep";
   add(n,-s.tyreResale,"tyres",keep?"asset":"cash");add(n,saleVat(s.tyreResale),"vat",keep?"asset":"cash");
  }
  const buyout=isLease&&s.leaseEnd!=="return";
  if(buyout){add(n,s.leaseBuyout,"buyout");refund(n,s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0,true);}
  if(!isLease||buyout){
   const keep=isLease?s.leaseEnd==="buyKeep":!isCash&&s.loanEnd==="keep";
   // Kept cars receive a non-cash terminal asset credit, net of estimated disposal VAT.
   add(n,-s.resale,"resale",keep?"asset":"cash");add(n,saleVat(s.resale),"vat",keep?"asset":"cash");
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
  return {nominal,adjusted,opportunity,opportunityBreakdown,vat,futureRefund,cashToEnd,retainedValue,events};
 }
 const balloonLoan=option("balloon"),standardLoan=option("normal"),lease=option("lease"),cashPurchase=option("cash");
 const buyoutRefund=s.leaseEnd!=="return"&&s.buyoutVatEligible?inputVat(s.leaseBuyout,true):0;
 return {km,down,balloon,payment,interest,normalDown,normalPayment,normalInterest,serviceCount,maintenance,tyres,kRent,kInsurance,
 depreciation:s.price-s.resale,insuredPayment:payment+s.easyInsurance,equity:s.resale-saleVat(s.resale)-balloon,purchaseRefund,buyoutRefund,
 leaseVatPerPayment:inputVat(kRent*s.leaseTaxablePct/100),leaseInitialVat:inputVat(s.kintoInitial*s.leaseTaxablePct/100),carSaleVat:saleVat(s.resale),
 balloonLoan,standardLoan,lease,cashPurchase};
}
export function resaleThresholds(s){
 const zero=calculate({...s,resale:0}),high=calculate({...s,resale:1000000});
 return ["balloonLoan","standardLoan","cashPurchase"].map(key=>{
  const base=zero[key].adjusted-zero.lease.adjusted;
  const slope=(high[key].adjusted-high.lease.adjusted-base)/1000000;
  if(Math.abs(slope)<1e-10)return {value:null,relation:Math.abs(base)<.5?"Same cost at any resale":base<0?"Always below lease":"Always above lease"};
  const threshold=-base/slope;
  return {value:threshold,relation:threshold<=0?"Already below lease at zero resale":"Cheaper above this resale"};
 });
}

export function resaleComparisons(s){
 const zero=calculate({...s,resale:0}),high=calculate({...s,resale:1000000});
 const pairs=[["balloonLoan","lease"],["standardLoan","lease"],["balloonLoan","standardLoan"],["cashPurchase","balloonLoan"],["cashPurchase","standardLoan"],["cashPurchase","lease"]];
 return pairs.map(([left,right])=>{
  const difference=zero[left].adjusted-zero[right].adjusted;
  const slope=(high[left].adjusted-high[right].adjusted-difference)/1000000;
  // Equal resale exposure cancels out, so a crossover may not exist.
  if(Math.abs(slope)<1e-10)return {left,right,resale:null,cost:null,tied:Math.abs(difference)<.5,cheaper:difference<0?left:right,gap:Math.abs(difference)};
  const resale=-difference/slope;
  if(resale<0)return {left,right,resale:null,cost:null,tied:false,cheaper:difference<0?left:right,gap:null};
  const atBreakEven=calculate({...s,resale});
  return {left,right,resale,cost:atBreakEven[left].adjusted,tied:false,cheaperAbove:slope<0?left:right};
 });
}
