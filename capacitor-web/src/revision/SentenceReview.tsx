import { useEffect, useRef, useState } from 'react';
import { generateReviewModel } from './queue';
import { generateSentenceReply } from './model.mjs';
import { addAssistantMessage, addUserMessage, applySuggestion, createDocument, dismissSuggestion, documentText, sentence, undoChange, type TxtDocument } from './state.mjs';
import './revision.css';
import { EnglishMeaning } from './EnglishMeaning';
import { canApproveSuggestion } from './approval';
import { revisionCopy, revisionDirection, revisionErrorKey, supportsMeaningReview, type RevisionErrorKey } from './revisionCopy';

export function SentenceReview({ text, saved, onChange, uiLanguage = 'ko' }: {
  text: string; saved?: TxtDocument; onChange: (doc: TxtDocument, expectedText: string) => void; uiLanguage?: string;
}) {
  const copy = revisionCopy(uiLanguage);
  const reviewSupported = supportsMeaningReview(uiLanguage);
  const [doc, setDoc] = useState(() => saved && documentText(saved) === text ? saved : createDocument(text));
  const [selected, setSelected] = useState(() => doc.pieces.find(p => p.kind === 'sentence')?.id ?? '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RevisionErrorKey | null>(null);
  const [proposalMeanings, setProposalMeanings] = useState<Record<string, string>>({});
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const row = sentence(doc, selected);
  const messages = doc.threads[selected] ?? [];
  function commit(next: TxtDocument) {
    onChange(next, documentText(doc));
    setDoc(next);
  }
  async function send(retry = false) {
    if (busy || request.current) return;
    const abort = new AbortController(); request.current = abort;
    setBusy(true); setError(null);
    try {
      const next = retry ? doc : addUserMessage(doc, selected, input);
      commit(next); setInput('');
      const reply = await generateSentenceReply(next, selected, uiLanguage, generateReviewModel, abort.signal);
      if (abort.signal.aborted) return;
      const result = addAssistantMessage(next, selected, reply, row.revision);
      onChange(result, documentText(next)); setDoc(result);
    } catch (failure) {
      if (!abort.signal.aborted) setError(revisionErrorKey(failure));
    } finally { if (request.current === abort) request.current = null; setBusy(false); }
  }
  function edit(action: () => TxtDocument) {
    try { commit(action()); setError(null); } catch { setError('editFailed'); }
  }
  return <div className="sentence-review" lang={uiLanguage} dir={revisionDirection(uiLanguage)}>
    <p className="micro">{copy.instructions}</p>
    {!reviewSupported && <p className="draft-missing" role="status">{copy.reviewUnavailable}</p>}
    <div className="revision-grid"><section className="revision-document"><div className="section-title"><h3>{copy.koreanDraft}</h3><span className="small-tag">{copy.selectSentence}</span></div><div className="revision-sentences" lang="ko" dir="ltr" aria-label={copy.sentenceToEdit}>{doc.pieces.map((piece, index) => piece.kind === 'gap' ? <span key={index}>{piece.text}</span> : <button key={piece.id} className={piece.text !== piece.originalText ? 'edited' : undefined} aria-pressed={piece.id === selected} disabled={busy} onClick={() => { setSelected(piece.id); setInput(''); setError(null); }}>{piece.text}</button>)}</div>
    <p className="micro">{copy.editedHint}</p></section><section className="revision-chat"><div className="revision-selected"><p className="overline">{copy.selectedSentence}</p>{uiLanguage === 'en' ? <EnglishMeaning text={row.text} compact uiLanguage={uiLanguage} /> : <p lang="ko" dir="ltr">{row.text}</p>}{uiLanguage !== 'en' && row.text !== row.originalText && <details><summary>{copy.viewOriginal}</summary><p lang="ko" dir="ltr">{row.originalText}</p></details>}</div><div className="revision-thread" role="log" aria-label={copy.discussion}>{messages.map(message => <article key={message.id} className={message.role}>
      <small>{message.role === 'user' ? copy.yourRequest : 'DARI'}</small><p dir="auto">{message.content}</p>
      {message.proposal && <div className="revision-proposal"><h3>{copy.suggestion}</h3><p lang="ko" dir="ltr">{message.proposal.after}</p>
        {uiLanguage === 'en' && <EnglishMeaning text={message.proposal.after} uiLanguage={uiLanguage} onReady={text => setProposalMeanings(current => current[message.id] === text ? current : { ...current, [message.id]: text })} />}
        {message.proposal.status === 'pending' && message.proposal.baseRevision === row.revision ? <div className="actions"><button className="primary" disabled={!reviewSupported || !canApproveSuggestion(message.proposal, row.revision, row.text, uiLanguage, proposalMeanings[message.id], busy)} onClick={() => { if (reviewSupported && message.proposal && canApproveSuggestion(message.proposal, row.revision, row.text, uiLanguage, proposalMeanings[message.id], busy)) edit(() => applySuggestion(doc, selected, message.id)); }}>{copy.apply}</button><button className="secondary" disabled={busy} onClick={() => edit(() => dismissSuggestion(doc, selected, message.id))}>{copy.dismiss}</button></div> : <small>{message.proposal.status === 'applied' ? copy.previouslyApplied : copy.unavailable}</small>}</div>}
    </article>)}</div>
    <div className="revision-composer"><label>{copy.discuss}<textarea dir="auto" maxLength={3000} value={input} disabled={busy} placeholder={copy.placeholder} onChange={event => setInput(event.target.value)} /></label>
    <div className="actions"><button className="primary" disabled={busy || !input.trim()} onClick={() => void send()}>{copy.requestEdit}</button><button className="secondary" disabled={busy || !doc.undo.length} onClick={() => edit(() => undoChange(doc))}>{copy.undo}</button>{busy && <button className="secondary" onClick={() => { request.current?.abort(); setError('cancelled'); }}>{copy.stop}</button>}</div>
    {busy && <p role="status">{copy.preparing}</p>}
    {error && <div role="alert"><p>{copy[error]}</p>{!['cancelled', 'editFailed', 'emptyRequest', 'requestTooLong'].includes(error) && messages.at(-1)?.role === 'user' && <button className="secondary" disabled={busy} onClick={() => void send(true)}>{copy.retry}</button>}</div>}
    </div></section></div><p className="micro">{copy.historyHint}</p>
  </div>;
}
