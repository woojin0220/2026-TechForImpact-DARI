export const CHOICE_LIMIT = 5;

/** Rows to show for a possibly collapsed list. Selection lives with the caller,
 * so collapsing never clears a choice; it only reports how many are hidden. */
export function collapseRows<T extends { value: string }>(rows: T[], selected: string[], expanded: boolean, limit = CHOICE_LIMIT) {
  const collapsible = rows.length > limit;
  const visible = collapsible && !expanded ? rows.slice(0, limit) : rows;
  const hidden = rows.length - visible.length;
  const hiddenSelected = rows.slice(visible.length).filter(row => selected.includes(row.value)).length;
  return { collapsible, visible, hidden, hiddenSelected };
}
