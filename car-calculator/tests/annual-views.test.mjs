import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,variants,calculate,effectiveInputs,interestComparisons,resaleComparisons,withResale} from '../src/model.mjs';
import {money} from '../src/format.mjs';
import {context,elements,saved,html} from './ui-harness.mjs?annual-views';
const app=context.__testApp;
const key='car-financing-calculator.annual-views.v1';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const toggle=(prefix,key,value)=>{elements[prefix+'-'+key].checked=value;elements[prefix+'-'+key].listeners.change();};
const input={...defaults,months:30,balloonMatchPeriod:false,balloonMonths:24,normalMatchPeriod:false,normalMonths:48,leaseMatchPeriod:false,leaseMonths:36,cashMatchPeriod:false,cashMonths:60,additionalCostAnnual:12000,leaseAdditionalCosts:true,leaseEnd:'buySell',leaseBuyout:650000};
function rows(id){return [...elements[id].innerHTML.matchAll(/<tr[^>]*><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/g)].map(m=>({label:m[1],cells:Object.fromEntries([...m[2].matchAll(/<td data-option="([^"]+)">(.*?)<\/td>/g)].map(cell=>[cell[1],cell[2]]))}));}
function amount(text){const match=text.replace(/<[^>]*>/g,'').match(/(-?[\d\s]+) Kč/);return match?Number(match[1].replace(/\s/g,'')):0;}

test('annual comparisons default on except opportunity breakdown, persist independently, and leave scenarios unchanged',()=>{
 assert.ok(Object.entries(app.views.annualViews).every(([name,value])=>value===(name!=='opportunityBreakdown')));
 for(const name of Object.keys(app.views.annualViews))assert.equal(elements['annual-'+name].checked,name!=='opportunityBreakdown');
 app.form.write(input);app.update();const before=app.scenarios.encodeSettings(app.form.readSettings());
 const unchanged=Object.fromEntries(['costRows','opportunityRows','monthlyRows','vatTimeline','cashflow','resaleGraph'].map(id=>[id,elements[id].innerHTML]));
 const annualVersus=elements.versusRows.innerHTML;
 toggle('annual','versus',false);
 assert.notEqual(elements.versusRows.innerHTML,annualVersus);
 for(const [id,value] of Object.entries(unchanged))assert.equal(elements[id].innerHTML,value,id);
 assert.equal(JSON.parse(saved.get(key)).versus,false);
 app.views.initializeAnnualViews();assert.equal(app.views.annualViews.versus,false);
 assert.equal(app.scenarios.encodeSettings(app.form.readSettings()),before);
 saved.set(key,JSON.stringify({versus:false,cost:'bad'}));app.views.initializeAnnualViews();
 assert.equal(app.views.annualViews.versus,false);assert.equal(app.views.annualViews.cost,true);
 saved.set(key,'broken');app.views.initializeAnnualViews();assert.ok(Object.entries(app.views.annualViews).every(([name,value])=>value===(name!=='opportunityBreakdown')));
 app.update();
 assert.ok(!html.includes('id="resultsAnnual"'));
 for(const name of ['summary','versus','cost','interest','resale','interestGraph','resaleGraph','waterfallGraph','heatmapGraph']){
  const annual=html.indexOf('id="annual-'+name+'"'),opportunity=html.indexOf('id="opportunity-'+name+'"');
  assert.ok(annual<opportunity&&annual>=0,name+' annual switch precedes opportunity');
 }
});

test('annual components reconcile over separate terms for every money basis and retain cumulative values',()=>{
 app.form.write(input);
 for(const opportunity of [false,true])for(const todayMoney of [false,true]){
  toggle('opportunity','cost',opportunity);toggle('inflation','cost',todayMoney);
  toggle('inflation','opportunityBreakdown',todayMoney);
  const cost=calculate(input,{opportunity,todayMoney}),timing=calculate(input,{opportunity:true,todayMoney});
  for(const annual of [true,false]){
   toggle('annual','cost',annual);toggle('annual','opportunityBreakdown',annual);
   const table=rows('costRows'),parts=table.slice(0,table.findIndex(row=>row.label==='Cost before opportunity'));
   for(const v of variants){
    const factor=annual?12/cost[v.key].months:1;
    const sum=parts.reduce((sum,row)=>sum+amount(row.cells[v.kind]),0);
    assert.ok(Math.abs(sum-cost[v.key].beforeOpportunity*factor)<=parts.length*.5);
    assert.equal(amount(table.find(row=>row.label==='Total economic cost').cells[v.kind]),Math.round(cost[v.key].adjusted*factor));
    assert.ok(table.find(row=>row.label==='Total economic cost').cells[v.kind].includes('data-full-term="'+cost[v.key].adjusted+'"'));
    assert.equal(amount(rows('opportunityRows').find(row=>row.label==='Total opportunity cost').cells[v.kind]),Math.round(timing[v.key].opportunity*factor));
   }
  }
 }
 toggle('annual','summary',true);
 const summary=calculate(input);
 for(const [prefix,v] of variants.map((v,i)=>[['easy','normal','kinto','cash'][i],v])){
  assert.equal(elements[prefix+'Total'].textContent,money(summary[v.key].adjusted*12/summary[v.key].months)+' / year');
  assert.equal(elements[prefix+'Annual'].textContent,money(summary[v.key].adjusted)+' total over '+summary[v.key].months+' months');
 }
 assert.match(elements.saving.textContent,/year effective/);
 assert.match(elements.saving.dataset.explanation,/Full-term cost:/);
});

test('both comparison bases solve rates and resale crossings on the displayed basis',()=>{
 for(const opportunity of [false,true])for(const todayMoney of [false,true])for(const annual of [true,false]){
  const options={opportunity,todayMoney},value=r=>r.adjusted/(annual?r.months:1);
  for(const item of interestComparisons(input,options,annual)){
   if(item.rate===null)continue;
   const rateKey=item.loan==='balloonLoan'?'rate':'normalRate';
   const result=calculate({...input,[rateKey]:item.rate},options);
   close(value(result[item.loan]),value(result[item.target]));
  }
  for(const pair of resaleComparisons(input,options,annual)){
   if(pair.resale===null)continue;
   const result=calculate(withResale(input,pair.resale),options);
   close(value(result[pair.left]),value(result[pair.right]));
  }
 }
 const full=interestComparisons(input,{},false),annual=interestComparisons(input,{},true);
 assert.ok(full.some((row,i)=>row.rate!==annual[i].rate||row.status!==annual[i].status));
});

test('graph switches use annual or full-term scales and tooltips retain cumulative costs',()=>{
 toggle('inflation','cost',false);
 app.form.write(input);app.update();
 const state=effectiveInputs(input);
 for(const name of ['returnGraph','interestGraph','resaleGraph','waterfallGraph','heatmapGraph'])for(const annual of [false,true]){
  toggle('annual',name,annual);
  const result=calculate(state);
  const chartKey={returnGraph:'opportunity-return-sensitivity',interestGraph:'loan-interest-sensitivity',resaleGraph:'resale-sensitivity',waterfallGraph:'cost-waterfall',heatmapGraph:'inflation-return-map'}[name];
  const data=app.charts.chartData.get(chartKey);
  let tip;
  if(name==='waterfallGraph')tip=app.charts.graphTooltipValues(data,3);
  else if(name==='heatmapGraph'){
   const index=data.grid.findIndex(cell=>cell.inflation===state.inflationRate&&cell.rate===state.opportunityRate);
   tip=app.charts.graphTooltipValues(data,index);
  }else tip=app.charts.graphTooltipValues(data,name==='returnGraph'?state.opportunityRate:name==='interestGraph'?state.rate:0);
  assert.match(tip.unit,annual?/year/:/term/);
  for(const v of variants){
   const row=tip.rows.find(row=>row.kind===v.kind);
   close(row.value,result[v.key].adjusted*(annual?12/result[v.key].months:1));
   assert.match(row.note,/Full-term/);assert.ok(row.note.includes(money(result[v.key].adjusted)));
  }
 }
 // Exclusions and a sub-year term use that term, not the main period or a rounded number of years.
 app.form.write({...defaults,months:6,normalEnabled:false,leaseEnabled:false});app.update();
 toggle('annual','cost',true);
 const expected=calculate({...defaults,months:6,normalEnabled:false,leaseEnabled:false});
 assert.equal(amount(rows('costRows').find(row=>row.label==='Total economic cost').cells.cash),Math.round(expected.cashPurchase.adjusted*2));
});


test('resale sensitivity shows shared terms once and custom terms only for split options',()=>{
 const selected=()=>elements.sensitivity.innerHTML.match(/<tr class="selected [^"]*">([\s\S]*?)<\/tr>/)[1];
 const cell=(row,kind)=>row.match(new RegExp('<td data-option="'+kind+'">([\\s\\S]*?)<\\/td>'))[1];
 app.form.write({...defaults,months:72,resale:240000});app.update();
 for(const annual of [true,false])for(const inflation of [true,false]){
  toggle('annual','resale',annual);toggle('inflation','resale',inflation);
  const row=selected();
  assert.ok(row.startsWith('<th scope="row">'+money(240000)));
  assert.equal(elements.resaleColumnTerm.textContent,'at month 72');
  assert.ok(!row.includes('Month 72'));
  for(const v of variants){
   assert.ok(!cell(row,v.kind).includes('<small>'));
   assert.equal(elements['resaleCostBasis-'+v.kind].textContent,annual?'Ownership cost / year':'Ownership cost over full term');
  }
 }
 app.form.write({...input,balloonMatchPeriod:true});app.update();
 let row=selected();
 assert.equal(elements.resaleColumnTerm.textContent,'shared term: month 30');
 assert.ok(!row.includes('Shared term'));
 assert.ok(!cell(row,'balloon').includes('<small>'));
 for(const v of variants.slice(1))assert.ok(cell(row,v.kind).includes('<small>Month '+input[v.months]+'</small>'));
 assert.ok(!row.includes('Full resale:'));
 app.form.write(input);app.update();row=selected();
 assert.equal(elements.resaleColumnTerm.textContent,'');
 assert.ok(!row.includes('Shared term'));
 for(const v of variants)assert.ok(cell(row,v.kind).includes('<small>Month '+input[v.months]+'</small>'));
});

test('table explanations distinguish full resale prices, annual costs and same-month lease VAT',()=>{
 const node=text=>Object.assign(context.document.createElement('span'),{textContent:text});
 const resaleHeader=node('Full resale price at month 36');
 resaleHeader.querySelector=selector=>selector==='#resaleColumnLabel'?elements.resaleColumnLabel:null;
 const costHeader=elements.costPeriodHeading,opportunityHeader=elements.opportunityPeriodHeading;
 const labels=['Initial lease payment VAT','VAT on regular lease invoices'];
 const vatHeadings=labels.map(node),vatCells=labels.map(()=>Object.assign(node('1 Kč'),{dataset:{option:'lease'}}));
 const vatRows=vatHeadings.map((heading,i)=>({querySelector:()=>heading,querySelectorAll:()=>[vatCells[i]]}));
 const bodies=[['sensitivity',[resaleHeader]],['costRows',[costHeader]],['opportunityRows',[opportunityHeader]]];
 const originals=bodies.map(([id])=>[elements[id],elements[id].closest]);
 const originalVatRows=elements.vatTimeline.querySelectorAll;
 try{
  for(const [id,headers] of bodies)elements[id].closest=()=>({querySelectorAll:()=>headers});
  elements.vatTimeline.querySelectorAll=()=>vatRows;
  app.form.write({...defaults,kintoInitial:10000});
  for(const annual of [false,true]){
   app.views.annualViews.cost=annual;app.views.annualViews.opportunityBreakdown=annual;
   app.views.annualViews.resale=annual;app.views.inflationViews.resale=annual;
   app.update();
   assert.match(resaleHeader.dataset.explanation,/Full nominal Kč including VAT/);
   assert.match(resaleHeader.dataset.explanation,/not these resale prices/);
   assert.doesNotMatch(resaleHeader.dataset.explanation,/Costs for the selected option/);
   assert.match(costHeader.dataset.explanation,annual?/divided by that option’s ownership years/:/Components of ownership cost/);
   assert.match(opportunityHeader.dataset.explanation,annual?/annual allocations of foregone return/:/Timing effects of payments/);
   assert.match(vatHeadings[0].dataset.explanation,/month zero/);
   assert.match(vatHeadings[1].dataset.explanation,/same invoice month/);
   assert.doesNotMatch(vatCells.map(cell=>cell.dataset.explanation).join(' '),/refund delay/);
  }
  app.form.write(input);app.update();
  assert.match(resaleHeader.dataset.explanation,/Amount added to every option/);
  for(const pastOwnership of [false,true]){
   app.form.write({...defaults,pastOwnership});app.update();
   assert.match(elements.heatmapHint.textContent,/Compare per year/);
   assert.doesNotMatch(elements.heatmapHint.textContent,/compared per month/);
  }
 }finally{
  for(const [body,closest] of originals)body.closest=closest;
  elements.vatTimeline.querySelectorAll=originalVatRows;
 }
});
