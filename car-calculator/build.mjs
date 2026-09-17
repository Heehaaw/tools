import {readFile,writeFile} from "node:fs/promises";
import {dirname,relative,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";

const projectDirectory=dirname(fileURLToPath(import.meta.url));
const sourceDirectory=resolve(projectDirectory,"src");

/** Bundle the project's acyclic named-import modules into isolated closures, without runtime fetching. */
export async function bundleModules(entryFile){
 const root=dirname(entryFile),modules=new Map(),visiting=[];
 const id=file=>"./"+relative(root,file).split(sep).join("/");
 async function visit(file){
  if(modules.has(file))return modules.get(file);
  if(visiting.includes(file))throw new Error("Circular module dependency: "+[...visiting,file].map(id).join(" -> "));
  visiting.push(file);
  let source=await readFile(file,"utf8");
  const imports=[];
  source=source.replace(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?\s*$/gm,(_,bindings,specifier)=>{
   if(!specifier.startsWith("./")&&!specifier.startsWith("../"))throw new Error("Only local imports are supported: "+specifier);
   const dependency=resolve(dirname(file),specifier),path=relative(root,dependency);
   if(path.startsWith(".."+sep)||path===".."||!dependency.endsWith(".mjs"))throw new Error("Import must name an .mjs file inside src: "+specifier);
   const names=bindings.split(",").map(value=>value.trim()).filter(Boolean).map(value=>{
    const match=value.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
    if(!match)throw new Error("Unsupported import binding in "+id(file)+": "+value);
    return {exported:match[1],local:match[2]||match[1]};
   });
   imports.push({dependency,names});
   return "\n";
  });
  if(/^\s*import\b/m.test(source)||/\bimport\s*(?:\(|\.)/.test(source))throw new Error("Unsupported import syntax in "+id(file));
  const exports=[];
  source=source.replace(/^export (const|function) ([\w$]+)/gm,(_,kind,name)=>{exports.push(name);return kind+" "+name;});
  if(/^\s*export\b/m.test(source))throw new Error("Only named const/function exports are supported in "+id(file));
  for(const {dependency,names} of imports){
   const imported=await visit(dependency);
   for(const {exported} of names)if(!imported.exports.includes(exported))throw new Error(id(dependency)+" does not export "+exported+" (imported by "+id(file)+")");
  }
  const bindings=imports.map(({dependency,names})=>"const {"+names.map(({exported,local})=>exported===local?local:exported+":"+local).join(",")+"}=__modules["+JSON.stringify(id(dependency))+"];\n").join("");
  const code="// "+id(file)+"\n__modules["+JSON.stringify(id(file))+"]=(()=>{\n"+bindings+source.trim()+"\nreturn Object.freeze({"+exports.join(",")+"});\n})();\n";
  const module={exports,code};modules.set(file,module);visiting.pop();return module;
 }
 await visit(resolve(entryFile));
 const bundle="const __modules=Object.create(null);\n"+[...modules.values()].map(module=>module.code).join("\n");
 // Parse the final script as well as validating the module graph, catching name collisions and unsupported syntax.
 new Script(bundle,{filename:"car-calculator-bundle.js"});
 return bundle;
}

/** Build the shareable file from source; returned HTML also allows deterministic artifact checks. */
export async function buildStandalone({src=sourceDirectory,output=resolve(projectDirectory,"car-financing-calculator.html")}={}){
 const [template,css,bundle]=await Promise.all([
  readFile(resolve(src,"index.html"),"utf8"),readFile(resolve(src,"style.css"),"utf8"),bundleModules(resolve(src,"app.mjs"))
 ]);
 const stylesheet='<link rel="stylesheet" href="./style.css">',entry='<script type="module" src="./app.mjs"></script>';
 if(!template.includes(stylesheet)||!template.includes(entry))throw new Error("The source template is missing a stylesheet or script entry point.");
 // Escape raw-text closing tags so a string in a module cannot terminate its containing HTML element.
 const html=template.replace(stylesheet,()=>"<style>"+css.replace(/<\/style/gi,"<\\/style")+"</style>")
  .replace(entry,()=>'<script type="module">\n'+bundle.replace(/<\/script/gi,"<\\/script")+'\n</script>');
 if(output!==null)await writeFile(output,html);
 return html;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await buildStandalone();
 console.log("Built car-calculator/car-financing-calculator.html");
}
