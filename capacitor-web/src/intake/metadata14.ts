import type { Requirement } from './catalog.ts';

/** Metadata collected in conversation to fill question 14. It describes the
 * applicant's account (incidents, people, fears), not the form's boxes; the
 * 14.x answers are derived from it (see derive14.ts) or drafted from it.
 *
 * A gate (e.g. `harm`) records the applicant's own yes/no; its children are
 * the details. Children of a repeatable group are stored per incident/entry
 * with an `eventId`, so facts of different incidents never mix. */

type Option = { value: string; ko: string; en: string };
const yesNo: Option[] = [{ value: 'yes', ko: '예', en: 'Yes' }, { value: 'no', ko: '아니요', en: 'No' }];
const harmTypes: Option[] = [
  { value: 'questioning', ko: '조사·심문', en: 'Questioning or investigation' },
  { value: 'threat', ko: '위협', en: 'Threats' },
  { value: 'assault', ko: '폭행', en: 'Assault' },
  { value: 'arrest', ko: '체포', en: 'Arrest' },
  { value: 'detention', ko: '구금', en: 'Detention' },
  { value: 'other', ko: '기타', en: 'Other' },
];
const grounds: Option[] = [
  { value: 'race', ko: '인종', en: 'Race' }, { value: 'religion', ko: '종교', en: 'Religion' },
  { value: 'nationality', ko: '국적', en: 'Nationality' }, { value: 'political', ko: '정치적 의견', en: 'Political opinion' },
  { value: 'social', ko: '특정사회집단의 구성원 신분', en: 'Membership of a particular social group' },
  { value: 'family', ko: '가족결합', en: 'Family unity' }, { value: 'other', ko: '기타', en: 'Others' },
];
const childRoles: Option[] = [
  { value: 'both_parents', ko: '아이의 부모이고 다른 부모도 한국에 있음', en: 'Parent; the other parent is also in Korea' },
  { value: 'not_parent', ko: '아이의 부모가 아님', en: 'Not the child’s parent' },
  { value: 'other_away', ko: '아이의 부모이고 다른 부모는 한국에 없음', en: 'Parent; the other parent is not in Korea' },
];
const detained = { id: '', anyOf: ['arrest', 'detention'] };

type Field = [id: string, ko: string, en: string, type?: Requirement['type'], extra?: Partial<Requirement>];
type Group = {
  id: string; questionId: string; ko: string; en: string;
  /** Gate with yes/no; omitted for groups that are always applicable. */
  gate?: boolean; repeatable?: boolean;
  /** Details asked when the gate is yes (or always, without a gate). */
  fields: Field[];
  /** Details asked when the gate is no (e.g. why no protection was sought). */
  whenNo?: Field[];
  /** Question for the gate's direct follow-up; chat and table entries may also be asked one by one. */
  direct?: boolean;
};

