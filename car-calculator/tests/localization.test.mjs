import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {test} from 'node:test';
import {createTranslator} from '../src/i18n.mjs';
import {createLocalization,LANGUAGE_KEY} from '../src/localization.mjs';
import {messages as en} from '../src/locales/en.mjs';
import {messages as cs} from '../src/locales/cs.mjs';
import {context,elements,saved} from './ui-harness.mjs?localization';
import {defaults,validate} from '../src/model.mjs';
import {decodeSettings,encodeSettings,decodeCollection} from '../src/scenarios.mjs';

function fixture(entries={}){
 const all=[],byId=new Map(),stored=new Map(Object.entries(entries));
 let languageChanges=0;
 function element(id='',attributes={}){
  const values=new Map(Object.entries(attributes));
  const item={id,value:'',hidden:false,textContent:'',listeners:{},
   getAttribute:name=>values.get(name)??null,
   hasAttribute:name=>values.has(name),
   setAttribute:(name,value)=>values.set(name,String(value)),
   addEventListener:(name,handler)=>{item.listeners[name]=handler;},
   change(value){item.value=value;item.listeners.change?.({target:item});}
  };
  all.push(item);if(id)byId.set(id,item);return item;
 }
 const documentElement={lang:'en',dataset:{releaseVersion:'2026.09.18.5'}};
 const document={documentElement,getElementById:id=>byId.get(id)??null,
  querySelectorAll(selector){
   const attribute=selector.match(/^\[([^\]]+)\]$/)?.[1];
   return attribute?all.filter(item=>item.hasAttribute(attribute)):[];
  }
 };
 const language=element('languageSelect');language.value='en';
 const currency=element('currency');currency.value='CZK';
 const license=element('software-license-cs');license.hidden=true;
 element('storageStatus');
 const heading=element('',{'data-i18n':'financing.balloon.title'});
 const symbol=element('',{'data-i18n':'ui.k'});
 const titled=element('',{'data-i18n-title':'common.currencyHelp'});
 const labelled=element('',{'data-i18n-aria-label':'help.darkMode'});
 const storage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
 const controller=createLocalization({document,storage,
  onLanguageChange:()=>{languageChanges++;}});
 return {controller,document,storage,stored,byId,heading,symbol,titled,labelled,
  counts:()=>({languageChanges})};
}

