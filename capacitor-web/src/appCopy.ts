/** Applicant-facing application chrome. Arabic is exhaustive, never a partial English fallback. */
export const appEnglish = {
  languagePicker: 'Choose your language', quickEnglishTest: 'Conversation test in English → Korean', shortConversation: 'Try a short conversation in English',
  shortTest: 'Short English test', exampleGenerating: 'Generating a fictional answer…', exampleGenerate: 'Generate an example', finish: 'Finish',
  exampleNotice: 'Generating a fictional example. It will be placed in the input box, not sent automatically.', exampleQuestion: 'Generating a fictional answer for this question…',
  operator: 'Operator and developer settings', onDevice: 'Running on this device', localPreview: 'Browser preview · computation on the connected local server', checking: 'Checking status',
  fileReady: 'Model file ready · compatibility is checked on the first response', modelReady: 'Model ready', modelNeeded: 'Model setup required', previewModel: 'Preview model',
  previewNote: 'The browser sends your original text and collected information to this server for computation. Mobile apps use their native model and do not switch to a server automatically.',
  refreshStatus: 'Refresh status', importBusy: 'Importing model…', importModel: 'Import .litertlm model', scopeLabel: 'Scope of a new conversation',
  scopeTest: 'Short metadata test in English', scopeFull: 'Full application', scopePriority: 'Questions 14.1–14.3', koreanDemo: 'Run a fictional Korean model test',
  koreanDemoNote: 'This developer test switches to Korean and sends a fictional account to the actual model. It does not replay a fixed answer. Start with an empty conversation.',
  exportCurrent: 'Export original text, metadata and draft as JSON', more: 'More', finishStory: 'Finish my story and continue', finishQuestions: 'Finish questions and review',
  continueReview: 'Continue to review your information', nextStep: 'Your next step', flow: 'Your story → Follow-up questions → Check your account → Review and save',
  detailSources: 'Detailed information and original sources', eventMissing: 'Still to discuss for this entry', reviewedAll: 'I have checked all the information above.',
  q14Title: '14. Reasons for seeking protection', editableDraft: 'Editable Korean draft',
  draftIntro: 'This Korean draft uses the information you shared. Edits are separate from your original answers. Replacement text remains Korean. Meaning review is currently available in Korean and English only.',
  backtranslationNote: 'This is an AI back-translation, not a verified translation. Check who did what, uncertainty, and information heard from others.',
  needsReview: 'Needs your review: ', draftMissing: 'Information missing from this draft: ', addMissing: '. Please review and add what is missing.',
  stalePrefix: 'Earlier wording remains after a correction: ', correctStale: '. Please review and correct it.',
  refine: 'Discuss and refine', sources: 'Source references', sentenceEditor: 'Sentence editor', metadataDeveloper: 'Metadata · developer data',
  exportApplication: 'Export application', exportFormTitle: 'Export application form', exportLoading: 'Loading export…',
  saveRecord: 'Save full record', savedRecord: 'Full record download requested. Your application has not been submitted.', savedDraft: 'Korean draft download requested. Your application has not been submitted.',
  formValues: 'Information entered in the form', asEntered: 'As entered',
  errorClarify: 'Could not prepare a clarification question. Please try again.', errorExample: 'Could not generate a fictional example. Please retry.',
  cancelled: 'The request was cancelled or timed out. Wait for the local model to finish its previous task, then retry.',
  connectionError: 'Could not connect to the local model server. Check the connection in operator settings, then retry.',
  modelMissingError: 'The selected model is not available. Check its installation in operator settings.', busyError: 'The model is still processing a previous request. Please wait before retrying.',
  inputRequired: 'Enter an answer first.', inputLengthError: 'This answer is too long. Split it into shorter messages.',
  contextLengthError: 'This conversation exceeds the current context limit. Your answers remain on this page; ask an operator to check the model settings.',
  responseError: 'The model returned a result that could not be processed. Your answer is preserved. Please retry.',
  sourceError: 'The model result did not match the original evidence. Your answer is preserved. Review the information or retry.',
  reviewError: 'Review and confirm the collected information before preparing a draft.', choiceError: 'Choose one of the displayed options.',
  responseLanguage: 'The model answered in another language. Your answer is preserved. Please retry to receive an Arabic response.',
  genericError: 'This operation could not be completed. Your answers remain on this page. Retry or ask an operator for help.',
} as const;
export type AppCopyKey = keyof typeof appEnglish;
export type AppCopy = Record<AppCopyKey, string>;

