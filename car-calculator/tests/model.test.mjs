import assert from 'node:assert/strict';
import {defaults,variants,inflationReturnGrid,effectiveInputs,historicalInflationTotal,historicalInflationRate,relativeResaleEstimate,nominalOpportunityRate,calculate,resaleComparisons,interestComparisons,migrateInputs,withResale,comparisonValue,hasDifferentPeriods,validateAdditionalCosts,validateHistoricalInflation} from '../src/model.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
const base=calculate(defaults);
const clean={...defaults,price:1210000,resale:605000,serviceCost:0,tyrePurchase:0,tyreResale:0,tyreVisitCost:0,tyreStorage:0,cashInsurance:0,cashExtra:0,opportunityRate:0,opportunityRateBasis:"nominal"};
let result=calculate(clean).cashPurchase;
near(result.nominal,500000);
assert.deepEqual(result.events.filter(event=>event.category==='capital'),[{month:0,amount:1210000,category:'capital',type:'cash'}]);
assert.equal(result.events.filter(event=>event.category==='repayment').length,0);
assert.ok(result.events.some(event=>event.month===3&&event.category==='vat'&&Math.abs(event.amount+210000)<1e-6));
assert.ok(result.events.some(event=>event.month===36&&event.category==='vat'&&Math.abs(event.amount-105000)<1e-6));
result=calculate({...clean,opportunityRate:6}).cashPurchase;
near(result.opportunity,1210000*(1.06**3-1)-210000*(1.06**(33/12)-1));
near(result.adjusted,result.nominal+Object.values(result.opportunityBreakdown).reduce((a,b)=>a+b,0));
near(calculate({...clean,vatEnabled:false}).cashPurchase.nominal,605000);
near(calculate({...clean,loanEnd:'keep'}).cashPurchase.retainedValue,500000);
assert.equal(calculate({...clean,months:60}).cashPurchase.events.find(event=>event.category==='resale').month,60);
near(calculate({...clean,months:2}).cashPurchase.futureRefund,210000);
near(calculate({...defaults,rate:8}).standardLoan.adjusted,base.standardLoan.adjusted);
near(calculate({...defaults,normalRate:8}).balloonLoan.adjusted,base.balloonLoan.adjusted);
assert.ok(calculate({...defaults,rate:8}).interest>base.interest);
assert.ok(calculate({...defaults,normalRate:8}).normalInterest>base.normalInterest);
for(const state of [defaults,{...defaults,leaseEnd:'buySell',leaseBuyout:900000},{...defaults,opportunityRate:0,vatEnabled:false},{...defaults,rate:8,normalRate:3}]){
 const pairs=resaleComparisons(state);assert.equal(pairs.length,6);
 for(const pair of pairs){
  if(pair.resale!==null){
   const at=calculate({...state,resale:pair.resale});near(at[pair.left].adjusted,at[pair.right].adjusted);
   const above=calculate({...state,resale:pair.resale+10000});
   assert.ok(above[pair.cheaperAbove].adjusted<above[pair.cheaperAbove===pair.left?pair.right:pair.left].adjusted);
  }
 }
}
console.log('PASS: foundational financial calculations and all six resale break-even pairs.');

// Split periods and solvers stay independent of browser state.
const split={...defaults,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48,leaseMonths:36,cashMonths:60,balloonResale:1100000,normalResale:880000,leaseResale:1000000,cashResale:750000};
const splitCost=calculate(split);
assert.equal(hasDifferentPeriods(split),true);
for(const v of variants){
 const months=split[v.months],result=splitCost[v.key];
 const reference=calculate({...defaults,months,resale:split[v.resale]})[v.key];
 near(result.adjusted,reference.adjusted);near(result.opportunity,reference.opportunity);
 assert.equal(result.months,months);assert.equal(result.km,20000*months/12);
 assert.equal(result.serviceCount,Math.floor(months/9));
}
const shortCash=calculate({...split,cashMonths:2}).cashPurchase;
near(shortCash.futureRefund,splitCost.cashPurchase.events.find(e=>e.month===3&&e.category==='vat').amount*-1);
const buyout=calculate({...split,leaseEnd:'buySell',leaseBuyout:800000,leaseMonths:24}).lease;
assert.ok(buyout.events.some(e=>e.month===27&&e.category==='vat'&&e.amount<0));
for(const p of resaleComparisons(split))if(p.resale!==null){
 const at=calculate(withResale(split,p.resale));near(comparisonValue(at[p.left],true),comparisonValue(at[p.right],true));
}
for(const state of [defaults,split,{...defaults,vatEnabled:false,opportunityRate:0},{...defaults,opportunityRate:12,leaseEnd:'buySell',leaseBuyout:800000}]){
 for(const match of interestComparisons(state))if(match.rate!==null){
  const rateKey=match.loan==='balloonLoan'?'rate':'normalRate';
  const at=calculate({...state,[rateKey]:match.rate});
  near(comparisonValue(at[match.loan],hasDifferentPeriods(state)),comparisonValue(at[match.target],hasDifferentPeriods(state)));
 }
}
assert.ok(interestComparisons({...defaults,kintoMonthly:0,kintoMaintenance:true,kintoTyres:true}).filter(p=>p.target==='lease').every(p=>p.status==='below-zero'));
assert.ok(interestComparisons({...defaults,kintoMonthly:10000000}).filter(p=>p.target==='lease').every(p=>p.status==='above-range'));
assert.ok(interestComparisons({...defaults,downPct:100,balloonPct:0,normalDownPct:100}).filter(p=>p.target==='cashPurchase').every(p=>p.status==='equal'));
assert.ok(interestComparisons({...defaults,opportunityRate:0,opportunityRateBasis:'nominal',rate:0,normalRate:0}).filter(p=>p.target==='cashPurchase').every(p=>p.rate===0));
console.log('PASS: independent periods, resale crossings, interest matching and solver boundaries.');

