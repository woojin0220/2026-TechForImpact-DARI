import type { ModelRequest } from '../intake/types.ts';
import { generateIntakeModel } from '../lib/intakeModel';

// Back-translations and edit requests use the app-wide model queue in lib/intakeModel.
// Callers mark automatic work as background so the applicant's own requests go first.
export function generateReviewModel(request: ModelRequest): Promise<string> {
  return generateIntakeModel(request);
}
