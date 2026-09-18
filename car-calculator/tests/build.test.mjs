import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildStandalone,bundleModules} from '../build.mjs';

const projectDirectory=resolve(dirname(fileURLToPath(import.meta.url)),'..');

async function fixture(files){
 const directory=await mkdtemp(join(tmpdir(),'car-calculator-build-'));
 await Promise.all(Object.entries(files).map(async([name,source])=>{
  const path=join(directory,name);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,source);
 }));
 return directory;
}

test('the checked-in standalone artifact exactly matches a deterministic source build',async()=>{
 const [first,second,artifact]=await Promise.all([
  buildStandalone({output:null}),
  buildStandalone({output:null}),
  readFile(join(projectDirectory,'car-financing-calculator.html'),'utf8')
 ]);

 assert.equal(first,second);
 assert.equal(artifact,first);
 assert.match(first,/const __modules=Object\.create\(null\)/);
 assert.doesNotMatch(first,/<link\b[^>]*\brel=["']stylesheet["']/i);
 assert.doesNotMatch(first,/<script\b[^>]*\bsrc=/i);
});

test('module scopes stay isolated, aliases resolve, and a shared dependency runs once',async()=>{
 const directory=await fixture({
  'shared.mjs':'globalThis.sharedRuns=(globalThis.sharedRuns??0)+1;\nexport const value=7;\n',
  'left.mjs':'import {value as sharedValue} from "./shared.mjs";\nconst label="left";\nexport const read=()=>label+sharedValue;\n',
  'right.mjs':'import {value} from "./shared.mjs";\nconst label="right";\nexport function read(){return label+value;}\n',
  'entry.mjs':'import {read as readLeft} from "./left.mjs";\nimport {read as readRight} from "./right.mjs";\nglobalThis.result=[readLeft(),readRight()];\nexport const ready=true;\n'
 });

 try{
  const context={};
  vm.runInNewContext(await bundleModules(join(directory,'entry.mjs')),context);

  assert.deepEqual([...context.result],['left7','right7']);
  assert.equal(context.sharedRuns,1);
  assert.equal(context.label,undefined);
 }finally{
  await rm(directory,{recursive:true,force:true});
 }
});

test('invalid module graphs fail with useful errors',async t=>{
 await t.test('circular dependencies',async()=>{
  const directory=await fixture({
   'entry.mjs':'import {dependency} from "./dependency.mjs";\nexport const entry=dependency;\n',
   'dependency.mjs':'import {entry} from "./entry.mjs";\nexport const dependency=entry;\n'
  });
  try{
   await assert.rejects(bundleModules(join(directory,'entry.mjs')),/Circular module dependency: \.\/entry\.mjs -> \.\/dependency\.mjs -> \.\/entry\.mjs/);
  }finally{
   await rm(directory,{recursive:true,force:true});
  }
 });

 await t.test('missing named exports',async()=>{
  const directory=await fixture({
   'entry.mjs':'import {missing} from "./dependency.mjs";\nexport const entry=missing;\n',
   'dependency.mjs':'export const present=true;\n'
  });
  try{
   await assert.rejects(bundleModules(join(directory,'entry.mjs')),/\.\/dependency\.mjs does not export missing \(imported by \.\/entry\.mjs\)/);
  }finally{
   await rm(directory,{recursive:true,force:true});
  }
 });

 await t.test('external imports',async()=>{
  const directory=await fixture({
   'entry.mjs':'import {readFile} from "node:fs/promises";\nexport const entry=readFile;\n'
  });
  try{
   await assert.rejects(bundleModules(join(directory,'entry.mjs')),/Only local imports are supported: node:fs\/promises/);
  }finally{
   await rm(directory,{recursive:true,force:true});
  }
 });
});

test('raw script closing tags cannot escape the generated inline script',async()=>{
 const directory=await fixture({
  'index.html':'<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><script type="module" src="./app.mjs"></script></body></html>\n',
  'style.css':'body { color: black; }\n',
  'app.mjs':'export const payload="</script><p>escaped</p>";\n'
 });

 try{
  const html=await buildStandalone({src:directory,output:null});

  assert.ok(html.includes('<\\/script><p>escaped</p>'));
  assert.equal(html.match(/<\/script/gi)?.length,1);
  assert.deepEqual((await readdir(directory)).sort(),['app.mjs','index.html','style.css']);
 }finally{
  await rm(directory,{recursive:true,force:true});
 }
});

test('release header uses the newest ledger entry without runtime dependencies or changing the ledger',async()=>{
 const directory=await fixture({
  'index.html':'<link rel="stylesheet" href="./style.css"><a href="./RELEASE_NOTES.md">v{{RELEASE_VERSION}}</a><script type="module" src="./app.mjs"></script>',
  'style.css':'body{color:black}',
  'app.mjs':'export const ready=true;',
  'RELEASE_NOTES.md':'# Release notes\n\n## 2026.09.18.4 (2026-09-18)\n\n- New release.\n\n## 2026.09.17.2 (2026-09-17)\n\n- Earlier release.\n'
 });
 try{
  const path=join(directory,'RELEASE_NOTES.md'),before=await readFile(path,'utf8');
  const options={src:directory,output:null,releaseNotes:path};
  const first=await buildStandalone(options),second=await buildStandalone(options);
  assert.equal(first,second);
  assert.match(first,/v2026\.09\.18\.4<\/a>/);
  assert.doesNotMatch(first,/\{\{RELEASE_/);
  assert.equal(await readFile(path,'utf8'),before);
  const artifact=await readFile(join(projectDirectory,'car-financing-calculator.html'),'utf8');
  const notes=await readFile(join(projectDirectory,'RELEASE_NOTES.md'),'utf8');
  const [,version]=notes.match(/^## ([\d.]+) \((\d{4}-\d{2}-\d{2})\)$/m);
  assert.ok(artifact.includes('Release notes · v'+version));
  assert.ok(artifact.includes('Release notes · v'+version+'</a>'));
  assert.ok(artifact.includes('./RELEASE_NOTES.md'));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('invalid latest release metadata fails rather than silently using an older release',async()=>{
 const directory=await fixture({
  'index.html':'<link rel="stylesheet" href="./style.css"><script type="module" src="./app.mjs"></script>',
  'style.css':'body{color:black}',
  'app.mjs':'export const ready=true;'
 });
 try{
  const path=join(directory,'RELEASE_NOTES.md');
  for(const heading of ['Unreleased','2026.09.18.1 (2026-09-17)','2026.02.31.1 (2026-02-31)','2026.09.18.0 (2026-09-18)']){
   await writeFile(path,'# Release notes\n\n## '+heading+'\n\n## 2026.01.01.1 (2026-01-01)\n');
   await assert.rejects(buildStandalone({src:directory,output:null,releaseNotes:path}),/Newest release heading must be/);
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});


test('standalone copies carry the complete license and every required notice offline',async()=>{
 const [html,license,notice]=await Promise.all([
  buildStandalone({output:null}),
  readFile(join(projectDirectory,'../LICENSE'),'utf8'),
  readFile(join(projectDirectory,'../NOTICE'),'utf8')
 ]);
 const decode=value=>value.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
 assert.equal(decode(html.match(/<pre id="software-license-text">([\s\S]*?)<\/pre>/)[1]),license);
 assert.equal(decode(html.match(/<pre id="software-license-notice">([\s\S]*?)<\/pre>/)[1]),notice);
 assert.doesNotMatch(html,/\{\{LICENSE_/);
 assert.match(html,/<details class="software-license" data-default-collapsed id="software-license">/);
});

test('license text cannot create markup or execute code in the standalone page',async()=>{
 const text='Terms & notices <example> $& $` </pre><script>untrusted()</script>\n';
 const directory=await fixture({
  'index.html':'<link rel="stylesheet" href="./style.css"><pre>{{LICENSE_TEXT}}</pre><pre>{{LICENSE_NOTICE}}</pre><script type="module" src="./app.mjs"></script>',
  'style.css':'body{color:black}',
  'app.mjs':'export const ready=true;',
  'LICENSE':text,'NOTICE':text
 });
 try{
  const html=await buildStandalone({src:directory,output:null,licenseFile:join(directory,'LICENSE'),noticeFile:join(directory,'NOTICE')});
  assert.equal(html.match(/<script\b/g)?.length,1);
  assert.equal(html.match(/<\/pre>/g)?.length,2);
  assert.ok(html.includes('Terms &amp; notices &lt;example&gt; $&amp; $` &lt;/pre&gt;&lt;script&gt;untrusted()&lt;/script&gt;'));
  assert.equal(await readFile(join(directory,'LICENSE'),'utf8'),text);
 }finally{await rm(directory,{recursive:true,force:true});}
});
