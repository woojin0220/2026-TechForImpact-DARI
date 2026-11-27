import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const bundle=await build({absWorkingDir:root,entryPoints:['src/lib/nativeTranslation.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['@capacitor/core']});
function runtime(plugin,available=true){
 const module={exports:{}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(()=>({registerPlugin:()=>plugin,Capacitor:{isNativePlatform:()=>true,isPluginAvailable:()=>available}}),module,module.exports);
 return module.exports;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('native translation passes original text unchanged to ML Kit without downloading existing models',async()=>{
 const seen=[];
 const api=runtime({getStatus:async()=>({ready:true}),prepare:()=>assert.fail('unexpected download'),translate:async options=>{seen.push(options);return {translation:'그들이 경찰인지는 확실하지 않습니다.'};}});
 const original='I think they were police, but I am not sure.\n\nI do not remember the date.';
 assert.equal(await api.translateOnDevice(original,'en','ko'),'그들이 경찰인지는 확실하지 않습니다.');
 assert.deepEqual(seen,[{text:original,sourceLanguage:'en',targetLanguage:'ko'}]);
 assert.equal(api.translationSetup.snapshot(),null);
});
test('first-use download waits for explicit consent and defaults to Wi-Fi',async()=>{
 const seen=[];
 const api=runtime({getStatus:async()=>({ready:false}),prepare:async options=>seen.push(options),translate:async()=>({translation:'번역문'})});
 const job=api.translateOnDevice('test','en','ko');await tick();
 assert.equal(seen.length,0);assert.equal(api.translationSetup.snapshot().downloading,false);
 await api.translationSetup.download(false);
 assert.equal(await job,'번역문');assert.deepEqual(seen,[{sourceLanguage:'en',targetLanguage:'ko',allowCellular:false}]);
});
test('failed download can retry with mobile data; no translation before success',async()=>{
 let tries=0,translations=0;
 const api=runtime({getStatus:async()=>({ready:false}),prepare:async options=>{tries++;if(tries===1)throw Error('offline');assert.equal(options.allowCellular,true);},translate:async()=>{translations++;return{translation:'번역문'};}});
 const job=api.translateOnDevice('test','en','ko');await tick();await api.translationSetup.download(false);
 assert.equal(api.translationSetup.snapshot().error,true);assert.equal(translations,0);
 await api.translationSetup.download(true);await job;assert.equal(translations,1);
});
test('cancelled download cannot resolve a later question or overwrite its dialog',async()=>{
 let complete;let tries=0;
 const api=runtime({getStatus:async()=>({ready:false}),prepare:()=>{tries++;return new Promise(resolve=>{complete=resolve;});},translate:async()=>({translation:'번역문'})});
 const first=api.translateOnDevice('first','en','ko');const rejected=assert.rejects(first,/TRANSLATION_CANCELLED/);await tick();
 const download=api.translationSetup.download(false);api.translationSetup.cancel();await rejected;
 const second=api.translateOnDevice('second','ru','en');const secondRejected=assert.rejects(second,/TRANSLATION_CANCELLED/);await tick();
 complete();await download;
 assert.equal(api.translationSetup.snapshot().sourceLanguage,'ru');assert.equal(api.translationSetup.snapshot().downloading,false);assert.equal(tries,1);
 api.translationSetup.cancel();await secondRejected;
});
test('community background translation never triggers an unexpected download',async()=>{
 const api=runtime({getStatus:async()=>({ready:false}),prepare:()=>assert.fail(),translate:()=>assert.fail()});
 await assert.rejects(api.translateOnDevice('post','ar','ko',false),/TRANSLATION_MODEL_REQUIRED/);
 assert.equal(api.translationSetup.snapshot(),null);
});
test('missing native plugin fails explicitly instead of calling an LLM or server',async()=>{
 const api=runtime({},false);await assert.rejects(api.translateOnDevice('test','en','ko'),/TRANSLATOR_UNAVAILABLE/);
});
test('feedback entry is off in production and enabled only for development or explicit feedback mode',async()=>{
 for(const [mode,dev,expected] of [['production',false,false],['feedback',false,true],['development',true,true]]){
  const out=await build({absWorkingDir:root,entryPoints:['src/platform/feedbackBuild.ts'],bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':JSON.stringify({MODE:mode,DEV:dev})}});
  const module={exports:{}};new Function('module','exports',out.outputFiles[0].text)(module,module.exports);
  assert.equal(module.exports.localTestEntryEnabled,expected,mode);
 }
});
test('both native platforms prepare community language models over Wi-Fi and use ML Kit without an LLM',async()=>{
 const result=await build({absWorkingDir:root,entryPoints:['src/community/translationEngine.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['@capacitor/core'],plugins:[{name:'no-intake-model',setup(build){build.onResolve({filter:/intakeModel$/},()=>({path:'intake',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function getIntakeRuntimeStatus(){throw Error("Unexpected LLM");} export function generateIntakeModel(){throw Error("Unexpected LLM");}',loader:'js'}));}}]});
 for(const platform of ['android','ios']){
  const calls=[];const plugin={prepare:async options=>calls.push(options),translate:async options=>({translation:'번역문'})};const module={exports:{}};
  new Function('require','module','exports',result.outputFiles[0].text)(()=>({registerPlugin:()=>plugin,Capacitor:{getPlatform:()=>platform,isNativePlatform:()=>true,isPluginAvailable:()=>true}}),module,module.exports);
  const translator=await module.exports.deviceTranslator();assert.equal(await translator.translate('sample','ar','ko'),'번역문');assert.deepEqual(calls,[{sourceLanguage:'ar',targetLanguage:'ko',allowCellular:false}]);
 }
});
