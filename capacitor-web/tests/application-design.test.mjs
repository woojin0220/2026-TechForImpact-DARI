import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewVersion,questions,isCurrent} from '../src/application/model.ts';
import {serializeFields,visibleField} from '../src/application/structuredAnswer.ts';
import {sentences} from '../src/application/sentences.ts';
import {prepareDownload} from '../src/application/prepareDownload.ts';
import {translationProblem} from '../src/application/translationQuality.ts';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {applicationDocx} from '../src/application/docx.ts';
import {parseFieldValues} from '../src/application/structuredAnswer.ts';
const question=id=>questions.find(q=>q.id===id);

test('conditional testimony is retained in fields but excluded from source when its branch is hidden',()=>{
 const q=question('14.2'),values={'14.2':'no','14.2-detail':'I think two men threatened me. I am not certain who they were.'};
 assert.equal(serializeFields(q,values,'en'),'No');assert.equal(visibleField(q.fields[1],values),false);
 const source=serializeFields(q,{...values,'14.2':'yes'},'en');
 assert.ok(source.startsWith('Yes\n\n'));assert.ok(source.includes(values['14.2-detail']));assert.ok(!source.includes('If yes'));assert.equal(values['14.2-detail'],'I think two men threatened me. I am not certain who they were.');
});
test('table cards preserve partial dates, unfilled values and row order without creating facts',()=>{
 const source=serializeFields(question('8'),{'8':[{}, {from:'2021/03',country:'Exampleland',address:'I cannot remember the street.'},{from:'2019',country:'Elsewhere'}]},'en');
 assert.ok(source.startsWith('1. From (yyyy/mm): 2021/03'));assert.ok(source.includes('2. From (yyyy/mm): 2019'));assert.ok(source.includes('I cannot remember the street.'));assert.ok(!source.includes('To (yyyy/mm):'));
 assert.equal(serializeFields(question('8'),{'8':[{},{}]},'en'),'');
});
test('sentence presentation does not change original punctuation, uncertainty or line breaks',()=>{
 const original='I think it happened in March. I am not certain.\n\nI did not see their faces.';
 assert.equal(sentences(original,'en').join(''),original);assert.ok(!original.includes('01'));
});
test('changing translation target invalidates the result even when the source is unchanged',()=>{
 const a={source:'경찰인지 확실하지 않습니다.',language:'ko',korean:'I am not certain they were police officers.',translatedSource:'경찰인지 확실하지 않습니다.',targetLanguage:'en',translatedTarget:'en',translatedLanguage:'ko'};
 assert.equal(isCurrent(a,'14.2'),true);assert.equal(isCurrent({...a,targetLanguage:'ko'},'14.2'),false);assert.equal(isCurrent({...a,language:'fr'},'14.2'),false);
 assert.equal(translationProblem(a.source,'ko',a.source,'14.2','en'),'UNTRANSLATED_ANSWER');
});
test('download requires chosen-language review and preserves completed user corrections',async()=>{
 const a={source:'Je ne sais pas qui étaient ces hommes.',language:'fr',korean:'I do not know who those men were.',translatedSource:'Je ne sais pas qui étaient ces hommes.',targetLanguage:'en',translatedTarget:'en'};
 await assert.rejects(prepareDownload({'9.7':a}),/REVIEW_REQUIRED/);
 a.reviewed=reviewVersion(a);const ready=await prepareDownload({'9.7':a});assert.equal(ready['9.7'].korean,a.korean);
 const edited={...a,korean:'I cannot identify those men.'};await assert.rejects(prepareDownload({'9.7':edited}),/REVIEW_REQUIRED/);
 edited.reviewed=reviewVersion(edited);assert.equal((await prepareDownload({'9.7':edited}))['9.7'].korean,edited.korean);
});

test('English review text exports to the original Word form without display-only sentence numbers',()=>{
 const text='I am not certain who those men were.';
 const template=new Uint8Array(readFileSync(new URL('../public/forms/refugee-application-2019-word.docx',import.meta.url)));
 const files=unzipSync(applicationDocx({'9.7':(()=>{const a={source:text,language:'en',korean:text,translatedSource:text,targetLanguage:'en',translatedTarget:'en'};return {...a,reviewed:reviewVersion(a)};})()},template));
 const xml=strFromU8(files['word/document.xml']);assert.ok(xml.includes(text));assert.ok(!xml.includes('sentence-list'));
});

test('malformed restored card values cannot be interpreted as table rows',()=>{
 assert.equal(parseFieldValues(question('8'),{'8':['not a row']}),undefined);
 assert.equal(parseFieldValues(question('8'),{'8':[{country:{unexpected:'nested'}}]}),undefined);
 assert.deepEqual(parseFieldValues(question('8'),{'8':[{from:'2019',country:'Exampleland'}]}),{'8':[{from:'2019',country:'Exampleland'}]});
});
