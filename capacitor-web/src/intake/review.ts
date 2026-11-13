import { IntakeError, type IntakeSession } from './types.ts';
import { eventReview, questionUses, statementMetadata, statementQuestions } from './statements.ts';
import { getActiveFacts, now } from './session.ts';
import { calculateCoverage } from './coverage.ts';

/** Confirming reviewed facts and exporting the whole record. */

export function confirmFacts(session: IntakeSession, ids: string[]): IntakeSession {
  const conflicts = new Set(calculateCoverage(session).filter(item => item.status === 'conflict').map(item => item.requirementId));
  const valid = new Set(getActiveFacts(session).filter(fact => fact.status !== 'conflict' && !conflicts.has(fact.requirementId)).map(fact => fact.id));
  if (ids.some(id => !valid.has(id))) throw new IntakeError('현재 확인 가능한 사실만 선택해 주세요.', session);
  return { ...session, facts: session.facts.map(fact => ids.includes(fact.id) ? { ...fact, confirmed: true } : fact), updatedAt: now() };
}


/** Explicit export only: callers choose where it is saved. No remote upload or automatic persistence. */
export function exportSession(session: IntakeSession): string {
  return JSON.stringify({
    version: session.version, sessionId: session.id, language: session.language, scope: session.scope,
    ...(session.scope === 'test' ? { testOnly: true, warning: 'Conversation test only — not for submission.' } : {}),
    source: session.messages, form: session.form, question14: session.question14, draftReviews: session.draftReviews,
    metadata: { schemaVersion: 2, facts: session.facts, statements: statementMetadata(getActiveFacts(session)),
      questionUses: questionUses(getActiveFacts(session)), events: eventReview(session), clarification: statementQuestions(getActiveFacts(session)),
      withdrawnFacts: session.withdrawnFacts, topicDecisions: session.topicDecisions ?? {}, coverage: calculateCoverage(session) },
    draft: { language: 'ko', revision: session.draftRevision, sections: session.draft }, updatedAt: session.updatedAt,
  }, null, 2);
}
