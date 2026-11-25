const ko = {
 title: '신청서 작성', intro: '필요한 문항부터 작성하고, 한국어 또는 영어로 번역하세요.',
 download: '신청서 다운로드', back: '뒤로가기', source: '내 답변', result: '한국어 번역', translate: '한국어로 번역', translating: '번역 중…',
 empty: '미작성', written: '작성 중', done: '번역 완료', count: '작성한 문항', saved: '입력한 답변은 이 기기의 현재 세션에 저장됩니다.',
 note: '다운로드에는 작성한 문항만 포함됩니다. 번역하지 않은 답변은 원문으로 표시됩니다.',
 review: '번역을 확인하고 필요한 부분을 수정하세요.', stale: '답변이 변경되었습니다. 다시 번역해 주세요.',
 error: '번역하지 못했습니다. 답변은 유지됩니다. 로컬 모델 연결을 확인하고 다시 시도하세요.',
 storage: '답변을 저장하지 못했습니다. 페이지를 닫기 전에 워드 파일을 다운로드하세요.',
 native: '기기 내 모델로 번역', web: '브라우저 테스트 · Mac 로컬 모델로 번역', import: '모델 파일 가져오기', language: '답변 언어',
};
const en: typeof ko = {
 title: 'Application', intro: 'Start with the questions you need. Translate your answers into Korean or English.',
 download: 'Download application', back: 'Back', source: 'Your answer', result: 'Korean translation', translate: 'Translate into Korean', translating: 'Translating…',
 empty: 'Not started', written: 'In progress', done: 'Translated', count: 'Questions answered', saved: 'Answers are saved in the current session on this device.',
 note: 'Only answered questions are downloaded. Answers not yet translated are included in their original language.',
 review: 'Check the translation and edit it if needed.', stale: 'Your answer changed. Please translate it again.',
 error: 'Translation failed. Your answer is kept. Check the local model connection and try again.', storage: 'Could not save your answers. Download the Word file before closing this page.',
 native: 'Translation on this device', web: 'Browser preview · translation on your Mac', import: 'Import model file', language: 'Answer language',
};
const fr: typeof ko = {title:'Demande',intro:'Choisissez une question et rédigez votre réponse. Elle sera traduite en coréen.',download:'Télécharger la demande',back:'Retour',source:'Votre réponse',result:'Traduction coréenne',translate:'Traduire en coréen',translating:'Traduction…',empty:'Non renseigné',written:'En cours',done:'Traduit',count:'Questions renseignées',saved:'Les réponses sont enregistrées dans la session actuelle sur cet appareil.',note:'Seules les questions renseignées sont téléchargées. Les réponses non traduites restent dans leur langue originale.',review:'Vérifiez et modifiez la traduction si nécessaire.',stale:'Votre réponse a changé. Traduisez-la de nouveau.',error:'Échec de traduction. Votre réponse est conservée. Vérifiez le modèle local et réessayez.',storage:'Échec de sauvegarde. Téléchargez le fichier Word avant de fermer la page.',native:'Traduction sur cet appareil',web:'Aperçu navigateur · traduction sur votre Mac',import:'Importer le modèle',language:'Langue de réponse'};
const ru: typeof ko = {title:'Заявление',intro:'Выберите вопрос и напишите ответ. Он будет переведён на корейский.',download:'Скачать заявление',back:'Назад',source:'Ваш ответ',result:'Корейский перевод',translate:'Перевести на корейский',translating:'Перевод…',empty:'Не заполнено',written:'В процессе',done:'Переведено',count:'Заполнено вопросов',saved:'Ответы сохраняются в текущем сеансе на этом устройстве.',note:'В файл входят только заполненные вопросы. Непереведённые ответы включаются на исходном языке.',review:'Проверьте и при необходимости исправьте перевод.',stale:'Ответ изменён. Переведите его заново.',error:'Не удалось перевести. Ответ сохранён. Проверьте локальную модель и повторите.',storage:'Не удалось сохранить. Скачайте файл Word до закрытия страницы.',native:'Перевод на устройстве',web:'Просмотр в браузере · перевод на Mac',import:'Импорт модели',language:'Язык ответа'};
const ar: typeof ko = {title:'طلب اللجوء',intro:'اختر سؤالاً واكتب إجابتك. ستُترجم كلماتك إلى الكورية.',download:'تنزيل الطلب',back:'رجوع',source:'إجابتك',result:'الترجمة الكورية',translate:'ترجمة إلى الكورية',translating:'جارٍ الترجمة…',empty:'لم يُكتب',written:'قيد الكتابة',done:'مترجم',count:'الأسئلة المجاب عنها',saved:'تُحفظ الإجابات في الجلسة الحالية على هذا الجهاز.',note:'يتضمن التنزيل الأسئلة المجاب عنها فقط. تُدرج الإجابات غير المترجمة بلغتها الأصلية.',review:'راجع الترجمة وعدّلها عند الحاجة.',stale:'تغيّرت إجابتك. يرجى ترجمتها مجدداً.',error:'تعذرت الترجمة. إجابتك محفوظة. تحقق من النموذج المحلي وحاول مجدداً.',storage:'تعذر الحفظ. نزّل ملف Word قبل إغلاق الصفحة.',native:'ترجمة على هذا الجهاز',web:'معاينة المتصفح · ترجمة على Mac',import:'استيراد النموذج',language:'لغة الإجابة'};
const fa: typeof ko = {title:'درخواست پناهندگی',intro:'یک سؤال انتخاب کنید و پاسخ دهید. متن شما به کره‌ای ترجمه می‌شود.',download:'دانلود درخواست',back:'بازگشت',source:'پاسخ شما',result:'ترجمه کره‌ای',translate:'ترجمه به کره‌ای',translating:'در حال ترجمه…',empty:'نوشته نشده',written:'در حال نوشتن',done:'ترجمه شده',count:'سؤال‌های پاسخ داده شده',saved:'پاسخ‌ها در نشست فعلی روی این دستگاه ذخیره می‌شوند.',note:'فقط سؤال‌های پاسخ داده شده دانلود می‌شوند. پاسخ‌های ترجمه نشده به زبان اصلی درج می‌شوند.',review:'ترجمه را بررسی و در صورت نیاز ویرایش کنید.',stale:'پاسخ تغییر کرده است. دوباره ترجمه کنید.',error:'ترجمه انجام نشد. پاسخ حفظ شده است. مدل محلی را بررسی و دوباره تلاش کنید.',storage:'ذخیره نشد. قبل از بستن صفحه فایل Word را دانلود کنید.',native:'ترجمه روی این دستگاه',web:'پیش‌نمایش مرورگر · ترجمه روی Mac',import:'وارد کردن مدل',language:'زبان پاسخ'};
export const applicationCopy = (language: string) => {
 const base=({ko,en,fr,ru,ar,fa}[language]??en);
 const intro=({fr:'Commencez par les questions utiles. Traduisez vos réponses en coréen ou en anglais.',ru:'Начните с нужных вопросов. Переведите ответы на корейский или английский.',ar:'ابدأ بالأسئلة التي تحتاجها. ترجم إجاباتك إلى الكورية أو الإنجليزية.',fa:'از سؤال‌های مورد نیاز شروع کنید. پاسخ‌ها را به کره‌ای یا انگلیسی ترجمه کنید.'} as Record<string,string>)[language]??base.intro;
 return {...base,intro};
};

