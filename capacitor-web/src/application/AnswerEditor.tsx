import { intakeLanguages } from '../intakeCopy';
import { SelectMenu } from '../ui/SelectMenu';
import { Button } from '../ui/ScreenControls';
import { applicationCopy } from './copy';
import { inputCopy, questionGuide } from './inputGuidance';
import { isCurrent, type Answer, type Question } from './model';

export function AnswerEditor({question,answer,language,busy,onSource,onLanguage,onTranslate,onKorean}:{question:Question;answer:Answer;language:string;busy:boolean;onSource:(source:string)=>void;onLanguage:(language:string)=>void;onTranslate:()=>void;onKorean:(text:string)=>void}) {
 const c=applicationCopy(language),guide=questionGuide(question,answer.language);
 const showTranslation=answer.language!=='ko'&&!!answer.korean;
 return <div className="answer-editor">
  <section className="source-editor" aria-labelledby="source-title">
   <div className="editor-heading"><label id="source-title" htmlFor="answer-source">{c.source}</label><SelectMenu label={c.language} value={answer.language} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))} disabled={busy} onChange={onLanguage}/></div>
   <p className="sr-only" id="answer-guidance" lang={answer.language}>{inputCopy(answer.language).hint}: {guide}</p>
   <textarea id="answer-source" aria-describedby="answer-guidance" dir="auto" lang={answer.language} rows={Math.min(10,Math.max(6,guide.split('\n').length+1))} placeholder={guide} value={answer.source} disabled={busy} maxLength={12000} onChange={e=>onSource(e.target.value)}/>
   <div className="editor-footer">{answer.language!=='ko'&&<Button variant="primary" disabled={busy||!answer.source.trim()} onClick={onTranslate}>{busy?c.translating:c.translate}</Button>}<span className="answer-count" dir="ltr">{answer.source.length.toLocaleString()} / 12,000</span></div>
  </section>
  {busy&&<p className="application-note" role="status">{c.translating}</p>}
  {showTranslation&&<details className="translation-result" open>
   <summary>{c.result}<span aria-hidden="true">⌄</span></summary>
   {!isCurrent(answer,question.id)&&<p className="application-note" role="status">{c.stale}</p>}
   <textarea id="answer-korean" aria-label={c.result} lang="ko" dir="ltr" value={answer.korean} disabled={busy||answer.translatedSource!==answer.source} onChange={e=>onKorean(e.target.value)}/>
  </details>}
 </div>;
}
