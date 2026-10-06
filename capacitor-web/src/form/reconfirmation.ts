import type { DistortionItem } from '../types';

export type ReconfirmationDecision = 'matches' | 'needs_edit' | 'unknown';
export type ReconfirmationView = {
  englishMeaning: string | null;
  explanation: string | null;
};

type Copy = Record<string, string>;

export const reconfirmationCopy: Record<string, Copy> = {
  title: { ko: '번역 차이를 하나씩 확인해 주세요', ru: 'Проверьте различия в переводе по одному', ar: 'راجع فروق الترجمة واحدًا تلو الآخر', fr: 'Vérifiez les différences de traduction une par une', fa: 'تفاوت‌های ترجمه را یکی‌یکی بررسی کنید' },
  intro: { ko: '자동 검출한 차이입니다. 진술이 사실인지 또는 신청 결과가 어떨지는 판단하지 않습니다.', ru: 'Это различие найдено автоматически. Здесь не оценивают достоверность ваших слов или исход заявления.', ar: 'هذا فرق رُصد آليًا. لا يُقيّم هذا صحة أقوالك أو نتيجة طلبك.', fr: 'Cette différence a été détectée automatiquement. Cela ne juge ni la véracité de vos propos ni l’issue de la demande.', fa: 'این تفاوت به‌طور خودکار پیدا شده است. درستی گفته‌های شما یا نتیجه درخواست ارزیابی نمی‌شود.' },
  demoIntro: { ko: '가상 사례로 재확인 화면을 시험하고 있습니다. 실제 신청서나 검증 결과가 아닙니다.' },
  source: { ko: '작성한 원문', ru: 'Ваш исходный текст', ar: 'نصك الأصلي', fr: 'Votre texte d’origine', fa: 'متن اصلی شما' },
  english: { ko: '영어 번역문', ru: 'Перевод на английский', ar: 'الترجمة الإنجليزية', fr: 'Traduction anglaise', fa: 'ترجمه انگلیسی' },
  meaning: { ko: '영어 문장의 참고 번역', ru: 'Приблизительный перевод английской фразы', ar: 'ترجمة مرجعية للجملة الإنجليزية', fr: 'Traduction indicative de la phrase anglaise', fa: 'ترجمه کمکی جمله انگلیسی' },
  explanation: { ko: '자동 검출한 차이', ru: 'Различие, найденное автоматически', ar: 'الفرق المرصود آليًا', fr: 'Différence détectée automatiquement', fa: 'تفاوت شناسایی‌شده به‌طور خودکار' },
  caution: { ko: '참고 번역 자체에도 오류가 있을 수 있습니다. 원문과 영어 문장을 확인할 수 없다면 ‘모름’을 선택해 주세요.', ru: 'Приблизительный перевод тоже может содержать ошибки. Если вы не можете проверить смысл, выберите «Не знаю».', ar: 'قد تحتوي الترجمة المرجعية على أخطاء. إذا لم تتمكن من التحقق من المعنى، اختر «لا أعرف».', fr: 'La traduction indicative peut aussi comporter des erreurs. Si vous ne pouvez pas vérifier le sens, choisissez «Je ne sais pas».', fa: 'ترجمه کمکی نیز ممکن است خطا داشته باشد. اگر نمی‌توانید معنا را بررسی کنید، «نمی‌دانم» را انتخاب کنید.' },
  question: { ko: '원문과 영어 번역문이 같은 뜻인가요?', ru: 'Совпадает ли смысл исходного текста и английского перевода?', ar: 'هل يحمل النص الأصلي والترجمة الإنجليزية المعنى نفسه؟', fr: 'Votre texte et la traduction anglaise ont-ils le même sens ?', fa: 'آیا متن اصلی و ترجمه انگلیسی معنای یکسانی دارند؟' },
  matches: { ko: '같은 뜻이에요', ru: 'Смысл совпадает', ar: 'المعنى متطابق', fr: 'Le sens est le même', fa: 'معنا یکسان است' },
  needs_edit: { ko: '수정이 필요해요', ru: 'Нужно исправить', ar: 'يحتاج إلى تصحيح', fr: 'Une correction est nécessaire', fa: 'نیاز به اصلاح دارد' },
  unknown: { ko: '잘 모르겠어요', ru: 'Не знаю', ar: 'لا أعرف', fr: 'Je ne sais pas', fa: 'نمی‌دانم' },
  previous: { ko: '이전 차이', ru: 'Предыдущее различие', ar: 'الفرق السابق', fr: 'Différence précédente', fa: 'تفاوت قبلی' },
  next: { ko: '다음 차이', ru: 'Следующее различие', ar: 'الفرق التالي', fr: 'Différence suivante', fa: 'تفاوت بعدی' },
  finish: { ko: '확인 마치기', ru: 'Завершить проверку', ar: 'إنهاء المراجعة', fr: 'Terminer la vérification', fa: 'پایان بررسی' },
  editSource: { ko: '원문 수정하기', ru: 'Изменить исходный текст', ar: 'تعديل النص الأصلي', fr: 'Modifier le texte d’origine', fa: 'ویرایش متن اصلی' },
  editNotice: { ko: '원문을 수정한 뒤에는 다시 번역하고 검증해야 합니다. 영어 문장을 자동으로 고치지는 않습니다.', ru: 'После изменения исходного текста нужно снова выполнить перевод и проверку. Английский текст не исправляется автоматически.', ar: 'بعد تعديل النص الأصلي يجب إعادة الترجمة والتحقق. لن يُصحَّح النص الإنجليزي تلقائيًا.', fr: 'Après modification du texte d’origine, il faut traduire et vérifier à nouveau. La phrase anglaise n’est pas corrigée automatiquement.', fa: 'پس از ویرایش متن اصلی باید دوباره ترجمه و بررسی شود. جمله انگلیسی خودکار اصلاح نمی‌شود.' },
  unavailable: { ko: '모국어 참고 설명을 만들지 못했습니다. 이 항목을 ‘같은 뜻’으로 확인할 수 없습니다.', ru: 'Не удалось подготовить пояснение на вашем языке. Нельзя подтвердить, что смысл совпадает.', ar: 'تعذّر إعداد الشرح بلغتك. لا يمكن تأكيد تطابق المعنى.', fr: 'L’explication dans votre langue n’a pas pu être préparée. Vous ne pouvez pas confirmer que le sens est identique.', fa: 'توضیح به زبان شما آماده نشد. نمی‌توان یکسان بودن معنا را تأیید کرد.' },
  noExcerpt: { ko: '발췌문이 없습니다', ru: 'Отрывок отсутствует', ar: 'لا يوجد مقتطف', fr: 'Aucun extrait', fa: 'بخشی از متن موجود نیست' },
  resultTitle: { ko: '재확인 결과', ru: 'Результат повторной проверки', ar: 'نتيجة إعادة التأكيد', fr: 'Résultat de la confirmation', fa: 'نتیجه تأیید دوباره' },
};

