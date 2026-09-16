import {readFile,writeFile} from "node:fs/promises";

const read=name=>readFile(new URL("./src/"+name,import.meta.url),"utf8");
const [template,css,modelSource,appSource]=await Promise.all(
 ["index.html","style.css","model.mjs","app.mjs"].map(read)
);
if(!template.includes('<link rel="stylesheet" href="./style.css">')||
 !template.includes('<script type="module" src="./app.mjs"></script>')){
 throw new Error("The source template is missing a stylesheet or script entry point.");
}
// Keep the distributed file self-contained for direct file:// use.
const model=modelSource.replaceAll("export const ","const ").replaceAll("export function ","function ");
const app=appSource.replace(/^\s*import[^\n]*\n/,"");
const html=template
 .replace('<link rel="stylesheet" href="./style.css">',()=>"<style>"+css+"</style>")
 .replace('<script type="module" src="./app.mjs"></script>',()=>'<script type="module">\n'+model+app+'\n</script>');
await writeFile(new URL("./car-financing-calculator.html",import.meta.url),html);
console.log("Built car-calculator/car-financing-calculator.html");
