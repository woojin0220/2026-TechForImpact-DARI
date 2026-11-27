import {useEffect,useId,useRef,useState} from 'react';
import {refreshCopy} from '../community/refreshCopy';
import {applicationTourSteps,type ApplicationTourMode} from './tour';

/** Visual help only: never fills, translates, or saves an applicant's answers. */
export function ApplicationTour({language,mode,onClose}:{language:string;mode:ApplicationTourMode;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),panel=useRef<HTMLDivElement>(null),next=useRef<HTMLButtonElement>(null);
 const [step,setStep]=useState(0),[rect,setRect]=useState<DOMRect|null>(null),[height,setHeight]=useState(220);
 const id=useId().replace(/:/g,''),steps=applicationTourSteps(language,mode),current=steps[step],c=refreshCopy(language);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=dialog.current;node?.showModal();next.current?.focus();return()=>{node?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 useEffect(()=>{
  const target=document.querySelector<HTMLElement>(current.selector);
  const measure=()=>{setRect(target?.getBoundingClientRect()??null);if(panel.current)setHeight(panel.current.getBoundingClientRect().height);};
  target?.scrollIntoView({block:'center',behavior:'instant'});
  const frame=requestAnimationFrame(measure),observer=new ResizeObserver(measure);
  if(target)observer.observe(target);if(panel.current)observer.observe(panel.current);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[current.selector,language]);
 const width=Math.min(340,innerWidth-32),left=(innerWidth-width)/2,base=innerHeight-height-84;
 const top=Math.max(16,rect&&rect.bottom>base-16?Math.min(base,rect.top-height-24):base);
 const x=Math.max(8,(rect?.left??8)-10),y=Math.max(8,(rect?.top??8)-10);
 const right=Math.min(innerWidth-8,(rect?.right??8)+10),bottom=Math.min(innerHeight-8,(rect?.bottom??8)+10);
 return <dialog ref={dialog} className="community-tour contextual-tour application-tour" aria-labelledby={`${id}-title`} dir={['ar','fa'].includes(language)?'rtl':'ltr'} onCancel={event=>{event.preventDefault();onClose();}}>
  <svg className="tour-mask" aria-hidden="true" width="100%" height="100%"><defs><mask id={id}><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={x} y={y} width={Math.max(0,right-x)} height={Math.max(0,bottom-y)} rx="16" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="#151515" fillOpacity=".55" mask={`url(#${id})`}/>{rect&&<rect x={x} y={y} width={Math.max(0,right-x)} height={Math.max(0,bottom-y)} rx="16" fill="none" stroke="white" strokeOpacity=".6" strokeWidth="1"/>}</svg>
  <div ref={panel} className="tour-panel" style={{top,left,width}}><small>{c.tour} · {step+1} / {steps.length}</small><h2 id={`${id}-title`}>{current.title}</h2><p>{current.body}</p><div><button type="button" className="quiet" onClick={onClose}>{c.skip}</button><button ref={next} type="button" className="primary solid" onClick={()=>step===steps.length-1?onClose():setStep(step+1)}>{step===steps.length-1?c.done:c.next}</button></div></div>
 </dialog>;
}
