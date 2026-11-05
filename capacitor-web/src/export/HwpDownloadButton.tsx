import {useEffect,useRef,useState} from 'react';
import type {IntakeSession} from '../intake/types';
import {buildApplicationPlan} from './plan';

/** Direct replacement for the former TXT action. Always generate from the
 * current applicant-edited answers; never reuse a previous export snapshot. */
export function HwpDownloadButton({session,reviewed,language,label,disabled,onNotice,onError}:{
  session:IntakeSession;reviewed:boolean;language:string;label:string;disabled:boolean;
  onNotice:(message:string)=>void;onError:(message:string)=>void;
}) {
  const [saving,setSaving]=useState(false);
  const generation=useRef(0),locked=useRef(false);
  const ko=language==='ko';
  useEffect(()=>{
    generation.current++;locked.current=false;setSaving(false);
    return()=>{generation.current++;};
  },[session,reviewed]);
  async function save(){
    if(disabled||locked.current)return;
    locked.current=true;setSaving(true);onNotice('');onError('');
    const request=++generation.current;
    try{
      const plan=buildApplicationPlan(session,reviewed);
      const {createApplicationHwp}=await import('./hwp');
      const bytes=await createApplicationHwp(plan);
      if(request!==generation.current)return;
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/x-hwp'}));
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download=`DARI-${plan.test?'TEST-':''}application-review.hwp`;
      try{document.body.append(anchor);anchor.click();}
      finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
      onNotice(ko?'현재 답변을 채운 검토용 HWP의 다운로드를 요청했습니다. 서명·동의란은 비워두며 신청서는 제출되지 않았습니다.':'Review HWP download requested with your current answers. Signatures and consent remain blank. Your application has not been submitted.');
    }catch(error){
      if(request===generation.current)onError((ko?'HWP를 저장하지 못했습니다: ':'Could not save HWP: ')+(error instanceof Error?error.message:String(error)));
    }finally{
      if(request===generation.current){locked.current=false;setSaving(false);}
    }
  }
  return <button className="secondary" disabled={disabled||saving} aria-busy={saving} onClick={()=>void save()}>{saving?(ko?'HWP 생성 중…':'Creating HWP…'):`${label} (HWP)`}</button>;
}
