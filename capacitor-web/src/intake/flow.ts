import { requireReplyLanguage } from './replyLanguage.ts';
import { isFormSection, isNarrative, requirementsById, requirementsForScope, type Requirement } from './catalog.ts';
import { IntakeError, type CoverageStatus, type IntakeSession, type MessageAsk, type ModelAdapter, type ScriptedAsk } from './types.ts';
import { eventReview, statementQuestions } from './statements.ts';
import { OTHER_OPTION, takesOtherText } from '../form/otherChoice.ts';
import { metadataGroups } from './metadata14.ts';
import { appendUserMessage, boundedPrompt, calculateCoverage, eventMatches, getActiveFacts, message, nextFactId, now, object, parseObject, text } from './session.ts';

export type IntakeStep = { kind: 'ask'; ask: ScriptedAsk; row?: number } | { kind: 'narrative'; guided?: string[] } | { kind: 'done' };

/** Row IDs of a table: rows the model extracted plus rows the applicant opened. */
export function tableRowIds(session: IntakeSession, tableId: string): string[] {
  const ids: string[] = [];
  for (const fact of getActiveFacts(session)) {
    if (requirementsById.get(fact.requirementId)?.parentId === tableId && fact.eventId && !ids.includes(fact.eventId)) ids.push(fact.eventId);
  }
  for (let row = 1; row <= (session.tableRows[tableId] ?? 0); row += 1) if (!ids.includes(`row-${row}`)) ids.push(`row-${row}`);
  return ids;
}

/** The app, not the model, decides the next chat step. Questions 1–13 belong to
 * the form; question 14 is a free conversation until the applicant ends it; then
 * its remaining non-narrative fields and later questions are asked one by one. */
export function nextStep(session: IntakeSession): IntakeStep {
  if (session.scope === 'test') {
    if (!session.narrativeDone) return { kind: 'narrative' };
    const asked = session.messages.filter(item => item.ask?.kind === 'narrative' && item.ask.topics?.length).length;
    if (session.guidedDone || asked >= 2) return { kind: 'done' };
    const coverage = calculateCoverage(session);
    const gaps = coverage.filter(item => item.status === 'missing' || item.status === 'conflict');
    const guided = [...new Set([...statementQuestions(getActiveFacts(session)).map(item => groupOf(item.requirementId)), ...gaps.map(item => groupOf(item.requirementId))])].filter(topic => !session.topicDecisions?.[topic]);
    return guided.length ? { kind: 'narrative', guided } : { kind: 'done' };
  }
  const scope = requirementsForScope(session.scope).filter(item => item.collection !== 'personal_confirmation');
  const coverage = new Map(calculateCoverage(session).map(item => [item.requirementId, item.status]));
  const active = getActiveFacts(session);
  let topicChecked = false;
  for (const requirement of scope) {
    if (isFormSection(requirement.id)) continue;
    const parent = requirement.parentId ? requirementsById.get(requirement.parentId) : undefined;
    // Table columns and per-incident details are asked together with their parent.
    if (parent?.type === 'table' || (parent?.gate && requirement.repeatable)) continue;
    if (isNarrative(requirement)) {
      if (!session.narrativeDone) return { kind: 'narrative' };
      // After the free story, question 14 continues as a guided conversation: the model
      // asks natural questions that can fill gaps across all of question 14 at once.
      if (!topicChecked) { topicChecked = true; const guided = openGroups(session, scope, coverage); if (guided.length) return { kind: 'narrative', guided }; }
      continue;
    }
    const status = coverage.get(requirement.id);
    if (requirement.type !== 'table' && !requirement.gate) {
      if (status === 'missing') return { kind: 'ask', ask: { kind: 'field', requirementId: requirement.id } };
      continue;
    }
    if (status === 'blocked' || status === 'not_applicable' || status === 'conflict') continue;
    const records = active.filter(fact => fact.requirementId === requirement.id);
    if (!records.length) return { kind: 'ask', ask: { kind: requirement.gate ? 'field' : 'table', requirementId: requirement.id } };
    const opened = requirement.gate ? records.some(fact => fact.status === 'answered' && fact.value === 'yes') : records.some(fact => fact.status === 'answered');
    if (!opened) continue;
    // Entries are asked row by row for tables and table-like groups; for narrative
    // groups only the short choices of incidents already described are asked.
    const rowByRow = requirement.type === 'table' || !!requirement.rows;
    const columns = scope.filter(item => item.parentId === requirement.id && item.repeatable && item.collection === 'direct');
    let rows = tableRowIds(session, requirement.id);
    if (!rows.length && rowByRow) rows = ['row-1'];
    for (const [index, eventId] of rows.entries()) {
      for (const column of columns) {
        if (!eventMatches(column, eventId, active)) continue;
        if (!active.some(fact => fact.requirementId === column.id && fact.eventId === eventId)) {
          return { kind: 'ask', ask: { kind: 'field', requirementId: column.id, eventId }, row: index + 1 };
        }
      }
    }
    if (rowByRow && !session.closedTables.includes(requirement.id)) return { kind: 'ask', ask: { kind: 'more', requirementId: requirement.id } };
  }
  return { kind: 'done' };
}

