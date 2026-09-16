import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {defaults,variants,calculate,resaleComparisons,interestComparisons,migrateInputs,withResale,comparisonValue,hasDifferentPeriods} from './src/model.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6, a+' != '+b);
const base=calculate(defaults);
const clean={...defaults,price:1210000,resale:605000,serviceCost:0,tyrePurchase:0,tyreResale:0,tyreVisitCost:0,tyreStorage:0,cashInsurance:0,cashExtra:0,opportunityRate:0};
let c=calculate(clean).cashPurchase;
near(c.nominal,500000);
assert.deepEqual(c.events.filter(e=>e.category==='capital'),[{month:0,amount:1210000,category:'capital',type:'cash'}]);
assert.equal(c.events.filter(e=>e.category==='repayment').length,0);
assert.ok(c.events.some(e=>e.month===3&&e.category==='vat'&&Math.abs(e.amount+210000)<1e-6));
assert.ok(c.events.some(e=>e.month===36&&e.category==='vat'&&Math.abs(e.amount-105000)<1e-6));
c=calculate({...clean,opportunityRate:6}).cashPurchase;
near(c.opportunity,1210000*(1.06**3-1)-210000*(1.06**(33/12)-1));
near(c.adjusted,c.nominal+Object.values(c.opportunityBreakdown).reduce((a,b)=>a+b,0));
near(calculate({...clean,vatEnabled:false}).cashPurchase.nominal,605000);
near(calculate({...clean,loanEnd:'keep'}).cashPurchase.retainedValue,500000);
assert.equal(calculate({...clean,months:60}).cashPurchase.events.find(e=>e.category==='resale').month,60);
near(calculate({...clean,months:2}).cashPurchase.futureRefund,210000);
near(calculate({...defaults,rate:8}).standardLoan.adjusted,base.standardLoan.adjusted);
near(calculate({...defaults,normalRate:8}).balloonLoan.adjusted,base.balloonLoan.adjusted);
assert.ok(calculate({...defaults,rate:8}).interest>base.interest);
assert.ok(calculate({...defaults,normalRate:8}).normalInterest>base.normalInterest);
for(const s of [defaults,{...defaults,leaseEnd:'buySell',leaseBuyout:900000},{...defaults,opportunityRate:0,vatEnabled:false},{...defaults,rate:8,normalRate:3}]){
 const pairs=resaleComparisons(s);assert.equal(pairs.length,6);
 for(const p of pairs){
  if(p.resale!==null){
   const at=calculate({...s,resale:p.resale});near(at[p.left].adjusted,at[p.right].adjusted);
   const above=calculate({...s,resale:p.resale+10000});
   assert.ok(above[p.cheaperAbove].adjusted<above[p.cheaperAbove===p.left?p.right:p.left].adjusted);
  }
 }
}
// Run the actual standalone scripts against the page's element IDs.
const html=fs.readFileSync(new URL('./car-financing-calculator.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
function element(){
 let value='';
 return {get value(){return value},set value(v){value=String(v)},checked:false,hidden:false,textContent:'',innerHTML:'',dataset:{},listeners:{},children:[],
 closest(){return null},querySelectorAll(){return []},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn},replaceChildren(){this.children=[]},appendChild(e){this.children.push(e)},focus(){},select(){},click(){},remove(){}};
}
const elements=Object.fromEntries(ids.map(id=>[id,element()]));
const saved=new Map();
const context=vm.createContext({console,Intl,Math,Date,JSON,Number,Object,Set,Error,AbortController,URL,Blob,setTimeout,
 document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){},getElementById(id){assert.ok(elements[id],'Missing element '+id);return elements[id]},documentElement:{dataset:{}},createElement:element,body:element()},
 localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
 window:{matchMedia:()=>({matches:false}),addEventListener(){}}
});
for(const script of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],context);
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

