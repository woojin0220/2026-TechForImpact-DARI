// Existing synthetic scenario checks; isolates the first extraction call.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFile,mkdir} from 'node:fs/promises';
import {createSession,advanceConversation,getActiveFacts,setAuxiliaryPasses} from '../../capacitor-web/src/intake/index.ts';
import {scenarios} from '../../capacitor-web/src/bench/scenarios.ts';
import {scoreCheck} from '../../capacitor-web/src/bench/score.ts';
setAuxiliaryPasses('off'); // Benchmark isolation only; production retains selective passes.
const child=spawn('/private/tmp/dari-pii-bench-venv/bin/python',['tools/pii-bench/latency_worker.py'],{stdio:['pipe','pipe','inherit']});
const pending=new Map();let id=0;
createInterface({input:child.stdout}).on('line',line=>{try{const m=JSON.parse(line);if(m.id!=null){pending.get(m.id)?.(m);pending.delete(m.id);}}catch{}});
const rows=[];
const singleCall=process.argv.includes('--single-call');
for(const scenario of scenarios.filter(s=>['basic','narrow-denial','no-category'].includes(s.id))){
 let captured;
 try{await advanceConversation(createSession('en','priority'),scenario.turns.en[0],Object.assign(async request=>{captured=request;throw Error('capture only');},singleCall?{conversationMode:'single-call'}:{}));}catch{}
 const warmId=id++;await new Promise(resolve=>{pending.set(warmId,resolve);child.stdin.write(JSON.stringify({id:warmId,mode:'before',action:'warm',request:captured})+'\n');});
 for(const mode of singleCall?['single-call']:['before','after']){
  const calls=[];const started=Date.now();let result,error;
  try{result=await advanceConversation(createSession('en','priority'),scenario.turns.en[0],Object.assign(async request=>{
   const current=id++;const response=await new Promise(resolve=>{pending.set(current,resolve);child.stdin.write(JSON.stringify({id:current,mode,request})+'\n');});
   if(response.error)throw Error(response.error);calls.push({stats:response.stats,usage:response.usage});return response.text;
  },singleCall?{conversationMode:'single-call'}:{}));}catch(e){error=e.message;}
  const checks=result?scenario.checks.map(c=>scoreCheck(getActiveFacts(result),result,c,'en')):[];
  const row={scenario:scenario.id,mode,totalMs:Date.now()-started,calls,error,checks};rows.push(row);
  console.log(JSON.stringify({scenario:row.scenario,mode,totalMs:row.totalMs,calls:calls.length,error,passed:checks.filter(c=>c.ok).length,total:checks.length,safetyFailed:checks.filter(c=>c.safety&&!c.ok).map(c=>c.label)}));
  await mkdir('tools/pii-bench/results/2026-11-19',{recursive:true});await writeFile(`tools/pii-bench/results/2026-11-19/${singleCall?'single-call':'latency'}-intake.json`,JSON.stringify(rows,null,2)+'\n');
 }
}
child.stdin.end();
