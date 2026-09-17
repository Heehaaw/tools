// Pure display and input conversion helpers. Stored values remain numbers.
export const ratePercent=value=>new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(value)+"%";
const absValue=n=>Math.abs(n)<.5?0:n;
export const money=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(absValue(n)).replaceAll("\u00a0","\u202f")+" Kč";
export const num=n=>new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(n).replaceAll("\u00a0","\u202f");

export function ungroupNumber(value){return String(value??"").replace(/[ \u00a0\u202f\u2009]/g,"").replace(",",".");}

export function parseNumber(value){
 const raw=ungroupNumber(value);
 return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)?Number(raw):NaN;
}

export function formatNumberInput(value){
 const raw=ungroupNumber(value);
 if(!Number.isFinite(parseNumber(raw)))return String(value??"");
 const parts=raw.match(/^([+-]?)(\d+)(\.\d*)?$/);
 return parts?parts[1]+parts[2].replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f")+(parts[3]||""):raw;
}

export function returnBasisLabel(s){return "after tax, "+(s.opportunityRateBasis==="real"?"after inflation":"before inflation");}

export function returnSummary(s){return ratePercent(s.opportunityRate)+" p.a. "+returnBasisLabel(s);}
