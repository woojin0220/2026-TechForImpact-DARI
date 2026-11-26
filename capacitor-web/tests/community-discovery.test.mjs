import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, matchesSearch, searchFilter } from '../src/community/discovery.ts';
import { communityApi } from '../src/community/api.ts';
import { createDevSupervisor, SUPERVISOR_ID } from '../src/platform/devSupervisor.ts';

test('search treats punctuation as literal text and bounds the query', () => {
 assert.equal(normalizeSearch('  abc\n '), 'abc');
 assert.equal(normalizeSearch('x'.repeat(100)).length,80);
 for(const term of ['.*,status.neq.visible','x"),or(status.eq.hidden','a\\b','(안녕)','100%','a_b']) {
  const expression=searchFilter(term), part=expression.slice('title.imatch.'.length).split(',body.imatch.')[0];
  const pattern=JSON.parse(part);
  assert.ok(new RegExp(pattern,'i').test(term));
  assert.equal(expression,`title.imatch.${JSON.stringify(pattern)},body.imatch.${JSON.stringify(pattern)}`);
 }
 assert.ok(matchesSearch('مساعدة','معلومات عن كوريا','كوريا'));
 assert.ok(matchesSearch('Help','KOREA','korea'));
 assert.ok(!matchesSearch('도움','서류','일정'));
});

test('server search stays inside board and visibility filters before pagination', async () => {
 const calls=[];
 const query=new Proxy({then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)},{get(target,key){if(key==='then')return target.then;return(...args)=>{calls.push([key,...args]);return query;};}});
 const api=communityApi({from:name=>{calls.push(['from',name]);return query;}});
 await api.listPosts('qna','2026-11-01',{search:'test',unanswered:true});
 for(const expected of [['from','post_feed'],['eq','status','visible'],['eq','board_id','qna'],['eq','comment_count',0],['lt','created_at','2026-11-01'],['or',searchFilter('test')]])assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(expected)));
 calls.length=0;await api.listPosts('notice',undefined,{unanswered:true});assert.ok(!calls.some(call=>call[1]==='comment_count'));
});

test('Supervisor search includes bodies and unanswered changes after a real comment',async()=>{
 const entries=new Map(),storage={getItem:key=>entries.get(key)??null,setItem:(key,val)=>entries.set(key,val),removeItem:key=>entries.delete(key)};
 const {community:api}=createDevSupervisor({development:true,language:'ko',storage,onExit:()=>{}});
 const id=await api.createPost(SUPERVISOR_ID,{board:'qna',title:'Test question',body:'passport collection location',language:'en'});
 assert.ok((await api.listPosts('qna',undefined,{search:'collection',unanswered:true})).some(post=>post.id===id));
 await api.createComment(SUPERVISOR_ID,id,'Here is a reply','en');
 assert.ok(!(await api.listPosts('qna',undefined,{search:'collection',unanswered:true})).some(post=>post.id===id));
 assert.ok((await api.listPosts('qna',undefined,{search:'collection'})).some(post=>post.id===id));
});
