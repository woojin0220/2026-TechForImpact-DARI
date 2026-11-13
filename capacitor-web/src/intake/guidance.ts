import { requireReplyLanguage } from './replyLanguage.ts';
import { isNarrative, requirementsById } from './catalog.ts';
import { IntakeError, type IntakeSession, type ModelAdapter } from './types.ts';
import { eventReview, statementQuestions } from './statements.ts';
import { metadataGroups } from './metadata14.ts';
import { boundedPrompt, parseObject, text } from './modelOutput.ts';
import { appendAssistantMessage, getActiveFacts } from './session.ts';
import { calculateCoverage } from './coverage.ts';
import { groupOf, needsTopicQuestion, nextStep, openTopic } from './flow.ts';

/** Model-phrased follow-up questions: guided topics after the story and clarifying one statement. */

const topicSystem = `You are DARI, helping a refugee applicant tell their account in their own language. Write ONE short, warm, neutral question in the session language that asks ONLY about the subjects in askAbout (their "meaning" says what to ask; "stillMissing" lists details worth inviting). If there are several subjects, ask about them together in one natural sentence. Do NOT continue other parts of the story and do not ask about anything not in askAbout. Do not ask again for anything in alreadyKnown; ask only for what is still missing. If the applicant has not said whether it happened (applicantSaid is empty), ask gently whether it happened at all and, if so, what happened. Never suggest answers, never accuse, never mention form numbers, field IDs or legal categories the applicant did not use. Return ONLY JSON {"reply":"question"}.`;

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
const TOPIC_CLUSTERS = [['grounds'], ['harm', 'fear'], ['family_harm'], ['protection', 'relocation', 'departure'], ['org', 'activity'],
  ['criminal'], ['other_app'], ['minor'], ['contact'], ['evidence', 'learned'], ['late']];

/** Topics for the next guided question: the first least-asked open gap and the open gaps of its cluster. */
function nextTargets(session: IntakeSession, open: string[]): string[] {
  const asked = (topic: string) => session.topicAttempts[topic] ?? 0;
  const least = Math.min(...open.map(asked));
  const first = open.find(topic => asked(topic) === least)!;
  const cluster = TOPIC_CLUSTERS.find(item => item.includes(first)) ?? [first];
  return cluster.filter(topic => open.includes(topic) && asked(topic) === least);
}

const normalize = (value: string) => value.replace(/[\s.,!?？؟。]/g, '');

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