// Golden totals from the previous release protect old saved scenarios from changed assumptions.
for(const [months,totals] of [[36,[717965.6381176563,716600.6524378423,589526.4150927464,713776.577185387]],[48,[867384.899904174,865535.1925029873,806816.284262893,861609.502437372]]]){
 const legacy={...defaults,months};
 for(const v of variants){delete legacy[v.enabled];delete legacy[v.months];delete legacy[v.resale];}
 delete legacy.matchPeriods;
 const migrated=vm.runInContext('decodeSettings('+JSON.stringify(JSON.stringify({format:'car-financing-calculator',version:1,inputs:legacy}))+')',context);
 for(const [i,v] of variants.entries()){
  assert.equal(migrated[v.enabled],true);assert.equal(migrated[v.months],months);
  near(calculate(migrated)[v.key].adjusted,totals[i]);
 }
}
// Each split option must agree with an independent single-term calculation.
const split={...defaults,matchPeriods:false,balloonMonths:24,normalMonths:48,leaseMonths:36,cashMonths:60,balloonResale:1100000,normalResale:880000,leaseResale:1000000,cashResale:750000};
const splitCost=calculate(split);
assert.equal(hasDifferentPeriods(split),true);
for(const v of variants){
 const months=split[v.months],result=splitCost[v.key];
 const reference=calculate({...defaults,months,resale:split[v.resale],tyreVisits:Math.ceil(defaults.tyreVisits*months/defaults.months)})[v.key];
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
// Solver results must actually match their targets when used as input.
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
assert.ok(interestComparisons({...defaults,opportunityRate:0,rate:0,normalRate:0}).filter(p=>p.target==='cashPurchase').every(p=>p.rate===0));
assert.ok(!html.includes('Resale needed to beat the lease'));
// Split values, inclusion choices and explicit blank values survive persistence.
const stored={...split,normalEnabled:false,normalRate:null,cashExtra:0};
vm.runInContext('write('+JSON.stringify(stored)+');saveSettings(currentValidSettings())',context);
const restored=vm.runInContext('decodeSettings(encodeSettings(readSettings()))',context);
for(const [key,value] of Object.entries(stored))assert.equal(restored[key],value,key);
vm.runInContext('write('+JSON.stringify(split)+');update()',context);
assert.ok(elements.versusBasis.textContent.includes('monthly'));
assert.ok(elements.sensitivityBasis.textContent.includes('Monthly'));
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
  for(const opportunityRate of [0,6,12]){
   const cost=calculate({...state,opportunityRate})[v.key];
   assert.ok(elements.returnGraph.innerHTML.includes(v.name+' · '+opportunityRate+'% annual return · '+expectedMoney(comparisonValue(cost,splitTerms))));
  }
  for(const rate of [0,12]){
   const cost=calculate({...state,rate,normalRate:rate})[v.key];
   assert.ok(elements.interestGraph.innerHTML.includes(v.name+' · '+rate+'% loan interest · '+expectedMoney(comparisonValue(cost,splitTerms))));
  }
 }
 assert.equal((elements.returnGraph.innerHTML.match(/r="4\.5"/g)||[]).length,4);
 assert.equal((elements.interestGraph.innerHTML.match(/r="4\.5"/g)||[]).length,2);
 const stateAfterGraphs=vm.runInContext('readSettings()',context);
 for(const [key,value] of Object.entries(state))assert.equal(stateAfterGraphs[key],value,key);
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
const returnTooltip=vm.runInContext("graphTooltipValues(chartData.get('opportunity-return-sensitivity'),6)",context);
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
assert.equal(vm.runInContext("graphTooltipValues(chartData.get('opportunity-return-sensitivity'),6).rows.length",context),3);
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
 vm.runInContext('write('+JSON.stringify({...state,opportunityRate:0})+');update()',context);
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
  const cashSum=cashRows.filter(row=>['Net cash spent through each term','Less retained car and tyre value','Less VAT refunds due after each term'].includes(row.label)).reduce((total,row)=>total+cellAmount(row.cells[v.kind]),0);
  assert.ok(Math.abs(cashSum-expected[v.key].nominal)<=1.5,'Cash reconciliation '+v.kind);
 }
 assert.ok(!elements.costRows.innerHTML.includes('Insurance incl. GAP'));
 assert.ok(!elements.interestRows.innerHTML.includes('No unique rate'));
 assert.equal(elements.vatPanel.hidden,!state.vatEnabled);
 if(!state.leaseEnabled){assert.ok(!elements.costRows.innerHTML.includes('Lease invoices + initial payment'));assert.ok(!elements.monthlyRows.innerHTML.includes('VAT refund per lease invoice'));}
}
vm.runInContext('write({...defaults,opportunityRate:0,leaseVatDelay:4});update()',context);
assert.equal(tableRows('opportunityRows').length,1);
assert.ok(elements.monthlyRows.innerHTML.includes('Monthly bill less eventual VAT refund'));
assert.ok(elements.monthlyRows.innerHTML.includes('Refund 4 months after invoice'));
assert.ok(!elements.vatTimeline.innerHTML.includes('VAT collected within sale price'));
assert.ok(elements.vatTimeline.innerHTML.includes('Refunds outstanding at end of term'));
vm.runInContext('write({...defaults});update()',context);
assert.ok(!elements.vatTimeline.innerHTML.includes('Refunds outstanding at end of term'));
const cleanCash={...clean,balloonEnabled:false,normalEnabled:false,leaseEnabled:false};
vm.runInContext('write('+JSON.stringify(cleanCash)+');update()',context);
const cashSnapshots=tableRows('cashflow');
assert.equal(cellAmount(cashSnapshots.find(r=>r.label==='Net cash paid at start').cells.cash),1210000);
assert.equal(cellAmount(cashSnapshots.find(r=>r.label==='Net cash paid at end date').cells.cash),-500000);
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
