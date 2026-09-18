import {createTranslator} from "./i18n.mjs";
import {variants as modelVariants,calculate,cashFlowValue,resaleComparisons,interestComparisons,hasDifferentPeriods,withResale,resaleSamples,ranked} from "./model.mjs";

/** Render result tables and own their explanations, independently of graph state. */
export function createResults({i18n=createTranslator(),document,window,views,onShowTooltip}){
 const variants=i18n.variants(modelVariants);
 const {t,money,num,ratePercent,returnSummary}=i18n;
 const $=id=>document.getElementById(id);
 let visibleKinds=new Set(variants.map(v=>v.kind));
 let activeResultExplanation=null;
 const {annualViews,opportunityViews,inflationViews,viewOptions,viewInputs,moneyBasis,comparisonBasis}=views;
 function row(label,b,n,l,c,cls=""){
  const cells=[b,n,l,c].map((value,i)=>visibleKinds.has(variants[i].kind)?'<td data-option="'+variants[i].kind+'">'+value+'</td>':"").join("");
  return '<tr class="'+cls+'"><th scope="row">'+label+'</th>'+cells+'</tr>';
 }
 const detail=(amount,note)=>'<span class="cell-amount">'+money(amount)+'</span><small>'+note+'</small>';
 const phase=label=>'<tr class="phase"><th colspan="'+(visibleKinds.size+1)+'" scope="rowgroup">'+label+'</th></tr>';

 const resultAmount=(amount,result,key="cost")=>annualViews[key]?amount*12/result.months:amount;
 const resultValue=(result,key="summary")=>resultAmount(result.adjusted,result,key);
 const resultRanking=(c,key="summary")=>ranked(c,annualViews[key]).map(item=>({...item,name:i18n.variantName(item.key),value:item.value*(annualViews[key]?12:1)}));
 function comparisonAmount(amount,result,note="",key="cost"){
  return '<span class="cell-amount" data-full-term="'+amount+'" data-months="'+result.months+'">'+money(resultAmount(amount,result,key))+'</span>'+(note?'<small>'+note+'</small>':'');
 }
 function comparisonRow(label,values,c,cls="",key="cost"){
  return row(label,...values.map((value,i)=>typeof value==="number"?comparisonAmount(value,c[variants[i].key],"",key):value),cls);
 }
 function vatTableValues(s,c,todayMoney){
  const value=(amount,month)=>cashFlowValue({amount,month},0,0,s.inflationRate,{opportunity:false,todayMoney});
  const vatFraction=s.vatEnabled?s.vatPct/(100+s.vatPct)*s.recoveryPct/100:0;
  return Object.fromEntries(variants.map(v=>{
   const o=c[v.key],lease=v.kind==='lease';
   const regular=lease?Array.from({length:o.months},(_,month)=>value(c.leaseVatPerPayment,month)).reduce((a,b)=>a+b,0)/o.months:0;
   const maintenance=o.events.filter(e=>['maintenance','tyres','additional'].includes(e.category)&&e.amount>0).reduce((sum,e)=>sum+value(e.amount*vatFraction,e.month),0);
   return [v.key,{purchase:lease?0:value(c.purchaseRefund,s.purchaseVatDelay),initial:lease?value(c.leaseInitialVat,0):0,regular,maintenance,
    grossSale:value(o.resale,o.months),saleVat:value(o.carSaleVat,o.months),netSale:value(o.resale-o.carSaleVat,o.months),
    tyreVat:value(s.vatEnabled?s.tyreResale*s.vatPct/(100+s.vatPct):0,o.months),buyout:lease?value(c.buyoutRefund,o.months+s.purchaseVatDelay):0,
    outstanding:-o.events.filter(e=>e.category==='vat'&&e.amount<0&&e.month>o.months).reduce((sum,e)=>sum+value(e.amount,e.month),0)}];
  }));
 }

 function render(s,c){
  visibleKinds=new Set(variants.filter(v=>s[v.enabled]).map(v=>v.kind));
  $("error").hidden=true;$("resultContent").hidden=false;$("graphContent").hidden=false;
  for(const key of Object.keys(opportunityViews)){
   $('opportunity-'+key+'-note').textContent=opportunityViews[key]?t("results.included",{s:returnSummary(s)}):t("results.opportunityCostExcluded");
  }
  for(const key of Object.keys(inflationViews)){
   $('inflation-'+key+'-note').dataset.active=String(inflationViews[key]);
   $('inflation-'+key+'-note').textContent=inflationViews[key]?t("results.estimatedTodaySMoneyInflation",{inflationRate:ratePercent(s.inflationRate)}):t("results.nominalAmountsInflationAdjustmentOff");
  }
  for(const [key,annual] of Object.entries(annualViews))$('annual-'+key+'-note').textContent=annual?t("results.annualAverageTotalsInTooltips"):t("results.fullTermCostEachOptionSOwnPeriod");
  const summaryInputs=viewInputs(s,'summary'),summary=calculate(summaryInputs,viewOptions('summary'));
  const viewCost=key=>calculate(viewInputs(s,key),viewOptions(key));
  const monthly=viewCost('monthly'),cost=viewCost('cost'),versus=viewCost('versus');
  const b=c.balloonLoan,n=c.standardLoan,l=c.lease,cash=c.cashPurchase;
  $("scenarioName").dataset.userText=String(Boolean(s.carName));$("scenarioName").textContent=s.carName||t("scenarios.yourCar");
  const split=hasDifferentPeriods(s),annual=annualViews.summary,unit=annual?t("results.yearEffective"):t("results.overFullTerm");
  $("resultsOverview").dataset.annual=String(annual);
  $("costPeriodHeading").textContent=annualViews.cost?t("ui.averageCostPerYear"):t("results.fullTermCost");
  $("opportunityPeriodHeading").textContent=annualViews.opportunityBreakdown?t("results.foregoneReturnPerYear"):t("ui.foregoneReturnByCashFlow");
  $("costPeriodNote").textContent=annualViews.cost?t("results.everyComponentBelowIsItsFullTermAmount"):t("results.everyComponentCoversItsOptionSFullOwnership");
  const active=variants.filter(v=>s[v.enabled]);
  const anyValue=values=>values.some((amount,index)=>s[variants[index].enabled]&&Math.abs(amount)>1e-8);
  const additionalLabel=s.pastOwnership?t("setup.actualAdditionalCosts"):t("ui.estimatedAdditionalCosts");
  const additionalActive=anyValue(variants.map(v=>c[v.key].additionalCosts));
  const runningVatLabel=additionalActive?t("results.maintenanceTyreAdditionalCostVatRefunds"):t("results.maintenanceTyreVatRefunds");
  $("termLabel").textContent=(split?t("results.differentPeriods"):t("results.monthsKm",{months:c[active[0].key].months,km:num(c[active[0].key].km)}))+(annual?t("results.annualComparison"):t("results.fullTermComparison"))+" / "+(s.vatEnabled?t("results.afterVatRecovery"):t("results.noVatRecovery"));
  const sorted=resultRanking(summary),gap=sorted.length>1?sorted[1].value-sorted[0].value:0,tie=sorted.length>1&&gap<.5;
  $("verdict").dataset.winner=tie?"tie":sorted[0].key;
  $("resultsOverview").dataset.winner=$("verdict").dataset.winner;
  $("winner").textContent=sorted.length===1?sorted[0].name:tie?t("results.theLowestCostOptionsTie"):t("results.costsLeast",{name:sorted[0].name});
  $("saving").textContent=money(sorted[0].value)+unit;
  $("savingNote").textContent=(sorted.length===1?t("results.onlyOneOptionSelected"):tie?t("results.theSelectedOptionsTie"):t("results.lessThan",{value1:money(gap)+(annual?t("results.year"):""),value2:sorted[1].name.toLowerCase()}))+" "+(opportunityViews.summary?t("results.includesOpportunityCostAt",{s:returnSummary(s)}):t("results.excludesOpportunityCost"));
  for(const [prefix,key,monthlyId] of [["easy","balloonLoan","easyMonthly"],["normal","standardLoan","normalMonthly"],["kinto","lease","kintoEffective"],["cash","cashPurchase","cashMonthly"]]){
   $(prefix+"Total").textContent=money(resultValue(summary[key]))+(annual?t("results.year"):"");$(monthlyId).textContent=t("results.monthEffective",{value1:money(summary[key].adjusted/summary[key].months)});
  }
  // Compare the same cash flows before VAT settlement, without dividing VAT-free costs by the VAT rate.
  // Remove VAT events only, preserving the same independently estimated income-tax effects.
  const beforeVat=Object.fromEntries(variants.map(v=>{
   const result=summary[v.key];
   const vatEffect=result.events.filter(e=>e.category==="vat").reduce((sum,e)=>sum+cashFlowValue(e,result.months,summary.nominalReturn,s.inflationRate,viewOptions("summary")),0);
   return [v.key,{adjusted:result.adjusted-vatEffect}];
  }));
  for(const [prefix,key] of [["easy","balloonLoan"],["normal","standardLoan"],["kinto","lease"],["cash","cashPurchase"]]){
   $(prefix+"VatBasis").textContent=t("setup.months",{value1:(annual?t("results.perYear"):t("results.total"))+(s.vatEnabled?t("results.netAfterVatSettlement"):t("results.includingVatRecoveryOff"))+summary[key].months});
   $(prefix+"Annual").textContent=annual?t("results.totalOverMonths",{adjusted:money(summary[key].adjusted),months:summary[key].months}):t("results.yearEffective2",{value1:money(summary[key].adjusted*12/summary[key].months)});
   const gross=beforeVat[key].adjusted;
   $(prefix+"Gross").innerHTML='<span class="gross-total">'+money(gross)+(t("results.total2")+"</span><small>")+money(gross*12/summary[key].months)+(t("results.year")+"<br>")+money(gross/summary[key].months)+(t("results.month")+"</small>");
  }
  $("resultsVatNote").textContent=t("results.theseTotalsAreAnnualAndMonthlyAmountsSpread",{value1:comparisonBasis("summary"),description2:s.vatEnabled?t("results.netAfterVatIncludesEligibleDeductionsAndSale"):t("results.vatRecoveryIsOffSoBothViewsInclude"),description3:s.incomeTaxEnabled?t("results.bothViewsIncludeTheEstimatedIncomeTaxSavings"):""});
  const matchRows=interestComparisons(viewInputs(s,'interest'),viewOptions('interest'),annualViews.interest);
  const names=Object.fromEntries(variants.map(v=>[v.key,v]));
  const label=key=>'<span class="option-label" data-option="'+names[key].kind+'">'+names[key].name+'</span>';
  const rateLabels={"below-zero":t("results.noRate0"),"above-range":t("results.noMatchIn0100"),"unaffected":t("results.noMatch"),"equal":t("results.anyRate")};
  const interestCost=calculate(viewInputs(s,'interest'),viewOptions('interest'));
  $("interestRows").innerHTML=matchRows.length?matchRows.map(item=>{
   const difference=resultValue(interestCost[item.loan],"interest")-resultValue(interestCost[item.target],"interest");
   const differenceLabel=Math.abs(difference)<.5?t("results.sameCost"):money(Math.abs(difference))+(annualViews.interest?t("results.year"):'')+' '+t(difference<0?'results.less':'results.more');
   return '<tr><th scope="row">'+label(item.loan)+'</th><td>'+label(item.target)+'</td><td>'+item.currentRate.toFixed(2)+'%</td><td>'+(item.rate===null?rateLabels[item.status]:t("results.pA",{value1:item.rate.toFixed(3)}))+'</td><td>'+differenceLabel+'</td></tr>';
  }).join(''):("<tr><td colspan=\"5\">"+t("results.selectALoanAndEitherOutrightPurchaseOr")+"</td></tr>");
  $("monthlyRows").innerHTML=[
  row(t("results.periodMileage"),...variants.map(v=>t("results.monthsKm2",{months:c[v.key].months,km:num(c[v.key].km)}))),
  (s.balloonEnabled||s.normalEnabled)?row(t("results.loanRepaymentPeriod"),t("results.months",{loanMonths:b.loanMonths}),t("results.months",{loanMonths:n.loanMonths}),t("results.leaseContract"),t("results.noLoan")):"",
  (s.balloonEnabled||s.normalEnabled||s.leaseEnabled)?row(t("results.loanPaymentLeaseInvoice"),money(c.payment),money(c.normalPayment),money(c.kRent),t("results.noRepayment")):"",
  row(t("results.insurancePaidSeparately"),money(s.easyInsurance),money(s.normalInsurance),s.kintoInsuranceIncluded?t("results.includedInInvoice"):money(c.kInsurance),money(s.cashInsurance)),
  row(t("results.monthlyBillInclInsurance"),detail(c.insuredPayment,t("results.duringRepaymentMonths",{paidMonths:b.paidMonths})),detail(c.normalPayment+s.normalInsurance,t("results.duringRepaymentMonths",{paidMonths:n.paidMonths})),money(c.kRent+c.kInsurance),money(s.cashInsurance),"emphasis"),
  (s.balloonEnabled&&b.loanMonths<b.months||s.normalEnabled&&n.loanMonths<n.months)?row(t("results.monthlyBillAfterLoanEnds"),b.loanMonths<b.months?detail(s.easyInsurance,t("results.months2",{value1:b.loanMonths+1,months:b.months})):t("results.outsideOwnershipPeriod"),n.loanMonths<n.months?detail(s.normalInsurance,t("results.months2",{value1:n.loanMonths+1,months:n.months})):t("results.outsideOwnershipPeriod"),"—",money(s.cashInsurance)):"",
  s.leaseEnabled&&c.leaseVatPerPayment?row(t("results.vatRefundPerLeaseInvoice"),"—","—",money(c.leaseVatPerPayment),"—"):"",
  s.leaseEnabled&&c.leaseVatPerPayment?row(t("results.monthlyBillAfterVatDeduction"),money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),detail(c.kRent+c.kInsurance-c.leaseVatPerPayment,t("results.vatDeductedWithEachPayment")),money(s.cashInsurance)):"",
  row(t("results.effectiveMonthlyOwnershipCost"),...variants.map(v=>money(monthly[v.key].adjusted/monthly[v.key].months)),"sum")
  ].join("");
  const conversion=s.opportunityRateBasis==="real"?t("results.withInflationGivesPAAfterTaxBefore",{s:returnSummary(s),inflationRate:ratePercent(s.inflationRate),nominalReturn:ratePercent(c.nominalReturn)}):t("results.isUsedDirectlyTheInflationEstimateAlsoPowers",{s:returnSummary(s)});
  $("returnConversion").textContent=s.pastOwnership?t("results.returnIsTheAlternativeNominalAfterTaxInvestment"):t("results.enterCostsAndDirectResaleEstimatesInNominal",{conversion:conversion});
  $("opportunityIntro").textContent=t("results.paymentsAndRefundsAreCarriedToEachOption",{conversion:conversion});
  const opportunityDetail=calculate(s,{opportunity:true,todayMoney:inflationViews.opportunityBreakdown});
  const opportunityGroups=[
  ["upfront",t("results.depositInitialPaymentOutrightPurchase")],["payments",t("results.regularLoanLeasePayments")],["insurance",t("results.separatelyPaidInsurance")],
  ["maintenance",t("results.maintenancePayments")],["tyres",t("results.tyrePurchaseAndSeasonalService")],["additional",additionalLabel],
  ["vatDuring",t("results.vatRefundsDuringTheTerm")],["vatAfter",t("results.vatRefundsAfterTheTerm")],
  ["taxSavings",t("results.incomeTaxAndContributionSavings")],
  ["settlement",t("results.finalBalloonBuyoutSaleAndSaleTax")],["other",t("results.otherPayments")]
  ];
  $("opportunityRows").innerHTML=opportunityGroups.filter(([key])=>anyValue(variants.map(v=>opportunityDetail[v.key].opportunityBreakdown[key]))).map(([key,label])=>comparisonRow(label,variants.map(v=>opportunityDetail[v.key].opportunityBreakdown[key]),opportunityDetail,"","opportunityBreakdown")).join("")+
  comparisonRow(t("results.totalOpportunityCost"),variants.map(v=>opportunityDetail[v.key].opportunity),opportunityDetail,"sum","opportunityBreakdown");
  $("opportunityExample").hidden=!s.balloonEnabled;
  $("opportunityExample").innerHTML=("<span data-option=\"balloon\">"+t("results.balloonLoanExample")+"</span>"+t("results.the"))+money(c.down)+t("results.depositIsPaidAtMonthZeroAt")+ratePercent(c.nominalReturn)+t("results.nominalAnnualReturnOver")+b.months+t("results.monthsItsForegoneReturnIs")+money(opportunityDetail.balloonLoan.opportunityBreakdown.upfront)+' '+moneyBasis("opportunityBreakdown")+'.';
  $("serviceNote").textContent=s.matchPeriods?t("results.services",{services:t("common.services",{count:c.serviceCount}),maintenance:money(c.maintenance)}):active.map(v=>t("results.services2",{name:v.name,services:t("common.services",{count:c[v.key].serviceCount}),maintenance:money(c[v.key].maintenance)})).join(" | ");
  const purchaseSold=s.loanEnd==="sell",leaseSold=s.leaseEnd==="buySell",leaseBought=s.leaseEnd!=="return";
  const anySale=(purchaseSold&&(s.balloonEnabled||s.normalEnabled||s.cashEnabled))||(s.leaseEnabled&&leaseSold);
  const component=(key,field)=>cost[key].costComponents[field];
  const components=field=>variants.map(v=>component(v.key,field));
  const costRow=(label,values,cls="")=>comparisonRow(label,values,cost,cls);
  $("costRows").innerHTML=[
  costRow(t("results.vehiclePurchaseBuyout"),[s.price,s.price,leaseBought?component("lease","purchase"):t("results.noPurchase"),s.price]),
  (s.balloonEnabled||s.normalEnabled)?costRow(t("results.inflationBenefitOnDeferredPrincipal"),variants.map(v=>v.loanMonths&&inflationViews.cost&&s.inflationRate>0?component(v.key,"purchase")-s.price:0)):"",
  costRow(t("results.carResaleRetainedValueCredit"),components("resale").map((amount,i)=>i===2&&!leaseBought?t("results.carReturned"):amount)),
  (s.balloonEnabled||s.normalEnabled)?costRow(t("results.financingInterest"),[component("balloonLoan","interest"),component("standardLoan","interest"),t("results.inLease"),t("results.noLoan")]):"",
  s.leaseEnabled?costRow(t("results.leaseInvoicesInitialPayment"),["—","—",component("lease","lease"),"—"]):"",
  costRow(t("results.insurancePaidSeparately"),components("insurance").map((amount,i)=>i===2&&s.kintoInsuranceIncluded?t("results.inLease"):amount)),
  costRow(t("results.maintenance"),variants.map(v=>v.kind==='lease'&&s.kintoMaintenance?t("results.inLease"):comparisonAmount(component(v.key,"maintenance"),cost[v.key],t("results.servicesOverFullTerm",{services:t("common.services",{count:c[v.key].serviceCount})})))),
  costRow(t("results.tyresServiceLessResale"),components("tyres").map((amount,i)=>i===2&&s.kintoTyres?t("results.inLease"):amount)),
  costRow(additionalLabel,components("additional")),
  anyValue([s.easyExtra,s.normalExtra,s.kintoExtra,s.cashExtra])?costRow(t("results.otherCosts"),components("other")):"",
  s.vatEnabled?costRow(t("results.netVatAdjustment"),components("vat")):"",
  s.incomeTaxEnabled?costRow(t("results.costBeforeIncomeTaxEffects"),variants.map(v=>cost[v.key].beforeOpportunity-component(v.key,"taxSavings")-component(v.key,"saleTax")),"subtotal"):"",
  s.incomeTaxEnabled?costRow(t("results.estimatedTaxSavingsDuringOwnership"),components("taxSavings")):"",
  s.incomeTaxEnabled?costRow(t("results.estimatedTaxAndContributionsOnSale"),components("saleTax")):"",
  costRow(t("results.costBeforeOpportunity"),variants.map(v=>cost[v.key].beforeOpportunity)),
  costRow(inflationViews.cost?t("results.inflationEffectAlreadyIncluded"):t("results.inflationAdjustmentExcluded"),variants.map(v=>cost[v.key].inflationAdjustment),"inflation-summary"),
  costRow(opportunityViews.cost?t("ui.opportunityCost"):t("results.opportunityCostExcluded2"),variants.map(v=>cost[v.key].opportunity)),
  costRow(t("results.totalEconomicCost"),variants.map(v=>cost[v.key].adjusted),"sum")].join("");

  const resaleInputs=viewInputs(s,'resale'),pairs=resaleComparisons(resaleInputs,viewOptions("resale"),annualViews.resale),optionKeys=active.map(v=>v.key);
  $("versusBasis").textContent=t("results.withVatTreatment",{description1:annualViews.versus?t("setup.averageAnnualCosts"):t("results.fullTermCosts"),value2:comparisonBasis("versus")});
  for(const v of variants)$("resaleCostBasis-"+v.kind).textContent=annualViews.resale?t("ui.ownershipCostYear"):t("results.ownershipCostOverFullTerm");
  $("resaleColumnLabel").textContent=s.matchPeriods?t("ui.fullResalePrice"):t("results.changeInFullResalePrice");
  $("resaleColumnTerm").textContent=active.some(v=>s[v.matchPeriod])?(s.matchPeriods?t("results.atMonth"):t("results.sharedTermMonth"))+s.months:"";
  $("sensitivityBasis").textContent=t("results.withVatTreatmentResaleAndRetainedValuesAre",{description1:annualViews.resale?t("results.averageAnnualOwnershipCosts"):t("results.fullTermOwnershipCosts"),value2:comparisonBasis("resale"),description3:s.matchPeriods?t("results.theFirstColumnIsTheSharedSellingPrice"):t("results.theFirstColumnChangesEachOptionSEnd")});
  $("versusRows").innerHTML=optionKeys.map(left=>{
   const cells=optionKeys.map(right=>{
    if(left===right)return '<td class="versus-diagonal" aria-label="'+t('results.sameOption')+'">—</td>';
    const difference=resultValue(versus[left],"versus")-resultValue(versus[right],"versus");
    if(Math.abs(difference)<.5)return ("<td class=\"versus-tie\">"+t("results.sameCost")+"</td>");
    const direction=difference<0?"less":"more";
    return '<td class="versus-'+direction+'"><span>'+money(Math.abs(difference))+'</span><small>'+t('results.'+direction)+'</small></td>';
   }).join("");
   return '<tr><th scope="row" data-option="'+names[left].kind+'">'+label(left)+'</th>'+cells+'</tr>';
  }).join("");
  // Show crossovers explicitly alongside the five resale estimates.
  const resalePoints=resaleSamples(resaleInputs,pairs);
  $("sensitivity").innerHTML=resalePoints.map(resale=>{
   const next=calculate(withResale(resaleInputs,resale),viewOptions("resale")),r=resultRanking(next,"resale");
   const current=Math.abs(resale-s.resale)<.01;
   const matching=pairs.filter(p=>p.resale!==null&&Math.abs(p.resale-resale)<.01);
   const note=matching.map(p=>label(p.left)+" = "+label(p.right)).join("; ");
   const tiedOptions=r.filter(item=>Math.abs(item.value-r[0].value)<.5);
   const winner=tiedOptions.length>1?t("results.tie",{value1:tiedOptions.map(item=>'<span data-option="'+item.key+'">'+item.name+'</span>').join(" + ")}):'<span data-option="'+r[0].key+'">'+r[0].name+'</span>';
   const cells=active.map(v=>{
    const o=next[v.key];
    const note=s[v.matchPeriod]?"":t("results.month2",{months:o.months});
    return '<td data-option="'+v.kind+'">'+comparisonAmount(o.adjusted,o,note,"resale")+'</td>';
   }).join("");
   return '<tr class="'+(current?"selected ":"")+(matching.length?"breakpoint":"")+'"><th scope="row">'+(s.matchPeriods?money(resale):(resale-s.resale>0?"+":"")+money(resale-s.resale))+(current?("<small>"+t("results.currentResale")+"</small>"):"")+(note?("<small class=\"breakpoint-note\">"+t("results.breakEven"))+note+'</small>':"")+'</th>'+cells+'<td>'+winner+'</td></tr>';
  }).join("");

  const endNote=o=>t("results.month2",{months:o.months});
  const refundNote=amount=>amount?t("results.month3",{purchaseVatDelay:s.purchaseVatDelay}):t("results.noEligibleDeduction");
  const saleCell=(sold,amount,description)=>sold?detail(amount,description):t("results.noSale");
  const vat=vatTableValues(s,c,inflationViews.vat);
  const tyreSaleVat=s.vatEnabled?s.tyreResale*s.vatPct/(100+s.vatPct):0;
  const tyreVatValues=variants.map(v=>v.kind==='lease'&&s.kintoTyres?0:tyreSaleVat);
  $("vatPanel").hidden=!s.vatEnabled;
  $("vatTimeline").innerHTML=[
  (s.balloonEnabled||s.normalEnabled||s.cashEnabled||(s.leaseEnabled&&c.leaseInitialVat))?phase(t("results.01PurchaseAndLeaseStart")):"",
  (s.balloonEnabled||s.normalEnabled||s.cashEnabled)?row(t("results.purchaseVatRefund"),detail(vat.balloonLoan.purchase,refundNote(c.purchaseRefund)),detail(vat.standardLoan.purchase,refundNote(c.purchaseRefund)),t("results.notAPurchase"),detail(vat.cashPurchase.purchase,refundNote(c.purchaseRefund))):"",
  s.leaseEnabled&&c.leaseInitialVat?row(t("results.initialLeasePaymentVat"),"—","—",detail(vat.lease.initial,t("results.month0")),"—"):"",
  phase(t("results.02DuringTheAgreement")),
  s.leaseEnabled?row(t("results.vatOnRegularLeaseInvoices"),t("results.noVatOnLoanRepayments"),t("results.noVatOnLoanRepayments"),detail(vat.lease.regular,t("results.months0",{description1:inflationViews.vat?t("results.averagePerInvoice"):t("results.perInvoice"),value2:l.months-1})),t("results.noRegularPurchasePayments")):"",
  row(runningVatLabel,detail(vat.balloonLoan.maintenance,t("results.nettedAgainstTheExpense")),detail(vat.standardLoan.maintenance,t("results.nettedAgainstTheExpense")),detail(vat.lease.maintenance,t("results.nettedAgainstTheExpense")),detail(vat.cashPurchase.maintenance,t("results.nettedAgainstTheExpense"))),
  phase(t("results.03AtEachOptionSEndDate")),
  row(t("results.grossCarSaleProceeds"),purchaseSold?detail(vat.balloonLoan.grossSale,endNote(b)):t("results.carKept"),purchaseSold?detail(vat.standardLoan.grossSale,endNote(n)):t("results.carKept"),leaseSold?detail(vat.lease.grossSale,endNote(l)):leaseBought?t("results.carKept"):t("results.carReturned"),purchaseSold?detail(vat.cashPurchase.grossSale,endNote(cash)):t("results.carKept")),
  anySale?row(t("results.vatPaidOnCarSale"),saleCell(purchaseSold,vat.balloonLoan.saleVat,endNote(b)),saleCell(purchaseSold,vat.standardLoan.saleVat,endNote(n)),saleCell(leaseSold,vat.lease.saleVat,endNote(l)),saleCell(purchaseSold,vat.cashPurchase.saleVat,endNote(cash))):"",
  anySale?row(t("results.carSaleProceedsAfterVat"),saleCell(purchaseSold,vat.balloonLoan.netSale,b.remainingPrincipal||b.loanMonths===b.months?t("results.beforeLoanSettlement"):t("results.loanAlreadyRepaid")),saleCell(purchaseSold,vat.standardLoan.netSale,n.remainingPrincipal?t("results.beforeLoanSettlement"):t("results.loanFullyRepaid")),saleCell(leaseSold,vat.lease.netSale,t("results.beforeDeductingBuyout")),saleCell(purchaseSold,vat.cashPurchase.netSale,t("results.noLoanToSettle"))):"",
  anyValue(variants.map(v=>c[v.key].retainedValue))?row(t("results.estimatedVatWithinRetainedCarValue"),...variants.map(v=>(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?detail(vat[v.key].saleVat,t("results.valuationOnlyNoTaxPaidNow")):t("results.noRetainedCar"))):"",
  anyValue(tyreVatValues)?row(t("results.vatWithinTyreResaleRetainedValue"),...variants.map((v,index)=>v.kind==='lease'&&s.kintoTyres?t("results.leaseOwnedTyres"):detail(vat[v.key].tyreVat,(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?t("results.valuationOnlyNoTaxPaidNow"):t("results.paidWithinTyreSaleProceeds")))):"",
  s.leaseEnabled&&leaseBought?row(t("results.leaseBuyoutVatRefund"),t("results.noNewVatOnBalloonRepayment"),"—",detail(vat.lease.buyout,c.buyoutRefund?t("results.month4",{value1:l.months+s.purchaseVatDelay}):t("results.noEligibleDeduction")),"—"):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?phase(t("results.04RefundsOutstandingAtEndOfTerm")):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?row(t("results.totalVatStillToBeReceived"),detail(vat.balloonLoan.outstanding,t("results.alreadyIncludedInTotalCost")),detail(vat.standardLoan.outstanding,t("results.alreadyIncludedInTotalCost")),detail(vat.lease.outstanding,t("results.alreadyIncludedInTotalCost")),detail(vat.cashPurchase.outstanding,t("results.alreadyIncludedInTotalCost"))):""
  ].join("");
  const hasCashAdjustments=anyValue(variants.map(v=>c[v.key].retainedValue))||anyValue(variants.map(v=>c[v.key].futureRefund));
  $("cashflow").innerHTML=[
  s.incomeTaxEnabled?row(t("results.taxableCarSaleAmount"),...variants.map(v=>(v.kind==="lease"?leaseSold:purchaseSold)?(s.saleTaxRate?money(c[v.key].taxableSale):t("results.0SaleRate")):t("results.noSale"))):"",
  s.incomeTaxEnabled?row(t("results.estimatedNetCarSaleProceeds"),...variants.map(v=>(v.kind==="lease"?leaseSold:purchaseSold)?money(c[v.key].resale-c[v.key].carSaleVat-c[v.key].saleTax):t("results.noSale"))):"",
  row(t("results.depositInitialPaymentOutrightPurchase"),money(c.down),money(c.normalDown),money(s.kintoInitial),money(s.price)),
  anyValue([b.balloonPaid,0,leaseBought?s.leaseBuyout:0,0])?row(t("results.balloonPaidLeaseBuyout"),b.balloonPaid?detail(b.balloonPaid,t("results.month5",{loanMonths:b.loanMonths})):t("results.noBalloonPaid"),t("results.noBalloon"),leaseBought?detail(s.leaseBuyout,t("results.month2",{months:l.months})):t("results.noBuyout"),t("results.noLoan")):"",
  anyValue([b.remainingPrincipal,n.remainingPrincipal,0,0])?row(t("results.remainingLoanAtComparisonEnd"),detail(b.remainingPrincipal,purchaseSold?t("results.paidOffOnSale"):t("results.deductedFromRetainedValue")),detail(n.remainingPrincipal,purchaseSold?t("results.paidOffOnSale"):t("results.deductedFromRetainedValue")),t("results.noLoan"),t("results.noLoan")):"",
  row(t("results.netCashPaidAtStart"),...variants.map(v=>money(c[v.key].events.filter(e=>e.type==='cash'&&e.month===0).reduce((sum,e)=>sum+e.amount,0)))),
  row(t("results.carResaleRetainedValueAtEnd"),...variants.map(v=>v.kind==="lease"&&!leaseBought?t("results.carReturned"):detail(c[v.key].resale,(v.kind==="lease"?leaseSold:purchaseSold)?t("results.grossSaleProceeds"):t("results.retainedAssetNoSaleReceipt")))),
  row(t("results.netCashFlowAtEnd"),...variants.map(v=>{
   const amount=c[v.key].events.filter(e=>e.type==='cash'&&Math.abs(e.month-c[v.key].months)<1e-8).reduce((sum,e)=>sum+e.amount,0);
   return detail(amount,t("results.month6",{months:c[v.key].months,description2:amount<-.005?t("results.netReceived"):amount>.005?t("results.netPaid"):t("results.noNetPayment")}));
  })),
  hasCashAdjustments?row(t("results.netCashSpentThroughEachTerm"),money(b.cashToEnd),money(n.cashToEnd),money(l.cashToEnd),money(cash.cashToEnd)):"",
  anyValue(variants.map(v=>c[v.key].retainedValue))?row(t("results.lessRetainedCarAndTyreValue"),money(-b.retainedValue),money(-n.retainedValue),money(-l.retainedValue),money(-cash.retainedValue)):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?row(t("results.lessVatRefundsDueAfterEachTerm"),money(-b.futureRefund),money(-n.futureRefund),money(-l.futureRefund),money(-cash.futureRefund)):"",
  row(t("results.economicCostBeforeOpportunity"),money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal),"sum")
  ].join("");
  decorateResultTables(s,c,matchRows,resalePoints,opportunityDetail);
  annotateInflationValues(s,resalePoints,opportunityDetail);
  if(annualViews.summary){
   const selected=active.find(v=>v.kind===sorted[0].key),result=summary[selected.key];
   explainResult($("saving"),t("results.fullTermCostOverMonthsAnnualAverageFull",{value1:$("saving").dataset.explanation||"",adjusted:money(result.adjusted),months:result.months}));
  }
  return c;
 }

 function decorateResultTables(s,c,matches,resales,opportunityDetail){
  const active=variants.filter(v=>s[v.enabled]);
  const additionalLabel=s.pastOwnership?t("setup.actualAdditionalCosts"):t("ui.estimatedAdditionalCosts");
  const additionalActive=active.some(v=>Math.abs(c[v.key].additionalCosts)>1e-8);
  const runningVatLabel=additionalActive?t("results.maintenanceTyreAdditionalCostVatRefunds"):t("results.maintenanceTyreVatRefunds");
  const descriptions={
   [t("results.periodMileage")]:t("results.eachOptionHasItsOwnTermMileageIs"),
   [t("results.loanPaymentLeaseInvoice")]:t("results.regularFinancePaymentOnlyLoanPaymentsIncludePrincipal"),
   [t("results.insurancePaidSeparately")]:t("results.onlySeparatelyEnteredInsuranceIsAddedHereCoverage"),
   [t("results.monthlyBillInclInsurance")]:t("results.theRecurringAmountPaidBeforeAnySeparateVat"),
   [t("results.vatRefundPerLeaseInvoice")]:t("results.eligibleRefundFromOneLeaseInvoiceAfterThe"),
   [t("results.monthlyBillAfterVatDeduction")]:t("results.recurringBillMinusEligibleVatDeductedAgainstVat"),
   [t("results.effectiveMonthlyOwnershipCost")]:t("results.totalOwnershipCostOnThisTableSSelected"),
   [t("results.vehiclePurchaseBuyout")]:t("results.theInvoicePriceForACarPurchasedNow"),
   [t("results.inflationBenefitOnDeferredPrincipal")]:t("results.negativeCreditForRepayingBorrowedPrincipalLaterWhen"),
   [t("results.carResaleRetainedValueCredit")]:t("results.negativeAmountReducesCostByTheGrossCar"),
   [t("results.financingInterest")]:t("results.interestAccruedThroughTheOwnershipPeriodOrLoan"),
   [t("results.leaseInvoicesInitialPayment")]:t("results.grossMonthlyLeaseInvoiceLeaseMonthsPlusThe"),
   [t("results.maintenance")]:t("results.numberOfServicesDueGrossServicePriceA"),
   [t("results.tyresServiceLessResale")]:t("results.grossTyrePurchasePlusSeasonalSwapsAndStorage"),
   [additionalLabel]:t("results.separateGrossRepairAndSimilarCostsOutsideScheduled"),
   [t("results.otherCosts")]:t("results.extraCostsEnteredForEachOptionPaidAt"),
   [t("results.netVatAdjustment")]:t("results.allEligibleVatRefundsReduceCostVatOn"),
   [t("results.costBeforeIncomeTaxEffects")]:t("results.subtotalOfOwnershipCostsAfterVatBeforeThe"),
   [t("results.estimatedTaxSavingsDuringOwnership")]:t("results.manualFullTermDeductibleExpensesEffectiveTaxAnd"),
   [t("results.estimatedTaxAndContributionsOnSale")]:t("results.positiveCarSaleProceedsAfterVatMinusThe"),
   [t("results.taxableCarSaleAmount")]:t("results.calculationBaseNotACashFlowOrExtra"),
   [t("results.estimatedNetCarSaleProceeds")]:t("results.grossCarSaleProceedsMinusOutputVatAnd"),
   [t("results.inflationAdjustmentExcluded")]:t("results.thisTableSTodaySMoneyToggleIs"),
   [t("results.inflationEffectAlreadyIncluded")]:t("results.informationalOnlyTheDifferenceBetweenTheComponentsIn"),
   [t("results.costBeforeOpportunity")]:t("results.sumOfTheCostComponentsAboveAfterVat"),
   [t("ui.opportunityCost")]:t("results.foregoneAfterTaxReturnFromTheTimingOf"),
   [t("results.opportunityCostExcluded2")]:t("results.thisTableSToggleExcludesForegoneReturnZero"),
   [t("results.totalEconomicCost")]:t("results.costBeforeOpportunityPlusTheOpportunityCostSelected"),
   [t("results.totalOpportunityCost")]:t("results.sumOfTheTimingEffectsShownAboveUsing"),
   [t("results.purchaseVatRefund")]:t("results.eligibleVatFromTheOriginalVehiclePurchaseSubject"),
   [t("results.initialLeasePaymentVat")]:t("results.eligibleVatRefundOnTheInitialLeasePayment"),
   [t("results.vatOnRegularLeaseInvoices")]:t("results.refundForEachMonthlyInvoiceNotTheTotal"),
   [runningVatLabel]:t("results.eligibleVatOnSeparatelyPaidMaintenanceTyrePurchase",{description1:additionalActive?t("results.andAdditionalRepairCosts"):''}),
   [t("results.grossCarSaleProceeds")]:t("results.carSalePriceIncludingVatAtTheOption"),
   [t("results.vatPaidOnCarSale")]:t("results.theVatPortionAlreadyInsideTheGrossCar"),
   [t("results.carSaleProceedsAfterVat")]:t("results.grossCarProceedsMinusCarSaleVatStill"),
   [t("results.estimatedVatWithinRetainedCarValue")]:t("results.valuationAdjustmentOnlyAKeptCarIsCredited"),
   [t("results.vatWithinTyreResaleRetainedValue")]:t("results.vatWithinTheSeparatelyEnteredTyreValueIt"),
   [t("results.leaseBuyoutVatRefund")]:t("results.eligibleVatFromTheEndOfLeasePurchase"),
   [t("results.totalVatStillToBeReceived")]:t("results.vatRefundsDatedAfterThisOptionSEnd"),
   [t("results.depositInitialPaymentOutrightPurchase")]:t("results.thePurchaseDepositInitialLeaseFeeOrFull"),
   [t("results.balloonPaidLeaseBuyout")]:t("results.balloonActuallyPaidAtLoanMaturityOrPurchase"),
   [t("results.remainingLoanAtComparisonEnd")]:t("results.principalStillOutstandingAfterTheLastModelledRegular"),
   [t("results.loanRepaymentPeriod")]:t("results.contractualRepaymentLengthIndependentOfOwnershipPaymentsStop"),
   [t("results.monthlyBillAfterLoanEnds")]:t("results.separatelyPaidInsuranceForTheRestOfOwnership"),
   [t("results.netCashPaidAtStart")]:t("results.allActualCashEventsAtMonthZeroIncluding"),
   [t("results.carResaleRetainedValueAtEnd")]:t("results.fullNominalCarValueAtTheOptionS"),
   [t("results.netCashFlowAtEnd")]:t("results.allActualCashEventsAtTheExactEnd"),
   [t("results.netCashSpentThroughEachTerm")]:t("results.sumOfCashPaidMinusReceiptsThroughThe"),
   [t("results.lessRetainedCarAndTyreValue")]:t("results.subtractsTheEstimatedNetValueOfAssetsYou"),
   [t("results.lessVatRefundsDueAfterEachTerm")]:t("results.subtractsRefundsStillDueAfterTheEndThese"),
   [t("results.economicCostBeforeOpportunity")]:t("results.netCashSpentThroughTheTermMinusRetained")
  };
  const timing={upfront:t("results.returnForgoneOnTheInitialPurchaseLoanDeposit"),payments:t("results.returnForgoneOnRegularLoanRepaymentsOrLease"),insurance:t("results.returnForgoneOnSeparatelyPaidInsurance"),maintenance:t("results.returnForgoneBetweenEachServicePaymentAndThe"),tyres:t("results.returnForgoneOnTyrePurchaseAndSeasonalServices"),additional:t("results.returnForgoneBetweenEachAdditionalCostPaymentAnd"),vatDuring:t("results.returnAvailableOnRefundedVatReceivedBeforeThe"),vatAfter:t("results.costOfWaitingForAVatRefundBeyond"),taxSavings:t("results.returnEarnedOnEstimatedIncomeTaxAndContribution"),settlement:t("results.timingEffectOfTheFinalFinancePaymentCar"),other:t("results.timingEffectOfOtherPaymentsEndDatedExtras")};
  const timingKeys=['upfront','payments','insurance','maintenance','tyres','additional','vatDuring','vatAfter','taxSavings','settlement','other'].filter(key=>active.some(v=>Math.abs(opportunityDetail[v.key].opportunityBreakdown[key])>1e-8));
  const columnHelp={
   [t("ui.compareRowWith")]:t("results.eachCellComparesTheRowOptionWithThe"),
   [t("ui.monthlyAmount")]:t("results.separatesRecurringPaymentsFromAverageOwnershipCostUpfront"),
   [t("ui.loan")]:t("results.theLoanWhoseNominalAnnualInterestRateIs"),
   [t("ui.match")]:t("results.benchmarkOptionHeldAtItsExistingQuoteEnd"),
   [t("ui.currentRate")]:t("results.theNominalAnnualLoanRateEnteredDirectlyOr"),
   [t("ui.matchingRate")]:t("results.calculatedNominalAnnualRateAtWhichTheLoan"),
   [t("ui.currentCostDifference")]:t("results.howMuchMoreOrLessTheLoanCosts"),
   [t("ui.averageCostPerYear")]:t("results.everyComponentIsItsFullTermValueDivided"),
   [t("results.foregoneReturnPerYear")]:t("results.eachCashFlowTimingEffectDividedByThe"),
   [t("results.fullTermCost")]:t("results.componentsOfOwnershipCostOverEachColumnS"),
   [t("ui.foregoneReturnByCashFlow")]:t("results.timingEffectsOfPaymentsAndReceiptsAtThe"),
   [t("ui.cashFlowStage")]:t("results.amountsAndReceiptOrPaymentDatesForVat"),
   [t("ui.fullResalePrice")]:t("results.sharedGrossEndOfTermCarSellingPrice"),
   [t("results.changeInFullResalePrice")]:t("results.amountAddedToEveryOptionSOwnEnd"),
   [t("ui.lowestCost")]:t("results.cheapestSelectedOptionAtTheRowSResale"),
   [t("ui.paymentAsset")]:t("results.cashRequirementsAndEndOfTermReconciliationStart")
  };
  const viewFor={monthlyRows:'monthly',costRows:'cost',versusRows:'versus',interestRows:'interest',sensitivity:'resale',opportunityRows:'opportunityBreakdown',vatTimeline:'vat'};
  for(const id of ['monthlyRows','costRows','opportunityRows','vatTimeline','cashflow','versusRows','interestRows','sensitivity']){
   const body=$(id),rows=[...body.querySelectorAll('tr')];
   const basis=viewFor[id]?comparisonBasis(viewFor[id])+'.':'';
   for(const [index,tr] of rows.entries()){
    const heading=tr.querySelector('th[scope="row"]');if(!heading)continue;
    const label=heading.textContent.trim(),cells=[...tr.querySelectorAll('td')];
    if(id==='versusRows'){
     const left=active[index];
     explainResult(heading,t("results.compareWithEachColumn",{name:left.name,description2:annualViews.versus?t("results.averageAnnualCosts"):t("results.fullTermCosts2"),basis:basis}));
     cells.forEach((cell,i)=>{
      const right=active[i],comparison=calculate(viewInputs(s,'versus'),viewOptions('versus')),amount=v=>resultValue(comparison[v.key],"versus");
      explainResult(cell,t("results.fullTermTotalsOverMonthsOverMonthsLess",{name:left.name,left:money(amount(left)),name2:right.name,right:money(amount(right)),description5:annualViews.versus?t("results.perYear2"):t("results.overEachFullTerm"),basis:basis,name3:left.name,adjusted:money(comparison[left.key].adjusted),months:comparison[left.key].months,name4:right.name,adjusted2:money(comparison[right.key].adjusted),months2:comparison[right.key].months}));
     });continue;
    }
    if(id==='interestRows'){
     const item=matches[index],loan=variants.find(v=>v.key===item.loan),target=variants.find(v=>v.key===item.target);
     const messages={'below-zero':t("results.evenA0LoanCostsMoreThanThis"),'above-range':t("results.theLoanIsCheaperThroughoutTheTested0"),'unaffected':t("results.changingInterestHasNoEffectOnTheCost"),'equal':t("results.costsMatchAtEveryTestedRateBecauseInterest"),'match':t("results.atThisRateTheLoanMatchesTheBenchmark")};
     const benchmark=calculate(viewInputs(s,'interest'),viewOptions('interest'));
     const totals=t("results.fullTermCostsAtTheCurrentRatesOver",{name:loan.name,adjusted:money(benchmark[item.loan].adjusted),months:benchmark[item.loan].months,name2:target.name,adjusted2:money(benchmark[item.target].adjusted),months2:benchmark[item.target].months});
     const matchHelp=t("results.benchmarkCostOnlyThisLoanSRateChanges",{value1:messages[item.status],value2:money(item.targetCost*(annualViews.interest?12:1)),description3:annualViews.interest?t("results.perYear3"):t("results.overItsTerm"),basis:basis,totals:totals});
     explainResult(heading,t("results.overMonthsComparedWithOverMonths",{name:loan.name,months:c[item.loan].months,name2:target.name,months2:c[item.target].months}));
     [t("results.isHeldAtItsCurrentQuoteAndAssumptions",{name:target.name}),t("results.currentNominalAnnualLoanRateFromSetupEntered"),matchHelp,t("results.howMuchMoreOrLessTheLoanCosts2",{description1:annualViews.interest?t("results.perYear2"):t("results.overTheFullTerm"),basis:basis,totals:totals})].forEach((text,i)=>explainResult(cells[i],text));continue;
    }
    if(id==='sensitivity'){
     const scenario=withResale(s,resales[index]);
     const prices=active.filter(v=>v.kind!=='lease'||s.leaseEnd!=='return').map(v=>v.name+': '+money(s.matchPeriods?scenario.resale:scenario[v.resale])).join('; ');
     const help=t("results.endCarValuesTyresAreSeparate",{description1:s.matchPeriods?t("results.grossSellingPriceOrRetainedCarValueIf"):t("results.theSameAmountIsAddedToEachOption"),prices:prices});
     explainResult(heading,t("results.aBreakEvenRowMarksEqualCostsFor",{help:help}));
     cells.forEach((cell,i)=>explainResult(cell,i<active.length?t("results.optionCost",{name:active[i].name,period:annualViews.resale?t("results.perYear4"):t("results.overMonths",{months:c[active[i].key].months}),basis,help}):t("results.lowestAmongSelectedOptionsAtTheseResaleEstimates",{description1:annualViews.resale?t("results.rankedPerYear"):t("results.rankedOverTheFullTerm"),basis:basis})));continue;
    }
    const help=id==='opportunityRows'&&index<timingKeys.length?t("results.thisIsOnlyTheTimingEffectNotThe",{value1:timing[timingKeys[index]]}):descriptions[label];
    if(!help)continue;
    explainResult(heading,help+((id==='costRows'&&annualViews.cost||id==='opportunityRows'&&annualViews.opportunityBreakdown)?t("results.displayedAmountsAreAnnualAveragesFullTermAmounts"):''));
    for(const cell of cells){
     const v=variants.find(v=>v.kind===cell.dataset.option);if(!v)continue;
     let extra=t("results.months3",{name:v.name,months:c[v.key].months,description3:id==='costRows'||id==='opportunityRows'||id==='vatTimeline'||label===t("results.effectiveMonthlyOwnershipCost")?basis:''});
     if(label===t("results.carResaleRetainedValueCredit")){
      if(v.kind==='lease'&&s.leaseEnd==='return'){explainResult(cell,t("results.theCarIsReturnedToTheLessorSo"));continue;}
      const result=c[v.key],kept=v.kind==='lease'?s.leaseEnd==='buyKeep':s.loanEnd==='keep';
      // Explain the gross resale component without applying its discount a second time to the total.
      const today=cashFlowValue({amount:result.resale,month:result.months},result.months,0,s.inflationRate,{opportunity:false,todayMoney:true});
      extra=t("results.monthsAtAnnualInflationThatIsWorthIn",{name:v.name,description2:s.pastOwnership?t("results.endOfOwnership"):t("results.estimated"),description3:kept?t("results.retainedCarValue"):t("results.saleProceeds"),description4:s.pastOwnership?t("results.after"):t("results.in"),months:result.months,resale:money(result.resale),inflationRate:ratePercent(s.inflationRate),today:money(today)});
      extra+=s.inflationRate>0&&result.resale>0?t("results.orLessPurchasingPower",{value1:money(result.resale-today)}):'. There is no purchasing-power reduction at these assumptions.';
      extra+=t("results.theseAreGrossAmountsBeforeVatSaleTax");
      extra+=inflationViews.cost?t("results.theRowAlreadyIncludesThisPurchasingPowerAdjustment"):t("results.thisIsAnIllustrationOnlyWhileTodayS");
      explainResult(cell,extra+(annualViews.cost?t("results.theDisplayedCreditIsAllocatedPerOwnershipYear"):''));continue;
     }
     if(label===t("results.inflationBenefitOnDeferredPrincipal")){
      if(!v.loanMonths)extra+=t("results.noLoanPrincipalIsDeferredInThisOption");
      else if(inflationViews.cost){
       const valued=calculate(viewInputs(s,'cost'),viewOptions('cost'))[v.key].costComponents.purchase;
       extra+=t("results.invoicePricePlusThisCreditEqualsForPrincipal",{price:money(s.price),valued:money(valued)});
      }else extra+=t("results.todaySMoneyIsOffSoNoPrincipal");
     }
     if(label===t("results.netCashFlowAtEnd")){
      const names={repayment:t("results.regularLoanRepayment"),capital:t("results.balloonRemainingLoanSettlement"),buyout:t("results.leaseBuyout"),resale:t("results.carSaleProceeds"),vat:t("results.vatPaidMinusRefunds"),insurance:t("ui.insurance"),maintenance:t("results.maintenance"),tyres:t("results.tyreCostsMinusSaleProceeds"),additional:t("results.additionalCosts"),other:t("results.otherCharges"),taxSavings:t("results.incomeTaxSavings"),saleTax:t("results.taxAndContributionsOnSale"),lease:t("results.leaseInvoice"),initial:t("results.initialLeasePayment")};
      // Reconcile only cash on this exact date; kept assets and later VAT receipts are separate.
      const groups=new Map();
      for(const event of c[v.key].events.filter(e=>e.type==='cash'&&Math.abs(e.month-c[v.key].months)<1e-8))groups.set(event.category,(groups.get(event.category)||0)+event.amount);
      const parts=[...groups].filter(([,amount])=>Math.abs(amount)>.005).map(([category,amount])=>names[category]+': '+(amount>0?'+':'')+money(amount));
      extra+=t("results.nominalCashAtMonthPositivePaidNegativeReceived",{months:c[v.key].months,description2:parts.length?parts.join('; ')+'.':t("results.noCashPaymentsOrReceiptsOnThisDate")});
     }
     if(label===t("results.maintenance"))extra+=' '+(v.kind==='lease'&&s.kintoMaintenance?t("results.includedInLeaseInvoices"):t("results.nominalBudgetServices",{services:t("common.services",{count:c[v.key].serviceCount}),serviceCost:money(s.serviceCost)}));
     if(label===t("results.monthlyBillAfterVatDeduction")&&v.kind==='lease')extra+=t("results.payPerInvoiceMonthTheVatDeductionOffsets",{value1:money(c.kRent+c.kInsurance),leaseVatPerPayment:money(c.leaseVatPerPayment)});
     explainResult(cell,help+'\n\n'+extra);
    }
   }
   const table=body.closest('table');
   for(const th of table?.querySelectorAll('thead th')||[]){
    const v=variants.find(v=>v.kind===th.dataset.option);
    // The resale axis stays nominal and full-sized, regardless of cost valuation switches.
    const resaleHeader=th.querySelector?.('#resaleColumnLabel');
    if(resaleHeader){
     explainResult(th,t("results.fullNominalKIncludingVatAtTheEnd",{value1:columnHelp[resaleHeader.textContent.trim()]}));
    }else explainResult(th,v?t("results.monthsKm3",{name:v.name,months:c[v.key].months,km:num(c[v.key].km),description4:annualViews[viewFor[id]]?t("results.annualAveragesOverThisOwnershipPeriod"):'',basis:basis}):(columnHelp[th.textContent.trim()]||t("results.costsForTheSelectedOptionOnThisTable"))+' '+basis);
   }
  }
 }

 function annotateInflationValues(s,resales,opportunityDetail){
  const active=variants.filter(v=>s[v.enabled]);
  const explanation=(nominal,unit="")=>t("results.estimatedTodaySMoneyUsingAnnualInflationNominal",{inflationRate:ratePercent(s.inflationRate),nominal:money(nominal),unit:unit});
  const mark=(element,enabled,text="")=>{
   if(!element)return;
   element.dataset.inflationEstimate=String(enabled);
   if(!enabled){element.classList.remove("explained");element.removeAttribute?.("tabindex");}
   if(enabled)explainResult(element,(element.dataset.explanation?element.dataset.explanation+"\n\n":"")+text);
  };
  const nominal=calculate(viewInputs(s,'summary'));
  for(const [prefix,key] of [['easy','balloonLoan'],['normal','standardLoan'],['kinto','lease'],['cash','cashPurchase']]){
   const value=nominal[key];
   for(const [suffix,amount,unit] of [["Total",resultValue(value),annualViews.summary?t("results.year"):t("results.total2")],["Annual",annualViews.summary?value.adjusted:value.adjusted*12/value.months,annualViews.summary?t("results.total2"):t("results.year")],[prefix==='kinto'?'Effective':'Monthly',value.adjusted/value.months,t("results.month")]]){
    const element=$(prefix+suffix);delete element.dataset.explanation;
    mark(element,inflationViews.summary,explanation(amount,unit));
   }
   const gross=value.events.filter(e=>e.category!=='vat').reduce((sum,e)=>sum+cashFlowValue(e,value.months,nominal.nominalReturn,s.inflationRate,{opportunity:opportunityViews.summary}),0);
   const element=$(prefix+'Gross');delete element.dataset.explanation;
   mark(element,inflationViews.summary,explanation(gross,t("results.total2")));
  }
  const winner=resultRanking(nominal)[0];
  // The nominal winner can differ, so explain the displayed option using its own nominal cost.
  const shown=variants.find(v=>v.kind===$('verdict').dataset.winner);
  delete $('saving').dataset.explanation;
  mark($('saving'),inflationViews.summary,explanation(shown?resultValue(nominal[shown.key]):winner.value,annualViews.summary?t("results.year"):t("results.total2")));
  const detailNominal=calculate(s),vatNominal=vatTableValues(s,detailNominal,false);
  const opportunityKeys=['upfront','payments','insurance','maintenance','tyres','additional','vatDuring','vatAfter','taxSavings','settlement','other'].filter(key=>active.some(v=>Math.abs(opportunityDetail[v.key].opportunityBreakdown[key])>1e-8));
  for(const [view,id] of [['opportunityBreakdown','opportunityRows'],['vat','vatTimeline']]){
   if(!inflationViews[view])continue;
   [...$(id).querySelectorAll('tr')].forEach((row,index)=>{
    const label=row.querySelector('th')?.textContent||'';
    for(const cell of row.querySelectorAll('td')){
     const variant=variants.find(v=>v.kind===cell.dataset.option);if(!variant||!cell.textContent.includes(i18n.symbol))continue;
     let value;
     if(view==='opportunityBreakdown')value=label===t("results.totalOpportunityCost")?detailNominal[variant.key].opportunity:detailNominal[variant.key].opportunityBreakdown[opportunityKeys[index]];
     else{
      const key={[t("results.purchaseVatRefund")]:'purchase',[t("results.initialLeasePaymentVat")]:'initial',[t("results.vatOnRegularLeaseInvoices")]:'regular',[t("results.maintenanceTyreVatRefunds")]:'maintenance',[t("results.maintenanceTyreAdditionalCostVatRefunds")]:'maintenance',[t("results.grossCarSaleProceeds")]:'grossSale',[t("results.vatPaidOnCarSale")]:'saleVat',[t("results.carSaleProceedsAfterVat")]:'netSale',[t("results.estimatedVatWithinRetainedCarValue")]:'saleVat',[t("results.vatWithinTyreResaleRetainedValue")]:'tyreVat',[t("results.leaseBuyoutVatRefund")]:'buyout',[t("results.totalVatStillToBeReceived")]:'outstanding'}[label];
      if(key)value=vatNominal[variant.key][key];
     }
     if(Number.isFinite(value))mark(cell,true,explanation(view==='opportunityBreakdown'?resultAmount(value,detailNominal[variant.key],view):value,view==='opportunityBreakdown'&&annualViews[view]?t("results.year"):""));
    }
   });
  }
  for(const [view,id] of [['monthly','monthlyRows'],['cost','costRows'],['versus','versusRows'],['interest','interestRows'],['resale','sensitivity']]){
   if(!inflationViews[view])continue;
   const raw=calculate(viewInputs(s,view));
   [...$(id).querySelectorAll('tr')].forEach((row,index)=>{
    const label=row.querySelector('th')?.textContent||'',cells=[...row.querySelectorAll('td')];
    const scenario=view==='resale'?calculate(withResale(viewInputs(s,view),resales[index])):raw;
    cells.forEach((cell,i)=>{
     const v=active[i];let value;
     if(view==='monthly'&&label===t("results.effectiveMonthlyOwnershipCost"))value=raw[v.key].adjusted/raw[v.key].months;
     if(view==='cost'){
      const variant=variants.find(v=>v.kind===cell.dataset.option);if(!variant)return;
      const field={[t("results.costBeforeOpportunity")]:'nominal',[t("ui.opportunityCost")]:'opportunity',[t("results.opportunityCostExcluded2")]:'opportunity',[t("results.totalEconomicCost")]:'adjusted'}[label];
      if(field)value=raw[variant.key][field];
      const componentKey={[t("results.vehiclePurchaseBuyout")]:"purchase",[t("results.carResaleRetainedValueCredit")]:"resale",[t("results.financingInterest")]:"interest",[t("results.leaseInvoicesInitialPayment")]:"lease",[t("results.insurancePaidSeparately")]:"insurance",[t("results.maintenance")]:"maintenance",[t("results.tyresServiceLessResale")]:"tyres",[t("ui.estimatedAdditionalCosts")]:"additional",[t("setup.actualAdditionalCosts")]:"additional",[t("results.otherCosts")]:"other",[t("results.netVatAdjustment")]:"vat",[t("results.estimatedTaxSavingsDuringOwnership")]:"taxSavings",[t("results.estimatedTaxAndContributionsOnSale")]:"saleTax"}[label];
      if(componentKey&&cell.textContent.includes(i18n.symbol))value=label===t("results.vehiclePurchaseBuyout")&&variant.kind!=='lease'?s.price:raw[variant.key].costComponents[componentKey];
      if(label===t("results.inflationBenefitOnDeferredPrincipal"))value=0;
      if(label===t("results.costBeforeIncomeTaxEffects"))value=raw[variant.key].nominal+raw[variant.key].taxSavings-raw[variant.key].saleTax;
     }
     if(view==='resale'&&v)value=resultValue(scenario[v.key],view);
     if(view==='versus'&&v&&i!==index)value=Math.abs(resultValue(raw[active[index].key],view)-resultValue(raw[v.key],view));
     if(view==='interest'&&i===3){
      const item=interestComparisons(viewInputs(s,'interest'),viewOptions('interest'),annualViews.interest)[index];
      value=Math.abs(resultValue(raw[item.loan],view)-resultValue(raw[item.target],view));
     }
     if(Number.isFinite(value))mark(cell,true,explanation(view==='cost'?resultAmount(value,raw[v.key],view):value,annualViews[view]?t("results.year"):view==='monthly'?t("results.month"):''));
    });
   });
  }
 }

 function explainResult(element,text){
  if(!element)return;
  const amount=element.querySelector?.('[data-full-term]');
  if(amount&&!text.includes(t('results.fullTermAmountMarker')))text+=t("results.fullTermAmountOverMonthsAnnualAverageYear",{fullTerm:money(Number(amount.dataset.fullTerm)),months:amount.dataset.months,value3:money(Number(amount.dataset.fullTerm)*12/Number(amount.dataset.months))});
  element.dataset.explanation=text;element.classList.add('explained');element.tabIndex=0;
 }

 function hideResultExplanation(){
  $('resultTooltip').hidden=true;
  activeResultExplanation?.removeAttribute('aria-describedby');activeResultExplanation=null;
 }

 function showResultExplanation(target,x,y){
  onShowTooltip();hideResultExplanation();
  const tooltip=$('resultTooltip');tooltip.textContent=target.dataset.explanation;tooltip.hidden=false;
  target.setAttribute('aria-describedby','resultTooltip');activeResultExplanation=target;
  const anchor=target.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  x??=anchor.left+Math.min(anchor.width/2,100);y??=anchor.bottom;
  const left=x+14+box.width<=window.innerWidth?x+14:x-14-box.width;
  const top=y+14+box.height<=window.innerHeight?y+14:y-14-box.height;
  tooltip.style.left=Math.max(8,Math.min(left,window.innerWidth-box.width-8))+'px';
  tooltip.style.top=Math.max(8,Math.min(top,window.innerHeight-box.height-8))+'px';
 }
 function initialize(){
  // Delegation keeps explanations working after any table is recalculated.
  $('comparison').addEventListener('pointerover',event=>{
   const target=event.target.closest('[data-explanation]');if(target)showResultExplanation(target,event.clientX,event.clientY);
  });
  $('comparison').addEventListener('pointerout',event=>{
   if(event.pointerType!=='touch'&&!event.relatedTarget?.closest('[data-explanation],#resultTooltip'))hideResultExplanation();
  });
  $('comparison').addEventListener('pointerdown',event=>{
   const target=event.target.closest('[data-explanation]');if(target&&event.pointerType==='touch')showResultExplanation(target,event.clientX,event.clientY);
  });
  $('comparison').addEventListener('focusin',event=>{const target=event.target.closest('[data-explanation]');if(target)showResultExplanation(target);});
  $('comparison').addEventListener('focusout',hideResultExplanation);
  $('comparison').addEventListener('keydown',event=>{if(event.key==='Escape')hideResultExplanation();});
  window.addEventListener('resize',hideResultExplanation);
  window.addEventListener('scroll',event=>{if(event.target!==$('resultTooltip'))hideResultExplanation();},true);
  $('resultTooltip').addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&!event.relatedTarget?.closest('[data-explanation]'))hideResultExplanation();});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('[data-explanation],#resultTooltip'))hideResultExplanation();});
 }
 return {render,vatTableValues,hideResultExplanation,showResultExplanation,initialize};
}
