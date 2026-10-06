import { applicationSteps, type FormField, type VisibleWhen } from '../form/schema.ts';

export type IntakeScope = 'priority' | 'full';
export type Requirement = {
  id: string;
  questionId: string;
  label: string;
  labelEn: string;
  type: FormField['type'];
  when?: VisibleWhen[];
  options?: { value: string; ko: string; en: string }[];
  parentId?: string;
  repeatable: boolean;
  collection: 'conversation' | 'direct' | 'personal_confirmation';
  reviewNote?: string;
};

const details: Record<string, [string, string, string][]> = {
  '14.2-detail': [
    ['event', '어떤 일이 있었고 어떤 피해·위협을 받았는지', 'What happened and what harm or threat occurred'],
    ['time', '사건 시점과 날짜의 불확실성', 'When it happened, retaining approximate dates'],
    ['actor', '행위자와 그 사람을 알게 된 경위', 'Who acted and how the applicant knows their identity'],
    ['place', '사건이 일어난 장소', 'Where the incident occurred'],
    ['reason', '그 일이 일어난 이유라고 생각하는 내용과 근거', 'Believed reason and basis for that belief'],
    ['release', '구금되었다면 풀려난 경위, 아니면 해당 없음', 'How and why released if detained, otherwise not applicable'],
  ],
  '14.3-detail': [
    ['harm', '귀국 시 두려워하는 피해', 'Harm feared on return'],
    ['actor', '피해를 줄 것이라고 생각하는 사람이나 기관', 'Who the applicant fears would harm them'],
    ['reason', '그렇게 생각하는 이유와 알게 된 경위', 'Reasons for that fear and how the applicant knows'],
  ],
  '14.4-detail': [
    ['person', '피해를 받은 사람과 신청인과의 관계', 'Affected person and their relationship to the applicant'],
    ['event', '가족 또는 친구에게 일어난 피해', 'Harm that happened to the family member or friend'],
    ['time', '사건 시점', 'When the incident occurred'],
    ['actor', '피해를 준 사람이나 기관', 'Person or authority responsible'],
    ['reason', '피해를 받은 이유와 그렇게 알게 된 경위', 'Believed reason and source of that knowledge'],
    ['place', '사건 장소', 'Where the incident occurred'],
    ['release', '구금되었다면 풀려난 경위', 'How and why released if detained; otherwise not applicable'],
  ],
  '14.5-yes': [
    ['authority', '보호를 요청한 사람 또는 기관', 'Whom the applicant approached for protection'],
    ['measures', '보호 요청을 위해 취한 조치', 'Measures taken to request protection'],
    ['result', '보호 요청의 결과', 'Outcome of the request'],
    ['time', '보호를 요청한 시점', 'When protection was requested'],
    ['place', '보호를 요청한 장소', 'Where protection was requested'],
  ],
  '14.5-no': [['reason', '보호를 요청하지 않은 이유', 'Reason for not requesting protection']],
  '14.6-yes': [
    ['time', '피신한 시점', 'When the applicant fled internally'],
    ['destination', '피신한 지역', 'Place to which the applicant fled'],
    ['leaving_reason', '피신한 지역을 떠난 이유', 'Why the applicant left that region'],
    ['elsewhere', '다른 지역에서도 살 수 없었던 이유', 'Why the applicant could not live there or elsewhere in the country'],
  ],
  '14.6-no': [['reason', '다른 지역으로 피신하지 않은 이유', 'Reason for not relocating within the country']],
  '14.9-detail': [
    ['time', '관련 활동을 한 시점', 'When the activity took place'],
    ['place', '관련 활동을 한 장소', 'Where the activity took place'],
    ['activity', '실제로 한 활동과 역할', 'Actual activity and the applicant role'],
  ],
  '14.15-yes': [
    ['person', '연락하는 가족', 'Family members in contact'],
    ['method', '가족과의 연락 방법', 'Method of contact'],
    ['frequency', '가족과의 연락 빈도', 'Frequency of contact'],
  ],
  '14.15-no': [['reason', '가족과 연락하지 않는 이유', 'Reason for no contact with family']],
  '14.17': [
    ['time', '신청 절차를 알게 된 시점', 'When the applicant learned about the procedure'],
    ['place', '신청 절차를 알게 된 장소', 'Where the applicant learned about the procedure'],
    ['person', '신청 절차를 알려 준 사람 또는 기관', 'Who provided the information'],
  ],
  '14.18': [['reason', '입국 1년이 지난 뒤 신청하게 된 이유', 'Reason for applying more than one year after arrival']],
};