// Return migration and validation are model responsibilities.
assert.equal(defaults.opportunityRate,8.5);assert.equal(defaults.opportunityRateBasis,'nominal');
near(nominalOpportunityRate(defaults),8.5);
const oldInputs={...defaults,opportunityRate:6};delete oldInputs.opportunityRateBasis;delete oldInputs.inflationRate;
const oldMigrated=migrateInputs(oldInputs);
assert.equal(oldMigrated.opportunityRateBasis,'nominal');assert.equal(oldMigrated.inflationRate,0);
near(calculate(oldInputs).cashPurchase.adjusted,713776.577185387);
assert.throws(()=>calculate({...defaults,opportunityRateBasis:'unknown'}));
assert.throws(()=>calculate({...defaults,opportunityRate:301}));
assert.throws(()=>calculate({...defaults,opportunityRateBasis:'real',opportunityRate:101}));
assert.throws(()=>calculate({...defaults,inflationRate:101}));
console.log('PASS: nominal return defaults, legacy migration and return validation.');

// Tax estimates affect dated model cash flows without changing invoices or VAT eligibility.
const taxState={...clean,months:30,incomeTaxEnabled:true,incomeTaxRate:30,cashDeductions:100000,cashTaxValue:200000};
const taxed=calculate(taxState),untaxed=calculate({...taxState,incomeTaxEnabled:false});
near(taxed.cashPurchase.taxSavings,30000);near(taxed.cashPurchase.taxableSale,300000);near(taxed.cashPurchase.saleTax,90000);
near(taxed.cashPurchase.nominal,untaxed.cashPurchase.nominal-30000+90000);
assert.deepEqual(taxed.cashPurchase.events.filter(e=>e.category==='taxSavings').map(({month,amount})=>({month,amount})),[{month:12,amount:-12000},{month:24,amount:-12000},{month:30,amount:-6000}]);
near(taxed.payment,untaxed.payment);near(taxed.purchaseRefund,untaxed.purchaseRefund);
near(calculate({...taxState,vatEnabled:false}).cashPurchase.saleTax,(605000-200000)*.3);
near(calculate({...taxState,matchSaleTaxRate:false,saleTaxRate:0}).cashPurchase.saleTax,0);
near(calculate({...taxState,matchSaleTaxRate:false,saleTaxRate:15}).cashPurchase.saleTax,45000);
near(calculate({...taxState,cashTaxValue:900000}).cashPurchase.saleTax,0);
near(calculate({...taxState,loanEnd:'keep'}).cashPurchase.saleTax,0);
near(calculate({...taxState,leaseEnd:'return',leaseDeductions:200000}).lease.taxSavings,60000);
near(calculate({...taxState,leaseEnd:'return'}).lease.saleTax,0);
near(calculate({...taxState,leaseEnd:'buyKeep',leaseBuyout:100000}).lease.saleTax,0);
near(calculate({...taxState,leaseEnd:'buySell',leaseBuyout:100000,leaseTaxValue:100000}).lease.saleTax,120000);
const taxReturn=calculate({...taxState,opportunityRate:6}).cashPurchase;
near(taxReturn.opportunityBreakdown.taxSavings,-12000*(1.06**1.5-1)-12000*(1.06**.5-1));
near(taxReturn.adjusted,taxReturn.events.reduce((sum,e)=>sum+e.amount*1.06**((30-e.month)/12),0));
near(taxReturn.nominal,taxReturn.cashToEnd-taxReturn.retainedValue-taxReturn.futureRefund);
for(const state of [taxState,{...split,incomeTaxEnabled:true,incomeTaxRate:40,balloonTaxValue:300000,normalTaxValue:800000,cashTaxValue:600000,leaseEnd:'buySell',leaseBuyout:700000,leaseTaxValue:700000}]){
 for(const pair of resaleComparisons(state).filter(p=>p.resale!==null)){
  const at=calculate(withResale(state,pair.resale));
  near(comparisonValue(at[pair.left],hasDifferentPeriods(state)),comparisonValue(at[pair.right],hasDifferentPeriods(state)));
 }
}
const hiddenTax={...defaults,incomeTaxEnabled:false,incomeTaxRate:null,saleTaxRate:null,cashDeductions:null,cashTaxValue:null};
for(const v of variants)near(calculate(hiddenTax)[v.key].adjusted,base[v.key].adjusted);
const taxLegacy={...defaults};for(const key of Object.keys(taxLegacy))if(/Tax|Deductions/.test(key)&&!['purchaseVatCap','leaseTaxablePct'].includes(key))delete taxLegacy[key];
assert.equal(migrateInputs(taxLegacy).incomeTaxEnabled,false);
for(const v of variants)near(calculate(taxLegacy)[v.key].adjusted,base[v.key].adjusted);
assert.throws(()=>calculate({...taxState,incomeTaxRate:101}));
assert.throws(()=>calculate({...taxState,matchSaleTaxRate:false,saleTaxRate:101}));
const multipleCrossings={...defaults,vatEnabled:false,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,cashMonths:60,normalEnabled:false,leaseEnabled:false,incomeTaxEnabled:true,incomeTaxRate:90,balloonTaxValue:2000000,cashTaxValue:4000000};
const crossings=resaleComparisons(multipleCrossings);assert.equal(crossings.length,3);
for(const pair of crossings){
 const at=calculate(withResale(multipleCrossings,pair.resale));near(at.balloonLoan.adjusted/24,at.cashPurchase.adjusted/60);
 const above=calculate(withResale(multipleCrossings,pair.resale+100));
 assert.ok(comparisonValue(above[pair.cheaperAbove],true)<comparisonValue(above[pair.cheaperAbove==='balloonLoan'?'cashPurchase':'balloonLoan'],true));
}
console.log('PASS: optional income tax, sale tax, dated savings and tax-threshold crossings.');

