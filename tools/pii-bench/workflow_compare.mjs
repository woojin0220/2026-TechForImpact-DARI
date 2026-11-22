// Live, fictional-only provider comparison using one request for either task.
// Local results are Mac Ollama measurements, not a phone/LiteRT-LM benchmark.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createSession,advanceConversation,guideConversation,generateDraft,getActiveFacts,
  setAuxiliaryPasses} from '../../capacitor-web/src/intake/index.ts';
import {scenarios} from '../../capacitor-web/src/bench/scenarios.ts';
import {scoreCheck} from '../../capacitor-web/src/bench/score.ts';
import {fullExportFixture} from '../../capacitor-web/tests/export-full-fixture.mjs';

const phase=process.argv[2];
if(!['conversation','draft'].includes(phase))throw Error('Choose conversation or draft');
const backend=process.argv[3]??'gemini';
if(!['gemini','local'].includes(backend))throw Error('Choose gemini or local');
const localModel=process.argv[4]??'gemma4:e4b';
if(!/^[a-zA-Z0-9._:-]+$/.test(localModel))throw Error('Invalid local model name');
setAuxiliaryPasses('selective');
const python=process.env.DARI_BENCH_PYTHON??'/private/tmp/dari-pii-bench-venv/bin/python';
const child=spawn(python,['tools/pii-bench/latency_worker.py'],{stdio:['pipe','pipe','inherit']});
let nextId=0;const pending=new Map();
const rejectPending=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
child.on('error',rejectPending);
child.on('exit',code=>rejectPending(Error(`Benchmark worker exited (${code})`)));
createInterface({input:child.stdout}).on('line',line=>{
 let message;try{message=JSON.parse(line);}catch{return;}
 const p=pending.get(message.id);if(!p)return;
 clearTimeout(p.timer);pending.delete(message.id);
 if(message.error)p.reject(Error(message.error));else p.resolve(message);
});
const sendWorker=message=>new Promise((resolve,reject)=>{
 const id=nextId++;
 const timer=setTimeout(()=>{pending.delete(id);reject(Error('Benchmark worker timeout'));child.kill();},240000);
 pending.set(id,{resolve,reject,timer});
 child.stdin.write(JSON.stringify({...message,id,mode:'current-provider'})+'\n');
});
async function send(message){
 if(backend==='gemini')return sendWorker(message);
 const warm=message.action==='warm', request=message.request;
 const started=performance.now();
 const response=await fetch('http://127.0.0.1:11434/api/chat',{
  method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(300000),
  body:JSON.stringify({model:localModel,stream:false,keep_alive:'30m',think:false,
   messages:warm?[{role:'user',content:'Reply OK.'}]:[{role:'system',content:request.system},{role:'user',content:request.prompt}],
   ...(!warm?{format:request.responseSchema}:{}),
   options:{temperature:.1,num_ctx:request.task==='draft'?32768:16384,num_predict:warm?1:request.task==='draft'?8192:3072}})});
 const result=await response.json();
 if(!response.ok)throw Error('Local model request failed');
 if(!warm&&result.done_reason==='length')throw Error('Local model output limit');
 if(!warm&&!result.message?.content?.trim())throw Error('Local model returned empty output');
 return {text:result.message?.content,ready:true,stats:{runtime:'ollama',model:localModel,
  totalMs:Math.round(performance.now()-started),loadMs:Math.round((result.load_duration??0)/1e6),
  prefillMs:Math.round((result.prompt_eval_duration??0)/1e6),decodeMs:Math.round((result.eval_duration??0)/1e6)},
  usage:{promptTokenCount:result.prompt_eval_count,candidatesTokenCount:result.eval_count}};
}
const policy=(_mode,handler)=>Object.assign(handler,{conversationMode:'single-call',draftMode:'single-call'});
const rows=[];
const modelSuffix=backend==='local'&&localModel!=='gemma4:e4b'?`-${localModel.replace(/[^a-zA-Z0-9._-]/g,'-')}`:'';
const output=`tools/pii-bench/results/2026-11-19/provider-${backend}${modelSuffix}-${phase}.json`;
const save=async()=>{await mkdir('tools/pii-bench/results/2026-11-19',{recursive:true});await writeFile(output,JSON.stringify({
  fixtureOnly:true,backend,model:backend==='local'?localModel:undefined,
  providerSettings:`One-call conversation and batch draft for both providers. Local: Mac M1 Pro 16 GB Ollama ${localModel} (not phone), think=false, ctx=16384 intake / 32768 full draft; Gemini current config.`,
  preparation:backend==='gemini'?'Only privacy models are loaded before timing. No exact input is pre-masked: masking, provider, restoration and local validation are included in totalMs.':
   'Local model warmed with a one-token request before timing; no privacy masking needed for local-only inference.',
  draftPolicy:'One batch, per-question local validation, omissions flagged, no repair requests',rows},null,2)+'\n');};
