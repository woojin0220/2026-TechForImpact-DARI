const copies:Record<string,string[]>={
 ko:['지금의 위치부터,\n다음 준비까지.','복잡한 신청 절차와 일정을\n한곳에서 차근차근 확인하세요.','바로 시작하기'],
 en:['Your next step,\nall in one place.','Follow your application process\nand prepare for what comes next.','Get started'],
 fr:['Votre étape actuelle,\net la suivante.','Retrouvez vos démarches et rendez-vous\npour préparer la suite.','Commencer'],
 ru:['От текущего этапа\nк следующему шагу.','Следите за процедурой и встречами\nи готовьтесь к следующему шагу.','Начать'],
 ar:['من مرحلتك الحالية،\nإلى خطوتك التالية.','تابع إجراءات طلبك ومواعيدك\nواستعد للخطوة التالية في مكان واحد.','ابدأ الآن'],
 fa:['از مرحله کنونی،\nتا آمادگی گام بعد.','روند درخواست و قرارها را\nگام‌به‌گام در یک‌جا دنبال کنید.','شروع کنید']
};
export const schedulerWelcomeCopy=(language:string)=>copies[language]??copies.en;
export const schedulerGuideLabel=(language:string)=>({ko:'사용 안내',en:'Quick tour',fr:'Visite guidée',ru:'Обзор',ar:'دليل الاستخدام',fa:'راهنمای استفاده'}[language]??'Quick tour');
