import {createTranslator} from "./i18n.mjs";
import {variants as modelVariants} from "./model.mjs";

/** Own theme, collapsible cards and tab navigation. */
export function createShell({i18n=createTranslator(),document,storage,onNavigate}){
 const variants=i18n.variants(modelVariants);
 const {t}=i18n;
 const refreshers=[];
 const $=id=>document.getElementById(id);
 function updateThemeButton(){
  const dark=document.documentElement.dataset.theme==="dark";
  $("themeToggle").setAttribute("aria-pressed",String(dark));
  $("themeToggle").textContent=dark?t("shell.darkModeOn"):t("ui.darkModeOff");
 }

 const CARD_STATE_KEY="car-financing-calculator.cards.v1";
 function initializeCards(){
  let saved={};
  try{const value=JSON.parse(storage.getItem(CARD_STATE_KEY)||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))saved=value;}catch{}
  const states={};
  function remember(key,expanded){
   states[key]=expanded;
   try{storage.setItem(CARD_STATE_KEY,JSON.stringify(states));}
   catch{i18n.setMessage($("storageStatus"),()=>t("shell.cardStateAppliesForThisSessionBrowserStorage"));}
  }
  for(const card of document.querySelectorAll("section.panel,section.total,section.verdict,section.scenario-toolbar")){
   const original=card.querySelector(":scope > .section-title")||card.querySelector(":scope > h2")||card.querySelector(":scope > .eyebrow");
   const title=card.id==="verdict"?t("shell.overallResult"):card.classList.contains("scenario-toolbar")?t("help.savedScenarios"):
    original?.querySelector("h2")?.firstChild.textContent.trim()||original?.firstChild.textContent.trim()||t("shell.card");
   const originalOptionKey=card.classList.contains("option-panel")?variants.find(v=>v.kind===card.dataset.option)?.fields[0]:null;
   const key=card.dataset.cardKey||card.id||originalOptionKey||card.querySelector("input[id]:not([data-opportunity-view]),select[id],tbody[id]")?.id||(card.dataset.option?"total-"+card.dataset.option:title.toLowerCase().replace(/[^a-z0-9]+/g,"-"));
   const header=document.createElement("div");header.className="card-heading";
   const heading=card.id==="verdict"||card.classList.contains("scenario-toolbar")?null:original;
   if(heading)header.appendChild(heading);
   else{const label=document.createElement("h2");label.setAttribute("data-i18n",card.id==="verdict"?"shell.overallResult":"help.savedScenarios");label.textContent=title;header.appendChild(label);}
   const body=document.createElement("div");body.className="card-body";body.id="card-body-"+key;
   while(card.firstChild)body.appendChild(card.firstChild);
   const button=document.createElement("button");button.type="button";button.className="card-toggle";
   button.setAttribute("aria-controls",body.id);header.appendChild(button);
   card.append(header,body);card.classList.add("collapsible-card");card.dataset.card=key;
   function expand(open){
    body.hidden=!open;card.dataset.collapsed=String(!open);button.setAttribute("aria-expanded",String(open));
    button.textContent=open?"−":"+";button.setAttribute("aria-label",t(open?"shell.collapse":"shell.expand",{title:header.querySelector("h2")?.textContent||heading?.textContent||title}));
    states[key]=open;
   }
   refreshers.push(()=>expand(!body.hidden));
   expand(typeof saved[key]==="boolean"?saved[key]:true);
   button.addEventListener("click",()=>{expand(body.hidden);remember(key,!body.hidden);});
  }
  for(const card of document.querySelectorAll("details")){
   const summary=card.querySelector(":scope > summary");
   const key="details-"+summary.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-");
   card.dataset.card=key;card.open=typeof saved[key]==="boolean"?saved[key]:!card.hasAttribute("data-default-collapsed");states[key]=card.open;
   card.addEventListener("toggle",()=>remember(key,card.open));
  }
 }

 const TAB_KEY="car-financing-calculator.tab.v1";
 function selectTab(name,focus=false){
  onNavigate();
  const panels={setup:"inputs",results:"comparison",graphs:"graphs"};
  if(!Object.hasOwn(panels,name))name="setup";
  for(const [key,panel] of Object.entries(panels)){
   const selected=name===key,tab=$("tab-"+key);
   tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;$(panel).hidden=!selected;
  }
  if(focus)$("tab-"+name).focus();
  try{storage.setItem(TAB_KEY,name);}catch{}
 }
 function initializeTabs(){
  const names=["setup","results","graphs"];
  for(const name of names){
   $("tab-"+name).addEventListener("click",()=>selectTab(name));
   $("tab-"+name).addEventListener("keydown",event=>{
    let index=names.indexOf(name);
    if(event.key==="ArrowRight")index=(index+1)%3;
    else if(event.key==="ArrowLeft")index=(index+2)%3;
    else if(event.key==="Home")index=0;
    else if(event.key==="End")index=2;
    else return;
    event.preventDefault();selectTab(names[index],true);
   });
  }
  let name="setup";try{name=storage.getItem(TAB_KEY)||name;}catch{}
  selectTab(name);
 }
 function initialize(){
  updateThemeButton();
  $("themeToggle").addEventListener("click",()=>{
   const theme=document.documentElement.dataset.theme==="dark"?"light":"dark";
   document.documentElement.dataset.theme=theme;updateThemeButton();
   try{storage.setItem("car-financing-calculator.theme",theme);$("themeToggle").title=t("shell.themeChoiceSavedInThisBrowser");}
   catch{$("themeToggle").title=t("shell.themeAppliesForThisSessionBrowserStorageIs");}
  });
  // Escape dismisses a keyboard-focused explanation without changing any inputs.
  document.addEventListener("keydown",event=>{
   if(event.key==="Escape"&&document.activeElement?.classList.contains("help-button"))document.activeElement.blur();
  });
  initializeCards();initializeTabs();
  $("licensingLink").addEventListener("click",()=>{
   const license=$("software-license");license.open=true;
   license.querySelector("summary").focus({preventScroll:true});
  });
 }
 function refresh(){updateThemeButton();for(const render of refreshers)render();}
 return {initialize,selectTab,refresh};
}
