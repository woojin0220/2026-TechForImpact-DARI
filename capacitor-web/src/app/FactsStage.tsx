import { isNarrative, isFormSection, requirementsById } from '../intake';
import { localizedLabel } from '../form/localize';
import { statusWords } from '../statusCopy';
import { formPageOf } from '../FormStage';
import { StatementDetails } from '../StatementDetails';
import { ReviewSummaries } from '../JourneyPanels';
import { type DariApp } from './useDariApp';

/** Collected-facts review step. */
export function FactsStage({ app }: { app: DariApp }) {
  const { stage, setFormPage, language, session, setSession, input, setInput, busy, setReviewed, main, overviewTarget, recoveryPending, copy, ui, sc, processCopy, facts, eventsToReview, conflicts, pending, narrativeOpened, requirementLabel, factValue, factGroups, reask, bundlesReviewed, confirmBundle, setStage, clarify, stop, draft, overviewFact, overviewTopic, sendCorrection } = app;
  return <>
        {stage === 'facts' && <>
          {conflicts.size > 0 && <div className="notice" role="status">{statusWords[language].conflict} · {conflicts.size}<p>{copy.factsIntro}</p></div>}
          {!facts.length && <p className="empty-state">{copy.noFacts}</p>}
          <ReviewSummaries session={session} language={language} busy={(!!busy || recoveryPending)} value={factValue} label={requirementLabel} onConfirm={confirmBundle} onCorrect={fact => isFormSection(fact.requirementId) ? (setFormPage(formPageOf(fact.requirementId)), setStage('form')) : requirementsById.get(fact.requirementId)?.collection === 'conversation' ? void clarify(fact) : reask(fact)} />
          <details className="details"><summary>{ui.detailSources}</summary>
          <div className="fact-groups">{factGroups().map(group => <details className="fact-group" key={group.key} open={group.story}>
            <summary><span>{group.label}</span><span className="fact-count-chip">{group.facts.length}</span>{group.facts.some(fact => conflicts.has(fact.requirementId)) && <span className="small-tag">{statusWords[language].conflict}</span>}</summary>
            {group.events.map(({ eventId, facts: items }, index) => <div className="fact-event" key={eventId || 'general'}>
              {eventId && group.events.filter(item => item.eventId).length > 0 && <p className="event-label">{sc.row.replace('{n}', String(group.events.filter(item => item.eventId).findIndex(item => item.eventId === eventId) + 1))}</p>}
              {eventsToReview.filter(event => event.eventId === eventId && event.groupId === group.key && event.missingRequirementIds.length > 0).map(event => <details className="fact-more" key={`${event.groupId}/${eventId}`}><summary>{ui.eventMissing} · {event.missingRequirementIds.length}</summary><ul>{event.missingRequirementIds.map(id => <li key={id}>{requirementLabel(id)}</li>)}</ul></details>)}
              {items.map(fact => { const status = conflicts.has(fact.requirementId) ? 'conflict' : fact.status; return <article className="fact-row" key={fact.id}>
                <div className="fact-row-main"><small>{requirementLabel(fact.requirementId)}</small><p dir="auto">{factValue(fact.requirementId, fact.value, fact.otherText)}</p></div>
                {status !== 'answered' && <span className={`small-tag status-${status}`}>{statusWords[language]?.[status] ?? status}</span>}
                {isNarrative(requirementsById.get(fact.requirementId)!) && !requirementsById.get(fact.requirementId)?.gate && <StatementDetails fact={fact} language={language} disabled={(!!busy || recoveryPending)} onClarify={() => void clarify(fact)} />}
                <details className="fact-more"><summary>{copy.source}</summary>
                  {fact.sourceQuotes.map((quote, quoteIndex) => <blockquote key={quoteIndex} dir="auto">{quote.quote}</blockquote>)}
                  <div className="fact-qualifiers"><small>{processCopy.certainty}: {processCopy[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{processCopy.knowledge}: {processCopy[fact.knowledge]}</small>}</div>
                  {isFormSection(fact.requirementId) ? <button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => { setFormPage(formPageOf(fact.requirementId)); setStage('form'); }}>{sc.editInForm}</button> : requirementsById.get(fact.requirementId)?.collection !== 'conversation' && <button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => reask(fact)}>{sc.reask}</button>}
                </details>
              </article>; })}
            </div>)}
          </details>)}</div>
          </details>
          <details className="details"><summary>{copy.missing} · {pending.length}</summary><div className="details-content"><ul className="pending-list">{pending.map(item => <li key={item.requirementId}>{requirementLabel(item.requirementId)} — {statusWords[language]?.[item.status]}</li>)}</ul></div></details>
          {(narrativeOpened || overviewTarget?.kind === 'fact' || overviewTarget?.kind === 'conversation') && <form className="panel" data-overview-correction style={{ marginTop: 22 }} onSubmit={event => { event.preventDefault(); void sendCorrection(); }}><label>{copy.correction}{(overviewFact || overviewTopic) && <span className="micro">{overviewFact ? requirementLabel(overviewFact.requirementId) : localizedLabel(language, overviewTopic!.ko, overviewTopic!.en)}</span>}<textarea dir="auto" value={input} rows={3} maxLength={12000} placeholder={copy.correctionPlaceholder} onChange={event => setInput(event.target.value)} disabled={(!!busy || recoveryPending)} /></label><div className="actions"><button className="secondary" disabled={!input.trim() || (!!busy || recoveryPending)}>{copy.send}</button></div></form>}
          <div className="review-bar">{facts.length > 0 && <label className="check-row"><input type="checkbox" checked={bundlesReviewed} onChange={event => { setReviewed(event.target.checked); setSession(current => ({ ...current, facts: current.facts.map(f => ({ ...f, confirmed: event.target.checked })) })); }} disabled={(!!busy || recoveryPending)} />{ui.reviewedAll}</label>}
          <div className="actions"><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => setStage('conversation')}>{copy.back}</button><button className="primary" disabled={!bundlesReviewed || (!!busy || recoveryPending) || !facts.some(item => item.status === 'answered')} onClick={() => void draft()}>{busy === 'draft' ? copy.drafting : copy.draftAction}</button>{busy && <button className="secondary" onClick={() => void stop()}>{copy.stop}</button>}</div></div>
        </>}
  </>;
}
