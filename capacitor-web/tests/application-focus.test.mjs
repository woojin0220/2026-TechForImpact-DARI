import test from 'node:test';
import assert from 'node:assert/strict';
import {questions,saveAnswers,loadAnswers} from '../src/application/model.ts';
import {guidanceItems,guidanceKey,guidanceGroups,requiresGuidance} from '../src/application/questionGuidance.ts';
import {makeSentenceParts,sentenceText,splitSentence,mergeSentence,reconcileSentenceParts} from '../src/application/sentenceDraft.ts';
const q=questions.find(q=>q.id==='14.2');
test('only specified detailed narrative requirements gate entry; identity, tables and free statements do not',()=>{
 for(const id of ['1.2','2','4','8','7.9','9.7','14.7','14.8','14.18','15'])assert.equal(requiresGuidance(questions.find(q=>q.id===id)),false,id);
 for(const id of ['14.2','14.3','14.4','14.5','14.6','14.9'])assert.equal(requiresGuidance(questions.find(q=>q.id===id)),true,id);
});

test('printed content prompts are distinct from response rules and app advice; changes invalidate acknowledgement',()=>{
 const groups=guidanceGroups(q,'ko');
 assert.equal(guidanceItems(q,'ko').length,7);assert.ok(groups.response.some(s=>s.includes('예')));assert.ok(groups.support.some(s=>s.includes('확실하지')));
 assert.ok(!groups.content.some(s=>s.includes('예라면')||s==='예 / 아니요'||s.includes('기억나지')));
 assert.ok(groups.content.some(s=>s.includes('어떤 부당한 처분')));assert.ok(groups.content.some(s=>s.includes('무슨 일이')));assert.ok(groups.content.some(s=>s.includes('풀려났')));
 assert.notEqual(guidanceKey(q,'ko'),guidanceKey(q,'en'));
 const updated={...q,fields:q.fields.map((f,i)=>i===1?{...f,ko:f.ko+' 변경된 안내'}:f)};
 assert.notEqual(guidanceKey(q,'ko'),guidanceKey(updated,'ko'));
});
test('sentence split and merge preserve every character, paragraph break and uncertainty',()=>{
 const text='I think it was March. I am not certain.\n\nI cannot remember the day.';
 let id=0;const next=()=>`s-${id++}`;
 const parts=makeSentenceParts(text,'en',next);assert.equal(sentenceText(parts),text);
 const merged=mergeSentence(parts,1);assert.equal(sentenceText(merged),text);assert.equal(merged[0].id,parts[0].id);
 const split=splitSentence(merged,0,'en',next);assert.equal(sentenceText(split),text);assert.equal(split[0].id,parts[0].id);
});
test('editing one sentence does not renumber or rewrite unrelated sentence identities',()=>{
 let id=0;const parts=makeSentenceParts('I do not know. They left.','en',()=>String(id++));
 const edited=parts.map((p,i)=>i===0?{...p,text:'I am not certain.'}:p);
 assert.equal(edited[1].id,parts[1].id);assert.equal(edited[1].text,parts[1].text);
 assert.equal(sentenceText(edited),'I am not certain. They left.');
});

test('continuous typing segments sentences without changing text or existing neighbour IDs',()=>{
 let id=0;const create=()=>`sentence-${id++}`;
 const initial=makeSentenceParts('I think it was March. I am not certain.','en',create);
 const text='I think it was April. I am not certain.\n\nI did not see their faces.';
 const next=reconcileSentenceParts(text,initial,'en',create);
 assert.equal(sentenceText(next),text);assert.equal(next.length,3);assert.equal(next[0].id,initial[0].id);assert.equal(next[1].id,initial[1].id);
 const edited=reconcileSentenceParts('I think it was April. A new sentence. I am not certain.\n\nI did not see their faces.',next,'en',create);
 assert.equal(edited[2].id,next[1].id);assert.equal(edited[3].id,next[2].id);
});
test('guidance confirmation and sentence identities survive reload; legacy answer text remains unchanged',()=>{
 const data=new Map();globalThis.sessionStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 try{
  const source='I think it was March. I am not certain.';let n=0;
  const answer={source,language:'en',korean:'',translatedSource:'',guideKey:guidanceKey(q,'en'),sentenceDrafts:{'14.2':makeSentenceParts(source,'en',()=>`part-${n++}`)}};
  assert.equal(saveAnswers('en',{'14.2':answer}),true);assert.deepEqual(loadAnswers().answers['14.2'],answer);
  const old={source,language:'en',korean:'',translatedSource:''};saveAnswers('en',{'9.7':old});assert.deepEqual(loadAnswers().answers['9.7'],old);
 }finally{delete globalThis.sessionStorage;}
});