async function measure(mode,label,run){
 let first;
 try{await run(policy(mode,async request=>{first=request;throw Error('capture only');}));}catch{}
 if(!first)throw Error('Could not capture request');
 const warmStart=performance.now();await send({action:backend==='gemini'?'prepare':'warm',request:first});
 const row={phase,backend,mode,label,preparationMs:Math.round(performance.now()-warmStart),calls:[]};
 rows.push(row);await save();
 const adapter=policy(mode,async request=>{
  const prompt=JSON.parse(request.prompt);
  const original=prompt.originalTask??prompt;
  const call={task:request.task,questionId:original.questionId,repair:!!prompt.originalTask};
  row.calls.push(call);
  try{
   const result=await send({request});
   Object.assign(call,{ok:true,stats:result.stats,usage:result.usage});
   console.log(JSON.stringify({phase,mode,label,call:row.calls.length,...call}));
   await save();return result.text;
  }catch(error){call.ok=false;call.error=error.message;await save();throw error;}
 });
 const start=performance.now();
 try{
  const result=await run(adapter);
  if(phase==='conversation'){
   const scenario=scenarios.find(s=>s.id===label);
   row.checks=scenario.checks.map(c=>scoreCheck(getActiveFacts(result),result,c,'en'));
   row.nextQuestionReady=!!result.messages.at(-1)?.ask;
  }else{
   row.fixtureFacts=fullExportFixture().facts.length;
   row.sections=result.draft.map(s=>({questionId:s.questionId,sentences:s.sentences.length,characters:s.text.length,
    ...(process.env.DARI_BENCH_SAVE_DRAFT==='1'?{text:s.text}:{}),
    supportedFactCount:s.factIds.length,missingFactIds:s.missingFactIds??[],staleValues:s.staleValues??[]}));
  }
  row.ok=true;
 }catch(error){row.ok=false;row.error=error.message;}
 row.totalMs=Math.round(performance.now()-start);await save();
 console.log(JSON.stringify({event:'completed',phase,mode,label,ok:row.ok,totalMs:row.totalMs,
  calls:row.calls.length,passed:row.checks?.filter(c=>c.ok).length,total:row.checks?.length,sections:row.sections?.length,error:row.error}));
}
try{
 if(phase==='conversation'){
  for(const scenario of scenarios.filter(s=>['basic','narrow-denial','no-category'].includes(s.id))){
   for(const mode of ['single-call']){
    await measure(mode,scenario.id,async adapter=>{
     const extracted=await advanceConversation(createSession('en','priority'),scenario.turns.en[0],adapter);
     return guideConversation(extracted,adapter);
    });
   }
  }
 }else{
  for(const mode of ['single-call']){
   await measure(mode,'full-export-fixture',adapter=>{
    const fixture=fullExportFixture();
    // Do not time the fixture's hand-authored draft as if Gemini generated it.
    fixture.draft=[];fixture.draftRevision=0;
    return generateDraft(fixture,adapter);
   });
  }
 }
}finally{child.stdin.end();}
