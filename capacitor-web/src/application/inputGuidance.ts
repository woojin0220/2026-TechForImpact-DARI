import { localizedLabel } from '../form/localize.ts';
import type { Question } from './model.ts';

const copy={
 ko:{choose:'선택해 주세요',clear:'선택 해제',write:'질문에 해당하는 내용을 직접 작성해 주세요.',uncertain:'기억나지 않거나 확실하지 않은 내용은 그대로 적어 주세요.',date:'연/월/일 (예: 2020/03/15)',when:'일이 있었던 시점',where:'일이 있었던 장소',who:'관련된 사람과 알고 있는 신원',what:'겪은 일과 당시 상황',why:'그 일이 일어났다고 생각하는 이유',release:'해당하는 경우, 풀려난 경위',ifYes:'예인 경우, 해당하는 내용만 작성',hint:'작성 안내'},
 en:{choose:'Choose an option',clear:'Clear selection',write:'Write your own answer to this question.',uncertain:'Keep anything you do not remember or are uncertain about explicit.',date:'Year/month/day (e.g. 2020/03/15)',when:'When it happened',where:'Where it happened',who:'People involved and what you know about their identity',what:'What happened and the circumstances',why:'Why you believe it happened',release:'If applicable, how you were released',ifYes:'If yes, describe only what applies',hint:'Writing guidance'},
 fr:{choose:'Choisir une option',clear:'Effacer le choix',write:'Rédigez votre propre réponse à cette question.',uncertain:'Indiquez ce dont vous ne vous souvenez pas ou ce qui est incertain.',date:'Année/mois/jour (ex. 2020/03/15)',when:'Quand cela s’est passé',where:'Lieu des faits',who:'Personnes concernées et identité connue',what:'Faits et circonstances',why:'Pourquoi vous pensez que cela s’est produit',release:'Si applicable, circonstances de votre libération',ifYes:'Si oui, décrivez uniquement ce qui vous concerne',hint:'Aide à la rédaction'},
 ru:{choose:'Выберите вариант',clear:'Сбросить выбор',write:'Напишите свой ответ на этот вопрос.',uncertain:'Укажите, чего вы не помните или в чём не уверены.',date:'Год/месяц/день (например, 2020/03/15)',when:'Когда это произошло',where:'Где это произошло',who:'Участники и что известно об их личности',what:'Что произошло и при каких обстоятельствах',why:'Почему вы считаете, что это произошло',release:'Если применимо, обстоятельства освобождения',ifYes:'Если да, опишите только относящееся к вам',hint:'Подсказка для ответа'},
 ar:{choose:'اختر إجابة',clear:'إلغاء الاختيار',write:'اكتب إجابتك الشخصية عن هذا السؤال.',uncertain:'اذكر بوضوح ما لا تتذكره أو ما لست متأكداً منه.',date:'سنة/شهر/يوم (مثال: 2020/03/15)',when:'متى حدث ذلك',where:'أين حدث ذلك',who:'الأشخاص المعنيون وما تعرفه عن هويتهم',what:'ما حدث والظروف المحيطة',why:'لماذا تعتقد أن ذلك حدث',release:'إن انطبق، كيف تم إطلاق سراحك',ifYes:'إذا كانت الإجابة نعم، صف ما ينطبق فقط',hint:'إرشادات الكتابة'},
 fa:{choose:'یک گزینه انتخاب کنید',clear:'پاک کردن انتخاب',write:'پاسخ خود را به این سؤال بنویسید.',uncertain:'مواردی را که به یاد ندارید یا از آن‌ها مطمئن نیستید مشخص کنید.',date:'سال/ماه/روز (مثلاً 2020/03/15)',when:'زمان وقوع',where:'محل وقوع',who:'افراد مرتبط و آنچه درباره هویت آن‌ها می‌دانید',what:'اتفاق و شرایط آن',why:'دلیل برداشت شما از علت آن',release:'در صورت ارتباط، چگونگی آزادی',ifYes:'اگر بله، فقط موارد مرتبط را شرح دهید',hint:'راهنمای نوشتن'},
};
export const inputCopy=(language:string)=>copy[language as keyof typeof copy]??copy.en;
export const translationAction=(language:string)=>({ko:'번역하기',en:'Translate',fr:'Traduire',ru:'Перевести',ar:'ترجمة',fa:'ترجمه'}[language]??'Translate');
export const translationPlaceholder=(language:string)=>({
 ko:'번역 버튼을 누르면 여기에 결과가 표시돼요.',
 en:'Press the translate button to see the result here.',
 fr:'Appuyez sur Traduire pour afficher le résultat ici.',
 ru:'Нажмите кнопку перевода, чтобы увидеть результат здесь.',
 ar:'اضغط على زر الترجمة لعرض النتيجة هنا.',
 fa:'برای نمایش نتیجه در اینجا، دکمه ترجمه را بزنید.',
}[language]??'Press the translate button to see the result here.');

/** Instructions are display-only. They never become an answer or a model prompt. */
export function questionGuide(q:Question,language:string):string {
 const c=inputCopy(language),label=(ko:string,en:string)=>localizedLabel(language,ko,en);
 if(q.fields.length===1&&q.fields[0].type==='date')return c.date;
 const choices=q.fields[0].options?.map(o=>label(o.ko,o.en)).join(' / ');
 const details=q.id==='14.2'?[c.ifYes,c.when,c.where,c.who,c.what,c.why,c.release,c.uncertain]:q.fields.slice(1).flatMap(f=>f.columns?.map(col=>label(col.ko,col.en))??[label(f.ko,f.en)]);
 const lines=[...(choices?[choices]:[]),...details];
 if(!lines.length)lines.push(...(q.fields[0].columns?.map(col=>label(col.ko,col.en))??[c.write]));
 if(q.fields.some(f=>f.type==='long')&&q.id!=='14.2')lines.push(c.uncertain);
 return [...new Set(lines)].map(text=>`• ${text}`).join('\n');
}
