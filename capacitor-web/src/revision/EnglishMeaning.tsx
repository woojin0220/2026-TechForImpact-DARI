import { useEffect, useRef, useState } from 'react';
import { generateReviewModel } from './queue';
import { meaningRequest, parseMeaning } from './meaning';
import { revisionCopy, revisionDirection, supportsMeaningReview } from './revisionCopy';

export function EnglishMeaning({ text, compact = false, onReady, uiLanguage = 'en' }: { text: string; compact?: boolean; onReady?: (text: string) => void; uiLanguage?: string }) {
  const copy = revisionCopy(uiLanguage);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const [result, setResult] = useState<{ source: string; english: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Back-translate only once the card is on screen, so a long draft does not queue a
  // model call per item before the applicant's own requests (speed, issue review 3E).
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !box.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setSeen(true); }, { rootMargin: '200px' });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [seen]);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    readyCallback.current?.('');
    if (!seen) return () => abort.abort();
    if (!text.trim()) { setBusy(false); return () => abort.abort(); }
    setBusy(true);
    void (async () => {
      try {
        const english = parseMeaning(await generateReviewModel({ ...meaningRequest(text), signal: abort.signal, priority: 'background' }));
        if (!abort.signal.aborted) { setResult({ source: text, english }); readyCallback.current?.(supportsMeaningReview(uiLanguage) ? text : ''); }
      } catch {
        if (!abort.signal.aborted) setError(true);
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    })();
    return () => abort.abort();
  }, [text, attempt, uiLanguage, seen]);
  if (!text.trim()) return null;
  return <div ref={box} className={compact ? 'selected-meaning' : 'english-meaning'} lang={uiLanguage} dir={revisionDirection(uiLanguage)}>
    {uiLanguage === 'ar' && <p className="micro">{copy.meaningLanguage}</p>}
    {result?.source === text && !busy && !error ? <p className="meaning-text" lang="en" dir="ltr">{result.english}</p> : !error && <p role="status">{copy.meaningLoading}</p>}
    {error && <div role="alert"><p>{copy.meaningFailed}</p><button className="secondary" onClick={() => setAttempt(value => value + 1)}>{copy.meaningRetry}</button></div>}
  </div>;
}
