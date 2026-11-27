import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { translationSetup } from './nativeTranslation';
import './translationSetup.css';

const copies: Record<string, string[]> = {
 ko:['번역 기능 준비','필요한 언어 모델을 다운로드합니다. 이후에는 기기 안에서 번역하며, 작성한 답변은 번역 서버로 전송하지 않습니다.','Wi-Fi 연결을 권장합니다. 언어당 약 30MB가 필요합니다.','모바일 데이터 사용 허용','다운로드 시작','나중에','언어 모델 다운로드 중…','다운로드하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.'],
 en:['Set up translation','Download the required language models. Translation then runs on this device; your answers are not sent to a translation server.','Wi-Fi recommended. Each language model is about 30 MB.','Allow mobile data','Download','Not now','Downloading language models…','Download failed. Check your connection and try again.'],
 fr:['Préparer la traduction','Téléchargez les modèles nécessaires. Vos réponses seront ensuite traduites sur cet appareil, sans envoi à un serveur de traduction.','Wi-Fi recommandé. Environ 30 Mo par langue.','Autoriser les données mobiles','Télécharger','Plus tard','Téléchargement des modèles…','Échec du téléchargement. Vérifiez votre connexion puis réessayez.'],
 ru:['Подготовка перевода','Загрузите языковые модели. Затем перевод выполняется на устройстве; ответы не отправляются на сервер перевода.','Рекомендуется Wi-Fi. Около 30 МБ на язык.','Разрешить мобильный интернет','Скачать','Позже','Загрузка языковых моделей…','Не удалось скачать. Проверьте подключение и повторите.'],
 ar:['إعداد الترجمة','نزّل نماذج اللغات المطلوبة. بعد ذلك تتم الترجمة على هذا الجهاز دون إرسال إجاباتك إلى خادم ترجمة.','يُنصح باتصال Wi-Fi. نحو 30 ميغابايت لكل لغة.','السماح ببيانات الهاتف','تنزيل','لاحقًا','جارٍ تنزيل نماذج اللغات…','تعذّر التنزيل. تحقّق من الاتصال وحاول مجددًا.'],
 fa:['آماده‌سازی ترجمه','مدل‌های زبان موردنیاز را دریافت کنید. سپس ترجمه روی همین دستگاه انجام می‌شود و پاسخ‌ها به سرور ترجمه ارسال نمی‌شوند.','Wi-Fi پیشنهاد می‌شود. حدود ۳۰ مگابایت برای هر زبان.','اجازه استفاده از اینترنت همراه','دریافت','بعداً','در حال دریافت مدل‌های زبان…','دریافت انجام نشد. اتصال را بررسی و دوباره تلاش کنید.'],
};
export function TranslationSetup() {
 const request = useSyncExternalStore(translationSetup.subscribe, translationSetup.snapshot);
 const [cellular, setCellular] = useState(false);
 const panel = useRef<HTMLDivElement>(null);
 const language = document.documentElement.lang.split('-')[0] || 'en';
 const c = copies[language] ?? copies.en;
 useEffect(() => { if (!request) return; setCellular(false); const before=document.activeElement as HTMLElement|null; panel.current?.focus(); return () => before?.focus({preventScroll:true}); }, [!!request]);
 useEffect(() => { if (!request) return; const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;}; }, [!!request]);
 if (!request) return null;
 const name=(code:string)=>{try{return new Intl.DisplayNames([language],{type:'language'}).of(code);}catch{return code;}};
 return createPortal(<div className="translation-setup-shade" dir={['ar','fa'].includes(language)?'rtl':'ltr'}>
  <div className="translation-setup" role="dialog" aria-modal="true" aria-labelledby="translation-setup-title" tabIndex={-1} ref={panel} onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();translationSetup.cancel();}
   if(e.key==='Tab'){const buttons=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!buttons?.length){e.preventDefault();return;}const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus();}}
  }}>
   <h2 id="translation-setup-title">{c[0]}</h2><p className="translation-setup-pair">{name(request.sourceLanguage)} → {name(request.targetLanguage)}</p>
   <p>{c[1]}</p><p className="translation-setup-note">{c[2]}</p>
   {request.downloading?<p role="status" className="translation-setup-progress">{c[6]}</p>:<>
    <label><input type="checkbox" checked={cellular} onChange={e=>setCellular(e.target.checked)}/>{c[3]}</label>
    {request.error&&<p role="alert">{c[7]}</p>}
    <button className="translation-setup-download" onClick={()=>void translationSetup.download(cellular)}>{c[4]}</button>
   </>}
   <button className="translation-setup-cancel" onClick={()=>translationSetup.cancel()}>{c[5]}</button>
  </div>
 </div>, document.body);
}
