import {useEffect,useRef,useState} from 'react';
import {refreshCopy} from './refreshCopy';
export function CommunityTour({language,owner,onClose}:{language:string;owner:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[step,setStep]=useState(0),[rect,setRect]=useState<DOMRect|null>(null);
 const c=refreshCopy(language),steps=[{target:'.board-tabs',title:c.tourBoard,body:c.tourBoardBody},{target:'.community-search',title:c.tourSearch,body:c.tourSearchBody},{target:'.community-top-actions',title:c.tourWrite,body:c.tourWriteBody}];
 function finish(){try{localStorage.setItem(`dari.community.tour.v1.${owner}`,'1');}catch{/* Once per mounted view if storage is unavailable. */}onClose();}
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();(previous?.isConnected?previous:document.querySelector<HTMLElement>('.community-tour-entry'))?.focus();};},[]);
 useEffect(()=>{const measure=()=>setRect(document.querySelector(steps[step].target)?.getBoundingClientRect()??null);measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[step]);
 return <dialog ref={dialog} className="community-tour" aria-labelledby="tour-title" onCancel={event=>{event.preventDefault();finish();}}>
  {rect&&<span className="tour-spotlight" aria-hidden="true" style={{top:rect.top-4,left:rect.left-4,width:rect.width+8,height:rect.height+8}}/>}
  <div className="tour-panel"><small>{c.tour} · {step+1} / 3</small><h2 id="tour-title">{steps[step].title}</h2><p>{steps[step].body}</p><div><button type="button" className="quiet" onClick={finish}>{c.skip}</button><button type="button" className="primary solid" onClick={()=>step===2?finish():setStep(value=>value+1)}>{step===2?c.done:c.next}</button></div></div>
 </dialog>;
}
