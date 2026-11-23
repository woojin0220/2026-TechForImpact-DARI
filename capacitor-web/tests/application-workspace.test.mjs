import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, questionGroups, sectionsForGroup } from '../src/application/model.ts';
import { loadConversation, saveConversation, conversationKey } from '../src/application/conversationStorage.ts';
import { createSession, appendAssistantMessage, narrativeOpening, advanceConversation, getActiveFacts } from '../src/intake/index.ts';

// Grouping must never omit or duplicate a printed question with conditional suffixes.
test('every printed question is reachable exactly once through its form subsections',()=>{
 for(const group of questionGroups){
  const actual=sectionsForGroup(group.id).flatMap(s=>s.questions.map(q=>q.id));
  assert.equal(new Set(actual).size,actual.length);
  assert.deepEqual(actual,group.questions.map(q=>q.id));
 }
 assert.equal(questionGroups.flatMap(g=>sectionsForGroup(g.id).flatMap(s=>s.questions)).length,questions.length);
});
test('conversation records survive reopen without leaking into another owner or language',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 const data=new Map();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 const session=appendAssistantMessage(createSession('ru','full'),narrativeOpening('ru'),{kind:'narrative'});
 const work={version:1,session,language:'ru',stage:'conversation',formPage:0,input:'Не помню дату.',picked:[],demo:false,finalReviewedText:'',output:'source',pendingTask:null};
 try{
  assert.equal(saveConversation('account-a','ru',work),true);
  assert.deepEqual(loadConversation('account-a','ru').work,work);
  assert.equal(loadConversation('account-b','ru').work,null);
  assert.equal(loadConversation('account-a','en').work,null);
  const key=conversationKey('account-a','ru');data.set(key,'broken');
  assert.equal(loadConversation('account-a','ru').problem,'invalid');
  assert.equal(data.get(key),'broken');
 }finally{if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);else delete globalThis.sessionStorage;}
});
test('full narrative intake collects sourced facts beyond the priority questions without producing prose',async()=>{
 const initial=appendAssistantMessage(createSession('en','full'),narrativeOpening('en'),{kind:'narrative'});
 let calls=0;
 const adapter=Object.assign(async request=>{
  calls++;
  assert.equal(request.task,'intake');
  return JSON.stringify({reply:'Thank you.',facts:[{r:'protection',v:'no',k:'d',q:['2.1']}]});
 },{conversationMode:'single-call'});
 const result=await advanceConversation(initial,'I never asked the police for protection.',adapter);
 assert.equal(calls,1);
 assert.equal(getActiveFacts(result).find(f=>f.requirementId==='protection').value,'no');
 assert.deepEqual(result.draft,[]);assert.equal(result.draftRevision,0);
 assert.deepEqual(initial.facts,[]);
});
