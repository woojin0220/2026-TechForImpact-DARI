import {useEffect,useRef,useState} from 'react';
import {communityCopyFor} from './copy';
const seenThisSession=new Set<string>();
export const welcomeKey=(owner:string)=>`dari.community.welcome.v1.${encodeURIComponent(owner)}`;
export function needsCommunityWelcome(owner:string){
 if(import.meta.env.DEV&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('welcome')==='1')return true;
 if(seenThisSession.has(owner))return false;
 try{return localStorage.getItem(welcomeKey(owner))!=='1';}catch{return true;}
}
const copies:Record<string,string[]>={
  "ko": [
    "질문하고,\n경험을 나누는 곳.",
    "신청서부터 한국 생활까지,\n함께 이야기를 나눠보세요.",
    "바로 둘러보기"
  ],
  "en": [
    "Ask a question.\nShare your experience.",
    "From application questions to life in Korea,\nstart a conversation.",
    "Explore now"
  ],
  "fr": [
    "Posez vos questions.\nPartagez vos expériences.",
    "De la demande à la vie en Corée,\néchangeons ensemble.",
    "Découvrir"
  ],
  "ru": [
    "Задавайте вопросы.\nДелитесь опытом.",
    "От заявления до жизни в Корее —\nдавайте общаться.",
    "Перейти"
  ],
  "ar": [
    "اسأل،\nوشارك تجربتك.",
    "من أسئلة الطلب إلى الحياة في كوريا،\nلنتبادل الحديث والتجارب.",
    "استكشف الآن"
  ],
  "fa": [
    "سؤال بپرسید،\nتجربه‌تان را به اشتراک بگذارید.",
    "از پرسش‌های درخواست تا زندگی در کره،\nبا هم گفتگو کنیم.",
    "مشاهده انجمن"
  ]
};
/** A short first-visit greeting, completed before the interactive walkthrough mounts. */
export function CommunityWelcome({owner,language,onDone}:{owner:string;language:string;onDone:()=>void}){
 const c=copies[language]??copies.en,[leaving,setLeaving]=useState(false),finished=useRef(false);
 function finish(){if(finished.current)return;finished.current=true;seenThisSession.add(owner);try{localStorage.setItem(welcomeKey(owner),'1');}catch{/* Keep the one-time state for this session. */}onDone();}
 useEffect(()=>{const timer=setTimeout(()=>setLeaving(true),2800);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!leaving)return;const timer=setTimeout(finish,220);return()=>clearTimeout(timer);},[leaving]);
 return <section className={`community-welcome${leaving?' leaving':''}`} aria-labelledby="community-welcome-title">
  <div className="community-welcome-content"><div className="community-welcome-brand" aria-hidden="true"><span/>DARI</div><h1 id="community-welcome-title">{communityCopyFor(language).title}</h1><p className="community-welcome-message">{c[0]}</p><p className="community-welcome-description">{c[1]}</p></div>
  <button className="quiet community-welcome-skip" type="button" onClick={finish}>{c[2]} <span aria-hidden="true">→</span></button>
 </section>;
}
