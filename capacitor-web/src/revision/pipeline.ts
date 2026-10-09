import type { IntakeSession } from '../intake/types.ts';
import { documentText, type TxtDocument } from './state.mjs';

/** Compare-and-set: an old editor must never overwrite a newer form or draft. */
export function saveDraftReview(session: IntakeSession, fieldId: string, expectedText: string, doc: TxtDocument): IntakeSession {
  const answer = session.question14?.[fieldId];
  if (!session.draftRevision || answer?.kind !== 'text' || answer.text !== expectedText) {
    throw new Error('초안이 변경되었습니다. 현재 문장에서 다시 시작해 주세요.');
  }
  return { ...session, question14: { ...session.question14, [fieldId]: { kind: 'text', text: documentText(doc) } },
    draftReviews: { ...session.draftReviews, [fieldId]: doc }, updatedAt: new Date().toISOString() };
}
