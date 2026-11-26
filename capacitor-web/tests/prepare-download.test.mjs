import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDownload} from '../src/application/prepareDownload.ts';
import {reviewVersion} from '../src/application/model.ts';
test('download never fills pending or stale translations, including same-language values',async()=>{
 for(const a of [{source:'text',language:'en',korean:'',translatedSource:''},{source:'교사',language:'ko',korean:'',translatedSource:''}]){
  let calls=0;await assert.rejects(prepareDownload({'1.8':a},()=>{calls++}),/REVIEW_REQUIRED/);assert.equal(calls,0);assert.equal(a.korean,'');
 }
});
test('confirmed edits are preserved in an independent download snapshot',async()=>{
 const a={source:'teacher',language:'en',korean:'교사',translatedSource:'teacher'};a.reviewed=reviewVersion(a);
 const answers={'1.8':a};const result=await prepareDownload(answers);assert.deepEqual(result,answers);result['1.8'].korean='changed';assert.equal(a.korean,'교사');
});
test('a blank translation is blocked even with a stored review marker',async()=>{
 const a={source:'answer',language:'en',korean:'',translatedSource:'answer'};a.reviewed=reviewVersion(a);await assert.rejects(prepareDownload({'15':a}),/REVIEW_REQUIRED/);
});
