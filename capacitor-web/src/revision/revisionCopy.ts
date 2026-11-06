/** UI copy only. Original statements, Korean drafts and model replies are not translated here. */
const en = {
  compareView: 'Compare with my original words', sentenceView: 'Show the draft only', compareHint: 'Each Korean sentence is shown next to the words you used in the conversation. Compare them and correct anything that does not match what you meant.',
  originalWords: 'Your original words', draftSentence: 'Korean draft sentence', noOriginal: 'No original words are linked to this sentence. Please check it against what you said.',
  confirmedTag: 'Confirmed', unconfirmedTag: 'Not yet confirmed', confirmSentence: 'This sentence matches what I meant', unconfirmSentence: 'Mark as not confirmed',
  confirmedCount: '{n} of {total} sentences confirmed', editDirect: 'Edit this sentence myself', directEditLabel: 'Korean sentence', saveEdit: 'Save my edit', cancelEdit: 'Cancel',
  candidatesHint: 'Suggestions are only wording options. Choose one, edit the sentence yourself, or keep it as it is.',
  notLegal: 'This screen helps you compare wording. It does not give legal advice or decide what is correct for your application.',
  instructions: 'Select a sentence and tell us what you would like to change. Nothing is applied until you approve it. For factual corrections, return to the intake conversation and regenerate the draft.',
  koreanDraft: 'Korean draft', selectSentence: 'Select a sentence', sentenceToEdit: 'Sentence to edit',
  editedHint: 'Underlined sentences have been edited.', selectedSentence: 'Selected sentence',
  viewOriginal: 'View original sentence', discussion: 'Sentence discussion', yourRequest: 'Your request',
  suggestion: 'Suggested Korean text', apply: 'Apply this suggestion', dismiss: 'Dismiss',
  previouslyApplied: 'Previously applied', unavailable: 'Suggestion no longer available',
  discuss: 'Discuss this sentence in English', placeholder: 'Please make this sound natural without changing its meaning.',
  requestEdit: 'Request an edit', undo: 'Undo last edit', stop: 'Stop',
  cancelled: 'Request cancelled. The draft is unchanged.', preparing: 'Preparing a suggestion for this sentence…',
  retry: 'Retry this request', editFailed: 'The edit could not be applied. The draft is unchanged. Please check the selected sentence and try again.',
  requestFailed: 'A suggestion could not be prepared. The draft is unchanged. Please check the model connection and retry.',
  requestTooLong: 'The selected sentence or request is too long. Divide it into shorter parts and try again.',
  emptyRequest: 'Enter what you would like to change before sending your request.',
  invalidResponse: 'The model returned an unreadable suggestion. The draft is unchanged. Please retry.',
  wrongLanguage: 'The model did not return an explanation in your selected language. The rejected response has not been applied. Please retry.',
  historyHint: 'Sentence conversations and edit history are included in the JSON export. Export before leaving; there is no autosave. Evidence for edited sentences is not automatically rechecked.',
  reviewUnavailable: 'Meaning review is currently supported in Korean and English only. You can discuss this sentence, but applying a suggested edit is unavailable until meaning review is supported in your language.',
  meaningLoading: 'Preparing the English meaning…',
  meaningFailed: 'The English meaning could not be prepared. Please check the model connection and retry.',
  meaningRetry: 'Retry English meaning', meaningLanguage: 'This meaning check is in English. Arabic meaning review is not yet supported.',
};
export type RevisionCopy = { [K in keyof typeof en]: string };
const ko: RevisionCopy = {
  compareView: '내가 한 말과 나란히 보기', sentenceView: '초안만 보기', compareHint: '한국어 초안의 각 문장 옆에 대화에서 직접 하신 말을 함께 보여 드립니다. 비교해 보시고 뜻이 다른 부분은 고쳐 주세요.',
  originalWords: '내가 한 말 (원문)', draftSentence: '한국어 초안 문장', noOriginal: '이 문장에 연결된 원문이 없습니다. 직접 하신 말과 맞는지 확인해 주세요.',
  confirmedTag: '확정', unconfirmedTag: '확정 전', confirmSentence: '내 뜻과 맞아요 (확정)', unconfirmSentence: '확정 취소',
  confirmedCount: '{total}문장 중 {n}문장 확정', editDirect: '이 문장 직접 고치기', directEditLabel: '한국어 문장', saveEdit: '고친 문장 저장', cancelEdit: '취소',
  candidatesHint: '수정안은 표현의 후보일 뿐입니다. 하나를 고르거나, 직접 고치거나, 그대로 두셔도 됩니다.',
  notLegal: '이 화면은 표현을 비교하도록 돕는 도구입니다. 법률적 판단을 하거나 신청서의 정답을 알려 주지 않습니다.',
  instructions: '수정할 문장을 선택하고 요청해 주세요. 승인하기 전에는 본문이 바뀌지 않습니다. 사실관계가 달라졌다면 대화 수집 단계에서 정정한 뒤 초안을 다시 작성해 주세요.',
  koreanDraft: '한국어 초안', selectSentence: '클릭해 문장 선택', sentenceToEdit: '수정할 문장',
  editedHint: '밑줄이 있는 문장은 원문에서 수정된 문장입니다.', selectedSentence: '선택한 문장',
  viewOriginal: '처음 작성한 문장 보기', discussion: '문장별 수정 대화', yourRequest: '수정 요청',
  suggestion: '수정안', apply: '이 수정안 반영', dismiss: '반영하지 않기',
  previouslyApplied: '반영 이력 있음', unavailable: '사용할 수 없는 수정안',
  discuss: '이 문장에 대해 이야기하기', placeholder: '같은 뜻을 유지하면서 자연스럽게 다듬어 주세요.',
  requestEdit: '수정 요청', undo: '마지막 수정 되돌리기', stop: '중지',
  cancelled: '요청을 취소했습니다. 본문은 유지됩니다.', preparing: '선택한 문장의 수정안을 작성하고 있습니다…',
  retry: '같은 요청 다시 시도', editFailed: '수정안을 반영하지 못했습니다. 본문은 유지됩니다. 선택한 문장을 확인하고 다시 시도해 주세요.',
  requestFailed: '수정안을 준비하지 못했습니다. 본문은 유지됩니다. 모델 연결을 확인한 뒤 다시 시도해 주세요.',
  requestTooLong: '선택한 문장이나 요청이 너무 깁니다. 짧게 나누어 다시 시도해 주세요.',
  emptyRequest: '변경하고 싶은 내용을 입력한 뒤 요청해 주세요.',
  invalidResponse: '모델이 읽을 수 없는 수정안을 반환했습니다. 본문은 유지됩니다. 다시 시도해 주세요.',
  wrongLanguage: '모델이 선택한 언어로 설명하지 못했습니다. 거부된 응답은 반영되지 않았습니다. 다시 시도해 주세요.',
  historyHint: '문장별 대화와 수정 이력은 전체 결과 JSON에 포함됩니다. 자동 저장되지 않으므로 종료 전에 내보내 주세요. 수정된 문장의 근거는 자동 재검증되지 않습니다.',
  reviewUnavailable: '현재 수정안의 의미 확인은 한국어와 영어만 지원합니다. 문장에 대한 대화는 가능하지만 선택한 언어의 의미 확인이 지원되기 전에는 수정안을 반영할 수 없습니다.',
  meaningLoading: '영어 확인본을 준비하고 있습니다…',
  meaningFailed: '영어 확인본을 준비하지 못했습니다. 모델 연결을 확인한 뒤 다시 시도해 주세요.',
  meaningRetry: '영어 확인본 다시 시도', meaningLanguage: '이 확인본은 영어입니다. 아랍어 의미 확인은 아직 지원되지 않습니다.',
};
const ar: RevisionCopy = {
  compareView: 'المقارنة بكلماتي الأصلية', sentenceView: 'عرض المسودة فقط', compareHint: 'تظهر كل جملة كورية بجانب الكلمات التي استخدمتها في المحادثة. قارن بينهما وصحّح ما لا يطابق ما قصدته.',
  originalWords: 'كلماتك الأصلية', draftSentence: 'جملة المسودة الكورية', noOriginal: 'لا توجد كلمات أصلية مرتبطة بهذه الجملة. يرجى التحقق منها مقارنةً بما قلته.',
  confirmedTag: 'مؤكَّدة', unconfirmedTag: 'لم تُؤكَّد بعد', confirmSentence: 'هذه الجملة تطابق ما قصدته', unconfirmSentence: 'إلغاء التأكيد',
  confirmedCount: 'أُكِّدت {n} من أصل {total} جملة', editDirect: 'تعديل هذه الجملة بنفسي', directEditLabel: 'الجملة الكورية', saveEdit: 'حفظ تعديلي', cancelEdit: 'إلغاء',
  candidatesHint: 'الاقتراحات مجرد خيارات للصياغة. اختر أحدها، أو عدّل الجملة بنفسك، أو اتركها كما هي.',
  notLegal: 'تساعدك هذه الشاشة على مقارنة الصياغة فقط. لا تقدّم استشارة قانونية ولا تحدد ما هو الصحيح في طلبك.',
  instructions: 'اختر جملة واكتب ما تريد تعديله. لن يتغير النص قبل موافقتك. لتصحيح الوقائع، ارجع إلى محادثة جمع المعلومات ثم أعد إعداد المسودة.',
  koreanDraft: 'المسودة الكورية', selectSentence: 'اختر جملة', sentenceToEdit: 'الجملة المطلوب تعديلها',
  editedHint: 'الجمل التي تحتها خط عُدّلت عن نصها الأصلي.', selectedSentence: 'الجملة المختارة',
  viewOriginal: 'عرض الجملة الأصلية', discussion: 'مناقشة الجملة', yourRequest: 'طلبك',
  suggestion: 'النص الكوري المقترح', apply: 'تطبيق هذا الاقتراح', dismiss: 'عدم التطبيق',
  previouslyApplied: 'طُبّق سابقًا', unavailable: 'هذا الاقتراح لم يعد متاحًا',
  discuss: 'ناقش هذه الجملة بالعربية', placeholder: 'يرجى تحسين الصياغة مع الحفاظ على المعنى نفسه.',
  requestEdit: 'طلب تعديل', undo: 'التراجع عن آخر تعديل', stop: 'إيقاف',
  cancelled: 'أُلغي الطلب. لم تتغير المسودة.', preparing: 'يجري إعداد اقتراح لهذه الجملة…',
  retry: 'إعادة المحاولة بالطلب نفسه', editFailed: 'تعذر تطبيق التعديل. لم تتغير المسودة. تحقق من الجملة المختارة ثم حاول مرة أخرى.',
  requestFailed: 'تعذر إعداد الاقتراح. لم تتغير المسودة. تحقق من اتصال النموذج ثم أعد المحاولة.',
  requestTooLong: 'الجملة المختارة أو الطلب أطول من المسموح. قسّمه إلى أجزاء أقصر ثم حاول مرة أخرى.',
  emptyRequest: 'اكتب ما تريد تغييره قبل إرسال طلبك.',
  invalidResponse: 'أعاد النموذج اقتراحًا غير قابل للقراءة. لم تتغير المسودة. أعد المحاولة.',
  wrongLanguage: 'لم يُرجع النموذج شرحًا باللغة التي اخترتها. لم يُطبّق الرد المرفوض. أعد المحاولة.',
  historyHint: 'يتضمن ملف السجل الكامل مناقشات الجمل وسجل التعديلات. احفظه قبل المغادرة؛ لا يوجد حفظ تلقائي. لا يُعاد التحقق تلقائيًا من مصادر الجمل المعدّلة.',
  reviewUnavailable: 'يتاح التحقق من معنى التعديلات حاليًا بالكورية والإنجليزية فقط. يمكنك مناقشة هذه الجملة بالعربية، لكن لا يمكن تطبيق اقتراح قبل دعم التحقق من معناه بلغتك.',
  meaningLoading: 'يجري إعداد المعنى باللغة الإنجليزية…',
  meaningFailed: 'تعذر إعداد المعنى باللغة الإنجليزية. تحقق من اتصال النموذج ثم أعد المحاولة.',
  meaningRetry: 'إعادة محاولة إعداد المعنى بالإنجليزية', meaningLanguage: 'هذا التحقق من المعنى باللغة الإنجليزية. لم تُدعَم مراجعة المعنى بالعربية بعد.',
};
export const revisionCopies = { en, ko, ar } satisfies Record<'en' | 'ko' | 'ar', RevisionCopy>;
export function revisionCopy(language: string): RevisionCopy {
  return language === 'ar' ? revisionCopies.ar : language === 'ko' ? revisionCopies.ko : revisionCopies.en;
}
export function revisionDirection(language: string): 'rtl' | 'ltr' {
  return language === 'ar' || language === 'fa' ? 'rtl' : 'ltr';
}
/** A translated interface must not imply that an unsupported meaning review has succeeded. */
export function supportsMeaningReview(language: string): boolean {
  return language === 'ko' || language === 'en';
}

export type RevisionErrorKey = 'requestFailed' | 'editFailed' | 'cancelled' | 'requestTooLong' | 'emptyRequest' | 'invalidResponse' | 'wrongLanguage';

/** Classify implementation errors without exposing backend strings or quoted applicant data. */
export function revisionErrorKey(failure: unknown): RevisionErrorKey {
  const message = failure instanceof Error ? failure.message : String(failure);
  if (/replied in Korean|did not reply in Arabic/u.test(message)) return 'wrongLanguage';
  if (/선택한 문장.*너무 깁니다/u.test(message)) return 'requestTooLong';
  if (/수정 요청을 입력/u.test(message)) return 'emptyRequest';
  if (/모델 응답|빈 수정안/u.test(message)) return 'invalidResponse';
  return 'requestFailed';
}
