import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { IntakeFact, IntakeSession } from '../intake/types';
import type { FormValue } from '../intake/form';
import type { FormField } from '../form/schema';
import { requirementsById } from '../intake/catalog';
import { metadataGroups } from '../intake/metadata14';
import { applicationSteps } from '../form/schema';
import { localizedLabel, localizedRequirementLabel } from '../form/localize';
import { intakeProcessCopy } from '../intakeCopy';
import { buildSessionOverview, type OverviewEditTarget, type OverviewFactGroup, type OverviewFormItem } from './model';
import { overviewCopyFor, type OverviewCopy } from './copy';
import './overview.css';

export type SessionOverviewProps = {
  session: IntakeSession;
  language: string;
  pendingText?: string;
  busy?: boolean;
  onClose: () => void;
  onEdit: (target: OverviewEditTarget) => void;
};

const allFields = new Map(applicationSteps.flatMap(step => step.fields).map(field => [field.id, field]));
const supportsDraftEdit = (fieldId: string) => fieldId.startsWith('14.') && allFields.has(fieldId);

function statusText(status: string, copy: OverviewCopy) {
  if (status === 'not_applicable') return copy.notApplicable;
  if (status === 'unknown') return copy.unknown;
  if (status === 'skipped') return copy.skipped;
  if (status === 'conflict') return copy.conflict;
  return copy.answered;
}

function fieldTitle(fieldId: string, language: string, copy: OverviewCopy) {
  const field = allFields.get(fieldId);
  if (field) return localizedLabel(language, field.ko, field.en);
  const requirement = requirementsById.get(fieldId);
  return requirement ? localizedRequirementLabel(requirement, language) : `${copy.question} ${fieldId}`;
}

function factValue(fact: IntakeFact, language: string) {
  const options = requirementsById.get(fact.requirementId)?.options ?? [];
  return (Array.isArray(fact.value) ? fact.value : [fact.value]).map(value => {
    const option = options.find(item => item.value === value);
    return option ? localizedLabel(language, option.ko, option.en) : value;
  }).join(' · ');
}

function FormValueView({ value, field, language, copy, korean = false }: {
  value: FormValue; field?: FormField; language: string; copy: OverviewCopy; korean?: boolean;
}) {
  if (value.kind === 'text') return <p className="overview-value" lang={korean ? 'ko' : undefined} dir={korean ? 'ltr' : 'auto'}>{value.text || copy.noValue}</p>;
  if (value.kind === 'status') return <p className="overview-value">{statusText(value.status, copy)}</p>;
  if (value.kind === 'choice') return <ul className="overview-values">{value.values.length ? value.values.map((selected, index) => {
    const option = field?.options?.find(item => item.value === selected);
    return <li key={`${selected}:${index}`} dir="auto">{option ? localizedLabel(language, option.ko, option.en) : selected}</li>;
  }) : <li>{copy.noValue}</li>}</ul>;
  return <div className="overview-table">{!value.rows.length ? <p>{copy.tableEmpty}</p> : value.rows.map((row, index) => <section className="overview-table-row" key={index}>
    <h5>{copy.row} <bdi dir="ltr">{index + 1}</bdi></h5>
    {Object.keys(row).length ? <dl>{Object.entries(row).map(([columnId, text]) => {
      const column = field?.columns?.find(item => item.id === columnId);
      return <div key={columnId}><dt>{column ? localizedLabel(language, column.ko, column.en) : <bdi dir="ltr">{columnId}</bdi>}</dt><dd dir={column?.kind === 'date' ? 'ltr' : 'auto'}>{text || copy.noValue}</dd></div>;
    })}</dl> : <p>{copy.noValue}</p>}
  </section>)}</div>;
}

