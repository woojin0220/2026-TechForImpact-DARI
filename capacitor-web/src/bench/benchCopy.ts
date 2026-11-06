const en = {
  title: 'Performance benchmark (fictional scenarios)', languages: 'Test languages', extraction: 'Extraction format',
  full: 'Full (app default)', compact: 'Compact', repeat: 'Repetitions', constrained: 'Require JSON schema',
  off: 'Off (app default)', on: 'On', context: 'Context limit', backend: 'Compute backend', previewFormat: 'Output constraints (preview)',
  schema: 'Schema-constrained', json: 'JSON format', none: 'No format constraint',
  count: '{languages} languages × {scenarios} scenarios × {repeats} repetitions = {total} sessions.',
  awake: 'Progress may pause when the screen turns off.', start: 'Run benchmark', stop: 'Stop', copy: 'Copy JSONL',
  copied: 'Benchmark records copied.', copyFailed: 'The records could not be copied. Please try again.',
  runFailed: 'The benchmark could not continue. Check the model connection and retry. Records already collected remain available.',
  running: 'Running session {done} of {total}', completed: 'Completed {done} of {total}', cancelled: 'Stopped after {done} of {total} sessions', failed: 'Stopped on an error after {done} of {total} sessions', saved: 'Saved on this device',
  summary: 'Results by test language', language: 'Language', sessionsFailed: 'Sessions (failed)', quality: 'Quality', safety: 'Safety',
  turnP50: 'Turn p50 (seconds)', turnP90: 'Turn p90 (seconds)', draftP50: 'Draft p50 (seconds)', callsPerTurn: 'Calls per turn',
  jsonFailRate: 'JSON failures', promptTokens: 'Input tokens', decodeRate: 'Output tokens/second', ttftP50: 'Time to first token p50 (seconds)', peakMemory: 'Peak memory (MB)',
  ko: 'Korean', en: 'English', fr: 'French', ru: 'Russian', ar: 'Arabic', fa: 'Persian',
};
export type BenchCopy = { [K in keyof typeof en]: string };
const ko: BenchCopy = {
  title: '성능 벤치마크 (가상 시나리오)', languages: '시험 언어', extraction: '추출 형식',
  full: '전체 형식 (앱 기본)', compact: '간소 형식', repeat: '반복 횟수', constrained: 'JSON 스키마 강제',
  off: '끔 (앱 기본)', on: '켬', context: '문맥 한도', backend: '연산 백엔드', previewFormat: '출력 제약 (미리보기)',
  schema: '스키마 제약', json: 'JSON 형식', none: '형식 제약 없음',
  count: '{languages}개 언어 × 시나리오 {scenarios}개 × {repeats}회 = 세션 {total}개.',
  awake: '화면이 꺼지면 진행이 멈출 수 있습니다.', start: '벤치마크 실행', stop: '중단', copy: 'JSONL 복사',
  copied: '벤치마크 기록을 복사했습니다.', copyFailed: '기록을 복사하지 못했습니다. 다시 시도해 주세요.',
  runFailed: '벤치마크를 계속하지 못했습니다. 모델 연결을 확인하고 다시 시도해 주세요. 이미 수집한 기록은 유지됩니다.',
  running: '세션 진행 중 {done}/{total}', completed: '완료 {done}/{total}', cancelled: '세션 {done}/{total}개 후 중단됨', failed: '오류로 중단됨 {done}/{total}', saved: '이 기기에 저장됨',
  summary: '시험 언어별 결과', language: '언어', sessionsFailed: '세션 (실패)', quality: '품질', safety: '안전',
  turnP50: '턴 p50 (초)', turnP90: '턴 p90 (초)', draftP50: '초안 p50 (초)', callsPerTurn: '턴당 호출',
  jsonFailRate: 'JSON 실패', promptTokens: '입력 토큰', decodeRate: '초당 생성 토큰', ttftP50: '첫 토큰 시간 p50 (초)', peakMemory: '최대 메모리 (MB)',
  ko: '한국어', en: '영어', fr: '프랑스어', ru: '러시아어', ar: '아랍어', fa: '페르시아어',
};
const ar: BenchCopy = {
  title: 'اختبار الأداء بسيناريوهات خيالية', languages: 'لغات الاختبار', extraction: 'صيغة الاستخراج',
  full: 'الصيغة الكاملة (الافتراضية للتطبيق)', compact: 'الصيغة المختصرة', repeat: 'عدد مرات التكرار', constrained: 'فرض مخطط البيانات',
  off: 'إيقاف (الإعداد الافتراضي)', on: 'تشغيل', context: 'حد السياق', backend: 'محرك الحساب', previewFormat: 'قيود المخرجات في المعاينة',
  schema: 'تقييد بالمخطط', json: 'صيغة البيانات المنظمة', none: 'دون قيد على الصيغة',
  count: 'اللغات: {languages} × السيناريوهات: {scenarios} × التكرارات: {repeats} = الجلسات: {total}.',
  awake: 'قد يتوقف التقدم عند إطفاء الشاشة.', start: 'بدء اختبار الأداء', stop: 'إيقاف', copy: 'نسخ سجل الاختبار',
  copied: 'نُسخت سجلات اختبار الأداء.', copyFailed: 'تعذر نسخ السجلات. حاول مرة أخرى.',
  runFailed: 'تعذر متابعة اختبار الأداء. تحقق من اتصال النموذج ثم أعد المحاولة. تبقى السجلات التي جُمعت متاحة.',
  running: 'تقدم الاختبار: {done} من {total}', completed: 'اكتملت {done} من {total}', cancelled: 'توقف الاختبار عند {done} من {total} جلسات', failed: 'توقف الاختبار بسبب خطأ عند {done} من {total} جلسات', saved: 'حُفظ على هذا الجهاز',
  summary: 'النتائج حسب لغة الاختبار', language: 'اللغة', sessionsFailed: 'الجلسات (الفاشلة)', quality: 'الجودة', safety: 'السلامة',
  turnP50: 'وسيط زمن الدور (ثوانٍ)', turnP90: 'المئين التسعون لزمن الدور (ثوانٍ)', draftP50: 'وسيط زمن المسودة (ثوانٍ)', callsPerTurn: 'الاستدعاءات لكل دور',
  jsonFailRate: 'فشل تنسيق البيانات', promptTokens: 'رموز الإدخال', decodeRate: 'رموز الإخراج في الثانية', ttftP50: 'وسيط زمن أول رمز (ثوانٍ)', peakMemory: 'ذروة الذاكرة (ميغابايت)',
  ko: 'الكورية', en: 'الإنجليزية', fr: 'الفرنسية', ru: 'الروسية', ar: 'العربية', fa: 'الفارسية',
};
export const benchCopies = { en, ko, ar } satisfies Record<'en' | 'ko' | 'ar', BenchCopy>;
export function benchCopy(language: string): BenchCopy { return language === 'ar' ? ar : language === 'ko' ? ko : en; }
export function formatBenchCopy(template: string, values: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => key in values ? String(values[key]) : match);
}