export function reconfirmationText(key: string, language: string): string {
  const copy = reconfirmationCopy[key];
  return copy?.[language] ?? copy?.ko ?? key;
}

type Translator = (
  model: string,
  sourceLanguage: string,
  targetLanguage: string,
  items: { id: string; text: string }[],
  onItem: (id: string) => void,
) => Promise<Record<string, string>>;

/** Translate only the verification model's excerpts and explanation; never infer a new fact. */
export async function prepareReconfirmation(
  items: DistortionItem[],
  targetLanguage: string,
  model: string,
  translator: Translator,
): Promise<ReconfirmationView[]> {
  const excerpts = items.flatMap((item, index) => item.translationExcerpt.trim()
    ? [{ id: String(index), text: item.translationExcerpt.trim() }] : []);
  const explanations = items.flatMap((item, index) => item.explanation.trim()
    ? [{ id: String(index), text: item.explanation.trim() }] : []);

  const meaningResult = await translator(model, 'en', targetLanguage, excerpts, () => {}).catch(() => ({} as Record<string, string>));
  const explanationResult = targetLanguage === 'ko'
    ? Object.fromEntries(explanations.map((item) => [item.id, item.text]))
    : await translator(model, 'ko', targetLanguage, explanations, () => {}).catch(() => ({} as Record<string, string>));

  return items.map((item, index) => ({
    englishMeaning: meaningResult[String(index)] ?? null,
    explanation: explanationResult[String(index)] ?? (targetLanguage === 'ko' ? item.explanation || null : null),
  }));
}