const groups: Group[] = [
  { id: 'grounds', questionId: '14.1', ko: '신청 사유', en: 'Grounds for the application', fields: [
    ['category', '신청자가 직접 고른 신청 사유', 'Grounds the applicant chose (never inferred)', 'multi', { options: grounds, collection: 'direct' }],
    ['identity', '관련된 정체성이나 특성(종교, 정치 성향, 민족, 집단 등)', 'Related identity or characteristic (religion, political opinion, ethnicity, group)'],
    ['perceived', '박해자가 그 특성을 알게 되었거나 그렇게 여긴다고 생각하는 경위', 'How the persecutor knows or perceives that characteristic'],
    ['summary', '신청인이 직접 말한 신청 사유 요약(사건의 날짜·장소 같은 상세는 제외)', 'The applicant’s own short summary of why they seek protection; reasons only, no incident dates, places or details (those belong to harm)'],
  ] },
  { id: 'harm', questionId: '14.2', ko: '본인이 과거에 겪은 피해', en: 'Past harm done TO the applicant (questioning, threats, assault, arrest, detention)', gate: true, repeatable: true, fields: [
    ['event', '무슨 일이 있었는지', 'What happened'],
    ['type', '피해 유형', 'Kind of harm', 'multi', { options: harmTypes, collection: 'direct' }],
    ['time', '시점(대략적인 시기나 모름도 그대로)', 'When (keep approximate or unknown dates as said)', 'short'],
    ['place', '장소', 'Where', 'short'],
    ['actor', '행위자, 소속과 그 신원을 알게 된 경위', 'Who did it, their affiliation, and how the applicant knows'],
    ['reason', '그 일이 일어난 이유라고 생각하는 것과 근거', 'Why the applicant believes it happened, and on what basis'],
    ['release', '구금 기간과 풀려난 방법·이유', 'Length of detention and how/why released', 'long', { whenEvent: { ...detained, id: 'harm.type' } }],
    ['result', '부상이나 이후의 영향', 'Injuries or later consequences'],
  ] },
  { id: 'fear', questionId: '14.3', ko: '귀국 시 우려', en: 'Fear on return', gate: true, fields: [
    ['harm', '두려워하는 피해', 'Harm feared on return'],
    ['actor', '피해를 줄 것이라고 생각하는 사람이나 기관', 'Who the applicant fears would harm them'],
    ['reason', '그렇게 생각하는 이유(수배, 가족 방문, 지속적인 위협 등)와 알게 된 경위', 'Why they fear this (searches, visits to family, ongoing threats) and how they know'],
  ] },
  { id: 'family_harm', questionId: '14.4', ko: '가족이나 친구가 겪은 피해', en: 'Harm that the applicant’s family members or friends suffered (they were the victims)', gate: true, repeatable: true, fields: [
    ['person', '피해를 겪은 사람과 신청인과의 관계', 'Who was harmed and their relationship to the applicant', 'short'],
    ['event', '무슨 일이 있었는지', 'What happened'],
    ['type', '피해 유형', 'Kind of harm', 'multi', { options: harmTypes, collection: 'direct' }],
    ['time', '시점', 'When', 'short'],
    ['place', '장소', 'Where', 'short'],
    ['actor', '행위자', 'Who did it'],
    ['reason', '이유와 신청인이 그것을 알게 된 경위(직접 봄/전해 들음)', 'Why, and how the applicant knows (saw it / heard about it)'],
    ['release', '구금 기간과 풀려난 방법·이유', 'Length of detention and how/why released', 'long', { whenEvent: { ...detained, id: 'family_harm.type' } }],
  ] },
  { id: 'protection', questionId: '14.5', ko: '본국에 보호를 요청한 일', en: 'Requests for protection at home', gate: true, repeatable: true, fields: [
    ['authority', '요청한 사람이나 기관', 'Whom the applicant asked', 'short'],
    ['measures', '취한 조치', 'What they did'],
    ['time', '시점', 'When', 'short'],
    ['place', '장소', 'Where', 'short'],
    ['result', '결과', 'What happened as a result'],
  ], whenNo: [['no_reason', '보호를 요청하지 않은 이유', 'Why no protection was requested']] },
  { id: 'relocation', questionId: '14.6', ko: '본국 안 다른 지역으로의 피신', en: 'Moving elsewhere in the country for safety', gate: true, repeatable: true, fields: [
    ['time', '피신한 시점과 기간', 'When and for how long', 'short'],
    ['destination', '피신한 지역', 'Where they went', 'short'],
    ['left_reason', '그 지역을 떠난 이유', 'Why they left that place'],
    ['elsewhere', '본국의 다른 지역에서도 살 수 없었던 이유', 'Why they could not live there or elsewhere in the country'],
  ], whenNo: [['no_reason', '다른 지역으로 피신하지 않은 이유', 'Why they did not move elsewhere']] },
  { id: 'departure', questionId: '14.7', ko: '본국 출국', en: 'Leaving the country', fields: [
    ['date', '본국을 떠난 날짜', 'Date the applicant left the country', 'date', { collection: 'direct' }],
  ] },
  { id: 'org', questionId: '14.8', ko: '본인이나 가족의 단체 가입·활동', en: 'Membership or activity in organizations (applicant or family)', gate: true, repeatable: true, direct: true, fields: [
    ['name', '성명(본인 또는 가족)', 'Name (applicant or family member)', 'short'],
    ['relationship', '신청인과의 관계', 'Relationship to the applicant', 'short'],
    ['period', '활동 기간', 'Period', 'short'],
    ['org', '단체명', 'Organization', 'short'],
    ['role', '역할과 활동 내용', 'Role and activities', 'short'],
  ] },
  { id: 'activity', questionId: '14.9', ko: '본국 정부나 단체에 반대하는 활동(한국 입국 후 포함)', en: 'Activities the applicant THEMSELVES carried out against the government or a group (protests, publishing), including in Korea; not harm done to them', gate: true, repeatable: true, fields: [
    ['time', '시점', 'When', 'short'],
    ['place', '장소', 'Where', 'short'],
    ['content', '실제로 한 활동과 역할', 'What the applicant actually did'],
  ] },
  { id: 'criminal', questionId: '14.10', ko: '범죄로 체포되거나 처벌받은 일', en: 'Arrest or punishment for a criminal offense', gate: true, repeatable: true, direct: true, fields: [
    ['date', '날짜', 'Date', 'date'],
    ['country', '국가', 'Country', 'short'],
    ['offense', '혐의(죄명)', 'Offense charged', 'short'],
    ['punishment', '처벌 내용', 'Punishment', 'short'],
    ['related', '앞에서 말한 피해 사건과 같은 일인지', 'Whether this is one of the incidents of harm described', 'short'],
  ] },
  { id: 'other_app', questionId: '14.11', ko: '다른 나라나 UNHCR에 한 난민 신청', en: 'Refugee applications elsewhere or at UNHCR', gate: true, repeatable: true, direct: true, fields: [
    ['person', '신청한 사람(관계)', 'Who applied (relationship)', 'short'],
    ['date', '신청일', 'Date of application', 'date'],
    ['country', '신청 국가 또는 UNHCR', 'Country or UNHCR', 'short'],
    ['decision', '결과(인정, 불허 등)', 'Decision (recognized, rejected, ...)', 'short'],
    ['cancel', '취소·철회 여부', 'Whether cancelled or withdrawn', 'short'],
    ['left_reason', '난민으로 인정받았다면 그 나라를 떠난 이유', 'If recognized, why they left that country', 'long', { questionId: '14.12' }],
  ] },
  { id: 'minor', questionId: '14.13', ko: '함께 신청한 19세 미만 자녀', en: 'Children under 19 applying with the applicant', gate: true, repeatable: true, fields: [
    ['age', '자녀 나이', 'Child’s age', 'short', { collection: 'direct' }],
    ['role', '아이와의 관계', 'Relationship to the child', 'single', { options: childRoles, collection: 'direct' }],
    ['docs', '아이를 돌보거나 함께 여행하는 것을 허락한 서류가 있는지', 'Whether there is a document allowing care of or travel with the child', 'single', { options: yesNo, collection: 'direct', whenEvent: { id: 'minor.role', anyOf: ['not_parent', 'other_away'] } }],
    ['docs_detail', '어떤 서류인지, 없다면 그 이유', 'Which document, or why there is none', 'long', { whenEvent: { id: 'minor.role', anyOf: ['not_parent', 'other_away'] } }],
    ['child_risk', '(10세 이하) 신청인 사유와 별개로 자녀에게만 있는 위험', '(Age 10 or under) risk specific to the child, separate from the applicant’s own', 'long', { questionId: '14.14',
      reviewNote: 'Korean form says age 10 or younger; English says under 10. Ask only when the child is that young; never infer non-applicability for a 10-year-old.' }],
  ] },
  { id: 'contact', questionId: '14.15', ko: '본국에 있는 가족과의 연락', en: 'Contact with family at home', gate: true, fields: [
    ['who', '연락하는 가족', 'Which family members', 'short'],
    ['method', '연락 방법', 'How', 'short'],
    ['frequency', '연락 빈도', 'How often', 'short'],
  ], whenNo: [['no_reason', '연락하지 않는 이유', 'Why there is no contact']] },
  { id: 'evidence', questionId: '14.16', ko: '신청 사유를 뒷받침하는 서류나 증거', en: 'Documents or evidence', gate: true, repeatable: true, direct: true, fields: [
    ['name', '서류 이름', 'Document', 'short'],
    ['content', '내용', 'What it shows', 'short'],
    ['method', '얻은 경로', 'How it was obtained', 'short'],
    ['when', '제출 예정 시기', 'When it will be submitted', 'short'],
  ] },
  { id: 'learned', questionId: '14.17', ko: '한국의 난민 신청 절차를 알게 된 경위', en: 'How the applicant learned about the procedure', direct: true, fields: [
    ['time', '알게 된 시점', 'When', 'short'],
    ['place', '알게 된 장소', 'Where', 'short'],
    ['person', '알려 준 사람이나 기관', 'From whom', 'short'],
  ] },
  { id: 'late', questionId: '14.18', ko: '한국에 입국한 지 1년이 지난 뒤에 난민인정을 신청하는 것인가요?', en: 'Are you applying more than one year after you arrived in Korea?', gate: true, fields: [
    ['reason', '1년이 지난 뒤 신청하게 된 이유', 'Why the application is made more than a year after arrival'],
  ] },
];

