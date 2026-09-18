import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,migrateInputs,historicalInflationTotal,historicalInflationRate,effectiveInputs,calculate,ownershipInflationRate,ownershipInflationTotal,relativeResaleEstimate,inflationReturnGrid,validate} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements} from './ui-harness.mjs?ownership-inflation';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const displayed=id=>Number(elements[id].value.replace(/[\s,]/g,''));
const env=inputs=>JSON.stringify({format:'car-financing-calculator',version:1,inputs});

test('annual, cumulative and yearly inflation compound to the same ownership total',()=>{
 const yearly={...defaults,inflationMode:'yearly',months:30,inflationYears:[10,20,30],inflationRate:null,inflationTotalPct:null};
 const total=(1.1*1.2*Math.sqrt(1.3)-1)*100,annual=((1+total/100)**(12/30)-1)*100;
 close(ownershipInflationTotal(yearly),total);close(ownershipInflationRate(yearly),annual);
 const cumulative={...yearly,inflationMode:'total',inflationTotalPct:total,inflationYears:[null]};
 const average={...defaults,months:30,inflationRate:annual};
 for(const state of [yearly,cumulative,average]){
  const s=effectiveInputs(state);close(s.inflationRate,annual);assert.deepEqual(effectiveInputs(s),s);
  const c=calculate(state,{opportunity:true,todayMoney:true}),expected=calculate(average,{opportunity:true,todayMoney:true});
  for(const key of ['balloonLoan','standardLoan','lease','cashPurchase'])close(c[key].adjusted,expected[key].adjusted);
 }
 assert.equal(ownershipInflationRate({...defaults,inflationMode:'total',inflationTotalPct:0}),0);
 for(const months of [1,6,12,18,120])assert.doesNotThrow(()=>validate({...defaults,months,inflationMode:'yearly',inflationYears:Array(10).fill(100)}));
 assert.throws(()=>validate({...yearly,inflationYears:[10,null,30]}),/Complete each active/);
 assert.doesNotThrow(()=>validate({...defaults,inflationYears:[null]}));
});

test('resolved inflation drives resale and sensitivity with main inflation authoritative in past ownership',()=>{
 const s={...defaults,resaleMode:'relative',historicalNewPrice:1200000,historicalUsedPrice:800000,historicalInflationPct:20,inflationMode:'total',inflationTotalPct:32,months:24};
 const average={...s,inflationMode:'annual',inflationRate:ownershipInflationRate(s)};
 close(relativeResaleEstimate(s).nominalValue,relativeResaleEstimate(average).nominalValue);
 const grid=inflationReturnGrid(s,[0,5],[8.5],{opportunity:true,todayMoney:true});
 assert.notEqual(grid[0].costs.find(v=>v.kind==='cash').total,grid[1].costs.find(v=>v.kind==='cash').total);
 for(const [index,inflationRate] of [0,5].entries())close(grid[index].costs.find(v=>v.kind==='cash').total,calculate({...s,inflationMode:'annual',inflationRate},{opportunity:true,todayMoney:true}).cashPurchase.adjusted);
 const past={...s,pastOwnership:true,inflationMode:'yearly',inflationYears:[null],inflationRate:null,inflationTotalPct:null};
 assert.ok(Number.isNaN(effectiveInputs(past).inflationRate));
 assert.throws(()=>calculate(past),/Complete each active/);
 close(effectiveInputs({...s,pastOwnership:true}).inflationRate,(Math.sqrt(1.32)-1)*100);
});

test('old settings and incomplete inflation schedules round-trip without sharing arrays',()=>{
 const old={...defaults};for(const key of ['inflationMode','inflationTotalPct','inflationTotalSeeded','inflationYears'])delete old[key];
 const restored=decodeSettings(env(old));assert.equal(restored.inflationMode,'annual');close(calculate(restored).cashPurchase.adjusted,calculate(defaults).cashPurchase.adjusted);
 const draft={...defaults,inflationMode:'yearly',inflationRate:null,inflationTotalPct:null,inflationYears:[0,null,12]};
 const copy=decodeSettings(encodeSettings(draft));assert.deepEqual(copy,draft);copy.inflationYears[0]=7;assert.equal(draft.inflationYears[0],0);
 for(const inflationYears of [[101],[-1],['bad'],Array(11).fill(1)])assert.throws(()=>decodeSettings(env({...defaults,inflationYears})));
 assert.throws(()=>decodeSettings(env({...defaults,inflationMode:'bad'})));
});

