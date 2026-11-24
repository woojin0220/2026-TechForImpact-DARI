import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { intakeLanguages } from '../intakeCopy';
import { localizedLabel } from '../form/localize';
import { LanguageEntry } from '../app/LanguageEntry';
import { appTexts } from '../app/texts';
import { onDeviceLlm } from '../lib/onDeviceLlm';
import { questions, questionGroups, sectionsForGroup, supportsConversation, isQuickQuestion, isCurrent, writtenAnswers, type Answer } from './model';
import { sessionDraftRepository, type ApplicationDraftRepository } from './repository';
import { useDraft } from './useDraft';
import { translateAnswer } from './translate';
import { downloadApplication } from './docx';
import { prepareDownload } from './prepareDownload';
import { applicationCopy, downloadCopy, translationFailure } from './copy';
import { QuickAnswer } from './QuickAnswer';
import { AnswerEditor } from './AnswerEditor';
import { SelectMenu } from '../ui/SelectMenu';
import { workspaceCopy, subsectionLabel } from './workspaceCopy';
import { questionGuide } from './inputGuidance';
import { designCopy } from './designCopy';
import { serializeFields, type FieldValues } from './structuredAnswer';
import './application.css';
import { BackButton, Button, ScreenHeader } from '../ui/ScreenControls';

