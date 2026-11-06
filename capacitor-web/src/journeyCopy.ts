import { requirementsById } from './intake/catalog.ts';
import { localizedRequirementLabel } from './form/localize.ts';

/** Arabic keys are exhaustive. Locales not translated here retain the previous
 * English journey fallback; this module does not claim six-language coverage. */
const en = {
  conversationTopics: 'Conversation topics', conversationHeading: 'Your conversation',
  nowStory: 'Now: Your story', nowPrefix: 'Now: ', canReview: 'You can review the information collected so far.',
  storyHelp: 'Start with your story. Afterwards, we will ask about information that is still needed.', topicHelp: 'You can say you do not know or leave a topic for later.', allTopics: 'See all topics',
  current: 'Talking about now', discussed: 'Discussed', needs_review: 'Needs review', upcoming: 'Not discussed yet',
  answered: 'Answered', unknown: 'Unknown', skipped: 'Deferred', not_applicable: 'Not applicable', conflict: 'Needs clarification', missing: 'Not answered', blocked: 'Depends on an earlier answer',
  reviewLabel: 'Check your account', reviewIntro: 'Check the information grouped by topic and incident. Correct anything that does not reflect what you meant.',
  topicsOpen: 'Topics left open: ', entry: 'Entry', needsClarification: 'Some information is unclear. Please check what you meant.', correct: 'Correct', confirmInformation: 'Confirm information', thisReflects: 'This reflects what I told you.',
  uncertain: 'Uncertain', approximate: 'Approximate', heard: 'Heard from others', inferred: 'Interpretation',
  beforeSave: 'Before you save', draftReady: 'Your draft is ready. Saving it does not submit an application.', topicsDeferred: 'Topics you marked unknown or deferred: ', itemsToCheck: 'Items still to check', returnInformation: 'Return to your information',
  preparingMeaning: 'Preparing the English text for your review. Resolve any translation errors above before confirming.', unsupportedMeaning: 'Draft review translation is currently supported in English only. You may save an unchecked work-in-progress record.',
  meaningChecked: 'I checked the meaning of the draft and the outstanding items.', meaningRecorded: 'Meaning review recorded. This does not mean every outstanding item has been resolved.', saveBeforeCheck: 'You can also save a work-in-progress draft before completing this check.',
  koreanDraft: 'Korean draft', koreanDraftDescription: 'A text file of the current application draft.', fullRecord: 'Full working record', fullRecordDescription: 'JSON containing your original answers, metadata, draft and edit history. It may contain personal information.',
  uncertainTag: 'Uncertain', approximateTag: 'Approximate information', heardTag: 'Heard from someone else', inferredTag: 'Your interpretation', includesNegative: 'Includes a negative statement', checkRoles: 'Check who did what', negativeStatement: 'Did not / was not',
  meaningClarify: 'Meaning to clarify', who: 'Who', didWhat: 'Did what', toWhom: 'To whom / what', toClarify: 'To clarify', whereUsed: 'Where this information is used', pleaseClarify: 'Please clarify the meaning of this part.', clarifyCorrect: 'Clarify or correct this', fieldDetails: 'Information details',
};
export type JourneyCopy = Record<keyof typeof en, string>;
const ko: JourneyCopy = {
  conversationTopics: '대화 진행 상황', conversationHeading: '대화 진행 상황', nowStory: '지금: 자유롭게 이야기하기', nowPrefix: '지금: ', canReview: '수집한 내용을 확인할 수 있습니다.',
  storyHelp: '먼저 편하게 이야기해 주세요. 이후 필요한 부분만 더 여쭤보겠습니다.', topicHelp: '답하기 어려운 내용은 모른다고 하거나 나중으로 남겨둘 수 있습니다.', allTopics: '전체 주제 보기',
  current: '지금 이야기하는 주제', discussed: '이야기 나눔', needs_review: '추가 확인 필요', upcoming: '아직 이야기하지 않음', answered: '답변 있음', unknown: '모름', skipped: '답변 보류', not_applicable: '해당 없음', conflict: '다시 확인 필요', missing: '미답변', blocked: '앞선 답변 확인 필요',
  reviewLabel: '주제별 확인', reviewIntro: '주제와 사건별로 모은 내용입니다. 틀린 부분은 수정하고, 맞는 내용은 확인해 주세요.', topicsOpen: '답변을 남겨둔 주제: ', entry: '사건', needsClarification: '불명확한 내용이 있습니다. 원래 의도를 확인해 주세요.', correct: '수정', confirmInformation: '내용 확인', thisReflects: '이 내용이 제 답변을 올바르게 반영합니다.', uncertain: '불확실함', approximate: '대략적임', heard: '전해 들음', inferred: '추정',
  beforeSave: '저장 전 마지막 확인', draftReady: '초안이 준비되었습니다. 저장해도 신청서가 제출되지는 않습니다.', topicsDeferred: '모름·보류로 남겨둔 주제: ', itemsToCheck: '남아 있는 확인 항목', returnInformation: '수집 내용으로 돌아가기', preparingMeaning: '확인본을 준비하고 있습니다.', unsupportedMeaning: '초안 확인용 번역은 현재 영어만 지원합니다. 확인하지 않은 작업 기록을 저장할 수 있습니다.',
  meaningChecked: '초안의 의미를 확인했고 남아 있는 확인 항목을 살펴봤습니다.', meaningRecorded: '의미 확인을 표시했습니다. 미해결 항목이 모두 해결되었다는 뜻은 아닙니다.', saveBeforeCheck: '확인 전에도 작업 중인 초안을 저장할 수 있습니다.', koreanDraft: '한국어 초안', koreanDraftDescription: '현재 신청서 내용을 텍스트 파일로 저장합니다.', fullRecord: '전체 작업 기록', fullRecordDescription: '원문·메타데이터·초안과 수정 기록이 포함된 JSON입니다. 개인정보가 포함될 수 있습니다.',
  uncertainTag: '확실하지 않음', approximateTag: '대략적인 정보', heardTag: '전해 들은 내용', inferredTag: '신청자의 추측·해석', includesNegative: '부정 표현 포함', checkRoles: '누가 무엇을 했는지 확인', negativeStatement: '하지 않았거나 일어나지 않았다고 말함', meaningClarify: '의미 확인 필요', who: '누가', didWhat: '무엇을', toWhom: '대상·내용', toClarify: '확인 필요', whereUsed: '신청서에서 활용할 부분', pleaseClarify: '이 부분의 의미를 한 번 더 확인해 주세요.', clarifyCorrect: '이 내용 확인·정정하기', fieldDetails: '정보 세부 내용',
};
const ar: JourneyCopy = {
  conversationTopics: 'مواضيع المحادثة', conversationHeading: 'محادثتك', nowStory: 'الآن: قصتك', nowPrefix: 'الآن: ', canReview: 'يمكنك مراجعة المعلومات التي جُمعت حتى الآن.',
  storyHelp: 'ابدأ بسرد قصتك. سنسأل بعد ذلك عن المعلومات التي ما زالت مطلوبة.', topicHelp: 'يمكنك القول إنك لا تعرف أو ترك الموضوع لوقت لاحق.', allTopics: 'عرض جميع المواضيع',
  current: 'الموضوع الحالي', discussed: 'تمت مناقشته', needs_review: 'يحتاج إلى مراجعة', upcoming: 'لم تتم مناقشته بعد', answered: 'تمت الإجابة', unknown: 'غير معروف', skipped: 'مؤجل', not_applicable: 'لا ينطبق', conflict: 'يحتاج إلى توضيح', missing: 'لم تتم الإجابة', blocked: 'يعتمد على إجابة سابقة',
  reviewLabel: 'مراجعة إفادتك', reviewIntro: 'هذه المعلومات مرتبة حسب الموضوع والواقعة. صحّح أي معلومة لا تعكس ما قصدته، وأكّد المعلومات الصحيحة.', topicsOpen: 'المواضيع التي تركتها مفتوحة: ', entry: 'الواقعة', needsClarification: 'بعض المعلومات غير واضحة. يرجى التحقق من المعنى الذي قصدته.', correct: 'تصحيح', confirmInformation: 'تأكيد المعلومات', thisReflects: 'هذه المعلومات تعكس إجابتي بشكل صحيح.', uncertain: 'غير مؤكد', approximate: 'تقريبي', heard: 'منقول عن الآخرين', inferred: 'استنتاج شخصي',
  beforeSave: 'المراجعة الأخيرة قبل الحفظ', draftReady: 'المسودة جاهزة. حفظها لا يعني تقديم طلبك.', topicsDeferred: 'المواضيع التي حددتها كغير معروفة أو مؤجلة: ', itemsToCheck: 'معلومات ما زالت بحاجة إلى مراجعة', returnInformation: 'العودة إلى المعلومات المجمّعة', preparingMeaning: 'جارٍ إعداد النص الإنجليزي للمراجعة. عالج أي أخطاء في الترجمة قبل التأكيد.', unsupportedMeaning: 'ترجمة المسودة للتحقق من معناها متاحة حاليًا بالإنجليزية فقط، وليست متاحة بالعربية بعد. يمكنك حفظ سجل عمل غير مؤكد إلى حين مراجعة المعنى.',
  meaningChecked: 'راجعت معنى المسودة والمعلومات التي ما زالت بحاجة إلى تحقق.', meaningRecorded: 'تم تسجيل مراجعة المعنى. هذا لا يعني أن جميع المعلومات المعلّقة قد حُسمت.', saveBeforeCheck: 'يمكنك أيضًا حفظ مسودة عمل قبل إتمام هذه المراجعة.', koreanDraft: 'المسودة الكورية', koreanDraftDescription: 'ملف نصي يحتوي على مسودة الطلب الحالية.', fullRecord: 'سجل العمل الكامل', fullRecordDescription: 'ملف بيانات يحتوي على إجاباتك الأصلية والمعلومات المجمّعة والمسودة وسجل التعديلات، وقد يتضمن معلومات شخصية.',
  uncertainTag: 'غير مؤكد', approximateTag: 'معلومات تقريبية', heardTag: 'معلومات منقولة عن شخص آخر', inferredTag: 'استنتاجك الشخصي', includesNegative: 'يتضمن إفادة بالنفي', checkRoles: 'التحقق ممن قام بالفعل وما فعله', negativeStatement: 'ذُكر أن الفعل لم يقع أو أن الحالة لم تكن كذلك', meaningClarify: 'المعنى بحاجة إلى توضيح', who: 'مَن', didWhat: 'ماذا فعل', toWhom: 'بمَن أو بماذا يتعلق الفعل', toClarify: 'بحاجة إلى توضيح', whereUsed: 'موضع استخدام هذه المعلومات في الطلب', pleaseClarify: 'يرجى توضيح المقصود بهذا الجزء مرة أخرى.', clarifyCorrect: 'توضيح هذه المعلومات أو تصحيحها', fieldDetails: 'تفاصيل المعلومات',
};
export const journeyCopies = { en, ko, ar };
export function journeyCopyFor(language: string): JourneyCopy { return language === 'ar' ? ar : language === 'ko' ? ko : en; }
type LocalizedTitle = { ko: string; en: string; ar: string };
const topics: Record<string, LocalizedTitle> = {
  grounds: { ko: '신청하려는 이유', en: 'Why you are seeking protection', ar: 'سبب طلبك للحماية' }, harm: { ko: '겪으신 일', en: 'What happened to you', ar: 'ما الذي حدث لك' }, fear: { ko: '귀국 시 걱정되는 일', en: 'What worries you about returning', ar: 'ما يقلقك بشأن العودة' },
  family_harm: { ko: '가족이나 친구가 겪은 피해', en: 'Harm to family or friends', ar: 'الأذى الذي تعرضت له الأسرة أو الأصدقاء' }, protection: { ko: '본국에 보호를 요청한 일', en: 'Requests for protection at home', ar: 'طلب الحماية في بلدك' }, relocation: { ko: '본국 안 다른 지역으로의 피신', en: 'Moving elsewhere in your country for safety', ar: 'الانتقال إلى منطقة أخرى في بلدك طلبًا للأمان' },
  departure: { ko: '본국 출국', en: 'Leaving your country', ar: 'مغادرة بلدك' }, org: { ko: '본인이나 가족의 단체 가입·활동', en: 'Membership or activity in organizations', ar: 'عضويتك أو عضوية أسرتك ونشاطكم في المنظمات' }, activity: { ko: '본국 정부나 단체에 반대하는 활동', en: 'Activities against a government or group', ar: 'الأنشطة المعارضة لحكومة بلدك أو إحدى الجماعات' }, criminal: { ko: '범죄로 체포되거나 처벌받은 일', en: 'Arrest or punishment for a criminal offense', ar: 'التوقيف أو العقوبة بسبب تهمة جنائية' },
  other_app: { ko: '다른 나라나 UNHCR에 한 난민 신청', en: 'Refugee applications elsewhere or at UNHCR', ar: 'طلبات اللجوء في بلد آخر أو لدى المفوضية السامية لشؤون اللاجئين' }, minor: { ko: '함께 신청한 19세 미만 자녀', en: 'Children under 19 applying with you', ar: 'الأطفال دون التاسعة عشرة المتقدمون معك' }, contact: { ko: '본국에 있는 가족과의 연락', en: 'Contact with family at home', ar: 'التواصل مع الأسرة في بلدك' }, evidence: { ko: '신청 사유를 뒷받침하는 서류나 증거', en: 'Documents or evidence', ar: 'المستندات أو الأدلة المؤيدة لطلبك' }, learned: { ko: '신청 절차를 알게 된 경위', en: 'How you learned about the procedure', ar: 'كيف عرفت بإجراءات الطلب' }, late: { ko: '입국 1년 후 신청', en: 'Application more than a year after arrival', ar: 'تقديم الطلب بعد أكثر من سنة على الوصول' }, form: { ko: '기본정보', en: 'Application details', ar: 'البيانات الأساسية للطلب' },
};
const details: Record<string, LocalizedTitle> = {
  summary: { ko: '신청하려는 이유', en: 'Why you are seeking protection', ar: 'سبب طلبك للحماية' }, identity: { ko: '관련된 배경', en: 'Relevant background', ar: 'الخلفية ذات الصلة' }, perceived: { ko: '상대방이 알게 된 경위', en: 'How they knew about you', ar: 'كيف عرف الطرف الآخر عنك' }, event: { ko: '겪으신 일', en: 'What happened', ar: 'ما الذي حدث' }, type: { ko: '피해 종류', en: 'Kind of harm', ar: 'نوع الأذى' }, time: { ko: '언제', en: 'When', ar: 'متى' }, place: { ko: '어디서', en: 'Where', ar: 'أين' }, actor: { ko: '누가', en: 'Who was involved', ar: 'مَن كان متورطًا' }, reason: { ko: '그렇게 생각하는 이유', en: 'Why you believe this', ar: 'لماذا تعتقد ذلك' }, release: { ko: '풀려난 경위', en: 'How you were released', ar: 'كيف أُفرج عنك' }, result: { ko: '이후의 영향', en: 'What happened afterwards', ar: 'النتيجة وما حدث بعد ذلك' },
};
function titleFor(value: LocalizedTitle, language: string): string { return value[language === 'ar' ? 'ar' : language === 'ko' ? 'ko' : 'en']; }
export function journeyTopicTitle(id: string, fallback: string, language: string): string {
  // Keep existing Korean/English headings; Arabic must not use their fallback.
  if (topics[id] && (language === 'ar' || ['grounds', 'harm', 'fear'].includes(id))) return titleFor(topics[id], language);
  return language === 'ar' && !/[\p{Script=Arabic}]/u.test(fallback) ? ar.fieldDetails : fallback;
}
export function journeyDetailTitle(id: string, fallback: string, language: string): string {
  const special: Record<string, LocalizedTitle> = { harm: { ko: '과거 피해 여부', en: 'Have you experienced harm?', ar: 'هل تعرضت للأذى في الماضي؟' }, fear: { ko: '귀국 시 우려 여부', en: 'Are you afraid of returning?', ar: 'هل تخشى العودة؟' }, 'fear.harm': { ko: '걱정되는 일', en: 'What you fear', ar: 'ما الذي تخشاه' } };
  if (special[id]) return titleFor(special[id], language);
  const suffix = id.split('.').at(-1) ?? '';
  if (details[suffix]) return titleFor(details[suffix], language);
  const requirement = requirementsById.get(id);
  const result = requirement ? localizedRequirementLabel(requirement, language) : fallback;
  return language === 'ar' && !/[\p{Script=Arabic}]/u.test(result) ? ar.fieldDetails : result;
}
export function journeyStatusLabel(status: string, language: string): string {
  const copy = journeyCopyFor(language);
  const keys = ['answered', 'unknown', 'skipped', 'not_applicable', 'conflict', 'missing', 'blocked'] as const;
  const key = keys.find(item => item === status);
  return key ? copy[key] : copy.conflict;
}
