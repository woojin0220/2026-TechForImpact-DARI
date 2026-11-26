import {useEffect,useRef,useState} from 'react';
import {communityCopyFor} from './copy';
const seenThisSession=new Set<string>();
export const welcomeKey=(owner:string)=>`dari.community.welcome.v1.${encodeURIComponent(owner)}`;
export function needsCommunityWelcome(owner:string){
 if(seenThisSession.has(owner))return false;
 try{return localStorage.getItem(welcomeKey(owner))!=='1';}catch{return true;}
}
const copies:Record<string,string[]>={
  "ko": [
    "신청서에 관한 질문부터\n한국 생활 정보까지\n자유롭게 나눠보세요.",
    "바로 둘러보기"
  ],
  "en": [
    "Questions about your application.\nTips for life in Korea.\nA place to share and connect.",
    "Explore now"
  ],
  "fr": [
    "Vos questions sur la demande.\nLa vie quotidienne en Corée.\nUn espace pour échanger.",
    "Découvrir"
  ],
  "ru": [
    "Вопросы о заявлении.\nСоветы о жизни в Корее.\nОбщайтесь и делитесь опытом.",
    "Перейти"
  ],
  "ar": [
    "أسئلة عن طلبك،\nومعلومات عن الحياة في كوريا.\nمساحة للتواصل وتبادل التجارب.",
    "استكشف الآن"
  ],
  "fa": [
    "پرسش‌های درخواست پناهندگی،\nاطلاعات زندگی در کره،\nفضایی برای گفتگو و تبادل تجربه.",
    "مشاهده انجمن"
  ]
};
/** A short first-visit greeting, completed before the interactive walkthrough mounts. */
export function CommunityWelcome({owner,language,onDone}:{owner:string;language:string;onDone:()=>void}){
 const c=copies[language]??copies.en,[leaving,setLeaving]=useState(false),finished=useRef(false);
 function finish(){if(finished.current)return;finished.current=true;seenThisSession.add(owner);try{localStorage.setItem(welcomeKey(owner),'1');}catch{/* Keep the one-time state for this session. */}onDone();}
 useEffect(()=>{const timer=setTimeout(()=>setLeaving(true),2200);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!leaving)return;const timer=setTimeout(finish,220);return()=>clearTimeout(timer);},[leaving]);
 return <section className={`community-welcome${leaving?' leaving':''}`} aria-labelledby="community-welcome-title">
  <div className="community-welcome-content"><h1 id="community-welcome-title">{communityCopyFor(language).title}</h1><p>{c[0]}</p></div>
  <button className="quiet community-welcome-skip" type="button" onClick={finish}>{c[1]} <span aria-hidden="true">→</span></button>
 </section>;
}
