import { useRef, useState } from 'react';
import { focusCopy } from './focusCopy';
import { inputCopy } from './inputGuidance';
import { Button } from '../ui/ScreenControls';
import { makeSentenceParts, mergeSentence, sentenceText, splitSentence, type SentencePart } from './sentenceDraft';
import { sentences } from './sentences';

export function SentenceEditor({id,value,parts:saved,language,uiLanguage,disabled,onChange}:{id:string;value:string;parts?:SentencePart[];language:string;uiLanguage:string;disabled:boolean;onChange:(text:string,parts:SentencePart[])=>void}){
 const c=focusCopy(uiLanguage),[whole,setWhole]=useState(false),[undo,setUndo]=useState<SentencePart[]|null>(null),initial=useRef<{value:string;parts:SentencePart[]}|null>(null);
 if(!initial.current||initial.current.value!==value)initial.current={value,parts:makeSentenceParts(value,language)};
 const parts=saved&&sentenceText(saved)===value?saved:initial.current.parts;
 const change=(next:SentencePart[])=>{setUndo(null);onChange(sentenceText(next),next);};
 const resize=(el:HTMLTextAreaElement|null)=>{if(el){el.style.height='auto';el.style.height=`${Math.max(64,el.scrollHeight+2)}px`;}};
 return <div className="sentence-editor">
  <div className="sentence-editor-toolbar"><span>{whole?c.free:c.numbered}</span><button type="button" onClick={()=>setWhole(!whole)} disabled={disabled}>{whole?c.numbered:c.free}</button></div>
  {whole?<div className="answer-input"><textarea id={id} dir="auto" lang={language} value={value} rows={7} disabled={disabled} maxLength={12000} placeholder={inputCopy(language).write} onChange={e=>change(makeSentenceParts(e.target.value,language))}/><span className="answer-count" dir="ltr">{value.length.toLocaleString()} / 12,000</span></div>:<>
   <div className="sentence-draft">{parts.map((part,index)=><div className="sentence-row" key={part.id}>
    <label className="sentence-number" dir="ltr" htmlFor={index===0?id:`${id}-${part.id}`}><span className="sr-only">{c.sentence} </span>{String(index+1).padStart(2,'0')}</label>
    <textarea ref={resize} id={index===0?id:`${id}-${part.id}`} aria-label={`${c.sentence} ${index+1}`} dir="auto" lang={language} disabled={disabled} value={part.text} rows={2} maxLength={Math.max(part.text.length,12000-(value.length-part.text.length))} placeholder={inputCopy(language).write} onChange={e=>change(parts.map((p,i)=>i===index?{...p,text:e.target.value}:p))}/>
    <details className="sentence-actions-menu"><summary aria-label={`${c.sentence} ${index+1} ${c.more}`} aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}}>···</summary><div className="sentence-menu">
     {sentences(part.text,language).length>1&&<button type="button" disabled={disabled} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');change(splitSentence(parts,index,language));}}>{c.split}</button>}
     {index>0&&<button type="button" disabled={disabled} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');change(mergeSentence(parts,index));}}>{c.merge}</button>}
     <button type="button" disabled={disabled} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');const next=parts.filter((_,i)=>i!==index);setUndo(parts);onChange(sentenceText(next),next.length?next:makeSentenceParts('',language));}}>{c.remove}</button>
    </div></details>
   </div>)}</div>
   <div className="sentence-draft-footer"><Button disabled={disabled||value.length>=12000} onClick={()=>{const next=parts.map((p,i)=>i===parts.length-1&&!p.after?{...p,after:'\n'}:p);change([...next,...makeSentenceParts('',language)]);}}><span aria-hidden="true">＋</span>{c.addSentence}</Button><span className="answer-count" dir="ltr">{value.length.toLocaleString()} / 12,000</span></div>
  </>}
  {undo&&<div className="sentence-undo" role="status">{c.deleted}<button type="button" onClick={()=>{onChange(sentenceText(undo),undo);setUndo(null);}}>{c.undo}</button></div>}
 </div>;
}
