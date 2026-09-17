import {variants} from "./model.mjs";

/** Own theme, collapsible cards and tab navigation. */
export function createShell({document,storage,onNavigate}){
 const $=id=>document.getElementById(id);
 function updateThemeButton(){
  const dark=document.documentElement.dataset.theme==="dark";
  $("themeToggle").setAttribute("aria-pressed",String(dark));
  $("themeToggle").textContent=dark?"Dark mode: on":"Dark mode: off";
 }

 const CARD_STATE_KEY="car-financing-calculator.cards.v1";
 function initializeCards(){
  let saved={};
  try{const value=JSON.parse(storage.getItem(CARD_STATE_KEY)||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))saved=value;}catch{}
  const states={};
  function remember(key,expanded){
   states[key]=expanded;
   try{storage.setItem(CARD_STATE_KEY,JSON.stringify(states));}
   catch{$("storageStatus").textContent="Card state applies for this session. Browser storage is unavailable.";}
  }
  for(const card of document.querySelectorAll("section.panel,section.total,section.verdict,section.scenario-toolbar")){
   const original=card.querySelector(":scope > .section-title")||card.querySelector(":scope > h2")||card.querySelector(":scope > .eyebrow");
   const title=card.id==="verdict"?"Overall result":card.classList.contains("scenario-toolbar")?"Saved scenarios":
    original?.querySelector("h2")?.firstChild.textContent.trim()||original?.firstChild.textContent.trim()||"Card";
   const originalOptionKey=card.classList.contains("option-panel")?variants.find(v=>v.kind===card.dataset.option)?.fields[0]:null;
   const key=card.dataset.cardKey||card.id||originalOptionKey||card.querySelector("input[id]:not([data-opportunity-view]),select[id],tbody[id]")?.id||(card.dataset.option?"total-"+card.dataset.option:title.toLowerCase().replace(/[^a-z0-9]+/g,"-"));
   const header=document.createElement("div");header.className="card-heading";
   const heading=card.id==="verdict"||card.classList.contains("scenario-toolbar")?null:original;
   if(heading)header.appendChild(heading);
   else{const label=document.createElement("h2");label.textContent=title;header.appendChild(label);}
   const body=document.createElement("div");body.className="card-body";body.id="card-body-"+key;
   while(card.firstChild)body.appendChild(card.firstChild);
   const button=document.createElement("button");button.type="button";button.className="card-toggle";
   button.setAttribute("aria-controls",body.id);header.appendChild(button);
   card.append(header,body);card.classList.add("collapsible-card");card.dataset.card=key;
   function expand(open){
    body.hidden=!open;card.dataset.collapsed=String(!open);button.setAttribute("aria-expanded",String(open));
    button.textContent=open?"−":"+";button.setAttribute("aria-label",(open?"Collapse ":"Expand ")+title);
    states[key]=open;
   }
   expand(typeof saved[key]==="boolean"?saved[key]:true);
   button.addEventListener("click",()=>{expand(body.hidden);remember(key,!body.hidden);});
  }
  for(const card of document.querySelectorAll("details")){
   const summary=card.querySelector(":scope > summary");
   const key="details-"+summary.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-");
   card.dataset.card=key;card.open=typeof saved[key]==="boolean"?saved[key]:true;states[key]=card.open;
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
   try{storage.setItem("car-financing-calculator.theme",theme);$("themeToggle").title="Theme choice saved in this browser.";}
   catch{$("themeToggle").title="Theme applies for this session. Browser storage is unavailable.";}
  });
  // Escape dismisses a keyboard-focused explanation without changing any inputs.
  document.addEventListener("keydown",event=>{
   if(event.key==="Escape"&&document.activeElement?.classList.contains("help-button"))document.activeElement.blur();
  });
  initializeCards();initializeTabs();
 }
 return {initialize,selectTab};
}
