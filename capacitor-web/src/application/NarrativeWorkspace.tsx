import { useEffect, useRef, useState } from 'react';
import { answerScripted, appendAssistantMessage, narrativeOpening, appendUserMessage, continueConversation, createSession, getActiveFacts, pendingAsk, requirementsById, type IntakeSession, type ScriptedAnswer } from '../intake';
import { cancelIntakeGeneration, generateIntakeModel, setIntakeMaskValues } from '../lib/intakeModel';
import { ConversationStage } from '../app/ConversationStage';
import { appTexts } from '../app/texts';
import { factValue, requirementLabel } from '../app/labels';
import { factGroups, syncConversation } from '../app/review';
import { useModelTask } from '../app/useModelTask';
import { takesOtherText } from '../form/otherChoice';
import { statusWords } from '../statusCopy';
import { applicationCopy } from './copy';
import { workspaceCopy } from './workspaceCopy';
import { loadConversation, saveConversation } from './conversationStorage';
import { BackButton, Button, ScreenHeader } from '../ui/ScreenControls';

/** Existing intake engine, with no draft generator or application answer writer. */
export function NarrativeWorkspace({scope,language,identityValues,onBack}:{scope:string;language:string;identityValues:string[];onBack:()=>void}) {
 const [restored]=useState(()=>loadConversation(scope,language));
 const [session,setSession]=useState<IntakeSession>(()=>restored.work?.session??appendAssistantMessage(createSession(language,'full'),narrativeOpening(language),{kind:'narrative'}));
 const [input,setInput]=useState(restored.work?.input??'');
 const [view,setView]=useState<'conversation'|'facts'>('conversation');
 const [error,setError]=useState('');
 const [storageError,setStorageError]=useState(!!restored.problem);
 const [picked,setPicked]=useState<string[]>([]);
 const [otherText,setOtherText]=useState('');
 const thread=useRef<HTMLDivElement>(null);
 const composer=useRef<HTMLTextAreaElement>(null);
 const task=useModelTask('application-metadata');
 const {busy,controller}=task;
 const c=workspaceCopy(language), ac=applicationCopy(language), texts=appTexts(language);
 const sync=(s:IntakeSession)=>syncConversation(s,language,texts.sc);
 const ask=pendingAsk(session), requirement=ask&&requirementsById.get(ask.requirementId);
 const awaiting=session.messages.at(-1)?.role==='user';
 const facts=getActiveFacts(session);
 useEffect(()=>{const previous=document.documentElement.lang;document.documentElement.lang=language;return()=>{document.documentElement.lang=previous;};},[language]);
 useEffect(()=>{setIntakeMaskValues(identityValues);return()=>{controller.current?.abort();setIntakeMaskValues([]);};},[]);
 useEffect(()=>{
  if(restored.problem)return;
  const saved=saveConversation(scope,language,{version:1,session,language,stage:view,formPage:0,input,picked:[],demo:false,finalReviewedText:'',output:'source',pendingTask:busy?'intake':null});
  setStorageError(!saved);
 },[session,input,view,busy,scope,language,restored]);
 useEffect(()=>{thread.current?.scrollTo({top:thread.current.scrollHeight});},[session.messages.length,busy,view]);
 async function extract(next:IntakeSession) {
  if(controller.current)return;
  setSession(next);setError('');
  await task.track('intake','intake',async(signal,record)=>{
   const result=await continueConversation(next,generateIntakeModel,signal);
   if(!signal.aborted){setSession(sync(result));record();}
  },(_failure,signal)=>{if(!signal.aborted)setError(c.error);});
 }
 function answer(reply:ScriptedAnswer) {
  if(busy)return;
  setSession(sync(answerScripted(session,reply)));setInput('');setPicked([]);setOtherText('');
 }
 function send() {
  if(!input.trim()||busy||awaiting)return;
  if(ask){answer({text:input,status:'answered'});return;}
  const next=appendUserMessage(session,input);setInput('');void extract(next);
 }
 async function stop(){controller.current?.abort();try{await cancelIntakeGeneration();}catch{} }
 function more() {
  setView('conversation');
 }
 return <main id="main" className="application-page application-writing metadata-workspace" dir={texts.direction}>
  <ScreenHeader className="application-header metadata-header" title={c.title} leading={<BackButton className="application-back" label={ac.back} disabled={!!busy} onClick={onBack}/>} />
  <p className="application-note">{c.note}</p>
  <div className="metadata-tabs" role="group" aria-label={c.title}>
   <button className={view==='conversation'?'primary':'secondary'} aria-pressed={view==='conversation'} onClick={()=>setView('conversation')}>{c.chat}</button>
   <button className={view==='facts'?'primary':'secondary'} aria-pressed={view==='facts'} onClick={()=>setView('facts')}>{c.facts} · {facts.length}</button>
  </div>
  {storageError&&<p role="alert" className="application-warning">{c.storage}</p>}
  {error&&<p role="alert" className="application-warning">{error}</p>}
  {view==='conversation' ? <>
   {awaiting&&!busy&&<Button variant="secondary" onClick={()=>void extract(session)}>{c.retry}</Button>}
   {busy&&<p className="application-note" role="status">{c.title} · {task.elapsed}s</p>}
   <ConversationStage texts={texts} language={language} session={session} busy={busy} locked={!!busy||awaiting}
    threadRef={thread} composerRef={composer} input={input} onInput={setInput} ask={ask} askRequirement={requirement}
    askOther={!!requirement&&takesOtherText(requirement.id,requirement.options)} picked={picked} onPick={setPicked} otherText={otherText} onOtherText={setOtherText}
    inNarrative={false} showComposer={!ask || (ask.kind==='field'&&!requirement?.options)} generatingExample={false}
    onGenerateExample={()=>{}} onEndConversation={()=>setView('facts')} onReview={()=>setView('facts')} onDefer={()=>{}} onFinishStory={()=>setView('facts')}
    onAnswer={answer} onSend={send} onStop={()=>void stop()}/>
  </> : <>
   {!facts.length&&<p className="empty-state">{c.empty}</p>}
   {factGroups(facts,language).map(group=><section className="metadata-group" key={group.key}><h2>{group.label}</h2>
    {group.events.map(({eventId,facts:items},index)=><div key={eventId||'general'}>
     {eventId&&<p className="application-eyebrow">{texts.sc.row.replace('{n}',String(index+1))}</p>}
     {items.map(fact=><article className="fact-row" key={fact.id}><div className="fact-row-main"><small>{requirementLabel(fact.requirementId,language)}</small><p dir="auto">{factValue(fact.requirementId,fact.value,language,fact.otherText)}</p></div>
      {fact.status!=='answered'&&<span className="small-tag">{statusWords[language]?.[fact.status]??fact.status}</span>}
      <details className="fact-more"><summary>{texts.copy.source}</summary>{fact.sourceQuotes.map((quote,i)=><blockquote key={i} dir="auto">{quote.quote}</blockquote>)}</details>
     </article>)}
    </div>)}
   </section>)}
   <Button variant="secondary" disabled={!!busy} onClick={more}>{c.chat}</Button>
  </>}
 </main>;
}
