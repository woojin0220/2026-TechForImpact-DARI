import type { IntakeFact, IntakeSession } from './intake';
import { journeyTopics, reviewBundles, finalIssues } from './intake/journey';
import { journeyCopyFor, journeyTopicTitle, journeyDetailTitle, journeyStatusLabel } from './journeyCopy';
import './journey.css';

export function TopicProgress({ session, language }: { session: IntakeSession; language: string }) {
  const copy = journeyCopyFor(language);
  const topics = journeyTopics(session);
  const current = topics.filter(topic => topic.state === 'current');
  return <section className="topic-progress" aria-label={copy.conversationTopics}>
    <h2>{copy.conversationHeading}</h2>
    <p role="status">{!session.narrativeDone ? copy.nowStory : current.length ? `${copy.nowPrefix}${current.map(topic => journeyTopicTitle(topic.id, language === 'ko' ? topic.ko : topic.en, language)).join(' · ')}` : copy.canReview}</p>
    <p className="micro">{!session.narrativeDone ? copy.storyHelp : copy.topicHelp}</p>
    <details><summary>{copy.allTopics}</summary><ol>{topics.map(topic => <li key={topic.id} aria-current={topic.state === 'current' ? 'step' : undefined}><span>{journeyTopicTitle(topic.id, language === 'ko' ? topic.ko : topic.en, language)}</span><small>{copy[topic.state as 'current' | 'discussed' | 'needs_review' | 'upcoming' | 'unknown' | 'skipped']}</small></li>)}</ol></details>
  </section>;
}

export function ReviewSummaries({ session, language, busy, value, label, onConfirm, onCorrect }: {
  session: IntakeSession; language: string; busy: boolean;
  value: (id: string, value: string | string[]) => string; label: (id: string) => string;
  onConfirm: (ids: string[]) => void; onCorrect: (fact: IntakeFact) => void;
}) {
  const copy = journeyCopyFor(language);
  const bundles = reviewBundles(session);
  const deferred = journeyTopics(session).filter(topic => session.topicDecisions?.[topic.id]);
  return <section className="story-summaries" aria-label={copy.reviewLabel}>
    <p>{copy.reviewIntro}</p>
    {deferred.length > 0 && <p className="micro">{copy.topicsOpen}{deferred.map(topic => `${journeyTopicTitle(topic.id, language === 'ko' ? topic.ko : topic.en, language)} (${session.topicDecisions?.[topic.id] === 'unknown' ? copy.unknown : copy.skipped})`).join(' · ')}</p>}
    {bundles.map((bundle, index) => {
      // Values and evidence remain verbatim; only application-owned labels are localized.
      const seen = new Set<string>();
      const items = bundle.facts.filter(fact => { const text = value(fact.requirementId, fact.value); const key = `${fact.status}/${text}`; if (seen.has(key)) return false; seen.add(key); return true; });
      return <article className="story-summary" key={bundle.id}>
        <h3>{journeyTopicTitle(bundle.topic, language === 'ko' ? bundle.labelKo : bundle.labelEn, language)}{bundle.eventId && <> · {copy.entry} <bdi>{bundles.filter(b => b.topic === bundle.topic && b.eventId).findIndex(b => b.id === bundle.id) + 1}</bdi></>}</h3>
        {bundle.needsClarification && <p className="draft-missing">{copy.needsClarification}</p>}
        <dl>{items.map(fact => <div key={fact.id}><dt>{journeyDetailTitle(fact.requirementId, label(fact.requirementId), language)}</dt><dd><bdi dir="auto">{value(fact.requirementId, fact.value)}</bdi>
          {fact.status !== 'answered' && <small className="summary-qualifier">{journeyStatusLabel(fact.status, language)}</small>}
          {fact.certainty !== 'exact' && <small className="summary-qualifier">{fact.certainty === 'uncertain' ? copy.uncertain : copy.approximate}</small>}
          {['heard', 'inferred'].includes(fact.knowledge) && <small className="summary-qualifier">{fact.knowledge === 'heard' ? copy.heard : copy.inferred}</small>}
          <button className="quiet" disabled={busy} onClick={() => onCorrect(fact)}>{copy.correct}</button>
        </dd></div>)}</dl>
        <label className="check-row"><input type="checkbox" checked={bundle.confirmed} disabled={busy} onChange={() => onConfirm(bundle.factIds)} aria-label={`${copy.confirmInformation} ${index + 1}`} />{copy.thisReflects}</label>
      </article>;
    })}
  </section>;
}

export function FinalCheck({ session, language, checked, onCheck, ready, onReturn }: {
  session: IntakeSession; language: string; checked: boolean; ready: boolean;
  onCheck: (value: boolean) => void; onReturn: () => void;
}) {
  const copy = journeyCopyFor(language);
  const issues = finalIssues(session);
  const deferred = journeyTopics(session).filter(topic => session.topicDecisions?.[topic.id]);
  return <section className="panel final-check">
    <h2>{copy.beforeSave}</h2><p>{copy.draftReady}</p>
    {deferred.length > 0 && <p>{copy.topicsDeferred}{deferred.map(topic => journeyTopicTitle(topic.id, language === 'ko' ? topic.ko : topic.en, language)).join(' · ')}</p>}
    <details><summary>{copy.itemsToCheck} · <bdi>{issues.length}</bdi></summary>
      <ul>{issues.map(issue => <li key={`${issue.requirementId}/${issue.eventId ?? ''}`}>{issue.eventNumber && <>{copy.entry} <bdi>{issue.eventNumber}</bdi> · </>}{journeyDetailTitle(issue.requirementId, language === 'ko' ? issue.ko : issue.en, language)} <small>({journeyStatusLabel(issue.status, language)})</small></li>)}</ul>
      {issues.length > 0 && <button className="secondary" onClick={onReturn}>{copy.returnInformation}</button>}
    </details>
    {!ready && <p role="status">{language === 'en' || language === 'ko' ? copy.preparingMeaning : copy.unsupportedMeaning}</p>}
    <label className="check-row"><input type="checkbox" checked={checked && ready} disabled={!ready} onChange={e => onCheck(e.target.checked)} />{copy.meaningChecked}</label>
    <p className="micro">{checked && ready ? copy.meaningRecorded : copy.saveBeforeCheck}</p>
    <dl className="save-options"><div><dt>{copy.koreanDraft}</dt><dd>{copy.koreanDraftDescription}</dd></div><div><dt>{copy.fullRecord}</dt><dd>{copy.fullRecordDescription}</dd></div></dl>
  </section>;
}
