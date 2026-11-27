import { useState } from 'react';
import { useAuth } from './AuthContext';
const copies:Record<string,string[]>={
 ko:['DARI 체험하기','신청서 작성, 일정 관리, 커뮤니티를 사용해 보세요.','체험 시작','실제 계정이나 이메일 인증 없이 샘플 데이터로 시작합니다.','시작하지 못했습니다. 다시 시도해 주세요.'],
 en:['Try DARI','Explore application writing, scheduling and the community.','Start testing','Start with sample data. No account or email verification needed.','Could not start. Please try again.'],
 fr:['Essayer DARI','Découvrez la rédaction, le suivi des démarches et la communauté.','Commencer','Données de démonstration, sans compte ni vérification par e-mail.','Impossible de démarrer. Réessayez.'],
 ru:['Попробовать DARI','Ознакомьтесь с заявлением, планировщиком и сообществом.','Начать','Пример данных без регистрации и подтверждения почты.','Не удалось начать. Повторите.'],
 ar:['جرّب DARI','استكشف كتابة الطلب وإدارة المواعيد والمجتمع.','بدء التجربة','ابدأ ببيانات تجريبية دون حساب أو تأكيد البريد الإلكتروني.','تعذّر البدء. حاول مجددًا.'],
 fa:['DARI را امتحان کنید','نوشتن درخواست، برنامه‌ریزی و انجمن را بررسی کنید.','شروع آزمایش','با داده‌های نمونه، بدون حساب یا تأیید ایمیل شروع کنید.','شروع نشد. دوباره تلاش کنید.'],
};
export function FeedbackEntry({language}:{language:string}){
 const {enterSupervisor}=useAuth();const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);const c=copies[language]??copies.en;
 return <main className="account-main sign-in-front" tabIndex={-1} dir={['ar','fa'].includes(language)?'rtl':'ltr'}>
  <p className="front-brand" lang="en">DARI</p><h1>{c[0]}</h1><p>{c[1]}</p>
  <button className="primary" disabled={busy||!enterSupervisor} onClick={async()=>{setBusy(true);setFailed(false);try{await enterSupervisor?.(language);}catch{setFailed(true);setBusy(false);}}}>{c[2]}</button>
  <p className="application-note">{c[3]}</p>{failed&&<p role="alert">{c[4]}</p>}
 </main>;
}
