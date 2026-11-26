import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevSupervisor,SUPERVISOR_ID} from '../src/platform/devSupervisor.ts';
import {readCommentDraft,writeCommentDraft} from '../src/community/commentDraft.ts';
import {createTranslator} from '../src/community/translation.ts';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('post editing requires ownership and updates activity without disturbing other posts',async()=>{
 const api=createDevSupervisor({development:true,language:'en',storage:storage(),onExit(){}}).community;
 const other=(await api.listPosts('qna'))[0];await assert.rejects(()=>api.updatePost(SUPERVISOR_ID,other.id,{title:'Changed',body:'bad',language:'en'}));
 const id=await api.createPost(SUPERVISOR_ID,{board:'qna',title:'My question',body:'Original',language:'ar'});
 await api.updatePost(SUPERVISOR_ID,id,{title:'Revised question',body:'  My unchanged meaning  ',language:'ar'});
 const mine=await api.listActivity(SUPERVISOR_ID,'posts');assert.equal(mine.posts.find(post=>post.id===id).body,'My unchanged meaning');assert.equal((await api.getPost(id)).language,'ar');assert.equal((await api.getPost(other.id)).title,other.title);
});
test('own reply collection excludes deleted replies and inaccessible parent posts',async()=>{
 const api=createDevSupervisor({development:true,language:'en',storage:storage(),onExit(){}}).community;
 const post=(await api.listPosts('qna'))[0];await api.createComment(SUPERVISOR_ID,post.id,'My reply','fa');
 let activity=await api.listActivity(SUPERVISOR_ID,'replies');assert.equal(activity.posts[0].my_reply,'My reply');assert.equal(activity.posts[0].my_reply_language,'fa');
 await api.block(SUPERVISOR_ID,post.author_id);activity=await api.listActivity(SUPERVISOR_ID,'replies');assert.equal(activity.posts.length,0);
});
test('comment drafts preserve raw text and isolate both owner and parent post',()=>{
 const store=storage(),text='  لا أعرف.\nI do not remember.  ';writeCommentDraft(store,'A','one',text);assert.equal(readCommentDraft(store,'A','one'),text);assert.equal(readCommentDraft(store,'B','one'),'');assert.equal(readCommentDraft(store,'A','two'),'');writeCommentDraft(store,'A','one','');assert.equal(readCommentDraft(store,'A','one'),'');
 const broken={getItem:()=>'{bad'};assert.throws(()=>readCommentDraft(broken,'A','one'));
});
test('slow feed translation is serialized and failed translations can retry',async()=>{
 let active=0,maximum=0,calls=0;
 const translator=createTranslator({fast:false,async translate(text){calls++;active++;maximum=Math.max(active,maximum);await new Promise(resolve=>setTimeout(resolve,2));active--;if(text==='fail'&&calls===3)throw Error('unavailable');return 'translated '+text;}});
 assert.deepEqual(await Promise.all([translator.translate('one','ru','ar'),translator.translate('two','ru','ar')]),['translated one','translated two']);assert.equal(maximum,1);
 await assert.rejects(()=>translator.translate('fail','ru','ar'));assert.equal(await translator.translate('fail','ru','ar'),'translated fail');assert.equal(await translator.translate('one','ru','ar'),'translated one');assert.equal(calls,4);
});
