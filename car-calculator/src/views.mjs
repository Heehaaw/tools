import {createTranslator} from "./i18n.mjs";
/** Own per-view preferences and money-basis wording for one calculator instance. */
export function createViews({i18n=createTranslator(),document,storage,onChange}){
 const {t,money}=i18n;
 const $=id=>document.getElementById(id);
 const ANNUAL_VIEW_KEY="car-financing-calculator.annual-views.v1";
 const annualViews=Object.fromEntries(['summary','versus','interest','cost','opportunityBreakdown','resale','returnGraph','interestGraph','resaleGraph','waterfallGraph','heatmapGraph'].map(key=>[key,key!=="opportunityBreakdown"]));
 function initializeAnnualViews(){
  let stored={};
  try{const value=JSON.parse(storage.getItem(ANNUAL_VIEW_KEY)||"{}");if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
  for(const key of Object.keys(annualViews)){
   annualViews[key]=typeof stored[key]==='boolean'?stored[key]:key!=="opportunityBreakdown";
   const control=$("annual-"+key);control.checked=annualViews[key];
   control.addEventListener("change",()=>{
    annualViews[key]=control.checked;
    try{storage.setItem(ANNUAL_VIEW_KEY,JSON.stringify(annualViews));}
    catch{i18n.setMessage($("storageStatus"),()=>t("views.comparisonChoicesApplyForThisSessionBrowserStorage"));}
    onChange();
   });
  }
 }
 const OPPORTUNITY_VIEW_KEY="car-financing-calculator.opportunity-views.v1";
 const opportunityViews=Object.fromEntries(['summary','versus','monthly','interest','cost','resale','monthlyGraph','interestGraph','resaleGraph','waterfallGraph','heatmapGraph'].map(key=>[key,true]));
 const INFLATION_VIEW_KEY="car-financing-calculator.inflation-views.v1";
 const inflationViews=Object.fromEntries([...Object.keys(opportunityViews),"opportunityBreakdown","vat"].map(key=>[key,false]));
 function viewOptions(key){return {opportunity:opportunityViews[key],todayMoney:inflationViews[key]};}
 function moneyBasis(key){return inflationViews[key]?( $("pastOwnership").checked?t("views.inEstimatedPurchaseDateMoney"):t("views.inEstimatedTodaySMoney")):t("views.inNominalK");}
 function comparisonBasis(key){return opportunityBasis(key)+", "+moneyBasis(key);}
 function initializeInflationViews(){
  let stored={};
  try{const value=JSON.parse(storage.getItem(INFLATION_VIEW_KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
  for(const key of Object.keys(inflationViews)){
   inflationViews[key]=typeof stored[key]==='boolean'?stored[key]:false;
   const control=$('inflation-'+key);control.checked=inflationViews[key];
   control.addEventListener('change',()=>{
    inflationViews[key]=control.checked;
    try{storage.setItem(INFLATION_VIEW_KEY,JSON.stringify(inflationViews));}
    catch{i18n.setMessage($("storageStatus"),()=>t("views.comparisonChoicesApplyForThisSessionBrowserStorage"));}
    onChange();
   });
  }
 }
 // View preferences never replace the scenario's return assumption or exported inputs.
 function viewInputs(s,key){return opportunityViews[key]?s:{...s,opportunityRate:0,opportunityRateBasis:"nominal"};}


 function opportunityBasis(key){return key==='opportunityBreakdown'||opportunityViews[key]?t("views.includingOpportunityCost"):t("views.excludingOpportunityCost");}
 function initializeOpportunityViews(){
  let stored={};
  try{const value=JSON.parse(storage.getItem(OPPORTUNITY_VIEW_KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
  for(const key of Object.keys(opportunityViews)){
   opportunityViews[key]=typeof stored[key]==='boolean'?stored[key]:true;
   const control=$('opportunity-'+key);control.checked=opportunityViews[key];
   control.addEventListener('change',()=>{
    opportunityViews[key]=control.checked;
    try{storage.setItem(OPPORTUNITY_VIEW_KEY,JSON.stringify(opportunityViews));}
    catch{i18n.setMessage($("storageStatus"),()=>t("views.comparisonChoicesApplyForThisSessionBrowserStorage"));}
    onChange();
   });
  }
 }
 function initialize(){initializeAnnualViews();initializeOpportunityViews();initializeInflationViews();}
 return {initialize,initializeAnnualViews,annualViews,initializeOpportunityViews,initializeInflationViews,opportunityViews,inflationViews,viewOptions,viewInputs,moneyBasis,comparisonBasis,opportunityBasis};
}
