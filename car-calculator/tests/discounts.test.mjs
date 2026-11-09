import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,variants,effectiveInputs,calculate,loanSchedule,validate} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements} from './ui-harness.mjs?discounts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('purchase discounts affect only their own invoice, loan and VAT, preserving market resale',()=>{
 const base={...defaults,price:1000000,purchaseVatCap:0};
 const before=calculate(base);
 for(const v of variants.filter(v=>v.kind!=='lease')){
  const raw={...base,[v.kind+'DiscountEnabled']:true,[v.kind+'DiscountPct']:10};
  const after=calculate(raw);
  close(after[v.key].purchasePrice,900000);
  close(after[v.key].purchaseRefund,before[v.key].purchaseRefund*0.9);
  close(after[v.key].costComponents.purchase,before[v.key].costComponents.purchase*0.9);
  close(after[v.key].loanInterest,before[v.key].loanInterest*0.9);
  assert.equal(after[v.key].resale,before[v.key].resale);
  for(const other of variants.filter(other=>other!==v))close(after[other.key].nominal,before[other.key].nominal);
  if(v.loanMonths){
   const schedule=loanSchedule(raw,v.kind),oldSchedule=loanSchedule(base,v.kind);
   close(schedule.payment,oldSchedule.payment*0.9);
   const mode={...raw,[v.kind+'InputMode']:'payment',[v.kind+'MonthlyPayment']:schedule.payment};
   close(effectiveInputs(mode)[v.kind==='normal'?'normalRate':'rate'],base[v.kind==='normal'?'normalRate':'rate']);
  }
  const relative={...raw,resaleMode:'relative',historicalNewPrice:1000000,historicalUsedPrice:700000};
  close(calculate(relative)[v.key].resale,calculate({...relative,[v.kind+'DiscountEnabled']:false})[v.key].resale);
  for(const opportunity of [false,true])for(const todayMoney of [false,true]){
   const result=calculate(raw,{opportunity,todayMoney})[v.key];
   close(Object.values(result.costComponents).reduce((a,b)=>a+b,0),result.beforeOpportunity);
   close(result.beforeOpportunity+result.opportunity,result.adjusted);
  }
 }
});

test('lease discount reduces initial and monthly invoices and VAT but not separate costs or buyout',()=>{
 const raw={...defaults,kintoInitial:10000,leaseEnd:'buyKeep',leaseBuyout:100000};
 const a=calculate(raw),b=calculate({...raw,leaseDiscountEnabled:true,leaseDiscountPct:20});
 close(b.kInitial,8000);close(b.kRent,a.kRent*0.8);
 close(b.leaseInitialVat,a.leaseInitialVat*0.8);close(b.leaseVatPerPayment,a.leaseVatPerPayment*0.8);
 close(b.lease.costComponents.lease,a.lease.costComponents.lease*0.8);
 for(const key of ['insurance','purchase','other','maintenance','tyres'])close(b.lease.costComponents[key],a.lease.costComponents[key]);
});

test('discount defaults preserve legacy scenarios and round trips preserve inactive zero and blank drafts',()=>{
 const old={...defaults};for(const v of variants){delete old[v.kind+'DiscountEnabled'];delete old[v.kind+'DiscountPct'];}
 const migrated=decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:old}));
 for(const v of variants){assert.equal(migrated[v.kind+'DiscountEnabled'],false);assert.equal(migrated[v.kind+'DiscountPct'],0);}
 assert.deepEqual(calculate(migrated),calculate(defaults));
 for(const v of variants)for(const value of [0,10,null]){
  const raw={...defaults,[v.kind+'DiscountPct']:value};
  assert.deepEqual(decodeSettings(encodeSettings(raw)),raw);
  assert.deepEqual(calculate(raw),calculate(defaults));
  assert.throws(()=>encodeSettings({...raw,[v.kind+'DiscountPct']:101}));
  assert.throws(()=>validate({...raw,[v.kind+'DiscountEnabled']:true,[v.kind+'DiscountPct']:null}));
  assert.doesNotThrow(()=>calculate({...raw,[v.kind+'DiscountEnabled']:true,[v.kind+'DiscountPct']:100}));
 }
});

test('each discount checkbox reveals only its own percentage and preserves it when switched off',()=>{
 const app=context.__testApp;
 app.form.write({...defaults,balloonDiscountPct:12});app.update();
 const toggle=checked=>{elements.balloonDiscountEnabled.checked=checked;app.form.handleInput({type:'change',target:{id:'balloonDiscountEnabled',checked}});};
 for(const v of variants)assert.equal(elements[v.kind+'DiscountSettings'].hidden,true);
 toggle(true);assert.equal(elements.balloonDiscountSettings.hidden,false);assert.equal(elements.normalDiscountSettings.hidden,true);
 close(effectiveInputs(app.form.readSettings()).balloonDiscountPct,12);
 toggle(false);assert.equal(elements.balloonDiscountSettings.hidden,true);assert.equal(app.form.readSettings().balloonDiscountPct,12);
 toggle(true);assert.equal(app.form.readSettings().balloonDiscountPct,12);
});