export const appArabic: AppCopy = {
  languagePicker: 'اختر لغتك', quickEnglishTest: 'اختبار محادثة بالإنجليزية إلى الكورية', shortConversation: 'تجربة محادثة قصيرة بالإنجليزية',
  shortTest: 'اختبار قصير بالإنجليزية', exampleGenerating: 'جارٍ إنشاء إجابة خيالية…', exampleGenerate: 'إنشاء مثال', finish: 'إنهاء',
  exampleNotice: 'جارٍ إنشاء مثال خيالي. سيظهر في مربع الكتابة ولن يُرسل تلقائيًا.', exampleQuestion: 'جارٍ إنشاء إجابة خيالية لهذا السؤال…',
  operator: 'إعدادات المشغّل والمطوّر', onDevice: 'يعمل على هذا الجهاز', localPreview: 'معاينة المتصفح · المعالجة على الخادم المحلي المتصل', checking: 'جارٍ التحقق من الحالة',
  fileReady: 'ملف النموذج جاهز · يُفحص التوافق عند أول استجابة', modelReady: 'النموذج جاهز', modelNeeded: 'يلزم إعداد النموذج', previewModel: 'نموذج المعاينة',
  previewNote: 'يرسل المتصفح نصك الأصلي والمعلومات المجمّعة إلى هذا الخادم للمعالجة. يستخدم تطبيق الهاتف نموذجه المحلي ولا يتحول إلى خادم تلقائيًا.',
  refreshStatus: 'تحديث الحالة', importBusy: 'جارٍ استيراد النموذج…', importModel: 'استيراد ملف نموذج', scopeLabel: 'نطاق محادثة جديدة',
  scopeTest: 'اختبار قصير للمعلومات بالإنجليزية', scopeFull: 'الطلب الكامل', scopePriority: 'الأسئلة من ١٤٫١ إلى ١٤٫٣', koreanDemo: 'تشغيل اختبار خيالي بالكورية',
  koreanDemoNote: 'يحوّل هذا الاختبار المخصّص للتطوير اللغة إلى الكورية ويرسل رواية خيالية إلى النموذج الفعلي. لا يعرض إجابة محفوظة مسبقًا. ابدأ بمحادثة فارغة.',
  exportCurrent: 'تصدير النص الأصلي والمعلومات والمسودة كسجل بيانات', more: 'المزيد', finishStory: 'إنهاء روايتي والمتابعة', finishQuestions: 'إنهاء الأسئلة ومراجعة المعلومات',
  continueReview: 'المتابعة لمراجعة معلوماتك', nextStep: 'خطوتك التالية', flow: 'روايتك ← أسئلة متابعة ← التحقق من المعلومات ← المراجعة والحفظ',
  detailSources: 'المعلومات التفصيلية والمصادر الأصلية', eventMissing: 'معلومات تحتاج إلى مناقشة لهذه الواقعة', reviewedAll: 'راجعت جميع المعلومات أعلاه.',
  q14Title: '١٤. أسباب طلب الحماية', editableDraft: 'مسودة كورية قابلة للتعديل',
  draftIntro: 'أُعدّت هذه المسودة الكورية من معلوماتك. تُحفظ التعديلات منفصلة عن إجاباتك الأصلية ويبقى النص البديل بالكورية. تتوفر مراجعة المعنى حاليًا بالكورية والإنجليزية فقط.',
  backtranslationNote: 'هذه ترجمة عكسية آلية وليست ترجمة موثّقة. تحقّق ممن فعل ماذا، ودرجة اليقين، والمعلومات المنقولة عن الآخرين.',
  needsReview: 'يحتاج إلى مراجعتك: ', draftMissing: 'معلومات غائبة عن هذه المسودة: ', addMissing: '. راجع المعلومات وأضف ما ينقص.',
  stalePrefix: 'بقيت صياغة سابقة بعد التصحيح: ', correctStale: '. راجعها وصحّحها.',
  refine: 'مناقشة الصياغة وتنقيحها', sources: 'المصادر الأصلية', sentenceEditor: 'تعديل الجمل', metadataDeveloper: 'البيانات المنظّمة · عرض تقني',
  exportApplication: 'تصدير الطلب', exportFormTitle: 'تصدير نموذج الطلب', exportLoading: 'جارٍ تجهيز التصدير…',
  saveRecord: 'حفظ سجل العمل الكامل', savedRecord: 'طُلب تنزيل سجل العمل الكامل. لم يُقدَّم طلبك إلى أي جهة.', savedDraft: 'طُلب تنزيل المسودة الكورية. لم يُقدَّم طلبك إلى أي جهة.',
  formValues: 'المعلومات المُدخلة في الاستمارة', asEntered: 'كما أُدخلت',
  errorClarify: 'تعذّر إعداد سؤال للتوضيح. يرجى المحاولة مجددًا.', errorExample: 'تعذّر إنشاء مثال خيالي. يرجى المحاولة مجددًا.',
  cancelled: 'أُلغي الطلب أو انتهت مهلة معالجته. انتظر حتى ينهي النموذج المحلي مهمته السابقة ثم أعد المحاولة.',
  connectionError: 'تعذّر الاتصال بخادم النموذج المحلي. تحقّق من الاتصال في إعدادات المشغّل ثم أعد المحاولة.',
  modelMissingError: 'النموذج المحدّد غير متاح. تحقّق من تثبيته في إعدادات المشغّل.', busyError: 'لا يزال النموذج يعالج طلبًا سابقًا. يرجى الانتظار قبل إعادة المحاولة.',
  inputRequired: 'اكتب إجابة أولًا.', inputLengthError: 'هذه الإجابة طويلة جدًا. قسّمها إلى رسائل أقصر.',
  contextLengthError: 'تجاوزت المحادثة الحد الحالي للسياق. ما زالت إجاباتك في هذه الصفحة؛ اطلب من المشغّل مراجعة إعدادات النموذج.',
  responseError: 'أعاد النموذج نتيجة تعذّرت معالجتها. إجابتك محفوظة في هذه الصفحة. يرجى إعادة المحاولة.',
  sourceError: 'لم تتطابق نتيجة النموذج مع الأدلة الأصلية. إجابتك محفوظة في هذه الصفحة. راجع المعلومات أو أعد المحاولة.',
  reviewError: 'راجع المعلومات المجمّعة وأكّدها قبل إعداد المسودة.', choiceError: 'اختر أحد الخيارات المعروضة.',
  responseLanguage: 'أجاب النموذج بلغة أخرى. إجابتك محفوظة في هذه الصفحة. يرجى إعادة المحاولة للحصول على رد بالعربية.',
  genericError: 'تعذّر إتمام هذه العملية. ما زالت إجاباتك في هذه الصفحة. أعد المحاولة أو اطلب مساعدة المشغّل.',
};

