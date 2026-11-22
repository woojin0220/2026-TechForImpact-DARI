import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDownload} from '../src/application/prepareDownload.ts';
const a=(source,korean='',translatedSource='',language='en')=>({source,korean,translatedSource,language});
test('download translates pending and stale answers, keeps manual edits, skips blanks and handles Korean locally',async()=>{
 const answers={'1.2':a('name','직접 수정','name'),'1.9':a('new','old translation','old'),'1.4':a('pending'),'1.5':a('  '),'1.8':a('교사','','','ko')};
 const calls=[],updates=[],progress=[];
 const ready=await prepareDownload(answers,async(text,lang)=>{calls.push([text,lang]);return '번역 '+text},x=>updates.push(x),(done,total)=>progress.push([done,total]));
 assert.deepEqual(calls,[['pending','en'],['new','en']]);
 assert.equal(ready['1.2'].korean,'직접 수정'); assert.equal(ready['1.8'].korean,'교사');
 assert.equal(ready['1.9'].translatedSource,'new'); assert.equal(answers['1.9'].translatedSource,'old');
 assert.equal(updates.length,3); assert.deepEqual(progress.at(-1),[3,3]);
});
test('failure saves completed translations and retry translates only unfinished answers',async()=>{
 const answers={'1.8':a('first'),'1.9':a('second')};let saved=answers;
 await assert.rejects(prepareDownload(answers,async text=>{if(text==='second')throw Error('offline');return '첫째'},x=>saved=x,()=>{}));
 assert.equal(saved['1.8'].korean,'첫째');assert.equal(saved['1.9'].korean,'');
 const calls=[];await prepareDownload(saved,async text=>{calls.push(text);return '둘째'},()=>{},()=>{});
 assert.deepEqual(calls,['second']);
});
test('empty model output prevents exporting an unfinished translation',async()=>{
 await assert.rejects(prepareDownload({'15':a('answer')},async()=>'',()=>{},()=>{}));
});
