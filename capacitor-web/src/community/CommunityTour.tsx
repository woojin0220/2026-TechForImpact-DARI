import {useEffect,useId,useRef,useState} from 'react';
import {refreshCopy} from './refreshCopy';
import {tourCopy,tourKey} from './tourCopy';
import {BackButton} from '../ui/ScreenControls';
import type {CommunityCopy} from './copy';

type Props={language:string;owner:string;copy:CommunityCopy;mode?:'home'|'compose';onSample?:(show:boolean)=>void;onClose:()=>void};
/** A local demonstration only: no API, publication, or access to the member's draft. */
export function CommunityTour({language,owner,copy,mode='home',onSample,onClose}:Props){
 const dialog=useRef<HTMLDialogElement>(null),panel=useRef<HTMLDivElement>(null),next=useRef<HTMLButtonElement>(null);
 const [step,setStep]=useState(mode==='compose'?5:0),[rect,setRect]=useState<{top:number;left:number;width:number;height:number;bottom:number}|null>(null),[panelHeight,setPanelHeight]=useState(210),[typed,setTyped]=useState(0);
 const c=refreshCopy(language),t=tourCopy(language),mask=useId().replace(/:/g,''),writing=step>=5&&step<=7;
 const selectors=['.board-tabs button:nth-child(1)','.board-tabs button:nth-child(2)','.board-tabs button:nth-child(3)','.community-search','.write-button','.tour-compose-preview .board-picker','.tour-compose-preview .tour-fields','.tour-compose-preview .publish-button','.tour-sample-post'];
 const final=mode==='compose'?7:8,first=mode==='compose'?5:0;
 function finish(){try{localStorage.setItem(tourKey(owner,mode),'1');if(step>=5)localStorage.setItem(tourKey(owner,'compose'),'1');}catch{/* Storage failure must never block closing the guide. */}onSample?.(false);onClose();}
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=dialog.current;node?.showModal();next.current?.focus();return()=>{node?.close();(previous?.isConnected?previous:document.querySelector<HTMLElement>('.community-tour-entry'))?.focus();};},[]);
 useEffect(()=>{onSample?.(step===8);},[step,onSample]);
 useEffect(()=>{
  if(step!==6){setTyped(step>6?t[20].length+t[21].length:0);return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setTyped(t[20].length+t[21].length);return;}
  setTyped(0);const timer=setInterval(()=>setTyped(value=>Math.min(value+4,t[20].length+t[21].length)),24);return()=>clearInterval(timer);
 },[step,language]);
 useEffect(()=>{
  let positioned=false;
  const measure=()=>{const target=(writing?dialog.current:document)?.querySelector(selectors[step]);if(!target){setRect(null);return;}if(!positioned){positioned=true;target.scrollIntoView({block:'center',behavior:'instant'});}let r=target.getBoundingClientRect();const height=panel.current?.getBoundingClientRect().height??210;if(innerHeight-r.bottom-26<height&&r.top-26<height){const pane=target.closest('.tour-compose-preview');if(pane){pane.scrollTop+=r.top-pane.getBoundingClientRect().top-16;}else window.scrollBy(0,r.top-64);r=target.getBoundingClientRect();}const pad=10,left=Math.max(8,r.left-pad),top=Math.max(8,r.top-pad),right=Math.min(innerWidth-8,r.right+pad),bottom=Math.min(innerHeight-8,r.bottom+pad);setRect({top,left,width:Math.max(0,right-left),height:Math.max(0,bottom-top),bottom});};
  const frame=requestAnimationFrame(()=>{const target=(writing?dialog.current:document)?.querySelector(selectors[step]);target?.scrollIntoView({block:'center',behavior:'instant'});measure();});
  const observer=new ResizeObserver(()=>{if(panel.current)setPanelHeight(panel.current.getBoundingClientRect().height);measure();});if(panel.current)observer.observe(panel.current);
  const changes=new MutationObserver(measure);changes.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);return()=>{cancelAnimationFrame(frame);observer.disconnect();changes.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[step,writing,language]);
 const viewport=typeof window==='undefined'?{width:390,height:844}:{width:window.innerWidth,height:window.innerHeight};
 const width=Math.min(320,viewport.width-32),left=Math.max(16,Math.min(viewport.width-width-16,(rect?.left??16)+(rect?.width??width)/2-width/2));
 const below=(rect?.bottom??80)+16,above=(rect?.top??80)-panelHeight-16;
 const top=Math.max(12,Math.min(viewport.height-panelHeight-16,below+panelHeight<viewport.height-16?below:above));
 const titleText=step>=7?t[20]:t[20].slice(0,typed),bodyText=step>=7?t[21]:t[21].slice(0,Math.max(0,typed-t[20].length));
 return <dialog ref={dialog} className="community-tour contextual-tour" aria-labelledby="tour-title" onCancel={event=>{event.preventDefault();finish();}}>
  {writing&&<div className="tour-compose-preview community community-compose" inert dir={language==='ar'||language==='fa'?'rtl':'ltr'}>
   <header className="detail-bar"><BackButton label={copy.back} tabIndex={-1}/><h1>{copy.composeTitle}</h1><button className="publish-button ready" type="button" tabIndex={-1}>{copy.publish}</button></header>
   <p className="tour-example-label">{t[18]}</p><div className="compose-form"><fieldset className="board-picker"><legend>{copy.board}</legend>{(['qna','life'] as const).map(board=><label key={board}><input type="radio" name="tour-board" checked={board==='qna'} readOnly/><span>{copy[`board_${board}`]}</span></label>)}</fieldset>
   <div className="tour-fields"><input className="compose-title" aria-label={copy.postTitle} placeholder={copy.postTitle} value={titleText} readOnly dir="auto"/><textarea className="compose-body" aria-label={copy.postBody} placeholder={t[19]} value={bodyText} readOnly dir="auto"/></div><p className="safety-note compose-privacy">{copy.composeNote}</p></div>
  </div>}
  <svg className="tour-mask" aria-hidden="true" width="100%" height="100%"><defs><mask id={mask}><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="16" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="#151515" fillOpacity=".55" mask={`url(#${mask})`}/>{rect&&<rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="16" fill="none" stroke="white" strokeWidth="1.5"/>}</svg>
  <div ref={panel} className="tour-panel" style={{top,left,width}}><small>{c.tour} · {step-first+1} / {final-first+1}</small><h2 id="tour-title">{t[step*2]}</h2><p>{t[step*2+1]}</p><div><button type="button" className="quiet" onClick={finish}>{c.skip}</button>{step>first&&<button type="button" className="quiet tour-previous" onClick={()=>setStep(value=>value-1)}>{copy.back}</button>}<button ref={next} type="button" className="primary solid" onClick={()=>step===final?finish():setStep(value=>value+1)}>{step===final?c.done:c.next}</button></div></div>
 </dialog>;
}