// Inflation and opportunity switches value the same dated events independently.
assert.equal(defaults.inflationRate,2.5);
for(const state of [defaults,{...split,opportunityRateBasis:'nominal',inflationRate:4,leaseEnd:'buySell',leaseBuyout:800000,purchaseVatDelay:8,incomeTaxEnabled:true,incomeTaxRate:30,cashDeductions:100000,cashTaxValue:300000},{...defaults,months:2,purchaseVatDelay:8,loanEnd:'keep'}]){
 const raw=calculate(state),annual=raw.nominalReturn/100,inflation=state.inflationRate/100;
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const valued=calculate(state,{opportunity,todayMoney});
  for(const v of variants){
   const value=valued[v.key],term=value.months/12;
   const expected=value.events.reduce((sum,e)=>sum+e.amount*(opportunity?(1+annual)**(term-e.month/12):1)/(todayMoney?(1+inflation)**(opportunity?term:e.month/12):1),0);
   near(value.adjusted,expected);
   near(value.adjusted,value.nominal+value.inflationAdjustment+value.opportunity);
   near(value.opportunity,Object.values(value.opportunityBreakdown).reduce((a,b)=>a+b,0));
   if(!opportunity)near(value.opportunity,0);
   if(!todayMoney)near(value.inflationAdjustment,0);
   assert.deepEqual(value.events,raw[v.key].events);
  }
  for(const pair of resaleComparisons(state,{opportunity,todayMoney}).filter(p=>p.resale!==null)){
   const at=calculate(withResale(state,pair.resale),{opportunity,todayMoney});
   near(comparisonValue(at[pair.left],hasDifferentPeriods(state)),comparisonValue(at[pair.right],hasDifferentPeriods(state)));
  }
  for(const match of interestComparisons(state,{opportunity,todayMoney}).filter(m=>m.rate!==null)){
   const at=calculate({...state,[match.loan==='balloonLoan'?'rate':'normalRate']:match.rate},{opportunity,todayMoney});
   near(comparisonValue(at[match.loan],hasDifferentPeriods(state)),comparisonValue(at[match.target],hasDifferentPeriods(state)));
  }
 }
}
const noInflation={...defaults,inflationRate:0};
for(const opportunity of [true,false])for(const v of variants)near(calculate(noInflation,{opportunity,todayMoney:true})[v.key].adjusted,calculate(noInflation,{opportunity,todayMoney:false})[v.key].adjusted);
for(const rate of [0,3,4.5])assert.equal(migrateInputs({...defaults,inflationRate:rate}).inflationRate,rate);
const oldNoInflation={...defaults};delete oldNoInflation.inflationRate;delete oldNoInflation.opportunityRateBasis;
assert.equal(migrateInputs(oldNoInflation).inflationRate,0);
console.log('PASS: independent inflation and opportunity valuation, including delayed receipts and solver parity.');

