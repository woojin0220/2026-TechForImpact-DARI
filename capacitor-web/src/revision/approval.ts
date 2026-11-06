import type { Suggestion } from './state.mjs';

/** Only supported review languages may approve; English needs this exact meaning. */
export function canApproveSuggestion(proposal: Suggestion, revision: number, currentText: string, language: string, meaningSource?: string, busy = false): boolean {
  return !busy && proposal.status === 'pending' && proposal.baseRevision === revision && proposal.before === currentText
    && (language === 'ko' || (language === 'en' && !!proposal.after.trim() && meaningSource === proposal.after));
}
