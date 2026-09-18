import assert from 'node:assert/strict';
import vm from 'node:vm';
import {defaults,variants,relativeResaleEstimate,nominalOpportunityRate,calculate,resaleComparisons,interestComparisons,migrateInputs,comparisonValue,hasDifferentPeriods} from '../src/model.mjs';
// Component tests mutate their harness, so the stateful UI suite loads an isolated module instance.
import {html,ids,elements,saved,context} from './ui-harness.mjs?ui-suite';

// Keep the existing full-term regression expectations explicit; annual views have their own suite.
for(const key of Object.keys(context.__testApp.views.annualViews)){elements['annual-'+key].checked=false;elements['annual-'+key].listeners.change();}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
const clean={...defaults,price:1210000,resale:605000,serviceCost:0,tyrePurchase:0,tyreResale:0,tyreVisitCost:0,tyreStorage:0,cashInsurance:0,cashExtra:0,opportunityRate:0,opportunityRateBasis:"nominal"};

// Run the actual standalone scripts against the page's element IDs.
assert.equal(new Set(ids).size,ids.length);
assert.equal(elements.error.hidden,true);
assert.ok(elements.cashTotal.textContent.includes('Kč'));
assert.equal(elements.scenarioSelect.children.length,1);
assert.equal(elements.scenarioSelect.value,'');
assert.equal(elements.carName.value,defaults.carName);
assert.ok(elements.scenarioSelect.children[0].textContent.endsWith('(example)'));
assert.equal(saved.has('car-financing-calculator.scenarios.v2'),false);

