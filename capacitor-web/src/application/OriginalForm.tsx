import pages from '../../public/forms/refugee-application-2024/pages.json';
import {useEffect,useRef} from 'react';

/** Display the unmodified blank form without a browser PDF-viewer frame. */
export function OriginalForm({label,initialPage=1}:{label:string;initialPage?:number}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(initialPage<=1)return;const frame=requestAnimationFrame(()=>root.current?.querySelectorAll('img')[initialPage-1]?.scrollIntoView({block:'start'}));return()=>cancelAnimationFrame(frame);},[initialPage]);
 const base=`${import.meta.env.BASE_URL}forms/refugee-application-2024/`;
 return <div ref={root} className="original-form-pages" dir="ltr" role="region" aria-label={label}>
  {pages.map((page,index)=><img key={page.file} src={base+page.file} width={page.width} height={page.height}
   loading={index===0?'eager':'lazy'} decoding="async" alt={`${label} · ${index+1} / ${pages.length}`}
   onError={e=>{e.currentTarget.alt=label;e.currentTarget.classList.add('original-page-unavailable');}}/>)}
 </div>;
}