// Repayment duration remains independent from ownership duration.
const longOwnership={...defaults,months:72,balloonMatchOwnership:false,normalMatchOwnership:false,balloonLoanMonths:36,normalLoanMonths:48};
const longResult=calculate(longOwnership);
for(const [key,term] of [['balloonLoan',36],['standardLoan',48]]){
 const option=longResult[key];
 assert.equal(option.months,72);assert.equal(option.loanMonths,term);
 assert.equal(option.events.filter(e=>e.category==='repayment').length,term);
 assert.equal(option.events.filter(e=>e.category==='insurance').length,72);
 near(option.remainingPrincipal,0);
 near(option.cashToEnd-option.retainedValue-option.futureRefund,option.nominal);
}
assert.ok(longResult.balloonLoan.events.some(e=>e.category==='capital'&&e.month===36&&e.amount===longResult.balloon));
assert.ok(!longResult.balloonLoan.events.some(e=>e.category==='capital'&&e.month===72));
const shortOwnership={...defaults,months:36,balloonMatchOwnership:false,normalMatchOwnership:false,balloonLoanMonths:72,normalLoanMonths:60};
for(const rate of [0,1e-10,5.99,100]){
 const result=calculate({...shortOwnership,rate,normalRate:rate});
 for(const v of variants.slice(0,2)){
  const option=result[v.key],principal=shortOwnership.price*(1-(v.kind==='balloon'?shortOwnership.downPct:shortOwnership.normalDownPct)/100);
  const payment=v.kind==='balloon'?result.payment:result.normalPayment;
  let balance=principal,interest=0;
  for(let month=1;month<=36;month++){interest+=balance*rate/1200;balance=balance*(1+rate/1200)-payment;}
  near(option.remainingPrincipal,balance);near(option.loanInterest,interest);
  assert.equal(option.events.filter(e=>e.category==='repayment').length,36);
  assert.ok(option.events.some(e=>e.category==='capital'&&e.type==='cash'&&e.month===36&&Math.abs(e.amount-balance)<1e-6));
  const kept=calculate({...shortOwnership,rate,normalRate:rate,loanEnd:'keep'})[v.key];
  near(kept.nominal,option.nominal);near(kept.cashToEnd-kept.retainedValue-kept.futureRefund,kept.nominal);
  assert.ok(kept.events.some(e=>e.category==='capital'&&e.type==='asset'&&Math.abs(e.amount-balance)<1e-6));
 }
}
for(const scenario of [longOwnership,shortOwnership,{...shortOwnership,loanEnd:'keep'},{...longOwnership,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:60}]){
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const valued=calculate(scenario,{opportunity,todayMoney});
  for(const v of variants){
   const option=valued[v.key];
   const expected=option.events.reduce((sum,e)=>sum+e.amount*(opportunity?(1+scenario.opportunityRate/100)**((option.months-e.month)/12):1)/(todayMoney?(1+scenario.inflationRate/100)**((opportunity?option.months:e.month)/12):1),0);
   near(option.adjusted,expected);
  }
  for(const item of interestComparisons(scenario,{opportunity,todayMoney}).filter(i=>i.rate!==null)){
   const at=calculate({...scenario,[item.loan==='balloonLoan'?'rate':'normalRate']:item.rate},{opportunity,todayMoney});
   near(comparisonValue(at[item.loan],hasDifferentPeriods(scenario)),comparisonValue(at[item.target],hasDifferentPeriods(scenario)));
  }
 }
}
const oldTerms={...defaults,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48};
for(const key of ['balloonMatchOwnership','normalMatchOwnership','balloonLoanMonths','normalLoanMonths'])delete oldTerms[key];
const migratedTerms=migrateInputs(oldTerms);
assert.equal(migratedTerms.balloonMatchOwnership,true);assert.equal(migratedTerms.balloonLoanMonths,24);assert.equal(migratedTerms.normalLoanMonths,48);
near(calculate(oldTerms).balloonLoan.adjusted,calculate({...oldTerms,balloonMatchOwnership:false,balloonLoanMonths:24}).balloonLoan.adjusted);
assert.throws(()=>calculate({...shortOwnership,normalLoanMonths:0}),/1 to 120/);
assert.throws(()=>calculate({...shortOwnership,normalLoanMonths:3.5}),/whole months/);
near(calculate({...shortOwnership,balloonPct:80,rate:0}).balloonLoan.remainingPrincipal,shortOwnership.price*.8);
near(calculate({...shortOwnership,downPct:100,balloonPct:0,normalDownPct:100}).normalInterest,0);
console.log('PASS: independent repayment and ownership periods, early exits, kept debt, migration and rate boundaries.');

for(const months of [1,6,7,12,24,37,72]){
 const result=calculate({...defaults,months:36,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:months,normalMonths:months,leaseMonths:months,cashMonths:months,kintoTyres:false,balloonMatchOwnership:false,balloonLoanMonths:12});
 for(const v of variants){
  const option=result[v.key],visits=option.events.filter(e=>e.category==='tyres'&&e.amount===defaults.tyreVisitCost+defaults.tyreStorage);
  assert.equal(option.tyreVisits,Math.ceil(months/6));
  assert.deepEqual(visits.map(e=>e.month),Array.from({length:Math.ceil(months/6)},(_,i)=>i*6));
 }
}
for(const tyreVisits of [0,2,17,null]){
 const old={...defaults,months:48,tyreVisits};
 near(calculate(old).balloonLoan.adjusted,calculate({...old,tyreVisits:8}).balloonLoan.adjusted);
}
console.log('PASS: fixed seasonal costs follow each ownership period on a six-month schedule.');

// Cost components reconcile on every valuation basis.
const componentScenarios=[defaults,longOwnership,shortOwnership,{...shortOwnership,loanEnd:'keep'},
 {...split,incomeTaxEnabled:true,incomeTaxRate:25,balloonDeductions:200000,normalDeductions:150000,leaseDeductions:300000,cashDeductions:100000,leaseEnd:'buySell',leaseBuyout:800000,purchaseVatDelay:9,leaseVatDelay:5,kintoTyres:false,kintoMaintenance:false,kintoInsuranceIncluded:false},
 {...defaults,months:7,rate:0,normalRate:0,vatEnabled:false,loanEnd:'keep',leaseEnd:'buyKeep',leaseBuyout:800000}];
