import { applicationSteps, type FormField, type VisibleWhen } from '../form/schema.ts';
import { metadata14 } from './metadata14.ts';

export type IntakeScope = 'priority' | 'full' | 'test';
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
  /** Applicant's own yes/no for a group of question 14 metadata. */
  gate?: boolean;
  /** Applies only to incidents/entries whose sibling field (same eventId) has one of these values. */
  whenEvent?: VisibleWhen;
  /** Gate whose entries are asked one by one like table rows (organizations, evidence, ...). */
  rows?: boolean;
};

/** Field IDs are taken from the checked-in official-form schema, never invented by the model.
 * Question 14 is not collected box by box: see metadata14.ts. */
const isQuestion14 = (field: FormField) => field.id.startsWith('14');
const formRequirement = (field: FormField): Requirement[] => {
  const base: Requirement = {
    id: field.id, questionId: field.id.split('-')[0], label: field.ko, labelEn: field.en,
    type: field.type, when: field.when, options: field.options,
    repeatable: field.type === 'table',
    collection: field.id.startsWith('16.') ? 'personal_confirmation' : field.type === 'long' ? 'conversation' : 'direct',
  };
  const columns: Requirement[] = (field.columns ?? []).map(column => ({
    id: `${field.id}.${column.id}`, questionId: base.questionId,
    label: `${field.ko} / ${column.ko}`, labelEn: `${field.en} / ${column.en}`,
    type: column.kind === 'date' ? 'date' : 'short', parentId: field.id,
    when: field.when, repeatable: true, collection: 'direct',
  }));
  return [base, ...columns];
};
const allFields = applicationSteps.flatMap(step => step.fields);
const firstAfter14 = allFields.findIndex((field, index) => index > 0 && isQuestion14(allFields[index - 1]) && !isQuestion14(field));
const formBefore14 = allFields.filter((field, index) => !isQuestion14(field) && index < firstAfter14).flatMap(formRequirement);
const formAfter14 = allFields.filter((field, index) => !isQuestion14(field) && index >= firstAfter14).flatMap(formRequirement);

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

// Gates and the 14.1/14.7 answers are asked with the official question of their 14.x item.
const officialQuestion: Record<string, string> = { 'grounds.category': '14.1', 'departure.date': '14.7' };
const gates14 = metadata14.map(item => {
  const official = item.gate ? allFields.find(field => field.id === item.questionId && field.type === 'single')
    : allFields.find(field => field.id === officialQuestion[item.id]);
  return official ? { ...item, label: official.ko, labelEn: official.en } : item;
});

export const requirementCatalog: Requirement[] = [...formBefore14, ...gates14, ...formAfter14, ...manualRequirements];

/** Only question 14 (the persecution account) is collected through free LLM conversation. */
export function isNarrative(requirement: Requirement): boolean {
  return requirement.questionId === '14' || requirement.questionId.startsWith('14.');
}

/** Questions 1–13 (identity, family, travel, stay) are collected with a form, not in conversation. */
export function isFormSection(id: string): boolean {
  const section = Number(id.split(/[.-]/)[0]);
  return Number.isInteger(section) && section >= 1 && section <= 13;
}

export const requirementsById = new Map(requirementCatalog.map(item => [item.id, item]));
export function requirementsForScope(scope: IntakeScope): Requirement[] {
  if (scope === 'test') return requirementCatalog.filter(item => testRequirementIds.includes(item.id));
  return requirementCatalog.filter(item => scope === 'full' || ['14.1', '14.2', '14.3'].includes(item.questionId));
}

export const testRequirementIds = ['grounds.summary', 'harm', 'harm.event', 'harm.type', 'harm.time', 'harm.place', 'harm.actor', 'harm.reason', 'fear', 'fear.harm', 'fear.actor', 'fear.reason'];