function placeholders(value){
 return [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(match=>match[1]).sort();
}

function hasResourceKey(resources,key){
 return Object.hasOwn(resources,key)||(Object.hasOwn(resources,key+'_one')&&Object.hasOwn(resources,key+'_other'));
}

test('translator resolves keys, interpolation and configured display values',()=>{
 const i18n=createTranslator();
 assert.equal(i18n.language,'en');
 assert.equal(i18n.t('financing.balloon.title'),'Balloon loan');
 assert.equal(i18n.t('setup.totalMonthsInclVat',{total:'100 Kč',months:24}),'Total: 100 Kč · 24 months, incl. VAT');

 i18n.configure({language:'cs',currency:'EUR',releaseVersion:'2026.09.18.5'});
 assert.equal(i18n.language,'cs');
 assert.equal(i18n.currency,'EUR');
 assert.equal(i18n.t('financing.balloon.title'),'Balónový úvěr');
 assert.equal(i18n.t('ui.k'),'€');
 assert.equal(i18n.t('ui.releaseNotesV'),'Poznámky k vydání · v2026.09.18.5');
 assert.equal(i18n.t('setup.totalMonthsInclVat',{total:'100 €',months:24}),'Celkem: 100 € · 24 měsíců, vč. DPH');
});

test('translator applies Czech plural forms and historical context',()=>{
 const i18n=createTranslator();
 i18n.configure({language:'cs'});
 assert.equal(i18n.t('common.months',{count:1}),'1 měsíc');
 assert.equal(i18n.t('common.months',{count:2}),'2 měsíce');
 assert.equal(i18n.t('common.months',{count:5}),'5 měsíců');
 assert.equal(i18n.t('common.services',{count:1}),'1 servisní prohlídka');
 assert.equal(i18n.t('common.services',{count:3}),'3 servisní prohlídky');
 assert.equal(i18n.t('common.services',{count:12}),'12 servisních prohlídek');
 assert.equal(i18n.t('scenarios.imported',{count:1}),'Importován 1 scénář. Stávající scénáře zůstaly zachovány.');
 assert.equal(i18n.t('scenarios.imported',{count:3}),'Importovány 3 scénáře. Stávající scénáře zůstaly zachovány.');
 assert.equal(i18n.t('views.inEstimatedTodaySMoney'),'v odhadovaných dnešních cenách');
 i18n.configure({past:true});
 assert.equal(i18n.t('views.inEstimatedTodaySMoney'),'v odhadovaných cenách při pořízení');
 assert.equal(i18n.t('setup.inTodaySMoney',{newPriceToday:'100 Kč'}),'V dnešních cenách: 100 Kč.');
 i18n.configure({language:'en'});
 assert.equal(i18n.t('views.inEstimatedTodaySMoney'),'in estimated purchase-date money');
 assert.equal(i18n.t('setup.inTodaySMoney',{newPriceToday:'100 Kč'}),'In today’s money: 100 Kč.');
});

test('translator instances keep language, currency and context isolated',()=>{
 const czech=createTranslator(),english=createTranslator();
 czech.configure({language:'cs',currency:'EUR',past:true});
 english.configure({language:'en',currency:'USD',past:false});

 assert.equal(czech.t('ui.k'),'€');
 assert.equal(czech.t('views.inEstimatedTodaySMoney'),'v odhadovaných cenách při pořízení');
 assert.equal(english.t('ui.k'),'$');
 assert.equal(english.t('views.inEstimatedTodaySMoney'),'in estimated today’s money');

 english.configure({language:'cs',currency:'CHF',past:true});
 assert.equal(czech.language,'cs');
 assert.equal(czech.currency,'EUR');
 assert.equal(czech.t('ui.k'),'€');
});

test('explicit data-i18n text and attribute bindings follow language and currency',()=>{
 const f=fixture();
 f.controller.initialize();
 assert.equal(f.heading.textContent,'Balloon loan');
 assert.equal(f.symbol.textContent,'Kč');
 assert.equal(f.titled.getAttribute('title'),'Saved with this scenario. Display symbol only; no exchange-rate conversion. Enter every amount in the same currency.');
 assert.equal(f.labelled.getAttribute('aria-label'),'Dark mode');
 assert.equal(f.document.documentElement.lang,'en');
 assert.equal(f.byId.get('software-license-cs').hidden,true);

 f.controller.setPreferences('cs','EUR');
 assert.equal(f.heading.textContent,'Balónový úvěr');
 assert.equal(f.symbol.textContent,'€');
 assert.equal(f.titled.getAttribute('title'),'Ukládá se s tímto scénářem. Pouze zobrazovaný symbol; bez přepočtu kurzem. Všechny částky zadávejte ve stejné měně.');
 assert.equal(f.labelled.getAttribute('aria-label'),'Tmavý režim');
 assert.equal(f.document.documentElement.lang,'cs');
 assert.equal(f.byId.get('software-license-cs').hidden,false);
});

test('language is persisted independently while currency changes stay scenario-owned',()=>{
 const f=fixture({[LANGUAGE_KEY]:'cs','car-financing-calculator.currency.v1':'EUR'});
 f.byId.get('currency').value='GBP';
 f.controller.initialize();
 assert.equal(f.controller.language,'cs');
 assert.equal(f.controller.currency,'GBP');
 assert.equal(f.stored.get(LANGUAGE_KEY),'cs');
 assert.equal(f.counts().languageChanges,1);

 f.byId.get('languageSelect').change('en');
 assert.equal(f.stored.get(LANGUAGE_KEY),'en');
 assert.equal(f.controller.currency,'GBP');
 f.byId.get('currency').change('USD');
 assert.equal(f.byId.get('currency').listeners.change,undefined); // The setup form owns currency edits.
 assert.equal(f.stored.get('car-financing-calculator.currency.v1'),'EUR');

 const invalid=fixture({[LANGUAGE_KEY]:'xx'});invalid.controller.initialize();
 assert.equal(invalid.controller.language,'en');
 invalid.storage.setItem=()=>{throw Error('disabled');};
 assert.doesNotThrow(()=>invalid.controller.setPreferences('cs','USD'));
 assert.equal(invalid.byId.get('storageStatus').textContent,'Jazyk platí pro tuto relaci. Úložiště prohlížeče není dostupné.');
});

test('persistent notices rerender from their message keys when language changes',()=>{
 const i18n=createTranslator(),element={textContent:''};
 i18n.setMessage(element,()=>i18n.t('scenarios.imported',{count:2}));
 assert.equal(element.textContent,'Imported 2 scenarios. Existing scenarios were kept.');
 i18n.configure({language:'cs'});
 assert.equal(element.textContent,'Importovány 2 scénáře. Stávající scénáře zůstaly zachovány.');
 i18n.setMessage(element,()=>"");
 i18n.configure({language:'en'});
 assert.equal(element.textContent,'');
});

test('validation errors keep stable English API messages and translate through their keys',()=>{
 const i18n=createTranslator();i18n.configure({language:'cs'});
 let error;
 try{validate({...defaults,currency:'invalid'});}catch(caught){error=caught;}
 assert.equal(error.message,'Choose a supported currency.');
 assert.equal(error.messageKey,'errors.chooseASupportedCurrency');
 assert.equal(i18n.errorMessage(error),cs[error.messageKey]);
 assert.equal(error.message,'Choose a supported currency.');
 i18n.configure({language:'en'});
 assert.equal(i18n.errorMessage(error),error.message);
});

test('catalogues preserve placeholders and cover explicit markup and source keys',async()=>{
 const englishKeys=Object.keys(en),missingInCzech=englishKeys.filter(key=>!Object.hasOwn(cs,key));
 assert.deepEqual(missingInCzech,[],'Every English resource needs a Czech resource');
 const placeholderMismatches=englishKeys.filter(key=>
  JSON.stringify(placeholders(en[key]))!==JSON.stringify(placeholders(cs[key])));
 assert.deepEqual(placeholderMismatches,[],'English and Czech resources must interpolate the same named values');

 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
 const markupKeys=[...html.matchAll(/\bdata-i18n(?:-[\w-]+)?="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual([...new Set(markupKeys.filter(key=>!hasResourceKey(en,key)||!hasResourceKey(cs,key)))],[],
  'Every data-i18n binding needs English and Czech resources');

 const sourceDirectory=new URL('../src/',import.meta.url),sourceKeys=[];
 for(const name of await readdir(sourceDirectory)){
  if(!name.endsWith('.mjs'))continue;
  const source=await readFile(new URL(name,sourceDirectory),'utf8');
  for(const match of source.matchAll(/(?:^|[^\w.])(?:t|messageError)\(\s*["']([^"']+)["']/gm))if(!match[1].endsWith('.'))sourceKeys.push(match[1]);
 }
 assert.deepEqual([...new Set(sourceKeys.filter(key=>!hasResourceKey(en,key)||!hasResourceKey(cs,key)))],[],
  'Every literal source translation key needs English and Czech resources');
});

test('language changes preserve financial inputs, scenario JSON and calculated costs',()=>{
 const app=context.__testApp;
 const before=JSON.stringify(app.form.readSettings());
 const exportBefore=app.scenarios.encodeSettings(app.form.readSettings());
 const costsBefore=JSON.stringify(app.update());
 const currency=app.form.readSettings().currency;
 app.localization.setPreferences('cs',currency);
 assert.equal(JSON.stringify(app.form.readSettings()),before);
 assert.equal(app.scenarios.encodeSettings(app.form.readSettings()),exportBefore);
 assert.equal(JSON.stringify(app.update()),costsBefore);
 app.localization.setPreferences('en',currency);
 assert.equal(JSON.stringify(app.form.readSettings()),before);
});

test('Czech leaves stable chart IDs and Home and End navigation keys intact',()=>{
 const app=context.__testApp,currency=app.form.readSettings().currency;
 const chartKeys=[...app.charts.chartData.keys()].sort();
 assert.ok(chartKeys.includes('monthly-costs'));
 assert.ok(chartKeys.includes('cost-waterfall'));
 assert.ok(chartKeys.includes('opportunity-return-sensitivity'));
 app.localization.setPreferences('cs',currency);
 assert.deepEqual([...app.charts.chartData.keys()].sort(),chartKeys);

 let prevented=false;
 elements['tab-graphs'].listeners.keydown({key:'Home',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(elements.inputs.hidden,false);
 prevented=false;
 elements['tab-setup'].listeners.keydown({key:'End',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(elements.graphs.hidden,false);
 app.localization.setPreferences('en',currency);
});

test('old exports gain CZK and scenario currencies survive validation and JSON round trips',()=>{
 const old=decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:{carName:'Old car',price:340000}}));
 assert.equal(old.currency,'CZK');assert.equal(old.price,340000);
 for(const currency of ['CZK','EUR','USD','GBP','CHF','PLN']){
  const draft={...defaults,currency,price:null,rate:0};
  const restored=decodeSettings(encodeSettings(draft));
  assert.equal(restored.currency,currency);assert.equal(restored.price,null);assert.equal(restored.rate,0);
 }
 for(const currency of ['unsupported','',null,42])assert.throws(()=>decodeSettings(JSON.stringify({format:'car-financing-calculator',version:1,inputs:{currency}})),/currency/);
});

test('currency edits fork the CZK example and follow scenario switching, duplication and restoration',async()=>{
 const app=context.__testApp;
 function change(id,value){elements[id].value=value;(id==='currency'?elements.inputs:elements[id]).listeners.change({target:{...elements[id],id},type:'change'});}
 assert.equal(app.scenarios.exampleInputs.currency,'CZK');
 const originalPrice=app.form.readSettings().price;
 const costs=app.update();
 change('currency','EUR');
 assert.equal(app.scenarios.scenarios.length,1);
 const euro=app.scenarios.scenarios[0];
 assert.equal(euro.inputs.currency,'EUR');assert.equal(app.scenarios.exampleInputs.currency,'CZK');
 assert.equal(app.form.readSettings().price,originalPrice);
 assert.equal(app.update().cashPurchase.adjusted,costs.cashPurchase.adjusted);
 elements.duplicateScenario.listeners.click();
 const dollar=app.scenarios.scenarios[1];assert.equal(dollar.inputs.currency,'EUR');
 change('currency','USD');assert.equal(app.scenarios.scenarios[1].inputs.currency,'USD');assert.equal(app.scenarios.scenarios[0].inputs.currency,'EUR');
 change('scenarioSelect','');assert.equal(elements.currency.value,'CZK');assert.equal(app.localization.currency,'CZK');
 change('scenarioSelect',euro.id);assert.equal(elements.currency.value,'EUR');assert.equal(app.localization.currency,'EUR');
 change('scenarioSelect',dollar.id);assert.equal(app.localization.currency,'USD');
 const exported=decodeCollection(app.scenarios.encodeCollection());
 assert.deepEqual(exported.scenarios.map(s=>s.inputs.currency),['EUR','USD']);
 const reloaded=await import('./ui-harness.mjs?currency-reload');
 for(const [key,value] of saved)reloaded.saved.set(key,value);
 reloaded.context.__testApp.scenarios.restoreSettings();
 assert.equal(reloaded.elements.currency.value,'USD');assert.equal(reloaded.context.__testApp.localization.currency,'USD');
 const json=app.scenarios.encodeCollection();
 reloaded.elements.importFile.files=[{size:json.length,text:async()=>json}];
 await reloaded.elements.importFile.listeners.change();
 assert.equal(reloaded.context.__testApp.scenarios.scenarios.length,4);
 assert.equal(reloaded.elements.currency.value,'USD');
 assert.deepEqual(Array.from(reloaded.context.__testApp.scenarios.scenarios,s=>s.inputs.currency),['EUR','USD','EUR','USD']);
 elements.clearAll.listeners.click();assert.equal(app.form.readSettings().currency,'USD');
 elements.reset.listeners.click();assert.equal(app.form.readSettings().currency,'USD');
});
