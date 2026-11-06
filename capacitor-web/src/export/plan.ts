import { applicationSteps, type FormField } from '../form/schema.ts';
import type { FormAnswers, FormValue } from '../intake/form.ts';
import type { IntakeSession } from '../intake/types.ts';

export const templateVersion = '2019.12.31';
export type ExportEntry = { field: FormField; section: string; value?: FormValue; text: string; state: 'answered' | 'missing' | 'unknown' | 'not_applicable' | 'review' };
export type ApplicationPlan = { entries: ExportEntry[]; warnings: string[]; test: boolean; reviewed: boolean };
const fields = new Map(applicationSteps.flatMap(step => step.fields).map(field => [field.id, field]));
function visible(field: FormField, answers: FormAnswers): boolean {
  return (field.when ?? []).every(rule => {
    const parent = fields.get(rule.id);
    const value = answers[rule.id];
    return (!parent || visible(parent, answers)) && value?.kind === 'choice' && rule.anyOf.some(option => value.values.includes(option));
  });
}
export function answerText(field: FormField, value?: FormValue): string {
  if (!value) return '';
  if (value.kind === 'status') return value.status === 'unknown' ? '모름 / 기억 또는 정보 불확실' : '해당 없음';
  if (value.kind === 'text') return value.text.replace(/\r\n?/g, '\n').trim();
  if (value.kind === 'choice') return value.values.map(key => field.options?.find(option => option.value === key)?.ko ?? key).join(', ');
  if (!value.rows.length) return '해당 없음';
  return value.rows.map((row, index) => `${index + 1}. ${(field.columns ?? []).map(column => `${column.ko}: ${row[column.id]?.trim() || '[미작성]'}`).join(' / ')}`).join('\n');
}
/** Only current form values and applicant-edited Korean answers are exported.
 * No model call, reconstruction from stale draft sentences, or invented defaults. */
export function buildApplicationPlan(session: IntakeSession, reviewed: boolean): ApplicationPlan {
  const answers = { ...session.form, ...(session.question14 ?? {}) };
  const entries: ExportEntry[] = [];
  for (const step of applicationSteps) for (const field of step.fields) {
    // Consent, sworn declaration, signatures and officer-only fields remain untouched.
    if (field.id.startsWith('16.') || !visible(field, answers)) continue;
    const value = answers[field.id];
    const text = answerText(field, value);
    let state: ExportEntry['state'] = !text ? 'missing' : value?.kind === 'status' ? value.status : 'answered';
    if (value?.kind === 'table' && !value.rows.length) state = 'not_applicable';
    if (value?.kind === 'table' && value.rows.length && value.rows.some(row => (field.columns ?? []).some(column => !row[column.id]?.trim()))) state = 'review';
    entries.push({ field, section: step.sectionKo, value, text, state });
  }
  const warnings = [`제공받은 HWP는 ${templateVersion} 개정본입니다. 실제 제출 전 최신 서식 여부를 확인하세요.`, '서명, 자필 서약, 동의 표시, 신청일 및 접수 공무원 작성란은 자동 작성하지 않습니다. 이 기능은 신청서를 제출하지 않습니다.'];
  if (session.scope === 'test') warnings.push('짧은 테스트 모드의 결과입니다. 실제 신청서 전체를 작성한 것이 아닙니다.');
  if (!reviewed) warnings.push('앱의 최종 내용 확인이 완료되지 않았습니다. 검토용으로 출력됩니다.');
  if (session.facts.some(fact => fact.status === 'conflict' && !session.withdrawnFacts.includes(fact.id) && !session.facts.some(next => next.supersedes?.includes(fact.id)))) warnings.push('원문 정보에 미해결 차이가 있습니다. 초안과 원문을 다시 확인하세요.');
  if (session.draft.some(section => section.missingFactIds?.length || section.staleValues?.length)) warnings.push('초안에서 누락되거나 이전 값이 남은 것으로 표시된 내용이 있습니다.');
  return { entries, warnings, test: session.scope === 'test', reviewed };
}
