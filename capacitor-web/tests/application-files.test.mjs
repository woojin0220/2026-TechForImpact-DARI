import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';
import * as CFB from 'cfb';import{inflateSync}from'fflate';import{PDFDocument}from'pdf-lib';
import{applicationHwp}from'../src/application/hwp.ts';import{applicationPdf}from'../src/application/pdf.ts';
import{applicationLayout}from'../src/application/answerLayout.ts';import{reviewVersion,questions}from'../src/application/model.ts';
import{records,cells,decode}from'../src/export/hwpBinary.ts';
const asset=name=>new Uint8Array(readFileSync(new URL('../public/'+name,import.meta.url)));
const hwp=asset('forms/refugee-application-2024.hwp'),pdf=asset('forms/refugee-application-2024.pdf'),font=asset('fonts/NanumGothic-Regular.ttf');
const answer=text=>{const a={source:text,korean:text,language:'ko',translatedSource:text,targetLanguage:'ko',translatedTarget:'ko',translatedLanguage:'ko'};return {...a,reviewed:reviewVersion(a)};};
const readBody=bytes=>{const c=CFB.read(bytes,{type:'buffer'});return records(inflateSync(new Uint8Array(CFB.find(c,'/BodyText/Section0').content)));};
test('all file formats reject unreviewed or stale answers before producing a document',async()=>{
 const a=answer('직접 적은 답변');delete a.reviewed;
 assert.throws(()=>applicationLayout({'9.7':a}),/Review required/);
 await assert.rejects(applicationPdf({'9.7':a},{template:pdf,font}),/Review required/);
 await assert.rejects(applicationHwp({'9.7':a},hwp),/Review required/);
 await assert.rejects(applicationHwp({'9.7':{...answer('원문'),source:'새 원문'}},hwp),/Translation required/);
});
test('2024 PDF retains all original pages and paginates long reviewed answers',async()=>{
 const long='정확한 날짜는 기억나지 않습니다. 경찰이라고 들었지만 확실하지 않습니다. '.repeat(180),answers={'14.2':answer(long),'16.1':answer('자필로 작성할 칸을 자동으로 채우면 안 됩니다.')},before=JSON.stringify(answers);
 const bytes=await applicationPdf(answers,{template:pdf,font}),document=await PDFDocument.load(bytes),original=await PDFDocument.load(pdf);
 assert.ok(document.getPageCount()>22);assert.equal(JSON.stringify(answers),before);assert.equal(document.getAuthor(),'DARI');
 for(const page of[0,1,20,21])assert.equal(document.getPages()[page].node.Contents()?.toString(),original.getPages()[page].node.Contents()?.toString());
 assert.equal(applicationLayout(answers).boxes.filter(b=>b.box.page>=21).length,0);
});
test('real 2024 HWP preserves every grouped answer, original instructions and handwritten pages',async()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.id,answer(`입력값 ${q.id}`)]));answers['14.2']=answer('날짜는 불확실하고 직접 보지 못했습니다. '.repeat(130)+'마지막 진술 보존');
 const before=JSON.stringify(answers),bytes=await applicationHwp(answers,hwp),rs=readBody(bytes),original=cells(readBody(hwp)),updated=cells(rs);
 assert.deepEqual([...bytes.slice(0,8)],[208,207,17,224,161,177,26,225]);
 const text=rs.filter(r=>r.tag===67&&!decode(r.data).endsWith('(계속)\r')).map(r=>decode(r.data)).join('').replace(/\s/g,'');
 for(const q of questions)assert.ok(text.includes(answers[q.id].korean.replace(/\s/g,'')),q.id);
 for(const page of[1,2,21,22]){const pageText=cs=>cs.filter(c=>c.page===page).flatMap(c=>c.paras).map(p=>p.text).join('');assert.equal(pageText(updated),pageText(original),`manual/instruction page ${page}`);}
 if(process.env.DARI_CURRENT_HWP_FIXTURE)writeFileSync(process.env.DARI_CURRENT_HWP_FIXTURE,bytes);assert.equal(JSON.stringify(answers),before);assert.ok(!CFB.find(CFB.read(bytes,{type:'buffer'}),'/Scripts/DefaultJScript'));
});
test('current single-choice questions mark the matching original HWP option',async()=>{
 for(const q of questions.filter(q=>q.fields.length===1&&q.fields[0].options&&!q.id.startsWith('16.'))){
  for(const option of q.fields[0].options){const rs=readBody(await applicationHwp({[q.id]:answer(option.ko)},hwp));assert.ok(rs.some(r=>r.tag===67&&decode(r.data).includes('[√')),`${q.id}/${option.value}`);}
 }
});
