import type { IntakeFact, IntakeSession } from './intake';
import { journeyTopics, reviewBundles, finalIssues } from './intake/journey';
import './journey.css';

function topicTitle(id: string, fallback: string, ko: boolean) {
  const titles: Record<string, [string, string]> = { grounds: ['신청하려는 이유', 'Why you are seeking protection'], harm: ['겪으신 일', 'What happened to you'], fear: ['귀국 시 걱정되는 일', 'What worries you about returning'] };
  return titles[id]?.[ko ? 0 : 1] ?? fallback;
}
function detailTitle(id: string, fallback: string, ko: boolean) {
  const titles: Record<string, [string, string]> = {
    summary: ['신청하려는 이유', 'Why you are seeking protection'], identity: ['관련된 배경', 'Relevant background'], perceived: ['상대방이 알게 된 경위', 'How they knew about you'],
    event: ['겪으신 일', 'What happened'], type: ['피해 종류', 'Kind of harm'], time: ['언제', 'When'], place: ['어디서', 'Where'], actor: ['누가', 'Who was involved'],
    reason: ['그렇게 생각하는 이유', 'Why you believe this'], release: ['풀려난 경위', 'How you were released'], result: ['이후의 영향', 'What happened afterwards'],
  };
  if (id === 'harm') return ko ? '과거 피해 여부' : 'Have you experienced harm?';
  if (id === 'fear') return ko ? '귀국 시 우려 여부' : 'Are you afraid of returning?';
  if (id === 'fear.harm') return ko ? '걱정되는 일' : 'What you fear';
  return titles[id.split('.').at(-1) ?? '']?.[ko ? 0 : 1] ?? fallback;
}

export function TopicProgress({ session, language }: { session: IntakeSession; language: string }) {
  const ko = language === 'ko';
  const topics = journeyTopics(session);
  const labels: Record<string, string> = ko
    ? { current: '지금 이야기하는 주제', discussed: '이야기 나눔', needs_review: '추가 확인 필요', upcoming: '아직 이야기하지 않음', unknown: '모름', skipped: '나중에 답하기' }
    : { current: 'Talking about now', discussed: 'Discussed', needs_review: 'Needs review', upcoming: 'Not discussed yet', unknown: 'Unknown', skipped: 'Deferred' };
  return <section className="topic-progress" aria-label={ko ? '대화 진행 상황' : 'Conversation topics'}>
    <h2>{ko ? '대화 진행 상황' : 'Your conversation'}</h2>
    <p role="status">{!session.narrativeDone ? (ko ? '지금: 자유롭게 이야기하기' : 'Now: Your story') : topics.some(t => t.state === 'current') ? `${ko ? '지금: ' : 'Now: '}${topics.filter(t => t.state === 'current').map(t => topicTitle(t.id, ko ? t.ko : t.en, ko)).join(' · ')}` : (ko ? '수집한 내용을 확인할 수 있습니다.' : 'You can review the information collected so far.')}</p>
    <p className="micro">{!session.narrativeDone ? (ko ? '먼저 편하게 이야기해 주세요. 이후 필요한 부분만 더 여쭤보겠습니다.' : 'Start with your story. Afterwards, we will ask about information that is still needed.') : (ko ? '답하기 어려운 내용은 모른다고 하거나 나중으로 남겨둘 수 있습니다.' : 'You can say you do not know or leave a topic for later.')}</p>
    <details><summary>{ko ? '전체 주제 보기' : 'See all topics'}</summary><ol>{topics.map(topic => <li key={topic.id} aria-current={topic.state === 'current' ? 'step' : undefined}><span>{topicTitle(topic.id, ko ? topic.ko : topic.en, ko)}</span><small>{labels[topic.state]}</small></li>)}</ol></details>
  </section>;
}

