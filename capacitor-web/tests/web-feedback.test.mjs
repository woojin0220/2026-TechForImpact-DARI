import test from 'node:test';import assert from 'node:assert/strict';
import {exampleSource,exampleKorean,exampleTranslation} from '../src/application/uxExample.ts';
test('UX demo returns a labelled fixed example only for the exact fictional input',()=>{
 assert.equal(exampleTranslation(exampleSource,'en','14.2','ko'),exampleKorean);
 for(const args of [[exampleSource+' extra','en','14.2','ko'],['private input','en','14.2','ko'],[exampleSource,'ar','14.2','ko'],[exampleSource,'en','15','ko']])assert.throws(()=>exampleTranslation(...args),/WEB_FEEDBACK_ONLY/);
});
