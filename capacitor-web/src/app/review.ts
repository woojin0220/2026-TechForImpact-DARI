import { appendAssistantMessage, formPageOf, formSteps, isFormSection, isNarrative, metadataGroups, narrativeOpening, nextStep, pendingAsk, requirementsById, type IntakeFact, type IntakeSession } from '../intake/index.ts';
import { localizedLabel } from '../form/localize.ts';
import type { ScriptedCopy } from '../intakeCopy.ts';
import { questionText } from './labels.ts';

export type FactGroup = {
  key: string; label: string; order: number; story: boolean; facts: IntakeFact[];
  events: { eventId: string; facts: IntakeFact[] }[];
};

/** The question 14 topic a requirement belongs to, if any. */
export function topicOf(requirementId: string) {
  return metadataGroups.find(item => requirementId === item.id || requirementId.startsWith(`${item.id}.`));
}

/** Review list: question 14 groups first (from the conversation), then form sections; incidents kept apart. */
export function factGroups(facts: IntakeFact[], language: string): FactGroup[] {
  const groups = new Map<string, Omit<FactGroup, 'key' | 'events'>>();
  for (const fact of facts) {
    const requirement = requirementsById.get(fact.requirementId);
    let key = 'other', label = requirement?.label ?? fact.requirementId, order = 999, story = false;
    const group = requirement && isNarrative(requirement) ? topicOf(fact.requirementId) : undefined;
    if (group) { key = group.id; label = localizedLabel(language, group.ko, group.en); order = metadataGroups.indexOf(group); story = true; }
    else if (isFormSection(fact.requirementId)) {
      const page = formPageOf(fact.requirementId); const step = formSteps[page];
      key = `form-${page}`; label = localizedLabel(language, step.titleKo, step.titleEn); order = 100 + page;
    }
    if (!groups.has(key)) groups.set(key, { label, order, story, facts: [] });
    groups.get(key)!.facts.push(fact);
  }
  return [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([key, group]) => ({ key, ...group,
    events: [...new Set(group.facts.map(fact => fact.eventId ?? ''))].map(eventId => ({ eventId, facts: group.facts.filter(fact => (fact.eventId ?? '') === eventId) })) }));
}

type DraftSentences = { sentences?: { text: string; factIds: string[]; sourceIds: string[] }[] };

/** Each drafted sentence with the applicant's own quoted words (not form entries). */
export function sentenceOrigins(session: IntakeSession, section?: DraftSentences) {
  const userIds = new Set(session.messages.filter(message => message.role === 'user').map(message => message.id));
  return (section?.sentences ?? []).map(item => ({ text: item.text, quotes: item.factIds.flatMap(id => session.facts.find(fact => fact.id === id)?.sourceQuotes ?? [])
    .filter(quote => userIds.has(quote.sourceId)).map(quote => quote.quote) }));
}

/** Append whatever the app should say next: a fixed question, the story prompt or the closing note. */
export function syncConversation(current: IntakeSession, language: string, copy: ScriptedCopy): IntakeSession {
  const step = nextStep(current);
  const last = current.messages.at(-1);
  if (step.kind === 'ask') {
    const open = pendingAsk(current);
    if (open && open.kind === step.ask.kind && open.requirementId === step.ask.requirementId && open.eventId === step.ask.eventId) return current;
    return appendAssistantMessage(current, questionText(step.ask, language, copy, step.row), step.ask);
  }
  if (step.kind === 'narrative') {
    // Guided questions are written by the model (see the guidance effect).
    if (step.guided) return current;
    if (!current.messages.some(item => item.ask?.kind === 'narrative')) return appendAssistantMessage(current, narrativeOpening(current.language), { kind: 'narrative' });
    return last?.role === 'user' ? appendAssistantMessage(current, copy.resume, { kind: 'narrative' }) : current;
  }
  return last?.ask?.kind === 'done' || pendingAsk(current) ? current : appendAssistantMessage(current, copy.done, { kind: 'done' });
}
