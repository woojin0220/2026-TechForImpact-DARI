export type GuidedStatus = 'unanswered' | 'answered' | 'uncertain' | 'skipped';
export type GuidedAnswer = { status: GuidedStatus; text: string };
export type GuidedAnswers = Record<string, GuidedAnswer>;

type Copy = Record<string, string>;
export type GuidedPrompt = { id: string; question: Copy; label: Copy };

export const guidedPastHarmPrompts: GuidedPrompt[] = [
  { id: 'event', question: { ko: '무슨 일이 있었나요?', ru: 'Что произошло?', ar: 'ماذا حدث؟', fr: 'Que s’est-il passé ?', fa: 'چه اتفاقی افتاد؟' }, label: { ko: '일어난 일', ru: 'Событие', ar: 'ما حدث', fr: 'Événement', fa: 'رویداد' } },
  { id: 'actor', question: { ko: '누가 그 일을 했나요? 모른다면 모른다고 적어도 됩니다.', ru: 'Кто это сделал? Если вы не знаете, так и укажите.', ar: 'من قام بذلك؟ إذا كنت لا تعرف، يمكنك ذكر ذلك.', fr: 'Qui a fait cela ? Si vous ne le savez pas, indiquez-le.', fa: 'چه کسی این کار را انجام داد؟ اگر نمی‌دانید، همان را بنویسید.' }, label: { ko: '행위자', ru: 'Кто', ar: 'الشخص أو الجهة', fr: 'Personne ou groupe', fa: 'شخص یا گروه' } },
  { id: 'time', question: { ko: '언제 일어났나요? 정확한 날짜가 기억나지 않으면 대략적인 시기를 적어도 됩니다.', ru: 'Когда это произошло? Можно указать приблизительное время.', ar: 'متى حدث ذلك؟ يمكنك ذكر وقت تقريبي.', fr: 'Quand cela s’est-il passé ? Une date approximative convient.', fa: 'چه زمانی اتفاق افتاد؟ می‌توانید زمان تقریبی را بنویسید.' }, label: { ko: '시점', ru: 'Время', ar: 'الوقت', fr: 'Date ou période', fa: 'زمان' } },
  { id: 'place', question: { ko: '어디에서 일어났나요?', ru: 'Где это произошло?', ar: 'أين حدث ذلك؟', fr: 'Où cela s’est-il passé ?', fa: 'کجا اتفاق افتاد؟' }, label: { ko: '장소', ru: 'Место', ar: 'المكان', fr: 'Lieu', fa: 'مکان' } },
  { id: 'reason', question: { ko: '왜 그 일이 일어났다고 생각하나요? 이유를 모른다면 그렇게 적어도 됩니다.', ru: 'Почему, по вашему мнению, это произошло? Укажите, если причина неизвестна.', ar: 'لماذا تعتقد أن ذلك حدث؟ اذكر إذا كنت لا تعرف السبب.', fr: 'Pourquoi pensez-vous que cela s’est produit ? Indiquez si vous ignorez la raison.', fa: 'به نظر شما چرا این اتفاق افتاد؟ اگر دلیل را نمی‌دانید، ذکر کنید.' }, label: { ko: '생각하는 이유', ru: 'Предполагаемая причина', ar: 'السبب بحسب رأيك', fr: 'Raison selon vous', fa: 'دلیل از نظر شما' } },
  { id: 'release', question: { ko: '구금되었다면 어떻게 풀려났나요? 해당하지 않으면 건너뛰어도 됩니다.', ru: 'Если вас задерживали, как и почему вас отпустили?', ar: 'إذا احتُجزت، كيف ولماذا أُطلق سراحك؟', fr: 'Si vous avez été détenu, comment et pourquoi avez-vous été libéré ?', fa: 'اگر بازداشت شدید، چگونه و چرا آزاد شدید؟' }, label: { ko: '풀려난 경위(구금된 경우)', ru: 'Освобождение (если было задержание)', ar: 'الإفراج (إن حدث احتجاز)', fr: 'Libération (si détention)', fa: 'آزادی (در صورت بازداشت)' } },
  { id: 'extra', question: { ko: '자신의 말로 더 적고 싶은 내용이 있나요?', ru: 'Хотите добавить что-то своими словами?', ar: 'هل تريد إضافة شيء بكلماتك الخاصة؟', fr: 'Souhaitez-vous ajouter quelque chose avec vos propres mots ?', fa: 'آیا می‌خواهید چیزی را با بیان خودتان اضافه کنید؟' }, label: { ko: '추가 내용', ru: 'Дополнение', ar: 'إضافة', fr: 'Complément', fa: 'توضیح بیشتر' } },
];

