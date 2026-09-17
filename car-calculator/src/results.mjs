import {variants,calculate,cashFlowValue,resaleComparisons,interestComparisons,comparisonValue,hasDifferentPeriods,withResale,resaleSamples,ranked} from "./model.mjs";
import {money,num,ratePercent,returnSummary} from "./format.mjs";

/** Render result tables and own their explanations, independently of graph state. */
export function createResults({document,window,views,onShowTooltip}){
 const $=id=>document.getElementById(id);
 let visibleKinds=new Set(variants.map(v=>v.kind));
 let activeResultExplanation=null;
 const {opportunityViews,inflationViews,viewOptions,viewInputs,moneyBasis,comparisonBasis,timeWording}=views;
 function row(label,b,n,l,c,cls=""){
  const cells=[b,n,l,c].map((value,i)=>visibleKinds.has(variants[i].kind)?'<td data-option="'+variants[i].kind+'">'+value+'</td>':"").join("");
  return '<tr class="'+cls+'"><th scope="row">'+label+'</th>'+cells+'</tr>';
 }
 const detail=(amount,note)=>'<span class="cell-amount">'+money(amount)+'</span><small>'+note+'</small>';
 const phase=label=>'<tr class="phase"><th colspan="'+(visibleKinds.size+1)+'" scope="rowgroup">'+label+'</th></tr>';

 function vatTableValues(s,c,todayMoney){
  const value=(amount,month)=>cashFlowValue({amount,month},0,0,s.inflationRate,{opportunity:false,todayMoney});
  const vatFraction=s.vatEnabled?s.vatPct/(100+s.vatPct)*s.recoveryPct/100:0;
  return Object.fromEntries(variants.map(v=>{
   const o=c[v.key],lease=v.kind==='lease';
   const regular=lease?Array.from({length:o.months},(_,month)=>value(c.leaseVatPerPayment,month+s.leaseVatDelay)).reduce((a,b)=>a+b,0)/o.months:0;
   const maintenance=o.events.filter(e=>['maintenance','tyres','additional'].includes(e.category)&&e.amount>0).reduce((sum,e)=>sum+value(e.amount*vatFraction,e.month),0);
   return [v.key,{purchase:lease?0:value(c.purchaseRefund,s.purchaseVatDelay),initial:lease?value(c.leaseInitialVat,s.leaseVatDelay):0,regular,maintenance,
    grossSale:value(o.resale,o.months),saleVat:value(o.carSaleVat,o.months),netSale:value(o.resale-o.carSaleVat,o.months),
    tyreVat:value(s.vatEnabled?s.tyreResale*s.vatPct/(100+s.vatPct):0,o.months),buyout:lease?value(c.buyoutRefund,o.months+s.purchaseVatDelay):0,
    outstanding:-o.events.filter(e=>e.category==='vat'&&e.amount<0&&e.month>o.months).reduce((sum,e)=>sum+value(e.amount,e.month),0)}];
  }));
 }

 function render(s,c){
  visibleKinds=new Set(variants.filter(v=>s[v.enabled]).map(v=>v.kind));
  $("error").hidden=true;$("resultContent").hidden=false;$("graphContent").hidden=false;
  for(const key of Object.keys(opportunityViews)){
   $('opportunity-'+key+'-note').textContent=opportunityViews[key]?'Included · '+returnSummary(s):'Opportunity cost excluded';
  }
  for(const key of Object.keys(inflationViews)){
   $('inflation-'+key+'-note').dataset.active=String(inflationViews[key]);
   $('inflation-'+key+'-note').textContent=inflationViews[key]?"Estimated today’s money · "+ratePercent(s.inflationRate)+" inflation":"Nominal amounts · inflation adjustment off";
  }
  const summaryInputs=viewInputs(s,'summary'),summary=calculate(summaryInputs,viewOptions('summary'));
  const viewCost=key=>calculate(viewInputs(s,key),viewOptions(key));
  const monthly=viewCost('monthly'),cost=viewCost('cost'),versus=viewCost('versus');
  const b=c.balloonLoan,n=c.standardLoan,l=c.lease,cash=c.cashPurchase;
  $("scenarioName").textContent=s.carName||"Your car";
  const split=hasDifferentPeriods(s),unit=split?" / month effective":"",value=o=>comparisonValue(o,split);
  const active=variants.filter(v=>s[v.enabled]);
  const anyValue=values=>values.some((amount,index)=>s[variants[index].enabled]&&Math.abs(amount)>1e-8);
  const additionalLabel=s.pastOwnership?"Actual additional costs":"Estimated additional costs";
  const additionalActive=anyValue(variants.map(v=>c[v.key].additionalCosts));
  const runningVatLabel=additionalActive?"Maintenance / tyre / additional-cost VAT refunds":"Maintenance / tyre VAT refunds";
  $("termLabel").textContent=(split?"DIFFERENT PERIODS · MONTHLY COMPARISON":c[active[0].key].months+" MONTHS / "+num(c[active[0].key].km)+" KM")+" / "+(s.vatEnabled?"AFTER VAT RECOVERY":"NO VAT RECOVERY");
  const sorted=ranked(summary,split),gap=sorted.length>1?sorted[1].value-sorted[0].value:0,tie=sorted.length>1&&gap<.5;
  $("verdict").dataset.winner=tie?"tie":sorted[0].key;
  $("resultsOverview").dataset.winner=$("verdict").dataset.winner;
  $("winner").textContent=sorted.length===1?sorted[0].name:tie?"The lowest-cost options tie":sorted[0].name+" costs least";
  $("saving").textContent=money(sorted[0].value)+unit;
  $("savingNote").textContent=(sorted.length===1?"Only one option selected.":tie?"The selected options tie.":money(gap)+(split?" / month":"")+" less than "+sorted[1].name.toLowerCase()+".")+" "+(opportunityViews.summary?"Includes opportunity cost at "+returnSummary(s)+".":"Excludes opportunity cost.");
  for(const [prefix,key,monthlyId] of [["easy","balloonLoan","easyMonthly"],["normal","standardLoan","normalMonthly"],["kinto","lease","kintoEffective"],["cash","cashPurchase","cashMonthly"]]){
   $(prefix+"Total").textContent=money(summary[key].adjusted);$(monthlyId).textContent=money(summary[key].adjusted/summary[key].months)+" / month effective";
  }
  // Compare the same cash flows before VAT settlement, without dividing VAT-free costs by the VAT rate.
  // Remove VAT events only, preserving the same independently estimated income-tax effects.
  const beforeVat=Object.fromEntries(variants.map(v=>{
   const result=summary[v.key];
   const vatEffect=result.events.filter(e=>e.category==="vat").reduce((sum,e)=>sum+cashFlowValue(e,result.months,summary.nominalReturn,s.inflationRate,viewOptions("summary")),0);
   return [v.key,{adjusted:result.adjusted-vatEffect}];
  }));
  for(const [prefix,key] of [["easy","balloonLoan"],["normal","standardLoan"],["kinto","lease"],["cash","cashPurchase"]]){
   $(prefix+"VatBasis").textContent=s.vatEnabled?"Total, net after VAT settlement · "+summary[key].months+" months":"Total including VAT · recovery off · "+summary[key].months+" months";
   $(prefix+"Annual").textContent=money(summary[key].adjusted*12/summary[key].months)+" / year effective";
   const gross=beforeVat[key].adjusted;
   $(prefix+"Gross").innerHTML='<span class="gross-total">'+money(gross)+' total</span><small>'+money(gross*12/summary[key].months)+' / year<br>'+money(gross/summary[key].months)+' / month</small>';
  }
  $("resultsVatNote").textContent="These totals are "+comparisonBasis("summary")+". Annual and monthly amounts spread the full cost over each option’s selected term. Different terms are ranked by effective monthly cost; these are separate ownership plans, with no assumed renewals. "+
   (s.vatEnabled?"Net after VAT includes eligible deductions and sale VAT; any non-recoverable VAT remains in the cost. The comparison below each total excludes VAT refunds and sale VAT payments.":"VAT recovery is off, so both views include VAT without refunds or sale VAT payments.")+(s.incomeTaxEnabled?" Both views include the estimated income-tax savings and sale charges entered in Setup.":"");
  const matchRows=interestComparisons(viewInputs(s,'interest'),viewOptions('interest'));
  const names=Object.fromEntries(variants.map(v=>[v.key,v]));
  const label=key=>'<span class="option-label" data-option="'+names[key].kind+'">'+names[key].name+'</span>';
  const rateLabels={"below-zero":"No rate ≥ 0%","above-range":"No match in 0–100%","unaffected":"No match","equal":"Any rate"};
  const interestCost=calculate(viewInputs(s,'interest'),viewOptions('interest'));
  $("interestRows").innerHTML=matchRows.length?matchRows.map(item=>{
   const difference=value(interestCost[item.loan])-value(interestCost[item.target]);
   const differenceLabel=Math.abs(difference)<.5?'Same cost':money(Math.abs(difference))+(split?' / month':'')+' '+(difference<0?'less':'more');
   return '<tr><th scope="row">'+label(item.loan)+'</th><td>'+label(item.target)+'</td><td>'+item.currentRate.toFixed(2)+'%</td><td>'+(item.rate===null?rateLabels[item.status]:item.rate.toFixed(3)+'% p.a.')+'</td><td>'+differenceLabel+'</td></tr>';
  }).join(''):'<tr><td colspan="5">Select a loan and either outright purchase or lease to calculate a matching rate.</td></tr>';
  $("monthlyRows").innerHTML=[
  row("Period / mileage",...variants.map(v=>c[v.key].months+" months / "+num(c[v.key].km)+" km")),
  (s.balloonEnabled||s.normalEnabled)?row("Loan repayment period",b.loanMonths+" months",n.loanMonths+" months","Lease contract","No loan"):"",
  (s.balloonEnabled||s.normalEnabled||s.leaseEnabled)?row("Loan payment / lease invoice",money(c.payment),money(c.normalPayment),money(c.kRent),"No repayment"):"",
  row("Insurance paid separately",money(s.easyInsurance),money(s.normalInsurance),s.kintoInsuranceIncluded?"Included in invoice":money(c.kInsurance),money(s.cashInsurance)),
  row("Monthly bill incl. insurance",detail(c.insuredPayment,"During "+b.paidMonths+" repayment months"),detail(c.normalPayment+s.normalInsurance,"During "+n.paidMonths+" repayment months"),money(c.kRent+c.kInsurance),money(s.cashInsurance),"emphasis"),
  (s.balloonEnabled&&b.loanMonths<b.months||s.normalEnabled&&n.loanMonths<n.months)?row("Monthly bill after loan ends",b.loanMonths<b.months?detail(s.easyInsurance,"Months "+(b.loanMonths+1)+"–"+b.months):"Outside ownership period",n.loanMonths<n.months?detail(s.normalInsurance,"Months "+(n.loanMonths+1)+"–"+n.months):"Outside ownership period","—",money(s.cashInsurance)):"",
  s.leaseEnabled&&c.leaseVatPerPayment?row("VAT refund per lease invoice","—","—",money(c.leaseVatPerPayment),"—"):"",
  s.leaseEnabled&&c.leaseVatPerPayment?row("Monthly bill less eventual VAT refund",money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),detail(c.kRent+c.kInsurance-c.leaseVatPerPayment,s.leaseVatDelay?"Refund "+s.leaseVatDelay+" months after invoice":"VAT deducted with each payment"),money(s.cashInsurance)):"",
  row("Effective monthly ownership cost",...variants.map(v=>money(monthly[v.key].adjusted/monthly[v.key].months)),"sum")
  ].join("");
  const conversion=s.opportunityRateBasis==="real"?returnSummary(s)+" with "+ratePercent(s.inflationRate)+" inflation gives "+ratePercent(c.nominalReturn)+" p.a. after tax, before inflation.":returnSummary(s)+" is used directly. The inflation estimate also powers each today’s-money toggle.";
  $("returnConversion").textContent=s.pastOwnership?"Return is the alternative nominal after-tax investment return over the historical period. Costs and resale are nominal amounts at their original dates; inflation switches convert them to purchase-date purchasing power.":conversion+" Enter costs and direct resale estimates in nominal Kč, the amounts expected to be paid or received. Relative resale uses this inflation rate to project a nominal selling price. Each comparison can show their value in today’s money.";
  $("opportunityIntro").textContent=conversion+" Payments and refunds are carried to each option’s end date using that nominal return.";
  const opportunityDetail=calculate(s,{opportunity:true,todayMoney:inflationViews.opportunityBreakdown});
  const opportunityGroups=[
  ["upfront","Deposit / initial payment / outright purchase"],["payments","Regular loan / lease payments"],["insurance","Separately paid insurance"],
  ["maintenance","Maintenance payments"],["tyres","Tyre purchase and seasonal service"],["additional",additionalLabel],
  ["vatDuring","VAT refunds during the term"],["vatAfter","VAT refunds after the term"],
  ["taxSavings","Income-tax and contribution savings"],
  ["settlement","Final balloon, buyout, sale and sale tax"],["other","Other payments"]
  ];
  $("opportunityRows").innerHTML=opportunityGroups.filter(([key])=>anyValue(variants.map(v=>opportunityDetail[v.key].opportunityBreakdown[key]))).map(([key,label])=>row(label,...variants.map(v=>money(opportunityDetail[v.key].opportunityBreakdown[key])))).join("")+
  row("Total opportunity cost",...variants.map(v=>money(opportunityDetail[v.key].opportunity)),"sum");
  $("opportunityExample").hidden=!s.balloonEnabled;
  $("opportunityExample").innerHTML='<span data-option="balloon">Balloon loan example</span>: the '+money(c.down)+' deposit is paid at month zero. At '+ratePercent(c.nominalReturn)+' nominal annual return over '+b.months+' months, its foregone return is '+money(opportunityDetail.balloonLoan.opportunityBreakdown.upfront)+' '+moneyBasis("opportunityBreakdown")+'.';
  $("serviceNote").textContent=s.matchPeriods?c.serviceCount+" services · "+money(c.maintenance):active.map(v=>v.name+": "+c[v.key].serviceCount+" services · "+money(c[v.key].maintenance)).join(" | ");
  const purchaseSold=s.loanEnd==="sell",leaseSold=s.leaseEnd==="buySell",leaseBought=s.leaseEnd!=="return";
  const anySale=(purchaseSold&&(s.balloonEnabled||s.normalEnabled||s.cashEnabled))||(s.leaseEnabled&&leaseSold);
  const component=(key,field)=>cost[key].costComponents[field];
  $("costRows").innerHTML=[
  row("Vehicle purchase / buyout",money(s.price),money(s.price),leaseBought?money(component("lease","purchase")):"No purchase",money(s.price)),
  (s.balloonEnabled||s.normalEnabled)?row("Inflation benefit on deferred principal",...variants.map(v=>money(v.loanMonths&&inflationViews.cost&&s.inflationRate>0?component(v.key,"purchase")-s.price:0))):"",
  row("Car resale / retained value credit",money(component("balloonLoan","resale")),money(component("standardLoan","resale")),leaseBought?money(component("lease","resale")):"Car returned",money(component("cashPurchase","resale"))),
  (s.balloonEnabled||s.normalEnabled)?row("Financing interest",money(component("balloonLoan","interest")),money(component("standardLoan","interest")),"In lease","No loan"):"",
  s.leaseEnabled?row("Lease invoices + initial payment","—","—",money(component("lease","lease")),"—"):"",
  row("Insurance paid separately",money(component("balloonLoan","insurance")),money(component("standardLoan","insurance")),s.kintoInsuranceIncluded?"In lease":money(component("lease","insurance")),money(component("cashPurchase","insurance"))),
  row("Maintenance",detail(component("balloonLoan","maintenance"),b.serviceCount+" services"),detail(component("standardLoan","maintenance"),n.serviceCount+" services"),s.kintoMaintenance?"In lease":detail(component("lease","maintenance"),l.serviceCount+" services"),detail(component("cashPurchase","maintenance"),cash.serviceCount+" services")),
  row("Tyres & service, less resale",money(component("balloonLoan","tyres")),money(component("standardLoan","tyres")),s.kintoTyres?"In lease":money(component("lease","tyres")),money(component("cashPurchase","tyres"))),
  row(additionalLabel,...variants.map(v=>money(component(v.key,"additional")))),
  anyValue([s.easyExtra,s.normalExtra,s.kintoExtra,s.cashExtra])?row("Other costs",...variants.map(v=>money(component(v.key,"other")))):"",
  s.vatEnabled?row("Net VAT adjustment",...variants.map(v=>money(component(v.key,"vat")))):"",
  s.incomeTaxEnabled?row("Cost before income-tax effects",...variants.map(v=>money(cost[v.key].beforeOpportunity-component(v.key,"taxSavings")-component(v.key,"saleTax"))),"subtotal"):"",
  s.incomeTaxEnabled?row("Estimated tax savings during ownership",...variants.map(v=>money(component(v.key,"taxSavings")))):"",
  s.incomeTaxEnabled?row("Estimated tax and contributions on sale",...variants.map(v=>money(component(v.key,"saleTax")))):"",
  row("Cost before opportunity",...variants.map(v=>money(cost[v.key].beforeOpportunity))),
  row(inflationViews.cost?"Inflation effect (already included)":"Inflation adjustment (excluded)",...variants.map(v=>money(cost[v.key].inflationAdjustment)),"inflation-summary"),
  row(opportunityViews.cost?"Opportunity cost":"Opportunity cost (excluded)",...variants.map(v=>money(cost[v.key].opportunity))),
  row("Total economic cost",...variants.map(v=>money(cost[v.key].adjusted)),"sum")].join("");

  const resaleInputs=viewInputs(s,'resale'),pairs=resaleComparisons(resaleInputs,viewOptions("resale")),optionKeys=active.map(v=>v.key);
  $("versusBasis").textContent=(split?"Effective monthly costs for different periods":"Full-term costs")+", with VAT treatment, "+comparisonBasis("versus")+".";
  $("resaleColumnLabel").textContent=s.matchPeriods?"Car resale":"Resale change";
  $("sensitivityBasis").textContent=(split?"Monthly costs":"Full-term costs")+" with VAT treatment, "+comparisonBasis("resale")+". "+(s.matchPeriods?"Resale column is the shared gross selling price.":"Resale column is a change from each option’s own end value.")+" Extra rows show exact break-even points.";
  $("versusRows").innerHTML=optionKeys.map(left=>{
   const cells=optionKeys.map(right=>{
    if(left===right)return '<td class="versus-diagonal" aria-label="Same option">—</td>';
    const difference=value(versus[left])-value(versus[right]);
    if(Math.abs(difference)<.5)return '<td class="versus-tie">Same cost</td>';
    const direction=difference<0?"less":"more";
    return '<td class="versus-'+direction+'"><span>'+money(Math.abs(difference))+'</span><small>'+direction+'</small></td>';
   }).join("");
   return '<tr><th scope="row" data-option="'+names[left].kind+'">'+label(left)+'</th>'+cells+'</tr>';
  }).join("");
  // Show crossovers explicitly alongside the five resale estimates.
  const resalePoints=resaleSamples(resaleInputs,pairs);
  $("sensitivity").innerHTML=resalePoints.map(resale=>{
   const next=calculate(withResale(resaleInputs,resale),viewOptions("resale")),r=ranked(next,split);
   const matching=pairs.filter(p=>p.resale!==null&&Math.abs(p.resale-resale)<.01);
   const note=matching.map(p=>label(p.left)+" = "+label(p.right)).join("<br>");
   const tiedOptions=r.filter(item=>Math.abs(item.value-r[0].value)<.5);
   const winner=tiedOptions.length>1?tiedOptions.map(item=>'<span data-option="'+item.key+'">'+item.name+'</span>').join(" + ")+" tie":'<span data-option="'+r[0].key+'">'+r[0].name+'</span>';
   const cells=active.map(v=>'<td data-option="'+v.kind+'">'+money(value(next[v.key]))+'</td>').join("");
   return '<tr class="'+(Math.abs(resale-s.resale)<.01?"selected ":"")+(matching.length?"breakpoint":"")+'"><th scope="row">'+(s.matchPeriods?money(resale):(resale-s.resale>0?"+":"")+money(resale-s.resale))+(note?'<small class="breakpoint-note">Break-even<br>'+note+'</small>':"")+'</th>'+cells+'<td>'+winner+'</td></tr>';
  }).join("");

  const endNote=o=>"Month "+o.months;
  const refundNote=amount=>amount?"Month "+s.purchaseVatDelay:"No eligible deduction";
  const saleCell=(sold,amount,description)=>sold?detail(amount,description):"No sale";
  const vat=vatTableValues(s,c,inflationViews.vat);
  const tyreSaleVat=s.vatEnabled?s.tyreResale*s.vatPct/(100+s.vatPct):0;
  const tyreVatValues=variants.map(v=>v.kind==='lease'&&s.kintoTyres?0:tyreSaleVat);
  $("vatPanel").hidden=!s.vatEnabled;
  $("vatTimeline").innerHTML=[
  (s.balloonEnabled||s.normalEnabled||s.cashEnabled||(s.leaseEnabled&&c.leaseInitialVat))?phase("01 · Purchase and lease start"):"",
  (s.balloonEnabled||s.normalEnabled||s.cashEnabled)?row("Purchase VAT refund",detail(vat.balloonLoan.purchase,refundNote(c.purchaseRefund)),detail(vat.standardLoan.purchase,refundNote(c.purchaseRefund)),"Not a purchase",detail(vat.cashPurchase.purchase,refundNote(c.purchaseRefund))):"",
  s.leaseEnabled&&c.leaseInitialVat?row("Initial lease payment VAT","—","—",detail(vat.lease.initial,"Month "+s.leaseVatDelay),"—"):"",
  phase("02 · During the agreement"),
  s.leaseEnabled?row("VAT on regular lease invoices","No VAT on loan repayments","No VAT on loan repayments",detail(vat.lease.regular,(inflationViews.vat?"Average per invoice":"Per invoice")+" · months "+s.leaseVatDelay+"–"+(l.months-1+s.leaseVatDelay)),"No regular purchase payments"):"",
  row(runningVatLabel,detail(vat.balloonLoan.maintenance,"Netted against the expense"),detail(vat.standardLoan.maintenance,"Netted against the expense"),detail(vat.lease.maintenance,"Netted against the expense"),detail(vat.cashPurchase.maintenance,"Netted against the expense")),
  phase("03 · At each option’s end date"),
  row("Gross car sale proceeds",purchaseSold?detail(vat.balloonLoan.grossSale,endNote(b)):"Car kept",purchaseSold?detail(vat.standardLoan.grossSale,endNote(n)):"Car kept",leaseSold?detail(vat.lease.grossSale,endNote(l)):leaseBought?"Car kept":"Car returned",purchaseSold?detail(vat.cashPurchase.grossSale,endNote(cash)):"Car kept"),
  anySale?row("VAT paid on car sale",saleCell(purchaseSold,vat.balloonLoan.saleVat,endNote(b)),saleCell(purchaseSold,vat.standardLoan.saleVat,endNote(n)),saleCell(leaseSold,vat.lease.saleVat,endNote(l)),saleCell(purchaseSold,vat.cashPurchase.saleVat,endNote(cash))):"",
  anySale?row("Car sale proceeds after VAT",saleCell(purchaseSold,vat.balloonLoan.netSale,b.remainingPrincipal||b.loanMonths===b.months?"Before loan settlement":"Loan already repaid"),saleCell(purchaseSold,vat.standardLoan.netSale,n.remainingPrincipal?"Before loan settlement":"Loan fully repaid"),saleCell(leaseSold,vat.lease.netSale,"Before deducting buyout"),saleCell(purchaseSold,vat.cashPurchase.netSale,"No loan to settle")):"",
  anyValue(variants.map(v=>c[v.key].retainedValue))?row("Estimated VAT within retained car value",...variants.map(v=>(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?detail(vat[v.key].saleVat,"Valuation only; no tax paid now"):"No retained car")):"",
  anyValue(tyreVatValues)?row("VAT within tyre resale / retained value",...variants.map((v,index)=>v.kind==='lease'&&s.kintoTyres?"Lease-owned tyres":detail(vat[v.key].tyreVat,(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?"Valuation only; no tax paid now":"Paid within tyre sale proceeds"))):"",
  s.leaseEnabled&&leaseBought?row("Lease buyout VAT refund","No new VAT on balloon repayment","—",detail(vat.lease.buyout,c.buyoutRefund?"Month "+(l.months+s.purchaseVatDelay):"No eligible deduction"),"—"):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?phase("04 · Refunds outstanding at end of term"):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?row("Total VAT still to be received",detail(vat.balloonLoan.outstanding,"Already included in total cost"),detail(vat.standardLoan.outstanding,"Already included in total cost"),detail(vat.lease.outstanding,"Already included in total cost"),detail(vat.cashPurchase.outstanding,"Already included in total cost")):""
  ].join("");
  $("cashflow").innerHTML=[
  s.incomeTaxEnabled?row("Taxable car-sale amount",...variants.map(v=>(v.kind==="lease"?leaseSold:purchaseSold)?(s.saleTaxRate?money(c[v.key].taxableSale):"0% sale rate"):"No sale")):"",
  s.incomeTaxEnabled?row("Estimated net car-sale proceeds",...variants.map(v=>(v.kind==="lease"?leaseSold:purchaseSold)?money(c[v.key].resale-c[v.key].carSaleVat-c[v.key].saleTax):"No sale")):"",
  row("Deposit / initial payment / outright purchase",money(c.down),money(c.normalDown),money(s.kintoInitial),money(s.price)),
  anyValue([b.balloonPaid,0,leaseBought?s.leaseBuyout:0,0])?row("Balloon paid / lease buyout",b.balloonPaid?detail(b.balloonPaid,"Month "+b.loanMonths):"No balloon paid","No balloon",leaseBought?detail(s.leaseBuyout,"Month "+l.months):"No buyout","No loan"):"",
  anyValue([b.remainingPrincipal,n.remainingPrincipal,0,0])?row("Remaining loan at comparison end",detail(b.remainingPrincipal,purchaseSold?"Paid off on sale":"Deducted from retained value"),detail(n.remainingPrincipal,purchaseSold?"Paid off on sale":"Deducted from retained value"),"No loan","No loan"):"",
  row("Net cash paid at start",...variants.map(v=>money(c[v.key].events.filter(e=>e.type==='cash'&&e.month===0).reduce((sum,e)=>sum+e.amount,0)))),
  row("Net cash paid at end date",...variants.map(v=>money(c[v.key].events.filter(e=>e.type==='cash'&&Math.abs(e.month-c[v.key].months)<1e-8).reduce((sum,e)=>sum+e.amount,0)))),
  row("Net cash spent through each term",money(b.cashToEnd),money(n.cashToEnd),money(l.cashToEnd),money(cash.cashToEnd)),
  anyValue(variants.map(v=>c[v.key].retainedValue))?row("Less retained car and tyre value",money(-b.retainedValue),money(-n.retainedValue),money(-l.retainedValue),money(-cash.retainedValue)):"",
  anyValue(variants.map(v=>c[v.key].futureRefund))?row("Less VAT refunds due after each term",money(-b.futureRefund),money(-n.futureRefund),money(-l.futureRefund),money(-cash.futureRefund)):"",
  row("Economic cost before opportunity",money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal),"sum")
  ].join("");
  decorateResultTables(s,c,matchRows,resalePoints,opportunityDetail);
  annotateInflationValues(s,resalePoints,opportunityDetail);
  return c;
 }

 function decorateResultTables(s,c,matches,resales,opportunityDetail){
  const active=variants.filter(v=>s[v.enabled]),split=hasDifferentPeriods(s);
  const additionalLabel=s.pastOwnership?'Actual additional costs':'Estimated additional costs';
  const additionalActive=active.some(v=>Math.abs(c[v.key].additionalCosts)>1e-8);
  const runningVatLabel=additionalActive?'Maintenance / tyre / additional-cost VAT refunds':'Maintenance / tyre VAT refunds';
  const descriptions={
   'Period / mileage':'Each option has its own term. Mileage is annual kilometres × months ÷ 12. Different terms are compared by average monthly cost, without assuming renewals.',
   'Loan payment / lease invoice':'Regular finance payment only. Loan payments include principal and interest but exclude the deposit and final balloon. Lease invoices include VAT and whichever services you marked as included.',
   'Insurance paid separately':'Only separately entered insurance is added here. Coverage, including GAP, is whatever your quote actually provides; this calculator does not verify it. Insurance bundled into a lease is already in the lease invoice.',
   'Monthly bill incl. insurance':'The recurring amount paid before any separate VAT refund. Adds the loan payment or lease invoice and separately paid insurance. Maintenance, tyres, deposits and final payments are separate.',
   'VAT refund per lease invoice':'Eligible refund from one lease invoice, after the taxable-share and recovery-percentage settings. This is a tax refund, not a discount on the invoice or on a loan repayment.',
   'Monthly bill less eventual VAT refund':'Recurring bill minus the VAT refund associated with that invoice. This is a net cost, not necessarily cash paid in that month. During a refund delay you still fund the gross invoice.',
   'Effective monthly ownership cost':'Total ownership cost on this table’s opportunity-cost basis ÷ the option’s months. Includes upfront and final payments, running costs, resale or retained value, and VAT settlement. This is not a monthly invoice.',
   'Vehicle purchase / buyout':'The invoice price for a car purchased now stays unchanged when inflation is toggled. Loans show the inflation benefit from paying principal later as a separate credit in the next row. A lease buyout occurs in the future, so its amount is converted to today’s money when selected. VAT deductions are separate.',
   'Inflation benefit on deferred principal':'Negative credit for repaying borrowed principal later, when it has less purchasing power. Equals the value of the deposit and principal payments in today’s money minus today’s invoice price. Includes the balloon or debt outstanding at the comparison end. Interest is separate. Zero when inflation is off or no principal is deferred. This credit is included once in the subtotal; the later inflation-effect row is only a summary.',
   'Car resale / retained value credit':'Negative amount reduces cost by the gross car resale estimate. If the car is kept, this is an asset valuation rather than cash received. Disposal VAT is accounted for separately in Net VAT adjustment. Tyres have their own value credit. With today’s money enabled, this credit is discounted to its purchasing power today. Hover or focus an amount for both values.',
   'Financing interest':'Interest accrued through the ownership period or loan maturity, whichever comes first. With today’s money on, each payment’s interest portion is discounted on its payment date. Excludes future interest after an early sale. The deposit is not borrowed. Lease financing is not separately known and stays inside lease invoices.',
   'Lease invoices + initial payment':'Gross monthly lease invoice × lease months, plus the initial lease payment. Includes services and insurance marked as bundled. A buyout is counted in Vehicle purchase / buyout.',
   'Maintenance':'Number of services due × gross service price. A service is due at the earlier distance or time interval, including one due exactly at the end. Eligible VAT is deducted in Net VAT adjustment.',
   'Tyres & service, less resale':'Gross tyre purchase plus seasonal swaps and storage, minus the tyre resale or retained-value estimate. Eligible VAT and disposal VAT appear in Net VAT adjustment. Lease-owned tyres have no separate value credit.',
   [additionalLabel]:'Separate gross repair and similar costs outside scheduled maintenance. Annual mode charges the budget at each completed year and prorates a final partial year; year-specific mode uses each entered annual amount on the same schedule. Eligible VAT is deducted in Net VAT adjustment. The lease includes these costs only when selected in Setup.',
   'Other costs':'Extra costs entered for each option, paid at that option’s end date. The model does not apply another VAT deduction to them.',
   'Net VAT adjustment':'All eligible VAT refunds reduce cost; VAT on disposal increases it. Includes refunds arriving after the term. For kept assets, estimated disposal VAT reduces retained value without creating a tax payment now.',
   'Cost before income-tax effects':'Subtotal of ownership costs after VAT, before the optional income-tax savings and sale charges. This is a subtotal, not an additional cost.',
   'Estimated tax savings during ownership':'Manual full-term deductible expenses × effective tax and contribution rate. Shown as a negative credit. Savings are spread evenly and received every 12 months, with a final partial-year receipt at the end.',
   'Estimated tax and contributions on sale':'Positive car sale proceeds after VAT minus the entered remaining deductible tax value, multiplied by the effective sale rate. No tax benefit from a loss, no tyre-sale tax, and no sale tax on kept cars or returned leases is assumed.',
   'Taxable car-sale amount':'Calculation base, not a cash flow or extra cost: max(0, car sale proceeds after VAT − remaining deductible tax value). Used only when income-tax estimates are enabled and the car is sold.',
   'Estimated net car-sale proceeds':'Gross car sale proceeds minus output VAT and the estimated sale tax and contributions. Still before settling any remaining loan or deducting a lease buyout. Tyres are separate.',
   "Inflation adjustment (excluded)":"This table’s today’s-money toggle is off. Zero inflation adjustment is added; the Setup inflation estimate and other views are unchanged.",
   "Inflation effect (already included)":'Informational only: the difference between the components in today’s money and their nominal total. Every component above is already adjusted using its own payment or receipt date. Do not add this row to the subtotal again. Opportunity cost below is a separate addition.',
   'Cost before opportunity':'Sum of the cost components above after VAT treatment and any selected inflation adjustment, before any foregone investment return. Includes retained asset value and outstanding VAT refunds, so it is not just cash paid to date.',
   'Opportunity cost':'Foregone after-tax return from the timing of payments and refunds, measured at each option’s end date. Added to cost before opportunity, using the return assumption in Setup.',
   'Opportunity cost (excluded)':'This table’s toggle excludes foregone return. Zero is added to the total here; the Setup return assumption and other views are unchanged.',
   'Total economic cost':'Cost before opportunity plus the opportunity cost selected for this table, on the same nominal or today’s-money basis. Each column covers its own full term, so compare monthly averages if the terms differ.',
   'Total opportunity cost':'Sum of the timing effects shown above, using the Setup return assumption regardless of other tables’ toggles. Refunds before the end reduce foregone return; refunds after the end incur a delay cost.',
   'Purchase VAT refund':'Eligible VAT from the original vehicle purchase, subject to invoice eligibility, recovery percentage and capital cap. Arrives after the purchase refund delay, even when a loan funds the invoice. It does not reduce loan principal.',
   'Initial lease payment VAT':'Eligible VAT refund on the initial lease payment, using the lease taxable share and lease refund delay. It is separate from refunds on monthly lease invoices.',
   'VAT on regular lease invoices':'Refund for each monthly invoice, not the total for the lease. Lease invoices are modelled at months 0 through term minus one; the configured refund delay shifts receipt dates.',
   [runningVatLabel]:'Eligible VAT on separately paid maintenance, tyre purchase, swaps, storage'+(additionalActive?' and additional repair costs':'')+'. Netted against those expenses immediately under the calculator’s next-month deduction convention.',
   'Gross car sale proceeds':'Car sale price including VAT at the option’s end date. A kept car creates no sale receipt; its estimated net value is an asset credit instead. Tyre proceeds are separate.',
   'VAT paid on car sale':'The VAT portion already inside the gross car sale proceeds, paid to the tax authority at the sale date. It is not additional income or an extra tax on top of the entered selling price.',
   'Car sale proceeds after VAT':'Gross car proceeds minus car sale VAT. Still before loan settlement or lease buyout; excludes income tax and contributions, tyre proceeds and delayed buyout VAT refunds.',
   'Estimated VAT within retained car value':'Valuation adjustment only. A kept car is credited at estimated resale value net of disposal VAT. This is not a sale and no tax cash payment occurs now.',
   'VAT within tyre resale / retained value':'VAT within the separately entered tyre value. It is paid when the tyres are sold, or deducted only from the retained-value estimate if they are kept. No separate credit applies to lease-owned tyres.',
   'Lease buyout VAT refund':'Eligible VAT from the end-of-lease purchase, using its own invoice eligibility and capital cap. Arrives after the purchase refund delay, which can be after the comparison end.',
   'Total VAT still to be received':'VAT refunds dated after this option’s end. Already credited in ownership cost, but not yet received in cash. Opportunity cost includes the effect of waiting for them.',
   'Deposit / initial payment / outright purchase':'The purchase deposit, initial lease fee, or full outright price. This is one component of the start payment; the net start-cash row also includes any first lease invoice, tyres, insurance and immediate refunds.',
   'Balloon paid / lease buyout':'Balloon actually paid at loan maturity, or purchase at lease end. The displayed month can precede the ownership end. Early sales settle the outstanding balance in the next row instead.',
   'Remaining loan at comparison end':'Principal still outstanding after the last modelled regular payment, including the unpaid balloon. A sale settles it in cash. If the car is kept, it reduces net retained value. Future interest is excluded; enter any early-settlement fee in Other loan costs.',
   'Loan repayment period':'Contractual repayment length, independent of ownership. Payments stop at maturity; an earlier sale pays off the remaining principal.',
   'Monthly bill after loan ends':'Separately paid insurance for the rest of ownership. Loan repayments have stopped. Maintenance and tyres continue separately and are included in effective ownership cost.',
   'Net cash paid at start':'All actual cash events at month zero, including the initial payment, any first lease invoice, insurance, tyres, seasonal service and immediate VAT refunds. This snapshot is already part of net cash spent.',
   'Net cash paid at end date':'All actual cash events at the exact end date: final repayments or buyout, due insurance, maintenance or additional costs, sales and sale tax, and refunds arriving then. Negative means cash received. Retained assets and later refunds are excluded. Already part of net cash spent.',
   'Net cash spent through each term':'Sum of cash paid minus receipts through the end date, including upfront payments, repayments and sale settlement. Start and end snapshots above must not be added again.',
   'Less retained car and tyre value':'Subtracts the estimated net value of assets you still own. This reduces economic cost but is not cash received. Both car and separately owned tyres are included after estimated disposal VAT and any outstanding loan principal. A negative retained value means the debt exceeds the assets.',
   'Less VAT refunds due after each term':'Subtracts refunds still due after the end. These are already included in economic cost but not yet in net cash spent. The timing effect is separate opportunity cost.',
   'Economic cost before opportunity':'Net cash spent through the term minus retained asset value and VAT refunds still due. This reconciliation excludes opportunity cost.'
  };
  const timing={upfront:'Return forgone on the initial purchase, loan deposit or lease fee.',payments:'Return forgone on regular loan repayments or lease invoices.',insurance:'Return forgone on separately paid insurance.',maintenance:'Return forgone between each service payment and the end date.',tyres:'Return forgone on tyre purchase and seasonal services.',additional:'Return forgone between each additional-cost payment and the end date. A payment at the option end contributes zero.',vatDuring:'Return available on refunded VAT received before the end. Usually a negative offset to opportunity cost.',vatAfter:'Cost of waiting for a VAT refund beyond the end date; the future receipt is discounted back.',taxSavings:'Return earned on estimated income-tax and contribution savings after their assumed annual receipt dates.',settlement:'Timing effect of the final finance payment, car settlement and disposal VAT. Payments exactly at the end contribute zero.',other:'Timing effect of other payments. End-dated extras contribute zero.'};
  const timingKeys=['upfront','payments','insurance','maintenance','tyres','additional','vatDuring','vatAfter','taxSavings','settlement','other'].filter(key=>active.some(v=>Math.abs(opportunityDetail[v.key].opportunityBreakdown[key])>1e-8));
  const columnHelp={
   'Compare row with →':'Each cell compares the row option with the column option. Less means the row costs less. With unequal terms the difference is per month.',
   'Monthly amount':'Separates recurring payments from average ownership cost. Upfront payments, final settlement and running costs are included only in the ownership average.',
   'Loan':'The loan whose nominal annual interest rate is varied to find a matching ownership cost.',
   'Match':'Benchmark option held at its existing quote, end choice and term. No replacement purchases or lease renewals are assumed.',
   'Current rate':'The entered nominal annual loan rate. This is not an all-in APR; insurance and other entered costs are counted separately.',
   'Matching rate':'Calculated nominal annual rate at which the loan and benchmark have equal cost on this table’s basis. Hover a result for the exact search outcome.',
   'Current cost difference':'How much more or less the loan costs than its benchmark at the entered rate. Uses monthly cost if the selected terms differ.',
   'Full-term cost':'Components of ownership cost over each column’s own term. Negative credits reduce the total. Components follow the today’s-money toggle. VAT is separate; the inflation-effect row is informational and already included.',
   'Foregone return by cash flow':'Timing effects of payments and receipts at the Setup investment return. These are not the underlying cash amounts.',
   'Cash-flow stage':'Amounts and receipt or payment dates for VAT. Kept assets use valuation adjustments rather than actual sale VAT payments.',
   'Car resale':'Shared gross end-of-term car selling price, or retained-value estimate when keeping the car. Tyres have their own value.',
   'Resale change':'Amount added to every option’s own end resale estimate. The original estimates and terms can differ.',
   'Lowest cost':'Cheapest selected option at the row’s resale estimates. Ranked by monthly cost when periods differ. A pairwise break-even does not necessarily identify the cheapest option.',
   'Payment / asset':'Cash requirements and end-of-term reconciliation. Start and end snapshots are already included in net cash spent; retained values and outstanding refunds are subtracted only once.'
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
     explainResult(heading,'Compare '+left.name+' with each column. '+(split?'Average monthly costs for different terms, ':'Full-term costs, ')+basis);
     cells.forEach((cell,i)=>{
      const right=active[i],comparison=calculate(viewInputs(s,'versus'),viewOptions('versus')),amount=v=>comparisonValue(comparison[v.key],split);
      explainResult(cell,left.name+': '+money(amount(left))+'; '+right.name+': '+money(amount(right))+'. '+(split?'Per month, ':'Over each full term, ')+basis+' Less or more refers to the row option relative to the column.');
     });continue;
    }
    if(id==='interestRows'){
     const item=matches[index],loan=variants.find(v=>v.key===item.loan),target=variants.find(v=>v.key===item.target);
     const messages={'below-zero':'Even a 0% loan costs more than this benchmark, so no non-negative rate matches.','above-range':'The loan is cheaper throughout the tested 0–100% range; no match was found in that range.','unaffected':'Changing interest has no effect on the cost difference, and the costs do not match.','equal':'Costs match at every tested rate because interest has no effect on the difference.','match':'At this rate the loan matches the benchmark. Lower rates cost less; higher rates cost more.'};
     const matchHelp=messages[item.status]+' Benchmark cost: '+money(item.targetCost)+(split?' per month':' over its term')+', '+basis+' Only this loan’s rate changes; this is a calculated threshold, not a lender quote or APR.';
     explainResult(heading,loan.name+' over '+c[item.loan].months+' months, compared with '+target.name+' over '+c[item.target].months+' months.');
     [target.name+' is held at its current quote and assumptions.','Current nominal annual loan rate from Setup; fees and insurance are separate.',matchHelp,'How much more or less the loan costs at its current rate than this benchmark. '+(split?'Per month, ':'Over the full term, ')+basis].forEach((text,i)=>explainResult(cells[i],text));continue;
    }
    if(id==='sensitivity'){
     const scenario=withResale(s,resales[index]);
     const prices=active.filter(v=>v.kind!=='lease'||s.leaseEnd!=='return').map(v=>v.name+': '+money(s.matchPeriods?scenario.resale:scenario[v.resale])).join('; ');
     const help=(s.matchPeriods?'Gross selling price, or retained car value if kept.':'The same amount is added to each option’s own end resale estimate.')+' End car values: '+prices+'. Tyres are separate.';
     explainResult(heading,help+' A break-even row marks equal costs for the named pair; that pair need not be the cheapest overall.');
     cells.forEach((cell,i)=>explainResult(cell,i<active.length?active[i].name+' cost '+(split?'per month':'over '+c[active[i].key].months+' months')+', '+basis+' '+help:'Lowest among selected options at these resale estimates. '+(split?'Ranked per month, ':'Ranked over the full term, ')+basis));continue;
    }
    const help=id==='opportunityRows'&&index<timingKeys.length?timing[timingKeys[index]]+' This is only the timing effect, not the underlying payment.':descriptions[label];
    if(!help)continue;
    explainResult(heading,help);
    for(const cell of cells){
     const v=variants.find(v=>v.kind===cell.dataset.option);if(!v)continue;
     let extra=v.name+' · '+c[v.key].months+' months. '+(id==='costRows'||id==='opportunityRows'||id==='vatTimeline'||label==='Effective monthly ownership cost'?basis:'');
     if(label==='Car resale / retained value credit'){
      if(v.kind==='lease'&&s.leaseEnd==='return'){explainResult(cell,'The car is returned to the lessor, so there is no car resale receipt or retained value.');continue;}
      const result=c[v.key],kept=v.kind==='lease'?s.leaseEnd==='buyKeep':s.loanEnd==='keep';
      // Explain the gross resale component without applying its discount a second time to the total.
      const today=cashFlowValue({amount:result.resale,month:result.months},result.months,0,s.inflationRate,{opportunity:false,todayMoney:true});
      extra=v.name+'. '+(s.pastOwnership?'End-of-ownership ':'Estimated ')+(kept?'retained car value':'sale proceeds')+(s.pastOwnership?' after ':' in ')+result.months+' months: '+money(result.resale)+'. At '+ratePercent(s.inflationRate)+' annual inflation, that is worth '+money(today)+' in today’s money';
      extra+=s.inflationRate>0&&result.resale>0?', or '+money(result.resale-today)+' less purchasing power.':'. There is no purchasing-power reduction at these assumptions.';
      extra+=' These are gross amounts before VAT, sale tax or remaining loan settlement. ';
      extra+=inflationViews.cost?'The row already shows today’s value. The inflation-effect row only summarises changes already included; do not add it again.':'This is an illustration only while today’s money is off; the total uses the nominal resale estimate.';
      explainResult(cell,extra);continue;
     }
     if(label==='Inflation benefit on deferred principal'){
      if(!v.loanMonths)extra+=' No loan principal is deferred in this option; any future lease buyout is valued in its own row.';
      else if(inflationViews.cost){
       const valued=calculate(viewInputs(s,'cost'),viewOptions('cost'))[v.key].costComponents.purchase;
       extra+=' Invoice price '+money(s.price)+' plus this credit equals '+money(valued)+' for principal in today’s money. The deposit is paid now and has no inflation reduction.';
      }else extra+=' Today’s money is off, so no principal inflation credit is included.';
     }
     if(label==='Maintenance')extra+=' '+(v.kind==='lease'&&s.kintoMaintenance?'Included in lease invoices.':'Nominal budget: '+c[v.key].serviceCount+' services × '+money(s.serviceCost)+'.');
     if(label==='Monthly bill less eventual VAT refund'&&v.kind==='lease')extra+=' Pay '+money(c.kRent+c.kInsurance)+' per invoice month; the '+money(c.leaseVatPerPayment)+' refund follows '+s.leaseVatDelay+' months later.';
     explainResult(cell,help+'\n\n'+extra);
    }
   }
   const table=body.closest('table');
   for(const th of table?.querySelectorAll('thead th')||[]){
    const v=variants.find(v=>v.kind===th.dataset.option);
    explainResult(th,v?v.name+' · '+c[v.key].months+' months / '+num(c[v.key].km)+' km. '+basis:(columnHelp[th.textContent.trim()]||'Costs for the selected option on this table’s basis.')+' '+basis);
   }
  }
 }

 function annotateInflationValues(s,resales,opportunityDetail){
  const active=variants.filter(v=>s[v.enabled]),split=hasDifferentPeriods(s);
  const explanation=(nominal,unit="")=>"Estimated today’s money using "+ratePercent(s.inflationRate)+" annual inflation. Nominal equivalent: "+money(nominal)+unit+". Future inflation is an assumption, not a guaranteed outcome.";
  const mark=(element,enabled,text="")=>{
   if(!element)return;
   element.dataset.inflationEstimate=String(enabled);
   if(!enabled){element.classList.remove("explained");element.removeAttribute?.("tabindex");}
   if(enabled)explainResult(element,(element.dataset.explanation?element.dataset.explanation+"\n\n":"")+text);
  };
  const nominal=calculate(viewInputs(s,'summary'));
  for(const [prefix,key] of [['easy','balloonLoan'],['normal','standardLoan'],['kinto','lease'],['cash','cashPurchase']]){
   const value=nominal[key];
   for(const [suffix,amount,unit] of [['Total',value.adjusted,' total'],['Annual',value.adjusted*12/value.months,' / year'],[prefix==='kinto'?'Effective':'Monthly',value.adjusted/value.months,' / month']]){
    const element=$(prefix+suffix);delete element.dataset.explanation;
    mark(element,inflationViews.summary,explanation(amount,unit));
   }
   const gross=value.events.filter(e=>e.category!=='vat').reduce((sum,e)=>sum+cashFlowValue(e,value.months,nominal.nominalReturn,s.inflationRate,{opportunity:opportunityViews.summary}),0);
   const element=$(prefix+'Gross');delete element.dataset.explanation;
   mark(element,inflationViews.summary,explanation(gross,' total'));
  }
  const winner=ranked(nominal,split)[0];
  // The nominal winner can differ, so explain the displayed option using its own nominal cost.
  const shown=variants.find(v=>v.kind===$('verdict').dataset.winner);
  delete $('saving').dataset.explanation;
  mark($('saving'),inflationViews.summary,explanation(shown?comparisonValue(nominal[shown.key],split):winner.value,split?' / month':' total'));
  const detailNominal=calculate(s),vatNominal=vatTableValues(s,detailNominal,false);
  const opportunityKeys=['upfront','payments','insurance','maintenance','tyres','additional','vatDuring','vatAfter','taxSavings','settlement','other'].filter(key=>active.some(v=>Math.abs(opportunityDetail[v.key].opportunityBreakdown[key])>1e-8));
  for(const [view,id] of [['opportunityBreakdown','opportunityRows'],['vat','vatTimeline']]){
   if(!inflationViews[view])continue;
   [...$(id).querySelectorAll('tr')].forEach((row,index)=>{
    const label=row.querySelector('th')?.textContent||'';
    for(const cell of row.querySelectorAll('td')){
     const variant=variants.find(v=>v.kind===cell.dataset.option);if(!variant||!cell.textContent.includes('Kč'))continue;
     let value;
     if(view==='opportunityBreakdown')value=label==='Total opportunity cost'?detailNominal[variant.key].opportunity:detailNominal[variant.key].opportunityBreakdown[opportunityKeys[index]];
     else{
      const key={'Purchase VAT refund':'purchase','Initial lease payment VAT':'initial','VAT on regular lease invoices':'regular','Maintenance / tyre VAT refunds':'maintenance','Maintenance / tyre / additional-cost VAT refunds':'maintenance','Gross car sale proceeds':'grossSale','VAT paid on car sale':'saleVat','Car sale proceeds after VAT':'netSale','Estimated VAT within retained car value':'saleVat','VAT within tyre resale / retained value':'tyreVat','Lease buyout VAT refund':'buyout','Total VAT still to be received':'outstanding'}[label];
      if(key)value=vatNominal[variant.key][key];
     }
     if(Number.isFinite(value))mark(cell,true,explanation(value));
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
     if(view==='monthly'&&label==='Effective monthly ownership cost')value=raw[v.key].adjusted/raw[v.key].months;
     if(view==='cost'){
      const variant=variants.find(v=>v.kind===cell.dataset.option);if(!variant)return;
      const field={'Cost before opportunity':'nominal','Opportunity cost':'opportunity','Opportunity cost (excluded)':'opportunity','Total economic cost':'adjusted'}[label];
      if(field)value=raw[variant.key][field];
      const componentKey={"Vehicle purchase / buyout":"purchase","Car resale / retained value credit":"resale","Financing interest":"interest","Lease invoices + initial payment":"lease","Insurance paid separately":"insurance","Maintenance":"maintenance","Tyres & service, less resale":"tyres","Estimated additional costs":"additional","Actual additional costs":"additional","Other costs":"other","Net VAT adjustment":"vat","Estimated tax savings during ownership":"taxSavings","Estimated tax and contributions on sale":"saleTax"}[label];
      if(componentKey&&cell.textContent.includes('Kč'))value=label==='Vehicle purchase / buyout'&&variant.kind!=='lease'?s.price:raw[variant.key].costComponents[componentKey];
      if(label==='Inflation benefit on deferred principal')value=0;
      if(label==='Cost before income-tax effects')value=raw[variant.key].nominal+raw[variant.key].taxSavings-raw[variant.key].saleTax;
     }
     if(view==='resale'&&v)value=comparisonValue(scenario[v.key],split);
     if(view==='versus'&&v&&i!==index)value=Math.abs(comparisonValue(raw[active[index].key],split)-comparisonValue(raw[v.key],split));
     if(view==='interest'&&i===3){
      const item=interestComparisons(viewInputs(s,'interest'),viewOptions('interest'))[index];
      value=Math.abs(comparisonValue(raw[item.loan],split)-comparisonValue(raw[item.target],split));
     }
     if(Number.isFinite(value))mark(cell,true,explanation(value,split&&view!=='cost'?' / month':''));
    });
   });
  }
 }

 function explainResult(element,text){
  if(!element)return;
  element.dataset.explanation=text;element.classList.add('explained');element.tabIndex=0;
 }

 function hideResultExplanation(){
  $('resultTooltip').hidden=true;
  activeResultExplanation?.removeAttribute('aria-describedby');activeResultExplanation=null;
 }

 function showResultExplanation(target,x,y){
  onShowTooltip();hideResultExplanation();
  const tooltip=$('resultTooltip');tooltip.textContent=timeWording(target.dataset.explanation);tooltip.hidden=false;
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
