import pages from '../../public/forms/refugee-application-2024/pages.json';

/** Display the unmodified blank form without a browser PDF-viewer frame. */
export function OriginalForm({label}:{label:string}){
 const base=`${import.meta.env.BASE_URL}forms/refugee-application-2024/`;
 return <div className="original-form-pages" dir="ltr" role="region" aria-label={label}>
  {pages.map((page,index)=><img key={page.file} src={base+page.file} width={page.width} height={page.height}
   loading={index===0?'eager':'lazy'} decoding="async" alt={`${label} · ${index+1} / ${pages.length}`}
   onError={e=>{e.currentTarget.alt=label;e.currentTarget.classList.add('original-page-unavailable');}}/>)}
 </div>;
}