for(const input of componentScenarios)for(const todayMoney of [false,true])for(const opportunity of [false,true]){
 const result=calculate(input,{todayMoney,opportunity});
 for(const v of variants){
  const option=result[v.key],parts=option.costComponents;
  near(Object.values(parts).reduce((sum,amount)=>sum+amount,0),option.beforeOpportunity);
  near(option.beforeOpportunity+option.opportunity,option.adjusted);
  const discount=month=>todayMoney?(1+input.inflationRate/100)**(month/12):1;
  if(v.kind!=='lease'||input.leaseEnd!=='return')near(parts.resale,-option.resale/discount(option.months));
  if(v.kind==='cash')near(parts.purchase,input.price);
  if(v.kind==='lease')near(parts.purchase,input.leaseEnd==='return'?0:input.leaseBuyout/discount(option.months));
  if(v.loanMonths){
   const standard=v.kind==='normal',rate=(standard?input.normalRate:input.rate)/1200,payment=standard?result.normalPayment:result.payment;
   const down=input.price*(standard?input.normalDownPct:input.downPct)/100;
   let balance=input.price-down,valuedInterest=0,valuedPrincipal=down;
   for(let month=1;month<=option.paidMonths;month++){
    const interest=balance*rate,principal=payment-interest;
    valuedInterest+=interest/discount(month);valuedPrincipal+=principal/discount(month);balance-=principal;
   }
   valuedPrincipal+=option.balloonPaid/discount(option.loanMonths)+option.remainingPrincipal/discount(option.months);
   near(parts.interest,valuedInterest);near(parts.purchase,valuedPrincipal);
  }
 }
}
console.log('PASS: cost components reconcile with totals, inflation, principal and interest timing.');

// Relative depreciation and historical inputs stay pure and preserve their callers.
const relativeInput={...defaults,resaleMode:'relative',historicalMatchPeriod:false,historicalNewPrice:1200000,historicalUsedPrice:1000000,historicalYears:3,historicalInflationPct:10,resale:765432};
const retention=1000000/(1200000*1.10),forecast=1334000*retention*1.025**3;
const estimate=relativeResaleEstimate(relativeInput);
near(estimate.historicalPriceToday,1320000);near(estimate.retainedShare,retention);near(estimate.todayValue,1334000*retention);near(estimate.nominalValue,forecast);
for(const months of [12,36,72]){
 const result=calculate({...relativeInput,months});
 near(result.cashPurchase.resale,1334000*retention**(months/36)*1.025**(months/12));
}
const relativeSplit={...relativeInput,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48,cashMonths:60,leaseMonths:36,leaseEnd:'buySell',leaseBuyout:800000};
for(const input of [relativeInput,relativeSplit,{...relativeSplit,incomeTaxEnabled:true,incomeTaxRate:20,balloonTaxValue:800000,normalTaxValue:600000}]){
 const stateBefore=JSON.stringify(input),resolved=effectiveInputs(input),direct={...resolved,resaleMode:'direct'};
 for(const todayMoney of [false,true])for(const opportunity of [false,true]){
  const relative=calculate(input,{todayMoney,opportunity}),manual=calculate(direct,{todayMoney,opportunity});
  for(const v of variants)near(relative[v.key].adjusted,manual[v.key].adjusted);
  for(const point of resaleComparisons(input,{todayMoney,opportunity}).filter(p=>p.resale!==null)){
   const at=calculate(withResale(input,point.resale),{todayMoney,opportunity});
   near(comparisonValue(at[point.left],hasDifferentPeriods(input)),comparisonValue(at[point.right],hasDifferentPeriods(input)));
  }
  for(const match of interestComparisons(input,{todayMoney,opportunity}).filter(p=>p.rate!==null)){
   const at=calculate({...input,[match.loan==='balloonLoan'?'rate':'normalRate']:match.rate},{todayMoney,opportunity});
   near(comparisonValue(at[match.loan],hasDifferentPeriods(input)),comparisonValue(at[match.target],hasDifferentPeriods(input)));
  }
 }
 assert.equal(JSON.stringify(input),stateBefore);
 const shifted=withResale(input,resolved.resale+10000);
 assert.equal(shifted.resaleMode,'direct');
 for(const v of variants)near(calculate(shifted)[v.key].resale,calculate(input)[v.key].resale+10000);
}
near(calculate({...relativeInput,historicalUsedPrice:0}).cashPurchase.resale,0);
near(calculate({...relativeInput,historicalInflationPct:0,inflationRate:0}).cashPurchase.resale,1334000*1000000/1200000);
assert.throws(()=>calculate({...relativeInput,historicalNewPrice:0}),/positive/);
assert.throws(()=>calculate({...relativeInput,historicalMonths:0}),/positive/);
assert.throws(()=>calculate({...relativeInput,resaleMode:'unknown'}),/direct resale/);
const legacyRelative={...defaults};for(const key of ['resaleMode','historicalNewPrice','historicalUsedPrice','historicalYears','historicalInflationPct'])delete legacyRelative[key];
assert.equal(migrateInputs(legacyRelative).resaleMode,'direct');near(calculate(legacyRelative).cashPurchase.adjusted,calculate(defaults).cashPurchase.adjusted);

