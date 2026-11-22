import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { questions, questionGroups, isQuickQuestion, isCurrent, writtenAnswers, loadAnswers, saveAnswers } from '../src/application/model.ts';
import { applicationDocx, wrapAnswer } from '../src/application/docx.ts';
import { statementSlots } from '../src/export/statement.ts';
const template=new Uint8Array(readFileSync(new URL('../public/forms/refugee-application-2019-word.docx',import.meta.url)));
const answer=(source,korean=source)=>({source,korean,language:'en',translatedSource:source});
test('numbered questions group follow-ups, with every question in a large-number group',()=>{
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.ok(questions.find(q=>q.id==='14.1').fields.some(f=>f.id==='14.1-detail'));
 assert.deepEqual(questionGroups.flatMap(g=>g.questions.map(q=>q.id)),questions.map(q=>q.id));
 assert.ok(questionGroups.every(g=>/^\d+$/.test(g.id)));
});
test('Word preserves every original form page and image, fills only written answers and escapes XML',()=>{
 const files=unzipSync(applicationDocx({'1.2':answer('A & <B>'),'1.3':answer('   ')},template));
 const source=unzipSync(template);const xml=strFromU8(files['word/document.xml']);
 for(let p=1;p<=22;p++)assert.deepEqual(files[`word/media/page-${p}.jpg`],source[`word/media/page-${p}.jpg`]);
 assert.deepEqual(files['word/_rels/document.xml.rels'],source['word/_rels/document.xml.rels']);
 assert.ok(xml.includes('answer-1.2')&&xml.includes('A &amp; &lt;B&gt;'));
 assert.ok(!xml.includes('answer-1.3')&&!xml.includes('DARI_PAGE_'));
 assert.equal((xml.match(/id="form-page-/g)||[]).length,22);
 assert.throws(()=>applicationDocx({},template));
});
test('stale or untranslated answers cannot be exported and current manual edits are retained',()=>{
 assert.throws(()=>applicationDocx({'1.2':{...answer('old','이전 번역'),source:'new'}},template),/Translation required/);
 const source='Не применимо: паспорт находится у меня.';
 assert.throws(()=>applicationDocx({'9.8':{...answer(source),language:'ru'}},template),/Translation required: 9.8/);
 const files=unzipSync(applicationDocx({'1.2':answer('name','직접 수정한 번역')},template));
 assert.ok(strFromU8(files['word/document.xml']).includes('직접 수정한 번역'));
});
test('overflow and unstructured table answers are preserved on referenced appendices',()=>{
 const text='이것은 긴 답변입니다. '.repeat(200);
 const files=unzipSync(applicationDocx({'1.2':answer(text),'4':answer('가족에 관한 입력 내용')},template));
 const xml=strFromU8(files['word/document.xml']);
 assert.ok(xml.includes('별지 1 참조')&&xml.includes('별지 2 참조'));
 assert.ok(xml.includes(text.trim())&&xml.includes('가족에 관한 입력 내용'));
 assert.equal(wrapAnswer('가나다라마바사',20,9).join(''),'가나다라마바사');
});
test('translation is invalidated when source is changed or erased',()=>{
 const a=answer('test','번역');assert.ok(isCurrent(a));
 assert.ok(!isCurrent({...a,source:'new'}));assert.ok(!isCurrent({...a,source:''}));
 assert.deepEqual(writtenAnswers({'1.2':a,'1.3':answer(' ')}).map(x=>x.question.id),['1.2']);
});
test('statement lines follow original ruled rows and continue onto page 20',()=>{
 const lines=Array.from({length:10},(_,i)=>`서술 답변 ${i+1}`);
 const files=unzipSync(applicationDocx({'15':answer(lines.join('\n'))},template));
 const xml=strFromU8(files['word/document.xml']);
 lines.forEach((line,i)=>{
  const shape=xml.match(new RegExp(`<v:rect id="answer-15-line-${i+1}"[\\s\\S]*?</v:rect>`))[0];
  assert.ok(shape.includes(`margin-top:${(statementSlots[i].bottom-12).toFixed(2)}pt`));
  assert.ok(shape.includes(line));
  const page=xml.slice(0,xml.indexOf(shape)).match(/id="form-page-\d+"/g).at(-1);
  assert.equal(page,`id="form-page-${i<8?19:20}"`);
 });
 assert.ok(!xml.includes('별지 1 참조'));
});
test('statement exceeding all ruled rows is retained in an appendix',()=>{
 const text=Array.from({length:31},(_,i)=>`긴 서술 ${i+1}`).join('\n');
 const files=unzipSync(applicationDocx({'15':answer(text)},template));
 const xml=strFromU8(files['word/document.xml']);
 assert.ok(xml.includes('별지 1 참조')&&xml.includes('별지 1 · 문항 15'));
 for(const line of text.split('\n'))assert.ok(xml.includes(line));
 assert.ok(!xml.includes('answer-15-line-2"'));
});
test('combined conditional answers are not assigned to the first yes or guardian detail area',()=>{
 for(const id of ['14.5','14.6','14.13','14.15']) {
  const text='아니요. 해당 상황에 대한 상세 설명입니다.';
  const files=unzipSync(applicationDocx({[id]:answer(text)},template));
  const xml=strFromU8(files['word/document.xml']);
  const box=xml.match(new RegExp(`<v:rect id="answer-${id.replace('.', '\\.')}"[\\s\\S]*?</v:rect>`))[0];
  assert.ok(box.includes('별지 1 참조'),id);
  assert.ok(!box.includes(text),id);
  assert.ok(xml.includes(`별지 1 · 문항 ${id}`)&&xml.includes(text),id);
 }
});
test('answers survive reload, storage failure is reported, legacy storage is untouched',()=>{
 const data=new Map([['dari.working-copy.v1','legacy']]);
 globalThis.sessionStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const answers={'1.2':answer('Example')};assert.ok(saveAnswers('en',answers));assert.deepEqual(loadAnswers().answers,answers);
 assert.equal(data.get('dari.working-copy.v1'),'legacy');
 globalThis.sessionStorage={getItem:()=>{throw Error()},setItem:()=>{throw Error()}};
 assert.equal(saveAnswers('en',answers),false);assert.equal(loadAnswers().problem,true);delete globalThis.sessionStorage;
});
test('short, date and choice answers stay inline while narrative and tables stay separate',()=>{
 for(const id of ['1.1','1.2','1.5','1.8','9.1'])assert.ok(isQuickQuestion(questions.find(q=>q.id===id)),id);
 for(const id of ['4','14.1','14.2','15'])assert.ok(!isQuickQuestion(questions.find(q=>q.id===id)),id);
});
