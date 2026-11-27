import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isCurrent,isReviewed,reviewVersion,invalidateChangedReviews,loadAnswers,saveAnswers} from '../src/application/model.ts';
import {pendingReviews,prepareDownload} from '../src/application/prepareDownload.ts';
import {applicationDocx} from '../src/application/docx.ts';
const source=readFileSync(new URL('../public/procedure-scope.js',import.meta.url),'utf8');
const scope=query=>{const context={window:{location:{search:query}},URLSearchParams};vm.runInNewContext(source,context);return context.window.DariProcedureScope;};
const ready=()=>({source:'I do not know who they were.',language:'en',korean:'그들이 누구였는지 모릅니다.',translatedSource:'I do not know who they were.'});
test('A and B, guest and standalone never share old keys, calendar, views or procedure records',()=>{
 const store=new Map(),bases=['dari.scheduler.calendar.v1','dari.scheduler.calendar.view.v1','dari.procedure-roadmap.autosave.v1','dari.procedure-roadmap.view.v1'];
 const A=scope('?ownerScope=account:A'),B=scope('?ownerScope=account:B');
 for(const base of bases){store.set(base,'legacy');store.set(A.key(base),'A');assert.equal(store.get(B.key(base)),undefined);store.set(B.key(base),'B');assert.equal(store.get(scope('?ownerScope=account:A').key(base)),'A');assert.notEqual(A.key(base),base);assert.notEqual(scope('?ownerScope=guest').key(base),scope('').key(base));assert.equal(store.get(base),'legacy');}
});
test('backup restore checks ownership; legacy file import is explicit, never an automatic storage migration',()=>{
 const A=scope('?ownerScope=account:A'),B=scope('?ownerScope=account:B');const file=A.backup({schema:'test',facts:[]});
 assert.equal(A.readBackup(file),file);assert.throws(()=>B.readBackup(file));assert.equal(A.readBackup({schema:'legacy'}).schema,'legacy');
});
test('translation current is not user confirmation; every content/language edit clears confirmation even after undo',()=>{
 const a=ready();assert.ok(isCurrent(a,'9.7'));assert.ok(!isReviewed(a,'9.7'));
 a.reviewed=reviewVersion(a);assert.ok(isReviewed(a,'9.7'));
 for(const edit of [{source:'Changed'},{korean:'변경'},{language:'fr'},{targetLanguage:'en'}]){
  const changed=invalidateChangedReviews({'9.7':a},{'9.7':{...a,...edit}})['9.7'];assert.equal(changed.reviewed,undefined);assert.ok(!isReviewed(changed,'9.7'));
  const undone=invalidateChangedReviews({'9.7':changed},{'9.7':{...changed,source:a.source,korean:a.korean,language:a.language,targetLanguage:a.targetLanguage}})['9.7'];assert.ok(!isReviewed(undone,'9.7'));
 }
});
test('old storage preserves text and stays unreviewed; an explicit review survives reload',()=>{
 const data=new Map();globalThis.sessionStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const a=ready();saveAnswers('en',{'9.7':a});const old=loadAnswers();assert.equal(old.answers['9.7'].source,a.source);assert.ok(!isReviewed(old.answers['9.7'],'9.7'));
 a.reviewed=reviewVersion(a);saveAnswers('en',{'9.7':a});assert.ok(isReviewed(loadAnswers().answers['9.7'],'9.7'));
 delete globalThis.sessionStorage;
});
test('download and Word encoder refuse unreviewed content without calling a model or mutating input',async()=>{
 const a=ready(),answers={'9.7':a};let calls=0;
 await assert.rejects(prepareDownload(answers,()=>{calls++}),/REVIEW_REQUIRED/);assert.equal(calls,0);assert.equal(a.reviewed,undefined);
 const template=new Uint8Array(readFileSync(new URL('../public/forms/refugee-application-2024-word.docx',import.meta.url)));
 assert.throws(()=>applicationDocx(answers,template),/Review required/);
 assert.deepEqual(pendingReviews(answers),[{id:'9.7',reason:'review'}]);assert.deepEqual(pendingReviews({'9.7':{...a,source:'new'}}),[{id:'9.7',reason:'translation'}]);
 a.reviewed=reviewVersion(a);const result=await prepareDownload(answers);assert.deepEqual(result,answers);assert.notEqual(result,answers);assert.ok(applicationDocx(result,template).length>0);
});
