import {useEffect,useRef,useState} from 'react';
import {communityCopyFor} from './copy';
const seenThisSession=new Set<string>();
export const welcomeKey=(owner:string,section='community')=>`dari.${section}.welcome.v1.${encodeURIComponent(owner)}`;
export function needsCommunityWelcome(owner:string,section='community'){
 if(typeof window==='undefined')return false;
 if(import.meta.env?.DEV&&new URLSearchParams(window.location.search).get('welcome')==='1')return true;
 if(seenThisSession.has(section+':'+owner))return false;
 try{return localStorage.getItem(welcomeKey(owner,section))!=='1';}catch{return true;}
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
export function CommunityWelcome({owner,language,onDone,section='community',title,messages}:{owner:string;language:string;onDone:()=>void;section?:string;title?:string;messages?:string[]}){
 const c=messages??copies[language]??copies.en,[leaving,setLeaving]=useState(false),finished=useRef(false);
 function finish(){if(finished.current)return;finished.current=true;seenThisSession.add(section+':'+owner);try{localStorage.setItem(welcomeKey(owner,section),'1');}catch{/* Keep the one-time state for this session. */}onDone();}
 useEffect(()=>{const timer=setTimeout(()=>setLeaving(true),2800);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!leaving)return;const timer=setTimeout(finish,220);return()=>clearTimeout(timer);},[leaving]);
 return <section className={`community-welcome${leaving?' leaving':''}`} aria-labelledby="community-welcome-title">
  <div className="community-welcome-content"><div className="community-welcome-brand" aria-hidden="true"><span/>DARI</div><h1 id="community-welcome-title">{title??communityCopyFor(language).title}</h1><p className="community-welcome-message">{c[0]}</p><p className="community-welcome-description">{c[1]}</p></div>
  <button className="quiet community-welcome-skip" type="button" onClick={finish}>{c[2]} <span aria-hidden="true">→</span></button>
 </section>;
}