/** Same-screen, read-only overview. Editing is delegated to the existing screens. */
export function SessionOverview({ session, language, pendingText = '', busy = false, onClose, onEdit }: SessionOverviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const copy = overviewCopyFor(language);
  const process = intakeProcessCopy[language] ?? intakeProcessCopy.en;
  const direction = ['ar', 'fa'].includes(language) ? 'rtl' : 'ltr';
  const data = buildSessionOverview(session);
  const decisions = Object.entries(session.topicDecisions ?? {});
  const hasDrafts = data.question14.length > 0 || data.drafts.length > 0 || data.reviews.length > 0;
  const hasAnything = pendingText.length > 0 || data.forms.length > 0 || data.facts.length > 0 || data.historyFacts.length > 0 || data.messages.length > 0 || decisions.length > 0 || hasDrafts;
  const sectionId = (name: string) => `${uid}-overview-${name}`;

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const editButton = (target: OverviewEditTarget, conversation = false) => <button type="button" className="quiet overview-edit" disabled={busy} onClick={() => onEdit(target)}>{conversation ? copy.continueConversation : copy.edit}</button>;
  const formGroups = (items: OverviewFormItem[], korean = false) => {
    const groups = new Map<string, { title: string; items: OverviewFormItem[] }>();
    for (const item of items) {
      const key = item.section?.id ?? 'other';
      if (!groups.has(key)) groups.set(key, { title: item.section ? localizedLabel(language, item.section.titleKo, item.section.titleEn) : copy.general, items: [] });
      groups.get(key)!.items.push(item);
    }
    return [...groups.entries()].map(([key, group]) => <section className="overview-group" key={key}>
      <h3>{group.title}</h3>
      {group.items.map(item => <article className="overview-entry" key={item.id} data-overview-field={item.fieldId}>
        <div className="overview-entry-heading"><h4><bdi dir="ltr">{item.fieldId}</bdi> {fieldTitle(item.fieldId, language, copy)}</h4>{(korean ? supportsDraftEdit(item.fieldId) : !!item.field && item.page >= 0) && editButton(item.target)}</div>
        {!(korean ? supportsDraftEdit(item.fieldId) : !!item.field && item.page >= 0) && <p className="overview-note">{copy.unsupportedEdit}</p>}
        {!item.visible && <p className="overview-note">{copy.hiddenAnswer}</p>}
        <FormValueView value={item.value} field={item.field} language={language} copy={copy} korean={korean} />
      </article>)}
    </section>);
  };
  const groupTitle = (group: OverviewFactGroup) => {
    if (group.topicId) {
      const topic = metadataGroups.find(item => item.id === group.topicId);
      if (topic) return localizedLabel(language, topic.ko, topic.en);
    }
    return group.section ? localizedLabel(language, group.section.titleKo, group.section.titleEn) : copy.general;
  };
  const factGroups = (groups: OverviewFactGroup[], historical = false) => groups.map((group, groupIndex) => <section className="overview-group" key={group.id}>
    <h3>{groupTitle(group)}{group.eventId && <> · {copy.row} <bdi dir="ltr">{groupIndex + 1}</bdi></>}</h3>
    {group.facts.map(fact => <article className="overview-entry" key={fact.id} data-overview-fact={fact.id}>
      <div className="overview-entry-heading"><h4>{fieldTitle(fact.requirementId, language, copy)}</h4>{!historical && requirementsById.has(fact.requirementId) && editButton({ kind: 'fact', factId: fact.id })}</div>
      <div className="overview-badges"><span className={`overview-badge ${!historical && fact.confirmed && fact.status !== 'conflict' ? 'is-confirmed' : ''}`}>{historical ? copy.previousRecord : fact.confirmed && fact.status !== 'conflict' ? copy.confirmed : copy.unconfirmed}</span><span className="overview-badge">{statusText(fact.status, copy)}</span></div>
      <p className="overview-value" dir="auto">{factValue(fact, language) || copy.noValue}</p>
      <div className="overview-qualifiers"><small>{process.certainty}: {process[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{process.knowledge}: {process[fact.knowledge]}</small>}</div>
      {fact.sourceQuotes.length > 0 && <details className="overview-evidence"><summary>{copy.sourceQuotes}</summary>{fact.sourceQuotes.map((quote, index) => <blockquote dir="auto" key={index}>{quote.quote}</blockquote>)}</details>}
    </article>)}
  </section>);

  const content = <dialog ref={dialog} className="overview-modal" lang={language} dir={direction} aria-labelledby={sectionId('title')} aria-describedby={sectionId('intro')}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="overview-header"><div><h2 id={sectionId('title')}>{copy.title}</h2><p id={sectionId('intro')}>{copy.intro}</p></div><button type="button" autoFocus className="secondary overview-close" onClick={onClose}>{copy.close}</button></header>
    <div className="overview-scroll">
      {busy && <p className="overview-notice" role="status">{copy.busyNote}</p>}
      {!hasAnything && <p className="overview-empty">{copy.empty}</p>}
      <nav className="overview-navigation" aria-label={copy.contents}>
        {data.forms.length > 0 && <a href={`#${sectionId('forms')}`}>{copy.forms}</a>}
        {(data.facts.length > 0 || decisions.length > 0) && <a href={`#${sectionId('facts')}`}>{copy.collected}</a>}
        {hasDrafts && <a href={`#${sectionId('drafts')}`}>{copy.drafts}</a>}
        {data.messages.length > 0 && <a href={`#${sectionId('messages')}`}>{copy.conversation}</a>}
        {data.historyFacts.length > 0 && <a href={`#${sectionId('history')}`}>{copy.history}</a>}
      </nav>
      {pendingText.length > 0 && <section className="overview-section" id={sectionId('pending')}><h2>{copy.pending}</h2><p className="overview-note">{copy.pendingNote}</p><p className="overview-value" dir="auto">{pendingText}</p>{editButton({ kind: 'conversation' }, true)}</section>}
      {data.forms.length > 0 && <section className="overview-section" id={sectionId('forms')}><h2>{copy.forms}</h2><p className="overview-note">{copy.formsNote}</p>{formGroups(data.forms)}</section>}
      {(data.facts.length > 0 || decisions.length > 0) && <section className="overview-section" id={sectionId('facts')}><h2>{copy.collected}</h2><p className="overview-note">{copy.collectedNote}</p>{factGroups(data.facts)}{decisions.length > 0 && <section className="overview-group"><h3>{copy.decisions}</h3>{decisions.map(([topicId, status]) => { const topic = metadataGroups.find(item => item.id === topicId); return <article className="overview-entry" key={topicId}><div className="overview-entry-heading"><h4>{topic ? localizedLabel(language, topic.ko, topic.en) : `${copy.topic} ${topicId}`}</h4>{editButton({ kind: 'conversation', topicId }, true)}</div><p>{statusText(status, copy)}</p></article>; })}</section>}</section>}
      {hasDrafts && <section className="overview-section" id={sectionId('drafts')}><h2>{copy.drafts}</h2><p className="overview-note">{copy.draftsNote}</p>
        {data.question14.length > 0 && <><h3>{copy.editedAnswers}</h3>{formGroups(data.question14, true)}</>}
        {data.drafts.length > 0 && <details className="overview-history-details" open={!data.question14.length}><summary>{copy.generatedDraft}</summary>{data.drafts.map(item => <article className="overview-entry" key={item.id}>
          <div className="overview-entry-heading"><h4><bdi dir="ltr">{item.section.questionId}</bdi> {fieldTitle(item.fieldId, language, copy)}</h4>{supportsDraftEdit(item.fieldId) && editButton(item.target)}</div>{!supportsDraftEdit(item.fieldId) && <p className="overview-note">{copy.unsupportedEdit}</p>}<p className="overview-value" lang="ko" dir="ltr">{item.section.text || copy.noValue}</p>
        </article>)}</details>}
        {data.reviews.map(review => <details className="overview-history-details" key={review.fieldId}>
          <summary>{copy.reviewHistory} · {fieldTitle(review.fieldId, language, copy)}</summary>
          {supportsDraftEdit(review.fieldId) ? editButton(review.target) : <p className="overview-note">{copy.unsupportedEdit}</p>}
          <h4>{copy.originalSentence}</h4><p className="overview-value" lang="ko" dir="ltr">{review.document.pieces.map(piece => piece.kind === 'sentence' ? piece.originalText : piece.text).join('')}</p>
          <h4>{copy.currentSentence}</h4><p className="overview-value" lang="ko" dir="ltr">{review.document.pieces.map(piece => piece.text).join('')}</p>
          {Object.entries(review.document.threads).map(([sentenceId, messages], index) => <section className="overview-review-thread" key={sentenceId}><h4>{copy.thread} <bdi dir="ltr">{index + 1}</bdi></h4>{messages.map(message => <article className={`overview-message ${message.role}`} key={message.id}>
            <b>{message.role === 'user' ? copy.original : copy.assistant}</b><p dir="auto">{message.content}</p>
            {message.proposal && <div className="overview-proposal"><strong>{copy.proposal} · {message.proposal.status === 'applied' ? copy.appliedProposal : message.proposal.status === 'dismissed' ? copy.dismissedProposal : message.proposal.status === 'stale' ? copy.staleProposal : copy.pendingProposal}</strong><p className="overview-note">{copy.before}</p><p lang="ko" dir="ltr">{message.proposal.before}</p><p className="overview-note">{copy.after}</p><p lang="ko" dir="ltr">{message.proposal.after}</p></div>}
          </article>)}</section>)}
          {Object.keys(review.document.translations).length > 0 && <section className="overview-recorded-changes"><h4>{copy.translations}</h4>{Object.entries(review.document.translations).map(([sentenceId, translation]) => <article className="overview-entry" key={sentenceId}><small><bdi dir="ltr">{translation.target}</bdi></small><p className="overview-value" lang={translation.target} dir={['ar', 'fa'].includes(translation.target) ? 'rtl' : 'ltr'}>{translation.text}</p></article>)}</section>}
          {review.document.history.length > 0 && <section className="overview-recorded-changes"><h4>{copy.changes}</h4>{review.document.history.map(change => <div className="overview-entry" key={change.id}><dl><div><dt>{copy.before}</dt><dd lang="ko" dir="ltr">{change.before}</dd></div><div><dt>{copy.after}</dt><dd lang="ko" dir="ltr">{change.after}</dd></div></dl></div>)}</section>}
        </details>)}
      </section>}
      {data.messages.length > 0 && <section className="overview-section" id={sectionId('messages')}><h2>{copy.conversation}</h2><p className="overview-note">{copy.conversationNote}</p>
        {data.messages.map((group, index) => <section className="overview-group" key={group.id}>
          <div className="overview-entry-heading"><h3>{group.topicIds.length ? group.topicIds.map(id => { const topic = metadataGroups.find(item => item.id === id); return topic ? localizedLabel(language, topic.ko, topic.en) : `${copy.topic} ${id}`; }).join(' · ') : group.requirementIds.length ? group.requirementIds.map(id => fieldTitle(id, language, copy)).join(' · ') : `${copy.conversation} ${index + 1}`}</h3>{editButton(group.target, true)}</div>
          {group.messages.map(message => <article className={`overview-message ${message.role}`} data-overview-message={message.id} key={message.id}><b>{message.role === 'user' ? copy.original : copy.assistant}</b><p dir="auto">{message.content}</p></article>)}
        </section>)}
      </section>}
      {data.historyFacts.length > 0 && <section className="overview-section" id={sectionId('history')}><h2>{copy.history}</h2><p className="overview-note">{copy.historyNote}</p><details className="overview-history-details"><summary>{copy.history} <bdi dir="ltr">({data.counts.historyFacts})</bdi></summary>{factGroups(data.historyFacts, true)}</details></section>}
    </div>
  </dialog>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
