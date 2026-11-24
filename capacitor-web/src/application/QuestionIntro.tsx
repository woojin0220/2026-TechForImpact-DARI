import { useEffect, useRef, useState } from 'react';
import { intakeLanguages } from '../intakeCopy';
import { localizedLabel } from '../form/localize';
import { Button } from '../ui/ScreenControls';
import { SelectMenu } from '../ui/SelectMenu';
import { designCopy } from './designCopy';
import { focusCopy } from './focusCopy';
import { guidanceItems, guidanceKey } from './questionGuidance';
import type { Question, TranslationLanguage } from './model';
import { guidanceFlowCopy } from './guidanceFlowCopy';

export function QuestionIntro({question,language,sourceLanguage,targetLanguage,acknowledged,section=false,settings=false,onFinish}:{question:Question;language:string;sourceLanguage:string;targetLanguage:TranslationLanguage;acknowledged:boolean;section?:boolean;settings?:boolean;onFinish:(source:string,target:TranslationLanguage,key:string)=>void}){
 const c=focusCopy(language),d=designCopy(language),flow=guidanceFlowCopy(language),items=guidanceItems(question,language),key=guidanceKey(question,language);
 const [checked,setChecked]=useState<string[]>(acknowledged?items:[]),[revealed,setRevealed]=useState(acknowledged?items.length:1),[source,setSource]=useState(sourceLanguage),[target,setTarget]=useState(targetLanguage);
 const rows=useRef<(HTMLLabelElement|null)[]>([]),languagePanel=useRef<HTMLDivElement>(null),follow=useRef(false);
 const ready=items.every(item=>checked.includes(item)),settingsOnly=settings&&acknowledged;
 useEffect(()=>{
  if(!follow.current)return;follow.current=false;
  const frame=requestAnimationFrame(()=>{
   const next=ready?languagePanel.current:rows.current[items.findIndex(item=>!checked.includes(item))];if(!next)return;
   const rect=next.getBoundingClientRect(),safeBottom=window.innerHeight-150;
   if(rect.bottom>safeBottom)window.scrollTo({top:Math.max(0,window.scrollY+rect.bottom-safeBottom),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });return ()=>cancelAnimationFrame(frame);
 },[checked,ready,items]);
 const title=section||question.fields[0].type==='table'?localizedLabel(language,question.sectionKo,question.sectionEn):`${question.id}. ${localizedLabel(language,question.fields[0].ko,question.fields[0].en)}`;
 return <section className="question-intro guidance-flow" aria-labelledby="intro-question-title">
  <p className="intro-caption">{settingsOnly?c.settings:c.intro}{!settingsOnly&&<span dir="ltr" aria-live="polite" aria-atomic="true">{flow.progress} {checked.length} / {items.length}</span>}</p>
  <h2 id="intro-question-title">{settingsOnly?c.languages:title}</h2>
  {!settingsOnly&&<>
   <div className={`guidance-welcome${checked.length?' is-compact':''}`}><div><p>{flow.count.replace('{n}',String(items.length))}</p></div></div>
   <p id="guidance-method" className="guidance-method">{flow.method}</p>
   <div className="guidance-checks">{items.slice(0,revealed).map((item,index)=>{
    const done=checked.includes(item),active=index===items.findIndex(text=>!checked.includes(text));
    return <label ref={el=>{rows.current[index]=el;}} className={`guidance-check${done?' checked':''}${active?' is-active':''}`} key={item}>
     <input type="checkbox" checked={done} aria-describedby="guidance-method" onChange={e=>{
      const next=e.target.checked?[...checked,item]:checked.filter(text=>text!==item);setChecked(next);
      if(e.target.checked){follow.current=true;const pending=items.findIndex(text=>!next.includes(text));setRevealed(previous=>Math.max(previous,pending<0?items.length:pending+1));}
     }}/>
     <span className="guidance-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></span>
     <span className="guidance-check-content">{item}</span>
    </label>;
   })}</div>
  </>}
  {(ready||settingsOnly)&&<div className="intro-language-panel" ref={languagePanel}>
   {!settingsOnly&&<><p className="guidance-finished"><span aria-hidden="true">✓</span>{flow.ready}</p><h3>{c.languages}</h3></>}
   <div className="intro-languages"><div><span>{c.source}</span><SelectMenu label={c.source} value={source} onChange={setSource} options={intakeLanguages.map(l=>({value:l.code,label:l.name}))}/></div><div><span>{c.target}</span><SelectMenu label={c.target} value={target} onChange={v=>setTarget(v as TranslationLanguage)} options={[{value:'ko',label:d.ko},{value:'en',label:d.en}]}/></div></div>
  </div>}
  <div className="intro-actions"><Button variant="primary" disabled={!ready} onClick={()=>onFinish(source,target,key)}>{c.start}<span aria-hidden="true">→</span></Button></div>
 </section>;
}
