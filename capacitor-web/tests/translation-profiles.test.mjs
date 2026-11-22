import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {questions} from '../src/application/model.ts';
const data=JSON.parse(readFileSync(new URL('../src/application/translationProfiles.json',import.meta.url),'utf8'));
test('every printed question has fixed context and a matching answer format',()=>{
 assert.deepEqual(Object.keys(data.profiles).sort(),questions.map(q=>q.id).sort());
 for(const q of questions){
  const p=data.profiles[q.id];assert.ok(p.subject.trim(),q.id);
  const expected=q.fields.some(f=>f.type==='table')?'table':q.fields.some(f=>f.type==='long')?'narrative':'short';
  assert.equal(p.kind,expected,q.id);
 }
});
test('conditional thresholds are not supplied as answer context',()=>{
 for(const id of ['14.13','14.14','14.18']) assert.doesNotMatch(JSON.stringify(data.profiles[id]),/\b(?:19|10|1|one)\b/,id);
});
