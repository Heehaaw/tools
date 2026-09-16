
import {defaults,variants,migrateInputs,effectiveInputs,calculate,resaleComparisons,interestComparisons,comparisonValue,hasDifferentPeriods,withResale,validate} from "./model.mjs";
const $=id=>document.getElementById(id);
const chartData=new Map();
let activeGraph=null;
let activeResultExplanation=null;
const OPPORTUNITY_VIEW_KEY="car-financing-calculator.opportunity-views.v1";
const opportunityViews=Object.fromEntries(['summary','versus','monthly','interest','cost','resale','monthlyGraph','interestGraph','resaleGraph'].map(key=>[key,true]));
// View preferences never replace the scenario's return assumption or exported inputs.
function viewInputs(s,key){return opportunityViews[key]?s:{...s,opportunityRate:0};}
function opportunityBasis(key){return opportunityViews[key]?'including opportunity cost':'excluding opportunity cost';}
function initializeOpportunityViews(){
 let stored={};
 try{const value=JSON.parse(localStorage.getItem(OPPORTUNITY_VIEW_KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
 for(const key of Object.keys(opportunityViews)){
  opportunityViews[key]=typeof stored[key]==='boolean'?stored[key]:true;
  const control=$('opportunity-'+key);control.checked=opportunityViews[key];
  control.addEventListener('change',()=>{
   opportunityViews[key]=control.checked;
   try{localStorage.setItem(OPPORTUNITY_VIEW_KEY,JSON.stringify(opportunityViews));}
   catch{$('storageStatus').textContent='Comparison choices apply for this session. Browser storage is unavailable.';}
   update();
  });
 }
}
function resaleSamples(s,pairs){
 const active=variants.filter(v=>s[v.enabled]);
 const minimum=s.matchPeriods?0:Math.max(0,s.resale-Math.min(...active.map(v=>s[v.resale])));
 return [...new Set([...[-100000,-50000,0,50000,100000].map(offset=>Math.max(minimum,s.resale+offset)),...pairs.filter(p=>p.resale!==null).map(p=>p.resale)])].sort((a,b)=>a-b);
}
const absValue=n=>Math.abs(n)<.5?0:n;
const money=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(absValue(n)).replaceAll("\u00a0","\u202f")+" Kč";
const num=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(n).replaceAll("\u00a0","\u202f");
// Grouping is display-only; calculations and JSON always receive numeric values.
function ungroupNumber(value){return String(value??"").replace(/[ \u00a0\u202f\u2009]/g,"").replace(",",".");}
function parseNumber(value){
 const raw=ungroupNumber(value);
 return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)?Number(raw):NaN;
}
function formatNumberInput(value){
 const raw=ungroupNumber(value);
 if(!Number.isFinite(parseNumber(raw)))return String(value??"");
 const parts=raw.match(/^([+-]?)(\d+)(\.\d*)?$/);
 return parts?parts[1]+parts[2].replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f")+(parts[3]||""):raw;
}
function read(){
 const state=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,typeof v==="boolean"?$(k).checked:typeof v==="number"?($(k).value.trim()===""?NaN:parseNumber($(k).value)):$(k).value]));
 // Hidden, unused charges are zero for calculation, but stay blank in saved drafts.
 if(state.leaseEnd==="return"&&$("leaseBuyout").value.trim()==="")state.leaseBuyout=0;
 if(state.kintoInsuranceIncluded&&$("kintoInsurance").value.trim()==="")state.kintoInsurance=0;
 return state;
}
function write(s){$("prefillStatus").textContent="";for(const [k,v] of Object.entries(s)){if(typeof v==="boolean")$(k).checked=v;else $(k).value=v===null?"":typeof v==="number"?formatNumberInput(v):v;}}
let visibleKinds=new Set(variants.map(v=>v.kind));
function row(label,b,n,l,c,cls=""){
 const cells=[b,n,l,c].map((value,i)=>visibleKinds.has(variants[i].kind)?'<td data-option="'+variants[i].kind+'">'+value+'</td>':"").join("");
 return '<tr class="'+cls+'"><th scope="row">'+label+'</th>'+cells+'</tr>';
}
const detail=(amount,note)=>'<span class="cell-amount">'+money(amount)+'</span><small>'+note+'</small>';
const phase=label=>'<tr class="phase"><th colspan="'+(visibleKinds.size+1)+'" scope="rowgroup">'+label+'</th></tr>';
function ranked(c,split=false){return variants.filter(v=>c[v.key].enabled).map(v=>({name:v.name,value:comparisonValue(c[v.key],split),key:v.kind})).sort((a,b)=>a.value-b.value);}
function updateSelection(s){
 visibleKinds=new Set(variants.filter(v=>s[v.enabled]).map(v=>v.kind));
 for(const element of document.querySelectorAll("#comparison thead [data-option],#comparison .total[data-option],.option-legend [data-option]"))element.hidden=!visibleKinds.has(element.dataset.option);
 for(const element of document.querySelectorAll(".individual-term"))element.hidden=s.matchPeriods;
 for(const v of variants){
  const panel=document.querySelector('.option-panel[data-option="'+v.kind+'"]');
  if(panel)panel.dataset.excluded=String(!s[v.enabled]);
  for(const control of panel?.querySelectorAll("input,select")||[])if(control.id!==v.enabled)control.disabled=!s[v.enabled];
 }
 $("months").disabled=false;
}
function update(){
 hideGraphTooltip();hideResultExplanation();
 const s=effectiveInputs(read());updateSelection(s);$("kInsuranceField").hidden=s.kintoInsuranceIncluded;
 $("buyoutField").hidden=s.leaseEnd==="return";$("buyoutVatField").hidden=s.leaseEnd==="return";
 const missing=Object.entries(defaults).filter(([key,value])=>typeof value==="number"&&!Number.isFinite(s[key])&&$(key).value.trim()==="");
 if(!visibleKinds.size){
  $("error").textContent="Select at least one option in Setup to see results and graphs.";$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;
 }
 if(missing.length){
  $("error").textContent="Fill in the remaining "+missing.length+" numeric fields to compare costs. Enter 0 when a cost does not apply.";
  $("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;$("serviceNote").textContent="Complete the term and service inputs.";
  return null;
 }
 let c;try{c=calculate(s);}catch(e){$("error").textContent=e.message;$("error").hidden=false;$("resultContent").hidden=true;$("graphContent").hidden=true;return null;}
 $("error").hidden=true;$("resultContent").hidden=false;$("graphContent").hidden=false;
 for(const key of Object.keys(opportunityViews))$('opportunity-'+key+'-note').textContent=opportunityViews[key]?'Included at '+s.opportunityRate+'% p.a.':'Excluded from this '+(key==='summary'?'summary':key.endsWith('Graph')?'graph':'table');
 const summaryInputs=viewInputs(s,'summary'),summary=opportunityViews.summary?c:calculate(summaryInputs);
 const viewCost=(key)=>opportunityViews[key]?c:calculate(viewInputs(s,key));
 const monthly=viewCost('monthly'),cost=viewCost('cost'),versus=viewCost('versus');
 const b=c.balloonLoan,n=c.standardLoan,l=c.lease,cash=c.cashPurchase;
 $("scenarioName").textContent=s.carName||"Your car";
 const split=hasDifferentPeriods(s),unit=split?" / month effective":"",value=o=>comparisonValue(o,split);
 const active=variants.filter(v=>s[v.enabled]);
 const anyValue=values=>values.some((amount,index)=>s[variants[index].enabled]&&Math.abs(amount)>1e-8);
 $("termLabel").textContent=(split?"DIFFERENT PERIODS · MONTHLY COMPARISON":c[active[0].key].months+" MONTHS / "+num(c[active[0].key].km)+" KM")+" / "+(s.vatEnabled?"AFTER VAT RECOVERY":"NO VAT RECOVERY");
 const sorted=ranked(summary,split),gap=sorted.length>1?sorted[1].value-sorted[0].value:0,tie=sorted.length>1&&gap<.5;
 $("verdict").dataset.winner=tie?"tie":sorted[0].key;
 $("resultsOverview").dataset.winner=$("verdict").dataset.winner;
 $("winner").textContent=sorted.length===1?sorted[0].name:tie?"The lowest-cost options tie":sorted[0].name+" costs least";
 $("saving").textContent=money(sorted[0].value)+unit;
 $("savingNote").textContent=(sorted.length===1?"Only one option selected.":tie?"The selected options tie.":money(gap)+(split?" / month":"")+" less than "+sorted[1].name.toLowerCase()+".")+" "+(opportunityViews.summary?"Includes opportunity cost at "+s.opportunityRate+"% p.a.":"Excludes opportunity cost.");
 for(const [prefix,key,monthlyId] of [["easy","balloonLoan","easyMonthly"],["normal","standardLoan","normalMonthly"],["kinto","lease","kintoEffective"],["cash","cashPurchase","cashMonthly"]]){
  $(prefix+"Total").textContent=money(summary[key].adjusted);$(monthlyId).textContent=money(summary[key].adjusted/summary[key].months)+" / month effective";
 }
 // Compare the same cash flows before VAT settlement, without dividing VAT-free costs by the VAT rate.
 const beforeVat=s.vatEnabled?calculate({...summaryInputs,vatEnabled:false}):summary;
 for(const [prefix,key] of [["easy","balloonLoan"],["normal","standardLoan"],["kinto","lease"],["cash","cashPurchase"]]){
  $(prefix+"VatBasis").textContent=s.vatEnabled?"Total, net after VAT settlement · "+summary[key].months+" months":"Total including VAT · recovery off · "+summary[key].months+" months";
  $(prefix+"Annual").textContent=money(summary[key].adjusted*12/summary[key].months)+" / year effective";
  const gross=beforeVat[key].adjusted;
  $(prefix+"Gross").innerHTML='<span class="gross-total">'+money(gross)+' total</span><small>'+money(gross*12/summary[key].months)+' / year<br>'+money(gross/summary[key].months)+' / month</small>';
 }
 $("resultsVatNote").textContent="These totals are "+opportunityBasis("summary")+". Annual and monthly amounts spread the full cost over each option’s selected term. Different terms are ranked by effective monthly cost; these are separate ownership plans, with no assumed renewals. "+
  (s.vatEnabled?"Net after VAT includes eligible deductions and sale VAT; any non-recoverable VAT remains in the cost. The comparison below each total excludes VAT refunds and sale-tax payments.":"VAT recovery is off, so both views include VAT without refunds or sale-tax payments.");
 const matchRows=interestComparisons(viewInputs(s,'interest'));
 const names=Object.fromEntries(variants.map(v=>[v.key,v]));
 const label=key=>'<span class="option-label" data-option="'+names[key].kind+'">'+names[key].name+'</span>';
 const rateLabels={"below-zero":"No rate ≥ 0%","above-range":"No match in 0–100%","unaffected":"No match","equal":"Any rate"};
 const interestCost=calculate(viewInputs(s,'interest'));
 $("interestRows").innerHTML=matchRows.length?matchRows.map(item=>{
  const difference=value(interestCost[item.loan])-value(interestCost[item.target]);
  const differenceLabel=Math.abs(difference)<.5?'Same cost':money(Math.abs(difference))+(split?' / month':'')+' '+(difference<0?'less':'more');
  return '<tr><th scope="row">'+label(item.loan)+'</th><td>'+label(item.target)+'</td><td>'+item.currentRate.toFixed(2)+'%</td><td>'+(item.rate===null?rateLabels[item.status]:item.rate.toFixed(3)+'% p.a.')+'</td><td>'+differenceLabel+'</td></tr>';
 }).join(''):'<tr><td colspan="5">Select a loan and either outright purchase or lease to calculate a matching rate.</td></tr>';
 $("monthlyRows").innerHTML=[
 row("Period / mileage",...variants.map(v=>c[v.key].months+" months / "+num(c[v.key].km)+" km")),
 (s.balloonEnabled||s.normalEnabled||s.leaseEnabled)?row("Loan payment / lease invoice",money(c.payment),money(c.normalPayment),money(c.kRent),"No repayment"):"",
 row("Insurance paid separately",money(s.easyInsurance),money(s.normalInsurance),s.kintoInsuranceIncluded?"Included in invoice":money(c.kInsurance),money(s.cashInsurance)),
 row("Monthly bill incl. insurance",money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),money(c.kRent+c.kInsurance),money(s.cashInsurance),"emphasis"),
 s.leaseEnabled&&c.leaseVatPerPayment?row("VAT refund per lease invoice","—","—",money(c.leaseVatPerPayment),"—"):"",
 s.leaseEnabled&&c.leaseVatPerPayment?row("Monthly bill less eventual VAT refund",money(c.insuredPayment),money(c.normalPayment+s.normalInsurance),detail(c.kRent+c.kInsurance-c.leaseVatPerPayment,s.leaseVatDelay?"Refund "+s.leaseVatDelay+" months after invoice":"VAT deducted with each payment"),money(s.cashInsurance)):"",
 row("Effective monthly ownership cost",...variants.map(v=>money(monthly[v.key].adjusted/monthly[v.key].months)),"sum")
 ].join("");
 $("opportunityIntro").textContent="At "+s.opportunityRate+"% annual return, measured at each option’s end date. Each payment is weighted by how long that cash could have stayed invested.";
 const opportunityGroups=[
 ["upfront","Deposit / initial payment / outright purchase"],["payments","Regular loan / lease payments"],["insurance","Separately paid insurance"],
 ["maintenance","Maintenance payments"],["tyres","Tyre purchase and seasonal service"],
 ["vatDuring","VAT refunds during the term"],["vatAfter","VAT refunds after the term"],
 ["settlement","Final balloon, buyout, sale and sale tax"],["other","Other payments"]
 ];
 $("opportunityRows").innerHTML=opportunityGroups.filter(([key])=>anyValue(variants.map(v=>c[v.key].opportunityBreakdown[key]))).map(([key,label])=>row(label,money(b.opportunityBreakdown[key]),money(n.opportunityBreakdown[key]),money(l.opportunityBreakdown[key]),money(cash.opportunityBreakdown[key]))).join("")+
 row("Total opportunity cost",money(b.opportunity),money(n.opportunity),money(l.opportunity),money(cash.opportunity),"sum");
 $("opportunityExample").hidden=!s.balloonEnabled;
 $("opportunityExample").innerHTML='<span data-option="balloon">Balloon loan example</span>: the '+money(c.down)+' deposit is paid at month zero. At '+s.opportunityRate+'% over '+b.months+' months, its foregone return is '+money(b.opportunityBreakdown.upfront)+'.';
 $("serviceNote").textContent=s.matchPeriods?c.serviceCount+" services · "+money(c.maintenance):active.map(v=>v.name+": "+c[v.key].serviceCount+" services · "+money(c[v.key].maintenance)).join(" | ");
 const purchaseSold=s.loanEnd==="sell",leaseSold=s.leaseEnd==="buySell",leaseBought=s.leaseEnd!=="return";
 const anySale=(purchaseSold&&(s.balloonEnabled||s.normalEnabled||s.cashEnabled))||(s.leaseEnabled&&leaseSold);
 $("costRows").innerHTML=[
 row("Vehicle purchase / buyout",money(s.price),money(s.price),leaseBought?money(s.leaseBuyout):"No purchase",money(s.price)),
 row("Car resale / retained value credit",money(-b.resale),money(-n.resale),leaseBought?money(-l.resale):"Car returned",money(-cash.resale)),
 (s.balloonEnabled||s.normalEnabled)?row("Financing interest",money(c.interest),money(c.normalInterest),"In lease","No loan"):"",
 s.leaseEnabled?row("Lease invoices + initial payment","—","—",money(c.kRent*l.months+s.kintoInitial),"—"):"",
 row("Insurance paid separately",money(s.easyInsurance*b.months),money(s.normalInsurance*n.months),s.kintoInsuranceIncluded?"In lease":money(c.kInsurance*l.months),money(s.cashInsurance*cash.months)),
 row("Maintenance",detail(b.maintenance,b.serviceCount+" services"),detail(n.maintenance,n.serviceCount+" services"),s.kintoMaintenance?"In lease":detail(l.maintenance,l.serviceCount+" services"),detail(cash.maintenance,cash.serviceCount+" services")),
 row("Tyres & service, less resale",money(b.tyres),money(n.tyres),s.kintoTyres?"In lease":money(l.tyres),money(cash.tyres)),
 anyValue([s.easyExtra,s.normalExtra,s.kintoExtra,s.cashExtra])?row("Other costs",money(s.easyExtra),money(s.normalExtra),money(s.kintoExtra),money(s.cashExtra)):"",
 s.vatEnabled?row("Net VAT adjustment",money(b.vat),money(n.vat),money(l.vat),money(cash.vat)):"",
 row("Cost before opportunity",money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal)),
 row(opportunityViews.cost?"Opportunity cost":"Opportunity cost (excluded)",...variants.map(v=>money(cost[v.key].opportunity))),
 row("Total economic cost",...variants.map(v=>money(cost[v.key].adjusted)),"sum")].join("");

 const resaleInputs=viewInputs(s,'resale'),pairs=resaleComparisons(resaleInputs),optionKeys=active.map(v=>v.key);
 $("versusBasis").textContent=(split?"Effective monthly costs for different periods":"Full-term costs")+", with VAT treatment, "+opportunityBasis("versus")+".";
 $("resaleColumnLabel").textContent=s.matchPeriods?"Car resale":"Resale change";
 $("sensitivityBasis").textContent=(split?"Monthly costs":"Full-term costs")+" with VAT treatment, "+opportunityBasis("resale")+". "+(s.matchPeriods?"Resale column is the shared gross selling price.":"Resale column is a change from each option’s own end value.")+" Extra rows show exact break-even points.";
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
  const next=calculate(withResale(resaleInputs,resale)),r=ranked(next,split);
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
 const otherInvoiceRefund=(o,capital,leaseVat)=>Math.max(0,-o.events.filter(e=>e.category==="vat"&&e.amount<0).reduce((sum,e)=>sum+e.amount,0)-capital-leaseVat);
 const tyreSaleVat=s.vatEnabled?s.tyreResale*s.vatPct/(100+s.vatPct):0;
 const tyreVatValues=variants.map(v=>v.kind==='lease'&&s.kintoTyres?0:tyreSaleVat);
 $("vatPanel").hidden=!s.vatEnabled;
 $("vatTimeline").innerHTML=[
 (s.balloonEnabled||s.normalEnabled||s.cashEnabled||(s.leaseEnabled&&c.leaseInitialVat))?phase("01 · Purchase and lease start"):"",
 (s.balloonEnabled||s.normalEnabled||s.cashEnabled)?row("Purchase VAT refund",detail(c.purchaseRefund,refundNote(c.purchaseRefund)),detail(c.purchaseRefund,refundNote(c.purchaseRefund)),"Not a purchase",detail(c.purchaseRefund,refundNote(c.purchaseRefund))):"",
 s.leaseEnabled&&c.leaseInitialVat?row("Initial lease payment VAT","—","—",detail(c.leaseInitialVat,"Month "+s.leaseVatDelay),"—"):"",
 phase("02 · During the agreement"),
 s.leaseEnabled?row("VAT on regular lease invoices","No VAT on loan repayments","No VAT on loan repayments",detail(c.leaseVatPerPayment,"Per invoice · months "+s.leaseVatDelay+"–"+(l.months-1+s.leaseVatDelay)),"No regular purchase payments"):"",
 row("Maintenance / tyre VAT refunds",detail(otherInvoiceRefund(b,c.purchaseRefund,0),"Netted against the expense"),detail(otherInvoiceRefund(n,c.purchaseRefund,0),"Netted against the expense"),detail(otherInvoiceRefund(l,c.buyoutRefund,c.leaseInitialVat+c.leaseVatPerPayment*l.months),"Netted against the expense"),detail(otherInvoiceRefund(cash,c.purchaseRefund,0),"Netted against the expense")),
 phase("03 · At each option’s end date"),
 row("Gross car sale proceeds",purchaseSold?detail(b.resale,endNote(b)):"Car kept",purchaseSold?detail(n.resale,endNote(n)):"Car kept",leaseSold?detail(l.resale,endNote(l)):leaseBought?"Car kept":"Car returned",purchaseSold?detail(cash.resale,endNote(cash)):"Car kept"),
 anySale?row("VAT paid on car sale",saleCell(purchaseSold,b.carSaleVat,endNote(b)),saleCell(purchaseSold,n.carSaleVat,endNote(n)),saleCell(leaseSold,l.carSaleVat,endNote(l)),saleCell(purchaseSold,cash.carSaleVat,endNote(cash))):"",
 anySale?row("Car sale proceeds after VAT",saleCell(purchaseSold,b.resale-b.carSaleVat,"Before balloon settlement"),saleCell(purchaseSold,n.resale-n.carSaleVat,"Loan fully repaid"),saleCell(leaseSold,l.resale-l.carSaleVat,"Before deducting buyout"),saleCell(purchaseSold,cash.resale-cash.carSaleVat,"No loan to settle")):"",
 anyValue(variants.map(v=>c[v.key].retainedValue))?row("Estimated VAT within retained car value",...variants.map(v=>(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?detail(c[v.key].carSaleVat,"Valuation only; no tax paid now"):"No retained car")):"",
 anyValue(tyreVatValues)?row("VAT within tyre resale / retained value",...variants.map((v,index)=>v.kind==='lease'&&s.kintoTyres?"Lease-owned tyres":detail(tyreVatValues[index],(v.kind==='lease'?s.leaseEnd==='buyKeep':!purchaseSold)?"Valuation only; no tax paid now":"Paid within tyre sale proceeds"))):"",
 s.leaseEnabled&&leaseBought?row("Lease buyout VAT refund","No new VAT on balloon repayment","—",detail(c.buyoutRefund,c.buyoutRefund?"Month "+(l.months+s.purchaseVatDelay):"No eligible deduction"),"—"):"",
 anyValue(variants.map(v=>c[v.key].futureRefund))?phase("04 · Refunds outstanding at end of term"):"",
 anyValue(variants.map(v=>c[v.key].futureRefund))?row("Total VAT still to be received",detail(b.futureRefund,"Already included in total cost"),detail(n.futureRefund,"Already included in total cost"),detail(l.futureRefund,"Already included in total cost"),detail(cash.futureRefund,"Already included in total cost")):""
 ].join("");
 $("cashflow").innerHTML=[
 row("Deposit / initial payment / outright purchase",money(c.down),money(c.normalDown),money(s.kintoInitial),money(s.price)),
 anyValue([c.balloon,0,leaseBought?s.leaseBuyout:0,0])?row("Final balloon / lease buyout",money(c.balloon),"Loan repaid",leaseBought?money(s.leaseBuyout):"No buyout","No loan"):"",
 row("Net cash paid at start",...variants.map(v=>money(c[v.key].events.filter(e=>e.type==='cash'&&e.month===0).reduce((sum,e)=>sum+e.amount,0)))),
 row("Net cash paid at end date",...variants.map(v=>money(c[v.key].events.filter(e=>e.type==='cash'&&Math.abs(e.month-c[v.key].months)<1e-8).reduce((sum,e)=>sum+e.amount,0)))),
 row("Net cash spent through each term",money(b.cashToEnd),money(n.cashToEnd),money(l.cashToEnd),money(cash.cashToEnd)),
 anyValue(variants.map(v=>c[v.key].retainedValue))?row("Less retained car and tyre value",money(-b.retainedValue),money(-n.retainedValue),money(-l.retainedValue),money(-cash.retainedValue)):"",
 anyValue(variants.map(v=>c[v.key].futureRefund))?row("Less VAT refunds due after each term",money(-b.futureRefund),money(-n.futureRefund),money(-l.futureRefund),money(-cash.futureRefund)):"",
 row("Economic cost before opportunity",money(b.nominal),money(n.nominal),money(l.nominal),money(cash.nominal),"sum")
 ].join("");
 decorateResultTables(s,c,matchRows,resalePoints);
 renderGraphs(s,c,active,split);
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
const SELECTED_SCENARIO_KEY="car-financing-calculator.selected-scenario.v1";
// Empty IDs are invalid in saved collections, so the built-in choice cannot collide with user IDs.
const EXAMPLE_ID="",EXAMPLE_LABEL=defaults.carName+" (example)";
const exampleInputs=Object.freeze({...defaults});
function selectedInputs(){return activeScenarioId===EXAMPLE_ID?exampleInputs:scenarios.find(item=>item.id===activeScenarioId).inputs;}
function exampleCopyName(name){
 const base=name===EXAMPLE_LABEL?exampleInputs.carName:name;
 return scenarios.some(item=>item.inputs.carName===base)?uniqueScenarioName(base||"Scenario","variation"):base;
}
function rememberCurrentSettings(state){
 validateSettings(state);
 if(activeScenarioId===EXAMPLE_ID){
  if(Object.keys(defaults).every(key=>state[key]===exampleInputs[key]))return;
  const inputs={...state,carName:exampleCopyName(state.carName)};
  const copy={id:newScenarioId(),inputs};scenarios.push(copy);activeScenarioId=copy.id;
  // Change only the name when forking; preserve the user's caret and partially entered numbers.
  if($("carName").value!==inputs.carName)$("carName").value=inputs.carName;
  $("scenarioName").textContent=inputs.carName||"Your car";
 }else scenarios.find(item=>item.id===activeScenarioId).inputs={...state};
}
let scenarios=[],activeScenarioId="",storageReadFailed=false;
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
 const state=migrateInputs(inputs);validateSettings(state);return state;
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
 // Keep version 2 readable by older releases: exports contain ordinary editable snapshots only.
 const items=scenarios.length?scenarios:[{id:"example-snapshot",inputs:{...exampleInputs}}];
 const activeId=items.some(item=>item.id===activeScenarioId)?activeScenarioId:items[0].id;
 return JSON.stringify({format:"car-financing-calculator",version:2,activeId,scenarios:items},null,2);
}
function renderScenarioSelector(){
 const select=$("scenarioSelect");select.replaceChildren();
 const example=document.createElement("option");example.value=EXAMPLE_ID;example.textContent=EXAMPLE_LABEL;example.className="example-option";select.appendChild(example);
 for(const scenario of scenarios){
  const option=document.createElement("option");option.value=scenario.id;option.textContent=scenario.inputs.carName.trim()||"Untitled scenario";
  select.appendChild(option);
 }
 select.value=activeScenarioId;select.dataset.example=String(activeScenarioId===EXAMPLE_ID);
 $("scenarioCount").textContent="1 built-in example · "+scenarios.length+" saved scenario"+(scenarios.length===1?"":"s");
}
function persistCollection(){
 if(storageReadFailed){$("storageStatus").textContent="Original browser data preserved after a loading error. Export JSON to save this session.";return false;}
 try{
  // The permanent example is never stored as a mutable scenario. Its selection is a UI preference.
  if(scenarios.length)localStorage.setItem(STORAGE_KEY,encodeCollection());
  localStorage.setItem(SELECTED_SCENARIO_KEY,activeScenarioId);
  $("storageStatus").textContent="";return true;
 }
 catch{$("storageStatus").textContent="Local saving is unavailable. These scenarios last for this session; use Export all JSON to keep them.";return false;}
}
function saveSettings(state){
 rememberCurrentSettings(state);renderScenarioSelector();return persistCollection();
}
function restoreSettings(){
 let message="";
 storageReadFailed=false;
 try{
  const stored=localStorage.getItem(STORAGE_KEY);
  if(stored){const restored=decodeCollection(stored);scenarios=restored.scenarios;activeScenarioId=restored.activeId;}
  else{
   const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
   scenarios=legacy?[{id:newScenarioId(),inputs:decodeSettings(legacy)}]:[];
   activeScenarioId=legacy?scenarios[0].id:EXAMPLE_ID;
   if(legacy)message="Your previously saved settings are now the first scenario.";
  }
  const selected=localStorage.getItem(SELECTED_SCENARIO_KEY);
  if(selected===EXAMPLE_ID){activeScenarioId=EXAMPLE_ID;}
  else if(scenarios.some(item=>item.id===selected))activeScenarioId=selected;
 }catch{storageReadFailed=true;scenarios=[];activeScenarioId=EXAMPLE_ID;message="Saved scenarios could not be loaded. Original data preserved; starting example shown for this session.";}
 renderScenarioSelector();write(selectedInputs());update();
 // Keep the old single-scenario record untouched while migrating to the collection.
 if(persistCollection()||storageReadFailed)$("storageStatus").textContent=message;
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
initializeOpportunityViews();
restoreSettings();
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
 if(source==="months"&&Number.isInteger(parseNumber($("months").value))&&parseNumber($("months").value)>0&&parseNumber($("months").value)<=120){
  suggestions.push(["tyreVisits",Math.ceil(parseNumber($("months").value)/6)]);
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
 $("prefillStatus").textContent="";
 if($("matchPeriods").checked){
  for(const v of variants){$(v.months).value=$("months").value;$(v.resale).value=$("resale").value;}
 }
 // Wait for a committed change so typing "5.99" does not copy its first digit.
 if(event?.type==="change")prefillRelated(event.target.id);
 const complete=update();
 try{
  if(saveSettings(currentValidSettings())&&!complete)$("storageStatus").textContent="Incomplete scenario saved. Continue filling fields, or switch scenarios and return later.";
 }catch{$("storageStatus").textContent="Fix the invalid value to save these changes.";}
}
// Editing uses ungrouped text so typing and caret movement stay predictable.
$("inputs").addEventListener("focusin",event=>{
 if(typeof defaults[event.target.id]==="number")event.target.value=ungroupNumber(event.target.value);
});
$("inputs").addEventListener("focusout",event=>{
 if(typeof defaults[event.target.id]==="number")event.target.value=formatNumberInput(event.target.value);
});
$("inputs").addEventListener("input",handleInput);
$("inputs").addEventListener("change",handleInput);
$("inputs").addEventListener("submit",e=>e.preventDefault());
$("scenarioSelect").addEventListener("change",()=>{
 const target=$("scenarioSelect").value;
 try{
  const current=currentValidSettings();
  const next=target===EXAMPLE_ID?exampleInputs:scenarios.find(item=>item.id===target)?.inputs;if(!next)throw new Error("Select an existing scenario.");
  rememberCurrentSettings(current);
  activeScenarioId=target;write(next);update();renderScenarioSelector();persistCollection();
 }catch(e){$("scenarioSelect").value=activeScenarioId;$("storageStatus").textContent="Cannot switch yet: "+e.message;}
});
$("duplicateScenario").addEventListener("click",()=>{
 try{
  const state=currentValidSettings();
  const fromExample=activeScenarioId===EXAMPLE_ID;
  if(!fromExample)rememberCurrentSettings(state);
  const name=fromExample?exampleCopyName(state.carName):uniqueScenarioName(state.carName.trim()||"Scenario","copy");
  const copy={id:newScenarioId(),inputs:{...state,carName:name}};
  scenarios.push(copy);activeScenarioId=copy.id;write(copy.inputs);update();renderScenarioSelector();
  if(persistCollection())$("storageStatus").textContent="Variation created. Edit its name and inputs; the original stays unchanged.";
  $("carName").focus();$("carName").select();
 }catch(e){$("storageStatus").textContent="Cannot duplicate yet: "+e.message;}
});
$("clearAll").addEventListener("click",()=>{
 const active=selectedInputs();
 const state=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof value==="number"?null:typeof value==="boolean"?false:value]));
 for(const key of ["balloonEnabled","normalEnabled","leaseEnabled","cashEnabled","matchPeriods"])state[key]=true;
 state.carName=$("carName").value||active.carName;
 write(state);update();const persisted=saveSettings(state);
 $("prefillStatus").textContent="Numeric fields cleared. Select your VAT and coverage choices, then fill the form from the top. Related empty fields are suggested when you finish editing.";
 if(persisted)$("storageStatus").textContent="Cleared current scenario saved. Other scenarios are kept. Reset current restores the example values.";
});
$("reset").addEventListener("click",()=>{
 const name=selectedInputs().carName;
 const state={...defaults,carName:name};write(state);update();
 if(saveSettings(state))$("storageStatus").textContent=activeScenarioId===EXAMPLE_ID?"The starting example already has its original values.":"Selected scenario reset to default assumptions. Other scenarios were kept.";
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
  const state=currentValidSettings();rememberCurrentSettings(state);renderScenarioSelector();
  downloadSettings(encodeCollection(),"car-financing-all-scenarios.json");$("storageStatus").textContent=scenarios.length?"Saved scenarios exported. The built-in example is always available in the calculator.":"Starting example exported as an editable snapshot.";
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
  rememberCurrentSettings(current);
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
 execute(input){if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Provide an object of calculator inputs.");for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new Error("Unknown input: "+key);const s={...read(),...input};validate(s);write(s);const c=update();saveSettings(s);return {balloonLoanTotal:c.balloonLoan.adjusted,standardLoanTotal:c.standardLoan.adjusted,operatingLeaseTotal:c.lease.adjusted,outrightPurchaseTotal:c.cashPurchase.adjusted,resaleBreakEven:resaleComparisons(s)};}
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
  const originalOptionKey=card.classList.contains("option-panel")?variants.find(v=>v.kind===card.dataset.option)?.fields[0]:null;
  const key=card.dataset.cardKey||card.id||originalOptionKey||card.querySelector("input[id]:not([data-opportunity-view]),select[id],tbody[id]")?.id||(card.dataset.option?"total-"+card.dataset.option:title.toLowerCase().replace(/[^a-z0-9]+/g,"-"));
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

function graphFrame(title,body,width=960,height=340){
 return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+title+'"><title>'+title+'</title>'+body+'</svg>';
}
function chartLegend(active){return '<div class="chart-legend">'+active.map(v=>'<span data-option="'+v.kind+'">'+v.name+'</span>').join("")+'</div>';}
function lineChart(title,series,xLabel,yLabel,formatX=null){
 const chartKey=title.toLowerCase().replace(/[^a-z0-9]+/g,"-");
 const all=series.flatMap(s=>s.points),left=100,top=30,width=810,height=245;
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
 const minY=Math.min(0,...all.map(p=>p.y)),maxY=Math.max(0,...all.map(p=>p.y));
 const x=v=>left+(v-minX)/(maxX-minX||1)*width,y=v=>top+height-(v-minY)/(maxY-minY||1)*height;
 let body='';
 for(let i=0;i<=4;i++){
  const value=minY+(maxY-minY)*i/4,py=y(value),vx=minX+(maxX-minX)*i/4;
  body+='<path class="chart-grid" d="M'+left+' '+py+'H'+(left+width)+'"/><text class="chart-axis" x="'+(left-12)+'" y="'+(py+4)+'" text-anchor="end">'+num(value/1000)+'k</text>';
  body+='<text class="chart-axis" x="'+x(vx)+'" y="300" text-anchor="middle">'+(formatX?formatX(vx):xLabel==='Month'?num(vx):num(vx/1000)+'k')+'</text>';
 }
 body+='<text class="chart-axis" x="'+left+'" y="18">'+yLabel+'</text><text class="chart-axis" x="910" y="326" text-anchor="end">'+xLabel+'</text>';
 for(const seriesItem of series){
  const path=seriesItem.points.map((p,i)=>(i?'L':'M')+x(p.x)+' '+y(p.y)).join(' ');
  body+='<g data-option="'+seriesItem.kind+'"><path d="'+path+'" fill="none" stroke="currentColor" stroke-width="1.75"/>';
  // Focusable points provide the same exact values as hover, without a chart library.
  for(const p of seriesItem.points)body+='<circle tabindex="0" data-point-x="'+p.x+'" cx="'+x(p.x)+'" cy="'+y(p.y)+'" r="'+(p.current?4.5:2)+'" fill="'+(p.current?'var(--bg)':'currentColor')+'" stroke="currentColor" stroke-width="1.25" aria-label="'+seriesItem.name+', '+p.label+', '+money(p.y)+'"><title>'+seriesItem.name+' · '+p.label+' · '+money(p.y)+'</title></circle>';
  body+='</g>';
 }
 body+='<path class="chart-cursor" hidden/>';
 chartData.set(chartKey,{type:'line',series,xLabel,yLabel,minX,maxX,left,top,width,height,step:xLabel==='Month'});
 return graphFrame(title,body).replace('<svg ','<svg tabindex="0" data-chart-key="'+chartKey+'" ');
}
function monthlyCostChart(s,c,active){
 const bills={balloonLoan:c.insuredPayment,standardLoan:c.normalPayment+s.normalInsurance,lease:c.kRent+c.kInsurance-c.leaseVatPerPayment,cashPurchase:s.cashInsurance};
 const monthlyAmounts=active.flatMap(v=>[bills[v.key],c[v.key].adjusted/c[v.key].months]);
 const monthlyMax=Math.max(...monthlyAmounts.map(Math.abs));
 const asPercent=(value,max)=>max?value/max*100:0;
 const percentages=monthlyAmounts.map(value=>asPercent(value,monthlyMax));
 const min=Math.min(0,...percentages),max=Math.max(100,...percentages),x=value=>210+(value-min)/(max-min)*550;
 const height=active.length*94+55;
 let body='';
 for(const percent of [...new Set([min,0,25,50,75,100])]){
  body+='<path class="chart-grid" d="M'+x(percent)+' 26V'+(height-12)+'"/><text class="chart-axis" x="'+x(percent)+'" y="17" text-anchor="middle">'+num(percent)+'%</text>';
 }
 active.forEach((v,index)=>{
  const top=38+index*94;
  body+='<g data-option="'+v.kind+'" data-bar-kind="'+v.kind+'"><text class="chart-label" x="0" y="'+(top+23)+'">'+v.name+'</text><text class="chart-subtitle" x="0" y="'+(top+45)+'">'+money(c[v.key].adjusted)+' total</text><text class="chart-subtitle" x="0" y="'+(top+64)+'">'+c[v.key].months+' months</text>';
  for(const [offset,label,amount,style] of [
   [0,'Regular bill',bills[v.key],'outline'],
   [34,'Full cost',c[v.key].adjusted/c[v.key].months,'solid']
  ]){
   const percent=asPercent(amount,monthlyMax),start=Math.min(x(0),x(percent)),width=Math.abs(x(percent)-x(0)),y=top+offset;
   const fill=style==='outline'?'none':'currentColor';
   const description=v.name+', '+label+', '+money(amount)+' per month';
   body+='<rect tabindex="0" x="'+start+'" y="'+y+'" width="'+Math.max(1,width)+'" height="25" rx="3" fill="'+fill+'" stroke="currentColor" stroke-width="2" aria-label="'+description+'"><title>'+description+' · '+num(percent)+'% of its scale</title></rect><text class="chart-label" x="780" y="'+(y+19)+'">'+money(amount)+'</text>';
  }
  body+='</g>';
 });
 const legend='<div class="chart-key"><span><i class="key-outline"></i> Regular bill / month</span><span><i class="key-solid"></i> Full cost / month</span></div>';
 chartData.set('monthly-costs',{type:'bars',active,bills,c,top:38,rowHeight:94});
 return legend+graphFrame('Monthly bills and effective monthly costs on a shared percentage scale',body,960,height).replace('<svg ','<svg tabindex="0" data-chart-key="monthly-costs" ');
}
function sensitivityWinners(samples,active,split,formatX){
 const endpoints=[samples[0],samples[samples.length-1]];
 return '<div class="chart-insights">'+endpoints.map(sample=>{
  const ranking=active.map(v=>({...v,cost:comparisonValue(sample.result[v.key],split)})).sort((a,b)=>a.cost-b.cost);
  const leaders=ranking.filter(v=>Math.abs(v.cost-ranking[0].cost)<.5);
  return '<p><strong>At '+formatX(sample.rate)+'</strong> '+leaders.map(v=>'<span data-option="'+v.kind+'">'+v.name+'</span>').join(' + ')+(leaders.length>1?' tie':' costs least')+' · '+money(ranking[0].cost)+(split?' / month':' total')+'</p>';
 }).join('')+'</div>';
}
function renderRateGraphs(s,active,split){
 const basis=split?'Kč / month effective':'Kč over full term';
 const percent=value=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value)+'%';
 const sampleRates=(max,extra)=>[...new Set([...Array.from({length:25},(_,i)=>max*i/24),...extra.filter(rate=>rate>=0&&rate<=max)])].sort((a,b)=>a-b);
 const returnMax=Math.min(100,Math.max(12,Math.ceil(s.opportunityRate*1.5)));
 const returns=sampleRates(returnMax,[s.opportunityRate]).map(rate=>({rate,result:calculate({...s,opportunityRate:rate})}));
 const returnSeries=active.map(v=>({...v,points:returns.map(sample=>({x:sample.rate,y:comparisonValue(sample.result[v.key],split),label:percent(sample.rate)+' annual return',current:sample.rate===s.opportunityRate}))}));
 $("returnGraph").innerHTML=chartLegend(active)+lineChart('Opportunity return sensitivity',returnSeries,'Alternative annual return after tax',basis,percent)+sensitivityWinners(returns,active,split,percent);
 const interestInputs=viewInputs(s,'interestGraph'),matches=interestComparisons(interestInputs);
 const loans=active.filter(v=>v.kind==='balloon'||v.kind==='normal');
 if(!loans.length){$("interestGraph").innerHTML='<p class="hint">Include a loan in Setup to explore interest rates.</p>';return;}
 const currentRates=loans.map(v=>v.kind==='balloon'?s.rate:s.normalRate);
 const interestMax=Math.min(100,Math.max(12,Math.ceil(Math.max(...currentRates)*1.5)));
 // Loans are independent: sampling both at x leaves lease and cash benchmarks unchanged.
 const rates=sampleRates(interestMax,[...currentRates,...matches.filter(m=>m.rate!==null).map(m=>m.rate)]).map(rate=>({rate,result:calculate({...interestInputs,rate,normalRate:rate})}));
 const loanSeries=active.map(v=>({...v,points:rates.map(sample=>({x:sample.rate,y:comparisonValue(sample.result[v.key],split),label:percent(sample.rate)+' loan interest',current:v.kind==='balloon'?sample.rate===s.rate:v.kind==='normal'&&sample.rate===s.normalRate}))}));
 $("interestGraph").innerHTML=chartLegend(active)+lineChart('Loan interest sensitivity',loanSeries,'Nominal annual loan interest',basis+' · '+opportunityBasis('interestGraph'),percent)+sensitivityWinners(rates,active,split,percent);
}
function renderGraphs(s,c,active,split){
 const basis=split?'Kč / month effective':'Kč over full term';
 $("graphNote").textContent=(split?'Different periods: sensitivity charts use effective monthly costs. ':'Same periods: sensitivity charts use full-term costs. ')+"Only selected options are shown. Hover or tap a chart for values; focus it and use arrow keys to explore, or Escape to close. Cash-flow lines use actual elapsed months.";
 const cashSeries=active.map(v=>{
  const events=c[v.key].events.filter(e=>e.type==='cash'),times=[...new Set([0,...events.map(e=>e.month)])].sort((a,b)=>a-b);
  let total=0;
  const points=times.map(month=>{total+=events.filter(e=>e.month===month).reduce((sum,e)=>sum+e.amount,0);return {x:month,y:total,label:'Month '+new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(month)};});
  return {...v,points};
 });
 $("cashGraph").innerHTML=chartLegend(active)+lineChart('Cumulative cash spent',cashSeries,'Month','Net cash spent · Kč');
 const resaleInputs=viewInputs(s,'resaleGraph'),resalePoints=resaleSamples(resaleInputs,resaleComparisons(resaleInputs));
 const samples=resalePoints.map(resale=>({resale,result:calculate(withResale(resaleInputs,resale))}));
 const resaleSeries=active.map(v=>({...v,points:samples.map(({resale,result})=>({x:s.matchPeriods?resale:resale-s.resale,y:comparisonValue(result[v.key],split),label:(s.matchPeriods?'Resale ':'Resale change ')+money(s.matchPeriods?resale:resale-s.resale)}))}));
 $("resaleGraph").innerHTML=chartLegend(active)+lineChart('Resale sensitivity',resaleSeries,s.matchPeriods?'Gross resale · Kč':'Change in each resale · Kč',basis+' · '+opportunityBasis('resaleGraph'));
 $("monthlyGraph").innerHTML=monthlyCostChart(s,opportunityViews.monthlyGraph?c:calculate(viewInputs(s,'monthlyGraph')),active);
 renderRateGraphs(s,active,split);
 initializeGraphTooltips();
}

const TAB_KEY="car-financing-calculator.tab.v1";
function selectTab(name,focus=false){
 hideResultExplanation();hideGraphTooltip();
 const panels={setup:"inputs",results:"comparison",graphs:"graphs"};
 if(!Object.hasOwn(panels,name))name="setup";
 for(const [key,panel] of Object.entries(panels)){
  const selected=name===key,tab=$("tab-"+key);
  tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;$(panel).hidden=!selected;
 }
 if(focus)$("tab-"+name).focus();
 try{localStorage.setItem(TAB_KEY,name);}catch{}
}
function initializeTabs(){
 const names=["setup","results","graphs"];
 for(const name of names){
  $("tab-"+name).addEventListener("click",()=>selectTab(name));
  $("tab-"+name).addEventListener("keydown",event=>{
   let index=names.indexOf(name);
   if(event.key==="ArrowRight")index=(index+1)%3;
   else if(event.key==="ArrowLeft")index=(index+2)%3;
   else if(event.key==="Home")index=0;
   else if(event.key==="End")index=2;
   else return;
   event.preventDefault();selectTab(names[index],true);
  });
 }
 let name="setup";try{name=localStorage.getItem(TAB_KEY)||name;}catch{}
 selectTab(name);
}
initializeTabs();

function chartPositions(data){
 return data.type==='bars'?data.active.map((_,index)=>index):[...new Set(data.series.flatMap(series=>series.points.map(point=>point.x)))].sort((a,b)=>a-b);
}
function graphTooltipValues(data,position){
 if(data.type==='bars'){
  const variant=data.active[position],result=data.c[variant.key];
  return {title:variant.name+' · '+result.months+' months',unit:'Monthly amounts and full-term total · '+opportunityBasis('monthlyGraph'),rows:[
   {name:'Regular bill / month',kind:variant.kind,value:data.bills[variant.key]},
   {name:'Full cost / month',kind:variant.kind,value:result.adjusted/result.months},
   {name:'Full-term total',kind:variant.kind,value:result.adjusted}
  ]};
 }
 const point=data.series.flatMap(series=>series.points).find(point=>Math.abs(point.x-position)<1e-8);
 const rows=data.series.map(series=>{
  const points=series.points,last=points[points.length-1];
  const exact=points.find(point=>Math.abs(point.x-position)<1e-8);
  let value,note='',approximate=false;
  if(exact)value=exact.y;
  else if(position>last.x){value=last.y;note='Final value · '+last.label.toLowerCase();}
  else if(position<points[0].x){value=0;note='Not started';}
  else{
   const after=points.findIndex(point=>point.x>position),left=points[after-1],right=points[after];
   // Cash moves only on its event dates. Other charts interpolate only if a series lacks this x.
   value=data.step?left.y:left.y+(right.y-left.y)*(position-left.x)/(right.x-left.x);
   approximate=!data.step;
  }
  return {name:series.name,kind:series.kind,value,note,approximate};
 });
 return {title:point?.label||String(position),unit:data.yLabel,rows};
}
function hideGraphTooltip(){
 $('graphTooltip').hidden=true;
 if(activeGraph){
  activeGraph.svg.querySelector('.chart-cursor')?.setAttribute('hidden','');
  activeGraph.anchor?.removeAttribute('aria-describedby');
  activeGraph=null;
 }
}
function showGraphTooltip(svg,data,position,clientX,clientY,anchor=svg){
 hideResultExplanation();
 const values=graphTooltipValues(data,position),tooltip=$('graphTooltip');
 if(activeGraph?.svg!==svg)hideGraphTooltip();
 activeGraph?.anchor?.removeAttribute('aria-describedby');
 tooltip.innerHTML='<strong>'+values.title+'</strong><small>'+values.unit+'</small><dl>'+values.rows.map(row=>'<div><dt data-option="'+row.kind+'">'+row.name+(row.note?'<small>'+row.note+'</small>':'')+'</dt><dd>'+(row.approximate?'≈ ':'')+money(row.value)+'</dd></div>').join('')+'</dl>';
 tooltip.hidden=false;anchor.setAttribute('aria-describedby','graphTooltip');
 activeGraph={svg,anchor};
 const guide=svg.querySelector('.chart-cursor');
 if(guide&&data.type==='line'){
  const x=data.left+(position-data.minX)/(data.maxX-data.minX||1)*data.width;
  guide.setAttribute('d','M'+x+' '+data.top+'V'+(data.top+data.height));guide.removeAttribute('hidden');
 }
 // Fixed positioning keeps the tooltip outside scrollable chart clipping, including on phones.
 const box=tooltip.getBoundingClientRect(),gap=14;
 const left=clientX+gap+box.width<=window.innerWidth?clientX+gap:clientX-gap-box.width;
 const top=clientY+gap+box.height<=window.innerHeight?clientY+gap:clientY-gap-box.height;
 tooltip.style.left=Math.max(8,Math.min(left,window.innerWidth-box.width-8))+'px';
 tooltip.style.top=Math.max(8,Math.min(top,window.innerHeight-box.height-8))+'px';
}
function initializeGraphTooltips(){
 for(const svg of document.querySelectorAll('#graphContent svg[data-chart-key]')){
  const data=chartData.get(svg.dataset.chartKey),positions=chartPositions(data);
  let selected=0;
  // Replace individual native title popups with one shared, accessible tooltip.
  for(const title of svg.querySelectorAll('title'))title.remove();
  function show(index,event,anchor=svg){
   selected=Math.max(0,Math.min(index,positions.length-1));
   let clientX=event?.clientX,clientY=event?.clientY;
   if(clientX===undefined){
    const point=svg.createSVGPoint();
    point.x=data.type==='line'?data.left+(positions[selected]-data.minX)/(data.maxX-data.minX||1)*data.width:500;
    point.y=data.type==='line'?data.top+data.height/2:data.top+selected*data.rowHeight+30;
    const screen=point.matrixTransform(svg.getScreenCTM());clientX=screen.x;clientY=screen.y;
   }
   showGraphTooltip(svg,data,positions[selected],clientX,clientY,anchor);
  }
  function pointer(event){
   const matrix=svg.getScreenCTM();if(!matrix)return;
   const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
   const local=point.matrixTransform(matrix.inverse());
   if(data.type==='bars'){
    if(local.y<data.top-10||local.y>data.top+data.active.length*data.rowHeight){hideGraphTooltip();return;}
    show(Math.floor((local.y-data.top)/data.rowHeight),event);
   }else{
    if(local.x<data.left-25||local.x>data.left+data.width+25||local.y<data.top-15||local.y>data.top+data.height+35){hideGraphTooltip();return;}
    const value=data.minX+(local.x-data.left)/data.width*(data.maxX-data.minX);
    const closest=positions.reduce((best,x,index)=>Math.abs(x-value)<Math.abs(positions[best]-value)?index:best,0);
    show(closest,event);
   }
  }
  svg.addEventListener('pointermove',pointer);
  svg.addEventListener('pointerdown',pointer);
  svg.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')hideGraphTooltip();});
  svg.addEventListener('focusin',event=>{
   const value=event.target.getAttribute('data-point-x');
   const kind=event.target.closest('[data-bar-kind]')?.dataset.barKind;
   const index=data.type==='bars'?data.active.findIndex(v=>v.kind===kind):value===null?selected:positions.indexOf(Number(value));
   show(index<0?selected:index,undefined,event.target);
  });
  svg.addEventListener('focusout',event=>{if(!svg.contains(event.relatedTarget))hideGraphTooltip();});
  svg.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();hideGraphTooltip();return;}
   let index=selected;
   if(event.key==='ArrowRight'||event.key==='ArrowDown')index++;
   else if(event.key==='ArrowLeft'||event.key==='ArrowUp')index--;
   else if(event.key==='Home')index=0;
   else if(event.key==='End')index=positions.length-1;
   else return;
   event.preventDefault();show(index,undefined,event.target);
  });
 }
}
window.addEventListener('resize',hideGraphTooltip);
window.addEventListener('scroll',hideGraphTooltip,true);
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.chart'))hideGraphTooltip();});

