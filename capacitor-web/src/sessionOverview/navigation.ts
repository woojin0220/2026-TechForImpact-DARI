import type { FormAnswers } from '../intake/form.ts';

/** Metadata numbers table incidents after removing blank rows. Translate that
 * ordinal back to the original form row so an edit link focuses the right input. */
export function formRowIndex(answers: FormAnswers, tableId: string, eventId?: string): number {
  const match = /^row-([1-9]\d*)$/.exec(eventId ?? '');
  const value = answers[tableId];
  if (!match || value?.kind !== 'table') return -1;
  const ordinal = Number(match[1]);
  if (!Number.isSafeInteger(ordinal)) return -1;
  let populated = 0;
  for (const [index, row] of value.rows.entries()) {
    // Keep this definition aligned with desiredFacts() in intake/form.ts: a
    // partial row counts, while an empty or whitespace-only row does not.
    if (!Object.values(row).some(cell => cell.trim())) continue;
    populated += 1;
    if (populated === ordinal) return index;
  }
  return -1;
}
