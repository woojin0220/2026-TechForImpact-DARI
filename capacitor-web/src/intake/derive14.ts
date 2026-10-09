import { applicationSteps, type FormField } from '../form/schema.ts';
import type { FormAnswers, FormValue } from './form.ts';
import { getActiveFacts } from './index.ts';
import { requirementsById } from './catalog.ts';
import type { IntakeFact, IntakeSession } from './types.ts';

/** A question 14 box filled from metadata. Narrative boxes (14.x details) are not
 * derived here; the Korean draft writes them from the same metadata. */
export type Derived14 = { id: string; label: string; value: string; rows?: Record<string, string>[]; needsReview?: boolean; factIds: string[] };

const officialFields = new Map(applicationSteps.flatMap(step => step.fields).map(field => [field.id, field]));
const statusKo: Record<string, string> = { unknown: '모름', skipped: '답변 보류', not_applicable: '해당 없음', conflict: '다시 확인 필요' };

function koValue(fact: IntakeFact): string {
  const options = requirementsById.get(fact.requirementId)?.options ?? [];
  const value = (Array.isArray(fact.value) ? fact.value : [fact.value]).map(item => options.find(option => option.value === item)?.ko ?? item).join(', ');
  return fact.status === 'answered' ? value : `${statusKo[fact.status] ?? fact.status} (${value})`;
}

/** Yes/no from the applicant's gate answer and the incidents they described.
 * A "no" alongside described incidents is a contradiction for the applicant to resolve. */
function gate(id: string, facts: IntakeFact[]): { value: string; needsReview?: boolean; factIds: string[] } | undefined {
  const own = facts.filter(fact => fact.requirementId === id);
  const details = facts.filter(fact => requirementsById.get(fact.requirementId)?.parentId === id && requirementsById.get(fact.requirementId)?.repeatable && fact.status === 'answered');
  const said = own.find(fact => fact.status === 'answered')?.value;
  const factIds = [...own, ...details].map(fact => fact.id);
  const answers = new Set(own.filter(fact => fact.status === 'answered').flatMap(fact => Array.isArray(fact.value) ? fact.value : [fact.value]));
  if (own.some(fact => fact.status === 'conflict') || answers.size > 1) {
    return { value: '다시 확인 필요 (서로 다른 답변이 있음)', needsReview: true, factIds };
  }
  if (said === 'no' && details.length) return { value: '다시 확인 필요 (아니요라고 답했지만 관련 내용이 있음)', needsReview: true, factIds };
  if (said === 'yes' || details.length) return { value: '예', factIds };
  if (said === 'no') return { value: '아니요', factIds };
  if (own.length) return { value: koValue(own[0]), needsReview: own[0].status === 'conflict', factIds };
  return undefined;
}

/** Rows of a table-like group, one per incident/entry, mapped to the official columns. */
function rows(group: string, columns: Record<string, string>, facts: IntakeFact[]) {
  const entries = facts.filter(fact => requirementsById.get(fact.requirementId)?.parentId === group && fact.eventId);
  const ids = [...new Set(entries.map(fact => fact.eventId!))];
  return {
    rows: ids.map(eventId => Object.fromEntries(Object.entries(columns).map(([column, field]) => {
      const fact = entries.find(item => item.eventId === eventId && item.requirementId === `${group}.${field}`);
      return [column, fact ? koValue(fact) : ''];
    }))),
    factIds: entries.map(fact => fact.id),
  };
}

const gates: [questionId: string, group: string][] = [
  ['14.2', 'harm'], ['14.3', 'fear'], ['14.4', 'family_harm'], ['14.5', 'protection'], ['14.6', 'relocation'],
  ['14.8', 'org'], ['14.9', 'activity'], ['14.10', 'criminal'], ['14.11', 'other_app'], ['14.13', 'minor'],
  ['14.15', 'contact'], ['14.16', 'evidence'],
];
const tables: [tableId: string, group: string, columns: Record<string, string>][] = [
  ['14.8-table', 'org', { name: 'name', relationship: 'relationship', period: 'period', org: 'org', role: 'role' }],
  ['14.10-table', 'criminal', { date: 'date', offense: 'offense', punishment: 'punishment' }],
  ['14.11-table', 'other_app', { name: 'person', date: 'date', country: 'country', decision: 'decision', cancel: 'cancel' }],
  ['14.16-table', 'evidence', { name: 'name', content: 'content', method: 'method', when: 'when' }],
];

