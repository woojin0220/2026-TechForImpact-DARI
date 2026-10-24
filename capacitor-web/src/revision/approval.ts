import type { Suggestion } from './state.mjs';

/** An English-speaking applicant must see the meaning of this exact replacement first. */
export function canApproveSuggestion(proposal: Suggestion, revision: number, currentText: string, language: string, meaningSource?: string, busy = false): boolean {
  return !busy && proposal.status === 'pending' && proposal.baseRevision === revision && proposal.before === currentText
    && (language !== 'en' || (!!proposal.after.trim() && meaningSource === proposal.after));
}