export const appKorean: AppCopy = {
  languagePicker: '언어 선택', quickEnglishTest: '영어 대화 · 한국어 초안 테스트', shortConversation: '영어로 짧은 대화 시험하기',
  shortTest: '짧은 영어 테스트', exampleGenerating: '가상 답변 생성 중…', exampleGenerate: '예시 생성', finish: '마치기',
  exampleNotice: '가상 예시를 생성합니다. 입력란에만 표시하고 자동으로 보내지 않습니다.', exampleQuestion: '이 질문의 가상 답변을 생성합니다…',
  operator: '운영자·개발자 설정', onDevice: '이 기기에서 실행 · 온디바이스', localPreview: '브라우저 미리보기 · 연결된 로컬 서버에서 연산', checking: '상태 확인 중',
  fileReady: '모델 파일 준비됨 · 실행 호환성은 첫 응답에서 확인', modelReady: '모델 준비됨', modelNeeded: '모델 준비 필요', previewModel: '미리보기 모델',
  previewNote: '브라우저에서는 원문과 수집 정보를 이 서버에 보내 연산합니다. 모바일 앱은 네이티브 모델을 사용하며 서버로 자동 전환하지 않습니다.',
  refreshStatus: '상태 새로고침', importBusy: '모델 가져오는 중…', importModel: '.litertlm 모델 가져오기', scopeLabel: '새 대화의 수집 범위',
  scopeTest: '영어 핵심 메타데이터 대화 테스트', scopeFull: '신청서 전체', scopePriority: '14.1~14.3 우선 테스트', koreanDemo: '한국어 가상 예시로 모델 테스트',
  koreanDemoNote: '개발용 테스트는 한국어로 전환하고 가상 원문을 실제 모델에 보냅니다. 정해진 응답을 재생하지 않습니다. 빈 대화에서 시작해 주세요.',
  exportCurrent: '원문·메타데이터·초안 JSON 내보내기', more: '더 보기', finishStory: '이야기를 마치고 추가 질문 받기', finishQuestions: '질문을 마치고 내용 확인',
  continueReview: '이제 내용을 확인해 주세요', nextStep: '진행 안내', flow: '이야기 → 추가 질문 → 내용 확인 → 초안 확인과 저장',
  detailSources: '상세 수집 정보와 원문 보기', eventMissing: '이 사건에서 더 확인할 내용', reviewedAll: '위 내용을 모두 확인했습니다.',
  q14Title: '14. 난민인정 신청 사유', editableDraft: '직접 수정 가능한 한국어 초안',
  draftIntro: '수집한 내용으로 작성한 한국어 초안입니다. 수정 내용은 원래 답변과 따로 저장되며 대체 문장도 한국어입니다. 의미 확인은 현재 한국어와 영어로 지원합니다.',
  backtranslationNote: 'AI 역번역이며 검증된 번역은 아닙니다. 행위자, 불확실성, 전해 들은 내용을 원문과 비교해 주세요.',
  needsReview: '다시 확인 필요: ', draftMissing: '초안에 빠진 확인 내용: ', addMissing: '. 내용을 확인하고 보완해 주세요.',
  stalePrefix: '정정 전 내용이 남아 있습니다: ', correctStale: '. 내용을 확인하고 수정해 주세요.',
  refine: '문장별 대화로 다듬기', sources: '원문 보기', sentenceEditor: '문장 수정', metadataDeveloper: '메타데이터 · 개발자 데이터',
  exportApplication: '신청서 내보내기', exportFormTitle: '신청서 양식으로 출력', exportLoading: '출력 기능 준비 중…',
  saveRecord: '전체 작업 기록 저장', savedRecord: '전체 작업 기록의 다운로드를 요청했습니다. 신청서는 제출되지 않았습니다.', savedDraft: '한국어 초안의 다운로드를 요청했습니다. 신청서는 제출되지 않았습니다.',
  formValues: '양식에 입력한 정보', asEntered: '입력한 그대로',
  errorClarify: '확인 질문을 준비하지 못했습니다. 다시 시도해 주세요.', errorExample: '가상 예시를 생성하지 못했습니다. 다시 시도해 주세요.',
  cancelled: '요청이 취소되었거나 처리 시간을 초과했습니다. 이전 모델 작업이 끝난 뒤 다시 시도해 주세요.',
  connectionError: '로컬 모델 서버에 연결하지 못했습니다. 운영자 설정에서 연결 상태를 확인해 주세요.',
  modelMissingError: '선택한 모델을 사용할 수 없습니다. 운영자 설정에서 설치 상태를 확인해 주세요.', busyError: '이전 모델 요청을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.',
  inputRequired: '답변을 먼저 입력해 주세요.', inputLengthError: '답변이 너무 깁니다. 내용을 나누어 입력해 주세요.',
  contextLengthError: '현재 문맥 길이 제한을 넘었습니다. 답변은 이 화면에 남아 있습니다. 운영자에게 모델 설정 확인을 요청해 주세요.',
  responseError: '모델 결과 형식을 처리하지 못했습니다. 답변은 보존되어 있습니다. 다시 시도해 주세요.',
  sourceError: '모델 결과가 원문 근거와 일치하지 않습니다. 답변은 보존되어 있습니다. 내용을 확인하거나 다시 시도해 주세요.',
  reviewError: '수집한 내용을 확인한 뒤 초안을 작성해 주세요.', choiceError: '표시된 선택지에서 골라 주세요.',
  responseLanguage: '모델이 선택한 언어로 답하지 않았습니다. 답변은 보존되어 있습니다. 다시 시도해 주세요.',
  genericError: '작업을 완료하지 못했습니다. 답변은 이 화면에 남아 있습니다. 다시 시도하거나 운영자에게 도움을 요청해 주세요.',
};