test('linked fields promote calculated values, preserve raw drafts and use the yearly dialog',()=>{
 const app=context.__testApp;
 app.form.write({...defaults,pastOwnership:true,months:24,inflationRate:10});app.update();
 const choose=value=>app.form.handleInput({type:'change',target:{id:'inflationMode'+value[0].toUpperCase()+value.slice(1),name:'ownershipInflationMethod',checked:true,value}});
 assert.equal(elements.inflationRate.disabled,false);assert.equal(elements.inflationTotalPct.disabled,true);
 close(displayed('inflationTotalPct'),21);assert.equal(app.form.readSettings().inflationTotalPct,0);
 choose('total');close(app.form.readSettings().inflationTotalPct,21);assert.equal(elements.inflationRate.hidden,false);assert.equal(elements.inflationTotalPct.hidden,false);
 assert.equal(elements.inflationRate.disabled,true);assert.equal(elements.inflationTotalPct.disabled,false);
 elements.inflationTotalPct.value='32';app.form.handleInput({type:'change',target:{id:'inflationTotalPct'}});
 close(displayed('inflationRate'),(Math.sqrt(1.32)-1)*100);
 assert.equal(app.form.readSettings().inflationRate,10);
 choose('yearly');assert.equal(elements.ownershipInflationDialog.open,true);
 assert.equal(elements.inflationRate.disabled,true);assert.equal(elements.inflationTotalPct.disabled,true);
 const seeded=app.form.readSettings();close((1+seeded.inflationYears[0]/100)**2,1.32);
 app.form.handleInput({type:'input',target:{dataset:{ownershipInflationYear:'0'},value:'10'}});
 app.form.handleInput({type:'input',target:{dataset:{ownershipInflationYear:'1'},value:'20'}});
 close(ownershipInflationTotal(app.form.readSettings()),32);
 close(displayed('inflationTotalPct'),32);
 assert.match(elements.ownershipInflationDialogSummary.textContent,/32%/);
 choose('annual');assert.equal(elements.ownershipInflationDialog.open,false);close(app.form.readSettings().inflationRate,(Math.sqrt(1.32)-1)*100);assert.equal(elements.inflationRate.disabled,false);
 choose('total');close(app.form.readSettings().inflationTotalPct,32);
 choose('yearly');assert.deepEqual(Array.from(app.form.readSettings().inflationYears),[10,20]);
 elements.months.value='12';app.form.handleInput({type:'change',target:{id:'months'}});assert.deepEqual(Array.from(app.form.readSettings().inflationYears),[10,20]);
 app.form.write({...defaults,pastOwnership:true,resaleMode:'relative',historicalNewPrice:1200000,historicalUsedPrice:800000,historicalInflationPct:20});app.update();
 assert.equal(elements.ownershipInflationOptions.hidden,false);assert.equal(elements.inflationRate.disabled,false);assert.equal(elements.historicalInflationSection.hidden,true);
 assert.equal(elements.inflationTotalPct.disabled,true);close(displayed('inflationTotalPct'),(1.025**3-1)*100);
 assert.equal(app.form.readSettings().inflationRate,defaults.inflationRate);assert.equal(app.form.readSettings().inflationTotalPct,defaults.inflationTotalPct);
 elements.pastOwnership.checked=false;app.update();assert.equal(elements.inflationRate.disabled,false);close(displayed('inflationRate'),defaults.inflationRate);
 app.form.write({...defaults,inflationMode:'yearly',inflationYears:[null],inflationRate:null,inflationTotalPct:null});app.update();
 assert.equal(elements.inflationRate.value,'');assert.equal(elements.inflationTotalPct.value,'');
 assert.equal(app.form.readSettings().inflationRate,null);assert.equal(app.form.readSettings().inflationTotalPct,null);
 choose('annual');assert.equal(app.form.readSettings().inflationRate,null);
 app.form.write({...defaults,months:24,inflationMode:'total',inflationTotalPct:21,inflationRate:null,opportunityRateBasis:'real',opportunityRate:6});app.update();
 close(app.form.readSettings().opportunityRate,16.6);assert.equal(app.form.readSettings().opportunityRateBasis,'nominal');
});