for(const id of ['monthlyRows','costRows','opportunityRows','vatTimeline','cashflow']) {
 const rows=[...elements[id].innerHTML.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
 for(const row of rows)if(!row[1].includes('colspan'))assert.equal((row[1].match(/<td/g)||[]).length,4,id);
}
assert.equal(elements.resalePairs,undefined);
assert.ok(!html.includes('Break-even for every pair'));
const breakEvenRows=[...elements.sensitivity.innerHTML.matchAll(/<tr class="[^"]*breakpoint[^"]*">([\s\S]*?)<\/tr>/g)];
assert.equal(breakEvenRows.length,3);
for(const row of breakEvenRows){
 assert.equal((row[1].match(/<td/g)||[]).length,5);
 assert.ok(row[1].includes('Break-even'));
}
elements.months.id='months';
elements.months.value='60';elements.inputs.listeners.input({target:elements.months});
assert.ok(elements.termLabel.textContent.startsWith('60 MONTHS'));
elements.months.value='13';elements.inputs.listeners.change({target:elements.months});
assert.equal(elements.months.value,'13');assert.equal(elements.error.hidden,true);
elements.months.value='30';elements.inputs.listeners.input({target:elements.months});
elements.rate.value='7.5';elements.normalRate.value='3.25';elements.cashInsurance.value='2800';
elements.inputs.listeners.input({target:elements.rate});
const snapshot=JSON.parse(saved.get('car-financing-calculator.scenarios.v2')).scenarios[0].inputs;
assert.equal(snapshot.rate,7.5);assert.equal(snapshot.normalRate,3.25);assert.equal(snapshot.cashInsurance,2800);assert.equal(snapshot.months,30);
elements.duplicateScenario.listeners.click();assert.equal(elements.scenarioSelect.children.length,3);
vm.runInContext('var migrated=decodeSettings(JSON.stringify({format:"car-financing-calculator",version:1,inputs:{months:48,rate:8,normalRate:4,invoiceVatDelay:1}}))',context);
assert.equal(context.migrated.cashInsurance,3700);assert.equal(context.migrated.rate,8);assert.equal(context.migrated.normalRate,4);
const roundtrip=vm.runInContext('decodeSettings(encodeSettings(read()))',context);
assert.equal(roundtrip.cashInsurance,2800);assert.equal(roundtrip.months,30);
assert.ok(!html.includes('src="./app.mjs"'));
console.log('PASS: cash purchase/sale and VAT timing, opportunity formula, independent rates, all six break-even pairs, four-column tables, month-based terms, persistence, duplication and JSON migration.');
const draftRoundtrip=vm.runInContext('decodeSettings(encodeSettings({...defaults,price:null,normalRate:0}))',context);
assert.equal(draftRoundtrip.price,null);assert.equal(draftRoundtrip.normalRate,0);
vm.runInContext('write({...defaults,price:null,normalRate:0});saveSettings(currentValidSettings())',context);
const draftCollection=vm.runInContext('decodeCollection(encodeCollection())',context);
assert.equal(draftCollection.scenarios.find(s=>s.id===draftCollection.activeId).inputs.price,null);
assert.equal(draftCollection.scenarios.find(s=>s.id===draftCollection.activeId).inputs.normalRate,0);
console.log('PASS: incomplete single-scenario and collection JSON preserve blanks and explicit zero.');
const expectedMoney=value=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:0}).format(Math.abs(value)<.5?0:value).replaceAll('\u00a0','\u202f')+' Kč';
for(const vatEnabled of [true,false]){
 vm.runInContext('write({...defaults,months:30,vatEnabled:'+vatEnabled+'});update()',context);
 const expected=calculate({...defaults,months:30,vatEnabled});
 const gross=calculate({...defaults,months:30,vatEnabled:false});
 for(const [prefix,key] of [['easy','balloonLoan'],['normal','standardLoan'],['kinto','lease'],['cash','cashPurchase']]){
  assert.equal(elements[prefix+'Annual'].textContent,expectedMoney(expected[key].adjusted*12/30)+' / year effective');
  assert.ok(elements[prefix+'Gross'].innerHTML.includes(expectedMoney(gross[key].adjusted)+' total'));
  assert.ok(elements[prefix+'Gross'].innerHTML.includes(expectedMoney(gross[key].adjusted*12/30)+' / year'));
  assert.ok(elements[prefix+'Gross'].innerHTML.includes(expectedMoney(gross[key].adjusted/30)+' / month'));
  assert.ok(elements[prefix+'VatBasis'].textContent.includes(vatEnabled?'net after VAT':'recovery off'));
 }
}
console.log('PASS: annual/monthly results and VAT comparison for all four options, including a 30-month term and VAT recovery off.');
for(const opportunityRate of [0,6]){
 vm.runInContext('write({...defaults,opportunityRate:'+opportunityRate+'});update()',context);
 const expected=calculate({...defaults,opportunityRate});
 const keys=['balloonLoan','standardLoan','lease','cashPurchase'];
 const rows=[...elements.versusRows.innerHTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
 assert.equal(rows.length,4);
 rows.forEach((row,i)=>{
  const cells=[...row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
  assert.equal(cells.length,4);
  cells.forEach((cell,j)=>{
   if(i===j){assert.ok(cell[1].includes('versus-diagonal'));return;}
   const difference=expected[keys[i]].adjusted-expected[keys[j]].adjusted;
   assert.ok(cell[1].includes(difference<0?'versus-less':'versus-more'));
   assert.ok(cell[2].includes(expectedMoney(Math.abs(difference))));
  });
 });
}
console.log('PASS: comparison matrix amounts and less/more directions with and without opportunity cost.');

// Golden totals retain previous assumptions except the deliberate fixed twice-yearly tyre schedule.
for(const [months,totals] of [[36,[717965.6381176563,716600.6524378423,589526.4150927464,713776.577185387]],[48,[867384.899904174,865535.1925029873,806816.284262893,861609.502437372]]]){
 const legacy={...defaults,months,opportunityRate:6};
 for(const v of variants){delete legacy[v.enabled];delete legacy[v.months];delete legacy[v.resale];}
 delete legacy.matchPeriods;delete legacy.opportunityRateBasis;delete legacy.inflationRate;
 const migrated=vm.runInContext('decodeSettings('+JSON.stringify(JSON.stringify({format:'car-financing-calculator',version:1,inputs:legacy}))+')',context);
 for(const [i,v] of variants.entries()){
  assert.equal(migrated[v.enabled],true);assert.equal(migrated[v.months],months);
  // The old 48-month fixture had six visits; the new schedule has eight.
  const visitCost=(defaults.tyreVisitCost+defaults.tyreStorage)/(1+defaults.vatPct/100);
  const oldVisits=Array.from({length:6},(_,index)=>visitCost*1.06**((months-index*months/6)/12)).reduce((a,b)=>a+b,0);
  const newVisits=Array.from({length:Math.ceil(months/6)},(_,index)=>visitCost*1.06**((months-index*6)/12)).reduce((a,b)=>a+b,0);
  near(calculate(migrated)[v.key].adjusted,totals[i]+(v.kind==='lease'?0:newVisits-oldVisits));
 }
}
const split={...defaults,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48,leaseMonths:36,cashMonths:60,balloonResale:1100000,normalResale:880000,leaseResale:1000000,cashResale:750000};
const splitCost=calculate(split);
// Every inclusion combination must agree across rankings, tables, solvers and graphs.
for(let mask=0;mask<16;mask++){
 const state={...defaults};variants.forEach((v,i)=>state[v.enabled]=Boolean(mask&(1<<i)));
 const active=variants.filter(v=>state[v.enabled]);
 vm.runInContext('write('+JSON.stringify(state)+');update()',context);
 assert.equal(elements.resultContent.hidden,!active.length);
 assert.equal(elements.graphContent.hidden,!active.length);
 if(!active.length)continue;
 assert.equal((elements.versusRows.innerHTML.match(/<tr>/g)||[]).length,active.length);
 assert.equal(resaleComparisons(state).length,active.length*(active.length-1)/2);
 for(const v of variants){
  for(const id of ['monthlyRows','costRows','opportunityRows','vatTimeline','cashflow','sensitivity','cashGraph','resaleGraph','monthlyGraph','returnGraph']){
   assert.equal(elements[id].innerHTML.includes('data-option="'+v.kind+'"'),state[v.enabled],id+' '+v.kind);
  }
 }
 assert.equal(interestComparisons(state).length,active.filter(v=>['balloon','normal'].includes(v.kind)).length*active.filter(v=>['lease','cash'].includes(v.kind)).length);
}
// Ignored variant inputs may remain incomplete without preventing other comparisons.
vm.runInContext('write({...defaults,balloonEnabled:false,rate:null,balloonPct:null});update()',context);
assert.equal(elements.error.hidden,true);
vm.runInContext('write({...defaults,balloonEnabled:true,rate:null});update()',context);
assert.equal(elements.error.hidden,false);
assert.ok(!html.includes('Resale needed to beat the lease'));
// Split values, inclusion choices and explicit blank values survive persistence.
const stored={...split,normalEnabled:false,normalRate:null,cashExtra:0};
vm.runInContext('write('+JSON.stringify(stored)+');saveSettings(currentValidSettings())',context);
const restored=vm.runInContext('decodeSettings(encodeSettings(readSettings()))',context);
for(const [key,value] of Object.entries(stored))assert.deepEqual(Array.isArray(value)?[...restored[key]]:restored[key],value,key);
vm.runInContext('write('+JSON.stringify(split)+');update()',context);
assert.ok(elements.versusBasis.textContent.includes('Full-term'));
assert.ok(elements.sensitivityBasis.textContent.includes('Full-term'));
for(const [prefix,key] of [['easy','balloonLoan'],['normal','standardLoan'],['kinto','lease'],['cash','cashPurchase']]){
 assert.equal(elements[prefix+'Annual'].textContent,expectedMoney(splitCost[key].adjusted*12/splitCost[key].months)+' / year effective');
}
elements['tab-results'].listeners.click();assert.equal(elements.inputs.hidden,true);assert.equal(elements.comparison.hidden,false);assert.equal(elements.graphs.hidden,true);
elements['tab-graphs'].listeners.click();assert.equal(elements.graphs.hidden,false);assert.equal(elements.comparison.hidden,true);
assert.equal(saved.get('car-financing-calculator.tab.v1'),'graphs');
elements['tab-graphs'].listeners.keydown({key:'Home',preventDefault(){}});assert.equal(elements.inputs.hidden,false);
const future=JSON.stringify({format:'car-financing-calculator',version:99});
saved.set('car-financing-calculator.scenarios.v2',future);
vm.runInContext('restoreSettings();persistCollection()',context);
assert.equal(saved.get('car-financing-calculator.scenarios.v2'),future);
assert.throws(()=>vm.runInContext('decodeSettings('+JSON.stringify(future)+')',context));
console.log('PASS: legacy golden totals, independent periods and resale, VAT beyond each term, all inclusion combinations, interest matching and boundary cases, split-model roundtrip, tabs and preservation of unsupported saved data.');

// Keeping an outright purchase preserves its value as an asset, not cash sale proceeds.
for(const vatEnabled of [true,false]){
 const sold=calculate({...defaults,vatEnabled,loanEnd:'sell'}).cashPurchase;
 const kept=calculate({...defaults,vatEnabled,loanEnd:'keep'}).cashPurchase;
 near(kept.adjusted,sold.adjusted);
 near(kept.cashToEnd-sold.cashToEnd,kept.retainedValue);
 near(kept.retainedValue,(defaults.resale+defaults.tyreResale)/(vatEnabled?1.21:1));
 assert.equal(kept.events.find(e=>e.category==='resale').type,'asset');
 assert.ok(!kept.events.some(e=>e.category==='vat'&&e.amount>0&&e.type==='cash'));
 vm.runInContext('write({...defaults,vatEnabled:'+vatEnabled+',loanEnd:"keep"});update()',context);
 const saleRow=elements.vatTimeline.innerHTML.match(/<tr[^>]*><th scope="row">Gross car sale proceeds<\/th>(.*?)<\/tr>/)[1];
 assert.ok(saleRow.includes('<td data-option="cash">Car kept</td>'));
 assert.ok(!elements.vatTimeline.innerHTML.includes('VAT paid on car sale'));
 assert.ok(elements.vatTimeline.innerHTML.includes('Valuation only; no tax paid now'));
 assert.equal(elements.vatPanel.hidden,!vatEnabled);
}
console.log('PASS: non-lease keep applies to outright car and tyres, preserves economic cost, and updates cash and sale-VAT presentation.');

// Display grouping must not change calculations, decimals, zero, or exported numeric types.
vm.runInContext('write({...defaults});update()',context);
assert.equal(elements.price.value,'1\u202f334\u202f000');
assert.equal(elements.resale.value,'1\u202f000\u202f000');
elements.price.id='price';
elements.inputs.listeners.focusin({target:elements.price});assert.equal(elements.price.value,'1334000');
elements.price.value='1 210 000,50';elements.inputs.listeners.input({target:elements.price});
elements.inputs.listeners.focusout({target:elements.price});assert.equal(elements.price.value,'1\u202f210\u202f000.50');
const formattedState=vm.runInContext('decodeSettings(encodeSettings(readSettings()))',context);
assert.equal(formattedState.price,1210000.5);assert.equal(typeof formattedState.price,'number');
for(const text of ['10\u202f000','10\u00a0000','10\u2009000','10 000'])assert.equal(vm.runInContext('parseNumber('+JSON.stringify(text)+')',context),10000);
for(const text of ['','abc','1.2.3','0x10'])assert.ok(Number.isNaN(vm.runInContext('parseNumber('+JSON.stringify(text)+')',context)));
assert.equal(vm.runInContext('formatNumberInput("0")',context),'0');
assert.equal(vm.runInContext('formatNumberInput("5.990")',context),'5.990');
assert.equal(vm.runInContext('formatNumberInput("")',context),'');
assert.ok(!html.includes('class="important"'));
console.log('PASS: thin-space formatting, focus/blur editing, pasted grouping and decimal comma, numeric JSON export, blanks and zero.');

// Graphs consume the same VAT and period-aware costs as the result tables, without editing inputs.
for(const state of [defaults,{...split,vatEnabled:false}]){
 vm.runInContext('write('+JSON.stringify(state)+');update()',context);
 const expected=calculate(state),splitTerms=hasDifferentPeriods(state);
 for(const v of variants){
  const monthly=expectedMoney(expected[v.key].adjusted/expected[v.key].months);
  assert.ok(elements.monthlyGraph.innerHTML.includes(v.name+', Full cost, '+monthly+' per month'));
  assert.ok(elements.monthlyGraph.innerHTML.includes(expectedMoney(expected[v.key].adjusted)+' total'));
  assert.ok(elements.monthlyGraph.innerHTML.includes(expected[v.key].months+' months'));
  for(const opportunityRate of [0,state.opportunityRate]){
   const cost=calculate({...state,opportunityRate})[v.key];
   assert.ok(elements.returnGraph.innerHTML.includes(v.name+' · '+opportunityRate+'% annual return · after tax, '+(state.opportunityRateBasis==='real'?'after inflation':'before inflation')+' · '+expectedMoney(comparisonValue(cost,false))));
  }
  for(const rate of [0,12]){
   const cost=calculate({...state,rate,normalRate:rate})[v.key];
   assert.ok(elements.interestGraph.innerHTML.includes(v.name+' · '+rate+'% loan interest · '+expectedMoney(comparisonValue(cost,false))));
  }
 }
 assert.equal((elements.returnGraph.innerHTML.match(/r="4\.5"/g)||[]).length,4);
 assert.equal((elements.interestGraph.innerHTML.match(/r="4\.5"/g)||[]).length,2);
 const stateAfterGraphs=vm.runInContext('readSettings()',context);
 for(const [key,value] of Object.entries(state))assert.deepEqual(Array.isArray(value)?[...stateAfterGraphs[key]]:stateAfterGraphs[key],value,key);
}
vm.runInContext('write({...defaults,balloonEnabled:false,normalEnabled:false});update()',context);
assert.ok(elements.interestGraph.innerHTML.includes('Include a loan'));
assert.ok(!elements.interestGraph.innerHTML.includes('<svg'));
console.log('PASS: new graph values match VAT and split-period calculations, current-rate markers, variant filtering and unchanged scenario inputs.');

vm.runInContext('write({...defaults});update()',context);
const graphBars=[...elements.monthlyGraph.innerHTML.matchAll(/<rect[^>]+>/g)].map(match=>match[0]);
assert.equal(graphBars.length,8);
const widths=bars=>bars.map(bar=>Number(bar.match(/ width="([^"]+)"/)[1]));
const monthlyBars=graphBars.filter(bar=>bar.includes('per month'));
assert.equal(monthlyBars.length,8);
near(Math.max(...widths(monthlyBars)),550);
assert.ok(!elements.monthlyGraph.innerHTML.includes('Full-term ownership cost'));
assert.ok(!elements.monthlyGraph.innerHTML.includes('Total scale: 100%'));
vm.runInContext('write({...defaults,price:0,resale:0,easyInsurance:0,normalInsurance:0,cashInsurance:0,kintoMonthly:0,serviceCost:0,tyrePurchase:0,tyreResale:0,tyreVisitCost:0,tyreStorage:0});update()',context);
assert.ok(!elements.monthlyGraph.innerHTML.includes('NaN'));
assert.ok(!elements.monthlyGraph.innerHTML.includes('Infinity'));
console.log('PASS: two monthly bars per option, one shared percentage scale and zero-cost handling.');

// Shared hover values preserve every series, including overlaps and staggered cash events.
vm.runInContext('write({...defaults});update()',context);
const returnTooltip=vm.runInContext("graphTooltipValues(chartData.get('opportunity-return-sensitivity'),defaults.opportunityRate)",context);
assert.equal(returnTooltip.rows.length,4);
for(const [index,variant] of variants.entries())near(returnTooltip.rows[index].value,calculate(defaults)[variant.key].adjusted);
const barTooltip=vm.runInContext("graphTooltipValues(chartData.get('monthly-costs'),0)",context);
assert.equal(barTooltip.rows.length,3);
near(barTooltip.rows[1].value,calculate(defaults).balloonLoan.adjusted/defaults.months);
near(barTooltip.rows[2].value,calculate(defaults).balloonLoan.adjusted);
const staggered=vm.runInContext(`graphTooltipValues({type:'line',step:true,yLabel:'Cash',series:[
 {name:'Short',kind:'balloon',points:[{x:0,y:100,label:'Month 0'},{x:2,y:200,label:'Month 2'}]},
 {name:'Long',kind:'cash',points:[{x:0,y:100,label:'Month 0'},{x:1.5,y:150,label:'Month 1.5'},{x:4,y:300,label:'Month 4'}]}
]},1.5)`,context);
assert.equal(staggered.rows[0].value,100);
assert.equal(staggered.rows[1].value,150);
const ended=vm.runInContext(`graphTooltipValues({type:'line',step:true,yLabel:'Cash',series:[
 {name:'Short',kind:'balloon',points:[{x:0,y:100,label:'Month 0'},{x:2,y:200,label:'Month 2'}]},
 {name:'Long',kind:'cash',points:[{x:0,y:100,label:'Month 0'},{x:4,y:200,label:'Month 4'}]}
]},4)`,context);
assert.equal(ended.rows.length,2);
assert.equal(ended.rows[0].value,ended.rows[1].value);
assert.equal(ended.rows[0].note,'Final value · month 2');
vm.runInContext('write({...defaults,normalEnabled:false});update()',context);
assert.equal(vm.runInContext("graphTooltipValues(chartData.get('opportunity-return-sensitivity'),defaults.opportunityRate).rows.length",context),3);
console.log('PASS: shared tooltips include overlapping series, respect exclusions, show monthly and total costs, and use actual cash event timing.');

// A view switched off must match a zero-return calculation, without changing another view or the scenario.
const viewKeys=['summary','versus','monthly','interest','cost','resale','monthlyGraph','interestGraph','resaleGraph'];
function viewSnapshot(key){
 if(key==='summary')return JSON.stringify(['winner','saving','easyTotal','normalTotal','kintoTotal','cashTotal','easyAnnual','easyMonthly','easyGross'].map(id=>[elements[id].textContent,elements[id].innerHTML]));
 const table={versus:'versusRows',monthly:'monthlyRows',interest:'interestRows',cost:'costRows',resale:'sensitivity'}[key];
 if(table)return elements[table].innerHTML.replace('Opportunity cost (excluded)','Opportunity cost');
 const chart={monthlyGraph:'monthly-costs',interestGraph:'loan-interest-sensitivity',resaleGraph:'resale-sensitivity'}[key];
 return vm.runInContext(`JSON.stringify(chartPositions(chartData.get('${chart}')).map(x=>[x,graphTooltipValues(chartData.get('${chart}'),x).rows.map(row=>row.value)]))`,context);
}
function setView(key,enabled){elements['opportunity-'+key].checked=enabled;elements['opportunity-'+key].listeners.change();}
for(const state of [defaults,{...split,leaseEnd:'buyKeep',leaseBuyout:850000,purchaseVatDelay:5,leaseVatDelay:2,normalEnabled:false}]){
 vm.runInContext('write('+JSON.stringify({...state,opportunityRate:0,opportunityRateBasis:"nominal"})+');update()',context);
 const without=Object.fromEntries(viewKeys.map(key=>[key,viewSnapshot(key)]));
 vm.runInContext('write('+JSON.stringify(state)+');update()',context);
 const withCost=Object.fromEntries(viewKeys.map(key=>[key,viewSnapshot(key)]));
 const financialJSON=vm.runInContext('encodeSettings(readSettings())',context);
 const unchanged=['opportunityRows','vatTimeline','cashflow','cashGraph','returnGraph'];
 const originals=Object.fromEntries(unchanged.map(id=>[id,elements[id].innerHTML]));
 for(const key of viewKeys){
  setView(key,false);
  assert.equal(viewSnapshot(key),without[key],key+' excludes opportunity cost');
  for(const other of viewKeys.filter(other=>other!==key))assert.equal(viewSnapshot(other),withCost[other],key+' must not affect '+other);
  for(const id of unchanged)assert.equal(elements[id].innerHTML,originals[id],id+' remains unchanged');
  assert.equal(vm.runInContext('encodeSettings(readSettings())',context),financialJSON);
  assert.equal(JSON.parse(saved.get('car-financing-calculator.opportunity-views.v1'))[key],false);
  setView(key,true);
  assert.equal(viewSnapshot(key),withCost[key],key+' restores opportunity cost');
 }
}
// New, absent or invalid preferences retain the old include-opportunity behavior.
saved.set('car-financing-calculator.opportunity-views.v1',JSON.stringify({monthlyGraph:false,versus:false,cost:'invalid'}));
vm.runInContext('initializeOpportunityViews();update()',context);
assert.equal(elements['opportunity-monthlyGraph'].checked,false);
assert.equal(elements['opportunity-versus'].checked,false);
for(const key of viewKeys.filter(key=>!['monthlyGraph','versus'].includes(key)))assert.equal(elements['opportunity-'+key].checked,true);
saved.set('car-financing-calculator.opportunity-views.v1','broken');
vm.runInContext('initializeOpportunityViews();update()',context);
for(const key of viewKeys)assert.equal(elements['opportunity-'+key].checked,true);
console.log('PASS: independent opportunity toggles match zero-return results, rankings, break-even rates, resale crossings and graph values; VAT/cash views, scenario exports and defaults are preserved; preferences reload.');

// The visible cost components must reconcile independently of the financial model's totals.
function tableRows(id){return [...elements[id].innerHTML.matchAll(/<tr[^>]*><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/g)].map(m=>({label:m[1],cells:Object.fromEntries([...m[2].matchAll(/<td data-option="([^"]+)">(.*?)<\/td>/g)].map(cell=>[cell[1],cell[2]]))}));}
function cellAmount(text){const m=text.match(/(-?[\d\s\u202f\u00a0]+) Kč/);return m?Number(m[1].replace(/[\s\u202f\u00a0]/g,'')):0;}
for(const state of [defaults,{...split,loanEnd:'keep',leaseEnd:'buyKeep',leaseBuyout:850000,purchaseVatDelay:9,leaseVatDelay:5,recoveryPct:60},{...defaults,leaseEnd:'buySell',leaseBuyout:850000,vatEnabled:false},{...defaults,leaseEnabled:false},{...defaults,balloonEnabled:false,normalEnabled:false,cashEnabled:false,kintoInitial:0}]){
 vm.runInContext('write('+JSON.stringify(state)+');update()',context);
 const expected=calculate(state),rows=tableRows('costRows');
 const parts=rows.slice(0,rows.findIndex(row=>row.label==='Cost before opportunity'));
 for(const v of variants.filter(v=>state[v.enabled])){
  const sum=parts.reduce((total,row)=>total+cellAmount(row.cells[v.kind]),0);
  assert.ok(Math.abs(sum-expected[v.key].nominal)<=parts.length*.5,'Visible breakdown reconciles for '+v.kind);
  const cashRows=tableRows('cashflow');
  const hasAdjustments=variants.some(option=>state[option.enabled]&&(Math.abs(expected[option.key].retainedValue)>1e-8||Math.abs(expected[option.key].futureRefund)>1e-8));
  assert.equal(cashRows.some(row=>row.label==='Net cash spent through each term'),hasAdjustments);
  const reconciliation=hasAdjustments?['Net cash spent through each term','Less retained car and tyre value','Less VAT refunds due after each term']:['Economic cost before opportunity'];
  const cashSum=cashRows.filter(row=>reconciliation.includes(row.label)).reduce((total,row)=>total+cellAmount(row.cells[v.kind]),0);
  const endEvents=expected[v.key].events.filter(e=>e.type==='cash'&&Math.abs(e.month-expected[v.key].months)<1e-8);
  assert.equal(cellAmount(cashRows.find(row=>row.label==='Net cash flow at end').cells[v.kind]),Math.round(endEvents.reduce((total,e)=>total+e.amount,0)));
  if(v.kind!=='lease'||state.leaseEnd!=='return')assert.equal(cellAmount(cashRows.find(row=>row.label==='Car resale / retained value at end').cells[v.kind]),Math.round(expected[v.key].resale));
  assert.ok(Math.abs(cashSum-expected[v.key].nominal)<=1.5,'Cash reconciliation '+v.kind);
 }
 assert.ok(!elements.costRows.innerHTML.includes('Insurance incl. GAP'));
 assert.ok(!elements.interestRows.innerHTML.includes('No unique rate'));
 assert.equal(elements.vatPanel.hidden,!state.vatEnabled);
 if(!state.leaseEnabled){assert.ok(!elements.costRows.innerHTML.includes('Lease invoices + initial payment'));assert.ok(!elements.monthlyRows.innerHTML.includes('VAT refund per lease invoice'));}
}
vm.runInContext('write({...defaults,opportunityRate:0,opportunityRateBasis:"nominal",leaseVatDelay:4});update()',context);
assert.equal(tableRows('opportunityRows').length,1);
assert.ok(elements.monthlyRows.innerHTML.includes('Monthly bill after VAT deduction'));
assert.ok(elements.monthlyRows.innerHTML.includes('VAT deducted with each payment'));
assert.ok(!elements.vatTimeline.innerHTML.includes('VAT collected within sale price'));
assert.ok(!elements.vatTimeline.innerHTML.includes('Refunds outstanding at end of term'));
vm.runInContext('write({...defaults});update()',context);
assert.ok(!elements.vatTimeline.innerHTML.includes('Refunds outstanding at end of term'));
const cleanCash={...clean,balloonEnabled:false,normalEnabled:false,leaseEnabled:false};
vm.runInContext('write('+JSON.stringify(cleanCash)+');update()',context);
const cashSnapshots=tableRows('cashflow');
assert.equal(cellAmount(cashSnapshots.find(r=>r.label==='Net cash paid at start').cells.cash),1210000);
assert.equal(cellAmount(cashSnapshots.find(r=>r.label==='Net cash flow at end').cells.cash),-500000);
console.log('PASS: visible cost components and cash reconciliation, honest insurance and rate labels, zero/irrelevant rows omitted, delayed VAT labelling, and actual start/end cash snapshots.');

// The built-in example is separate from persistent user data and forks exactly once on an edit.
const collectionKey='car-financing-calculator.scenarios.v2';
const selectionKey='car-financing-calculator.selected-scenario.v1';
function chooseScenario(id){elements.scenarioSelect.value=id;elements.scenarioSelect.listeners.change();}
function editScenarioNumber(id,value){elements[id].id=id;elements[id].value=String(value);elements.inputs.listeners.input({target:elements[id]});}
function stateExpression(expression){return JSON.parse(vm.runInContext('JSON.stringify('+expression+')',context));}
saved.clear();vm.runInContext('restoreSettings()',context);
assert.equal(elements.scenarioSelect.value,'');assert.equal(elements.carName.value,defaults.carName);
const exampleExport=stateExpression('decodeCollection(encodeCollection())');
assert.equal(exampleExport.scenarios.length,1);assert.deepEqual(exampleExport.scenarios[0].inputs,defaults);
assert.equal(stateExpression('scenarios').length,0);
editScenarioNumber('price',1250000);
let userScenarios=stateExpression('scenarios');const firstCopy=userScenarios[0].id;
assert.equal(userScenarios.length,1);assert.equal(userScenarios[0].inputs.carName,defaults.carName);assert.equal(userScenarios[0].inputs.price,1250000);
assert.equal(elements.scenarioSelect.children.length,2);
editScenarioNumber('rate',4.5);assert.equal(stateExpression('scenarios').length,1);
chooseScenario('');assert.equal(elements.price.value,'1\u202f334\u202f000');assert.equal(elements.rate.value,'5.99');assert.equal(saved.get(selectionKey),'');
vm.runInContext('restoreSettings()',context);assert.equal(elements.scenarioSelect.value,'');
assert.equal(stateExpression('scenarios')[0].inputs.rate,4.5);
const allFromExample=stateExpression('decodeCollection(encodeCollection())');
assert.equal(allFromExample.activeId,firstCopy);assert.equal(allFromExample.scenarios.length,1);assert.equal(allFromExample.scenarios[0].inputs.price,1250000);
// Reset and leaving an untouched example must not create redundant copies.
elements.reset.listeners.click();assert.equal(stateExpression('scenarios').length,1);
chooseScenario(firstCopy);chooseScenario('');assert.equal(stateExpression('scenarios').length,1);
editScenarioNumber('price',1200000);
userScenarios=stateExpression('scenarios');assert.equal(userScenarios.length,2);assert.equal(userScenarios[1].inputs.carName,defaults.carName+' · variation');
chooseScenario('');elements.duplicateScenario.listeners.click();
assert.equal(stateExpression('scenarios').length,3);assert.ok(!elements.carName.value.includes('(example)'));
chooseScenario('');elements.clearAll.listeners.click();
assert.equal(stateExpression('scenarios').length,4);assert.equal(stateExpression('scenarios')[3].inputs.price,null);
chooseScenario('');assert.deepEqual(stateExpression('readSettings()'),defaults);
assert.deepEqual(stateExpression('exampleInputs'),defaults);
// Existing names and arbitrary nonempty IDs remain ordinary editable scenarios, even if they say example.
const existing={format:'car-financing-calculator',version:2,activeId:'example-snapshot',scenarios:[{id:'example-snapshot',inputs:{...defaults,carName:defaults.carName+' (example)',price:987654}}]};
saved.clear();saved.set(collectionKey,JSON.stringify(existing));vm.runInContext('restoreSettings()',context);
assert.equal(elements.scenarioSelect.value,'example-snapshot');assert.equal(elements.price.value,'987\u202f654');
editScenarioNumber('price',999999);assert.equal(stateExpression('scenarios').length,1);assert.equal(stateExpression('scenarios')[0].inputs.carName,existing.scenarios[0].inputs.carName);
chooseScenario('');assert.equal(elements.price.value,'1\u202f334\u202f000');
assert.equal(stateExpression('scenarios')[0].inputs.price,999999);
// Unsupported stored data must survive even when the user edits the available built-in example.
const unsupported=JSON.stringify({format:'car-financing-calculator',version:99});
saved.set(collectionKey,unsupported);vm.runInContext('restoreSettings()',context);editScenarioNumber('price',1111111);
assert.equal(saved.get(collectionKey),unsupported);assert.deepEqual(stateExpression('exampleInputs'),defaults);
console.log('PASS: permanent example, clean first-copy name, one fork per edit session, distinct variations, selection reload, reset/duplicate/clear, v2 exports, preserved existing examples and unsupported data.');

saved.clear();vm.runInContext('restoreSettings()',context);
const exportedExample=vm.runInContext('encodeSettings(readSettings())',context);
elements.importFile.files=[{size:exportedExample.length,text:async()=>exportedExample}];
await elements.importFile.listeners.change();
assert.equal(stateExpression('scenarios').length,1);assert.notEqual(elements.scenarioSelect.value,'');
assert.equal(stateExpression('scenarios')[0].inputs.carName,defaults.carName);
chooseScenario('');assert.deepEqual(stateExpression('readSettings()'),defaults);
const importedCollection=vm.runInContext('encodeCollection()',context);
elements.importFile.files=[{size:importedCollection.length,text:async()=>importedCollection}];
await elements.importFile.listeners.change();
assert.equal(stateExpression('scenarios').length,2);assert.ok(elements.carName.value.endsWith(' · imported'));
assert.deepEqual(stateExpression('exampleInputs'),defaults);
saved.clear();saved.set('car-financing-calculator.settings.v1',JSON.stringify({format:'car-financing-calculator',version:1,inputs:{...defaults,price:876543}}));
vm.runInContext('restoreSettings()',context);
assert.equal(stateExpression('scenarios').length,1);assert.equal(elements.price.value,'876\u202f543');
chooseScenario('');assert.equal(elements.price.value,'1\u202f334\u202f000');
console.log('PASS: importing example snapshots creates editable scenarios; collection reimport and legacy browser migration preserve the permanent example.');

// The UI uses nominal after-tax returns, while legacy real returns retain their economic meaning.
assert.ok(!html.includes('<select id="opportunityRateBasis"'));
assert.ok(html.includes('% p.a. after tax, before inflation'));
for(const rate of [0,6,10,100])for(const inflation of [0,2.5,100]){
 const original={...defaults,opportunityRate:rate,opportunityRateBasis:'real',inflationRate:inflation};
 vm.runInContext('write('+JSON.stringify(original)+');update()',context);
 const shown=stateExpression('readSettings()');assert.equal(shown.opportunityRateBasis,'nominal');
 near(shown.opportunityRate,nominalOpportunityRate(original));
 const before=calculate(original),after=calculate(shown);
 for(const v of variants){
  assert.ok(Math.abs(before[v.key].adjusted-after[v.key].adjusted)<Math.max(1e-6,Math.abs(before[v.key].adjusted)*1e-10));
  assert.deepEqual(before[v.key].events,after[v.key].events);
 }
 assert.equal(elements.opportunityRate.disabled,false);
 const roundtrip=stateExpression('decodeSettings(encodeSettings(readSettings()))');
 assert.equal(roundtrip.opportunityRateBasis,'nominal');near(roundtrip.opportunityRate,shown.opportunityRate);
}
vm.runInContext('write({...defaults});update()',context);
assert.ok(elements.returnConversion.textContent.includes('8.5% p.a. after tax, before inflation'));
assert.ok(!elements.inflationRate.disabled);
for(const key of viewKeys){
 setView(key,false);
 const state=vm.runInContext('viewInputs(read(),'+JSON.stringify(key)+')',context);
 for(const v of variants)near(calculate(state)[v.key].opportunity,0);
 setView(key,true);
}
elements.inflationRate.value='4';elements.inputs.listeners.change({type:'change',target:{id:'inflationRate'}});
assert.equal(stateExpression('readSettings()').inflationRate,4);
near(calculate(stateExpression('readSettings()')).nominalReturn,8.5);
assert.equal(elements.opportunityRate.value,'8.5');
assert.ok(elements.returnGraph.innerHTML.includes('before inflation'));
// Keep an incomplete real-return draft intact, then convert only on the completed inflation edit.
vm.runInContext('write({...defaults,opportunityRate:6,opportunityRateBasis:"real",inflationRate:null});update()',context);
assert.equal(elements.opportunityRate.value,'6');assert.equal(elements.opportunityRate.disabled,true);assert.equal(elements.returnMigration.hidden,false);
let draft=stateExpression('decodeSettings(encodeSettings(readSettings()))');
assert.equal(draft.opportunityRateBasis,'real');assert.equal(draft.inflationRate,null);assert.equal(draft.opportunityRate,6);
elements.inflationRate.value='2';elements.inputs.listeners.input({type:'input',target:{id:'inflationRate'}});
assert.equal(elements.opportunityRate.value,'6');
elements.inflationRate.value='2.5';elements.inputs.listeners.change({type:'change',target:{id:'inflationRate'}});
assert.equal(elements.opportunityRate.value,'8.65');assert.equal(elements.opportunityRate.disabled,false);assert.equal(elements.returnMigration.hidden,true);
assert.equal(stateExpression('readSettings()').opportunityRateBasis,'nominal');
vm.runInContext('write({...defaults,opportunityRate:null,opportunityRateBasis:"real",inflationRate:null});update()',context);
draft=stateExpression('decodeSettings(encodeSettings(readSettings()))');
assert.equal(draft.opportunityRate,null);assert.equal(draft.inflationRate,null);assert.equal(draft.opportunityRateBasis,'nominal');
console.log('PASS: nominal 8.5% default, removed basis selector, preserved legacy nominal/real results and extremes, unchanged return when inflation changes, zero values and incomplete draft conversion.');

// Optional tax estimates affect dated cash flows, not loan invoices or VAT eligibility.
const taxState={...clean,months:30,incomeTaxEnabled:true,incomeTaxRate:30,cashDeductions:100000,cashTaxValue:200000};
const taxed=calculate(taxState);
const taxReturn=calculate({...taxState,opportunityRate:6}).cashPurchase;
vm.runInContext('write('+JSON.stringify(taxState)+');update()',context);
assert.equal(elements.incomeTaxSettings.hidden,false);
for(const v of variants)assert.equal(elements['tax-'+v.kind].hidden,false);
assert.equal(elements.saleTaxRateField.hidden,true);assert.equal(elements.leaseTaxValueField.hidden,true);
assert.equal(elements.cashTaxValueField.hidden,false);
assert.ok(elements.costRows.innerHTML.includes('Estimated tax savings during ownership'));
for(const key of viewKeys){
 setView(key,false);
 const off=calculate(vm.runInContext('viewInputs(read(),'+JSON.stringify(key)+')',context));
 near(off.cashPurchase.opportunity,0);near(off.cashPurchase.saleTax,90000);near(off.cashPurchase.taxSavings,30000);
 setView(key,true);
}
for(let i=0;i<variants.length;i++){
 const rows=tableRows('costRows'),parts=rows.slice(0,rows.findIndex(r=>r.label==='Cost before opportunity')).filter(r=>r.label!=='Cost before income-tax effects');
 assert.ok(Math.abs(parts.reduce((sum,r)=>sum+cellAmount(r.cells[variants[i].kind]),0)-taxed[variants[i].key].nominal)<parts.length);
}
elements.incomeTaxEnabled.checked=false;elements.inputs.listeners.change({target:{id:'incomeTaxEnabled'}});
assert.equal(elements.incomeTaxSettings.hidden,true);
for(const v of variants)assert.equal(elements['tax-'+v.kind].hidden,true);
assert.equal(elements.cashDeductions.value,'100\u202f000');assert.equal(elements.cashTaxValue.value,'200\u202f000');
assert.ok(!elements.costRows.innerHTML.includes('Estimated tax savings during ownership'));
vm.runInContext('restoreSettings()',context);assert.equal(elements.incomeTaxEnabled.checked,false);assert.equal(elements.cashDeductions.value,'100\u202f000');
elements.incomeTaxEnabled.checked=true;elements.inputs.listeners.change({target:{id:'incomeTaxEnabled'}});
assert.equal(elements['tax-cash'].hidden,false);assert.equal(elements.error.hidden,true);
const taxRoundtrip=stateExpression('decodeSettings(encodeSettings({...readSettings(),saleTaxRate:0,normalDeductions:null}))');
assert.equal(taxRoundtrip.incomeTaxEnabled,true);assert.equal(taxRoundtrip.saleTaxRate,0);assert.equal(taxRoundtrip.normalDeductions,null);assert.equal(taxRoundtrip.cashDeductions,100000);
console.log('PASS: optional tax savings and sale charges, VAT independence, annual cash-flow timing, zero/exempt sales, keep/buyout cases, resale crossings, result reconciliation, view toggles and hidden-input persistence.');

// The before-VAT presentation retains the same income-tax estimates.
vm.runInContext('write('+JSON.stringify({...taxState,opportunityRate:6})+');update()',context);
const withoutVatEvents=taxReturn.events.filter(e=>e.category!=='vat').reduce((sum,e)=>sum+e.amount*1.06**((30-e.month)/12),0);
assert.ok(elements.cashGross.innerHTML.includes(expectedMoney(withoutVatEvents)+' total'));
console.log('PASS: multiple tax-threshold resale crossings and before-VAT figures preserve the same income-tax estimates.');

// Each visible result and graph has independent inflation and opportunity switches.
function setInflation(key,enabled){elements['inflation-'+key].checked=enabled;elements['inflation-'+key].listeners.change();}
assert.ok(viewKeys.every(key=>!elements['inflation-'+key].checked));
vm.runInContext('write({...defaults});update()',context);
const originalInputs=vm.runInContext('encodeSettings(readSettings())',context);
const unchangedInflation=['opportunityRows','vatTimeline','cashflow','cashGraph','returnGraph'];
const originalViews=Object.fromEntries(viewKeys.map(key=>[key,viewSnapshot(key)]));
const unchangedValues=Object.fromEntries(unchangedInflation.map(id=>[id,elements[id].innerHTML]));
for(const key of viewKeys){
 setInflation(key,true);
 assert.ok(elements['inflation-'+key+'-note'].textContent.includes('2.5%'));
 assert.ok(elements['inflation-'+key+'-note'].textContent.includes('Estimated'));
 for(const other of viewKeys.filter(other=>other!==key))assert.equal(viewSnapshot(other),originalViews[other],key+' inflation must not affect '+other);
 for(const id of unchangedInflation)assert.equal(elements[id].innerHTML,unchangedValues[id]);
 for(const opportunity of [true,false]){
  setView(key,opportunity);
  const expected=calculate(defaults,{opportunity,todayMoney:true});
  if(key==='summary'){
   assert.equal(elements.cashTotal.textContent,expectedMoney(expected.cashPurchase.adjusted));
   assert.equal(elements.cashTotal.dataset.inflationEstimate,'true');
   assert.ok(elements.cashTotal.dataset.explanation.includes('2.5%'));
   const nominal=calculate(defaults,{opportunity});assert.ok(elements.cashTotal.dataset.explanation.includes(expectedMoney(nominal.cashPurchase.adjusted)));
  }
  if(key==='cost'){
   const rows=tableRows('costRows');
   assert.ok(rows.some(r=>r.label==="Inflation effect (already included)"));
   near(cellAmount(rows.find(r=>r.label==='Total economic cost').cells.cash),Math.round(expected.cashPurchase.adjusted));
  }
  if(key==='monthly')near(cellAmount(tableRows('monthlyRows').find(r=>r.label==='Effective monthly ownership cost').cells.cash),Math.round(expected.cashPurchase.adjusted/defaults.months));
  if(key.endsWith('Graph')){
   const chart={monthlyGraph:'monthly-costs',interestGraph:'loan-interest-sensitivity',resaleGraph:'resale-sensitivity'}[key];
   const position=key==='monthlyGraph'?0:key==='interestGraph'?defaults.rate:defaults.resale;
   const tooltip=vm.runInContext('graphTooltipValues(chartData.get('+JSON.stringify(chart)+'),'+position+')',context);
   assert.equal(vm.runInContext('chartData.get('+JSON.stringify(chart)+').inflationRate',context),2.5);
   if(key==='monthlyGraph')near(tooltip.rows[2].value,expected.balloonLoan.adjusted);
   else near(tooltip.rows[0].value,expected.balloonLoan.adjusted);
   assert.ok(tooltip.rows.every(row=>Number.isFinite(row.nominalValue)));
  }
 }
 setView(key,true);setInflation(key,false);
 assert.equal(viewSnapshot(key),originalViews[key]);
 assert.equal(vm.runInContext('encodeSettings(readSettings())',context),originalInputs);
}
setInflation('summary',true);setView('summary',false);
vm.runInContext('initializeInflationViews();initializeOpportunityViews();update()',context);
assert.equal(elements['inflation-summary'].checked,true);assert.equal(elements['opportunity-summary'].checked,false);
assert.equal(elements.cashTotal.dataset.inflationEstimate,'true');
setInflation('summary',false);setView('summary',true);
assert.equal(elements.cashTotal.dataset.inflationEstimate,'false');assert.equal(elements.cashTotal.dataset.explanation,undefined);
saved.delete('car-financing-calculator.inflation-views.v1');vm.runInContext('initializeInflationViews()',context);
assert.ok(viewKeys.every(key=>!elements['inflation-'+key].checked));
console.log('PASS: independent inflation/return valuation, delayed receipts, tax and split-term break-evens, estimated labels and nominal tooltip values, per-view isolation, default-off persistence and unchanged financial exports.');

// Repayment and ownership fields render the model's independent terms.
const longOwnership={...defaults,months:72,balloonMatchOwnership:false,normalMatchOwnership:false,balloonLoanMonths:36,normalLoanMonths:48};
const longResult=calculate(longOwnership);
const shortOwnership={...defaults,months:36,balloonMatchOwnership:false,normalMatchOwnership:false,balloonLoanMonths:72,normalLoanMonths:60};
vm.runInContext('write('+JSON.stringify(longOwnership)+');update()',context);
assert.equal(elements.balloonRepaymentSettings.hidden,false);assert.equal(elements.normalRepaymentSettings.hidden,false);
assert.match(elements.balloonLoanTermNote.textContent,/Repayments stop at month 36/);
assert.ok(tableRows('monthlyRows').some(r=>r.label==='Monthly bill after loan ends'));
assert.ok(tableRows('cashflow').some(r=>r.label==='Balloon paid / lease buyout'&&r.cells.balloon.includes('Month 36')));
near(vm.runInContext('chartData.get("monthly-costs").bills.balloonLoan',context),longResult.payment*36/72+defaults.easyInsurance);
assert.equal(vm.runInContext('chartData.get("monthly-costs").averageBills',context),true);
const longExport=stateExpression('decodeSettings(encodeSettings(readSettings()))');
assert.equal(longExport.balloonLoanMonths,36);assert.equal(longExport.normalLoanMonths,48);assert.equal(longExport.normalMatchOwnership,false);
const termDraft=stateExpression('decodeSettings(encodeSettings({...readSettings(),balloonLoanMonths:null,normalLoanMonths:0}))');
assert.equal(termDraft.balloonLoanMonths,null);assert.equal(termDraft.normalLoanMonths,0);
vm.runInContext('write({...readSettings(),balloonMatchOwnership:true});update()',context);
assert.equal(elements.balloonRepaymentSettings.hidden,true);assert.equal(elements.balloonLoanMonths.disabled,true);
assert.equal(stateExpression('readSettings()').balloonLoanMonths,36);
vm.runInContext('write('+JSON.stringify(shortOwnership)+');update()',context);
assert.ok(tableRows('cashflow').some(r=>r.label==='Remaining loan at comparison end'&&r.cells.normal.includes('Paid off on sale')));
for(const fixture of [longOwnership,shortOwnership,{...shortOwnership,loanEnd:'keep'}]){
 vm.runInContext('write('+JSON.stringify(fixture)+');update()',context);
 const expected=calculate(fixture);
 for(const v of variants){
  const rows=tableRows('costRows');
  const interestRow=rows.find(r=>r.label==='Financing interest');
  if(v.loanMonths)assert.ok(Math.abs(cellAmount(interestRow.cells[v.kind])-expected[v.key].loanInterest)<.51);
 }
}
console.log('PASS: independent repayment and ownership periods, earlier balloons, early-sale principal and accrued interest, kept-car debt, zero-rate and full-balloon boundaries, valuation modes, rate matching, monthly averages, migration and JSON drafts.');

// Retired tyre-visit inputs remain round-trippable but hidden.
for(const tyreVisits of [0,2,17,null]){
 const old={...defaults,months:48,tyreVisits};
 vm.runInContext('write('+JSON.stringify(old)+');update()',context);
 assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').tyreVisits,tyreVisits);
 assert.equal(elements.error.hidden,true);
}
assert.ok(html.includes('<input id="tyreVisits" type="hidden">'));
assert.ok(!html.includes('for="tyreVisits"'));
console.log('PASS: automatic twice-yearly seasonal costs, six-month timing, independent ownership periods and preserved retired JSON values.');

// Lease VAT settings belong to the lease card and retain hidden drafts across VAT toggles.
for(const vatEnabled of [true,false])for(const leaseEnabled of [true,false]){
 vm.runInContext('write({...defaults,vatEnabled:'+vatEnabled+',leaseEnabled:'+leaseEnabled+',leaseVatDelay:2,leaseTaxablePct:75});update()',context);
 for(const key of ['leaseTaxablePct']){
  assert.equal(elements[key+'Field'].hidden,!vatEnabled);
  assert.equal(elements[key].disabled,!vatEnabled||!leaseEnabled);
 }
 const savedVAT=stateExpression('decodeSettings(encodeSettings(readSettings()))');
 assert.equal(savedVAT.leaseVatDelay,2);assert.equal(savedVAT.leaseTaxablePct,75);
}
for(const settings of [{vatEnabled:false},{leaseEnabled:false}]){
 const draft={...defaults,...settings,leaseVatDelay:null,leaseTaxablePct:null};
 vm.runInContext('write('+JSON.stringify(draft)+');update()',context);
 assert.equal(elements.error.hidden,true);
 const savedDraft=stateExpression('decodeSettings(encodeSettings(readSettings()))');
 assert.equal(savedDraft.leaseVatDelay,null);assert.equal(savedDraft.leaseTaxablePct,null);
}
console.log('PASS: lease VAT visibility and disabling, preserved saved values and ignored hidden blanks.');

// Visible components reconcile with the independently calculated model totals.
const componentScenarios=[defaults,longOwnership,shortOwnership,{...shortOwnership,loanEnd:'keep'},
 {...split,incomeTaxEnabled:true,incomeTaxRate:25,balloonDeductions:200000,normalDeductions:150000,leaseDeductions:300000,cashDeductions:100000,leaseEnd:'buySell',leaseBuyout:800000,purchaseVatDelay:9,leaseVatDelay:5,kintoTyres:false,kintoMaintenance:false,kintoInsuranceIncluded:false},
 {...defaults,months:7,rate:0,normalRate:0,vatEnabled:false,loanEnd:'keep',leaseEnd:'buyKeep',leaseBuyout:800000}];
for(const input of [defaults,componentScenarios[4]])for(const todayMoney of [false,true]){
 vm.runInContext('write('+JSON.stringify(input)+');update()',context);setInflation('cost',todayMoney);
 const expected=calculate(input,{todayMoney}),rows=tableRows('costRows');
 const subtotalIndex=rows.findIndex(r=>r.label==='Cost before opportunity');
 const components=rows.slice(0,subtotalIndex).filter(r=>r.label!=='Cost before income-tax effects');
 for(const v of variants){
  const sum=components.reduce((total,row)=>total+cellAmount(row.cells[v.kind]),0);
  assert.ok(Math.abs(sum-expected[v.key].beforeOpportunity)<=components.length*.5);
  const inflation=rows.find(r=>r.label==="Inflation effect (already included)"||r.label==="Inflation adjustment (excluded)");
  assert.ok(rows.indexOf(inflation)>subtotalIndex);
  assert.equal(inflation.label,todayMoney?'Inflation effect (already included)':'Inflation adjustment (excluded)');
  near(cellAmount(inflation.cells[v.kind]),Math.round(expected[v.key].inflationAdjustment));
  if(v.kind!=='lease')near(cellAmount(rows.find(r=>r.label==='Vehicle purchase / buyout').cells[v.kind]),input.price);
  const credit=rows.find(r=>r.label==='Inflation benefit on deferred principal');
  near(cellAmount(credit.cells[v.kind]),Math.round(v.loanMonths&&todayMoney?expected[v.key].costComponents.purchase-input.price:0));
 }
}
setInflation('cost',false);
console.log('PASS: all cost components follow the inflation basis, principal/interest payment timing, tax and delayed VAT dates, unchanged totals and informational inflation-row reconciliation.');

const relativeInput={...defaults,resaleMode:'relative',historicalMatchPeriod:false,historicalNewPrice:1200000,historicalUsedPrice:1000000,historicalYears:3,historicalInflationPct:10,resale:765432};
const retention=1000000/(1200000*1.10),forecast=1334000*retention*1.025**3;
const relativeSplit={...relativeInput,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48,cashMonths:60,leaseMonths:36,leaseEnd:'buySell',leaseBuyout:800000};
vm.runInContext('write('+JSON.stringify(relativeInput)+');update()',context);
assert.equal(elements.directResaleField.hidden,true);assert.equal(elements.relativeResaleSettings.hidden,false);assert.equal(elements.resale.disabled,true);
assert.equal(elements.relativeResaleValue.textContent,expectedMoney(forecast));
let relativeSaved=stateExpression('decodeSettings(encodeSettings(readSettings()))');
assert.equal(relativeSaved.resale,765432);assert.equal(relativeSaved.resaleMode,'relative');assert.equal(relativeSaved.historicalInflationPct,10);
vm.runInContext('write({...readSettings(),resaleMode:"direct"});update()',context);
assert.equal(elements.relativeResaleSettings.hidden,true);assert.equal(elements.directResaleField.hidden,false);assert.equal(elements.resale.disabled,false);
assert.equal(stateExpression('readSettings()').historicalNewPrice,1200000);
near(vm.runInContext('calculate(read()).cashPurchase.resale',context),765432);
const relativeDraft={...relativeInput,historicalNewPrice:null,historicalInflationPct:null};
vm.runInContext('write('+JSON.stringify(relativeDraft)+');update()',context);
relativeSaved=stateExpression('decodeSettings(encodeSettings(readSettings()))');assert.equal(relativeSaved.historicalNewPrice,null);assert.equal(relativeSaved.historicalInflationPct,null);
assert.equal(elements.error.hidden,false);
vm.runInContext('write({...readSettings(),resaleMode:"direct"});update()',context);assert.equal(elements.error.hidden,true);
console.log('PASS: relative real depreciation, nominal inflation forecasts, separate horizons, direct-mode compatibility, sensitivity overrides, saved alternatives, zero values and incomplete drafts.');

// Entering relative mode with a deliberately cleared price must not trap navigation or prevent autosave.
vm.runInContext('write({...defaults,relativeResaleSeeded:true});update();saveSettings(readSettings())',context);
elements['resaleMode-relative'].checked=true;
vm.runInContext('handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"relative"}})',context);
assert.equal(elements.error.hidden,false);assert.equal(stateExpression('readSettings()').resaleMode,'relative');
assert.match(elements.storageStatus.textContent,/Incomplete scenario saved/);
const incompleteRelativeId=elements.scenarioSelect.value;
assert.ok(incompleteRelativeId);
assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').historicalNewPrice,0);
elements.scenarioSelect.value='';elements.scenarioSelect.listeners.change();
assert.equal(elements.scenarioSelect.value,'');assert.equal(elements.error.hidden,true);assert.equal(elements['resaleMode-direct'].checked,true);
elements.scenarioSelect.value=incompleteRelativeId;elements.scenarioSelect.listeners.change();
assert.equal(elements['resaleMode-relative'].checked,true);assert.equal(elements.error.hidden,false);
vm.runInContext('handleInput({type:"change",target:{id:"resaleMode-direct",name:"resaleMethod",checked:true,value:"direct"}})',context);
assert.equal(elements.error.hidden,true);assert.equal(elements.relativeResaleSettings.hidden,true);
console.log('PASS: visible exclusive mode choices and zero-price relative drafts allow autosave, export and scenario/mode switching.');

// First-use suggestions never replace an established historical estimate or an edited draft.
vm.runInContext('write({...defaults,price:1500000,resale:900000});update();handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"relative"}})',context);
let seeded=stateExpression('readSettings()');
assert.equal(seeded.historicalNewPrice,1500000);assert.equal(seeded.historicalUsedPrice,900000);assert.equal(seeded.historicalInflationPct,7.5);assert.equal(seeded.relativeResaleSeeded,true);assert.equal(elements.error.hidden,true);
vm.runInContext('write({...readSettings(),historicalNewPrice:null,historicalUsedPrice:0,historicalInflationPct:0});handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"direct"}});handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"relative"}})',context);
seeded=stateExpression('decodeSettings(encodeSettings(readSettings()))');assert.equal(seeded.historicalNewPrice,null);assert.equal(seeded.historicalUsedPrice,0);assert.equal(seeded.historicalInflationPct,0);
const oldHistorical={...defaults,resaleMode:'relative',historicalNewPrice:null,historicalUsedPrice:0};delete oldHistorical.relativeResaleSeeded;
assert.equal(migrateInputs(oldHistorical).relativeResaleSeeded,true);
const oldUnused={...defaults};delete oldUnused.relativeResaleSeeded;
assert.equal(migrateInputs(oldUnused).relativeResaleSeeded,false);
assert.equal(migrateInputs({...oldUnused,historicalNewPrice:1200000}).relativeResaleSeeded,true);
console.log('PASS: first-entry historical price suggestions, explicit zero/blank preservation and older relative scenario migration.');

assert.equal(elements['inflation-opportunityBreakdown'].checked,false);assert.equal(elements['inflation-vat'].checked,false);
const detailSettings={...defaults,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,balloonMonths:24,normalMonths:48,cashMonths:60,leaseMonths:36,leaseEnd:'buySell',leaseBuyout:800000,kintoInitial:12100,leaseVatDelay:2,kintoTyres:false};
vm.runInContext('write('+JSON.stringify(detailSettings)+');update()',context);
const nominalVatTable=elements.vatTimeline.innerHTML,unchangedCost=elements.costRows.innerHTML;
setInflation('opportunityBreakdown',true);
assert.equal(elements.vatTimeline.innerHTML,nominalVatTable);assert.equal(elements.costRows.innerHTML,unchangedCost);
const realDetail=calculate(detailSettings,{opportunity:true,todayMoney:true});
for(const v of variants)near(cellAmount(tableRows('opportunityRows').find(r=>r.label==='Total opportunity cost').cells[v.kind]),Math.round(realDetail[v.key].opportunity));
const opportunityTable=elements.opportunityRows.innerHTML;
setInflation('vat',true);
assert.equal(elements.opportunityRows.innerHTML,opportunityTable);assert.equal(elements.costRows.innerHTML,unchangedCost);
const actualVat=stateExpression('vatTableValues(read(),calculate(read()),true)'),nominalDetail=calculate(detailSettings);
const pv=(amount,month)=>amount/1.025**(month/12);
near(actualVat.balloonLoan.purchase,pv(nominalDetail.purchaseRefund,3));
near(actualVat.lease.buyout,pv(nominalDetail.buyoutRefund,39));
near(actualVat.lease.initial,pv(nominalDetail.leaseInitialVat,0));
near(actualVat.lease.regular,Array.from({length:36},(_,m)=>pv(nominalDetail.leaseVatPerPayment,m)).reduce((a,b)=>a+b,0)/36);
for(const v of variants){
 const o=nominalDetail[v.key];
 near(actualVat[v.key].grossSale,pv(o.resale,o.months));
 near(actualVat[v.key].saleVat,pv(o.carSaleVat,o.months));
 near(actualVat[v.key].maintenance,o.events.filter(e=>['maintenance','tyres'].includes(e.category)&&e.amount>0).reduce((sum,e)=>sum+pv(e.amount*21/121,e.month),0));
 near(actualVat[v.key].outstanding,-o.events.filter(e=>e.category==='vat'&&e.amount<0&&e.month>o.months).reduce((sum,e)=>sum+pv(e.amount,e.month),0));
}
near(cellAmount(tableRows('vatTimeline').find(r=>r.label==='Lease buyout VAT refund').cells.lease),Math.round(actualVat.lease.buyout));
const savedViews=JSON.parse(saved.get('car-financing-calculator.inflation-views.v1'));
assert.equal(savedViews.vat,true);assert.equal(savedViews.opportunityBreakdown,true);
assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').price,detailSettings.price);
setInflation('opportunityBreakdown',false);setInflation('vat',false);
assert.equal(elements.vatTimeline.innerHTML,nominalVatTable);
console.log('PASS: independent opportunity/VAT inflation views, dated VAT and buyout refunds, opportunity totals, unchanged other tables and browser preferences.');

for(const [age,inflation,seeded,expected] of [[4,0,false,10],[3,12,false,12],[3,0,true,0],[3,null,true,null]]){
 vm.runInContext('write({...defaults,historicalMatchPeriod:false,historicalMonths:'+(age*12)+',historicalInflationPct:'+inflation+',relativeResaleSeeded:'+seeded+'});handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"relative"}})',context);
 assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').historicalInflationPct,expected);
}
console.log('PASS: historical inflation suggestions use 2.5 times age and preserve saved values, explicit zero and blank drafts.');

// Matching controls preserve the separately saved custom historical age.
const linkedHistory={...relativeInput,historicalMatchPeriod:true,historicalMonths:24,months:60};
const oldAgeScenario={...relativeInput,historicalYears:4.5};delete oldAgeScenario.historicalMonths;delete oldAgeScenario.historicalMatchPeriod;
for(const years of [0,null]){
 const migrated=migrateInputs({...oldAgeScenario,historicalYears:years});
 assert.equal(migrated.historicalMonths,years);assert.equal(migrated.historicalYears,years);
 vm.runInContext('write('+JSON.stringify(migrated)+');update()',context);
 assert.equal(elements.error.hidden,false);
 assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').historicalMonths,years);
}
vm.runInContext('write('+JSON.stringify(linkedHistory)+');update()',context);
assert.equal(elements.historicalPeriodSettings.hidden,true);assert.equal(elements.historicalMonths.disabled,true);
vm.runInContext('write({...readSettings(),historicalMatchPeriod:false});update()',context);
assert.equal(elements.historicalPeriodSettings.hidden,false);assert.equal(elements.historicalMonths.disabled,false);
assert.equal(stateExpression('readSettings()').historicalMonths,24);
vm.runInContext('write({...readSettings(),historicalMonths:null,historicalMatchPeriod:true});update()',context);
assert.equal(elements.error.hidden,true);assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').historicalMonths,null);
console.log('PASS: month-based historical age, linked comparison horizon, preserved custom drafts and legacy year migration.');

vm.runInContext('write({...defaults,resaleMode:"relative",historicalNewPrice:340000,historicalUsedPrice:240000,historicalInflationPct:45.6});update()',context);
assert.equal(elements.historicalNewPriceToday.textContent,'In today’s money: '+expectedMoney(495040)+'.');
assert.equal(elements.historicalUsedPriceThen.textContent,'In purchase-time money: '+expectedMoney(240000/1.456)+'.');
vm.runInContext('write({...readSettings(),historicalInflationPct:0});update()',context);
assert.equal(elements.historicalNewPriceToday.textContent,'In today’s money: '+expectedMoney(340000)+'.');
assert.equal(elements.historicalUsedPriceThen.textContent,'In purchase-time money: '+expectedMoney(240000)+'.');
vm.runInContext('write({...readSettings(),historicalInflationPct:null});update()',context);
assert.equal(elements.historicalNewPriceToday.textContent,'');assert.equal(elements.historicalUsedPriceThen.textContent,'');
console.log('PASS: historical price descriptions convert both purchasing-power bases and clear incomplete inflation values.');

for(const [rate,inflation,expected] of [[8.5,2.5,'5.85%'],[6,0,'6%'],[0,2.5,'-2.44%'],[2.5,2.5,'0%']]){
 vm.runInContext('write({...defaults,opportunityRate:'+rate+',inflationRate:'+inflation+'});update()',context);
 assert.equal(elements.realReturnDescription.textContent,'Effective return after inflation: '+expected+' p.a. after tax.');
}
vm.runInContext('write({...defaults,inflationRate:null});update()',context);
assert.match(elements.realReturnDescription.textContent,/Enter return and inflation/);
vm.runInContext('write({...defaults,opportunityRateBasis:"real",opportunityRate:6,inflationRate:2.5});update()',context);
assert.match(elements.realReturnDescription.textContent,/6% p.a. after tax/);
console.log('PASS: effective after-inflation return description, zero/negative real returns, blanks and legacy real-rate conversion.');

// Rendered heatmap cells and charts use the same model values.
vm.runInContext('write('+JSON.stringify(relativeSplit)+');update()',context);
const financialBefore=stateExpression('encodeSettings(readSettings())');
for(const opportunity of [false,true])for(const todayMoney of [false,true]){
 setView('waterfallGraph',opportunity);setInflation('waterfallGraph',todayMoney);
 const cells=stateExpression('chartData.get("cost-waterfall").cells');
 const calculated=calculate(relativeSplit,{opportunity,todayMoney});
 for(const v of variants){
  const amounts=cells.slice(0,4).map(cell=>cell.values.rows.find(row=>row.kind===v.kind).value);
  near(amounts[0]+amounts[1]+amounts[2],amounts[3]);near(amounts[3],calculated[v.key].adjusted);
 }
}
const timeline=stateExpression('chartData.get("car-value-timeline")');
assert.equal(timeline.minX,-relativeSplit.historicalMonths);assert.equal(timeline.maxX,60);
for(const point of timeline.series[1].points)near(point.y,relativeResaleEstimate(relativeSplit,point.x).nominalValue);
for(const point of timeline.series[2].points)near(point.y,relativeResaleEstimate(relativeSplit,point.x).todayValue);
const historicalTooltip=stateExpression('graphTooltipValues(chartData.get("car-value-timeline"),-36)');
assert.equal(historicalTooltip.rows.length,2);near(historicalTooltip.rows[1].value,1320000);
const presentTooltip=stateExpression('graphTooltipValues(chartData.get("car-value-timeline"),0)');
assert.ok(presentTooltip.rows.some(row=>row.name.includes('historical')&&row.value===1000000));
for(const opportunity of [false,true])for(const todayMoney of [false,true]){
 setView('heatmapGraph',opportunity);setInflation('heatmapGraph',todayMoney);
 const data=stateExpression('chartData.get("inflation-return-map")');
 const cell=data.grid.find(cell=>cell.inflation===relativeSplit.inflationRate&&cell.rate===relativeSplit.opportunityRate);
 const expected=calculate(relativeSplit,{opportunity,todayMoney});
 for(const o of cell.costs)near(o.total,expected[o.key].adjusted);
 assert.equal(data.cells.length,data.inflations.length*data.returns.length);
}
assert.equal(stateExpression('encodeSettings(readSettings())'),financialBefore);
vm.runInContext('write({...defaults,normalEnabled:false,leaseEnabled:false,cashEnabled:false});update()',context);
assert.equal(vm.runInContext('chartData.has("car-value-timeline")',context),true);
assert.match(elements.timelineGraph.innerHTML,/Choose Relative depreciation/);
assert.equal(stateExpression('chartData.get("cost-waterfall").cells').length,4);
assert.ok(stateExpression('chartData.get("inflation-return-map").grid').every(cell=>cell.costs.length===1&&cell.leaders[0]==='balloonLoan'));
console.log('PASS: new waterfall reconciliation, historical/projected timeline, full-model heatmap parity, independent toggles, filtered options and unchanged saved scenarios.');


// Historical replay renders the model's derived inflation and exact resale.
const historicalReplay={...clean,pastOwnership:true,resaleMode:'relative',price:340000,historicalNewPrice:340000,historicalUsedPrice:240000,historicalInflationPct:45.6,months:72,historicalMatchPeriod:true,vatEnabled:false,inflationRate:2.5,inflationMode:'total',inflationTotalPct:45.6};
const independentReplay={...historicalReplay,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,historicalMatchPeriod:false,historicalMonths:84};
vm.runInContext('write('+JSON.stringify(historicalReplay)+');update()',context);
assert.equal(elements.error.hidden,true);
assert.equal(elements.inflationRate.hidden,false);assert.equal(elements.inflationRate.disabled,true);
assert.equal(elements.ownershipInflationOptions.hidden,false);assert.equal(elements.inflationTotalPct.disabled,false);
assert.equal(elements.historicalInflationSection.hidden,true);
assert.equal(elements.historicalSeparatePeriod.checked,false);
assert.equal(elements.historicalPeriodSettings.hidden,true);
assert.equal(elements.inflationTotalPct.value,'45.6');
assert.equal(elements.relativeResaleValue.textContent,expectedMoney(240000));
assert.match(elements.relativeResaleToday.textContent,/purchase-date money/);
assert.equal(elements.purchasePriceTitle.textContent,'Price paid at purchase');
assert.equal(elements.derivedResaleTitle.textContent,'Modelled end value');
assert.match(elements.timelineGraph.innerHTML,/Months since purchase/);
const replayRoundTrip=stateExpression('decodeSettings(encodeSettings(readSettings()))');
assert.equal(replayRoundTrip.pastOwnership,true);assert.equal(replayRoundTrip.inflationRate,2.5);
vm.runInContext('$("pastOwnership").checked=false;update()',context);
assert.equal(elements.inflationRate.hidden,false);assert.equal(elements.inflationRate.disabled,true);
assert.equal(elements.inflationTotalPct.value,'45.6');assert.equal(elements.purchasePriceTitle.textContent,'Purchase price');
vm.runInContext('write('+JSON.stringify({...historicalReplay,inflationTotalPct:null})+');update()',context);
assert.equal(elements.error.hidden,false);
assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').inflationTotalPct,null);
vm.runInContext('$("resaleMode").value="direct";update()',context);
assert.equal(elements.error.hidden,false);assert.equal(elements.inflationTotalPct.disabled,false);
vm.runInContext('write('+JSON.stringify(historicalReplay)+');update()',context);
for(const cell of stateExpression('chartData.get("inflation-return-map").grid'))for(const option of cell.costs)near(option.resale,240000);
console.log('PASS: historical ownership replay, exact resale, purchase-date costs, editable main inflation, preserved main source, saved modes and incomplete drafts.');

vm.runInContext('write('+JSON.stringify(independentReplay)+');update()',context);
assert.equal(elements.relativeResaleValue.textContent,expectedMoney(relativeResaleEstimate(independentReplay).nominalValue));
assert.equal(elements.historicalPeriodSettings.hidden,false);assert.equal(elements.historicalMonths.disabled,false);
assert.equal(elements.historicalInflationLinkedNote.hidden,false);
assert.equal(stateExpression('decodeSettings(encodeSettings(readSettings()))').historicalMonths,84);
assert.equal(stateExpression('readSettings()').historicalMatchPeriod,false);
vm.runInContext('$("pastOwnership").checked=false;update()',context);
assert.equal(elements.historicalSeparatePeriod.checked,true);
assert.equal(elements.historicalPeriodSettings.hidden,false);
assert.equal(elements.historicalMonths.value,'84');
console.log('PASS: unmatched past ownership permits a separate comparable age and derives its cumulative inflation from the main rate.');

vm.runInContext('write({...defaults,pastOwnership:true,historicalMatchPeriod:false,historicalMonths:84,months:72});handleInput({type:"change",target:{id:"resaleMode-relative",name:"resaleMethod",checked:true,value:"relative"}})',context);
assert.equal(stateExpression('readSettings()').historicalInflationPct,0);
assert.equal(stateExpression('readSettings()').historicalMonths,84);
