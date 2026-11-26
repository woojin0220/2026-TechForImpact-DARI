import { AnswerChoices } from './AnswerChoices';
import { inputCopy, questionGuide } from './inputGuidance';
import { Button } from '../ui/ScreenControls';
import { localizedLabel } from '../form/localize';
import { applicationCopy } from './copy';
import { isCurrent, type Answer, type Question } from './model';
import { StructuredInput } from './StructuredInput';
import type { FieldValues } from './structuredAnswer';
import { designCopy } from './designCopy';
import { ReviewConfirmation } from './ReviewConfirmation';

type Props = {question: Question; answer?: Answer; language: string; busy: boolean; blocked: boolean;
 onChange: (source: string, korean?: string) => void; onFields:(values:FieldValues)=>void; onTranslate: () => void; onKorean: (text: string) => void;onConfirm:(checked:boolean)=>void};
/** Short answers stay on the section page, using the existing form field styles. */
export function QuickAnswer({question:q, answer:a, language, busy, blocked, onChange, onFields, onTranslate, onKorean,onConfirm}: Props) {
 const c=applicationCopy(language);
 const d=designCopy(language),target=a?.targetLanguage??'ko',resultLabel=target==='en'?d.resultEn:d.resultKo;
 const first=q.fields[0];
 const label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 const source=a?.source??'';
 const id=`quick-${q.id}`;
 const simpleChoice=q.fields.length===1 && first.type==='single' && first.options;
 const matched=simpleChoice ? first.options?.find(o=>localizedLabel(a?.language??language,o.ko,o.en)===source) : undefined;
 const structured=(q.fields.length>1||first.type==='multi')&&(!source||!!a?.fieldValues);
 return <section className="quick-answer" id={`question-${q.id}`}>
  <label className="form-label" htmlFor={simpleChoice?undefined:id}><span dir="ltr">{q.id}</span> {label(first.ko,first.en)}</label>
  {structured?<StructuredInput question={q} values={a?.fieldValues??{}} language={a?.language??language} uiLanguage={language} busy={busy} onChange={onFields}/>:simpleChoice ? <AnswerChoices id={id} label={label(first.ko,first.en)} disabled={busy} value={matched?.value??(source?'__custom':'')}
    options={[...(source&&!matched?[{value:'__custom',label:source}]:[]),...(first.options??[]).map(o=>({value:o.value,label:label(o.ko,o.en)}))]}
    chooseLabel={inputCopy(language).choose} clearLabel={inputCopy(language).clear}
    onChange={value=>{const o=first.options?.find(o=>o.value===value);onChange(o?localizedLabel(a?.language??language,o.ko,o.en):'',o?(target==='en'?o.en:o.ko):'');}} />
   : q.fields.length===1 ? <input id={id} dir="auto" lang={a?.language??language} value={source} disabled={busy} maxLength={12000} placeholder={first.type==='date'?inputCopy(language).date:label(first.ko,first.en)} onChange={e=>onChange(e.target.value)}/>
   : <textarea id={id} dir="auto" lang={a?.language??language} value={source} disabled={busy} maxLength={12000} placeholder={questionGuide(q,a?.language??language)} onChange={e=>onChange(e.target.value)}/>}
  {a?.source.trim() && !isCurrent(a,q.id) && <div className="quick-translation-actions"><Button variant="secondary" disabled={blocked} onClick={onTranslate}>{busy?c.translating:c.translate}</Button>{a.korean&&<span className="application-note">{c.stale}</span>}</div>}
  {a && !!a.source.trim() && a.translatedSource===a.source && (a.translatedTarget??'ko')===target && <details className="quick-result" open><summary>{resultLabel}</summary><label className="sr-only" htmlFor={`${id}-ko`}>{resultLabel}</label><textarea id={`${id}-ko`} lang={target} dir="ltr" value={a.korean} disabled={busy} onChange={e=>onKorean(e.target.value)}/></details>}
  {a?.source.trim()&&<ReviewConfirmation answer={a} id={q.id} language={language} disabled={blocked} onChange={onConfirm}/>}
 </section>;
}
