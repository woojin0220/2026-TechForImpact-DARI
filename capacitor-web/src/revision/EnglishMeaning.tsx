import { useEffect, useRef, useState } from 'react';
import { generateReviewModel } from './queue';
import { meaningRequest, parseMeaning } from './meaning';

export function EnglishMeaning({ text, compact = false, onReady }: { text: string; compact?: boolean; onReady?: (text: string) => void }) {
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const [result, setResult] = useState<{ source: string; english: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    readyCallback.current?.('');
    if (!text.trim()) { setBusy(false); return () => abort.abort(); }
    setBusy(true);
    void (async () => {
      try {
        const english = parseMeaning(await generateReviewModel({ ...meaningRequest(text), signal: abort.signal }));
        if (!abort.signal.aborted) { setResult({ source: text, english }); readyCallback.current?.(text); }
      } catch (failure) {
        if (!abort.signal.aborted) setError('The English meaning could not be prepared. Please retry. ' + String(failure));
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    })();
    return () => abort.abort();
  }, [text, attempt]);
  if (!text.trim()) return null;
  return <div className={compact ? 'selected-meaning' : 'english-meaning'} lang="en">
    {result?.source === text && !busy && !error ? <p className="meaning-text">{result.english}</p> : !error && <p role="status">Loading…</p>}
    {error && <div role="alert"><p>{error}</p><button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry English meaning</button></div>}
  </div>;
}
