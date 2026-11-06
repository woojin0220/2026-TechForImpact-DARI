/** One local model serves every request, so the app runs them one at a time.
 * Requests the applicant is waiting on (an answer, a draft, an edit) go ahead of
 * queued background work such as automatic back-translations; a job that is
 * already running is never interrupted. A request cancelled while queued is
 * dropped without reaching the model. */
export type ModelPriority = 'foreground' | 'background';

type Job = { start: () => void };

export function createModelQueue() {
  const foreground: Job[] = [];
  const background: Job[] = [];
  let running = false;

  function pump() {
    if (running) return;
    const job = foreground.shift() ?? background.shift();
    if (!job) return;
    running = true;
    job.start();
  }

  function run<T>(task: () => Promise<T>, priority: ModelPriority = 'foreground', signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const lane = priority === 'background' ? background : foreground;
      const job: Job = {
        start: () => {
          signal?.removeEventListener('abort', dropQueued);
          const finish = () => { running = false; pump(); };
          if (signal?.aborted) { reject(new DOMException('요청을 취소했습니다.', 'AbortError')); finish(); return; }
          task().then(resolve, reject).finally(finish);
        },
      };
      function dropQueued() {
        const index = lane.indexOf(job);
        if (index >= 0) { lane.splice(index, 1); reject(new DOMException('요청을 취소했습니다.', 'AbortError')); }
      }
      if (signal?.aborted) { reject(new DOMException('요청을 취소했습니다.', 'AbortError')); return; }
      signal?.addEventListener('abort', dropQueued, { once: true });
      lane.push(job);
      pump();
    });
  }

  return { run, pending: () => foreground.length + background.length, busy: () => running };
}
