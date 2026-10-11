import { useEffect, useState } from 'react';
import { generateReviewModel } from './queue';
import { meaningRequest, parseMeaning } from './meaning';

export function EnglishMeaning({ text, compact = false }: { text: string; compact?: boolean }) {
  const [result, setResult] = useState<{ source: string; english: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    if (!text.trim()) { setBusy(false); return () => abort.abort(); }
    setBusy(true);
    void (async () => {
      try {
        const english = parseMeaning(await generateReviewModel({ ...meaningRequest(text), signal: abort.signal }));
        if (!abort.signal.aborted) setResult({ source: text, english });
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
    {!compact && <><h4>What this Korean text says in English</h4>
    <p className="micro">This is an AI back-translation, not a verified translation. Check whether it reflects your intent, especially who did what, uncertainty, and information you heard from others.</p></>}
    {result?.source === text && !busy && !error ? <p className="meaning-text">{result.english}</p> : !error && <p role="status">Preparing the English meaning automatically… Sections are processed in order.</p>}
    {error && <div role="alert"><p>{error}</p><button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry English meaning</button></div>}
    {compact && <small>AI back-translation of the selected Korean sentence · please check the meaning.</small>}
  </div>;
}
