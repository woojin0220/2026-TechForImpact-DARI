import test from 'node:test';
import assert from 'node:assert/strict';
import {personalKey,loadDraft,saveDraft,loadSaved,saveSaved,clearMatchingDraft} from '../src/community/personal.ts';
import {createDevSupervisor,SUPERVISOR_ID} from '../src/platform/devSupervisor.ts';
const storage=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('draft title, original text, board and writing language survive and remain account scoped',()=>{
 const store=storage(),draft={version:1,board:'qna',title:'Question',body:'  لا أعرف.\nI cannot remember.  ',language:'ar'};
 saveDraft(store,'A',draft);assert.deepEqual(loadDraft(store,'A'),draft);assert.equal(loadDraft(store,'B'),null);saveDraft(store,'B',{...draft,title:'B'});saveDraft(store,'B',null);assert.deepEqual(loadDraft(store,'A'),draft);
});
test('bad draft and unavailable storage remain intact for recovery rather than silently overwritten by read',()=>{
 const store=storage(),key=personalKey('A','draft');store.setItem(key,'broken json');assert.throws(()=>loadDraft(store,'A'));assert.equal(store.getItem(key),'broken json');
 assert.throws(()=>loadDraft({getItem:()=>{throw Error('blocked')}},'A'));
});
test('a delayed publication result cannot erase a newer draft or another account draft',()=>{
 const store=storage(),old={version:1,board:'qna',title:'old',body:'old body',language:'en'},newer={...old,title:'new'};
 saveDraft(store,'A',newer);saveDraft(store,'B',old);assert.equal(clearMatchingDraft(store,'A',old),false);assert.deepEqual(loadDraft(store,'A'),newer);assert.equal(clearMatchingDraft(store,'A',newer),true);assert.equal(loadDraft(store,'A'),null);assert.deepEqual(loadDraft(store,'B'),old);
});
test('bookmarks contain IDs only, survive reload, are bounded and scoped to the account',()=>{
 const store=storage();saveSaved(store,'A',['one','two']);assert.deepEqual(loadSaved(store,'A'),['one','two']);assert.deepEqual(loadSaved(store,'B'),[]);assert.ok(!store.getItem(personalKey('A','saved')).includes('body'));
 assert.throws(()=>saveSaved(store,'A',Array(201).fill('id')));assert.deepEqual(loadSaved(store,'A'),['one','two']);store.setItem(personalKey('A','saved'),JSON.stringify({version:1,ids:['bad,filter']}));assert.throws(()=>loadSaved(store,'A'));
});
test('saved post retrieval still excludes blocked and deleted posts',async()=>{
 const {community:api}=createDevSupervisor({development:true,language:'ko',storage:storage(),onExit:()=>{}});
 assert.equal((await api.listSavedPosts([])).length,0);const source=(await api.listPosts('qna'))[0];assert.equal((await api.listSavedPosts([source.id])).length,1);await api.block(SUPERVISOR_ID,source.author_id);assert.equal((await api.listSavedPosts([source.id])).length,0);
 const own=await api.createPost(SUPERVISOR_ID,{board:'life',title:'Saved test',body:'temporary',language:'en'});assert.equal((await api.listSavedPosts([own])).length,1);await api.deleteOwn('post',own);assert.equal((await api.listSavedPosts([own])).length,0);
});
