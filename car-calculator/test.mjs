import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {defaults,calculate,resaleComparisons} from './src/model.mjs';
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
near(calculate({...clean,loanEnd:'keep'}).cashPurchase.retainedValue,0);
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
 setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn},replaceChildren(){this.children=[]},appendChild(e){this.children.push(e)},focus(){},select(){},click(){},remove(){}};
}
const elements=Object.fromEntries(ids.map(id=>[id,element()]));
const saved=new Map();
const context=vm.createContext({console,Intl,Math,Date,JSON,Number,Object,Set,Error,AbortController,URL,Blob,setTimeout,
 document:{querySelectorAll(){return []},addEventListener(){},getElementById(id){assert.ok(elements[id],'Missing element '+id);return elements[id]},documentElement:{dataset:{}},createElement:element,body:element()},
 localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
 window:{matchMedia:()=>({matches:false}),addEventListener(){}}
});
for(const script of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],context);
assert.equal(elements.error.hidden,true);
assert.ok(elements.cashTotal.textContent.includes('Kč'));
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
elements.ownershipYears.value='5';elements.inputs.listeners.input({target:elements.ownershipYears,id:'unused'});
// Real events identify their source by its DOM id.
elements.ownershipYears.id='ownershipYears';elements.months.id='months';
elements.inputs.listeners.input({target:elements.ownershipYears});
assert.equal(elements.months.value,'60');assert.ok(elements.termLabel.textContent.startsWith('60 MONTHS'));
elements.months.value='30';elements.inputs.listeners.input({target:elements.months});assert.equal(elements.ownershipYears.value,'2.5');
elements.months.value='13';elements.inputs.listeners.input({target:elements.months});
elements.inputs.listeners.change({target:elements.ownershipYears});assert.equal(elements.months.value,'13');assert.equal(elements.error.hidden,true);
elements.months.value='30';elements.inputs.listeners.input({target:elements.months});
elements.rate.value='7.5';elements.normalRate.value='3.25';elements.cashInsurance.value='2800';
elements.inputs.listeners.input({target:elements.rate});
const snapshot=JSON.parse(saved.get('car-financing-calculator.scenarios.v2')).scenarios[0].inputs;
assert.equal(snapshot.rate,7.5);assert.equal(snapshot.normalRate,3.25);assert.equal(snapshot.cashInsurance,2800);assert.equal(snapshot.months,30);
elements.duplicateScenario.listeners.click();assert.equal(elements.scenarioSelect.children.length,2);
vm.runInContext('var migrated=decodeSettings(JSON.stringify({format:"car-financing-calculator",version:1,inputs:{months:48,rate:8,normalRate:4,invoiceVatDelay:1}}))',context);
assert.equal(context.migrated.cashInsurance,3700);assert.equal(context.migrated.rate,8);assert.equal(context.migrated.normalRate,4);
const roundtrip=vm.runInContext('decodeSettings(encodeSettings(read()))',context);
assert.equal(roundtrip.cashInsurance,2800);assert.equal(roundtrip.months,30);
assert.ok(!html.includes('src="./app.mjs"'));
console.log('PASS: cash purchase/sale and VAT timing, opportunity formula, independent rates, all six break-even pairs, four-column tables, years/months sync, persistence, duplication and JSON migration.');
const draftRoundtrip=vm.runInContext('decodeSettings(encodeSettings({...defaults,price:null,normalRate:0}))',context);
assert.equal(draftRoundtrip.price,null);assert.equal(draftRoundtrip.normalRate,0);
vm.runInContext('write({...defaults,price:null,normalRate:0});saveSettings(currentValidSettings())',context);
const draftCollection=vm.runInContext('decodeCollection(encodeCollection())',context);
assert.equal(draftCollection.scenarios.find(s=>s.id===draftCollection.activeId).inputs.price,null);
assert.equal(draftCollection.scenarios.find(s=>s.id===draftCollection.activeId).inputs.normalRate,0);
console.log('PASS: incomplete single-scenario and collection JSON preserve blanks and explicit zero.');
const expectedMoney=value=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:0}).format(Math.abs(value)<.5?0:value)+' Kč';
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