export const MAX_TOPIC_ASKS = 2;
export const groupOf = (id: string) => id.split('.')[0];
/** Question 14 groups with applicable gaps that have not been asked about too often. */
export function openGroups(session: IntakeSession, scope: Requirement[], coverage: Map<string, CoverageStatus>): string[] {
  if (session.guidedDone) return [];
  const narrative = scope.filter(isNarrative);
  return [...new Set(narrative.map(item => groupOf(item.id)))].filter(group => (session.topicAttempts[group] ?? 0) < MAX_TOPIC_ASKS
    && (narrative.some(item => groupOf(item.id) === group && ['missing', 'conflict'].includes(coverage.get(item.id) ?? ''))
      || statementQuestions(getActiveFacts(session)).some(item => groupOf(item.requirementId) === group)));
}

/** Append an app-authored assistant message (fixed question, narrative prompt or closing note). */
export function appendAssistantMessage(session: IntakeSession, content: string, ask: MessageAsk): IntakeSession {
  return { ...session, messages: [...session.messages, message('assistant', content, session.messages.length + 1, ask)], updatedAt: now() };
}

export function pendingAsk(session: IntakeSession): ScriptedAsk | undefined {
  const last = session.messages.at(-1);
  return last?.role === 'assistant' && last.ask && ['field', 'table', 'more'].includes(last.ask.kind) ? last.ask as ScriptedAsk : undefined;
}

export type ScriptedAnswer = { text: string; status: 'answered' | 'unknown' | 'skipped' | 'not_applicable'; value?: string | string[]; other?: string };

/** Record the applicant's answer to the pending fixed question without any model call.
 * The answer message is the verbatim source; a repeated question supersedes the old value. */
export function answerScripted(session: IntakeSession, answer: ScriptedAnswer): IntakeSession {
  const ask = pendingAsk(session);
  if (!ask) throw new IntakeError('지금 답할 질문이 없습니다.', session);
  const next = appendUserMessage(session, answer.text);
  const source = next.messages.at(-1)!;
  const tableRows = { ...session.tableRows };
  let closedTables = session.closedTables;
  let facts = session.facts;
  if (ask.kind === 'more') {
    if (answer.value === 'yes') {
      const numbers = tableRowIds(session, ask.requirementId).map(id => Number(/^row-(\d+)$/.exec(id)?.[1] ?? 0));
      tableRows[ask.requirementId] = Math.max(session.tableRows[ask.requirementId] ?? 0, ...numbers) + 1;
    }
    else closedTables = [...closedTables, ask.requirementId];
  } else {
    const requirement = requirementsById.get(ask.requirementId)!;
    const eventId = requirement.repeatable && ask.kind === 'field' ? ask.eventId : undefined;
    const value = answer.status === 'answered' && answer.value !== undefined ? answer.value : answer.text;
    if (answer.status === 'answered' && requirement.options && ask.kind === 'field') {
      const values = Array.isArray(value) ? value : [value];
      if (!values.length || values.some(item => !requirement.options!.some(option => option.value === item)) || (requirement.type === 'single' && values.length !== 1)) {
        throw new IntakeError('선택지에서 골라 주세요.', session);
      }
    }
    const supersedes = getActiveFacts(session).filter(fact => fact.requirementId === requirement.id && fact.eventId === eventId).map(fact => fact.id);
    const chosen = Array.isArray(value) ? value : [value];
    const otherText = answer.status === 'answered' && chosen.includes(OTHER_OPTION) && takesOtherText(requirement.id, requirement.options) ? answer.other?.trim() || undefined : undefined;
    facts = [...facts, {
      id: nextFactId(session.facts), requirementId: requirement.id, value,
      sourceIds: [source.id], sourceQuotes: [{ sourceId: source.id, quote: source.content }],
      status: answer.status, certainty: 'exact', knowledge: 'unspecified',
      eventId, supersedes, confirmed: false,
      ...(otherText ? { otherText } : {}),
    }];
    if (ask.kind === 'table' && answer.status === 'answered' && !tableRowIds(session, requirement.id).length) tableRows[requirement.id] = 1;
  }
  const result = { ...next, facts, tableRows, closedTables };
  return { ...result, coverage: calculateCoverage(result) };
}

