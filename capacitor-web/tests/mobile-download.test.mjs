import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const compiled=await build({absWorkingDir:root,entryPoints:['src/application/download.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['@capacitor/core','@capacitor/filesystem','@capacitor/share'],plugins:[{name:'document-fixtures',setup(build){
 build.onResolve({filter:/^\.\/(pdf|hwp)$/},args=>({path:args.path,namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.endsWith('pdf')?'export async function applicationPdf(){const bytes=new Uint8Array(1100000);bytes.set([37,80,68,70,45]);return bytes;}':'export async function applicationHwp(){return new Uint8Array([208,207,17,224,161,177,26,225]);}',loader:'js'}));
}}]});
function load(platform,{save=async()=>({saved:true}),write=async()=>({uri:'file:///cache/document.pdf'}),share=async()=>({})}={}){
 const module={exports:{}};
 const require=name=>{
  if(name==='@capacitor/core')return{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform},registerPlugin:()=>({save})};
  if(name==='@capacitor/filesystem')return{Filesystem:{writeFile:write},Directory:{Cache:'CACHE'}};
  if(name==='@capacitor/share')return{Share:{share}};
  throw Error(name);
 };
 new Function('require','module','exports',compiled.outputFiles[0].text)(require,module,module.exports);return module.exports.downloadApplicationFile;
}
test('Android saves a large PDF by a small cached-file URI, avoiding the activity Binder limit',async()=>{
 const saved=[],cache=[];const download=load('android',{save:async value=>{saved.push(value);return{saved:true};},write:async value=>{cache.push(value);return{uri:'file:///cache/document-'+cache.length};},share:()=>assert.fail('unexpected sharing')});
 await download({},'pdf');await download({},'hwp');
 assert.equal(saved[0].filename,'DARI-application.pdf');assert.equal(Buffer.from(cache[0].data,'base64').length,1100000);assert.equal(saved[0].uri,'file:///cache/document-1');
 assert.ok(JSON.stringify(saved[0]).length<200);assert.equal(saved[0].data,undefined);
 assert.equal(saved[1].filename,'DARI-application.hwp');assert.equal(Buffer.from(cache[1].data,'base64').toString('hex'),'d0cf11e0a1b11ae1');
});
test('Android save cancellation is normal, but a write failure remains visible',async()=>{
 await load('android',{save:async()=>({saved:false})})({},'pdf');
 await assert.rejects(load('android',{save:async()=>{throw Error('SAVE_FAILED');}})({},'pdf'),/SAVE_FAILED/);
});
test('iPhone shares the saved native file and keeps it available after handing off',async()=>{
 let file,shared;await load('ios',{save:()=>assert.fail(),write:async options=>{file=options;return{uri:'file:///cache/exports/document.pdf'};},share:async options=>{shared=options;return{};}})({},'pdf');
 assert.equal(file.directory,'CACHE');assert.equal(Buffer.from(file.data,'base64').subarray(0,5).toString(),'%PDF-');assert.deepEqual(shared.files,['file:///cache/exports/document.pdf']);
});
test('iPhone share cancellation is normal while other native errors are propagated',async()=>{
 await load('ios',{share:async()=>{throw Error('Share canceled');}})({},'pdf');
 await assert.rejects(load('ios',{share:async()=>{throw Error('File inaccessible');}})({},'pdf'),/File inaccessible/);
});
