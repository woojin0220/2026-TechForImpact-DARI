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
import './application.css';
import { BackButton, Button, ScreenHeader } from '../ui/ScreenControls';

const NarrativeWorkspace=lazy(()=>import('./NarrativeWorkspace').then(module=>({default:module.NarrativeWorkspace})));
const guestRepository=sessionDraftRepository({userId:null});
export default function Application({gate, headerAccessory, repository=guestRepository}: {gate?: ReactNode; headerAccessory?: ReactNode; repository?: ApplicationDraftRepository}) {
 const {language,setLanguage,answers,setAnswers,loaded,storageError}=useDraft(repository);
 const [conversation,setConversation]=useState(false);
 const [groupId,setGroupId] = useState<string|null>(null);
 const [selected,setSelected] = useState<string|null>(null);
 const [busyId,setBusyId] = useState<string|null>(null);
 const [exporting,setExporting] = useState(false);
 const [progress,setProgress] = useState({done:0,total:0});
 const busy = busyId !== null || exporting;
 const [error,setError] = useState('');
 const [importing,setImporting] = useState(false);
 const main = useRef<HTMLElement>(null);
 const c = applicationCopy(language);
 const dc = downloadCopy(language);
 const wc = workspaceCopy(language);
 const native = Capacitor.isNativePlatform();
 useEffect(() => { if (language) { document.documentElement.lang=language; document.documentElement.dir=['ar','fa'].includes(language)?'rtl':'ltr'; } },[language]);
 useEffect(() => { main.current?.focus(); window.scrollTo(0,0); },[selected,groupId]);
 const group = questionGroups.find(g => g.id===groupId);
 const question = questions.find(q => q.id===selected);
 const answer: Answer = (selected && answers[selected]) || {source:'',language,korean:'',translatedSource:''};
 const entries = writtenAnswers(answers);
 const label = (ko:string,en:string) => localizedLabel(language,ko,en);
 function changeAnswer(id: string, source: string, korean?: string) {
  setAnswers(prev => {
   const saved = prev[id];
   const current = saved ?? {source:'',language,korean:'',translatedSource:''};
   const translated = korean ?? (current.language==='ko' ? source : undefined);
   return {...prev,[id]:{...current,source,...(translated!==undefined ? {korean:translated,translatedSource:source} : {})}};
  }); setError('');
 }
 function updateSource(source: string) { if (selected) changeAnswer(selected,source); }
 async function translate(id: string | null = selected) {
  const snapshot=id ? answers[id] : undefined;
  if(!id || busy || !snapshot?.source.trim()) return;
  setBusyId(id);setError('');
  try {
   const korean=await translateAnswer(snapshot.source,snapshot.language,id);
   setAnswers(prev => ({...prev,[id]:{...prev[id],korean,translatedSource:snapshot.source}}));
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
  <ScreenHeader className="application-header" titleClassName="application-brand" title={c.title} actions={<div className="application-tools">{!question&&<SelectMenu label={c.language} value={language} disabled={busy} onChange={setLanguage} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))}/>} {headerAccessory}</div>} />
  <main id="main" tabIndex={-1} ref={main} className="application-main">
   {storageError && <p role="alert" className="application-warning">{c.storage}</p>}
   {error && <p role="alert" className="application-warning">{error}</p>}
   {!question ? <>
    {group && <BackButton className="application-back" label={c.back} onClick={()=>setGroupId(null)} />}
    <div className="application-heading"><div>{group ? <h2 className="application-section-title">{label(group.ko,group.en)}</h2> : <><p className="application-eyebrow">{c.count} <b>{entries.length} / {questions.length}</b></p><p>{c.intro}</p></>}</div>{!group && <Button variant="primary" aria-live="polite" disabled={!entries.length || busy} onClick={()=>void exportApplication()}>{exporting?`${c.translating} ${progress.done} / ${progress.total}`:c.download} <span aria-hidden="true">↓</span></Button>}</div>
    {!group && <ol className="question-list">{!group ? questionGroups.map(g=>{
     const count=g.questions.filter(q=>answers[q.id]?.source.trim()).length;
     return <li key={g.id}><button className="question-card" disabled={exporting} onClick={()=>{setGroupId(g.id);if(g.questions.length===1 && !isQuickQuestion(g.questions[0])) setSelected(g.questions[0].id);setError('');}}><span className="question-number" dir="ltr">{g.id}</span><span className="question-label">{label(g.ko,g.en).replace(/^\d+\.\s*/, '')}</span><span className={`question-state ${count?'has-answer':''}`}>{count} / {g.questions.length}</span><span aria-hidden="true">›</span></button></li>;
    }) : null}</ol>}
    {group && <div className="question-sections">{sectionsForGroup(group.id).map((section,index,sections)=>{
     const count=section.questions.filter(q=>answers[q.id]?.source.trim()).length;
     const items=<ol className="question-list">{section.questions.map(q=>{
     const a=answers[q.id];
     if (isQuickQuestion(q)) return <li key={q.id}><QuickAnswer question={q} answer={a} language={language} busy={exporting||busyId===q.id} blocked={busy} onChange={(source,korean)=>changeAnswer(q.id,source,korean)} onTranslate={()=>void translate(q.id)} onKorean={korean=>setAnswers(prev=>({...prev,[q.id]:{...prev[q.id],korean}}))}/></li>;
     return <li key={q.id}><button className="question-card" disabled={exporting} onClick={()=>{setSelected(q.id);setError('');}}><span className="question-number" dir="ltr">{q.id}</span><span className="question-label">{label(q.fields[0].ko,q.fields[0].en)}</span><span className={`question-state ${a?.source.trim()?'has-answer':''}`}>{a?.source.trim()?(isCurrent(a,q.id)?c.done:c.written):c.empty}</span><span aria-hidden="true">›</span></button></li>;

     })}</ol>;
     return sections.length===1 || section.questions.length===1 ? <div key={section.id}>{items}</div> : <details className="question-section" key={`${group.id}-${section.id}`} open={index===0}>
      <summary><span>{subsectionLabel(section.id,language,label(section.ko,section.en))}</span><span className="question-section-count">{count} / {section.questions.length}</span></summary>{items}
     </details>;
    })}</div>}
    {group && <>{native&&<Button variant="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</Button>}</>}
   </> : <>
    <BackButton className="application-back" label={c.back} disabled={busy} onClick={()=>{setSelected(null);if(group?.questions.length===1)setGroupId(null);}} />
    <p className="application-eyebrow">{label(question.sectionKo,question.sectionEn)}</p>
    <header className="writing-question"><span className="writing-question-number" dir="ltr">{question.id}</span><h2 id="writing-question-title">{label(question.fields[0].ko,question.fields[0].en)}</h2></header>
    {supportsConversation(question) && <button className="secondary conversation-entry" disabled={busy} onClick={()=>setConversation(true)}>{wc.entry} <span aria-hidden="true">›</span></button>}
    <AnswerEditor question={question} answer={answer} language={language} busy={busy} onSource={updateSource}
     onLanguage={next=>setAnswers(prev=>({...prev,[question.id]:{...answer,language:next,translatedSource:'',...(next==='ko'?{korean:answer.source,translatedSource:answer.source}:{})}}))}
     onTranslate={()=>void translate()} onKorean={korean=>setAnswers(prev=>({...prev,[question.id]:{...answer,korean}}))}/>
    {native&&<Button variant="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</Button>}

   </>}
  </main>
 </div>;
}
