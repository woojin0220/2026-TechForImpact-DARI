import { useEffect, useRef, useState } from 'react';
import { generateReviewModel } from './queue';
import { generateSentenceReply } from './model.mjs';
import { addAssistantMessage, addUserMessage, applySuggestion, createDocument, dismissSuggestion, documentText, sentence, undoChange, type TxtDocument } from './state.mjs';
import './revision.css';
import { EnglishMeaning } from './EnglishMeaning';

export function SentenceReview({ text, saved, onChange, uiLanguage = 'ko' }: {
  text: string; saved?: TxtDocument; onChange: (doc: TxtDocument, expectedText: string) => void; uiLanguage?: string;
}) {
  const t = (ko: string, en: string) => uiLanguage === 'en' ? en : ko;
  const [doc, setDoc] = useState(() => saved && documentText(saved) === text ? saved : createDocument(text));
  const [selected, setSelected] = useState(() => doc.pieces.find(p => p.kind === 'sentence')?.id ?? '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    setBusy(true); setError('');
    try {
      const next = retry ? doc : addUserMessage(doc, selected, input);
      commit(next); setInput('');
      const reply = await generateSentenceReply(next, selected, uiLanguage, generateReviewModel, abort.signal);
      if (abort.signal.aborted) return;
      const result = addAssistantMessage(next, selected, reply, row.revision);
      onChange(result, documentText(next)); setDoc(result);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure));
    } finally { if (request.current === abort) request.current = null; setBusy(false); }
  }
  function edit(action: () => TxtDocument) {
    try { commit(action()); setError(''); } catch (failure) { setError(String(failure)); }
  }
  return <div className="sentence-review" lang={uiLanguage} dir="ltr">
    <p className="micro">{t("수정할 문장을 선택하고 요청해 주세요. 승인하기 전에는 본문이 바뀌지 않습니다. 사실관계가 달라졌다면 대화 수집 단계에서 정정한 뒤 초안을 다시 작성해 주세요.","Select a sentence and tell us what you would like to change. Nothing is applied until you approve it. For factual corrections, return to the intake conversation and regenerate the draft.")}</p>
    <div className="revision-grid"><section className="revision-document"><div className="section-title"><h3>{t("초안","Korean draft")}</h3><span className="small-tag">{t("클릭해 문장 선택","Select a sentence")}</span></div><div className="revision-sentences" aria-label={t("수정할 문장", "Sentence to edit")}>{doc.pieces.map((piece, index) => piece.kind === 'gap' ? <span key={index}>{piece.text}</span> : <button key={piece.id} className={piece.text !== piece.originalText ? 'edited' : undefined} aria-pressed={piece.id === selected} disabled={busy} onClick={() => { setSelected(piece.id); setInput(''); setError(''); }}>{piece.text}</button>)}</div>
    <p className="micro">{t("밑줄이 있는 문장은 원문에서 수정된 문장입니다.","Underlined sentences have been edited.")}</p></section><section className="revision-chat"><div className="revision-selected"><p className="overline">{t("선택한 문장","Selected sentence")}</p>{uiLanguage === 'en' ? <EnglishMeaning text={row.text} compact /> : <p>{row.text}</p>}{uiLanguage !== 'en' && row.text !== row.originalText && <details><summary>{t("처음 작성한 문장 보기","View original sentence")}</summary><p>{row.originalText}</p></details>}</div><div className="revision-thread" role="log" aria-label={t("문장별 수정 대화", "Sentence discussion")}>{messages.map(message => <article key={message.id} className={message.role}>
      <small>{message.role === 'user' ? t('수정 요청', 'Your request') : 'DARI'}</small><p>{message.content}</p>
      {message.proposal && <div className="revision-proposal"><details><summary>{t("수정 전 보기","Before the edit")}</summary><p>{message.proposal.before}</p></details><h3>{t("수정안","Suggested Korean text")}</h3><p>{message.proposal.after}</p>
        {message.proposal.status === 'pending' && message.proposal.baseRevision === row.revision ? <div className="actions"><button className="primary" disabled={busy} onClick={() => edit(() => applySuggestion(doc, selected, message.id))}>{t("이 수정안 반영","Apply this suggestion")}</button><button className="secondary" disabled={busy} onClick={() => edit(() => dismissSuggestion(doc, selected, message.id))}>{t("반영하지 않기","Dismiss")}</button></div> : <small>{message.proposal.status === 'applied' ? t('반영 이력 있음', 'Previously applied') : t('사용할 수 없는 수정안', 'Suggestion no longer available')}</small>}</div>}
    {message.proposal && uiLanguage === 'en' && <EnglishMeaning text={message.proposal.after} />}
    </article>)}</div>
    <div className="revision-composer"><label>{t("이 문장에 대해 이야기하기","Discuss this sentence in English")}<textarea maxLength={3000} value={input} disabled={busy} placeholder={t("같은 뜻을 유지하면서 자연스럽게 다듬어 주세요.", "Please make this sound natural without changing its meaning.")} onChange={event => setInput(event.target.value)} /></label>
    <div className="actions"><button className="primary" disabled={busy || !input.trim()} onClick={() => void send()}>{t("수정 요청","Request an edit")}</button><button className="secondary" disabled={busy || !doc.undo.length} onClick={() => edit(() => undoChange(doc))}>{t("마지막 수정 되돌리기","Undo last edit")}</button>{busy && <button className="secondary" onClick={() => { request.current?.abort(); setError(t('요청을 취소했습니다. 본문은 유지됩니다.', 'Request cancelled. The draft is unchanged.')); }}>{t("중지","Stop")}</button>}</div>
    {busy && <p role="status">{t("선택한 문장의 수정안을 작성하고 있습니다…","Preparing a suggestion for this sentence…")}</p>}
    {error && <div role="alert"><p>{error}</p>{messages.at(-1)?.role === 'user' && <button className="secondary" disabled={busy} onClick={() => void send(true)}>{t("같은 요청 다시 시도","Retry this request")}</button>}</div>}
    </div></section></div><p className="micro">{t("문장별 대화와 수정 이력은 전체 결과 JSON에 포함됩니다. 자동 저장되지 않으므로 종료 전에 내보내 주세요. 수정된 문장의 근거는 자동 재검증되지 않습니다.","Sentence conversations and edit history are included in the JSON export. Export before leaving; there is no autosave. Evidence for edited sentences is not automatically rechecked.")}</p>
  </div>;
}