const linkedHistory={...relativeInput,historicalMatchPeriod:true,historicalMonths:24,months:60};
near(relativeResaleEstimate(linkedHistory).todayValue,linkedHistory.price*1000000/(1200000*1.1));
near(calculate(linkedHistory).cashPurchase.resale,relativeResaleEstimate(linkedHistory).nominalValue);
assert.equal(effectiveInputs(linkedHistory).historicalMonths,60);
assert.equal(linkedHistory.historicalMonths,24);
const unlinkedHistory={...linkedHistory,historicalMatchPeriod:false};
near(relativeResaleEstimate(unlinkedHistory).todayValue,linkedHistory.price*(1000000/(1200000*1.1))**(60/24));
const oldAgeScenario={...relativeInput,historicalYears:4.5};delete oldAgeScenario.historicalMonths;delete oldAgeScenario.historicalMatchPeriod;
const migratedAge=migrateInputs(oldAgeScenario);
assert.equal(migratedAge.historicalMonths,54);assert.equal(migratedAge.historicalMatchPeriod,false);
near(calculate(migratedAge).cashPurchase.resale,linkedHistory.price*(1000000/(1200000*1.1))**(36/54)*1.025**3);
console.log('PASS: relative depreciation, separate horizons, historical age migration and solver parity.');

// Heatmap cells reproduce full model calculations without mutating inputs.
for(const input of [defaults,{...relativeSplit,incomeTaxEnabled:true,incomeTaxRate:20,saleTaxRate:20,matchSaleTaxRate:false,balloonTaxValue:800000},{...defaults,months:2,purchaseVatDelay:8,leaseEnd:'buyKeep',leaseBuyout:700000,normalEnabled:false}]){
 const before=JSON.stringify(input);
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const grid=inflationReturnGrid(input,[0,5],[0,10],{opportunity,todayMoney});
  for(const cell of grid){
   const expected=calculate({...input,inflationRate:cell.inflation,opportunityRate:cell.rate,opportunityRateBasis:'nominal'},{opportunity,todayMoney});
   for(const option of cell.costs){near(option.total,expected[option.key].adjusted);near(option.value,comparisonValue(expected[option.key],hasDifferentPeriods(input)));}
   assert.ok(cell.costs.every((option,index)=>index===0||option.value>=cell.costs[index-1].value));
  }
 }
 assert.equal(JSON.stringify(input),before);
}
console.log('PASS: inflation and return heatmap cells match full calculations and keep inputs unchanged.');

// Historical replay derives inflation while retaining the month-zero cash-flow model.
const historicalReplay={...clean,pastOwnership:true,resaleMode:'relative',price:340000,historicalNewPrice:340000,historicalUsedPrice:240000,historicalInflationPct:45.6,months:72,historicalMatchPeriod:true,vatEnabled:false,inflationRate:2.5,inflationMode:'total',inflationTotalPct:45.6};
for(const months of [72,80,84]){
 const replay={...historicalReplay,months},effective=effectiveInputs(replay);
 near((1+effective.inflationRate/100)**(months/12),1.456);
 near(relativeResaleEstimate(replay).nominalValue,240000);
 near(effective.resale,240000);
 near(calculate(replay,{opportunity:false,todayMoney:false}).cashPurchase.adjusted,100000);
 near(calculate(replay,{opportunity:false,todayMoney:true}).cashPurchase.adjusted,340000-240000/1.456);
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  const actual=calculate(replay,{opportunity,todayMoney});
  const equivalent=calculate({...effective,pastOwnership:false,resaleMode:'direct'},{opportunity,todayMoney});
  for(const v of variants)near(actual[v.key].adjusted,equivalent[v.key].adjusted);
 }
}
assert.equal(migrateInputs({price:123000}).pastOwnership,false);
near(effectiveInputs({...historicalReplay,pastOwnership:false}).inflationRate,(1.456**(1/6)-1)*100);
near(effectiveInputs({...historicalReplay,resaleMode:'direct'}).inflationRate,(1.456**(1/6)-1)*100);
assert.ok(Number.isNaN(effectiveInputs({...historicalReplay,inflationTotalPct:null}).inflationRate));
near(effectiveInputs({...historicalReplay,inflationTotalPct:0}).inflationRate,0);
const independentReplay={...historicalReplay,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,historicalMatchPeriod:false,historicalMonths:84};
near((1+effectiveInputs(independentReplay).inflationRate/100)**6,1.456);
assert.equal(effectiveInputs(independentReplay).historicalMonths,84);
assert.equal(independentReplay.historicalMonths,84);
console.log('PASS: historical ownership replay, exact resale, shared inflation and direct-mode equivalence.');

// Additional costs form their own dated cash-flow category.
const legacyAdditional={...defaults};
for(const key of ['additionalCostMode','additionalCostAnnual','additionalCostYears','leaseAdditionalCosts'])delete legacyAdditional[key];
const legacyAdditionalResult=calculate(legacyAdditional);
for(const v of variants){
 assert.equal(legacyAdditionalResult[v.key].additionalCosts,0);
 assert.equal(legacyAdditionalResult[v.key].costComponents.additional,0);
 assert.equal(legacyAdditionalResult[v.key].opportunityBreakdown.additional,0);
 assert.equal(legacyAdditionalResult[v.key].events.some(event=>event.category==='additional'),false);
}

