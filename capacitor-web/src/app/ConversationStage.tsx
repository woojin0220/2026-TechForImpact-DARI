import type { MouseEvent, RefObject } from 'react';
import { nextStep, type IntakeSession, type Requirement, type ScriptedAnswer, type ScriptedAsk } from '../intake';
import { OTHER_OPTION } from '../form/otherChoice';
import { ChoiceCard } from '../ChoiceList';
import { TopicProgress } from '../JourneyPanels';
import { optionLabel, pickedText } from './labels';
import type { BusyKind } from './useModelTask';
import type { AppTexts } from './texts';

type Props = {
  texts: AppTexts;
  language: string;
  session: IntakeSession;
  busy: BusyKind | null;
  locked: boolean;
  threadRef: RefObject<HTMLDivElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInput: (text: string) => void;
  /** The scripted question waiting for an answer, if any. */
  ask?: ScriptedAsk;
  askRequirement?: Requirement;
  askOther: boolean;
  picked: string[];
  onPick: (values: string[]) => void;
  otherText: string;
  onOtherText: (text: string) => void;
  inNarrative: boolean;
  showComposer: boolean;
  generatingExample: boolean;
  onGenerateExample: () => void;
  onEndConversation: () => void;
  onReview: () => void;
  onDefer: (status: 'unknown' | 'skipped') => void;
  onFinishStory: () => void;
  onAnswer: (reply: ScriptedAnswer) => void;
  onSend: () => void;
  onStop: () => void;
};

/** The chat: options sheet, message thread, choice card and composer. */
export function ConversationStage(props: Props) {
  const { texts: { copy, ui, sc }, language, session, busy, locked, input, ask, askRequirement, askOther, picked, otherText } = props;
  const typing = !!input.trim();
  const last = session.messages.at(-1);
  function pick(values: string[]) {
    props.onPick(values);
    if (!values.includes(OTHER_OPTION) && picked.includes(OTHER_OPTION) && otherText.trim()) props.onOtherText('');
  }
  function answerChoice(values: string[]) {
    if (ask?.kind === 'table') props.onAnswer(values[0] === 'have' ? { text: sc.have, status: 'answered' } : { text: sc.none, status: 'not_applicable' });
    else if (ask?.kind === 'more') props.onAnswer({ text: values[0] === 'yes' ? sc.yes : sc.no, status: 'answered', value: values[0] });
    else if (askRequirement?.options) props.onAnswer({ text: pickedText(askRequirement.options, values, language, askOther ? otherText : ''), status: 'answered', value: askRequirement.type === 'multi' ? values : values[0], other: otherText });
  }
  // Tapping an action inside the options sheet closes it.
  function closeSheetOnAction(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) { const details = event.currentTarget.closest('details'); if (details) details.open = false; }
  }
  return <div className="content-grid"><div><section className="panel chat-panel">
    <div className="chat-toolbar"><details className="chat-options"><summary>{ui.more}</summary><div className="chat-options-sheet" onClick={closeSheetOnAction}>
      <TopicProgress session={session} language={language} />
      {session.scope === 'test' && <div className="actions test-actions">
        <button className="secondary" disabled={locked || typing || last?.role !== 'assistant' || last?.ask?.kind === 'done'} onClick={props.onGenerateExample}>{props.generatingExample ? ui.exampleGenerating : ui.exampleGenerate}</button>
        <button className="secondary" disabled={locked || typing} onClick={props.onEndConversation}>{ui.finish}</button>
      </div>}
      <button className="secondary" disabled={locked || typing} onClick={props.onReview}>{copy.review}</button>
      {props.inNarrative && <div className="conversation-controls">
        {session.narrativeDone
          ? <><button className="quiet" disabled={locked || typing} onClick={() => props.onDefer('unknown')}>{sc.unknown}</button><button className="quiet" disabled={locked || typing} onClick={() => props.onDefer('skipped')}>{sc.skip}</button></>
          : <button className="secondary" disabled={locked || typing} onClick={props.onFinishStory}>{ui.finishStory}</button>}
        {session.narrativeDone && <button className="secondary" disabled={locked || typing} onClick={props.onEndConversation}>{ui.finishQuestions}</button>}
      </div>}
    </div></details></div>
    <div className="chat-thread" ref={props.threadRef} role="log" aria-label={copy.conversation} aria-live="polite">{session.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small className="sr-only">{message.role === 'assistant' ? 'DARI' : copy.input}</small><p dir="auto">{message.content}</p></article>)}</div>
    {ask && (ask.kind !== 'field' || askRequirement?.options) && <ChoiceCard
      key={`${ask.kind}-${ask.requirementId}-${ask.eventId ?? ''}-${session.messages.length}`}
      label={copy.input}
      items={ask.kind === 'table' ? [{ value: 'have', label: sc.have }, { value: 'none', label: sc.none }]
        : ask.kind === 'more' ? [{ value: 'yes', label: sc.yes }, { value: 'no', label: sc.no }]
        : (askRequirement?.options ?? []).map(option => ({ value: option.value, label: optionLabel(option, language) }))}
      multi={ask.kind === 'field' && askRequirement?.type === 'multi'}
      selected={picked} onPick={pick}
      otherValue={ask.kind === 'field' && askOther ? OTHER_OPTION : undefined} otherText={otherText} onOtherText={props.onOtherText} otherLabel={sc.otherLabel} moreLabel={sc.moreChoices} lessLabel={sc.fewerChoices} hiddenSelectedLabel={sc.hiddenSelected}
      disabled={locked} submitLabel={sc.choose} clearLabel={sc.clearChoice} hint={sc.choiceHint}
      onAnswer={answerChoice}
      footer={ask.kind !== 'more' ? [{ label: sc.unknown, onClick: () => props.onAnswer({ text: sc.unknown, status: 'unknown' }) }, { label: sc.skip, onClick: () => props.onAnswer({ text: sc.skip, status: 'skipped' }) }] : []} />}
    {nextStep(session).kind === 'done' && <div className="actions"><button className="primary" disabled={locked || typing} onClick={props.onReview}>{ui.continueReview}</button></div>}
    {props.showComposer && <Composer {...props} />}
  </section></div><aside className="support-card"><h2>{ui.nextStep}</h2><p>{ui.flow}</p><p>{copy.pace}</p></aside></div>;
}

/** Enter sends on devices with a keyboard; touch keyboards keep Enter for new lines. */
function Composer({ texts: { copy }, busy, locked, input, onInput, composerRef, onSend, onStop }: Props) {
  return <form className="chat-composer" onSubmit={event => { event.preventDefault(); onSend(); }}>
    <label><span className="composer-label">{copy.input}</span><textarea dir="auto" ref={composerRef} value={input} maxLength={12000} rows={1} placeholder={copy.placeholder} onChange={event => onInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia('(pointer: coarse)').matches) { event.preventDefault(); onSend(); } }} disabled={locked} /></label>
    <div className="composer-actions"><small>{copy.pace}</small>{busy
      ? <button className="primary send-icon composer-stop" type="button" onClick={onStop} aria-label={copy.stop} title={copy.stop}><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" /></svg></button>
      : <button className="primary send-icon" disabled={!input.trim() || locked} type="submit" aria-label={copy.send} title={copy.send}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}</div>
  </form>;
}