test('past relative inflation shares the main source and compounds across a separate comparable age',()=>{
 const shared={...defaults,pastOwnership:true,resaleMode:'relative',relativeResaleSeeded:true,price:340000,historicalNewPrice:340000,historicalUsedPrice:240000,
  months:36,inflationMode:'yearly',inflationYears:[10,20,0],historicalMonths:72,historicalInflationPct:null,historicalInflationAnnual:null,historicalInflationYears:[null]};
 const rate=(1.32**(1/3)-1)*100;
 close(historicalInflationTotal(shared),32);close(historicalInflationRate(shared),rate);
 close(effectiveInputs(shared).historicalMonths,36);close(effectiveInputs(shared).resale,240000);
 const split={...shared,matchPeriods:false,balloonMatchPeriod:false,normalMatchPeriod:false,leaseMatchPeriod:false,cashMatchPeriod:false,pastHistoricalMatchPeriod:false,historicalMonths:24};
 close(historicalInflationTotal(split),(1.32**(2/3)-1)*100);
 close(effectiveInputs(split).resale,340000*(240000/340000)**1.5);
 assert.doesNotThrow(()=>calculate(split));assert.deepEqual(effectiveInputs(effectiveInputs(split)),effectiveInputs(split));
 assert.throws(()=>calculate({...split,historicalMonths:null}));
 const app=context.__testApp;app.form.write(shared);app.update();
 assert.equal(elements.ownershipInflationOptions.hidden,false);assert.equal(elements.historicalInflationSection.hidden,true);
 assert.equal(elements.historicalPeriodSettings.hidden,true);
 elements.historicalSeparatePeriod.checked=true;app.form.handleInput({type:'change',target:{id:'historicalSeparatePeriod',checked:true}});
 assert.equal(elements.historicalPeriodSettings.hidden,false);assert.equal(elements.historicalMonths.disabled,false);
 assert.equal(elements.historicalInflationSection.hidden,false);assert.equal(elements.historicalInflationLinkedNote.hidden,false);
 elements.historicalMonths.value='24';app.form.handleInput({type:'change',target:{id:'historicalMonths'}});
 close(effectiveInputs(app.form.readSettings()).historicalInflationPct,(1.32**(2/3)-1)*100);
 elements.historicalSeparatePeriod.checked=false;app.form.handleInput({type:'change',target:{id:'historicalSeparatePeriod',checked:false}});
 assert.equal(app.form.readSettings().historicalMonths,24);close(effectiveInputs(app.form.readSettings()).historicalInflationPct,32);
 assert.equal(elements.historicalInflationLinkedNote.hidden,true);
 elements.pastOwnership.checked=false;app.form.handleInput({type:'change',target:{id:'pastOwnership'}});
 assert.equal(elements.historicalInflationSection.hidden,false);assert.equal(app.form.readSettings().historicalInflationPct,null);
});

test('older past-relative scenarios migrate their active inflation once without losing inactive inputs',()=>{
 for(const historicalInflationMode of ['annual','total','yearly'])for(const matchPeriods of [true,false]){
  const old={...defaults,pastOwnership:true,resaleMode:'relative',relativeResaleSeeded:true,price:340000,historicalNewPrice:340000,historicalUsedPrice:240000,
   months:72,matchPeriods,historicalMonths:84,historicalMatchPeriod:false,historicalInflationMode,historicalInflationAnnual:6,historicalInflationPct:45.6,
   historicalInflationYears:[1,2,3,4,5,6,7],inflationMode:'yearly',inflationYears:[9,null,8],inflationRate:null,inflationTotalPct:17};
  delete old.inflationSetup;delete old.legacyInflationInputs;
  for(const key of ["balloonMatchPeriod", "normalMatchPeriod", "leaseMatchPeriod", "cashMatchPeriod", "pastHistoricalMatchPeriod"])delete old[key];
  const expectedHistory={...old,pastOwnership:false,historicalMatchPeriod:true};
  const expectedRate=historicalInflationRate(expectedHistory),expectedTotal=historicalInflationTotal(expectedHistory);
  const migrated=decodeSettings(env(old));assert.equal(migrated.inflationSetup,'shared-v1');
  close(ownershipInflationRate(migrated),expectedRate);close(effectiveInputs(migrated).historicalInflationPct,expectedTotal);
  assert.equal(effectiveInputs(migrated).historicalMonths,72);
  const archive=JSON.parse(migrated.legacyInflationInputs);assert.equal(archive.inflationRate,null);assert.equal(archive.historicalMonths,84);assert.deepEqual(archive.inflationYears,[9,null,8]);
  assert.deepEqual(migrateInputs(migrated),migrated);assert.deepEqual(decodeSettings(encodeSettings(migrated)),migrated);
  const expected={...migrated,resaleMode:'direct',resale:240000,inflationMode:'annual',inflationRate:expectedRate,
   balloonResale:340000*(240000/340000)**(migrated.balloonMonths/72),normalResale:340000*(240000/340000)**(migrated.normalMonths/72),leaseResale:340000*(240000/340000)**(migrated.leaseMonths/72),cashResale:340000*(240000/340000)**(migrated.cashMonths/72)};
  for(const opportunity of [false,true])for(const todayMoney of [false,true]){
   const actual=calculate(migrated,{opportunity,todayMoney}),baseline=calculate(expected,{opportunity,todayMoney});
   for(const key of ['balloonLoan','standardLoan','lease','cashPurchase'])close(actual[key].adjusted,baseline[key].adjusted);
  }
 }
 const oldDraft={...defaults,pastOwnership:true,resaleMode:'relative',historicalInflationPct:null};delete oldDraft.inflationSetup;
 const migratedDraft=decodeSettings(env(oldDraft));assert.equal(migratedDraft.inflationTotalPct,null);
 assert.throws(()=>decodeSettings(env({...defaults,inflationSetup:'future-version'})),/Unsupported inflation setup/);
});
