import type { CoverageStatus } from './intake/types';

export const statusWords: Record<string, Record<CoverageStatus, string>> = {
  ko: { answered: '답변 있음', unknown: '기억·정보 불확실', skipped: '답변 보류', not_applicable: '해당 없음', conflict: '다시 확인 필요', missing: '아직 묻지 않음', blocked: '이전 답변에 따라 확인' },
  en: { answered: 'Answered', unknown: 'Unknown', skipped: 'Deferred', not_applicable: 'Not applicable', conflict: 'Needs clarification', missing: 'Not asked yet', blocked: 'Depends on another answer' },
  ru: { answered: 'Есть ответ', unknown: 'Неизвестно', skipped: 'Отложено', not_applicable: 'Не применимо', conflict: 'Нужно уточнить', missing: 'Ещё не спрашивали', blocked: 'Зависит от другого ответа' },
  fr: { answered: 'Répondu', unknown: 'Inconnu', skipped: 'Reporté', not_applicable: 'Sans objet', conflict: 'À clarifier', missing: 'Pas encore demandé', blocked: 'Selon une autre réponse' },
  ar: { answered: 'تمت الإجابة', unknown: 'غير معروف', skipped: 'مؤجل', not_applicable: 'لا ينطبق', conflict: 'يحتاج توضيحًا', missing: 'لم يُسأل بعد', blocked: 'يعتمد على إجابة أخرى' },
  fa: { answered: 'پاسخ داده‌شده', unknown: 'نامعلوم', skipped: 'به تعویق افتاده', not_applicable: 'نامربوط', conflict: 'نیاز به روشن‌سازی', missing: 'هنوز پرسیده نشده', blocked: 'وابسته به پاسخ دیگر' },
};
