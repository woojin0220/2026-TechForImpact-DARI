import { applicationSteps, type FormField, type FormStep } from '../form/schema.ts';
import { calculateCoverage, getActiveFacts, invalidateDraft, nextFactId } from './index.ts';
import { isFormSection, requirementsById } from './catalog.ts';
import type { FactStatus, IntakeFact, IntakeSession } from './types.ts';

/** Form answers for questions 1–13. `rows: []` means the applicant said the table is empty. */
export type FormValue =
  | { kind: 'choice'; values: string[] }
  | { kind: 'text'; text: string }
  | { kind: 'table'; rows: Record<string, string>[] }
  | { kind: 'status'; status: 'unknown' | 'not_applicable' };
export type FormAnswers = Record<string, FormValue>;

export const FORM_SOURCE_ID = 'form';
export const formSteps: FormStep[] = applicationSteps.filter(step => step.fields.every(field => isFormSection(field.id)));
const fields = new Map(formSteps.flatMap(step => step.fields).map(field => [field.id, field]));

export function isFieldVisible(field: FormField, answers: FormAnswers, seen = new Set<string>()): boolean {
  if (!field.when?.length) return true;
  if (seen.has(field.id)) return false;
  seen.add(field.id);
  return field.when.every(rule => {
    const parent = fields.get(rule.id);
    if (parent && !isFieldVisible(parent, answers, seen)) return false;
    const answer = answers[rule.id];
    return answer?.kind === 'choice' && rule.anyOf.some(value => answer.values.includes(value));
  });
}

type Desired = { requirementId: string; eventId?: string; value: string | string[]; status: FactStatus; quote: string };

function optionLabels(field: FormField, values: string[]) {
  return values.map(value => field.options?.find(option => option.value === value)?.ko ?? value).join(', ');
}

/** Turn visible, filled form fields into fact candidates. Empty or hidden fields stay missing. */
function desiredFacts(answers: FormAnswers): Desired[] {
  const result: Desired[] = [];
  for (const field of fields.values()) {
    const answer = answers[field.id];
    if (!answer || !isFieldVisible(field, answers)) continue;
    if (answer.kind === 'status') {
      const quote = answer.status === 'unknown' ? '모름' : '해당 없음';
      result.push({ requirementId: field.id, value: quote, status: answer.status, quote });
    } else if (answer.kind === 'choice' && answer.values.length) {
      result.push({ requirementId: field.id, value: field.type === 'multi' ? answer.values : answer.values[0], status: 'answered', quote: optionLabels(field, answer.values) });
    } else if (answer.kind === 'text' && answer.text.trim()) {
      result.push({ requirementId: field.id, value: answer.text.trim(), status: 'answered', quote: answer.text.trim() });
    } else if (answer.kind === 'table') {
      if (!answer.rows.length) {
        result.push({ requirementId: field.id, value: '없음', status: 'not_applicable', quote: '없음' });
        continue;
      }
      const filled = answer.rows.filter(row => Object.values(row).some(cell => cell.trim()));
      if (!filled.length) continue;
      result.push({ requirementId: field.id, value: `${filled.length}`, status: 'answered', quote: `${filled.length}행` });
      filled.forEach((row, index) => {
        for (const column of field.columns ?? []) {
          const cell = row[column.id]?.trim();
          if (cell) result.push({ requirementId: `${field.id}.${column.id}`, eventId: `row-${index + 1}`, value: cell, status: 'answered', quote: cell });
        }
      });
    }
  }
  return result;
}

/** Whether the application is made more than a year after the entry date in 10.7.
 * Undefined when the date cannot be read; the chat then asks the applicant. */
export function lateFromEntryDate(answers: FormAnswers, today = new Date()): { late: boolean; entry: string } | undefined {
  const answer = answers['10.7'];
  const match = answer?.kind === 'text' ? /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(answer.text.trim()) : null;
  if (!match) return undefined;
  const entry = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(entry.getTime()) || entry > today) return undefined;
  const anniversary = new Date(entry); anniversary.setFullYear(entry.getFullYear() + 1);
  return { late: today > anniversary, entry: answer!.kind === 'text' ? answer.text.trim() : '' };
}

