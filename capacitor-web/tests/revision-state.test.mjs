import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,documentText,decodeTxt,addUserMessage,addAssistantMessage,applySuggestion,dismissSuggestion,undoChange,storeTranslation,currentTranslation,validateDocument} from '../src/revision/state.mjs';
const text='  첫 문장입니다. 정확한 날짜는 기억나지 않습니다.\r\n\r\n마지막 문단입니다.\n';
const rows=doc=>doc.pieces.filter(x=>x.kind==='sentence');
function propose(doc,id,after='정확한 날짜가 기억나지 않습니다.'){
 const current=rows(doc).find(x=>x.id===id);return addAssistantMessage(addUserMessage(doc,id,'자연스럽게 바꿔 줘'),id,{type:'proposal',message:'뜻을 유지하면서 다듬었습니다.',replacement:after},current.revision);
}
test('TXT whitespace, paragraph breaks and CRLF survive import and export exactly',()=>{
 const doc=createDocument(text);assert.equal(documentText(doc),text);assert.equal(rows(doc).length,3);assert.equal(new Set(rows(doc).map(x=>x.id)).size,3);
});
test('decimals do not create spurious sentence fragments',()=>{const doc=createDocument('수치는 3.14입니다. 다음 문장입니다.');assert.equal(rows(doc).length,2);});
test('UTF-8 and UTF-16 BOM files are decoded without corrupting Korean',()=>{
 assert.equal(decodeTxt(new TextEncoder().encode('한글입니다.').buffer),'한글입니다.');
 const bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from('한글입니다.','utf16le')]);assert.equal(decodeTxt(bytes),'한글입니다.');
});
test('invalid bytes and empty or oversized documents give actionable errors',()=>{
 assert.throws(()=>decodeTxt(new Uint8Array([255,255])),/인코딩/);assert.throws(()=>decodeTxt(new Uint8Array([0,1,0,2])),/텍스트/);
 assert.throws(()=>createDocument(' \n'),/문장/);assert.throws(()=>createDocument('가'.repeat(100001)),/100,000/);
});
test('a proposed edit never mutates the original draft before explicit apply',()=>{
 const original=createDocument(text),id=rows(original)[1].id,next=propose(original,id);
 assert.equal(documentText(next),text);assert.equal(original.threads[id],undefined);assert.equal(next.history.length,0);
});
test('apply changes only the selected sentence and keeps all separators and original text',()=>{
 let doc=createDocument(text);const id=rows(doc)[1].id;doc=propose(doc,id);doc=applySuggestion(doc,id,doc.threads[id].at(-1).id);
 assert.equal(documentText(doc),text.replace('정확한 날짜는 기억나지 않습니다.','정확한 날짜가 기억나지 않습니다.'));assert.equal(rows(doc)[1].originalText,'정확한 날짜는 기억나지 않습니다.');assert.equal(doc.history.length,1);
});
test('repeat edits preserve sentence identity and the complete conversation',()=>{
 let doc=createDocument(text);const id=rows(doc)[1].id;
 for(const value of ['날짜는 기억나지 않습니다.','정확한 날짜는 잘 기억나지 않습니다.']){doc=propose(doc,id,value);doc=applySuggestion(doc,id,doc.threads[id].at(-1).id);}
 assert.equal(rows(doc)[1].id,id);assert.equal(doc.threads[id].length,4);assert.equal(doc.history.length,2);
});
test('sentences with identical text maintain separate threads',()=>{
 let doc=createDocument('같은 문장입니다. 같은 문장입니다.');const [a,b]=rows(doc);doc=addUserMessage(doc,b.id,'두 번째만 바꾸기');assert.equal(doc.threads[a.id],undefined);assert.equal(doc.threads[b.id].length,1);
});
test('applying one suggestion invalidates competing suggestions and prevents double apply',()=>{
 let doc=createDocument(text);const id=rows(doc)[1].id;doc=propose(doc,id,'날짜가 불확실합니다.');const old=doc.threads[id].at(-1).id;doc=propose(doc,id,'날짜를 기억하지 못합니다.');const chosen=doc.threads[id].at(-1).id;doc=applySuggestion(doc,id,chosen);
 assert.throws(()=>applySuggestion(doc,id,chosen),/수정안/);assert.throws(()=>applySuggestion(doc,id,old),/수정안/);
});
test('dismiss and explanatory answers leave the draft unchanged',()=>{
 let doc=createDocument(text);const id=rows(doc)[0].id;doc=propose(doc,id);doc=dismissSuggestion(doc,id,doc.threads[id].at(-1).id);
 doc=addAssistantMessage(addUserMessage(doc,id,'왜 바꿨나요?'),id,{type:'answer',message:'뜻을 유지하기 위한 제안입니다.',replacement:''},0);
 assert.equal(documentText(doc),text);assert.equal(doc.threads[id].at(-1).proposal,undefined);
});
test('undo restores the original exactly without deleting the conversation history',()=>{
 let doc=createDocument(text);const id=rows(doc)[1].id;doc=propose(doc,id);doc=applySuggestion(doc,id,doc.threads[id].at(-1).id);doc=undoChange(doc);
 assert.equal(documentText(doc),text);assert.equal(doc.threads[id].length,2);assert.equal(doc.history.at(-1).kind,'undo');assert.equal(doc.undo.length,0);
});
test('edit invalidates old translations and late responses cannot overwrite a new revision',()=>{
 let doc=createDocument(text);const id=rows(doc)[1].id;doc=storeTranslation(doc,id,'en','I do not remember the exact date.',0);assert.ok(currentTranslation(doc,id,'en'));
 doc=propose(doc,id);doc=applySuggestion(doc,id,doc.threads[id].at(-1).id);assert.equal(currentTranslation(doc,id,'en'),null);
 assert.throws(()=>storeTranslation(doc,id,'en','stale',0),/변경/);assert.throws(()=>addAssistantMessage(doc,id,{type:'answer',message:'old',replacement:''},0),/바뀌/);
});
test('saved project validation rejects unknown sentence references and corrupt history',()=>{
 const doc=createDocument(text);assert.equal(validateDocument(doc),doc);assert.throws(()=>validateDocument({...doc,threads:{unknown:[]}}),/손상/);assert.throws(()=>validateDocument({...doc,pieces:[{kind:'gap',text:'injected'}]}),/손상/);
});

