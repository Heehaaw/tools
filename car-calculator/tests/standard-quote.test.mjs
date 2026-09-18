import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,monthlyPayment,effectiveInputs,calculate,interestComparisons} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements,html} from './ui-harness.mjs?standard-quote';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const payment=monthlyPayment(600000,0,7.9,48);
const quote={...defaults,price:800000,normalDownPct:25,months:24,normalMatchOwnership:false,normalLoanMonths:48,normalInputMode:'payment',normalMonthlyPayment:payment};

test('standard quotes infer interest using their full repayment period with no balloon',()=>{
 const s=effectiveInputs(quote),c=calculate(quote);
 close(s.normalRate,7.9);close(c.normalPayment,payment);
 assert.equal(c.standardLoan.paidMonths,24);assert.equal(c.standardLoan.balloonPaid,0);
 const rateQuote={...quote,normalInputMode:'rate',normalRate:7.9};
 close(c.standardLoan.adjusted,calculate(rateQuote).standardLoan.adjusted);
 const a=interestComparisons(quote),b=interestComparisons(rateQuote);
 for(let i=0;i<a.length;i++){assert.equal(a[i].status,b[i].status);if(a[i].rate!==null)close(a[i].rate,b[i].rate);}
 assert.throws(()=>calculate({...quote,normalMonthlyPayment:1}),/valid standard loan quote/);
 assert.doesNotThrow(()=>calculate({...quote,normalEnabled:false,normalMonthlyPayment:null}));
});

test('older standard loans stay in rate mode and blank inactive values round-trip',()=>{
 const old={...defaults};delete old.normalInputMode;delete old.normalMonthlyPayment;
 const loaded=decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:old}));
 assert.equal(loaded.normalInputMode,'rate');close(calculate(loaded).normalPayment,calculate(defaults).normalPayment);
 for(const draft of [{...quote,normalRate:null},{...defaults,normalMonthlyPayment:null},{...quote,normalMonthlyPayment:null}])assert.deepEqual(decodeSettings(encodeSettings(draft)),draft);
 assert.throws(()=>encodeSettings({...quote,normalInputMode:'invalid'}),/Choose interest rate/);
});

test('standard and balloon radio sources stay independent with fixed field positions',()=>{
 const app=context.__testApp;
 app.form.write({...quote,balloonInputMode:'payment',balloonMonthlyPayment:15000});app.update();
 assert.equal(elements.normalRate.disabled,true);assert.equal(elements.normalMonthlyPayment.disabled,false);
 close(Number(elements.normalRate.value),7.9,.0001);
 const balloonState=app.form.readSettings(),balloonRateShown=elements.rate.value;
 app.form.handleInput({type:'change',target:{id:'normalModeRate',name:'normalQuoteMethod',checked:true,value:'rate'}});
 assert.equal(elements.normalRate.disabled,false);assert.equal(elements.normalMonthlyPayment.disabled,true);
 elements.normalRate.value='5';app.form.handleInput({type:'input',target:{id:'normalRate'}});
 close(context.__testFormat.parseNumber(elements.normalMonthlyPayment.value),monthlyPayment(600000,0,5,48),.0051);
 assert.equal(elements.rate.value,balloonRateShown);
 assert.equal(app.form.readSettings().balloonMonthlyPayment,balloonState.balloonMonthlyPayment);
 assert.equal(app.form.readSettings().balloonInputMode,'payment');
 const saved=app.form.readSettings();app.form.write(saved);app.update();close(app.update().normalPayment,monthlyPayment(600000,0,5,48));
 const graph=app.charts.chartData.get('loan-interest-sensitivity');
 assert.notDeepEqual(app.charts.graphTooltipValues(graph,0).rows.map(r=>r.value),app.charts.graphTooltipValues(graph,10).rows.map(r=>r.value));
 assert.ok(html.indexOf('label for="normalExtra"')<html.indexOf('id="normalInputLabel"'));
 assert.ok(html.indexOf('id="normalRateField"')<html.indexOf('id="normalPaymentField"'));
});
