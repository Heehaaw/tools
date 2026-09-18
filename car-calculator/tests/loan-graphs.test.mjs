import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaults,calculate,loanSchedule,relativeResaleEstimate} from '../src/model.mjs';
import {context,elements} from './ui-harness.mjs?loan-graphs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('monthly principal, interest and final payments reconcile with both loan models',()=>{
 for(const rate of [0,5.99])for(const keep of [18,36,60])for(const end of ['sell','keep']){
  const s={...defaults,rate,normalRate:rate,months:keep,balloonMatchOwnership:false,normalMatchOwnership:false,balloonLoanMonths:36,normalLoanMonths:36,loanEnd:end};
  const c=calculate(s);
  for(const [kind,key] of [['balloon','balloonLoan'],['normal','standardLoan']]){
   const schedule=loanSchedule(s,kind),last=schedule.rows.at(-1);
   for(const row of schedule.rows)close(row.principal+row.interest,row.payment);
   close(schedule.rows.reduce((sum,r)=>sum+r.interest,0),c[key].loanInterest);
   close(schedule.rows.reduce((sum,r)=>sum+r.principal+r.balloon,0)+last.balance,schedule.principal);
   close(last.balance,c[key].remainingPrincipal);
   close(last.settlement,keep<36&&end==='sell'?c[key].remainingPrincipal:0);
   close(schedule.rows.reduce((sum,r)=>sum+r.balloon,0),c[key].balloonPaid);
  }
 }
});

test('debt and equity tooltips respect direct estimates, inferred rates and early sale',()=>{
 const app=context.__testApp;
 const s={...defaults,price:891360,downPct:25,balloonPct:48,balloonInputMode:'payment',balloonMonthlyPayment:10347,months:24,balloonMatchOwnership:false,balloonLoanMonths:36,normalEnabled:false,leaseEnabled:false,cashEnabled:false};
 app.form.write(s);app.update();
 const data=app.charts.chartData.get('car-value-timeline');
 assert.equal(data.series.length,2);
 const mid=app.charts.graphTooltipValues(data,12);
 assert.equal(mid.rows.length,1,'No invented mid-term car value or equity in direct mode');
 close(mid.rows[0].value,loanSchedule(s,'balloon').rows[11].balance);
 const final=app.charts.graphTooltipValues(data,24),balance=loanSchedule(s,'balloon').rows[23].balance;
 close(final.rows.find(r=>r.name.includes('equity')).value,s.resale-balance);
 const bars=app.charts.chartData.get('loan-payment-breakdown');
 assert.equal(bars.cells.length,24);
 const tooltip=app.charts.graphTooltipValues(bars,23);
 close(tooltip.rows.find(r=>r.name.includes('sale settlement')).value,balance);
 assert.ok(elements.loanPaymentGraph.innerHTML.includes('sale settlement'));
});

test('relative timelines show both debts and monthly tooltips compare both loans',()=>{
 const app=context.__testApp,s={...defaults,resaleMode:'relative',historicalNewPrice:1200000,historicalUsedPrice:900000,historicalInflationPct:15,months:36};
 app.form.write(s);app.update();
 const data=app.charts.chartData.get('car-value-timeline');
 assert.equal(data.series.filter(v=>v.name.includes('remaining debt')).length,2);
 const value=relativeResaleEstimate(s,12).nominalValue;
 const tooltip=app.charts.graphTooltipValues(data,12);
 for(const kind of ['balloon','normal'])close(tooltip.rows.find(r=>r.kind===kind&&r.name.includes('equity')).value,value-loanSchedule(s,kind).rows[11].balance);
 const bars=app.charts.chartData.get('loan-payment-breakdown');
 const last=app.charts.graphTooltipValues(bars,35);
 assert.ok(last.rows.some(r=>r.kind==='balloon'&&r.name.includes('final balloon')));
 assert.ok(last.rows.some(r=>r.kind==='normal'&&r.name.includes('interest paid so far')));
 close(last.rows.find(r=>r.kind==='balloon'&&r.name.includes('remaining debt')).value,0);
 const saved=app.form.readSettings();
 app.update();assert.deepEqual(app.form.readSettings(),saved);
 app.form.write({...defaults,balloonEnabled:false,normalEnabled:false});app.update();
 assert.equal(app.charts.chartData.has('loan-payment-breakdown'),false);
 assert.ok(elements.loanPaymentGraph.innerHTML.includes('Include a loan'));
 assert.equal(app.charts.chartData.has('car-value-timeline'),false);
});