export function ReviewSummaries({ session, language, busy, value, label, onConfirm, onCorrect }: {
  session: IntakeSession; language: string; busy: boolean;
  value: (id: string, value: string | string[]) => string; label: (id: string) => string;
  onConfirm: (ids: string[]) => void; onCorrect: (fact: IntakeFact) => void;
}) {
  const ko = language === 'ko';
  const bundles = reviewBundles(session);
  const deferred = journeyTopics(session).filter(topic => session.topicDecisions?.[topic.id]);
  return <section className="story-summaries" aria-label={ko ? '주제별 확인' : 'Check your account'}>
    <p>{ko ? '주제와 사건별로 모은 내용입니다. 틀린 부분은 수정하고, 맞는 내용은 확인해 주세요.' : 'Check the information grouped by topic and incident. Correct anything that does not reflect what you meant.'}</p>
    {deferred.length > 0 && <p className="micro">{ko ? '답변을 남겨둔 주제: ' : 'Topics left open: '}{deferred.map(topic => `${topicTitle(topic.id, ko ? topic.ko : topic.en, ko)} (${session.topicDecisions?.[topic.id] === 'unknown' ? (ko ? '모름' : 'Unknown') : (ko ? '나중에 답하기' : 'Deferred')})`).join(' · ')}</p>}
    {bundles.map((bundle, index) => {
      // Verbatim values with labels: do not invent a new AI summary or lose qualifiers.
      const seen = new Set<string>();
      const items = bundle.facts.filter(fact => {
        const text = value(fact.requirementId, fact.value);
        const key = `${fact.status}/${text}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      return <article className="story-summary" key={bundle.id}>
        <h3>{topicTitle(bundle.topic, ko ? bundle.labelKo : bundle.labelEn, ko)}{bundle.eventId && ` · ${ko ? '사건' : 'Entry'} ${bundles.filter(b => b.topic === bundle.topic && b.eventId).findIndex(b => b.id === bundle.id) + 1}`}</h3>
        {bundle.needsClarification && <p className="draft-missing">{ko ? '불명확한 내용이 있습니다. 원래 의도를 확인해 주세요.' : 'Some information is unclear. Please check what you meant.'}</p>}
        <dl>{items.map(fact => <div key={fact.id}><dt>{detailTitle(fact.requirementId, label(fact.requirementId), ko)}</dt><dd dir="auto">{value(fact.requirementId, fact.value)}
          {fact.status !== 'answered' && <small className="summary-qualifier">{ko ? (fact.status === 'unknown' ? '모름' : fact.status === 'skipped' ? '답변 보류' : fact.status === 'not_applicable' ? '해당 없음' : '다시 확인 필요') : fact.status.replaceAll('_', ' ')}</small>}
          {fact.certainty !== 'exact' && <small className="summary-qualifier">{ko ? (fact.certainty === 'uncertain' ? '불확실함' : '대략적임') : fact.certainty}</small>}
          {['heard', 'inferred'].includes(fact.knowledge) && <small className="summary-qualifier">{ko ? (fact.knowledge === 'heard' ? '전해 들음' : '추정') : fact.knowledge === 'heard' ? 'Heard from others' : 'Interpretation'}</small>}
          <button className="quiet" disabled={busy} onClick={() => onCorrect(fact)}>{ko ? '수정' : 'Correct'}</button>
        </dd></div>)}</dl>
        <label className="check-row"><input type="checkbox" checked={bundle.confirmed} disabled={busy} onChange={() => onConfirm(bundle.factIds)} aria-label={`${ko ? '내용 확인' : 'Confirm information'} ${index + 1}`} />{ko ? '이 내용이 제 답변을 올바르게 반영합니다.' : 'This reflects what I told you.'}</label>
      </article>;
    })}
  </section>;
}

export function FinalCheck({ session, language, checked, onCheck, ready, onReturn }: {
  session: IntakeSession; language: string; checked: boolean; ready: boolean;
  onCheck: (value: boolean) => void; onReturn: () => void;
}) {
  const ko = language === 'ko';
  const issues = finalIssues(session);
  const deferred = journeyTopics(session).filter(topic => session.topicDecisions?.[topic.id]);
  const statuses: Record<string, string> = ko ? { missing: '미답변', blocked: '앞선 답변 확인 필요', unknown: '모름', skipped: '답변 보류', conflict: '다시 확인 필요' } : { missing: 'Not answered', blocked: 'Depends on an earlier answer', unknown: 'Unknown', skipped: 'Deferred', conflict: 'Needs clarification' };
  return <section className="panel final-check">
    <h2>{ko ? '저장 전 마지막 확인' : 'Before you save'}</h2>
    <p>{ko ? '초안이 준비되었습니다. 저장해도 신청서가 제출되지는 않습니다.' : 'Your draft is ready. Saving it does not submit an application.'}</p>
    {deferred.length > 0 && <p>{ko ? '모름·보류로 남겨둔 주제: ' : 'Topics you marked unknown or deferred: '}{deferred.map(topic => topicTitle(topic.id, ko ? topic.ko : topic.en, ko)).join(' · ')}</p>}
    <details><summary>{ko ? '남아 있는 확인 항목' : 'Items still to check'} · {issues.length}</summary>
      <ul>{issues.map(issue => <li key={`${issue.requirementId}/${issue.eventId ?? ''}`}>{issue.eventNumber && `${ko ? '사건' : 'Entry'} ${issue.eventNumber} · `}{detailTitle(issue.requirementId, ko ? issue.ko : issue.en, ko)} <small>({statuses[issue.status] ?? issue.status})</small></li>)}</ul>
      {issues.length > 0 && <button className="secondary" onClick={onReturn}>{ko ? '수집 내용으로 돌아가기' : 'Return to your information'}</button>}
    </details>
    {!ready && <p role="status">{ko ? '확인본을 준비하고 있습니다.' : language === 'en' ? 'Preparing the English text for your review. Resolve any translation errors above before confirming.' : 'Draft review translation is currently supported in English only. You may save an unchecked work-in-progress record.'}</p>}
    <label className="check-row"><input type="checkbox" checked={checked && ready} disabled={!ready} onChange={e => onCheck(e.target.checked)} />{ko ? '초안의 의미를 확인했고 남아 있는 확인 항목을 살펴봤습니다.' : 'I checked the meaning of the draft and the outstanding items.'}</label>
    <p className="micro">{checked && ready ? (ko ? '의미 확인을 표시했습니다. 미해결 항목이 모두 해결되었다는 뜻은 아닙니다.' : 'Meaning review recorded. This does not mean every outstanding item has been resolved.') : (ko ? '확인 전에도 작업 중인 초안을 저장할 수 있습니다.' : 'You can also save a work-in-progress draft before completing this check.')}</p>
    <dl className="save-options"><div><dt>{ko ? '한국어 초안' : 'Korean draft'}</dt><dd>{ko ? '현재 신청서 내용을 텍스트 파일로 저장합니다.' : 'A text file of the current application draft.'}</dd></div><div><dt>{ko ? '전체 작업 기록' : 'Full working record'}</dt><dd>{ko ? '원문·메타데이터·초안과 수정 기록이 포함된 JSON입니다. 개인정보가 포함될 수 있습니다.' : 'JSON containing your original answers, metadata, draft and edit history. It may contain personal information.'}</dd></div></dl>
  </section>;
}