const annualAdditional={...defaults,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:30,normalMonths:18,leaseMonths:30,cashMonths:12,additionalCostMode:'annual',additionalCostAnnual:12000,vatEnabled:false,opportunityRate:0,inflationRate:0,easyExtra:777};
const annualAdditionalResult=calculate(annualAdditional);
assert.deepEqual(annualAdditionalResult.balloonLoan.events.filter(event=>event.category==='additional').map(({month,amount})=>({month,amount})),[
 {month:12,amount:12000},{month:24,amount:12000},{month:30,amount:6000}
]);
assert.equal(annualAdditionalResult.balloonLoan.additionalCosts,30000);
assert.equal(annualAdditionalResult.standardLoan.additionalCosts,18000);
assert.equal(annualAdditionalResult.cashPurchase.additionalCosts,12000);
assert.equal(annualAdditionalResult.lease.additionalCosts,0);
const leaseAdditional=calculate({...annualAdditional,leaseAdditionalCosts:true});
assert.equal(leaseAdditional.lease.additionalCosts,30000);
assert.deepEqual(leaseAdditional.lease.events.filter(event=>event.category==='additional').map(({month,amount})=>({month,amount})),[
 {month:12,amount:12000},{month:24,amount:12000},{month:30,amount:6000}
]);
assert.equal(calculate({...annualAdditional,leaseAdditionalCosts:true,kintoMaintenance:true}).lease.additionalCosts,30000);
const withoutAdditional=calculate({...annualAdditional,additionalCostAnnual:0});
assert.equal(annualAdditionalResult.balloonLoan.maintenance,withoutAdditional.balloonLoan.maintenance);
assert.equal(annualAdditionalResult.balloonLoan.tyres,withoutAdditional.balloonLoan.tyres);
assert.equal(annualAdditionalResult.balloonLoan.costComponents.other,withoutAdditional.balloonLoan.costComponents.other);
assert.equal(annualAdditionalResult.balloonLoan.costComponents.additional,30000);
const taxedAdditional=calculate({...taxState,additionalCostAnnual:12000});
assert.equal(taxedAdditional.cashPurchase.taxSavings,taxed.cashPurchase.taxSavings);
assert.deepEqual(taxedAdditional.cashPurchase.events.filter(event=>event.category==='taxSavings'),taxed.cashPurchase.events.filter(event=>event.category==='taxSavings'));

const yearlyAdditional={...defaults,months:30,additionalCostMode:'yearly',additionalCostAnnual:36000,additionalCostYears:[12000,24000],vatEnabled:false,opportunityRate:0,inflationRate:0};
const yearlyAdditionalResult=calculate(yearlyAdditional);
assert.deepEqual(yearlyAdditionalResult.cashPurchase.events.filter(event=>event.category==='additional').map(({month,amount})=>({month,amount})),[
 {month:12,amount:12000},{month:24,amount:24000},{month:30,amount:18000}
]);
assert.equal(yearlyAdditionalResult.cashPurchase.additionalCosts,54000);
assert.deepEqual(effectiveInputs({...yearlyAdditional,months:12,additionalCostAnnual:null,additionalCostYears:[12000,null]}).additionalCostYears,[12000,null]);
assert.doesNotThrow(()=>calculate({...yearlyAdditional,months:12,additionalCostAnnual:null,additionalCostYears:[12000,null]}));
assert.doesNotThrow(()=>calculate({...yearlyAdditional,months:12,matchPeriods:true,balloonMatchPeriod:true,normalMatchPeriod:true,leaseMatchPeriod:true,cashMatchPeriod:true,pastHistoricalMatchPeriod:true,balloonMonths:120,additionalCostAnnual:null,additionalCostYears:[12000]}));
assert.throws(()=>calculate({...yearlyAdditional,months:24,additionalCostAnnual:null,additionalCostYears:[12000]}),/fallback/);
assert.throws(()=>calculate({...yearlyAdditional,months:24,additionalCostYears:[12000,null]}),/active yearly/);

const additionalVat=calculate({...defaults,months:12,additionalCostAnnual:12100,recoveryPct:50});
const noAdditionalVat=calculate({...defaults,months:12,additionalCostAnnual:0,recoveryPct:50});
assert.equal(additionalVat.cashPurchase.additionalCosts,12100);
near(additionalVat.cashPurchase.costComponents.additional,12100);
near(additionalVat.cashPurchase.costComponents.vat-noAdditionalVat.cashPurchase.costComponents.vat,-1050);
assert.ok(additionalVat.cashPurchase.events.some(event=>event.category==='vat'&&event.month===12&&Math.abs(event.amount+1050)<1e-6));

const valuedAdditional={...defaults,months:24,additionalCostAnnual:12000,vatEnabled:false,opportunityRate:6,inflationRate:2.5};
const nominalAdditional=calculate(valuedAdditional,{opportunity:true,todayMoney:false}).cashPurchase;
near(nominalAdditional.additionalCosts,24000);
near(nominalAdditional.costComponents.additional,24000);
near(nominalAdditional.opportunityBreakdown.additional,12000*(1.06-1));
const presentAdditional=calculate(valuedAdditional,{opportunity:false,todayMoney:true}).cashPurchase;
near(presentAdditional.costComponents.additional,12000/1.025+12000/1.025**2);
near(presentAdditional.opportunityBreakdown.additional,0);

