import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,variants,migrateInputs,effectiveInputs,calculate,hasDifferentPeriods,withResale,historicalInflationTotal} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements} from './ui-harness.mjs?local-periods';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('each option resolves its period and resale independently, including sensitivity and repayment',()=>{
 const raw={...defaults,months:48,leaseMatchPeriod:false,leaseMonths:24,normalMatchPeriod:false,normalMonths:60,normalResale:700000,
  balloonMonths:null,balloonResale:null,cashMonths:null,cashResale:null,normalMatchOwnership:false,normalLoanMonths:36};
 const s=effectiveInputs(raw);
 assert.equal(s.balloonMonths,48);assert.equal(s.cashMonths,48);assert.equal(s.normalMonths,60);assert.equal(s.leaseMonths,24);
 assert.equal(s.balloonLoanMonths,48);assert.equal(s.normalLoanMonths,36);
 assert.equal(hasDifferentPeriods(raw),true);assert.doesNotThrow(()=>calculate(raw));
 const varied=effectiveInputs(withResale(raw,raw.resale+100000));
 assert.equal(varied.balloonResale,raw.resale+100000);assert.equal(varied.normalResale,800000);assert.equal(varied.cashResale,raw.resale+100000);
 assert.deepEqual(effectiveInputs(s),s);
 const history={...raw,pastOwnership:true,resaleMode:'relative',historicalNewPrice:1000000,historicalUsedPrice:700000,historicalMonths:72,inflationRate:10};
 assert.equal(effectiveInputs(history).historicalMonths,48);
 const independent=effectiveInputs({...history,pastHistoricalMatchPeriod:false});assert.equal(independent.historicalMonths,72);
 close(historicalInflationTotal(independent),(1.1**6-1)*100);
});

test('old global matching migrates into independent flags without changing totals or drafts',()=>{
 for(const matchPeriods of [true,false]){
  const old={...defaults,matchPeriods,months:48,balloonMonths:24,normalMonths:60,leaseMonths:36,cashMonths:72};
  for(const v of variants)delete old[v.matchPeriod];delete old.pastHistoricalMatchPeriod;
  const migrated=migrateInputs(old);
  for(const v of variants)assert.equal(migrated[v.matchPeriod],matchPeriods);
  assert.equal(migrated.pastHistoricalMatchPeriod,matchPeriods);
  const expected={...defaults,...old,...Object.fromEntries(variants.map(v=>[v.matchPeriod,matchPeriods])),pastHistoricalMatchPeriod:matchPeriods};
  for(const opportunity of [false,true])for(const todayMoney of [false,true]){
   const a=calculate(migrated,{opportunity,todayMoney}),b=calculate(expected,{opportunity,todayMoney});
   for(const v of variants)close(a[v.key].adjusted,b[v.key].adjusted);
  }
  assert.deepEqual(decodeSettings(encodeSettings(migrated)),migrated);
 }
 const oldDraft={...defaults,matchPeriods:false,balloonMonths:null};for(const v of variants)delete oldDraft[v.matchPeriod];delete oldDraft.pastHistoricalMatchPeriod;
 const restored=decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:oldDraft}));
 assert.equal(restored.balloonMonths,null);assert.equal(restored.balloonMatchPeriod,false);
});

test('local checkboxes reveal only their own fieldset and retain custom values while off',()=>{
 const app=context.__testApp;
 const toggle=(id,checked)=>{elements[id].checked=checked;app.form.handleInput({type:'change',target:{id,checked}});};
 app.form.write({...defaults,months:48,balloonMonths:24,balloonResale:900000});app.update();
 for(const v of variants)assert.equal(elements[v.kind+'PeriodSettings'].hidden,true);
 toggle('balloonSeparatePeriod',true);
 assert.equal(elements.balloonPeriodSettings.hidden,false);assert.equal(elements.normalPeriodSettings.hidden,true);
 assert.equal(effectiveInputs(app.form.readSettings()).balloonMonths,24);assert.equal(effectiveInputs(app.form.readSettings()).normalMonths,48);
 toggle('balloonSeparateRepayment',true);assert.equal(elements.balloonRepaymentSettings.hidden,false);
 toggle('balloonSeparatePeriod',false);assert.equal(elements.balloonPeriodSettings.hidden,true);assert.equal(elements.balloonRepaymentSettings.hidden,false);
 assert.equal(app.form.readSettings().balloonMonths,24);assert.equal(app.form.readSettings().balloonResale,900000);
 elements.months.value='60';app.form.handleInput({type:'change',target:{id:'months'}});
 assert.equal(app.form.readSettings().balloonMonths,24);assert.equal(effectiveInputs(app.form.readSettings()).balloonMonths,60);
 toggle('balloonSeparatePeriod',true);assert.equal(effectiveInputs(app.form.readSettings()).balloonMonths,24);
 toggle('balloonSeparateRepayment',false);assert.equal(elements.balloonRepaymentSettings.hidden,true);assert.equal(effectiveInputs(app.form.readSettings()).balloonLoanMonths,24);
 app.form.write({...defaults,pastOwnership:true,resaleMode:'relative',historicalNewPrice:1000000,historicalUsedPrice:700000,historicalMonths:72});app.update();
 toggle('historicalSeparatePeriod',true);assert.equal(elements.historicalPeriodSettings.hidden,false);assert.equal(elements.historicalInflationSection.hidden,false);
 for(const v of variants)assert.equal(elements[v.kind+'PeriodSettings'].hidden,true);
 toggle('historicalSeparatePeriod',false);assert.equal(elements.historicalPeriodSettings.hidden,true);assert.equal(elements.historicalInflationSection.hidden,true);
 assert.equal(app.form.readSettings().historicalMonths,72);
 const roundTrip=decodeSettings(encodeSettings(app.form.readSettings()));assert.equal(roundTrip.pastHistoricalMatchPeriod,true);assert.equal(roundTrip.historicalMonths,72);
});