export function deriveQuestion14(session: IntakeSession): Derived14[] {
  const facts = getActiveFacts(session).filter(fact => fact.status !== 'conflict' || requirementsById.get(fact.requirementId)?.gate);
  const label = (id: string) => officialFields.get(id)?.ko ?? id;
  const find = (id: string) => facts.filter(fact => fact.requirementId === id);
  const result: Derived14[] = [];
  const category = find('grounds.category')[0];
  if (category) result.push({ id: '14.1', label: label('14.1'), value: koValue(category), factIds: [category.id] });
  for (const [questionId, group] of gates) {
    const answer = gate(group, facts);
    if (answer) result.push({ id: questionId, label: label(questionId), ...answer });
  }
  const departure = find('departure.date')[0];
  if (departure) result.push({ id: '14.7', label: label('14.7'), value: koValue(departure), factIds: [departure.id] });
  for (const [tableId, group, columns] of tables) {
    const table = rows(group, columns, facts);
    if (table.rows.length) result.push({ id: tableId, label: label(tableId), value: `${table.rows.length}행`, rows: table.rows, factIds: table.factIds });
  }
  // Relationship to accompanying children: the form has one answer; differing children need review.
  const roles = [...new Set(find('minor.role').map(koValue))];
  if (roles.length) result.push({ id: '14.13-role', label: label('14.13-role'), value: roles.join(' / '), needsReview: roles.length > 1, factIds: find('minor.role').map(fact => fact.id) });
  const learned = ['time', 'place', 'person'].map(part => find(`learned.${part}`)[0]).filter(Boolean);
  if (learned.length) result.push({ id: '14.17', label: label('14.17'), value: learned.map(fact => `${requirementsById.get(fact.requirementId)!.label}: ${koValue(fact)}`).join(' / '), factIds: learned.map(fact => fact.id) });
  const late = gate('late', facts);
  if (late) result.push({ id: '14.18-applicable', label: '입국 1년 후 신청 여부', ...late });
  return result.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Official question 14 steps of the form, in order (14.1 … 14.18). */
export const question14Steps = applicationSteps.filter(step => step.fields.every(field => field.id.startsWith('14')));

const choiceOf = (answers: FormAnswers, id: string) => { const answer = answers[id]; return answer?.kind === 'choice' ? answer.values[0] : undefined; };
/** The narrative box a drafted section (by metadata question) is written into. */
export function narrativeFieldFor(questionId: string, answers: FormAnswers): string {
  switch (questionId) {
    case '14.5': return choiceOf(answers, '14.5') === 'no' ? '14.5-no' : '14.5-yes';
    case '14.6': return choiceOf(answers, '14.6') === 'no' ? '14.6-no' : '14.6-yes';
    case '14.15': return choiceOf(answers, '14.15') === 'no' ? '14.15-no' : '14.15-yes';
    case '14.13': return choiceOf(answers, '14.13-role') === 'other_away' ? '14.13-away-detail' : '14.13-not-detail';
    case '14.12': case '14.14': case '14.17': case '14.18': return questionId;
    default: return `${questionId}-detail`;
  }
}

/** Fill every question 14 box from metadata (choices, tables, dates) and the Korean
 * draft (narratives). The applicant edits this result; metadata stays unchanged. */
export function buildQuestion14Answers(session: IntakeSession): FormAnswers {
  const answers: FormAnswers = {};
  const facts = getActiveFacts(session);
  const derived = new Map(deriveQuestion14(session).map(item => [item.id, item]));
  for (const [questionId] of gates) {
    const value = derived.get(questionId)?.value;
    if (value === '예' || value === '아니요') answers[questionId] = { kind: 'choice', values: [value === '예' ? 'yes' : 'no'] };
  }
  const category = facts.find(fact => fact.requirementId === 'grounds.category' && fact.status === 'answered');
  if (category) answers['14.1'] = { kind: 'choice', values: Array.isArray(category.value) ? category.value : [category.value] };
  const departure = facts.find(fact => fact.requirementId === 'departure.date' && fact.status === 'answered');
  if (departure) answers['14.7'] = { kind: 'text', text: String(departure.value) };
  for (const [tableId] of tables) {
    const rows = derived.get(tableId)?.rows;
    if (rows?.length) answers[tableId] = { kind: 'table', rows };
  }
  const role = facts.find(fact => fact.requirementId === 'minor.role' && fact.status === 'answered');
  if (role) {
    answers['14.13-role'] = { kind: 'choice', values: [String(role.value)] };
    const docs = facts.find(fact => fact.requirementId === 'minor.docs' && fact.status === 'answered');
    if (docs) answers[role.value === 'other_away' ? '14.13-away-docs' : '14.13-not-docs'] = { kind: 'choice', values: [String(docs.value)] };
  }
  const learned = derived.get('14.17');
  if (learned) answers['14.17'] = { kind: 'text', text: learned.value };
  for (const section of session.draft) answers[narrativeFieldFor(section.questionId, answers)] = { kind: 'text', text: section.text };
  return answers;
}

/** Plain-text rendering of one answered box, with Korean option labels. */
export function formatFormAnswer(field: FormField, value: FormValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'status') return value.status === 'unknown' ? '모름' : '해당 없음';
  if (value.kind === 'choice') return value.values.map(item => field.options?.find(option => option.value === item)?.ko ?? item).join(', ');
  if (value.kind === 'table') return value.rows.length ? value.rows.map((row, index) => `${index + 1}. ${(field.columns ?? []).map(column => `${column.ko}: ${row[column.id] ?? ''}`).join(' / ')}`).join('\n') : '없음';
  return value.text;
}
