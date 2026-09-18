import {createTranslator} from "./i18n.mjs";
import {loanSchedule,inflationReturnGrid,relativeResaleEstimate,nominalOpportunityRate,calculate,cashFlowValue,resaleComparisons,interestComparisons,withResale,resaleSamples} from "./model.mjs";

/** Render charts and own shared hover, touch and keyboard interaction state. */
export function createCharts({i18n=createTranslator(),document,window,views,onShowTooltip}){
 const {t,money,num,ratePercent,returnBasisLabel}=i18n;
 const $=id=>document.getElementById(id);
 const chartIds={"charts.opportunityReturnSensitivity":"opportunity-return-sensitivity","charts.loanInterestSensitivity":"loan-interest-sensitivity","charts.carValueTimeline":"car-value-timeline","ui.cumulativeCashSpent":"cumulative-cash-spent","ui.resaleSensitivity":"resale-sensitivity"};
 const chartData=new Map();
 let activeGraph=null;
 const {annualViews,opportunityViews,inflationViews,viewOptions,viewInputs,moneyBasis,comparisonBasis}=views;
 const graphValue=(result,key)=>result.adjusted*(annualViews[key]?12/result.months:1);
 const graphBasis=key=>annualViews[key]?t("charts.kYearEffective"):t("ui.kOverFullTerm");
 function graphFrame(title,body,width=960,height=340){
  return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+title+'"><title>'+title+'</title>'+body+'</svg>';
 }
 function chartLegend(active){return '<div class="chart-legend">'+active.map(v=>'<span data-option="'+v.kind+'">'+v.name+'</span>').join("")+'</div>';}
 function lineChart(titleKey,series,xLabel,yLabel,formatX=null){
  const title=t(titleKey),chartKey=chartIds[titleKey];
  const all=series.flatMap(s=>s.points),left=100,top=30,width=810,height=245;
  const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
  const minY=Math.min(0,...all.map(p=>p.y)),maxY=Math.max(0,...all.map(p=>p.y));
  const x=v=>left+(v-minX)/(maxX-minX||1)*width,y=v=>top+height-(v-minY)/(maxY-minY||1)*height;
  let body='';
  for(let i=0;i<=4;i++){
   const value=minY+(maxY-minY)*i/4,py=y(value),vx=minX+(maxX-minX)*i/4;
   body+='<path class="chart-grid" d="M'+left+' '+py+'H'+(left+width)+'"/><text class="chart-axis" x="'+(left-12)+'" y="'+(py+4)+'" text-anchor="end">'+num(value/1000)+'k</text>';
   body+='<text class="chart-axis" x="'+x(vx)+'" y="300" text-anchor="middle">'+(formatX?formatX(vx):xLabel===t("charts.month")?num(vx):num(vx/1000)+'k')+'</text>';
  }
  body+='<text class="chart-axis" x="'+left+'" y="18">'+yLabel+'</text><text class="chart-axis" x="910" y="326" text-anchor="end">'+xLabel+'</text>';
  for(const seriesItem of series){
   const path=seriesItem.points.map((p,i)=>i?(seriesItem.step?'H'+x(p.x)+'V'+y(p.y):'L'+x(p.x)+' '+y(p.y)):'M'+x(p.x)+' '+y(p.y)).join(' ');
   body+='<g data-option="'+seriesItem.kind+'">'+(seriesItem.pointsOnly?'':'<path d="'+path+'" fill="none" stroke="currentColor" stroke-width="1.75"'+(seriesItem.dashed?' stroke-dasharray="6 5"':'')+'/>');
   // Focusable points provide the same exact values as hover, without a chart library.
   for(const p of seriesItem.points)body+='<circle tabindex="0" data-point-x="'+p.x+'" cx="'+x(p.x)+'" cy="'+y(p.y)+'" r="'+(p.current||seriesItem.pointsOnly?4.5:2)+'" fill="'+(p.current||seriesItem.pointsOnly?'var(--bg)':'currentColor')+'" stroke="currentColor" stroke-width="1.25" aria-label="'+seriesItem.name+', '+p.label+', '+money(p.y)+'"><title>'+seriesItem.name+' · '+p.label+' · '+money(p.y)+'</title></circle>';
   body+='</g>';
  }
  body+='<path class="chart-cursor" hidden/>';
  chartData.set(chartKey,{type:'line',series,xLabel,yLabel,minX,maxX,left,top,width,height,step:xLabel===t("charts.month")});
  return graphFrame(title,body).replace('<svg ','<svg tabindex="0" data-chart-key="'+chartKey+'" ');
 }
 function monthlyCostChart(s,c,active){
  const bills={},nominalBills={};
  const averageBills=active.some(v=>c[v.key].loanMonths>0&&c[v.key].loanMonths<c[v.key].months);
  for(const v of active){
   const n=c[v.key].months;
   const recurring=c[v.key].events.filter(e=>['lease','repayment','insurance'].includes(e.category));
   if(v.kind==='lease')for(let month=0;month<n;month++)recurring.push({amount:-c.leaseVatPerPayment,month});
   nominalBills[v.key]=recurring.reduce((sum,e)=>sum+e.amount,0)/n;
   bills[v.key]=inflationViews.monthlyGraph?recurring.reduce((sum,e)=>sum+cashFlowValue(e,n,c.nominalReturn,s.inflationRate,{opportunity:false,todayMoney:true}),0)/n:nominalBills[v.key];
  }
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
   body+='<g data-option="'+v.kind+'" data-bar-kind="'+v.kind+'"><text class="chart-label" x="0" y="'+(top+23)+'">'+v.name+'</text><text class="chart-subtitle chart-money" x="0" y="'+(top+45)+'">'+money(c[v.key].adjusted)+(t("results.total2")+"</text><text class=\"chart-subtitle\" x=\"0\" y=\"")+(top+64)+'">'+c[v.key].months+(t("charts.months")+"</text>");
   for(const [offset,label,amount,style] of [
    [0,averageBills||inflationViews.monthlyGraph?t("charts.averageBill"):t("charts.regularBill"),bills[v.key],'outline'],
    [34,t("charts.fullCost"),c[v.key].adjusted/c[v.key].months,'solid']
   ]){
    const percent=asPercent(amount,monthlyMax),start=Math.min(x(0),x(percent)),width=Math.abs(x(percent)-x(0)),y=top+offset;
    const fill=style==='outline'?'none':'currentColor';
    const description=t("charts.perMonth",{name:v.name,label:label,amount:money(amount)});
    body+='<rect tabindex="0" x="'+start+'" y="'+y+'" width="'+Math.max(1,width)+'" height="25" rx="3" fill="'+fill+'" stroke="currentColor" stroke-width="2" aria-label="'+description+'"><title>'+description+' · '+num(percent)+(t("charts.ofItsScale")+"</title></rect><text class=\"chart-label\" x=\"780\" y=\"")+(y+19)+'">'+money(amount)+'</text>';
   }
   body+='</g>';
  });
  const legend='<div class="chart-key"><span><i class="key-outline"></i> '+(inflationViews.monthlyGraph?t("charts.averageBillInTodaySMoney"):averageBills?t("charts.averageBillAcrossOwnership"):t("charts.regularBill"))+(t("results.month")+"</span><span><i class=\"key-solid\"></i>"+t("charts.fullCostMonth"))+moneyBasis('monthlyGraph')+'</span></div>';
  chartData.set('monthly-costs',{type:'bars',active,bills,c,nominalBills,averageBills,nominal:inflationViews.monthlyGraph?calculate(viewInputs(s,'monthlyGraph')):c,top:38,rowHeight:94});
  return legend+graphFrame(t("charts.monthlyBillsAndEffectiveMonthlyCostsOnA"),body,960,height).replace('<svg ','<svg tabindex="0" data-chart-key="monthly-costs" ');
 }
 function sensitivityWinners(samples,active,key,formatX){
  const endpoints=[samples[0],samples[samples.length-1]];
  return '<div class="chart-insights">'+endpoints.map(sample=>{
   const ranking=active.map(v=>({...v,cost:graphValue(sample.result[v.key],key)})).sort((a,b)=>a.cost-b.cost);
   const leaders=ranking.filter(v=>Math.abs(v.cost-ranking[0].cost)<.5);
   return ("<p><strong>"+t("charts.at"))+formatX(sample.rate)+'</strong> '+leaders.map(v=>'<span data-option="'+v.kind+'">'+v.name+'</span>').join(' + ')+(leaders.length>1?t("charts.tie"):t("charts.costsLeast"))+' · '+money(ranking[0].cost)+(annualViews[key]?t("results.year"):t("results.total2"))+'</p>';
  }).join('')+'</div>';
 }
 function renderRateGraphs(s,active){
  const percent=ratePercent;
  const sampleRates=(max,extra)=>[...new Set([...Array.from({length:25},(_,i)=>max*i/24),...extra.filter(rate=>rate>=0&&rate<=max)])].sort((a,b)=>a-b);
  const returnMax=Math.min(s.opportunityRateBasis==="nominal"?300:100,Math.max(12,Math.ceil(s.opportunityRate*1.5)));
  const returns=sampleRates(returnMax,[s.opportunityRate]).map(rate=>({rate,result:calculate({...s,opportunityRate:rate})}));
  const returnSeries=active.map(v=>({...v,annual:annualViews.returnGraph,months:s[v.months],points:returns.map(sample=>({x:sample.rate,y:graphValue(sample.result[v.key],"returnGraph"),label:t("charts.annualReturn",{rate:percent(sample.rate),s:returnBasisLabel(s)}),current:sample.rate===s.opportunityRate}))}));
  $("returnGraph").innerHTML=chartLegend(active)+lineChart("charts.opportunityReturnSensitivity",returnSeries,t("charts.annualReturn2",{s:returnBasisLabel(s)}),graphBasis('returnGraph'),percent)+sensitivityWinners(returns,active,'returnGraph',percent);
  const interestInputs=viewInputs(s,'interestGraph'),matches=interestComparisons(interestInputs,viewOptions("interestGraph"),annualViews.interestGraph);
  const loans=active.filter(v=>v.kind==='balloon'||v.kind==='normal');
  if(!loans.length){$("interestGraph").innerHTML=("<p class=\"hint\">"+t("charts.includeALoanInSetupToExploreInterest")+"</p>");return;}
  const currentRates=loans.map(v=>v.kind==='balloon'?s.rate:s.normalRate);
  const interestMax=Math.min(100,Math.max(12,Math.ceil(Math.max(...currentRates)*1.5)));
  // Loans are independent: sampling both at x leaves lease and cash benchmarks unchanged.
  const rates=sampleRates(interestMax,[...currentRates,...matches.filter(m=>m.rate!==null).map(m=>m.rate)]).map(rate=>({rate,result:calculate({...interestInputs,balloonInputMode:"rate",normalInputMode:"rate",rate,normalRate:rate},viewOptions("interestGraph")),nominal:calculate({...interestInputs,balloonInputMode:"rate",normalInputMode:"rate",rate,normalRate:rate})}));
  const loanSeries=active.map(v=>({...v,annual:annualViews.interestGraph,months:s[v.months],points:rates.map(sample=>({x:sample.rate,y:graphValue(sample.result[v.key],"interestGraph"),nominalY:graphValue(sample.nominal[v.key],"interestGraph"),label:t("charts.loanInterest",{rate:percent(sample.rate)}),current:v.kind==='balloon'?sample.rate===s.rate:v.kind==='normal'&&sample.rate===s.normalRate}))}));
  $("interestGraph").innerHTML=chartLegend(active)+lineChart("charts.loanInterestSensitivity",loanSeries,t("charts.nominalAnnualLoanInterest"),graphBasis('interestGraph')+' · '+comparisonBasis('interestGraph'),percent)+sensitivityWinners(rates,active,'interestGraph',percent);
 }
 function costWaterfall(s,active){
  const annual=annualViews.waterfallGraph;
  const result=calculate(s,viewOptions('waterfallGraph')),cells=[],left=220,width=650,rowHeight=200;
  const values=active.map(v=>{
   const o=result[v.key],divisor=annual?o.months/12:1;
   return {v,o,amounts:[o.nominal,o.inflationAdjustment,o.opportunity,o.adjusted].map(value=>value/divisor)};
  });
  const ends=values.flatMap(({amounts:a})=>[a[0],a[0]+a[1],a[3]]),low=Math.min(0,...ends),high=Math.max(0,...ends);
  const labels=[t("charts.nominalCost"),t("charts.inflationEffect"),t("ui.opportunityCost"),t("charts.finalCost")];
  let body='<text class="chart-axis" x="'+left+'" y="18">'+(annual?t("charts.kYear"):t("charts.kOverEachFullTerm"))+(t("charts.hoverAStageForAllOptions")+"</text>");
  values.forEach(({v,o,amounts:a},row)=>{
   const top=40+row*rowHeight,y=value=>top+125-(value-low)/(high-low||1)*110;
   const starts=[0,a[0],a[0]+a[1],0],stops=[a[0],a[0]+a[1],a[3],a[3]];
   body+='<g data-option="'+v.kind+'"><text class="chart-label" x="12" y="'+(top+45)+'">'+v.name+'</text><text class="chart-subtitle" x="12" y="'+(top+67)+'">'+o.months+(t("charts.months")+"</text><path class=\"chart-grid\" d=\"M")+left+' '+y(0)+'H'+(left+width)+'"/>';
   a.forEach((amount,stage)=>{
    const x=left+stage*165,barY=Math.min(y(starts[stage]),y(stops[stage])),h=Math.max(2,Math.abs(y(starts[stage])-y(stops[stage]))),index=cells.length;
    body+='<rect tabindex="0" data-point-x="'+index+'" x="'+x+'" y="'+barY+'" width="105" height="'+h+'" rx="2" fill="currentColor" fill-opacity="'+(stage===0||stage===3?1:.42)+'" stroke="currentColor" stroke-dasharray="'+(amount<0?'4 3':'none')+'" aria-label="'+v.name+', '+labels[stage]+', '+money(amount)+'"/><text class="chart-label waterfall-amount" x="'+(x+52)+'" y="'+(barY-8)+'" text-anchor="middle">'+(stage>0&&stage<3&&amount>0?'+':'')+money(amount)+'</text><foreignObject x="'+(x-15)+'" y="'+(top+139)+'" width="135" height="60"><div xmlns="http://www.w3.org/1999/xhtml" class="chart-stage-label">'+labels[stage]+'</div></foreignObject>';
    if(stage<2)body+='<path class="chart-grid" stroke-dasharray="3 3" d="M'+(x+105)+' '+y(stops[stage])+'H'+(x+165)+'"/>';
    const stageNote=stage===1?(inflationViews.waterfallGraph?t("charts.differenceFromDiscountingEachDatedCashFlowResale"):t("charts.excludedTurnOnTodaySMoneyToInclude")):
     stage===2?(opportunityViews.waterfallGraph?t("charts.additionalTimingCostOnTheSelectedInflationBasis"):t("charts.excludedByTheOpportunityCostSwitch")):
     stage===3?comparisonBasis('waterfallGraph'):t("charts.nominalOwnershipCostBeforeOpportunityAndInflationAdjustments");
    cells.push({x,y:top-12,w:105,h:180,values:{inflationRate:inflationViews.waterfallGraph&&stage>0?s.inflationRate:null,title:labels[stage],unit:(annual?t("charts.kYear"):t("charts.kOverEachOptionSTerm"))+' · '+stageNote,rows:values.map(other=>({name:other.v.name,kind:other.v.kind,value:other.amounts[stage],note:t("charts.fullTermAmountOverMonths",{value1:money(other.amounts[stage]*(annual?other.o.months/12:1)),months:other.o.months})}))}});
   });body+='</g>';
  });
  chartData.set('cost-waterfall',{type:'cells',cells,columns:4});
  return graphFrame(t("charts.costWaterfall"),body,960,active.length*rowHeight+40).replace('<svg ','<svg tabindex="0" data-chart-key="cost-waterfall" ');
 }
 function loanDebtSeries(s,loans){
  return loans.map(v=>{
   const schedule=loanSchedule(s,v.kind);
   const points=Array.from({length:schedule.ownership+1},(_,month)=>({x:month,y:month===0?schedule.principal:schedule.rows[Math.min(month,schedule.rows.length)-1].balance,label:t("charts.monthAfterRegularPaymentAndAnyBalloon",{month:month})}));
   return {...v,name:t("charts.remainingDebt",{name:v.name}),onlyWithin:true,step:true,points};
  });
 }
 function loanPaymentChart(s,active){
  const loans=active.filter(v=>['balloon','normal'].includes(v.kind)).map(v=>({...v,schedule:loanSchedule(s,v.kind)}));
  if(!loans.length){chartData.delete('loan-payment-breakdown');return ("<p class=\"hint\">"+t("charts.includeALoanInSetupToSeePrincipal")+"</p>");}
  const maxMonths=Math.max(...loans.map(v=>v.schedule.rows.length)),maxPayment=Math.max(1,...loans.map(v=>v.schedule.payment));
  const left=100,width=810,rowHeight=230,cells=[],slot=width/maxMonths;
  const values=month=>({title:t("charts.monthLoanRepayments",{month:month}),unit:t("charts.nominalKExcludesDepositInsuranceAndFees"),rows:loans.flatMap(v=>{
   const row=v.schedule.rows.find(row=>row.month===month);
   if(!row)return [];
   return [{name:t("charts.principal",{name:v.name}),value:row.principal},{name:t("charts.interest",{name:v.name}),value:row.interest},{name:t("charts.interestPaidSoFar",{name:v.name}),value:row.totalInterest},{name:t("charts.remainingDebt",{name:v.name}),value:row.balance},
    ...(row.balloon?[{name:t("charts.finalBalloon",{name:v.name}),value:row.balloon}]:[]),...(row.settlement?[{name:t("charts.saleSettlement",{name:v.name}),value:row.settlement}]:[])].map(row=>({...row,kind:v.kind}));
  })});
  let body='';
  loans.forEach((v,index)=>{
   const top=55+index*rowHeight,base=top+130,y=value=>base-value/maxPayment*120,last=v.schedule.rows.at(-1);
   const extra=last.balloon?t("charts.monthBalloon",{month:last.month,balloon:money(last.balloon)}):last.settlement?t("charts.monthSaleSettlement",{month:last.month,settlement:money(last.settlement)}):t("charts.noSeparateFinalPayment");
   body+='<g data-option="'+v.kind+'"><text class="chart-label" x="'+left+'" y="'+(top-28)+'">'+v.name+' · '+money(v.schedule.payment)+(t("results.month")+"</text><text class=\"chart-axis\" x=\"")+left+'" y="'+(top-8)+'">'+extra+(t("charts.shownSeparatelyFromTheBars")+"</text>");
   for(let i=0;i<=2;i++){const amount=maxPayment*i/2;body+='<path class="chart-grid" d="M'+left+' '+y(amount)+'H'+(left+width)+'"/><text class="chart-axis" x="'+(left-10)+'" y="'+(y(amount)+4)+'" text-anchor="end">'+num(amount/1000)+'k</text>';}
   for(const row of v.schedule.rows){
    const x=left+(row.month-1)*slot,w=Math.max(1,slot*.78),cell=cells.length;
    body+='<g tabindex="0" data-point-x="'+cell+'" aria-label="'+v.name+t("charts.month2")+row.month+t("charts.principal2")+money(row.principal)+t("charts.interest2")+money(row.interest)+'"><rect x="'+x+'" y="'+y(row.principal)+'" width="'+w+'" height="'+Math.max(0,row.principal/maxPayment*120)+'" fill="currentColor"/><rect x="'+x+'" y="'+y(row.payment)+'" width="'+w+'" height="'+Math.max(0,row.interest/maxPayment*120)+'" fill="currentColor" fill-opacity=".3"/></g>';
    cells.push({x,y:top,w:slot,h:145,values:values(row.month)});
   }
   for(const month of [...new Set([1,Math.ceil(maxMonths/2),maxMonths])])body+='<text class="chart-axis" x="'+(left+(month-.5)*slot)+'" y="'+(base+22)+'" text-anchor="middle">'+month+'</text>';
   body+='<text class="chart-axis" x="910" y="'+(base+43)+'" text-anchor="end">Month · '+v.schedule.months+t("charts.repayment")+v.schedule.ownership+(t("charts.ownership")+"</text></g>");
  });
  chartData.set('loan-payment-breakdown',{type:'cells',cells,columns:1});
  return ("<div class=\"chart-key\"><span>"+t("charts.solidPrincipalRepaid")+"</span><span>"+t("charts.lightInterest")+"</span></div>")+graphFrame(t("charts.monthlyPrincipalAndInterestRepayments"),body,960,loans.length*rowHeight).replace('<svg ','<svg tabindex="0" data-chart-key="loan-payment-breakdown" ');
 }
 function carValueTimeline(s,active){
  const loans=active.filter(v=>['balloon','normal'].includes(v.kind)),debt=loanDebtSeries(s,loans);
  if(s.resaleMode!=='relative'){
   if(!debt.length){chartData.delete('car-value-timeline');return ("<p class=\"hint\">"+t("charts.chooseRelativeDepreciationOrIncludeALoanTo")+"</p>");}
   const values=loans.map(v=>({...v,name:t("charts.enteredCarValue",{name:v.name}),pointsOnly:true,onlyWithin:true,points:[{x:0,y:s.price,label:t("ui.purchasePrice")},{x:s[v.months],y:s[v.resale],label:t("charts.enteredEndValueAtMonth",{value1:s[v.months]})}]}));
   const series=[...debt,...values],svg=lineChart("charts.carValueTimeline",series,t("charts.month"),t("charts.nominalValueDebtK"),num);
   chartData.get('car-value-timeline').equity={s,loans};
   return chartLegend(series)+svg+("<p class=\"hint\">"+t("charts.valueDotsShowOnlyPurchaseAndEnteredEnd")+"</p>");
  }
  const owners=active.filter(v=>v.kind!=='lease'||s.leaseEnd!=='return');
  if(!owners.length){chartData.delete('car-value-timeline');return ("<p class=\"hint\">"+t("charts.includeAPurchaseOptionOrALeaseBuyout")+"</p>");}
  if(s.pastOwnership){
   const end=Math.max(...owners.map(v=>s[v.months])),times=[...new Set([0,end,...owners.map(v=>s[v.months]),...Array.from({length:25},(_,i)=>end*i/24)])].sort((a,b)=>a-b);
   const series=[{name:t("charts.modelledNominalValue"),kind:'nominal-value',points:times.map(x=>({x,y:relativeResaleEstimate(s,x).nominalValue,label:t("charts.monthSincePurchase",{x:num(x)})}))},
    {name:t("charts.valueInPurchaseDateMoney"),kind:'real-value',dashed:true,points:times.map(x=>({x,y:relativeResaleEstimate(s,x).todayValue,label:t("charts.monthSincePurchase",{x:num(x)})}))}];
   series.push(...debt);
   const svg=lineChart("charts.carValueTimeline",series,t("charts.monthsSincePurchase"),t("charts.valueDebtK"),value=>num(value));
   chartData.get('car-value-timeline').equity={s,loans};
   return chartLegend(series)+svg+("<p class=\"hint\">"+t("charts.aConstantDepreciationCurveBetweenTheInputValues")+"</p>");
  }
  const age=s.historicalMonths,end=Math.max(...owners.map(v=>s[v.months])),forecast=relativeResaleEstimate(s);
  const times=[...new Set([0,end,...owners.map(v=>s[v.months]),...Array.from({length:25},(_,i)=>end*i/24)])].sort((a,b)=>a-b);
  const label=month=>month===0?t("charts.today"):month<0?t("charts.monthsAgo",{value1:num(-month)}):t("charts.monthProjected",{month:num(month)});
  const series=[
   {name:t("charts.comparableCarHistoricalNominalPrices"),kind:'history',dashed:true,onlyWithin:true,points:[{x:-age,y:s.historicalNewPrice,label:label(-age)},{x:0,y:s.historicalUsedPrice,label:t("charts.todayComparableUsedCar")}]},
   {name:t("charts.newCarNominalResale"),kind:'nominal-value',onlyWithin:true,points:times.map(x=>({x,y:relativeResaleEstimate(s,x).nominalValue,label:label(x)}))},
   {name:t("charts.newCarResaleInTodaySMoney"),kind:'real-value',dashed:true,onlyWithin:true,points:times.map(x=>({x,y:relativeResaleEstimate(s,x).todayValue,label:label(x)}))}
  ];
  series.push(...debt);
  let svg=lineChart("charts.carValueTimeline",series,t("charts.monthsFromToday"),t("charts.carValueKInclVat"),value=>num(value));
  const data=chartData.get('car-value-timeline');data.step=false;
  data.timeline={s,owners,forecast};data.equity={s,loans};
  const x=value=>data.left+(value-data.minX)/(data.maxX-data.minX)*data.width;
  let background='<rect class="projection-shade" x="'+x(0)+'" y="'+data.top+'" width="'+(x(end)-x(0))+'" height="'+data.height+'"/><path class="timeline-origin" d="M'+x(0)+' '+data.top+'V'+(data.top+data.height)+'"/>';
  const endGroups=[...new Set(owners.map(v=>s[v.months]))].sort((a,b)=>a-b).map(month=>({month,options:owners.filter(v=>s[v.months]===month)}));
  for(const group of endGroups)background+='<g data-option="'+(group.options.length===1?group.options[0].kind:'history')+'"><path d="M'+x(group.month)+' '+data.top+'V'+(data.top+data.height)+'" stroke="currentColor" stroke-width="1" stroke-dasharray="2 5"/></g>';
  svg=svg.replace('<path class="chart-grid"',background+'<path class="chart-grid"');
  const endLegend=("<div class=\"chart-key\">"+t("charts.endMarkers"))+endGroups.map(group=>'<span>'+group.options.map(v=>'<span data-option="'+v.kind+'">'+v.name+'</span>').join(' + ')+t("charts.month3")+group.month+'</span>').join('')+'</div>';
  return chartLegend(series)+svg+endLegend;
 }
 function inflationReturnHeatmap(s,active){
  const annual=annualViews.heatmapGraph;
  const range=(current,minimum,max)=>{
   const end=Math.min(max,Math.max(minimum,Math.ceil(current*1.5)));
   return [...new Set([...Array.from({length:9},(_,i)=>end*i/8),current])].sort((a,b)=>a-b);
  };
  const inflations=range(s.inflationRate,6,100),returns=range(nominalOpportunityRate(s),12,300).reverse();
  const grid=inflationReturnGrid(s,inflations,returns,viewOptions('heatmapGraph'),annual).map(cell=>({...cell,gap:cell.gap*(annual?12:1),costs:cell.costs.map(v=>({...v,name:i18n.variantName(v.kind),value:v.value*(annual?12:1)}))})),maxGap=Math.max(1,...grid.map(cell=>cell.gap));
  const left=110,top=48,width=790,height=335,cw=width/inflations.length,ch=height/returns.length,cells=[];
  let body='<text class="chart-axis" x="'+left+'" y="18">'+t('charts.alternativeReturnAxis')+'</text>';
  grid.forEach((cell,index)=>{
   const column=index%inflations.length,row=Math.floor(index/inflations.length),x=left+column*cw,y=top+row*ch,tied=cell.leaders.length>1,winner=cell.costs[0];
   const title=t("charts.inflationReturn",{inflation:ratePercent(cell.inflation),rate:ratePercent(cell.rate)});
   const outcome=tied?t("charts.tie2",{value1:cell.costs.filter(v=>cell.leaders.includes(v.key)).map(v=>v.name).join(' + ')}):t("charts.wins",{name:winner.name});
   body+='<rect tabindex="0" data-point-x="'+index+'" data-option="'+(tied?'tie':winner.kind)+'" x="'+(x+1)+'" y="'+(y+1)+'" width="'+(cw-2)+'" height="'+(ch-2)+'" rx="3" fill="currentColor" fill-opacity="'+(.22+.78*cell.gap/maxGap)+'" aria-label="'+title+'. '+outcome+'"/>';
   if(cell.inflation===s.inflationRate&&cell.rate===nominalOpportunityRate(s))body+='<circle class="heatmap-current" cx="'+(x+cw/2)+'" cy="'+(y+ch/2)+'" r="8"/>';
   cells.push({x,y,w:cw,h:ch,values:{inflationRate:inflationViews.heatmapGraph?cell.inflation:null,title:title+' · '+outcome,unit:(annual?t("charts.kYear"):t("charts.kOverEachFullTerm"))+' · '+(opportunityViews.heatmapGraph?t("charts.includesOpportunityCost"):t("charts.opportunityCostExcluded"))+' · '+moneyBasis('heatmapGraph')+(active.length>1?t("charts.lead",{gap:money(cell.gap),description2:annual?t("results.year"):t("results.total2")}):''),rows:cell.costs.map(v=>({name:v.name,kind:v.kind,value:v.value,note:t("charts.fullTermCostOverMonths",{total:money(v.total),months:v.months,description3:v.kind==='lease'&&s.leaseEnd==='return'?t("charts.carReturnedNoResaleCredit"):t("charts.endCarValue",{resale:money(v.resale)})})}))}});
  });
  inflations.forEach((rate,i)=>body+='<text class="chart-axis" x="'+(left+(i+.5)*cw)+'" y="'+(top+height+26)+'" text-anchor="middle">'+ratePercent(rate)+'</text>');
  returns.forEach((rate,i)=>body+='<text class="chart-axis" x="'+(left-14)+'" y="'+(top+(i+.5)*ch+4)+'" text-anchor="end">'+ratePercent(rate)+'</text>');
  body+=("<text class=\"chart-axis\" x=\"900\" y=\"442\" text-anchor=\"end\">"+t("charts.expectedFutureInflationPA")+"</text>");
  chartData.set('inflation-return-map',{type:'cells',cells,columns:inflations.length,grid,inflations,returns});
  return chartLegend(active)+'<div class="chart-key">'+t('charts.heatmapLegend')+'</div>'+graphFrame(t("charts.whichOptionWinsAcrossInflationAndReturnAssumptions"),body,960,455).replace('<svg ','<svg tabindex="0" data-chart-key="inflation-return-map" ');
 }

 function renderGraphs(s,c,active){
  $("graphNote").textContent=t("charts.costComparisonChartsDefaultToAverageAnnualCosts");
  const cashSeries=active.map(v=>{
   const events=c[v.key].events.filter(e=>e.type==='cash'),times=[...new Set([0,...events.map(e=>e.month)])].sort((a,b)=>a-b);
   let total=0;
   const points=times.map(month=>{total+=events.filter(e=>e.month===month).reduce((sum,e)=>sum+e.amount,0);return {x:month,y:total,label:t("charts.month4",{month:new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(month)})};});
   return {...v,points};
  });
  $("cashGraph").innerHTML=chartLegend(active)+lineChart("ui.cumulativeCashSpent",cashSeries,t("charts.month"),t("charts.netCashSpentK"));
  const resaleInputs=viewInputs(s,'resaleGraph'),resalePoints=resaleSamples(resaleInputs,resaleComparisons(resaleInputs,viewOptions("resaleGraph"),annualViews.resaleGraph));
  const samples=resalePoints.map(resale=>({resale,result:calculate(withResale(resaleInputs,resale),viewOptions("resaleGraph")),nominal:calculate(withResale(resaleInputs,resale))}));
  const resaleSeries=active.map(v=>({...v,annual:annualViews.resaleGraph,months:s[v.months],points:samples.map(({resale,result,nominal})=>({x:s.matchPeriods?resale:resale-s.resale,y:graphValue(result[v.key],"resaleGraph"),nominalY:graphValue(nominal[v.key],"resaleGraph"),label:(s.matchPeriods?t("charts.resale"):t("charts.resaleChange"))+money(s.matchPeriods?resale:resale-s.resale)}))}));
  $("resaleGraph").innerHTML=chartLegend(active)+lineChart("ui.resaleSensitivity",resaleSeries,s.matchPeriods?t("charts.grossResaleK"):t("charts.changeInEachResaleK"),graphBasis('resaleGraph')+' · '+comparisonBasis('resaleGraph'));
  $("monthlyGraph").innerHTML=monthlyCostChart(s,calculate(viewInputs(s,'monthlyGraph'),viewOptions('monthlyGraph')),active);
  renderRateGraphs(s,active);
  $("waterfallGraph").innerHTML=costWaterfall(s,active);
  $("timelineGraph").innerHTML=carValueTimeline(s,active);
  $("loanPaymentGraph").innerHTML=loanPaymentChart(s,active);
  $("heatmapGraph").innerHTML=inflationReturnHeatmap(s,active);
  for(const [key,chart] of [['monthlyGraph','monthly-costs'],['interestGraph','loan-interest-sensitivity'],['resaleGraph','resale-sensitivity']]){
   const data=chartData.get(chart);if(data)data.inflationRate=inflationViews[key]?s.inflationRate:null;
   $(key).dataset.inflationAdjusted=String(inflationViews[key]);
  }
  initializeGraphTooltips();
 }

 function chartPositions(data){
  if(data.type==='cells')return data.cells.map((_,index)=>index);
  return data.type==='bars'?data.active.map((_,index)=>index):[...new Set(data.series.flatMap(series=>series.points.map(point=>point.x)))].sort((a,b)=>a-b);
 }
 function graphTooltipValues(data,position){
  if(data.type==='cells')return data.cells[position].values;
  if(data.type==='bars'){
   const variant=data.active[position],result=data.c[variant.key];
   return {title:t("charts.months2",{name:variant.name,months:result.months}),unit:t("charts.monthlyAmountsAndFullTermTotal",{value1:comparisonBasis('monthlyGraph')}),rows:[
    {name:data.inflationRate!=null||data.averageBills?t("charts.averageBillMonth"):t("charts.regularBillMonth"),kind:variant.kind,value:data.bills[variant.key],nominalValue:data.nominalBills?.[variant.key]},
    {name:t("charts.fullCostMonth2"),kind:variant.kind,value:result.adjusted/result.months,nominalValue:data.nominal?.[variant.key].adjusted/result.months},
    {name:t("charts.fullTermTotal"),kind:variant.kind,value:result.adjusted,nominalValue:data.nominal?.[variant.key].adjusted}
   ]};
  }
  const point=data.series.flatMap(series=>series.points).find(point=>Math.abs(point.x-position)<1e-8);
  const rows=data.series.filter(series=>(!series.pointsOnly||series.points.some(p=>Math.abs(p.x-position)<1e-8))&&(!series.onlyWithin||(position>=series.points[0].x&&position<=series.points.at(-1).x))).map(series=>{
   const points=series.points,last=points[points.length-1];
   const exact=points.find(point=>Math.abs(point.x-position)<1e-8);
   let value,nominalValue,note='',approximate=false;
   if(exact){value=exact.y;nominalValue=exact.nominalY;}
   else if(position>last.x){value=last.y;nominalValue=last.nominalY;note=t("charts.finalValue",{value1:last.label.toLowerCase()});}
   else if(position<points[0].x){value=0;nominalValue=0;note=t("charts.notStarted");}
   else{
    const after=points.findIndex(point=>point.x>position),left=points[after-1],right=points[after];
    // Cash moves only on its event dates. Other charts interpolate only if a series lacks this x.
    value=data.step||series.step?left.y:left.y+(right.y-left.y)*(position-left.x)/(right.x-left.x);
    nominalValue=data.step||series.step?left.nominalY:left.nominalY+(right.nominalY-left.nominalY)*(position-left.x)/(right.x-left.x);
    approximate=!(data.step||series.step);
   }
   if(typeof series.annual==='boolean')note=t("charts.fullTermCostOverMonths2",{value1:money(value*(series.annual?series.months/12:1)),months:series.months,description3:approximate?t("charts.interpolated"):''});
   return {name:series.name,kind:series.kind,value,nominalValue,note,approximate};
  });
  if(data.timeline){
   const {s,forecast}=data.timeline;
   if(position<0)rows.push({name:t("charts.originalComparablePriceInTodaySMoney"),kind:'real-value',value:forecast.historicalPriceToday});
   if(position>=0){
    const projected=relativeResaleEstimate(s,position);
    rows.push({name:t("charts.realValueLostSinceNewPurchase"),kind:'history',value:s.price-projected.todayValue,note:t("charts.realValueRetained",{value1:ratePercent(projected.todayValue/(s.price||1)*100)})});
    rows.push({name:t("charts.futureInflationAddedToResale"),kind:'real-value',value:projected.nominalValue-projected.todayValue});
   }
  }
  if(data.equity&&position>=0){
   const {s,loans}=data.equity;
   for(const v of loans){
    if(position>s[v.months])continue;
    const value=s.resaleMode==='relative'?relativeResaleEstimate(s,position).nominalValue:position===0?s.price:position===s[v.months]?s[v.resale]:null;
    if(value===null)continue;
    const schedule=loanSchedule(s,v.kind),month=Math.floor(position),row=month===0?null:schedule.rows[Math.min(month,schedule.rows.length)-1],balance=row?row.balance:schedule.principal;
    rows.push({name:t("charts.equityBeforeSaleTaxesFees",{name:v.name}),kind:v.kind,value:value-balance,note:t("charts.carValueMinusDebtAfterScheduledPaymentsAn")});
    if(row?.balloon&&position===row.month)rows.push({name:t("charts.balloonPaidThisMonth",{name:v.name}),kind:v.kind,value:row.balloon});
   }
  }
  return {title:data.timeline&&position===0?t("charts.todayComparableCarAndNewPurchase"):point?.label||String(position),unit:data.yLabel,rows};
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
  onShowTooltip();
  const values=graphTooltipValues(data,position),tooltip=$('graphTooltip');
  if(activeGraph?.svg!==svg)hideGraphTooltip();
  activeGraph?.anchor?.removeAttribute('aria-describedby');
  const inflationRate=values.inflationRate??data.inflationRate,estimated=inflationRate!=null;
  tooltip.innerHTML='<strong>'+values.title+'</strong><small>'+values.unit+(estimated?t("charts.inflationAssumption",{inflationRate:ratePercent(inflationRate)}):'')+'</small><dl>'+values.rows.map(row=>'<div><dt data-option="'+row.kind+'">'+row.name+(row.note?'<small>'+row.note+'</small>':'')+'</dt><dd'+(estimated?' data-inflation-estimate="true"':'')+'>'+(estimated||row.approximate?'≈ ':'')+money(row.value)+(estimated&&Number.isFinite(row.nominalValue)?("<small>"+t("charts.nominal"))+money(row.nominalValue)+'</small>':'')+'</dd></div>').join('')+'</dl>';
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
     point.x=data.type==='cells'?data.cells[selected].x+data.cells[selected].w/2:data.type==='line'?data.left+(positions[selected]-data.minX)/(data.maxX-data.minX||1)*data.width:500;
     point.y=data.type==='cells'?data.cells[selected].y+data.cells[selected].h/2:data.type==='line'?data.top+data.height/2:data.top+selected*data.rowHeight+30;
     const screen=point.matrixTransform(svg.getScreenCTM());clientX=screen.x;clientY=screen.y;
    }
    showGraphTooltip(svg,data,positions[selected],clientX,clientY,anchor);
   }
   function pointer(event){
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    if(data.type==='cells'){
     const index=data.cells.findIndex(cell=>local.x>=cell.x&&local.x<=cell.x+cell.w&&local.y>=cell.y&&local.y<=cell.y+cell.h);
     if(index<0){hideGraphTooltip();return;}show(index,event);
    }else if(data.type==='bars'){
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
    if(event.key==='ArrowDown')index+=data.columns||1;
    else if(event.key==='ArrowUp')index-=data.columns||1;
    else if(event.key==='ArrowRight')index++;
    else if(event.key==='ArrowLeft')index--;
    else if(event.key==="Home")index=0;
    else if(event.key==="End")index=positions.length-1;
    else return;
    event.preventDefault();show(index,undefined,event.target);
   });
  }
 }
 function initialize(){
  window.addEventListener('resize',hideGraphTooltip);
  window.addEventListener('scroll',hideGraphTooltip,true);
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.chart'))hideGraphTooltip();});
 }
 return {renderGraphs,chartData,chartPositions,graphTooltipValues,hideGraphTooltip,showGraphTooltip,initialize};
}