export function appCopyFor(language: string): AppCopy {
  return language === 'ar' ? appArabic : language === 'ko' ? appKorean : appEnglish;
}

/** Keep engine/validation diagnostics out of applicant-facing Arabic UI. */
export function localizeAppError(language: string, failure: unknown): string {
  const copy = appCopyFor(language);
  const raw = failure instanceof Error ? failure.message : String(failure);
  if (Object.prototype.hasOwnProperty.call(appEnglish, raw)) return copy[raw as AppCopyKey];
  if (language !== 'ar') return raw;
  if (/AbortError|TimeoutError|cancel|time.?out|취소|시간.*초과|중단/i.test(raw)) return copy.cancelled;
  if (/이전.*요청|이전.*작업|BUSY|작업 중/i.test(raw)) return copy.busyError;
  if (/문맥|context/i.test(raw)) return copy.contextLengthError;
  if (/12,?000|답변.*길|입력.*길/i.test(raw)) return copy.inputLengthError;
  if (/입력해|답변을 먼저/i.test(raw)) return copy.inputRequired;
  if (/수집.*확인.*초안|정보를 먼저 확인/i.test(raw)) return copy.reviewError;
  if (/선택지/i.test(raw)) return copy.choiceError;
  if (/원문|인용|근거|사실.*일치|이전과 같은 질문/i.test(raw)) return copy.sourceError;
  if (/not found|모델.*준비|모델.*없|model.*missing/i.test(raw)) return copy.modelMissingError;
  if (/fetch|network|connect|서버.*연결|연결.*실패|ECONN/i.test(raw)) return copy.connectionError;
  if (/JSON|형식|응답|반환|구조|parse|schema/i.test(raw)) return copy.responseError;
  return copy.genericError;
}
