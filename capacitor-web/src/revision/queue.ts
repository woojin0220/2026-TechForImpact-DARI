import type { ModelRequest } from '../intake/types.ts';
import { generateIntakeModel } from '../lib/intakeModel';

// Serialize automatic back-translations and edit requests on the same local model.
let tail: Promise<unknown> = Promise.resolve();
export function generateReviewModel(request: ModelRequest): Promise<string> {
  const job = tail.then(() => {
    if (request.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    return generateIntakeModel(request);
  });
  tail = job.catch(() => undefined);
  return job;
}
