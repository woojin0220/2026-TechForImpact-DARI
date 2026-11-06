export type ProcessingTask = 'intake' | 'followup' | 'draft' | 'example';
export type TimeEstimate = { minimum: number; maximum: number; learned: boolean };

// Provisional ranges, in seconds. The first local CPU conversation took about 280s.
const initialRanges: Record<ProcessingTask, [number, number]> = {
  intake: [120, 360], followup: [20, 120], draft: [120, 480], example: [30, 120],
};

export function estimateProcessingTime(task: ProcessingTask, durations: number[] = []): TimeEstimate {
  const samples = durations.filter(value => Number.isFinite(value) && value > 0).slice(-5).sort((a, b) => a - b);
  if (samples.length < 2) {
    const [minimum, maximum] = initialRanges[task];
    return { minimum, maximum, learned: false };
  }
  const middle = Math.floor(samples.length / 2);
  const median = samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2;
  const minimum = Math.max(10, Math.floor(median * 0.65 / 10) * 10);
  const maximum = Math.max(minimum + 10, Math.ceil(median * 1.6 / 10) * 10);
  return { minimum, maximum, learned: true };
}
