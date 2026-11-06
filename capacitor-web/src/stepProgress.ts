/** Position in the top step bar (issue #3). Steps before the current one count
 * as passed; the language picker sits before the first step. */
export function stepProgress(stepIds: string[], stage: string) {
  const index = stepIds.indexOf(stage);
  const current = index < 0 ? 0 : index + 1;
  const total = stepIds.length;
  return { current, total, percent: total ? Math.round((current / total) * 100) : 0, passed: (id: string) => index >= 0 && stepIds.indexOf(id) < index };
}