export const guidedCopy: Record<string, Copy> = {
  intro: { ko: '기억나는 내용을 자신의 말로 적어 주세요. 추측하지 않아도 됩니다. 불확실하거나 답하기 어려운 질문은 표시하거나 건너뛸 수 있습니다.', ru: 'Ответьте своими словами. Не угадывайте: можно указать, что вы не уверены, или пропустить вопрос.', ar: 'أجب بكلماتك الخاصة. لا تخمّن: يمكنك الإشارة إلى عدم التأكد أو تخطي السؤال.', fr: 'Répondez avec vos propres mots. N’inventez pas : vous pouvez indiquer une incertitude ou passer une question.', fa: 'با کلمات خودتان پاسخ دهید. حدس نزنید: می‌توانید عدم اطمینان را ذکر کنید یا پرسش را رد کنید.' },
  answered: { ko: '알고 있음', ru: 'Я знаю', ar: 'أعرف', fr: 'Je sais', fa: 'می‌دانم' },
  uncertain: { ko: '불확실함', ru: 'Не уверен(а)', ar: 'لست متأكدًا', fr: 'Je ne suis pas sûr(e)', fa: 'مطمئن نیستم' },
  skipped: { ko: '건너뛰기', ru: 'Пропустить', ar: 'تخطي', fr: 'Passer', fa: 'رد کردن' },
  placeholder: { ko: '직접 기억하는 내용만 적어 주세요', ru: 'Напишите только то, что вам известно', ar: 'اكتب فقط ما تعرفه', fr: 'Écrivez seulement ce que vous savez', fa: 'فقط آنچه را می‌دانید بنویسید' },
  missing: { ko: '입력된 내용이 없습니다', ru: 'Ответ не указан', ar: 'لم تُقدَّم إجابة', fr: 'Aucune réponse indiquée', fa: 'پاسخی وارد نشده است' },
  changeChoice: { ko: '예·아니요 답변 바꾸기', ru: 'Изменить ответ «да/нет»', ar: 'تغيير الإجابة بنعم أو لا', fr: 'Modifier la réponse oui/non', fa: 'تغییر پاسخ بله یا خیر' },
  previous: { ko: '이전 질문', ru: 'Предыдущий вопрос', ar: 'السؤال السابق', fr: 'Question précédente', fa: 'پرسش قبلی' },
  nextQuestion: { ko: '답변 보내고 다음 질문', ru: 'Отправить ответ и продолжить', ar: 'إرسال الإجابة والسؤال التالي', fr: 'Envoyer et continuer', fa: 'ارسال پاسخ و پرسش بعدی' },
  reviewFacts: { ko: '답변 보내고 사실 카드 확인', ru: 'Отправить и проверить факты', ar: 'إرسال ومراجعة بطاقات الوقائع', fr: 'Envoyer et vérifier les faits', fa: 'ارسال و بررسی کارت‌های واقعیت' },
  reviewTitle: { ko: '작성한 내용을 확인해 주세요', ru: 'Проверьте ваши ответы', ar: 'راجع إجاباتك', fr: 'Vérifiez vos réponses', fa: 'پاسخ‌های خود را بررسی کنید' },
  reviewIntro: { ko: '아래 카드는 직접 입력한 답변을 분류한 것입니다. 앱이 새로운 사실을 추가하지 않았습니다. 내용이 다르면 확인 전에 고쳐 주세요.', ru: 'Карточки ниже содержат только ваши ответы. Приложение не добавило новых фактов. Исправьте неточности перед подтверждением.', ar: 'تحتوي البطاقات أدناه على إجاباتك فقط. لم يضف التطبيق حقائق جديدة. صحح أي خطأ قبل التأكيد.', fr: 'Les fiches ci-dessous reprennent uniquement vos réponses. L’application n’a ajouté aucun fait. Corrigez toute erreur avant de confirmer.', fa: 'کارت‌های زیر فقط پاسخ‌های شما را نشان می‌دهند. برنامه واقعیت جدیدی اضافه نکرده است. پیش از تأیید، اشتباه‌ها را اصلاح کنید.' },
  draftTitle: { ko: '한국어 초안', ru: 'Черновик на вашем языке', ar: 'مسودة بلغتك', fr: 'Brouillon dans votre langue', fa: 'پیش‌نویس به زبان شما' },
  reviewNotice: { ko: '확인한 초안은 공식 14.2의 상세 답변에 들어갑니다. 건너뛴 항목은 자동으로 채우지 않습니다.', ru: 'После подтверждения этот черновик войдёт в подробный ответ на вопрос 14.2. Пропущенные пункты не заполняются автоматически.', ar: 'بعد التأكيد، ستُستخدم هذه المسودة في الإجابة التفصيلية عن السؤال 14.2. لن تُملأ البنود المتخطاة تلقائيًا.', fr: 'Après confirmation, ce brouillon sera utilisé pour la réponse détaillée à la question 14.2. Les points passés ne seront pas remplis automatiquement.', fa: 'پس از تأیید، این پیش‌نویس در پاسخ تفصیلی به پرسش ۱۴.۲ استفاده می‌شود. موارد ردشده به‌طور خودکار پر نمی‌شوند.' },
  back: { ko: '질문으로 돌아가기', ru: 'Вернуться к вопросам', ar: 'العودة إلى الأسئلة', fr: 'Retour aux questions', fa: 'بازگشت به پرسش‌ها' },
  confirm: { ko: '내용 확인', ru: 'Подтвердить ответы', ar: 'تأكيد الإجابات', fr: 'Confirmer les réponses', fa: 'تأیید پاسخ‌ها' },
};

export function guidedText(copy: Copy, language: string): string {
  return copy[language] ?? copy.ru;
}

export function guidedSourceDraft(answers: GuidedAnswers, language: string): string {
  return guidedPastHarmPrompts.flatMap((prompt) => {
    const answer = answers[prompt.id];
    if (!answer?.text.trim() || (answer.status !== 'answered' && answer.status !== 'uncertain')) return [];
    const uncertainty = answer.status === 'uncertain' ? ` (${guidedText(guidedCopy.uncertain, language)})` : '';
    return [`${guidedText(prompt.label, language)}${uncertainty}: ${answer.text.trim()}`];
  }).join('\n');
}
