import test from 'node:test';
import assert from 'node:assert/strict';
import { ANSWERS_KEY } from '../src/application/model.ts';
import { sessionDraftRepository, draftStorageKey, draftWriter } from '../src/application/repository.ts';

const draft=(text='원문')=>({version:1,language:'ru',answers:{'1.2':{source:text,language:'ru',korean:text,translatedSource:text}}});
async function storageTest(run) {
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 const data=new Map();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 try {await run(data);}finally {if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
}
test('service accounts and guest drafts remain separate across account switches',async()=>storageTest(async data=>{
 const guest=sessionDraftRepository({userId:null}),a=sessionDraftRepository({userId:'account-a'}),b=sessionDraftRepository({userId:'account-b'});
 await guest.save(draft('게스트'));await a.save(draft('사용자 A'));
 assert.equal(await b.load(),null);
 await b.save(draft('사용자 B'));
 assert.equal((await a.load()).answers['1.2'].source,'사용자 A');
 assert.equal((await b.load()).answers['1.2'].source,'사용자 B');
 assert.equal((await guest.load()).answers['1.2'].source,'게스트');
 assert.ok(data.has(ANSWERS_KEY));
 assert.notEqual(draftStorageKey({userId:'guest'}),draftStorageKey({userId:null}));
 assert.notEqual(draftStorageKey({userId:'a/b'}),draftStorageKey({userId:'a%2Fb'}));
}));
test('existing guest drafts are read without silently copying them into an account',async()=>storageTest(async data=>{
 const legacy=draft();data.set(ANSWERS_KEY,JSON.stringify({language:legacy.language,answers:legacy.answers}));
 assert.deepEqual(await sessionDraftRepository({userId:null}).load(),legacy);
 assert.equal(await sessionDraftRepository({userId:'signed-in'}).load(),null);
 assert.equal(data.size,1);
}));
test('load errors preserve the stored record and failed writes reject',async()=>storageTest(async data=>{
 const repo=sessionDraftRepository({userId:'a'});data.set(repo.scope,'broken');
 await assert.rejects(repo.load(),/DRAFT_LOAD_FAILED/);assert.equal(data.get(repo.scope),'broken');
 globalThis.sessionStorage.setItem=()=>{throw Error('quota');};
 await assert.rejects(repo.save(draft()),/DRAFT_SAVE_FAILED/);
}));
test('async adapter writes are serialized, snapshot edits, and resume after a failed save',async()=>{
 const calls=[];let release;
 const repo={scope:'fake-account',load:async()=>null,save:async d=>{calls.push(d.answers['1.2'].source);if(calls.length===1){await new Promise(resolve=>{release=resolve;});throw Error('offline');}}};
 const write=draftWriter(repo),first=write(draft('첫 입력'));
 const rejected=assert.rejects(first,/offline/);
 const next=draft('수정 입력'),second=write(next);next.answers['1.2'].source='호출 후 변경';
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['첫 입력']);
 release();await rejected;await second;assert.deepEqual(calls,['첫 입력','수정 입력']);
});
