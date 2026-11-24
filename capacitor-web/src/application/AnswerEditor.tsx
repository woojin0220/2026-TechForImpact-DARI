import { useEffect, useRef, useState } from 'react';
import { intakeLanguages } from '../intakeCopy';
import { SelectMenu } from '../ui/SelectMenu';
import { Button } from '../ui/ScreenControls';
import { applicationCopy } from './copy';
import { inputCopy, questionGuide } from './inputGuidance';
import { isCurrent, type Answer, type Question, type TranslationLanguage } from './model';
import { designCopy } from './designCopy';
import { StructuredInput } from './StructuredInput';
import { sentences } from './sentences';
import type { FieldValues } from './structuredAnswer';

type Props={question:Question;answer:Answer;language:string;busy:boolean;review:boolean;onSource:(source:string)=>void;onLanguage:(language:string)=>void;onTarget:(target:TranslationLanguage)=>void;onFields:(values:FieldValues)=>void;onTranslate:()=>void;onKorean:(text:string)=>void;onEdit:()=>void;onSave:()=>void};
export function AnswerEditor({question,answer,language,busy,review,onSource,onLanguage,onTarget,onFields,onTranslate,onKorean,onEdit,onSave}:Props) {
 const c=applicationCopy(language),d=designCopy(language),guide=questionGuide(question,answer.language),target=answer.targetLanguage??'ko';
 const [numbered,setNumbered]=useState(false);
 const structured=(question.fields.length>1||question.fields[0].type==='table')&&(!answer.source||!!answer.fieldValues);
 const current=isCurrent(answer,question.id),shownTarget=answer.translatedTarget??'ko';
 const editable=!!answer.translatedSource&&answer.translatedSource===answer.source&&shownTarget===target&&(!answer.translatedLanguage||answer.translatedLanguage===answer.language);
 const resultRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=resultRef.current;if(el){el.style.height='auto';el.style.height=`${Math.max(240,el.scrollHeight+2)}px`;}},[answer.korean,review,numbered]);
 return <div className={`answer-editor${review?' is-review':''}`}>
  {!review?<>
   <div className="language-route"><div><span>{d.source}</span><SelectMenu label={d.source} value={answer.language} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))} disabled={busy} onChange={onLanguage}/></div><span className="language-route-arrow" aria-hidden="true">→</span><div><span>{d.target}</span><SelectMenu label={d.target} value={target} options={[{value:'ko',label:d.ko},{value:'en',label:d.en}]} disabled={busy} onChange={v=>onTarget(v as TranslationLanguage)}/></div></div>
   <section className="source-editor" aria-labelledby="source-title">
    <div className="editor-heading"><label id="source-title" htmlFor={structured?undefined:'answer-source'}>{c.source}</label></div>
    {structured?<StructuredInput question={question} values={answer.fieldValues??{}} language={answer.language} uiLanguage={language} busy={busy} onChange={onFields}/>:<>
     <p className="sr-only" id="answer-guidance" lang={answer.language}>{inputCopy(answer.language).hint}: {guide}</p>
     <div className="answer-input"><textarea id="answer-source" aria-describedby="answer-guidance" dir="auto" lang={answer.language} rows={7} placeholder={inputCopy(answer.language).write} value={answer.source} disabled={busy} maxLength={12000} onChange={e=>onSource(e.target.value)}/><span className="answer-count" dir="ltr">{answer.source.length.toLocaleString()} / 12,000</span></div>
    </>}
   </section>
   <div className="writing-actions"><Button variant="primary" className="translation-trigger" disabled={busy||!answer.source.trim()} onClick={onTranslate}>{busy?c.translating:d.translateReview}<span aria-hidden="true">→</span></Button></div>
   {busy&&<p className="application-note" role="status">{c.translating}</p>}
  </>:<>
   <section className="translation-result" aria-labelledby="translation-result-title">
    <div className="translation-heading"><label id="translation-result-title" htmlFor="answer-korean">{shownTarget==='en'?d.resultEn:d.resultKo}</label><button type="button" className="sentence-toggle" aria-pressed={numbered} onClick={()=>setNumbered(!numbered)}>{numbered?d.whole:d.sentence}</button></div>
    {!current&&<p className="application-note" role="status">{answer.korean?d.stale:d.empty}</p>}
    {numbered?<ol className="sentence-list" lang={shownTarget} dir="ltr">{sentences(answer.korean,shownTarget).map((sentence,i)=><li key={i}>{sentence}</li>)}</ol>:<textarea ref={resultRef} id="answer-korean" aria-label={shownTarget==='en'?d.resultEn:d.resultKo} lang={shownTarget} dir="ltr" value={answer.korean} disabled={busy||!editable} onChange={e=>onKorean(e.target.value)}/>}
   </section>
   <details className="original-answer"><summary>{d.original}</summary><p dir="auto" lang={answer.language}>{answer.source}</p></details>
   <div className="review-actions"><Button onClick={onEdit} disabled={busy}>{d.edit}</Button><Button variant="primary" onClick={onSave} disabled={busy||!current}>{d.save}</Button></div>
  </>}
 </div>;
}
