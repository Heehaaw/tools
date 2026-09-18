import {createInstance} from "./vendor/i18next.mjs";
import {messages as en} from "./locales/en.mjs";
import {messages as cs} from "./locales/cs.mjs";
import {currencies} from "./model.mjs";
import {num} from "./format.mjs";

/** One isolated translation/formatting instance; inline resources work without a server. */
export function createTranslator(){
 const instance=createInstance();
 instance.init({lng:"en",fallbackLng:"en",supportedLngs:["en","cs"],resources:{en:{translation:en},cs:{translation:cs}},initAsync:false,keySeparator:false,interpolation:{escapeValue:false},returnNull:false});
 let currency="CZK",past=false,releaseVersion="";
 const messages=new Map();
 // Remember the message recipe, not rendered prose, so persistent notices follow language changes.
 function setMessage(element,render){messages.set(element,render);element.textContent=render();}
 function t(key,values={}){return instance.t(key,{context:past?"past":undefined,currency:currencies[currency],RELEASE_VERSION:releaseVersion,...values});}
 function configure(settings={}){
  if(settings.language!==undefined)instance.changeLanguage(settings.language==="cs"?"cs":"en");
  if(settings.currency!==undefined)currency=Object.hasOwn(currencies,settings.currency)?settings.currency:"CZK";
  if(settings.past!==undefined)past=Boolean(settings.past);
  if(settings.releaseVersion!==undefined)releaseVersion=settings.releaseVersion;
  for(const [element,render] of messages)element.textContent=render();
 }
 const money=value=>num(Math.abs(value)<.5?0:value)+" "+currencies[currency];
 const ratePercent=value=>new Intl.NumberFormat(instance.language,{maximumFractionDigits:2}).format(value)+(instance.language==="cs"?" %":"%");
 const returnBasisLabel=s=>t(s.opportunityRateBasis==="real"?"common.returnReal":"common.returnNominal");
 const returnSummary=s=>t("common.returnSummary",{rate:ratePercent(s.opportunityRate),basis:returnBasisLabel(s)});
 const variantName=kind=>t("financing."+kind+".title");
 const variants=list=>list.map(v=>({...v,get name(){return variantName(v.kind);}}));
 const errorMessage=error=>error.messageKey?t(error.messageKey,error.messageValues):error.message;
 return {t,configure,setMessage,money,num,ratePercent,returnBasisLabel,returnSummary,variantName,variants,errorMessage,
  get language(){return instance.language;},get currency(){return currency;},get symbol(){return currencies[currency];}};
}