/** Ask a fixed question again so the applicant can correct a recorded value. */
export function reaskQuestion(session: IntakeSession, content: string, ask: ScriptedAsk): IntakeSession {
  return appendAssistantMessage(session, content, ask);
}

/** End the free story (then guided questions follow), or end the guided questions. */
export function finishNarrative(session: IntakeSession): IntakeSession {
  return session.narrativeDone ? { ...session, guidedDone: true, updatedAt: now() } : { ...session, narrativeDone: true, updatedAt: now() };
}

/** Append a guided question and count it against the topics it targets. */
export function openTopic(session: IntakeSession, topics: string[], content: string): IntakeSession {
  const topicAttempts = { ...session.topicAttempts };
  for (const topic of topics) topicAttempts[topic] = (topicAttempts[topic] ?? 0) + 1;
  return { ...appendAssistantMessage(session, content, { kind: 'narrative', topics }), narrativeFocus: topics.join(', '), topicAttempts };
}

/** A guided question is due: the applicant answered, or the last message is not a guided question. */
export function needsTopicQuestion(session: IntakeSession): boolean {
  const step = nextStep(session);
  if (step.kind !== 'narrative' || !step.guided) return false;
  const last = session.messages.at(-1);
  return last?.role === 'user' || !(last?.ask?.kind === 'narrative' && 'topics' in last.ask && last.ask.topics?.length);
}

export const topicSystem = `You are DARI, helping a refugee applicant tell their account in their own language. Write ONE short, warm, neutral question in the session language that asks ONLY about the subjects in askAbout (their "meaning" says what to ask; "stillMissing" lists details worth inviting). If there are several subjects, ask about them together in one natural sentence. Do NOT continue other parts of the story and do not ask about anything not in askAbout. Do not ask again for anything in alreadyKnown; ask only for what is still missing. If the applicant has not said whether it happened (applicantSaid is empty), ask gently whether it happened at all and, if so, what happened. Never suggest answers, never accuse, never mention form numbers, field IDs or legal categories the applicant did not use. Return ONLY JSON {"reply":"question"}.`;

/** Applicant-initiated clarification of one statement, without restarting the form. */
export async function clarifyStatement(session: IntakeSession, factId: string, adapter: ModelAdapter, signal?: AbortSignal): Promise<IntakeSession> {
  const fact = getActiveFacts(session).find(item => item.id === factId);
  if (!fact || !isNarrative(requirementsById.get(fact.requirementId)!)) throw new IntakeError('확인할 진술을 찾을 수 없습니다.', session);
  const response = parseObject(await adapter({ task: 'intake', signal,
    system: `${topicSystem} The applicant asked to clarify this specific statement. Ask one neutral question about the unclear roles, meaning or negation in it, using their own words. If none is flagged, ask what they want to correct. Do not suggest an identity or a new event.`,
    prompt: boundedPrompt({ language: session.language, askAbout: [{ meaning: requirementsById.get(fact.requirementId)?.labelEn,
      eventId: fact.eventId, statement: fact.value, statements: fact.statements, quotes: fact.sourceQuotes, clarify: fact.clarification ?? [] }] }),
    responseSchema: { type: 'object', additionalProperties: false, required: ['reply'], properties: { reply: { type: 'string', minLength: 1, maxLength: 600 } } },
  }));
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  return appendAssistantMessage(session, requireReplyLanguage(text(response.reply, '확인 질문', 600), session.language), { kind: 'narrative', topics: [groupOf(fact.requirementId)], clarifies: [fact.id] });
}

