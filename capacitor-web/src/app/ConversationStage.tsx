import { finishNarrative, nextStep } from '../intake';
import { OTHER_OPTION } from '../form/otherChoice';
import { ChoiceCard } from '../ChoiceList';
import { TopicProgress } from '../JourneyPanels';
import { type DariApp } from './useDariApp';

/** Conversation step: chat thread, choice card, quick actions and composer. */
export function ConversationStage({ app }: { app: DariApp }) {
  const { stage, language, session, setSession, input, setInput, picked, setPicked, busy, generatingExample, thread, composerInput, recoveryPending, copy, ui, sc, facts, ask, askRequirement, askOther, otherText, setOtherText, inNarrative, showComposer, optionLabel, pickedText, sync, answer, deferTopic, endConversation, setStage, send, generateExample, stop } = app;
  return <>
        {stage === 'conversation' && <div className="content-grid"><div><section className="panel chat-panel"><div className="chat-toolbar"><details className="chat-options"><summary>{ui.more}</summary><div className="chat-options-sheet" onClick={event => { if ((event.target as HTMLElement).closest('button')) { const details = event.currentTarget.closest('details'); if (details) details.open = false; } }}><TopicProgress session={session} language={language} />{session.scope === 'test' && <div className="actions test-actions"><button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim() || session.messages.at(-1)?.role !== 'assistant' || session.messages.at(-1)?.ask?.kind === 'done'} onClick={() => void generateExample()}>{generatingExample ? ui.exampleGenerating : ui.exampleGenerate}</button><button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={endConversation}>{ui.finish}</button></div>}<button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setStage('facts')}>{copy.review}</button></div></details></div><div className="chat-thread" ref={thread} role="log" aria-label={copy.conversation} aria-live="polite">{session.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small className="sr-only">{message.role === 'assistant' ? 'DARI' : copy.input}</small><p dir="auto">{message.content}</p></article>)}</div>{ask && (ask.kind !== 'field' || askRequirement?.options) && <ChoiceCard
                  key={`${ask.kind}-${ask.requirementId}-${ask.eventId ?? ''}-${session.messages.length}`}
                  label={copy.input}
                  items={ask.kind === 'table' ? [{ value: 'have', label: sc.have }, { value: 'none', label: sc.none }]
                    : ask.kind === 'more' ? [{ value: 'yes', label: sc.yes }, { value: 'no', label: sc.no }]
                    : (askRequirement?.options ?? []).map(option => ({ value: option.value, label: optionLabel(option) }))}
                  multi={ask.kind === 'field' && askRequirement?.type === 'multi'}
                  selected={picked} onPick={values => { setPicked(values); if (!values.includes(OTHER_OPTION) && picked.includes(OTHER_OPTION) && otherText.trim()) setOtherText(''); }}
                  otherValue={ask.kind === 'field' && askOther ? OTHER_OPTION : undefined} otherText={otherText} onOtherText={setOtherText} otherLabel={sc.otherLabel} moreLabel={sc.moreChoices} lessLabel={sc.fewerChoices} hiddenSelectedLabel={sc.hiddenSelected}
                  disabled={!!busy || recoveryPending} submitLabel={sc.choose} clearLabel={sc.clearChoice} hint={sc.choiceHint}
                  onAnswer={values => {
                    if (ask.kind === 'table') answer(values[0] === 'have' ? { text: sc.have, status: 'answered' } : { text: sc.none, status: 'not_applicable' });
                    else if (ask.kind === 'more') answer({ text: values[0] === 'yes' ? sc.yes : sc.no, status: 'answered', value: values[0] });
                    else if (askRequirement?.options) answer({ text: pickedText(askRequirement.options, values), status: 'answered', value: askRequirement.type === 'multi' ? values : values[0], other: otherText });
                  }}
                  footer={ask.kind !== 'more' ? [{ label: sc.unknown, onClick: () => answer({ text: sc.unknown, status: 'unknown' }) }, { label: sc.skip, onClick: () => answer({ text: sc.skip, status: 'skipped' }) }] : []} />}
                {nextStep(session).kind === 'done' && <div className="actions"><button className="primary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setStage('facts')}>{ui.continueReview}</button></div>}
                {inNarrative && <div className="conversation-controls quick-actions" role="group" aria-label={ui.more}>
                  {session.narrativeDone ? <><button className="quiet" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => deferTopic('unknown')}>{sc.unknown}</button><button className="quiet" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => deferTopic('skipped')}>{sc.skip}</button></> : <button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setSession(current => sync(finishNarrative(current)))}>{ui.finishStory}</button>}
                  {session.narrativeDone && <button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={endConversation}>{ui.finishQuestions}</button>}
                </div>}
                {showComposer && <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label><span className="composer-label">{copy.input}</span><textarea dir="auto" ref={composerInput} value={input} maxLength={12000} rows={1} placeholder={copy.placeholder} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia('(pointer: coarse)').matches) { event.preventDefault(); void send(); } }} disabled={(!!busy || recoveryPending)} /></label><div className="composer-actions"><small>{copy.pace}</small>{busy ? <button className="primary send-icon composer-stop" type="button" onClick={() => void stop()} aria-label={copy.stop} title={copy.stop}><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" /></svg></button> : <button className="primary send-icon" disabled={!input.trim() || recoveryPending} type="submit" aria-label={copy.send} title={copy.send}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}</div></form>}
                </section></div><aside className="support-card"><h2>{ui.nextStep}</h2><p>{ui.flow}</p><p>{copy.pace}</p></aside></div>}
  </>;
}
