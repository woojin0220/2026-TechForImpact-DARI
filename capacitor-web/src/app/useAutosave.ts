import { useEffect, useRef, type RefObject } from 'react';
import { writeWorkingCopy, type WorkingCopy } from '../workingCopy';

/**
 * Saves the working copy on every change and again when the tab is hidden.
 * `onResult` receives whether the last change-triggered save succeeded.
 */
export function useAutosave(work: WorkingCopy, enabled: RefObject<boolean>, onResult: (saved: boolean) => void) {
  const latest = useRef(work);
  latest.current = work;
  useEffect(() => {
    if (enabled.current) onResult(writeWorkingCopy(work));
  }, [work]);
  useEffect(() => {
    const save = () => { if (enabled.current) writeWorkingCopy(latest.current); };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', save); };
  }, [enabled]);
}