/** Topics that belong together in one natural question (what happened and the fear it caused;
 * what the applicant did next; their own activities; supporting evidence and how they applied). */
export const TOPIC_CLUSTERS = [['grounds'], ['harm', 'fear'], ['family_harm'], ['protection', 'relocation', 'departure'], ['org', 'activity'],
  ['criminal'], ['other_app'], ['minor'], ['contact'], ['evidence', 'learned'], ['late']];

/** Topics for the next guided question: the first least-asked open gap and the open gaps of its cluster. */
export function nextTargets(session: IntakeSession, open: string[]): string[] {
  const asked = (topic: string) => session.topicAttempts[topic] ?? 0;
  const least = Math.min(...open.map(asked));
  const first = open.find(topic => asked(topic) === least)!;
  const cluster = TOPIC_CLUSTERS.find(item => item.includes(first)) ?? [first];
  return cluster.filter(topic => open.includes(topic) && asked(topic) === least);
}

export const normalize = (value: string) => value.replace(/[\s.,!?？؟。]/g, '');

/** Guided conversation after the free story: the app chooses which open question 14 gaps to
 * ask next and the model only phrases one natural question for them. Every answer is still
 * extracted against all metadata, so whatever else the applicant says is kept too. */
export async function guideConversation(session: IntakeSession, adapter: ModelAdapter, signal?: AbortSignal): Promise<IntakeSession> {
  const step = nextStep(session);
  if (step.kind !== 'narrative' || !step.guided || !needsTopicQuestion(session)) return session;
  const targets = nextTargets(session, step.guided);
  const coverage = calculateCoverage(session);
  const active = getActiveFacts(session);
  const topics = targets.map(topic => ({
    meaning: metadataGroups.find(group => group.id === topic)?.en ?? topic,
    stillMissing: coverage.filter(item => ['missing', 'conflict'].includes(item.status) && groupOf(item.requirementId) === topic).slice(0, 5).map(item => ({ field: requirementsById.get(item.requirementId)?.labelEn, status: item.status })),
    applicantSaid: active.find(fact => fact.requirementId === topic)?.value ?? '',
    // What is already known, so the question asks for what is missing instead of repeating.
    alreadyKnown: active.filter(fact => (groupOf(fact.requirementId) === topic || fact.relatedRequirementIds?.some(id => groupOf(id) === topic)) && fact.requirementId !== topic && fact.status === 'answered').slice(0, 8).map(fact => ({ value: fact.value, eventId: fact.eventId,
      ...(fact.statements?.length ? { statements: fact.statements.map(({ subject, action, object, polarity, certainty, knowledge }) => ({ subject, action, object, polarity, certainty, knowledge })) } : {}) })),
    clarify: statementQuestions(active).filter(item => groupOf(item.requirementId) === topic),
    events: eventReview(session).filter(item => item.groupId === topic),
    // A missing summary must not erase the story already told in another topic.
    ...(topic === 'grounds' ? { relatedContext: active.filter(fact => ['harm', 'fear', 'activity'].includes(groupOf(fact.requirementId)) && fact.status === 'answered' && !requirementsById.get(fact.requirementId)?.gate).slice(0, 6).map(fact => fact.value),
      instruction: 'Reflect the reason already mentioned in relatedContext and ask only what remains unclear; do not ask the applicant to tell their whole reason or story again. Do not infer or suggest a legal category.' } : {}),
  }));
  try {
    const data = parseObject(await adapter({ task: 'intake', signal, system: topicSystem,
      // No conversation context: with it a small model drifts back to the story or copies earlier questions.
      prompt: boundedPrompt({ language: session.language, askAbout: topics }),
      responseSchema: { type: 'object', additionalProperties: false, required: ['reply'], properties: { reply: { type: 'string', minLength: 1, maxLength: 600 } } },
    }));
    const reply = requireReplyLanguage(text(data.reply, '모델의 질문', 2000), session.language);
    // A small model may copy an earlier question; never show the same question twice.
    if (session.messages.some(item => item.role === 'assistant' && normalize(item.content) === normalize(reply))) throw new Error('이전과 같은 질문이 만들어졌습니다.');
    return openTopic(session, targets, reply);
  } catch (error) {
    throw Object.assign(new IntakeError(error instanceof Error ? error.message : '다음 질문을 준비하지 못했습니다.', session), { targets });
  }
}
