import {messages} from "./locales/en.mjs";

/** Preserve English Error.message for model callers while giving the UI a stable translation key. */
export function messageError(key,values={}){
 const error=new Error((messages[key]||key).replace(/\{\{([^},]+)(?:,[^}]+)?\}\}/g,(_,name)=>String(values[name]??"")));
 error.messageKey=key;error.messageValues=values;return error;
}
