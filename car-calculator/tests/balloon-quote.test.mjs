import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,annualRateFromPayment,monthlyPayment,effectiveInputs,calculate,validate,interestComparisons} from '../src/model.mjs';
import {decodeSettings,encodeSettings} from '../src/scenarios.mjs';
import {context,elements,html} from './ui-harness.mjs?balloon-quote';

const quote={...defaults,price:891360,downPct:25,balloonPct:48,months:36,balloonInputMode:'payment',balloonMonthlyPayment:10347};
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('quoted repayments infer the rate and preserve the raw rate',()=>{
 const effective=effectiveInputs(quote),result=calculate(quote);
 close(effective.rate,7.899496408356783);
 close(result.payment,10347);
 close(result.interest,131824.8);
 assert.equal(quote.rate,5.99);
 assert.deepEqual(effectiveInputs(effective),effective);
 const direct=calculate({...quote,balloonInputMode:'rate',rate:effective.rate});
 close(result.balloonLoan.adjusted,direct.balloonLoan.adjusted);
 const split={...quote,months:24,balloonMatchOwnership:false,balloonLoanMonths:36};
 close(effectiveInputs(split).rate,effective.rate);
 assert.equal(calculate(split).balloonLoan.paidMonths,24);
});

test('rate inference supports boundary loans and rejects impossible quotes',()=>{
 assert.equal(annualRateFromPayment(100000,40000,5000,12),0);
 close(annualRateFromPayment(100000,100000,500,36),6);
 for(const rate of [0,0.00001,5.99,100])close(annualRateFromPayment(100000,0,monthlyPayment(100000,0,rate,60),60),rate);
 for(const args of [[0,0,0,36],[100,200,1,36],[100000,0,1,36],[100,0,10000,36],[100,0,null,36],[100,0,10,0]])assert.ok(Number.isNaN(annualRateFromPayment(...args)));
 assert.throws(()=>validate({...quote,balloonMonthlyPayment:1}),/valid balloon loan quote/);
 assert.doesNotThrow(()=>validate({...quote,balloonEnabled:false,balloonMonthlyPayment:null}));
});

test('old scenarios retain rate mode and inactive quote drafts survive round trips',()=>{
 const old={...defaults};delete old.balloonInputMode;delete old.balloonMonthlyPayment;
 const restored=decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:old}));
 assert.equal(restored.balloonInputMode,'rate');assert.equal(restored.balloonMonthlyPayment,0);
 close(calculate(restored).payment,calculate(defaults).payment);
 for(const draft of [{...quote,rate:null},{...defaults,balloonMonthlyPayment:null},{...quote,balloonMonthlyPayment:null}])assert.deepEqual(decodeSettings(encodeSettings(draft)),draft);
 assert.throws(()=>encodeSettings({...quote,balloonInputMode:'unknown'}),/Choose interest rate/);
});

test('interest comparisons still vary the rate for payment-mode quotes',()=>{
 const fixed={...quote,balloonInputMode:'rate',rate:effectiveInputs(quote).rate};
 assert.deepEqual(interestComparisons(quote),interestComparisons(fixed));
});

test('radio modes keep two fields in place and calculate only the disabled input',()=>{
 const app=context.__testApp;
 app.form.write(quote);app.update();
 assert.equal(elements.balloonModePayment.checked,true);
 assert.equal(elements.balloonRateField.hidden,false);assert.equal(elements.balloonPaymentField.hidden,false);
 assert.equal(elements.rate.disabled,true);assert.equal(elements.balloonMonthlyPayment.disabled,false);
 close(Number(elements.rate.value),7.8995,1e-4);
 assert.equal(app.form.readSettings().rate,5.99,'Rendering must preserve the inactive saved rate');
 const interestChart=app.charts.chartData.get('loan-interest-sensitivity');
 assert.notEqual(app.charts.graphTooltipValues(interestChart,0).rows[0].value,app.charts.graphTooltipValues(interestChart,10).rows[0].value);
 const choose=value=>app.form.handleInput({type:'change',target:{id:value==='rate'?'balloonModeRate':'balloonModePayment',name:'balloonQuoteMethod',checked:true,value}});
 choose('rate');
 assert.equal(elements.rate.disabled,false);assert.equal(elements.balloonMonthlyPayment.disabled,true);
 close(app.form.readSettings().rate,7.8995);
 close(app.form.read().balloonMonthlyPayment,10347);
 elements.rate.value='6';app.form.handleInput({type:'input',target:{id:'rate'}});
 assert.equal(elements.rate.value,'6');
 close(context.__testFormat.parseNumber(elements.balloonMonthlyPayment.value),monthlyPayment(668520,427852.8,6,36),.0051);
 const shownPayment=context.__testFormat.parseNumber(elements.balloonMonthlyPayment.value);
 choose('payment');
 assert.equal(app.form.readSettings().balloonMonthlyPayment,shownPayment);
 assert.equal(elements.rate.disabled,true);assert.equal(elements.balloonMonthlyPayment.disabled,false);
 elements.balloonMonthlyPayment.value='10347';app.form.handleInput({type:'input',target:{id:'balloonMonthlyPayment'}});
 close(Number(elements.rate.value),7.8995,1e-4);
 close(app.update().payment,10347);
 const saved=app.form.readSettings();app.form.write(saved);app.update();
 close(app.update().payment,10347);
 elements.balloonMonthlyPayment.value='';app.form.handleInput({type:'input',target:{id:'balloonMonthlyPayment'}});
 assert.equal(elements.rate.value,'');assert.equal(app.form.readSettings().balloonMonthlyPayment,null);
 choose('rate');assert.equal(elements.rate.value,'');
 assert.ok(!html.includes('id="balloonQuoteDerived"'));
 assert.ok(html.indexOf('id="balloonRateField"')<html.indexOf('id="balloonPaymentField"'));
 assert.ok(html.indexOf('label for="easyInsurance"')<html.indexOf('label for="easyExtra"'));
});