export function translationFailure(error: unknown, language: string, fallback: string): string {
 const message = error instanceof Error ? error.message : '';
 if (!message.startsWith('UNTRANSLATED_ANSWER')) return fallback;
 const id = message.split(':')[1];
 const copy = ({
  ko:'번역이 완료되지 않았습니다. 원문을 확인하고 다시 번역해 주세요.',
  en:'Translation is incomplete. Check the original and translate again.',
  ru:'Перевод не завершён. Проверьте исходный текст и повторите перевод.',
  fr:'Traduction incomplète. Vérifiez le texte original et réessayez.',
  ar:'الترجمة غير مكتملة. راجع النص الأصلي وأعد الترجمة.',
  fa:'ترجمه کامل نشده است. متن اصلی را بررسی و دوباره ترجمه کنید.',
 } as Record<string,string>)[language] ?? 'Translation is incomplete. Check the original and translate again.';
 return `${id ? `${id} · ` : ''}${copy}`;
}

export function sectionIntro(language: string) {
 return ({
 ko:'짧은 답변은 아래에서 바로 입력하세요. 긴 답변은 해당 문항을 열어 작성할 수 있습니다.',
 en:'Fill in short answers below. Open a longer question to write and translate your answer.',
 fr:'Saisissez les réponses courtes ci-dessous. Ouvrez une question longue pour rédiger et traduire votre réponse.',
 ru:'Короткие ответы вводите ниже. Для подробного ответа откройте соответствующий вопрос.',
 ar:'أدخل الإجابات القصيرة أدناه. افتح السؤال الذي يتطلب إجابة طويلة للكتابة والترجمة.',
 fa:'پاسخ‌های کوتاه را در زیر وارد کنید. برای نوشتن و ترجمه پاسخ بلند، سؤال مربوط را باز کنید.',
 } as Record<string,string>)[language] ?? 'Fill in short answers below. Open a longer question to write and translate your answer.';
}

export function downloadCopy(language: string) {
 return ({
 ko:{progress:'미번역 답변을 번역하고 있습니다.',error:'번역을 완료하지 못해 다운로드를 중단했습니다. 입력 내용과 완료된 번역은 유지됩니다. 다시 다운로드해 주세요.'},
 en:{progress:'Translating answers before download.',error:'Download stopped because translation failed. Your answers and completed translations are kept. Try downloading again.'},
 fr:{progress:'Traduction des réponses avant téléchargement.',error:'Téléchargement interrompu : échec de traduction. Les réponses et traductions terminées sont conservées. Réessayez.'},
 ru:{progress:'Перевод ответов перед скачиванием.',error:'Скачивание остановлено из-за ошибки перевода. Ответы и готовые переводы сохранены. Повторите скачивание.'},
 ar:{progress:'جارٍ ترجمة الإجابات قبل التنزيل.',error:'توقف التنزيل لتعذر الترجمة. حُفظت إجاباتك والترجمات المكتملة. حاول التنزيل مجدداً.'},
 fa:{progress:'ترجمه پاسخ‌ها پیش از دانلود.',error:'دانلود به دلیل خطای ترجمه متوقف شد. پاسخ‌ها و ترجمه‌های کامل حفظ شده‌اند. دوباره دانلود کنید.'},
 } as Record<string,{progress:string;error:string}>)[language] ?? {progress:'Translating answers before download.',error:'Translation failed. Your answers are kept. Try downloading again.'};
}
