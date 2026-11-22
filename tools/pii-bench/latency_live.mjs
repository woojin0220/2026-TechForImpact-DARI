// Synthetic full conversation path through the running gateway; no raw output logs.
import {writeFile} from 'node:fs/promises';
import {createSession,advanceConversation,guideConversation,setAuxiliaryPasses} from '../../capacitor-web/src/intake/index.ts';
import {scenarios} from '../../capacitor-web/src/bench/scenarios.ts';
setAuxiliaryPasses('selective');
const calls=[];
const adapter=Object.assign(async request=>{
 const response=await fetch('http://127.0.0.1:8765/v1/intake/generate',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error || `HTTP ${response.status}`);
 calls.push(result.stats);return result.text;
},{conversationMode:'single-call'});
const started=Date.now();
const newAnswer=process.argv.includes('--new-answer');
const scenario=scenarios.find(s=>s.id===(newAnswer?'narrow-denial':'basic'));
let session=await advanceConversation(createSession('en','priority'),scenario.turns.en[0],adapter);
const extractionMs=Date.now()-started;
session=await guideConversation(session,adapter);
const result={scenario:scenario.id,conversationMode:adapter.conversationMode,totalMs:Date.now()-started,extractionMs,calls,
 nextQuestionReady:session.messages.at(-1)?.role==='assistant'};
await writeFile(`tools/pii-bench/results/2026-11-19/single-call-live${newAnswer?'-new-answer':''}.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