function decorateResultTables(s,c,matches,resales){
 const active=variants.filter(v=>s[v.enabled]),split=hasDifferentPeriods(s);
 const descriptions={
  'Period / mileage':'Each option has its own term. Mileage is annual kilometres × months ÷ 12. Different terms are compared by average monthly cost, without assuming renewals.',
  'Loan payment / lease invoice':'Regular finance payment only. Loan payments include principal and interest but exclude the deposit and final balloon. Lease invoices include VAT and whichever services you marked as included.',
  'Insurance paid separately':'Only separately entered insurance is added here. Coverage, including GAP, is whatever your quote actually provides; this calculator does not verify it. Insurance bundled into a lease is already in the lease invoice.',
  'Monthly bill incl. insurance':'The recurring amount paid before any separate VAT refund. Adds the loan payment or lease invoice and separately paid insurance. Maintenance, tyres, deposits and final payments are separate.',
  'VAT refund per lease invoice':'Eligible refund from one lease invoice, after the taxable-share and recovery-percentage settings. This is a tax refund, not a discount on the invoice or on a loan repayment.',
  'Monthly bill less eventual VAT refund':'Recurring bill minus the VAT refund associated with that invoice. This is a net cost, not necessarily cash paid in that month. During a refund delay you still fund the gross invoice.',
  'Effective monthly ownership cost':'Total ownership cost on this table’s opportunity-cost basis ÷ the option’s months. Includes upfront and final payments, running costs, resale or retained value, and VAT settlement. This is not a monthly invoice.',
  'Vehicle purchase / buyout':'Gross vehicle purchase price for the loans and outright purchase, or the agreed gross end-of-lease buyout. Loan principal is counted here once; deposits and repayments are not added again in this breakdown.',
  'Car resale / retained value credit':'Negative amount reduces cost by the gross car resale estimate. If the car is kept, this is an asset valuation rather than cash received. Disposal VAT is accounted for separately in Net VAT adjustment. Tyres have their own value credit.',
  'Financing interest':'All regular loan payments plus the final balloon, minus the original amount borrowed. The deposit is not borrowed. Lease financing is not separately known and stays inside lease invoices.',
  'Lease invoices + initial payment':'Gross monthly lease invoice × lease months, plus the initial lease payment. Includes services and insurance marked as bundled. A buyout is counted in Vehicle purchase / buyout.',
  'Maintenance':'Number of services due × gross service price. A service is due at the earlier distance or time interval, including one due exactly at the end. Eligible VAT is deducted in Net VAT adjustment.',
  'Tyres & service, less resale':'Gross tyre purchase plus seasonal swaps and storage, minus the tyre resale or retained-value estimate. Eligible VAT and disposal VAT appear in Net VAT adjustment. Lease-owned tyres have no separate value credit.',
  'Other costs':'Extra costs entered for each option, paid at that option’s end date. The model does not apply another VAT deduction to them.',
  'Net VAT adjustment':'All eligible VAT refunds reduce cost; VAT on disposal increases it. Includes refunds arriving after the term. For kept assets, estimated disposal VAT reduces retained value without creating a tax payment now.',
  'Cost before opportunity':'Sum of the cost components above after VAT treatment, before any foregone investment return. Includes retained asset value and outstanding VAT refunds, so it is not just cash paid to date.',
  'Opportunity cost':'Foregone after-tax return from the timing of payments and refunds, measured at each option’s end date. Added to cost before opportunity, using the return assumption in Setup.',
  'Opportunity cost (excluded)':'This table’s toggle excludes foregone return. Zero is added to the total here; the Setup return assumption and other views are unchanged.',
  'Total economic cost':'Cost before opportunity plus the opportunity cost selected for this table. Each column covers its own full term, so compare monthly averages if the terms differ.',
  'Total opportunity cost':'Sum of the timing effects shown above, using the Setup return assumption regardless of other tables’ toggles. Refunds before the end reduce foregone return; refunds after the end incur a delay cost.',
  'Purchase VAT refund':'Eligible VAT from the original vehicle purchase, subject to invoice eligibility, recovery percentage and capital cap. Arrives after the purchase refund delay, even when a loan funds the invoice. It does not reduce loan principal.',
  'Initial lease payment VAT':'Eligible VAT refund on the initial lease payment, using the lease taxable share and lease refund delay. It is separate from refunds on monthly lease invoices.',
  'VAT on regular lease invoices':'Refund for each monthly invoice, not the total for the lease. Lease invoices are modelled at months 0 through term minus one; the configured refund delay shifts receipt dates.',
  'Maintenance / tyre VAT refunds':'Eligible VAT on separately paid maintenance, tyre purchase, swaps and storage. Netted against those expenses immediately under the calculator’s next-month deduction convention.',
  'Gross car sale proceeds':'Car sale price including VAT at the option’s end date. A kept car creates no sale receipt; its estimated net value is an asset credit instead. Tyre proceeds are separate.',
  'VAT paid on car sale':'The VAT portion already inside the gross car sale proceeds, paid to the tax authority at the sale date. It is not additional income or an extra tax on top of the entered selling price.',
  'Car sale proceeds after VAT':'Gross car proceeds minus car sale VAT. Still before a final balloon or lease buyout; excludes tyre proceeds and delayed buyout VAT refunds.',
  'Estimated VAT within retained car value':'Valuation adjustment only. A kept car is credited at estimated resale value net of disposal VAT. This is not a sale and no tax cash payment occurs now.',
  'VAT within tyre resale / retained value':'VAT within the separately entered tyre value. It is paid when the tyres are sold, or deducted only from the retained-value estimate if they are kept. No separate credit applies to lease-owned tyres.',
  'Lease buyout VAT refund':'Eligible VAT from the end-of-lease purchase, using its own invoice eligibility and capital cap. Arrives after the purchase refund delay, which can be after the comparison end.',
  'Total VAT still to be received':'VAT refunds dated after this option’s end. Already credited in ownership cost, but not yet received in cash. Opportunity cost includes the effect of waiting for them.',
  'Deposit / initial payment / outright purchase':'The purchase deposit, initial lease fee, or full outright price. This is one component of the start payment; the net start-cash row also includes any first lease invoice, tyres, insurance and immediate refunds.',
  'Final balloon / lease buyout':'Final finance principal due at the end, before using sale proceeds. The balloon is in addition to the last regular loan payment. Buying and keeping the car still requires paying this amount.',
  'Net cash paid at start':'All actual cash events at month zero, including the initial payment, any first lease invoice, insurance, tyres, seasonal service and immediate VAT refunds. This snapshot is already part of net cash spent.',
  'Net cash paid at end date':'All actual cash events at the exact end date: final repayments or buyout, due insurance or maintenance, sales and sale tax, and refunds arriving then. Negative means cash received. Retained assets and later refunds are excluded. Already part of net cash spent.',
  'Net cash spent through each term':'Sum of cash paid minus receipts through the end date, including upfront payments, repayments and sale settlement. Start and end snapshots above must not be added again.',
  'Less retained car and tyre value':'Subtracts the estimated net value of assets you still own. This reduces economic cost but is not cash received. Both car and separately owned tyres are included after estimated disposal VAT.',
  'Less VAT refunds due after each term':'Subtracts refunds still due after the end. These are already included in economic cost but not yet in net cash spent. The timing effect is separate opportunity cost.',
  'Economic cost before opportunity':'Net cash spent through the term minus retained asset value and VAT refunds still due. This reconciliation excludes opportunity cost.'
 };
 const timing={upfront:'Return forgone on the initial purchase, loan deposit or lease fee.',payments:'Return forgone on regular loan repayments or lease invoices.',insurance:'Return forgone on separately paid insurance.',maintenance:'Return forgone between each service payment and the end date.',tyres:'Return forgone on tyre purchase and seasonal services.',vatDuring:'Return available on refunded VAT received before the end. Usually a negative offset to opportunity cost.',vatAfter:'Cost of waiting for a VAT refund beyond the end date; the future receipt is discounted back.',settlement:'Timing effect of the final finance payment, car settlement and disposal VAT. Payments exactly at the end contribute zero.',other:'Timing effect of other payments. End-dated extras contribute zero.'};
 const timingKeys=['upfront','payments','insurance','maintenance','tyres','vatDuring','vatAfter','settlement','other'].filter(key=>active.some(v=>Math.abs(c[v.key].opportunityBreakdown[key])>1e-8));
 const columnHelp={
  'Compare row with →':'Each cell compares the row option with the column option. Less means the row costs less. With unequal terms the difference is per month.',
  'Monthly amount':'Separates recurring payments from average ownership cost. Upfront payments, final settlement and running costs are included only in the ownership average.',
  'Loan':'The loan whose nominal annual interest rate is varied to find a matching ownership cost.',
  'Match':'Benchmark option held at its existing quote, end choice and term. No replacement purchases or lease renewals are assumed.',
  'Current rate':'The entered nominal annual loan rate. This is not an all-in APR; insurance and other entered costs are counted separately.',
  'Matching rate':'Calculated nominal annual rate at which the loan and benchmark have equal cost on this table’s basis. Hover a result for the exact search outcome.',
  'Current cost difference':'How much more or less the loan costs than its benchmark at the entered rate. Uses monthly cost if the selected terms differ.',
  'Full-term cost':'Components of ownership cost over each column’s own term. Negative credits reduce the total. Gross amounts are followed by a separate VAT adjustment.',
  'Foregone return by cash flow':'Timing effects of payments and receipts at the Setup investment return. These are not the underlying cash amounts.',
  'Cash-flow stage':'Amounts and receipt or payment dates for VAT. Kept assets use valuation adjustments rather than actual sale-tax payments.',
  'Car resale':'Shared gross end-of-term car selling price, or retained-value estimate when keeping the car. Tyres have their own value.',
  'Resale change':'Amount added to every option’s own end resale estimate. The original estimates and terms can differ.',
  'Lowest cost':'Cheapest selected option at the row’s resale estimates. Ranked by monthly cost when periods differ. A pairwise break-even does not necessarily identify the cheapest option.',
  'Payment / asset':'Cash requirements and end-of-term reconciliation. Start and end snapshots are already included in net cash spent; retained values and outstanding refunds are subtracted only once.'
 };
 const viewFor={monthlyRows:'monthly',costRows:'cost',versusRows:'versus',interestRows:'interest',sensitivity:'resale'};
 for(const id of ['monthlyRows','costRows','opportunityRows','vatTimeline','cashflow','versusRows','interestRows','sensitivity']){
  const body=$(id),rows=[...body.querySelectorAll('tr')];
  const basis=viewFor[id]?opportunityBasis(viewFor[id])+'.':'';
  for(const [index,tr] of rows.entries()){
   const heading=tr.querySelector('th[scope="row"]');if(!heading)continue;
   const label=heading.textContent.trim(),cells=[...tr.querySelectorAll('td')];
   if(id==='versusRows'){
    const left=active[index];
    explainResult(heading,'Compare '+left.name+' with each column. '+(split?'Average monthly costs for different terms, ':'Full-term costs, ')+basis);
    cells.forEach((cell,i)=>{
     const right=active[i],amount=v=>comparisonValue(c[v.key],split)-(opportunityViews.versus?0:c[v.key].opportunity/(split?c[v.key].months:1));
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
    let extra=v.name+' · '+c[v.key].months+' months. '+(id==='costRows'||label==='Effective monthly ownership cost'?basis:'');
    if(label==='Maintenance')extra+=' '+(v.kind==='lease'&&s.kintoMaintenance?'Included in lease invoices.':c[v.key].serviceCount+' services × '+money(s.serviceCost)+'.');
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
function explainResult(element,text){
 if(!element)return;
 element.dataset.explanation=text;element.classList.add('explained');element.tabIndex=0;
}
function hideResultExplanation(){
 $('resultTooltip').hidden=true;
 activeResultExplanation?.removeAttribute('aria-describedby');activeResultExplanation=null;
}
function showResultExplanation(target,x,y){
 hideGraphTooltip();hideResultExplanation();
 const tooltip=$('resultTooltip');tooltip.textContent=target.dataset.explanation;tooltip.hidden=false;
 target.setAttribute('aria-describedby','resultTooltip');activeResultExplanation=target;
 const anchor=target.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
 x??=anchor.left+Math.min(anchor.width/2,100);y??=anchor.bottom;
 const left=x+14+box.width<=window.innerWidth?x+14:x-14-box.width;
 const top=y+14+box.height<=window.innerHeight?y+14:y-14-box.height;
 tooltip.style.left=Math.max(8,Math.min(left,window.innerWidth-box.width-8))+'px';
 tooltip.style.top=Math.max(8,Math.min(top,window.innerHeight-box.height-8))+'px';
}
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
