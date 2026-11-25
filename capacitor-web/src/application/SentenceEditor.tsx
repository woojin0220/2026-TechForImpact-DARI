import { useEffect, useRef, useState } from 'react';
import { focusCopy } from './focusCopy';
import { inputCopy } from './inputGuidance';
import { designCopy } from './designCopy';
import { makeSentenceParts, mergeSentence, reconcileSentenceParts, sentenceText, type SentencePart } from './sentenceDraft';

export function SentenceEditor({id,value,parts:saved,language,uiLanguage,disabled,onChange}:{id:string;value:string;parts?:SentencePart[];language:string;uiLanguage:string;disabled:boolean;onChange:(text:string,parts:SentencePart[])=>void}){
 const c=focusCopy(uiLanguage),[numbered,setNumbered]=useState(false),[undo,setUndo]=useState<SentencePart[]|null>(null),initial=useRef<{value:string;parts:SentencePart[]}|null>(null);
 const rowRefs=useRef(new Map<string,HTMLTextAreaElement>()),pendingFocus=useRef<string|null>(null);
 if(!initial.current||initial.current.value!==value)initial.current={value,parts:makeSentenceParts(value,language)};
 const parts=saved&&sentenceText(saved)===value?saved:initial.current.parts;
 const change=(next:SentencePart[])=>{setUndo(null);onChange(sentenceText(next),next);};
 const resize=(el:HTMLTextAreaElement|null,minimum=40)=>{if(el){el.style.height='auto';el.style.height=`${Math.max(minimum,el.scrollHeight+2)}px`;}};
 useEffect(()=>{if(pendingFocus.current){const el=rowRefs.current.get(pendingFocus.current);if(el){el.focus();el.setSelectionRange(0,0);pendingFocus.current=null;}}},[parts]);
 const tools=<div className="continuous-editor-tools"><button type="button" aria-pressed={numbered} onClick={()=>setNumbered(!numbered)} disabled={disabled}>{numbered?c.free:c.numbered}</button><span className="answer-count" dir="ltr">{value.length.toLocaleString()} / 12,000</span></div>;
 return <div className={`sentence-editor${numbered?' is-numbered':' is-continuous'}`}>
  {!numbered?<div className="answer-input"><textarea id={id} ref={el=>resize(el,216)} aria-label={designCopy(uiLanguage).source} dir="auto" lang={language} value={value} rows={6} disabled={disabled} maxLength={12000} placeholder={inputCopy(language).write} onChange={e=>change(reconcileSentenceParts(e.target.value,parts,language))}/>{tools}</div>:<>
   {tools}
   <div className="sentence-draft">{parts.map((part,index)=><div className="sentence-row" key={part.id}>
    <label className="sentence-number" dir="ltr" htmlFor={index===0?id:`${id}-${part.id}`}><span className="sr-only">{c.sentence} </span>{String(index+1).padStart(2,'0')}</label>
    <textarea ref={el=>{if(el)rowRefs.current.set(part.id,el);else rowRefs.current.delete(part.id);resize(el);}} id={index===0?id:`${id}-${part.id}`} aria-label={`${c.sentence} ${index+1}`} dir="auto" lang={language} disabled={disabled} value={part.text} rows={1} maxLength={Math.max(part.text.length,12000-(value.length-part.text.length))} placeholder={inputCopy(language).write}
     onChange={e=>change(parts.map((p,i)=>i===index?{...p,text:e.target.value}:p))}
     onBlur={()=>{if(!pendingFocus.current)change(reconcileSentenceParts(value,parts,language));}}
     onKeyDown={e=>{if(e.key!=='Enter'||e.shiftKey||e.nativeEvent.isComposing||value.length>=12000)return;e.preventDefault();const input=e.currentTarget,nextId=crypto.randomUUID(),left={...part,text:part.text.slice(0,input.selectionStart),after:'\n'},right={id:nextId,text:part.text.slice(input.selectionEnd),after:part.after};pendingFocus.current=nextId;change([...parts.slice(0,index),left,right,...parts.slice(index+1)]);}}/>
    <details className="sentence-actions-menu"><summary aria-label={`${c.sentence} ${index+1} ${c.more}`} aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}}>···</summary><div className="sentence-menu">
     {index>0&&<button type="button" disabled={disabled} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');change(mergeSentence(parts,index));}}>{c.merge}</button>}
     <button type="button" disabled={disabled} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');const next=parts.filter((_,i)=>i!==index);setUndo(parts);onChange(sentenceText(next),next.length?next:makeSentenceParts('',language));}}>{c.remove}</button>
    </div></details>
   </div>)}</div>
  </>}
  {undo&&<div className="sentence-undo" role="status">{c.deleted}<button type="button" onClick={()=>{onChange(sentenceText(undo),undo);setUndo(null);}}>{c.undo}</button></div>}
 </div>;
}
