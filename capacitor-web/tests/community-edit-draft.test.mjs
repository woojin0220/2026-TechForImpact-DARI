import test from 'node:test';
import assert from 'node:assert/strict';
import {editDraftKey,loadEditDraft,saveEditDraft,clearMatchingEditDraft,saveDraft,loadDraft} from '../src/community/personal.ts';
const store=()=>{const records=new Map();return {records,getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};};
const draft={version:1,board:'qna',title:'원래 제목',body:'작성 중인 수정 내용',language:'ko'};
test('editing buffers survive remounts and are isolated from new posts, other owners and posts',()=>{
 const s=store();saveDraft(s,'A',{...draft,body:'새 글 작성 중'});saveEditDraft(s,'A','post-1',draft);
 assert.deepEqual(loadEditDraft(s,'A','post-1'),draft);assert.equal(loadEditDraft(s,'B','post-1'),null);assert.equal(loadEditDraft(s,'A','post-2'),null);
 assert.equal(loadDraft(s,'A').body,'새 글 작성 중');assert.notEqual(editDraftKey('a:b','c'),editDraftKey('a','b:c'));
});
test('a late update response cannot erase a newer edit, and successful matching saves clear the buffer',()=>{
 const s=store(),next={...draft,body:'더 최근에 작성한 내용'};saveEditDraft(s,'A','post',next);
 assert.equal(clearMatchingEditDraft(s,'A','post',draft),false);assert.deepEqual(loadEditDraft(s,'A','post'),next);
 assert.equal(clearMatchingEditDraft(s,'A','post',next),true);assert.equal(loadEditDraft(s,'A','post'),null);
});
test('corrupt edit storage is reported without deleting it',()=>{
 const s=store(),key=editDraftKey('A','post');s.setItem(key,'{broken');assert.throws(()=>loadEditDraft(s,'A','post'));assert.equal(s.getItem(key),'{broken');
});