/** Save the form into metadata. Unchanged values keep their fact (and confirmation);
 * changed values supersede the old fact; cleared or hidden values are withdrawn. */
export function applyFormAnswers(session: IntakeSession, answers: FormAnswers): IntakeSession {
  const active = getActiveFacts(session).filter(fact => isFormSection(fact.requirementId));
  const key = (requirementId: string, eventId?: string) => `${requirementId}|${eventId ?? ''}`;
  const current = new Map(active.map(fact => [key(fact.requirementId, fact.eventId), fact]));
  const added: IntakeFact[] = [];
  const kept = new Set<string>();
  // Question 14.18 applies only after a year in Korea: computed from the entry date,
  // unless the applicant already answered it in the chat.
  const late = lateFromEntryDate(answers);
  const lateFacts = getActiveFacts(session).filter(fact => fact.requirementId === 'late');
  const desired = desiredFacts(answers);
  if (!lateFacts.some(fact => fact.sourceIds[0] !== FORM_SOURCE_ID)) {
    lateFacts.forEach(fact => current.set(key('late'), fact));
    if (late) desired.push({ requirementId: 'late', value: late.late ? 'yes' : 'no', status: 'answered', quote: `입국일자 ${late.entry} 기준 계산` });
    active.push(...lateFacts);
  }
  for (const item of desired) {
    const existing = current.get(key(item.requirementId, item.eventId));
    if (existing && existing.status === item.status && JSON.stringify(existing.value) === JSON.stringify(item.value)) { kept.add(existing.id); continue; }
    added.push({
      id: nextFactId([...session.facts, ...added]), requirementId: item.requirementId, value: item.value,
      sourceIds: [FORM_SOURCE_ID], sourceQuotes: [{ sourceId: FORM_SOURCE_ID, quote: item.quote }],
      status: item.status, certainty: 'exact', knowledge: 'unspecified',
      eventId: requirementsById.get(item.requirementId)?.repeatable ? item.eventId : undefined,
      supersedes: existing ? [existing.id] : [], confirmed: false,
    });
    if (existing) kept.add(existing.id);
  }
  const withdrawn = active.filter(fact => !kept.has(fact.id)).map(fact => fact.id);
  const next = { ...(added.length || withdrawn.length ? invalidateDraft(session) : session), form: answers, facts: [...session.facts, ...added], withdrawnFacts: [...session.withdrawnFacts, ...withdrawn], updatedAt: new Date().toISOString() };
  return { ...next, coverage: calculateCoverage(next) };
}

/** Clearly fictional values for exercising the flow during development only. */
export function dummyFormAnswers(): FormAnswers {
  const named: Record<string, string> = {
    '1.2': '가상', '1.3': '테스트', '1.4': '없음', '1.5': '1990/01/01', '1.7': '가상국', '1.8': '교사',
    '1.9': '가상국 A시', '1.10': '가상국 A시 1번지', '1.11': '없음', '1.12': '해당 정보 없음',
  };
  const answers: FormAnswers = {};
  for (const field of fields.values()) {
    if (field.type === 'single' || field.type === 'multi') {
      const options = field.options ?? [];
      const preferred = options.find(option => option.value === 'no') ?? options[0];
      answers[field.id] = { kind: 'choice', values: preferred ? [preferred.value] : [] };
    } else if (field.type === 'table') {
      answers[field.id] = { kind: 'table', rows: [Object.fromEntries((field.columns ?? []).map(column => [column.id, column.kind === 'date' ? '2020/01/01' : `가상 ${column.ko}`]))] };
    } else if (field.type === 'date') {
      answers[field.id] = { kind: 'text', text: named[field.id] ?? '2020/01/01' };
    } else {
      answers[field.id] = { kind: 'text', text: named[field.id] ?? `가상 ${field.ko}` };
    }
  }
  return answers;
}
