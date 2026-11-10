import { useEffect, useRef, useState } from 'react';
import { estimateProcessingTime, type ProcessingTask } from '../processingTime';

export type BusyKind = 'intake' | 'draft';
type Work = (signal: AbortSignal, recordTime: () => void) => Promise<void>;

/**
 * One model request at a time: tracks what is running, how long it has taken,
 * and recent durations per model so the progress estimate improves.
 * `timingScope` names the runtime and model the durations belong to.
 */
export function useModelTask(timingScope: string) {
  const [busy, setBusy] = useState<BusyKind | null>(null);
  const [task, setTask] = useState<ProcessingTask>('intake');
  const [samples, setSamples] = useState<Record<string, number[]>>({});
  const [elapsed, setElapsed] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const timingKey = (item: ProcessingTask) => `${timingScope}:${item}`;

  useEffect(() => {
    setElapsed(0);
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  /** Runs `work` with a fresh abort signal; `onFailure` sees every error, including aborts. */
  async function track(next: ProcessingTask, kind: BusyKind, work: Work, onFailure: (failure: unknown, signal: AbortSignal) => void, onSettled?: () => void) {
    const startedAt = Date.now();
    setTask(next); setBusy(kind);
    const abort = new AbortController(); controller.current = abort;
    const recordTime = () => {
      const key = timingKey(next);
      const seconds = (Date.now() - startedAt) / 1000;
      setSamples(current => ({ ...current, [key]: [...(current[key] ?? []), seconds].slice(-5) }));
    };
    try { await work(abort.signal, recordTime); }
    catch (failure) { onFailure(failure, abort.signal); }
    finally { controller.current = null; setBusy(null); onSettled?.(); }
  }

  return {
    busy, task, elapsed, controller, track,
    estimate: estimateProcessingTime(task, samples[timingKey(task)]),
  };
}
