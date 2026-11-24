import { intakeLanguages } from '../intakeCopy';
import { SelectMenu } from '../ui/SelectMenu';
import { Button } from '../ui/ScreenControls';
import { applicationCopy } from './copy';
import { inputCopy, questionGuide, translationAction, translationPlaceholder } from './inputGuidance';
import { isCurrent, type Answer, type Question } from './model';

export function AnswerEditor({question,answer,language,busy,onSource,onLanguage,onTranslate,onKorean}:{question:Question;answer:Answer;language:string;busy:boolean;onSource:(source:string)=>void;onLanguage:(language:string)=>void;onTranslate:()=>void;onKorean:(text:string)=>void}) {
 const c=applicationCopy(language),guide=questionGuide(question,answer.language);
 return <div className="answer-editor">
  <section className="source-editor" aria-labelledby="source-title">
   <div className="editor-heading"><label id="source-title" htmlFor="answer-source">{c.source}</label><SelectMenu label={c.language} value={answer.language} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))} disabled={busy} onChange={onLanguage}/></div>
   <p className="sr-only" id="answer-guidance" lang={answer.language}>{inputCopy(answer.language).hint}: {guide}</p>
   <div className="answer-input">
    <textarea id="answer-source" aria-describedby="answer-guidance" dir="auto" lang={answer.language} rows={Math.min(10,Math.max(6,guide.split('\n').length+1))} placeholder={guide} value={answer.source} disabled={busy} maxLength={12000} onChange={e=>onSource(e.target.value)}/>
    <span className="answer-count" dir="ltr">{answer.source.length.toLocaleString()} / 12,000</span>
   </div>
  </section>
  <div className="translation-bridge">
   <Button variant="primary" className="translation-trigger" aria-label={c.translate} disabled={busy||!answer.source.trim()} onClick={onTranslate}>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v16m-6-6 6 6 6-6"/></svg>
    {busy?c.translating:translationAction(language)}
   </Button>
  </div>
  <section className="translation-result" aria-labelledby="translation-result-title">
   <div className="translation-heading"><label id="translation-result-title" htmlFor="answer-korean">{c.result}</label></div>
   {busy&&<p className="application-note" role="status">{c.translating}</p>}
   {!!answer.korean&&!isCurrent(answer,question.id)&&<p className="application-note" role="status">{c.stale}</p>}
   <textarea id="answer-korean" aria-label={c.result} placeholder={translationPlaceholder(language)} lang="ko" dir="ltr" value={answer.korean} disabled={busy||!answer.translatedSource||answer.translatedSource!==answer.source} onChange={e=>onKorean(e.target.value)}/>
  </section>
 </div>;
}
