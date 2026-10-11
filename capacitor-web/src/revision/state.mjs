export const MAX_TEXT = 100000;
export const MAX_FILE_BYTES = 1024 * 1024;
export const languages = {ko:'한국어',en:'English',fr:'Français',ru:'Русский',ar:'العربية',fa:'فارسی'};
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
function fail(message) { throw new Error(message); }
export function decodeTxt(buffer, encoding='auto') {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > MAX_FILE_BYTES) fail('TXT 파일은 1 MB 이하로 올려 주세요.');
  let codec=encoding==='auto'?'utf-8':encoding;
  if (encoding==='auto' && bytes[0]===255 && bytes[1]===254) codec='utf-16le';
  if (encoding==='auto' && bytes[0]===254 && bytes[1]===255) codec='utf-16be';
  let text;
  try { text=new TextDecoder(codec,{fatal:true}).decode(bytes); }
  catch { fail('파일의 글자 인코딩을 읽지 못했습니다. Windows에서 저장한 파일이면 EUC-KR을 선택해 다시 올려 주세요.'); }
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) fail('일반 텍스트 파일을 올려 주세요.');
  if (/^\s*\{\\rtf/i.test(text)) fail('서식 있는 RTF 파일입니다. 일반 텍스트(.txt)로 저장해 주세요.');
  return text;
}
export function splitText(text, language='ko') {
  if (typeof text!=='string' || !text.trim()) fail('파일에 문장이 없습니다.');
  if (text.length>MAX_TEXT) fail('한 파일에 100,000자까지 올릴 수 있습니다. 파일을 나누어 주세요.');
  const pieces=[];
  const segmenter=new Intl.Segmenter(language,{granularity:'sentence'});
  for (const part of segmenter.segment(text)) {
    const match=part.segment.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const [,leading,body,trailing]=match;
    if(leading)pieces.push({kind:'gap',text:leading});
    if(body)pieces.push({kind:'sentence',id:id(),text:body,originalText:body,revision:0});
    if(trailing)pieces.push({kind:'gap',text:trailing});
  }
  if(pieces.filter(x=>x.kind==='sentence').length>2000)fail('2,000문장 이하로 파일을 나누어 주세요.');
  return pieces;
}
export function createDocument(text,name='초안.txt',language='ko') {
  if(!languages[language])fail('지원하는 원문 언어를 선택해 주세요.');
  return {format:'dari-txt-project-v1',id:id(),name:name.slice(0,250),language,createdAt:now(),updatedAt:now(),revision:0,
    pieces:splitText(text,language),threads:{},history:[],undo:[],translations:{}};
}
export function documentText(doc) { return doc.pieces.map(x=>x.text).join(''); }
export function sentence(doc,sentenceId) { return doc.pieces.find(x=>x.kind==='sentence'&&x.id===sentenceId)??fail('선택한 문장을 찾지 못했습니다.'); }
function change(doc,values) { return {...doc,...values,revision:doc.revision+1,updatedAt:now()}; }
export function addUserMessage(doc,sentenceId,content) {
  sentence(doc,sentenceId);
  if(!content.trim()||content.length>3000)fail('수정 요청을 3,000자 이내로 적어 주세요.');
  const thread=doc.threads[sentenceId]??[];
  if(thread.length>=400)fail('이 문장의 대화가 길어졌습니다. 수정본을 TXT로 내려받아 새로 올려 주세요.');
  return change(doc,{threads:{...doc.threads,[sentenceId]:[...thread,{id:id(),role:'user',content,createdAt:now()}]}});
}
export function addAssistantMessage(doc,sentenceId,reply,baseRevision) {
  const row=sentence(doc,sentenceId);
  if(row.revision!==baseRevision)fail('요청한 뒤 문장이 바뀌었습니다. 다시 요청해 주세요.');
  const message={id:id(),role:'assistant',content:reply.message,createdAt:now()};
  if(reply.type==='proposal'&&reply.replacement!==row.text)message.proposal={before:row.text,after:reply.replacement,baseRevision,status:'pending'};
  return change(doc,{threads:{...doc.threads,[sentenceId]:[...(doc.threads[sentenceId]??[]),message]}});
}
export function applySuggestion(doc,sentenceId,messageId) {
  const row=sentence(doc,sentenceId),thread=doc.threads[sentenceId]??[],proposal=thread.find(x=>x.id===messageId)?.proposal;
  if(!proposal||proposal.status!=='pending'||proposal.baseRevision!==row.revision||proposal.before!==row.text)
    fail('현재 문장과 맞지 않는 수정안입니다. 다시 요청해 주세요.');
  const record={id:id(),sentenceId,before:row.text,after:proposal.after,kind:'apply',createdAt:now()};
  return change(doc,{pieces:doc.pieces.map(x=>x===row?{...x,text:proposal.after,revision:x.revision+1}:x),
    threads:{...doc.threads,[sentenceId]:thread.map(x=>x.proposal&&x.proposal.status==='pending'?{...x,proposal:{...x.proposal,status:x.id===messageId?'applied':'stale'}}:x)},
    history:[...doc.history,record],undo:[...doc.undo,record]});
}
export function dismissSuggestion(doc,sentenceId,messageId) {
  return change(doc,{threads:{...doc.threads,[sentenceId]:(doc.threads[sentenceId]??[]).map(x=>x.id===messageId&&x.proposal?{...x,proposal:{...x.proposal,status:'dismissed'}}:x)}});
}
export function undoChange(doc) {
  const last=doc.undo.at(-1);if(!last)return doc;
  const row=sentence(doc,last.sentenceId);
  if(row.text!==last.after)fail('되돌릴 문장의 현재 내용이 다릅니다.');
  return change(doc,{pieces:doc.pieces.map(x=>x===row?{...x,text:last.before,revision:x.revision+1}:x),
    threads:{...doc.threads,[row.id]:(doc.threads[row.id]??[]).map(x=>x.proposal?.status==='pending'?{...x,proposal:{...x.proposal,status:'stale'}}:x)},
    history:[...doc.history,{id:id(),sentenceId:row.id,before:row.text,after:last.before,kind:'undo',createdAt:now()}],undo:doc.undo.slice(0,-1)});
}
export function storeTranslation(doc,sentenceId,target,text,baseRevision) {
  const row=sentence(doc,sentenceId);
  if(row.revision!==baseRevision)fail('번역 중 문장이 변경되었습니다.');
  return change(doc,{translations:{...doc.translations,[sentenceId]:{target,text,revision:baseRevision}}});
}
export function currentTranslation(doc,sentenceId,target) {
  const row=sentence(doc,sentenceId),value=doc.translations[sentenceId];
  return value?.target===target&&value.revision===row.revision?value.text:null;
}
export function validateDocument(doc) {
  const invalid=()=>fail('지원하는 TXT 작업 저장 파일이 아니거나 내용이 손상되었습니다.');
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const string=(x,max=100000)=>typeof x==='string'&&x.length<=max;
  const number=x=>Number.isSafeInteger(x)&&x>=0;
  if(!object(doc)||doc.format!=='dari-txt-project-v1'||!string(doc.id,100)||!string(doc.name,250)||!languages[doc.language]||
    !string(doc.createdAt,100)||!string(doc.updatedAt,100)||!number(doc.revision)||!Array.isArray(doc.pieces)||doc.pieces.length>6000||
    !object(doc.threads)||!object(doc.translations)||!Array.isArray(doc.history)||!Array.isArray(doc.undo)||doc.history.length>5000||doc.undo.length>5000)invalid();
  const ids=new Set();
  for(const p of doc.pieces){
    if(!object(p)||!string(p.text))invalid();
    if(p.kind==='gap'){if(/\S/.test(p.text))invalid();}
    else if(p.kind==='sentence'){
      if(!string(p.id,100)||!p.id||ids.has(p.id)||!p.text.trim()||!string(p.originalText)||!number(p.revision))invalid();
      ids.add(p.id);
    }else invalid();
  }
  if(!ids.size||ids.size>2000||documentText(doc).length>200000)invalid();
  for(const [key,thread]of Object.entries(doc.threads)){
    if(!ids.has(key)||!Array.isArray(thread)||thread.length>500)invalid();
    const messageIds=new Set();
    for(const m of thread){
      if(!object(m)||!string(m.id,100)||messageIds.has(m.id)||!['user','assistant'].includes(m.role)||!string(m.content,8000)||!string(m.createdAt,100))invalid();
      messageIds.add(m.id);
      if(m.proposal){const p=m.proposal;if(m.role!=='assistant'||!object(p)||!string(p.before)||!string(p.after,8000)||!p.after.trim()||!number(p.baseRevision)||!['pending','applied','stale','dismissed'].includes(p.status))invalid();}
    }
  }
  for(const record of [...doc.history,...doc.undo])if(!object(record)||!ids.has(record.sentenceId)||!string(record.id,100)||!string(record.before)||!string(record.after,8000)||!['apply','undo'].includes(record.kind)||!string(record.createdAt,100))invalid();
  for(const [key,t]of Object.entries(doc.translations))if(!ids.has(key)||!object(t)||!languages[t.target]||!string(t.text,8000)||!number(t.revision))invalid();
  return doc;
}

