import {useEffect,useId,useRef,useState} from 'react';
import {refreshCopy} from './refreshCopy';
import {tourCopy,tourKey} from './tourCopy';
import {PostComposer,type Shared} from './CommunityScreens';
import type {CommunityCopy} from './copy';

type Props={language:string;owner:string;copy:CommunityCopy;shared:Shared;mode?:'home'|'compose';onSample?:(show:boolean)=>void;onClose:()=>void};
/** A local demonstration only: no API, publication, or access to the member's draft. */
export function CommunityTour({language,owner,copy,shared,mode='home',onSample,onClose}:Props){
 const dialog=useRef<HTMLDialogElement>(null),panel=useRef<HTMLDivElement>(null),next=useRef<HTMLButtonElement>(null);
 const [step,setStep]=useState(mode==='compose'?5:0),[rect,setRect]=useState<{top:number;left:number;width:number;height:number;bottom:number}|null>(null),[panelHeight,setPanelHeight]=useState(210),[typed,setTyped]=useState(0);
 const c=refreshCopy(language),t=tourCopy(language),mask=useId().replace(/:/g,''),writing=step>=5&&step<=7;
 const fieldPhase=step===6?(typed<t[20].length?'title':'body'):'none';
 const selectors=['.board-tabs button:nth-child(1)','.board-tabs button:nth-child(2)','.board-tabs button:nth-child(3)','.community-search','.write-button','.tour-compose-preview .board-picker','.tour-compose-preview .tour-fields','.tour-compose-preview .publish-button','.tour-sample-post'];
 const final=mode==='compose'?7:8,first=mode==='compose'?5:0;
 function finish(){try{localStorage.setItem(tourKey(owner,mode),'1');if(step>=5)localStorage.setItem(tourKey(owner,'compose'),'1');}catch{/* Storage failure must never block closing the guide. */}onSample?.(false);onClose();}
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=dialog.current;node?.showModal();next.current?.focus();return()=>{node?.close();(previous?.isConnected?previous:document.querySelector<HTMLElement>('.community-tour-entry'))?.focus();};},[]);
 useEffect(()=>{onSample?.(step===8);},[step,onSample]);
 useEffect(()=>{
  if(step!==6){setTyped(step>6?t[20].length+t[21].length:0);return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setTyped(t[20].length+t[21].length);return;}
  setTyped(0);let count=0,timer:ReturnType<typeof setTimeout>;
  const titleLength=t[20].length,total=titleLength+t[21].length;
  function tick(){const title=count<titleLength;count=title?Math.min(count+2,titleLength):Math.min(count+3,total);setTyped(count);if(count<total)timer=setTimeout(tick,count===titleLength?500:title?36:24);}
  timer=setTimeout(tick,350);return()=>clearTimeout(timer);
 },[step,language]);
 useEffect(()=>{
  let positioned=false;
  const measure=()=>{const target=(writing?dialog.current:document)?.querySelector(selectors[step]);if(!target){setRect(null);return;}if(!positioned){positioned=true;target.scrollIntoView({block:'center',behavior:'instant'});}let r=target.getBoundingClientRect();const height=panel.current?.getBoundingClientRect().height??210;if((writing&&r.bottom>innerHeight-height-110)||(innerHeight-r.bottom-26<height&&r.top-26<height)){const pane=target.closest('.tour-compose-preview');if(pane){pane.scrollTop+=r.top-pane.getBoundingClientRect().top-16;}else window.scrollBy(0,r.top-64);r=target.getBoundingClientRect();}const pad=step===6||step===8?12:writing?6:10,left=Math.max(8,r.left-pad),top=Math.max(8,r.top-pad),right=Math.min(innerWidth-8,r.right+pad),bottom=Math.min(innerHeight-8,r.bottom+pad);setRect({top,left,width:Math.max(0,right-left),height:Math.max(0,bottom-top),bottom});};
  const frame=requestAnimationFrame(()=>{const target=(writing?dialog.current:document)?.querySelector(selectors[step]);target?.scrollIntoView({block:'center',behavior:'instant'});measure();});
  const settle=setTimeout(measure,400);
  let followFrame=0;const until=performance.now()+340;const follow=()=>{measure();if(performance.now()<until)followFrame=requestAnimationFrame(follow);};followFrame=requestAnimationFrame(follow);
  const observer=new ResizeObserver(()=>{if(panel.current)setPanelHeight(panel.current.getBoundingClientRect().height);measure();});if(panel.current)observer.observe(panel.current);
  const changes=new MutationObserver(measure);changes.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);return()=>{cancelAnimationFrame(frame);clearTimeout(settle);cancelAnimationFrame(followFrame);observer.disconnect();changes.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[step,writing,language]);
 const viewport=typeof window==='undefined'?{width:390,height:844}:{width:window.innerWidth,height:window.innerHeight};
 const width=Math.min(340,viewport.width-32),left=(viewport.width-width)/2;
 const baseTop=viewport.height-panelHeight-84;
 const overlaps=rect&&rect.top<baseTop+panelHeight+12&&rect.bottom>baseTop-12;
 const top=Math.max(12,overlaps?Math.min(baseTop,rect.top-panelHeight-16):baseTop);
 const titleText=step>=7?t[20]:t[20].slice(0,typed),bodyText=step>=7?t[21]:t[21].slice(0,Math.max(0,typed-t[20].length));
 return <dialog ref={dialog} className="community-tour contextual-tour" aria-labelledby="tour-title" onCancel={event=>{event.preventDefault();finish();}}>
  {writing&&<div className="tour-compose-preview" data-tour-field={step===6?fieldPhase:undefined} inert dir={language==='ar'||language==='fa'?'rtl':'ltr'}>
    <PostComposer {...shared} initialBoard="qna" demo={{title:titleText,body:bodyText}} onCancel={()=>{}} onDone={()=>{}}/>
  </div>}
  <svg className="tour-mask" aria-hidden="true" width="100%" height="100%"><defs><mask id={mask}><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="16" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="#151515" fillOpacity=".55" mask={`url(#${mask})`}/>{rect&&<rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="16" fill="none" stroke="white" strokeOpacity=".6" strokeWidth="1"/>}</svg>
  <div ref={panel} className="tour-panel" style={{top,left,width}}><small>{c.tour} · {step-first+1} / {final-first+1}</small><h2 id="tour-title">{step===6?(fieldPhase==='title'?({ko:'먼저 제목을 입력해요',en:'First, write a title',fr:'D’abord, le titre',ru:'Сначала заголовок',ar:'أولاً، اكتب العنوان',fa:'ابتدا عنوان را بنویسید'}[language]??'First, write a title'):({ko:'이어서 내용을 작성해요',en:'Next, write the content',fr:'Ensuite, le contenu',ru:'Затем текст',ar:'ثم اكتب المحتوى',fa:'سپس متن را بنویسید'}[language]??'Next, write the content')):t[step*2]}</h2><p>{t[step*2+1]}</p><div><button type="button" className="quiet" onClick={finish}>{c.skip}</button>{step>first&&<button type="button" className="quiet tour-previous" onClick={()=>setStep(value=>value-1)}>{copy.back}</button>}<button ref={next} type="button" className="primary solid" onClick={()=>step===final?finish():setStep(value=>value+1)}>{step===final?c.done:c.next}</button></div></div>
 </dialog>;
}