/** Field IDs are taken from the checked-in official-form schema, never invented by the model.
 * Narrative subfields are collection aids; their parent is the actual form destination. */
const formRequirements: Requirement[] = applicationSteps.flatMap(step => step.fields.flatMap(field => {
  const base: Requirement = {
    id: field.id, questionId: field.id.split('-')[0], label: field.ko, labelEn: field.en,
    type: field.type, when: field.id === '14.18' ? [{ id: '14.18-applicable', anyOf: ['yes'] }] : field.when, options: field.options,
    repeatable: field.type === 'table',
    collection: field.id.startsWith('16.') ? 'personal_confirmation' : field.type === 'long' ? 'conversation' : 'direct',
    reviewNote: field.id === '14.14' ? 'Korean form says age 10 or younger; English says under 10. Age threshold needs expert confirmation; do not infer non-applicability for a 10-year-old.' : undefined,
  };
  const columns: Requirement[] = (field.columns ?? []).map(column => ({
    id: `${field.id}.${column.id}`, questionId: base.questionId,
    label: `${field.ko} / ${column.ko}`, labelEn: `${field.en} / ${column.en}`,
    type: column.kind === 'date' ? 'date' : 'short', parentId: field.id,
    when: field.when, repeatable: true, collection: 'direct',
  }));
  const parts: Requirement[] = (details[field.id] ?? []).map(([id, label, labelEn]) => ({
    id: `${field.id}.${id}`, questionId: base.questionId, label, labelEn, type: 'long',
    parentId: field.id, when: base.when,
    repeatable: ['14.2-detail', '14.4-detail', '14.5-yes', '14.6-yes', '14.9-detail', '14.15-yes'].includes(field.id), collection: 'conversation',
  }));
  return [base, ...columns, ...parts];
}));

const manualRequirements: Requirement[] = [
  ['helper.role', '작성 보조자의 역할', 'Role of the person assisting with the application'],
  ['helper.name', '작성 보조자의 성명', 'Name of the person assisting'],
  ['helper.birth', '작성 보조자의 생년월일', 'Date of birth of the person assisting'],
  ['helper.address', '작성 보조자의 주소', 'Address of the person assisting'],
  ['helper.contact', '작성 보조자의 연락처', 'Contact details of the person assisting'],
  ['helper.signature', '작성 보조자의 서약과 직접 서명', 'Assistant declaration and personal signature'],
  ['submission.applicant', '제출란 신청인 성명', 'Applicant name in the submission block'],
  ['submission.date', '신청일자', 'Application date'],
  ['submission.office', '신청서 수신 관서', 'Receiving immigration office'],
  ['submission.attachments', '실제로 제출할 첨부서류', 'Documents actually attached to the application'],
  ['submission.signature', '신청인 서약 확인과 직접 서명', 'Applicant declaration and personal signature'],
].map(([id, label, labelEn]) => ({
  id, questionId: id.startsWith('helper.') ? 'helper' : 'submission', label, labelEn,
  type: 'short', repeatable: false, collection: 'personal_confirmation',
}));

const lateApplicationGate: Requirement = {
  id: '14.18-applicable', questionId: '14.18', label: '입국한 지 1년이 지난 뒤 난민인정을 신청하는 경우인지 확인',
  labelEn: 'Confirm whether the application is being made more than one year after arrival; retain uncertainty about dates',
  type: 'single', options: [{ value: 'yes', ko: '예', en: 'Yes' }, { value: 'no', ko: '아니요', en: 'No' }],
  repeatable: false, collection: 'direct',
};

export const requirementCatalog: Requirement[] = [...formRequirements, lateApplicationGate, ...manualRequirements];

export const requirementsById = new Map(requirementCatalog.map(item => [item.id, item]));
export function requirementsForScope(scope: IntakeScope): Requirement[] {
  return requirementCatalog.filter(item => scope === 'full' || ['14.1', '14.2', '14.3'].includes(item.questionId));
}
