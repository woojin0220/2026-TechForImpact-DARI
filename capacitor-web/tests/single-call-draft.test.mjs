import assert from 'node:assert/strict';
import test from 'node:test';
import {generateDraft,IntakeError} from '../src/intake/index.ts';
import {fullExportFixture} from './export-full-fixture.mjs';

const single=handler=>Object.assign(handler,{draftMode:'single-call'});
function output(request){
 const prompt=JSON.parse(request.prompt);
 return {sections:prompt.questions.map(q=>({questionId:q.questionId,
  sentences:[{text:'확인된 진술을 바탕으로 검토할 초안입니다.',factIds:q.requiredFactIds}]}))};
}
test('all full-fixture narrative sections use one request with canonical source links',async()=>{
 const fixture=fullExportFixture();let calls=0;
 const result=await generateDraft(fixture,single(async request=>{
  calls++;
  const prompt=JSON.parse(request.prompt);
  assert.equal(prompt.questions.length,14);
  assert.equal(new Set(prompt.facts.map(f=>f.id)).size,prompt.facts.length,'shared facts are supplied once');
  assert.ok(prompt.questions.every(q=>q.facts===undefined));
  return JSON.stringify(output(request));
 }));
 assert.equal(calls,1);assert.equal(result.draft.length,14);
 for(const section of result.draft){
  assert.ok(!section.missingFactIds?.length);
  assert.deepEqual(new Set(section.sourceIds),new Set(section.factIds.flatMap(id=>fixture.facts.find(f=>f.id===id).sourceIds)));
 }
 assert.equal(fixture.draftRevision,1,'the original session is unchanged');
});
test('missing sections, duplicates and another question\'s fact IDs fail without repair calls',async()=>{
 for(const corrupt of [data=>data.sections.pop(),data=>{data.sections[1]=data.sections[0];},
  data=>{data.sections[0].sentences[0].factIds=[data.sections.at(-1).sentences[0].factIds[0]];}]){
  let calls=0;
  await assert.rejects(generateDraft(fullExportFixture(),single(async request=>{
   calls++;const data=output(request);corrupt(data);return JSON.stringify(data);
  })),error=>error instanceof IntakeError&&error.session.facts.length===161);
  assert.equal(calls,1);
 }
});
test('omitted facts remain visible as review warnings without another model call',async()=>{
 let omitted;
 const result=await generateDraft(fullExportFixture(),single(async request=>{
  const data=output(request);
  const section=data.sections.find(s=>s.sentences[0].factIds.length>1);
  omitted=section.sentences[0].factIds.pop();
  return JSON.stringify(data);
 }));
 assert.ok(result.draft.some(s=>s.missingFactIds?.includes(omitted)));
});
