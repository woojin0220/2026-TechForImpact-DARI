import { appendUserMessage, calculateCoverage, getActiveFacts, invalidateDraft, nextStep, eventReview } from './index.ts';
import { metadataGroups } from './metadata14.ts';
import { requirementsById, requirementsForScope, isNarrative } from './catalog.ts';
import type { IntakeSession } from './types.ts';

/** Topic controls are navigation decisions, never fabricated answers to every gap. */
export function deferCurrentTopics(session: IntakeSession, status: 'unknown' | 'skipped', text: string): IntakeSession {
  const last = session.messages.at(-1);
  const topics = last?.role === 'assistant' && last.ask?.kind === 'narrative' ? last.ask.topics ?? [] : [];
  if (!topics.length) return session;
  const next = appendUserMessage(invalidateDraft(session), text);
  return { ...next, topicAttempts: { ...session.topicAttempts, ...Object.fromEntries(topics.map(id => [id, 2])) },
    topicDecisions: { ...session.topicDecisions, ...Object.fromEntries(topics.map(id => [id, status])) } };
}

export function journeyTopics(session: IntakeSession) {
  const scope = requirementsForScope(session.scope);
  const coverage = calculateCoverage(session);
  const last = session.messages.at(-1);
  const current = last?.role === 'assistant' && last.ask?.kind === 'narrative' ? last.ask.topics ?? [] : [];
  const done = nextStep(session).kind === 'done';
  return metadataGroups.filter(group => scope.some(r => isNarrative(r) && (r.id === group.id || r.id.startsWith(`${group.id}.`))))
    .map(group => {
      const entries = coverage.filter(c => c.requirementId === group.id || c.requirementId.startsWith(`${group.id}.`));
      const unresolved = entries.some(c => ['missing', 'blocked', 'conflict'].includes(c.status));
      return { ...group, state: session.topicDecisions?.[group.id] ?? (!done && current.includes(group.id) ? 'current' :
        !unresolved ? 'discussed' : session.topicAttempts[group.id] ? 'needs_review' : 'upcoming') };
    });
}

/** Confirmation belongs to exact fact revisions, not a topic ID that could go stale. */
export function reviewBundles(session: IntakeSession) {
  const groups = new Map<string, { id: string; topic: string; eventId?: string; factIds: string[] }>();
  const active = getActiveFacts(session);
  for (const fact of active) {
    const topic = metadataGroups.find(g => fact.requirementId === g.id || fact.requirementId.startsWith(`${g.id}.`))?.id ?? 'form';
    const id = `${topic}/${fact.eventId ?? 'general'}`;
    if (!groups.has(id)) groups.set(id, { id, topic, eventId: fact.eventId, factIds: [] });
    groups.get(id)!.factIds.push(fact.id);
  }
  return [...groups.values()].map(bundle => {
    const facts = active.filter(f => bundle.factIds.includes(f.id));
    return { ...bundle, facts, confirmed: facts.every(f => f.confirmed),
      needsClarification: facts.some(f => f.status === 'conflict' || !!f.clarification?.length),
      labelKo: metadataGroups.find(g => g.id === bundle.topic)?.ko ?? '기본정보',
      labelEn: metadataGroups.find(g => g.id === bundle.topic)?.en ?? 'Application details' };
  });
}

export function finalIssues(session: IntakeSession) {
  const events = eventReview(session);
  const eventIssues = events.flatMap(event => [...new Set([...event.missingRequirementIds, ...event.unknownRequirementIds])].map(requirementId => ({
    requirementId, eventId: event.eventId,
    eventNumber: events.filter(e => e.groupId === event.groupId).findIndex(e => e.eventId === event.eventId) + 1,
    status: getActiveFacts(session).find(f => f.requirementId === requirementId && f.eventId === event.eventId)?.status ?? 'missing',
    factIds: event.factIds,
  })));
  return [...calculateCoverage(session).filter(c => !['answered', 'not_applicable'].includes(c.status)
    && !eventIssues.some(e => e.requirementId === c.requirementId)).map(c => ({ ...c, eventId: undefined, eventNumber: undefined })), ...eventIssues].map(c => ({ ...c,
    ko: requirementsById.get(c.requirementId)?.label ?? c.requirementId,
    en: requirementsById.get(c.requirementId)?.labelEn ?? c.requirementId }));
}