const NarrativeWorkspace=lazy(()=>import('./NarrativeWorkspace').then(module=>({default:module.NarrativeWorkspace})));
const guestRepository=sessionDraftRepository({userId:null});
export default function Application({gate, headerAccessory, repository=guestRepository}: {gate?: ReactNode; headerAccessory?: ReactNode; repository?: ApplicationDraftRepository}) {
 const {language,setLanguage,answers,setAnswers,loaded,storageError}=useDraft(repository);
 const [conversation,setConversation]=useState(false);
 const [groupId,setGroupId] = useState<string|null>(null);
 const [selected,setSelected] = useState<string|null>(null);
 const [review,setReview]=useState(false);
 const selectedRef=useRef(selected);
 selectedRef.current=selected;
 const scrollPositions=useRef<Record<string,number>>({});
 const [busyId,setBusyId] = useState<string|null>(null);
 const [exporting,setExporting] = useState(false);
 const [progress,setProgress] = useState({done:0,total:0});
 const busy = busyId !== null || exporting;
 const [error,setError] = useState('');
 const [importing,setImporting] = useState(false);
 const main = useRef<HTMLElement>(null);
 const c = applicationCopy(language);
 const d=designCopy(language);
 const dc = downloadCopy(language);
 const wc = workspaceCopy(language);
 const native = Capacitor.isNativePlatform();
 useEffect(() => { if (language) { document.documentElement.lang=language; document.documentElement.dir=['ar','fa'].includes(language)?'rtl':'ltr'; } },[language]);
 useEffect(() => { main.current?.focus({preventScroll:true});window.scrollTo(0,scrollPositions.current[selected?`${selected}:${review?'review':'write'}`:groupId?`group:${groupId}`:'root']??0); },[selected,groupId,review]);
 const group = questionGroups.find(g => g.id===groupId);
 const question = questions.find(q => q.id===selected);
 const wholeTable = question?.fields[0].type==='table' && question.id===group?.id;
 const answer: Answer = (selected && answers[selected]) || {source:'',language,korean:'',translatedSource:''};
 const entries = writtenAnswers(answers);
 const label = (ko:string,en:string) => localizedLabel(language,ko,en);
 function changeAnswer(id: string, source: string, korean?: string) {
  setAnswers(prev => {
   const saved = prev[id];
   const current = saved ?? {source:'',language,korean:'',translatedSource:''};
   const translated = korean;
   return {...prev,[id]:{...current,source,...(translated!==undefined ? {korean:translated,translatedSource:source,targetLanguage:'ko',translatedTarget:'ko',translatedLanguage:current.language} : {})}};
  }); setError('');
 }
 function updateSource(source: string) { if (selected) changeAnswer(selected,source); }
 function updateFields(fieldValues:FieldValues,id=selected){
  const q=questions.find(q=>q.id===id);if(!q)return;
  setAnswers(prev=>{const current=prev[q.id]??{source:'',language,korean:'',translatedSource:''};return {...prev,[q.id]:{...current,fieldValues,source:serializeFields(q,fieldValues,current.language)}};});setError('');
 }
 function remember(){scrollPositions.current[selected?`${selected}:${review?'review':'write'}`:groupId?`group:${groupId}`:'root']=window.scrollY;}
 function openQuestion(id:string){remember();setReview(false);setSelected(id);setError('');}
 function leaveQuestion(){remember();setReview(false);setSelected(null);if(group?.questions.length===1)setGroupId(null);}
 function goBack() {
  if(review){remember();setReview(false);return;}
  if(question)leaveQuestion();
  else{remember();setGroupId(null);}
 }
 async function translate(id: string | null = selected) {
  const snapshot=id ? answers[id] : undefined;
  if(!id || busy || !snapshot?.source.trim()) return;
  if(isCurrent(snapshot,id)&&selectedRef.current===id){scrollPositions.current[`${id}:write`]=window.scrollY;scrollPositions.current[`${id}:review`]=0;setReview(true);return;}
  setBusyId(id);setError('');
  try {
   const target=snapshot.targetLanguage??'ko';
   const korean=await translateAnswer(snapshot.source,snapshot.language,id,target);
   setAnswers(prev => ({...prev,[id]:{...prev[id],korean,translatedSource:snapshot.source,translatedTarget:target,translatedLanguage:snapshot.language}}));
   if(selectedRef.current===id){scrollPositions.current[`${id}:write`]=window.scrollY;scrollPositions.current[`${id}:review`]=0;setReview(true);}
  } catch (error) { setError(translationFailure(error,language,c.error)); } finally { setBusyId(null); }
 }
 async function exportApplication() {
  if(busy || !entries.length) return;
  setExporting(true);setError('');setProgress({done:0,total:0});
  try {
   const ready=await prepareDownload(answers,translateAnswer,setAnswers,(done,total)=>setProgress({done,total}));
   await downloadApplication(ready);
  } catch (error) { setError(translationFailure(error,language,dc.error)); } finally { setExporting(false); }
 }
 async function importModel() {
  setImporting(true);setError('');
  try { await onDeviceLlm.importModel(); } catch { setError(c.error); } finally { setImporting(false); }
 }
 if(!loaded)return null;
 if(!language) return <><LanguageEntry texts={appTexts('en')} status={null} locked={false} onSelect={setLanguage}/>{storageError&&<p role="alert" className="application-warning">{c.storage}</p>}</>;
 if(gate) return <div className="application-page">{gate}</div>;
 if(conversation && question) return <Suspense fallback={<p role="status">{wc.title}…</p>}><NarrativeWorkspace scope={repository.scope} language={answer.language} identityValues={Object.entries(answers).filter(([id])=>['1.2','1.3','1.4','1.5','1.9','1.10','1.11','1.12'].includes(id)).map(([,a])=>a.source)} onBack={()=>setConversation(false)}/></Suspense>;
 return <div className={`application-page${group || question ? ' application-writing' : ''}`} dir={['ar','fa'].includes(language)?'rtl':'ltr'}>
  <ScreenHeader className="application-header" titleClassName="application-brand" title={c.title} leading={(group||question)&&<BackButton className="application-back" label={review?d.edit:c.back} disabled={exporting} onClick={goBack}/>} actions={<div className="application-tools">{!question&&<SelectMenu label={c.language} value={language} disabled={busy} onChange={setLanguage} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))}/>} {headerAccessory}</div>} />
  <main id="main" tabIndex={-1} ref={main} className="application-main">
   {storageError && <p role="alert" className="application-warning">{c.storage}</p>}
   {error && <p role="alert" className="application-warning">{error}</p>}
   {!question ? <>
    <div className="application-heading"><div>{group ? <h2 className="application-section-title">{label(group.ko,group.en)}</h2> : <><p className="application-eyebrow">{c.count} <b>{entries.length} / {questions.length}</b></p><p>{c.intro}</p></>}</div>{!group && <Button variant="primary" aria-live="polite" disabled={!entries.length || busy} onClick={()=>void exportApplication()}>{exporting?`${c.translating} ${progress.done} / ${progress.total}`:c.download} <span aria-hidden="true">↓</span></Button>}</div>
    {!group && <ol className="question-list">{!group ? questionGroups.map(g=>{
     const count=g.questions.filter(q=>answers[q.id]?.source.trim()).length;
     return <li key={g.id}><button className="question-card" disabled={exporting} onClick={()=>{remember();setGroupId(g.id);setReview(false);if(g.questions.length===1 && !isQuickQuestion(g.questions[0])) setSelected(g.questions[0].id);setError('');}}><span className="question-number" dir="ltr">{g.id}</span><span className="question-label">{label(g.ko,g.en).replace(/^\d+\.\s*/, '')}</span><span className={`question-state ${count?'has-answer':''}`}>{count} / {g.questions.length}</span><span aria-hidden="true">›</span></button></li>;
    }) : null}</ol>}
    {group && <div className="question-sections">{sectionsForGroup(group.id).map((section,index,sections)=>{
     const count=section.questions.filter(q=>answers[q.id]?.source.trim()).length;
     const items=<ol className="question-list">{section.questions.map(q=>{
     const a=answers[q.id];
     if (isQuickQuestion(q)) return <li key={q.id}><QuickAnswer question={q} answer={a} language={language} busy={exporting||busyId===q.id} blocked={busy} onChange={(source,korean)=>changeAnswer(q.id,source,korean)} onFields={values=>updateFields(values,q.id)} onTranslate={()=>void translate(q.id)} onKorean={korean=>setAnswers(prev=>({...prev,[q.id]:{...prev[q.id],korean}}))}/></li>;
     return <li key={q.id}><button className="question-card" disabled={exporting} onClick={()=>openQuestion(q.id)}><span className="question-number" dir="ltr">{q.id}</span><span className="question-label">{label(q.fields[0].ko,q.fields[0].en)}</span><span className={`question-state ${a?.source.trim()?'has-answer':''}`}>{a?.source.trim()?(isCurrent(a,q.id)?c.done:c.written):c.empty}</span><span aria-hidden="true">›</span></button></li>;

     })}</ol>;
     return sections.length===1 || section.questions.length===1 ? <div key={section.id}>{items}</div> : <details className="question-section" key={`${group.id}-${section.id}`} open={index===0}>
      <summary><span>{subsectionLabel(section.id,language,label(section.ko,section.en))}</span><span className="question-section-count">{count} / {section.questions.length}</span></summary>{items}
     </details>;
    })}</div>}
    {group && <>{native&&<Button variant="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</Button>}</>}
   </> : <>
    <ol className="writing-progress" aria-label={c.title}><li aria-current={!review?'step':undefined} className={!review?'active':''}><span aria-hidden="true">01</span>{d.write}</li><li aria-current={review?'step':undefined} className={review?'active':''}><span aria-hidden="true">02</span>{d.review}</li></ol>
    {!wholeTable&&<p className="application-eyebrow">{label(question.sectionKo,question.sectionEn)}</p>}
    <header className={`writing-question${wholeTable?' section-question':''}${review?' review-question':''}`}><h2 id="writing-question-title">{wholeTable?label(question.sectionKo,question.sectionEn):<><span className="question-inline-number" dir="ltr">{question.id}.</span> {label(question.fields[0].ko,question.fields[0].en)}</>}</h2>
     {!review&&question.notes.length>0&&<ul className="question-description">{question.notes.map((note,index)=><li key={`note-${index}`}>{label(note.ko,note.en)}</li>)}</ul>}
     {!review&&<details className="writing-guidance"><summary>{d.guidance}</summary><ul>{questionGuide(question,language).split('\n').map((line,i)=><li key={i}>{line.replace(/^•\s*/,'')}</li>)}</ul><a href="https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110202&flSeq=146016207&gubun=" target="_blank" rel="noopener noreferrer">{d.sourceForm} ↗</a></details>}
    </header>
    <AnswerEditor key={question.id} question={question} answer={answer} language={language} busy={busy} review={review} onSource={updateSource}
     onLanguage={next=>setAnswers(prev=>{const current=prev[question.id]??answer;return {...prev,[question.id]:{...current,language:next,...(current.fieldValues?{source:serializeFields(question,current.fieldValues,next)}:{}),translatedSource:''}};})}
     onTarget={targetLanguage=>setAnswers(prev=>({...prev,[question.id]:{...(prev[question.id]??answer),targetLanguage}}))} onFields={updateFields}
     onTranslate={()=>void translate()} onKorean={korean=>setAnswers(prev=>({...prev,[question.id]:{...prev[question.id],korean}}))}
     onEdit={()=>{remember();setReview(false);}} onSave={leaveQuestion}/>
    {!review&&supportsConversation(question)&&<details className="conversation-option"><summary>{wc.entry}</summary><button className="secondary conversation-entry" disabled={busy} onClick={()=>setConversation(true)}>{wc.entry}<span aria-hidden="true">›</span></button></details>}
    {native&&<Button variant="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</Button>}

   </>}
  </main>
 </div>;
}
