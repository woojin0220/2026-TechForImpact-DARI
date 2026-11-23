import { localizedLabel } from '../form/localize';
import { applicationCopy } from './copy';
import { isCurrent, type Answer, type Question } from './model';

type Props = {question: Question; answer?: Answer; language: string; busy: boolean; blocked: boolean;
 onChange: (source: string, korean?: string) => void; onTranslate: () => void; onKorean: (text: string) => void};
/** Short answers stay on the section page, using the existing form field styles. */
export function QuickAnswer({question:q, answer:a, language, busy, blocked, onChange, onTranslate, onKorean}: Props) {
 const c=applicationCopy(language);
 const first=q.fields[0];
 const label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 const source=a?.source??'';
 const id=`quick-${q.id}`;
 const simpleChoice=q.fields.length===1 && first.type==='single' && first.options;
 const matched=simpleChoice ? first.options?.find(o=>localizedLabel(a?.language??language,o.ko,o.en)===source) : undefined;
 return <section className="quick-answer">
  <label className="form-label" htmlFor={id}><span dir="ltr">{q.id}</span> {label(first.ko,first.en)}</label>
  {q.fields.slice(1).map(f=><p className="application-note" key={f.id}>{label(f.ko,f.en)}{f.options ? ` (${f.options.map(o=>label(o.ko,o.en)).join(' / ')})`:''}</p>)}
  {simpleChoice ? <select id={id} disabled={busy} value={matched?.value ?? (source?'__custom':'')} onChange={e=>{const o=first.options?.find(o=>o.value===e.target.value);onChange(o?localizedLabel(a?.language??language,o.ko,o.en):'',o?.ko??'');}}>
   <option value="">—</option>{source&&!matched&&<option value="__custom">{source}</option>}{first.options?.map(o=><option key={o.value} value={o.value}>{label(o.ko,o.en)}</option>)}
  </select> : q.fields.length===1 ? <input id={id} dir="auto" lang={a?.language??language} value={source} disabled={busy} maxLength={12000} placeholder={first.type==='date'?'YYYY/MM/DD':undefined} onChange={e=>onChange(e.target.value)}/> : <textarea id={id} dir="auto" lang={a?.language??language} value={source} disabled={busy} maxLength={12000} onChange={e=>onChange(e.target.value)}/>}
  {a?.source.trim() && !isCurrent(a,q.id) && <div className="quick-translation-actions"><button className="secondary" disabled={blocked} onClick={onTranslate}>{busy?c.translating:c.translate}</button>{a.korean&&<span className="application-note">{c.stale}</span>}</div>}
  {a && !!a.source.trim() && a.translatedSource===a.source && a.language!=='ko' && !simpleChoice && <details className="quick-result"><summary>{c.result}</summary><label className="sr-only" htmlFor={`${id}-ko`}>{c.result}</label><textarea id={`${id}-ko`} lang="ko" dir="ltr" value={a.korean} disabled={busy} onChange={e=>onKorean(e.target.value)}/></details>}
 </section>;
}
