import type { ProcessingTask, TimeEstimate } from './processingTime';

const translations = {
  ko: { intake: '답변을 정리하고 있어요', followup: '추가 질문을 준비하고 있어요', draft: '한국어 초안을 만들고 있어요', example: '가상 예시를 만들고 있어요', initial: '초기 예상', learned: '최근 처리 기준', elapsed: '경과', longer: '예상보다 오래 걸리고 있어요', background: '다른 단계를 확인하는 동안에도 계속 진행돼요', stop: '중지' },
  en: { intake: 'Organizing your answer', followup: 'Preparing a follow-up question', draft: 'Preparing your Korean draft', example: 'Generating a fictional example', initial: 'Initial estimate', learned: 'Based on recent requests', elapsed: 'Elapsed', longer: 'Taking longer than estimated', background: 'You can review other steps while this continues', stop: 'Stop' },
  fr: { intake: 'Organisation de votre réponse', followup: 'Préparation de la prochaine question', draft: 'Préparation du brouillon coréen', example: 'Création d’un exemple fictif', initial: 'Estimation initiale', learned: 'Selon les demandes récentes', elapsed: 'Écoulé', longer: 'Plus long que prévu', background: 'Vous pouvez consulter les autres étapes', stop: 'Arrêter' },
  ru: { intake: 'Обработка ответа', followup: 'Подготовка следующего вопроса', draft: 'Подготовка корейского черновика', example: 'Создание вымышленного примера', initial: 'Начальная оценка', learned: 'По недавним запросам', elapsed: 'Прошло', longer: 'Дольше ожидаемого', background: 'Можно просматривать другие шаги', stop: 'Остановить' },
  ar: { intake: 'جارٍ تنظيم إجابتك', followup: 'جارٍ إعداد سؤال متابعة', draft: 'جارٍ إعداد المسودة الكورية', example: 'جارٍ إنشاء مثال خيالي', initial: 'تقدير أولي', learned: 'وفق الطلبات الأخيرة', elapsed: 'الوقت المنقضي', longer: 'يستغرق وقتًا أطول من المتوقع', background: 'يمكنك مراجعة الخطوات الأخرى أثناء الانتظار', stop: 'إيقاف' },
  fa: { intake: 'در حال تنظیم پاسخ شما', followup: 'در حال آماده‌سازی پرسش بعدی', draft: 'در حال آماده‌سازی پیش‌نویس کره‌ای', example: 'در حال ساخت نمونه خیالی', initial: 'برآورد اولیه', learned: 'بر اساس درخواست‌های اخیر', elapsed: 'زمان سپری‌شده', longer: 'بیشتر از زمان برآوردشده طول کشیده است', background: 'می‌توانید مراحل دیگر را بررسی کنید', stop: 'توقف' },
};

export function ProcessingStatus({ task, language, elapsed, estimate, onStop, showStop = true }: {
  task: ProcessingTask; language: string; elapsed: number; estimate: TimeEstimate; onStop: () => void; showStop?: boolean;
}) {
  const copy = translations[language as keyof typeof translations] ?? translations.en;
  const minutes = estimate.minimum >= 60;
  const formatter = new Intl.NumberFormat(language, { style: 'unit', unit: minutes ? 'minute' : 'second', unitDisplay: 'short', maximumFractionDigits: 0 });
  const duration = (seconds: number) => formatter.format(minutes ? Math.ceil(seconds / 60) : seconds);
  return <section className="processing-status" aria-label={copy[task]}>
    <div className="processing-heading" role="status"><span className="spinner" aria-hidden="true" /><strong>{copy[task]}</strong>{showStop && <button type="button" className="quiet" onClick={onStop}>{copy.stop}</button>}</div>
    <div className="processing-timing"><span>{estimate.learned ? copy.learned : copy.initial} · {duration(estimate.minimum)}–{duration(estimate.maximum)}</span><span aria-live="off">{copy.elapsed} <bdi>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</bdi></span></div>
    <p role="status">{elapsed > estimate.maximum ? copy.longer : copy.background}</p>
  </section>;
}
