/** Own per-view preferences and money-basis wording for one calculator instance. */
export function createViews({document,storage,onChange}){
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
    catch{$("storageStatus").textContent="Comparison choices apply for this session. Browser storage is unavailable.";}
    onChange();
   });
  }
 }
 const OPPORTUNITY_VIEW_KEY="car-financing-calculator.opportunity-views.v1";
 const opportunityViews=Object.fromEntries(['summary','versus','monthly','interest','cost','resale','monthlyGraph','interestGraph','resaleGraph','waterfallGraph','heatmapGraph'].map(key=>[key,true]));
 const INFLATION_VIEW_KEY="car-financing-calculator.inflation-views.v1";
 const inflationViews=Object.fromEntries([...Object.keys(opportunityViews),"opportunityBreakdown","vat"].map(key=>[key,false]));
 function viewOptions(key){return {opportunity:opportunityViews[key],todayMoney:inflationViews[key]};}
 function moneyBasis(key){return inflationViews[key]?( $("pastOwnership").checked?"in estimated purchase-date money":"in estimated today’s money"):"in nominal Kč";}
 // Keep presentation dates separate from the unchanged month-zero financial model.
 const timeLabelSources=new WeakMap();
 function timeWording(text){
  if(!$("pastOwnership").checked)return text;
  return text.replaceAll("today’s money","purchase-date money").replaceAll("today’s-money","purchase-date-money")
   .replaceAll("today’s purchasing power","purchase-date purchasing power").replaceAll("purchasing power today","purchasing power at purchase")
   .replaceAll("today’s value","purchase-date value").replaceAll("today’s invoice price","purchase invoice price")
   .replaceAll("purchased now","purchased at the start").replaceAll("paid now","paid at purchase")
   .replaceAll("Expected future inflation","Alternative annual inflation")
   .replaceAll("Future inflation is an assumption, not a guaranteed outcome.","Purchasing-power adjustments use a constant annual rate over the period.");
 }
 function applyTimeLabels(root){
  // Remember the original text so switching modes also restores static explanations.
  if(!document.createTreeWalker)return;
  for(const element of root.querySelectorAll('[title]')){
   const node=element.getAttributeNode('title'),previous=timeLabelSources.get(node),source=previous&&node.nodeValue===previous.shown?previous.source:node.nodeValue;
   const shown=timeWording(source);timeLabelSources.set(node,{source,shown});if(shown!==node.nodeValue)node.nodeValue=shown;
  }
  const walker=document.createTreeWalker(root,4);
  for(let node;node=walker.nextNode();){
   if(node.parentElement?.closest('script,style,select,textarea,#scenarioName,#relativeResaleSettings'))continue;
   const previous=timeLabelSources.get(node),source=previous&&node.nodeValue===previous.shown?previous.source:node.nodeValue;
   const shown=timeWording(source);timeLabelSources.set(node,{source,shown});if(shown!==node.nodeValue)node.nodeValue=shown;
  }
 }
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
    catch{$('storageStatus').textContent='Comparison choices apply for this session. Browser storage is unavailable.';}
    onChange();
   });
  }
 }
 // View preferences never replace the scenario's return assumption or exported inputs.
 function viewInputs(s,key){return opportunityViews[key]?s:{...s,opportunityRate:0,opportunityRateBasis:"nominal"};}


 function opportunityBasis(key){return key==='opportunityBreakdown'||opportunityViews[key]?'including opportunity cost':'excluding opportunity cost';}
 function initializeOpportunityViews(){
  let stored={};
  try{const value=JSON.parse(storage.getItem(OPPORTUNITY_VIEW_KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
  for(const key of Object.keys(opportunityViews)){
   opportunityViews[key]=typeof stored[key]==='boolean'?stored[key]:true;
   const control=$('opportunity-'+key);control.checked=opportunityViews[key];
   control.addEventListener('change',()=>{
    opportunityViews[key]=control.checked;
    try{storage.setItem(OPPORTUNITY_VIEW_KEY,JSON.stringify(opportunityViews));}
    catch{$('storageStatus').textContent='Comparison choices apply for this session. Browser storage is unavailable.';}
    onChange();
   });
  }
 }
 function initialize(){initializeAnnualViews();initializeOpportunityViews();initializeInflationViews();}
 return {initialize,initializeAnnualViews,annualViews,initializeOpportunityViews,initializeInflationViews,opportunityViews,inflationViews,viewOptions,viewInputs,moneyBasis,comparisonBasis,opportunityBasis,timeWording,applyTimeLabels};
}
