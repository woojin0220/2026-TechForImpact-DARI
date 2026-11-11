import { eventReview, isFormSection, isNarrative, requirementsById, type CoverageEntry, type CoverageStatus, type IntakeFact, type IntakeSession } from '../intake';
import { statusWords } from '../statusCopy';
import { StatementDetails } from '../StatementDetails';
import { ReviewSummaries } from '../JourneyPanels';
import { factValue, requirementLabel } from './labels';
import { factGroups } from './review';
import type { BusyKind } from './useModelTask';
import type { AppTexts } from './texts';

type Props = {
  texts: AppTexts;
  language: string;
  session: IntakeSession;
  facts: IntakeFact[];
  /** Requirements whose answers contradict each other. */
  conflicts: Set<string>;
  pending: CoverageEntry[];
  busy: BusyKind | null;
  locked: boolean;
  bundlesReviewed: boolean;
  input: string;
  onInput: (text: string) => void;
  showCorrection: boolean;
  /** What the correction is about, when it was opened from the overview. */
  correctionTopic?: string;
  onConfirmBundle: (ids: string[]) => void;
  onCorrect: (fact: IntakeFact) => void;
  onClarify: (fact: IntakeFact) => void;
  onEditInForm: (fact: IntakeFact) => void;
  onReask: (fact: IntakeFact) => void;
  onSendCorrection: () => void;
  onReviewAll: (checked: boolean) => void;
  onBack: () => void;
  onDraft: () => void;
  onStop: () => void;
};

/** Review of everything collected, with sources, gaps and corrections, before drafting. */
export function FactsStage(props: Props) {
  const { texts: { copy, ui, sc }, language, session, facts, conflicts, pending, busy, locked, input } = props;
  const label = (id: string) => requirementLabel(id, language);
  const value = (id: string, answer: string | string[], other?: string) => factValue(id, answer, language, other);
  const eventsToReview = eventReview(session);
  return <>
    {conflicts.size > 0 && <div className="notice" role="status">{statusWords[language].conflict} · {conflicts.size}<p>{copy.factsIntro}</p></div>}
    {!facts.length && <p className="empty-state">{copy.noFacts}</p>}
    <ReviewSummaries session={session} language={language} busy={locked} value={value} label={label} onConfirm={props.onConfirmBundle} onCorrect={props.onCorrect} />
    <details className="details"><summary>{ui.detailSources}</summary>
      <div className="fact-groups">{factGroups(facts, language).map(group => {
        const incidents = group.events.filter(item => item.eventId);
        return <details className="fact-group" key={group.key} open={group.story}>
          <summary><span>{group.label}</span><span className="fact-count-chip">{group.facts.length}</span>{group.facts.some(fact => conflicts.has(fact.requirementId)) && <span className="small-tag">{statusWords[language].conflict}</span>}</summary>
          {group.events.map(({ eventId, facts: items }) => <div className="fact-event" key={eventId || 'general'}>
            {eventId && incidents.length > 0 && <p className="event-label">{sc.row.replace('{n}', String(incidents.findIndex(item => item.eventId === eventId) + 1))}</p>}
            {eventsToReview.filter(event => event.eventId === eventId && event.groupId === group.key && event.missingRequirementIds.length > 0).map(event => <details className="fact-more" key={`${event.groupId}/${eventId}`}>
              <summary>{ui.eventMissing} · {event.missingRequirementIds.length}</summary>
              <ul>{event.missingRequirementIds.map(id => <li key={id}>{label(id)}</li>)}</ul>
            </details>)}
            {items.map(fact => <FactRow key={fact.id} {...props} fact={fact} status={conflicts.has(fact.requirementId) ? 'conflict' : fact.status} />)}
          </div>)}
        </details>;
      })}</div>
    </details>
    <details className="details"><summary>{copy.missing} · {pending.length}</summary><div className="details-content"><ul className="pending-list">{pending.map(item => <li key={item.requirementId}>{label(item.requirementId)} — {statusWords[language]?.[item.status]}</li>)}</ul></div></details>
    {props.showCorrection && <form className="panel" data-overview-correction style={{ marginTop: 22 }} onSubmit={event => { event.preventDefault(); props.onSendCorrection(); }}>
      <label>{copy.correction}{props.correctionTopic !== undefined && <span className="micro">{props.correctionTopic}</span>}<textarea dir="auto" value={input} rows={3} maxLength={12000} placeholder={copy.correctionPlaceholder} onChange={event => props.onInput(event.target.value)} disabled={locked} /></label>
      <div className="actions"><button className="secondary" disabled={!input.trim() || locked}>{copy.send}</button></div>
    </form>}
    <div className="review-bar">
      {facts.length > 0 && <label className="check-row"><input type="checkbox" checked={props.bundlesReviewed} onChange={event => props.onReviewAll(event.target.checked)} disabled={locked} />{ui.reviewedAll}</label>}
      <div className="actions">
        <button className="secondary" disabled={locked} onClick={props.onBack}>{copy.back}</button>
        <button className="primary" disabled={!props.bundlesReviewed || locked || !facts.some(item => item.status === 'answered')} onClick={props.onDraft}>{busy === 'draft' ? copy.drafting : copy.draftAction}</button>
        {busy && <button className="secondary" onClick={props.onStop}>{copy.stop}</button>}
      </div>
    </div>
  </>;
}

/** One collected answer with its status, sources and a way to change it. */
function FactRow({ texts: { copy, sc, process }, language, locked, fact, status, onClarify, onEditInForm, onReask }: Props & { fact: IntakeFact; status: CoverageStatus }) {
  const requirement = requirementsById.get(fact.requirementId);
  return <article className="fact-row">
    <div className="fact-row-main"><small>{requirementLabel(fact.requirementId, language)}</small><p dir="auto">{factValue(fact.requirementId, fact.value, language, fact.otherText)}</p></div>
    {status !== 'answered' && <span className={`small-tag status-${status}`}>{statusWords[language]?.[status] ?? status}</span>}
    {isNarrative(requirement!) && !requirement?.gate && <StatementDetails fact={fact} language={language} disabled={locked} onClarify={() => onClarify(fact)} />}
    <details className="fact-more"><summary>{copy.source}</summary>
      {fact.sourceQuotes.map((quote, quoteIndex) => <blockquote key={quoteIndex} dir="auto">{quote.quote}</blockquote>)}
      <div className="fact-qualifiers"><small>{process.certainty}: {process[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{process.knowledge}: {process[fact.knowledge]}</small>}</div>
      {isFormSection(fact.requirementId)
        ? <button className="quiet" disabled={locked} onClick={() => onEditInForm(fact)}>{sc.editInForm}</button>
        : requirement?.collection !== 'conversation' && <button className="quiet" disabled={locked} onClick={() => onReask(fact)}>{sc.reask}</button>}
    </details>
  </article>;
}