assert.doesNotThrow(()=>validateAdditionalCosts({...defaults,months:24,additionalCostMode:'yearly',additionalCostAnnual:null,additionalCostYears:[12000,null]},{allowDrafts:true}));
assert.doesNotThrow(()=>calculate({...defaults,balloonEnabled:false,normalEnabled:false,cashEnabled:false,leaseEnabled:true,leaseAdditionalCosts:false,additionalCostMode:'yearly',additionalCostAnnual:null,additionalCostYears:[]}));
assert.throws(()=>calculate({...defaults,additionalCostMode:'monthly'}),/annual or year-specific/);
assert.throws(()=>calculate({...defaults,additionalCostYears:{}}),/up to 10/);
assert.throws(()=>calculate({...defaults,additionalCostYears:Array(11).fill(0)}),/up to 10/);
assert.throws(()=>calculate({...defaults,additionalCostYears:[-1]}),/non-negative/);
assert.throws(()=>calculate({...defaults,additionalCostYears:['1000']}),/non-negative/);
assert.throws(()=>calculate({...defaults,additionalCostYears:[Number.NaN]}),/non-negative/);
assert.throws(()=>calculate({...defaults,additionalCostAnnual:null}),/annual additional/);
console.log('PASS: annual and year-specific additional costs, partial years, fallback, lease inclusion, VAT, valuation, isolation, legacy defaults and validation.');

// Historical yearly inflation compounds into the existing cumulative/equivalent-annual model.
const legacyInflation={...relativeInput};
for(const key of ['historicalInflationMode','historicalInflationYears'])delete legacyInflation[key];
const migratedInflation=migrateInputs(legacyInflation);
assert.equal(migratedInflation.historicalInflationMode,'total');
assert.deepEqual(migratedInflation.historicalInflationYears,[]);
assert.notEqual(migratedInflation.historicalInflationYears,defaults.historicalInflationYears);
for(const v of variants)near(calculate(legacyInflation)[v.key].adjusted,calculate(relativeInput)[v.key].adjusted);

const twoYearInflation={...relativeInput,historicalMatchPeriod:false,historicalMonths:24,historicalInflationMode:'yearly',historicalInflationPct:null,historicalInflationYears:[10,20]};
near(historicalInflationTotal(twoYearInflation),32);
near(historicalInflationRate(twoYearInflation),(Math.sqrt(1.32)-1)*100);
const effectiveTwoYear=effectiveInputs(twoYearInflation);
near(effectiveTwoYear.historicalInflationPct,32);
near(historicalInflationTotal(effectiveTwoYear),32);
near(relativeResaleEstimate(twoYearInflation).historicalPriceToday,twoYearInflation.historicalNewPrice*1.32);
assert.doesNotThrow(()=>calculate(twoYearInflation));

const partialHistorical={...twoYearInflation,historicalMonths:30,historicalInflationYears:[10,20,30]};
near(historicalInflationTotal(partialHistorical),(1.1*1.2*Math.sqrt(1.3)-1)*100);
const missingHistorical={...twoYearInflation,historicalInflationYears:[10]};
near(historicalInflationTotal(missingHistorical),(1.1*1.025-1)*100);
assert.ok(Number.isNaN(historicalInflationTotal({...twoYearInflation,historicalInflationYears:[10,null]})));
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:[10,null]}),/active yearly historical/);
assert.doesNotThrow(()=>calculate({...twoYearInflation,historicalMonths:12,historicalInflationYears:[10,null]}));
assert.doesNotThrow(()=>calculate({...twoYearInflation,resaleMode:'direct',historicalInflationYears:[null]}));
assert.doesNotThrow(()=>calculate({...twoYearInflation,historicalInflationMode:'total',historicalInflationPct:32,historicalInflationYears:[null]}));
assert.doesNotThrow(()=>validateHistoricalInflation({...twoYearInflation,historicalInflationYears:[10,null]},{allowDrafts:true}));

const equivalentHistoricalRate=Math.expm1(Math.log1p(.456)/6)*100;
const yearlyReplay={...historicalReplay,inflationMode:'yearly',inflationYears:Array(6).fill(equivalentHistoricalRate),historicalInflationMode:'yearly',historicalInflationPct:null,historicalInflationYears:Array(6).fill(equivalentHistoricalRate)};
near(historicalInflationTotal(yearlyReplay),45.6);
near(historicalInflationRate(yearlyReplay),equivalentHistoricalRate);
near(relativeResaleEstimate(yearlyReplay).nominalValue,240000);
near(effectiveInputs(yearlyReplay).historicalInflationPct,45.6);
near(calculate(yearlyReplay,{opportunity:false,todayMoney:false}).cashPurchase.adjusted,100000);
near(calculate(yearlyReplay,{opportunity:false,todayMoney:true}).cashPurchase.adjusted,340000-240000/1.456);

assert.throws(()=>calculate({...twoYearInflation,historicalInflationMode:'monthly'}),/total or year-specific/);
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:{}}),/up to 100/);
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:Array(101).fill(0)}),/up to 100/);
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:[-1]}),/between 0 and 100/);
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:[101]}),/between 0 and 100/);
assert.throws(()=>calculate({...twoYearInflation,historicalInflationYears:['10']}),/between 0 and 100/);
assert.ok(Number.isNaN(historicalInflationTotal({...twoYearInflation,historicalMonths:Number.MAX_SAFE_INTEGER,historicalInflationYears:[]})));
assert.throws(()=>calculate({...twoYearInflation,historicalMonths:1201,historicalInflationYears:[]}),/total cumulative inflation/);
assert.doesNotThrow(()=>calculate({...twoYearInflation,historicalInflationMode:'total',historicalInflationPct:145.6,historicalMonths:1201,historicalInflationYears:[]}));
console.log('PASS: cumulative and chronological historical inflation, fractional years, fallback, equivalent annual rates, exact replay, legacy defaults, drafts and validation.');
