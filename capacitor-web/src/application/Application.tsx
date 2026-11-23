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
import { workspaceCopy, subsectionLabel } from './workspaceCopy';
import './application.css';

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
   const current = saved?.source.trim() ? saved : {source:'',language,korean:'',translatedSource:''};
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
  <header className="application-header"><h1 className="application-brand">{c.title}</h1><div className="application-tools"><label><span className="sr-only">{c.language}</span><select aria-label={c.language} value={language} disabled={busy} onChange={e=>setLanguage(e.target.value)}>{intakeLanguages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></label>{headerAccessory}</div></header>
  <main id="main" tabIndex={-1} ref={main} className="application-main">
   {storageError && <p role="alert" className="application-warning">{c.storage}</p>}
   {error && <p role="alert" className="application-warning">{error}</p>}
   {!question ? <>
    {group && <button className="application-back quiet" onClick={()=>setGroupId(null)}>‹ {c.back}</button>}
    <div className="application-heading"><div>{group ? <h2 className="application-section-title">{label(group.ko,group.en)}</h2> : <><p className="application-eyebrow">{c.count} <b>{entries.length} / {questions.length}</b></p><p>{c.intro}</p></>}</div>{!group && <button className="primary" aria-live="polite" disabled={!entries.length || busy} onClick={()=>void exportApplication()}>{exporting?`${c.translating} ${progress.done} / ${progress.total}`:c.download} <span aria-hidden="true">↓</span></button>}</div>
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
    {group && <>{native&&<button className="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</button>}</>}
   </> : <>
    <button className="application-back" disabled={busy} onClick={()=>{setSelected(null);if(group?.questions.length===1)setGroupId(null);}}>‹ {c.back}</button>
    <p className="application-eyebrow">{label(question.sectionKo,question.sectionEn)}</p>
    <h1><span dir="ltr">{question.id}</span> {label(question.fields[0].ko,question.fields[0].en)}</h1>
    {question.fields.slice(1).map(f=><p className="application-note" key={f.id}>{label(f.ko,f.en)}</p>)}
    {question.fields.map(f=>f.options&&<p className="application-note" key={`${f.id}-options`}>{f.options.map(o=>label(o.ko,o.en)).join(' / ')}</p>)}
    {question.fields.some(f=>f.columns)&&<p className="application-note">{question.fields.flatMap(f=>f.columns??[]).map(col=>label(col.ko,col.en)).join(' · ')}</p>}
    {supportsConversation(question) && <button className="secondary conversation-entry" disabled={busy} onClick={()=>setConversation(true)}>{wc.entry} <span aria-hidden="true">›</span></button>}
    <div className="answer-columns"><section><div className="answer-title"><label htmlFor="answer-source">{c.source}</label><select aria-label={c.language} value={answer.language} disabled={busy} onChange={e=>{const next=e.target.value;setAnswers(prev=>({...prev,[question.id]:{...answer,language:next,korean:'',translatedSource:''}}));}}>{intakeLanguages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></div>
     <textarea id="answer-source" dir="auto" lang={answer.language} value={answer.source} disabled={busy} maxLength={12000} onChange={e=>updateSource(e.target.value)}/>
     <div className="translation-actions"><button className="primary" disabled={busy||!answer.source.trim()} onClick={()=>void translate()}>{busy?c.translating:c.translate}</button><span className="application-note">{answer.source.length.toLocaleString()} / 12,000</span></div>
    </section><section><label className="answer-title" htmlFor="answer-korean">{c.result}</label>
     <textarea id="answer-korean" lang="ko" dir="ltr" value={answer.korean} disabled={busy||!answer.translatedSource||answer.translatedSource!==answer.source} onChange={e=>setAnswers(prev=>({...prev,[question.id]:{...answer,korean:e.target.value}}))}/>
     {(busy || (answer.korean&&!isCurrent(answer,question.id))) && <p className="application-note" role="status">{busy?c.translating:c.stale}</p>}
    </section></div>
    {native&&<button className="secondary" disabled={busy||importing} onClick={()=>void importModel()}>{c.import}</button>}

   </>}
  </main>
 </div>;
}
