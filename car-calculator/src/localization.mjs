import {createTranslator} from "./i18n.mjs";
export const LANGUAGE_KEY="car-financing-calculator.language.v1";

/** Bind explicit template keys and own the language preference; currency belongs to scenarios. */
export function createLocalization({document,storage,i18n=createTranslator(),onLanguageChange=()=>{}}){
 const $=id=>document.getElementById(id);let initialized=false;
 const attributes=["title","aria-label","aria-valuetext","placeholder","alt","content"];
 function apply(){
  if(!initialized)return;
  for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=i18n.t(element.getAttribute('data-i18n'));
  for(const attribute of attributes)for(const element of document.querySelectorAll('[data-i18n-'+attribute+']'))element.setAttribute(attribute,i18n.t(element.getAttribute('data-i18n-'+attribute)));
  document.documentElement.lang=i18n.language;
  if($("software-license-cs"))$("software-license-cs").hidden=i18n.language!=="cs";
 }
 function setPreferences(language,currency,{persist=true}={}){
  i18n.configure({language,currency});
  $("languageSelect").value=i18n.language;$("currency").value=i18n.currency;
  if(persist)try{storage.setItem(LANGUAGE_KEY,i18n.language);}catch{i18n.setMessage($("storageStatus"),()=>i18n.t("common.languageSessionOnly"));}
  apply();onLanguageChange();
 }
 function initialize(){
  if(initialized)return;initialized=true;
  let language="en";try{language=storage.getItem(LANGUAGE_KEY)||"en";}catch{}
  i18n.configure({releaseVersion:document.documentElement.dataset?.releaseVersion||""});
  setPreferences(language,$("currency").value||"CZK",{persist:false});
  $("languageSelect").addEventListener("change",event=>setPreferences(event.target.value,i18n.currency));
 }
 return {initialize,apply,setPreferences,t:i18n.t,get language(){return i18n.language;},get currency(){return i18n.currency;}};
}
