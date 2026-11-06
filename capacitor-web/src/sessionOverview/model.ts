import { applicationSteps, type FormField, type FormStep } from '../form/schema.ts';
import { formSteps, isFieldVisible, type FormAnswers, type FormValue } from '../intake/form.ts';
import { getActiveFacts } from '../intake/index.ts';
import { metadataGroups } from '../intake/metadata14.ts';
import { requirementsById } from '../intake/catalog.ts';
import { narrativeFieldFor } from '../intake/derive14.ts';
import type { DraftSection, IntakeFact, IntakeSession, SourceMessage } from '../intake/types.ts';
import type { TxtDocument } from '../revision/state.mjs';

export type OverviewEditTarget =
  | { kind: 'form'; fieldId: string }
  | { kind: 'fact'; factId: string }
  | { kind: 'draft'; fieldId: string }
  | { kind: 'conversation'; messageId?: string; topicId?: string };

export type OverviewFormItem = {
  id: string;
  fieldId: string;
  value: FormValue;
  field?: FormField;
  section?: FormStep;
  /** Page in FormStage; -1 for fields outside its basic-information pages. */
  page: number;
  /** Hidden answers remain available here instead of disappearing from the overview. */
  visible: boolean;
  target: OverviewEditTarget;
};
export type OverviewFactGroup = {
  id: string;
  topicId?: string;
  page?: number;
  section?: FormStep;
  eventId?: string;
  facts: IntakeFact[];
};
export type OverviewMessageGroup = {
  id: string;
  requirementIds: string[];
  topicIds: string[];
  messages: SourceMessage[];
  target: { kind: 'conversation'; messageId?: string };
};
export type OverviewDraftItem = {
  id: string;
  fieldId: string;
  section: DraftSection;
  target: { kind: 'draft'; fieldId: string };
};
export type OverviewReviewItem = {
  fieldId: string;
  document: TxtDocument;
  target: { kind: 'draft'; fieldId: string };
};
export type SessionOverview = {
  forms: OverviewFormItem[];
  question14: OverviewFormItem[];
  facts: OverviewFactGroup[];
  historyFacts: OverviewFactGroup[];
  messages: OverviewMessageGroup[];
  drafts: OverviewDraftItem[];
  reviews: OverviewReviewItem[];
  counts: {
    formValues: number;
    question14Values: number;
    facts: number;
    historyFacts: number;
    messages: number;
    reviewMessages: number;
  };
};

const fieldLocations = new Map(applicationSteps.flatMap((section, sectionIndex) => section.fields.map((field, fieldIndex) =>
  [field.id, { field, section, order: sectionIndex * 100 + fieldIndex }] as const)));

function formItems(answers: FormAnswers, kind: 'form' | 'question14'): OverviewFormItem[] {
  // Include every stored entry, including explicit empty tables, partly filled rows,
  // hidden conditional values and IDs introduced by future schema revisions.
  return Object.entries(answers).map(([fieldId, value], index) => {
    const location = fieldLocations.get(fieldId);
    return { index, order: location?.order ?? Number.MAX_SAFE_INTEGER, item: {
      id: `${kind}:${fieldId}`, fieldId, value, field: location?.field, section: location?.section,
      page: formSteps.findIndex(step => step.fields.some(field => field.id === fieldId)),
      visible: location ? isFieldVisible(location.field, answers) : true,
      target: kind === 'question14' ? { kind: 'draft' as const, fieldId } : { kind: 'form' as const, fieldId },
    } };
  }).sort((a, b) => a.order - b.order || a.index - b.index).map(entry => entry.item);
}

function factTopic(fact: IntakeFact): string | undefined {
  return metadataGroups.find(group => fact.requirementId === group.id || fact.requirementId.startsWith(`${group.id}.`))?.id;
}

function factGroups(facts: IntakeFact[]): OverviewFactGroup[] {
  const groups = new Map<string, OverviewFactGroup>();
  for (const fact of facts) {
    const requirement = requirementsById.get(fact.requirementId);
    const fieldId = requirement?.parentId ?? fact.requirementId;
    const location = fieldLocations.get(fieldId);
    const topicId = factTopic(fact);
    const base = topicId ?? location?.section.id ?? requirement?.questionId ?? fact.requirementId;
    const id = JSON.stringify([base, fact.eventId ?? null]);
    if (!groups.has(id)) {
      const page = formSteps.findIndex(step => step.fields.some(field => field.id === fieldId));
      groups.set(id, { id, topicId, section: location?.section, page: page >= 0 ? page : undefined,
        eventId: fact.eventId, facts: [] });
    }
    groups.get(id)!.facts.push(fact);
  }
  // Preserve first-seen group/incident order. Within each group the exact facts,
  // values, provenance and confirmation flags are retained, including conflicts.
  return [...groups.values()];
}

function messageGroups(session: IntakeSession): OverviewMessageGroup[] {
  const groups: OverviewMessageGroup[] = [];
  let current: OverviewMessageGroup | undefined;
  for (const [index, message] of session.messages.entries()) {
    if (!current || (message.role === 'assistant' && message.ask)) {
      const ask = message.ask;
      current = { id: `${message.id}:${index}`, requirementIds: ask && 'requirementId' in ask ? [ask.requirementId] : [],
        topicIds: ask?.kind === 'narrative' ? [...(ask.topics ?? [])] : [], messages: [],
        target: { kind: 'conversation', messageId: message.id } };
      groups.push(current);
    }
    current.messages.push(message);
    // Add factual context without duplicating messages that support several topics.
    for (const fact of session.facts) {
      if (!fact.sourceIds.includes(message.id)) continue;
      if (!current.requirementIds.includes(fact.requirementId)) current.requirementIds.push(fact.requirementId);
      const topic = factTopic(fact);
      if (topic && !current.topicIds.includes(topic)) current.topicIds.push(topic);
    }
  }
  return groups;
}

/** A read-only view of entered records. Opening it never extracts, confirms,
 * rewrites, filters by current visibility, or sends applicant content to a model. */
export function buildSessionOverview(session: IntakeSession): SessionOverview {
  const active = getActiveFacts(session);
  const activeIds = new Set(active.map(fact => fact.id));
  const historical = session.facts.filter(fact => !activeIds.has(fact.id));
  const reviews = Object.entries(session.draftReviews ?? {}).map(([fieldId, document]) => ({
    fieldId, document, target: { kind: 'draft' as const, fieldId },
  }));
  return {
    forms: formItems(session.form, 'form'),
    question14: formItems(session.question14 ?? {}, 'question14'),
    facts: factGroups(active),
    historyFacts: factGroups(historical),
    messages: messageGroups(session),
    drafts: session.draft.map((section, index) => {
      const fieldId = narrativeFieldFor(section.questionId, session.question14 ?? {});
      return { id: `${section.questionId}:${index}`, fieldId, section, target: { kind: 'draft', fieldId } };
    }),
    reviews,
    counts: {
      formValues: Object.keys(session.form).length,
      question14Values: Object.keys(session.question14 ?? {}).length,
      facts: active.length,
      historyFacts: historical.length,
      messages: session.messages.length,
      reviewMessages: reviews.reduce((total, review) => total + Object.values(review.document.threads).reduce((count, thread) => count + thread.length, 0), 0),
    },
  };
}
