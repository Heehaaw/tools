import {formatNumberInput,parseNumber} from "./format.mjs";

/** Render and operate a dated annual-input dialog without owning the saved scenario values. */
export function createYearEditor({document,prefix,dialogId,openerId,closeIds,gridId,datasetKey,unit,maxYears=10,staticFields=false,baseMax=100000,step=500,limit=Infinity,describe}){
 const $=id=>document.getElementById(id),fields=new Map();let enabled=false;
 function field(index){
  if(fields.has(index))return fields.get(index);
  const n=index+1;
  let result;
  if(staticFields)result={card:$(prefix+n),period:$(prefix+"Period"+n),slider:$(prefix+"Slider"+n),amount:$(prefix+"Amount"+n),total:$(prefix+"Total"+n)};
  else{
   const card=document.createElement("div");card.className="additional-year";card.id=prefix+n;
   function child(tag,id,text){const node=document.createElement(tag);if(id)node.id=id;if(text)node.textContent=text;card.appendChild(node);return node;}
   const label=child("label",null,"Year "+n);label.htmlFor=prefix+"Amount"+n;
   const period=child("small",prefix+"Period"+n),slider=child("input",prefix+"Slider"+n),amount=child("input",prefix+"Amount"+n);
   slider.type="range";slider.min="0";slider.step=String(step);slider.dataset[datasetKey]=String(index);slider.setAttribute("aria-label","Year "+n+" · "+unit);
   amount.type="text";amount.inputMode="decimal";amount.className="numeric-input";amount.dataset[datasetKey]=String(index);amount.setAttribute("aria-label","Year "+n+" · "+unit);
   child("small",null,unit);const total=child("small",prefix+"Total"+n);total.className="additional-year-total";
   $(gridId).appendChild(card);result={card,period,slider,amount,total};
  }
  fields.set(index,result);return result;
 }
 function render({months,values,active}){
  const count=Number.isFinite(months)&&months>0?Math.ceil(months/12):0;enabled=active&&count>0&&count<=maxYears;
  $(openerId).disabled=!enabled;
  if(!active)close();
  const maximum=Math.min(limit,Math.max(baseMax,...values.filter(Number.isFinite).map(value=>Math.ceil(value/baseMax)*baseMax)));
  for(let i=0;i<Math.min(count,maxYears);i++){
   const {card,period,slider,amount,total}=field(i),value=values[i],duration=Math.min(12,months-i*12);
   card.hidden=false;amount.disabled=slider.disabled=!enabled;
   if(document.activeElement!==amount)amount.value=Number.isFinite(value)?formatNumberInput(value):"";
   slider.max=String(maximum);slider.value=String(Number.isFinite(value)?value:0);slider.setAttribute("aria-valuetext",Number.isFinite(value)?formatNumberInput(value)+" "+unit:"No amount entered");
   period.textContent="Months "+(i*12+1)+"–"+(i*12+duration);total.textContent=Number.isFinite(value)?describe(value,duration):"Enter an amount";
  }
  for(const [i,{card,amount,slider}] of fields)if(i>=count){card.hidden=true;amount.disabled=slider.disabled=true;}
 }
 function open(){if(!enabled||$(dialogId).open)return;$(dialogId).showModal();field(0).slider.focus();}
 function close(){if($(dialogId).open)$(dialogId).close();}
 function editedValues(target,values,fallback){
  if(target?.dataset?.[datasetKey]===undefined)return null;
  const index=Number(target.dataset[datasetKey]);if(!Number.isInteger(index)||index<0||index>=maxYears)return null;
  const next=[...values];while(next.length<=index)next.push(fallback);
  const value=parseNumber(target.value);next[index]=target.value.trim()===""?null:Number.isFinite(value)?value:target.value;return next;
 }
 function initialize(){ $(openerId).addEventListener("click",open);for(const id of closeIds)$(id).addEventListener("click",close); }
 return {render,open,close,editedValues,initialize};
}
