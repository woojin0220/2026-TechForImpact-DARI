import { useCallback, useEffect, useRef, useState } from 'react';
import { intakeLanguages } from '../intakeCopy';
import { localizedLabel } from '../form/localize';
import { Button } from '../ui/ScreenControls';
import { SelectMenu } from '../ui/SelectMenu';
import { designCopy } from './designCopy';
import { focusCopy } from './focusCopy';
import { guidanceGroups, guidanceKey } from './questionGuidance';
import type { Question, TranslationLanguage } from './model';
import { guidanceFlowCopy } from './guidanceFlowCopy';
import { guidanceStageCopy } from './guidanceStageCopy';

type Stage='question'|'explain'|'check'|'language';
export function QuestionIntro({question,language,sourceLanguage,targetLanguage,acknowledged,section=false,settings=false,onFinish}:{question:Question;language:string;sourceLanguage:string;targetLanguage:TranslationLanguage;acknowledged:boolean;section?:boolean;settings?:boolean;onFinish:(source:string,target:TranslationLanguage,key:string)=>void}){
 const c=focusCopy(language),d=designCopy(language),flow=guidanceFlowCopy(language),s=guidanceStageCopy(language),groups=guidanceGroups(question,language),items=groups.content,key=guidanceKey(question,language);
 const [stage,setStage]=useState<Stage>(settings&&acknowledged?'language':'question');
 const [leaving,setLeaving]=useState(false),[automatic,setAutomatic]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches),[visible,setVisible]=useState(()=>document.visibilityState==='visible');
 const [checked,setChecked]=useState<string[]>(acknowledged?items:[]),[revealed,setRevealed]=useState(acknowledged?items.length:1),[source,setSource]=useState(sourceLanguage),[target,setTarget]=useState(targetLanguage);
 const rows=useRef<(HTMLLabelElement|null)[]>([]),heading=useRef<HTMLHeadingElement>(null),transitionTimer=useRef<number|undefined>(undefined),autoTimer=useRef<number|undefined>(undefined),follow=useRef(false),completedByUser=useRef(false);
 const ready=items.every(item=>checked.includes(item));
 const title=section||question.fields[0].type==='table'?localizedLabel(language,question.sectionKo,question.sectionEn):localizedLabel(language,question.fields[0].ko,question.fields[0].en);
 const move=useCallback((next:Stage,focus=true)=>{
  window.clearTimeout(autoTimer.current);window.clearTimeout(transitionTimer.current);if(next==='language')completedByUser.current=false;setLeaving(true);
  transitionTimer.current=window.setTimeout(()=>{setStage(next);setLeaving(false);window.scrollTo(0,0);if(focus)requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);
 },[]);
 useEffect(()=>()=>window.clearTimeout(transitionTimer.current),[]);
 useEffect(()=>{const changed=()=>setVisible(document.visibilityState==='visible');document.addEventListener('visibilitychange',changed);return ()=>document.removeEventListener('visibilitychange',changed);},[]);
 useEffect(()=>{
  if(!automatic||!visible||leaving||!['question','explain'].includes(stage))return;
  const text=stage==='question'?title:s.explain+groups.response.join(' ');
  const timer=window.setTimeout(()=>move(stage==='question'?'explain':'check',false),Math.min(15000,Math.max(4200,text.length*65)));autoTimer.current=timer;
  return ()=>window.clearTimeout(timer);
 },[stage,automatic,visible,leaving,key,title,s.explain,move]);
 useEffect(()=>{
  if(stage!=='check'||!ready||!completedByUser.current||!automatic||!visible)return;
  const timer=window.setTimeout(()=>{completedByUser.current=false;move('language',false);},1000);autoTimer.current=timer;
  return ()=>window.clearTimeout(timer);
 },[stage,ready,automatic,visible,move]);
 useEffect(()=>{
  if(stage!=='check'||!follow.current||ready)return;follow.current=false;
  const frame=requestAnimationFrame(()=>{const next=rows.current[items.findIndex(item=>!checked.includes(item))];if(!next)return;const rect=next.getBoundingClientRect(),safeBottom=window.innerHeight-150;if(rect.bottom>safeBottom)window.scrollTo({top:Math.max(0,window.scrollY+rect.bottom-safeBottom),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});return ()=>cancelAnimationFrame(frame);
 },[checked,stage,ready,key]);
 const stageTitle=stage==='question'?title:stage==='explain'?s.explain.replace('{n}',String(items.length)):stage==='check'?s.contents:c.languages;
 return <section className={`question-intro guidance-stage stage-${stage}${leaving?' stage-leaving':''}`} data-stage={stage} aria-labelledby="intro-question-title" aria-busy={leaving}>
  <div className="stage-topline"><span>{question.id.replace('section-','')}</span>{['question','explain'].includes(stage)&&<button type="button" className="stage-pause" aria-label={automatic?s.pause:s.play} aria-pressed={!automatic} onClick={()=>setAutomatic(!automatic)}>{automatic?'Ⅱ':'▷'}</button>}{stage==='check'&&<span className="stage-count" dir="ltr" aria-live="polite">{checked.length} / {items.length}</span>}</div>
  <div className="stage-content" key={stage}>
   <h2 ref={heading} id="intro-question-title" tabIndex={-1}>{stageTitle}</h2>
   {stage==='explain'&&groups.response.length>0&&<div className="stage-answer-method"><h3>{s.answer}</h3>{groups.response.map((text,i)=><p key={i}>{text}</p>)}</div>}
   {stage==='check'&&<>
    <p id="guidance-method" className="guidance-method">{s.method}<br/>{s.finish}</p>
    <button className="stage-question-link" type="button" disabled={leaving} onClick={()=>move('question')}>{s.question} ↗</button>
    {groups.support.length>0&&<details className="stage-support"><summary>{s.support}</summary>{groups.support.map((text,i)=><p key={i}>{text}</p>)}</details>}
    <div className="guidance-checks">{items.slice(0,revealed).map((item,index)=>{
     const done=checked.includes(item),active=index===items.findIndex(text=>!checked.includes(text));
     return <label ref={el=>{rows.current[index]=el;}} className={`guidance-check${done?' checked':''}${active?' is-active':''}`} key={item}>
      <input type="checkbox" checked={done} disabled={leaving} aria-describedby="guidance-method" onChange={e=>{const next=e.target.checked?[...checked,item]:checked.filter(text=>text!==item);setChecked(next);completedByUser.current=items.every(text=>next.includes(text));if(e.target.checked){follow.current=true;const pending=items.findIndex(text=>!next.includes(text));setRevealed(previous=>Math.max(previous,pending<0?items.length:pending+1));}}}/>
      <span className="guidance-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span><span className="guidance-check-content">{item}</span>
     </label>;
    })}</div>
    {ready&&<p className="guidance-finished" role="status">✓ {flow.ready}</p>}
   </>}
   {stage==='language'&&<div className="intro-languages"><div><span>{c.source}</span><SelectMenu label={c.source} value={source} disabled={leaving} onChange={setSource} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))}/></div><div><span>{c.target}</span><SelectMenu label={c.target} value={target} disabled={leaving} onChange={v=>setTarget(v as TranslationLanguage)} options={[{value:'ko',label:d.ko},{value:'en',label:d.en}]}/></div></div>}
  </div>
  <div className="intro-actions stage-actions">
   {stage!=='question'&&<Button disabled={leaving} onClick={()=>move(stage==='language'?'check':stage==='check'?'explain':'question')}>{c.previous}</Button>}
   <Button variant="primary" disabled={leaving||(stage==='check'&&!ready)||(stage==='language'&&!ready)} onClick={()=>stage==='language'?onFinish(source,target,key):move(stage==='question'?'explain':stage==='explain'?'check':'language')}>{stage==='language'?c.start:stage==='check'?s.language:s.next}<span aria-hidden="true">→</span></Button>
  </div>
 </section>;
}
