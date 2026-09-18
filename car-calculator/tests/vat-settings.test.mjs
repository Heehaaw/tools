import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,migrateInputs,effectiveInputs,calculate} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements,html} from './ui-harness.mjs?vat-settings';

const envelope=inputs=>JSON.stringify({format:'car-financing-calculator',version:1,inputs});

test('legacy net lease quotes become gross exactly once without changing costs',()=>{
 for(const vatEnabled of [true,false]){
  const old={...defaults,kintoMonthly:10000,kintoVatMode:'net',vatPct:21,vatEnabled};
  const loaded=decodeSettings(envelope(old));
  assert.equal(loaded.kintoMonthly,12100);assert.equal(loaded.kintoVatMode,'gross');
  assert.deepEqual(migrateInputs(loaded),loaded);
  assert.equal(calculate(loaded).lease.adjusted,calculate({...old,kintoMonthly:12100,kintoVatMode:'gross'}).lease.adjusted);
  assert.deepEqual(decodeSettings(encodeSettings(loaded)),loaded);
 }
});

test('global VAT off ignores inactive blank settings and preserves their saved values',()=>{
 const draft={...defaults,vatEnabled:false,vatPct:null,recoveryPct:null,purchaseVatDelay:null,purchaseVatCap:null,leaseVatDelay:null,leaseTaxablePct:null};
 assert.doesNotThrow(()=>calculate(draft));
 assert.deepEqual(decodeSettings(encodeSettings(draft)),draft);
 const result=calculate(draft);
 assert.equal(result.purchaseRefund,0);assert.equal(result.leaseVatPerPayment,0);
 assert.equal(effectiveInputs(draft).vatPct,21);
});

test('VAT settings disappear together and a custom global rate applies to all invoices',()=>{
 const app=context.__testApp;
 app.form.write({...defaults,vatEnabled:false,leaseEnd:'buySell',leaseBuyout:500000});app.update();
 for(const id of ['globalVatFields','purchaseVatField','buyoutVatField','vatSettingsHint','leaseTaxablePctField'])assert.equal(elements[id].hidden,true,id);
 for(const id of ['vatPct','recoveryPct','purchaseVatDelay','purchaseVatCap','purchaseVatEligible','buyoutVatEligible','leaseTaxablePct'])assert.equal(elements[id].disabled,true,id);
 app.form.write({...defaults,vatEnabled:true,vatPct:10,price:1100000,kintoMonthly:11000,leaseEnd:'buySell',leaseBuyout:550000});
 const result=app.update();
 for(const id of ['globalVatFields','purchaseVatField','buyoutVatField','leaseTaxablePctField'])assert.equal(elements[id].hidden,false,id);
 assert.equal(result.purchaseRefund,100000);assert.equal(result.leaseVatPerPayment,1000);assert.equal(result.buyoutRefund,50000);
 assert.ok(!html.includes('Quote VAT basis'));
 assert.ok(html.indexOf('label for="vatPct"')<html.indexOf('data-option="balloon"><div class="section-title"'));
});

test('unfinished legacy net drafts retain their basis until conversion is possible',()=>{
 const draft={...defaults,kintoVatMode:'net',kintoMonthly:10000,vatPct:null};
 const loaded=decodeSettings(envelope(draft));
 assert.equal(loaded.kintoVatMode,'net');assert.equal(loaded.kintoMonthly,10000);
 const app=context.__testApp;app.form.write(loaded);app.update();
 assert.equal(elements.legacyLeaseQuoteNote.hidden,false);
 elements.vatPct.value='2';app.form.handleInput({type:'input',target:{id:'vatPct'}});
 assert.equal(app.form.readSettings().kintoVatMode,'net');assert.equal(app.form.readSettings().kintoMonthly,10000);
 elements.vatPct.value='21';
 app.form.handleInput({type:'change',target:{id:'vatPct'}});
 assert.equal(app.form.readSettings().kintoMonthly,12100);
 assert.equal(app.form.readSettings().kintoVatMode,'gross');
 assert.equal(elements.legacyLeaseQuoteNote.hidden,true);
});


test('lease VAT is deducted in the payment month even for saved delayed-refund scenarios',()=>{
 const old={...defaults,kintoInitial:12100,leaseVatDelay:4};
 const result=calculate(old),immediate=calculate({...old,leaseVatDelay:0});
 assert.deepEqual(result.lease,immediate.lease);
 assert.equal(effectiveInputs(old).leaseVatDelay,0);
 assert.equal(decodeSettings(encodeSettings(old)).leaseVatDelay,4);
 assert.ok(!html.includes('id="leaseVatDelayField"'));
 assert.ok(result.lease.events.some(e=>e.category==='vat'&&e.month===0&&e.amount===-2100));
 assert.ok(Math.abs(result.lease.futureRefund)<1e-9);
});