function field(group: Group, [id, ko, en, type = 'long', extra = {}]: Field, when?: Requirement['when']): Requirement {
  const whenEvent = extra.whenEvent;
  return {
    id: `${group.id}.${id}`, questionId: extra.questionId ?? group.questionId,
    label: ko, labelEn: en, type, options: extra.options,
    parentId: group.gate ? group.id : undefined, when,
    repeatable: !!group.repeatable,
    // Short entries of table-like groups and choices can be asked one by one after
    // the free conversation; narrative details are only collected in conversation.
    collection: extra.collection ?? (group.direct && type !== 'long' ? 'direct' : 'conversation'),
    reviewNote: extra.reviewNote, whenEvent,
  };
}

export const metadata14: Requirement[] = groups.flatMap(group => {
  const gate: Requirement[] = group.gate ? [{
    id: group.id, questionId: group.questionId, label: group.ko, labelEn: `${group.en} (yes/no)`,
    type: 'single', options: yesNo, repeatable: false, collection: 'direct', gate: true, rows: !!(group.direct && group.repeatable),
  }] : [];
  return [
    ...gate,
    ...group.fields.map(item => field(group, item, group.gate ? [{ id: group.id, anyOf: ['yes'] }] : undefined)),
    ...(group.whenNo ?? []).map(item => ({ ...field(group, item, [{ id: group.id, anyOf: ['no'] }]), repeatable: false })),
  ];
});

export const metadataGroups = groups.map(({ id, questionId, ko, en, gate, repeatable }) => ({ id, questionId, ko, en, gate: !!gate, repeatable: !!repeatable }));
