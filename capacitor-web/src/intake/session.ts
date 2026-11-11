import { IntakeError, type IntakeFact, type IntakeSession, type MessageAsk, type SourceMessage } from './types.ts';
import type { IntakeScope } from './catalog.ts';
import { calculateCoverage } from './coverage.ts';

/** Session creation and the append-only message log. */

export const MAX_USER_LENGTH = 12000;

const greetings: Record<string, string> = {
  ko: '신청서에 담고 싶은 이야기를 편하게 들려주세요. 어떤 이유로 본국을 떠나 보호를 신청하게 되셨나요? 기억나지 않거나 지금 말하기 어려운 내용은 그렇게 말씀해 주셔도 됩니다.',
  ru: 'Расскажите своими словами, почему вы покинули свою страну и просите защиты. Если вы чего-то не помните или пока не готовы обсуждать, об этом можно сказать.',
  ar: 'احكِ بكلماتك لماذا غادرت بلدك وتطلب الحماية. يمكنك أن تقول إنك لا تتذكر شيئًا أو لا ترغب في الحديث عنه الآن.',
  fr: 'Racontez avec vos mots pourquoi vous avez quitté votre pays et demandez une protection. Vous pouvez dire que vous ne vous souvenez pas ou ne souhaitez pas en parler maintenant.',
  fa: 'با زبان خودتان بگویید چرا کشور خود را ترک کرده‌اید و درخواست حمایت دارید. اگر چیزی را به یاد ندارید یا فعلاً نمی‌خواهید درباره‌اش صحبت کنید، می‌توانید بگویید.',
  en: 'Tell me in your own words why you left your country and are seeking protection. You can say if you do not remember something or do not want to discuss it now.',
};

export function now() { return new Date().toISOString(); }
export function message(role: SourceMessage['role'], content: string, index: number, ask?: MessageAsk): SourceMessage {
  return { id: `message-${index}`, role, content, createdAt: now(), ...(ask ? { ask } : {}) };
}

/** Opening question of the section 14 free conversation. */
export function narrativeOpening(language: string): string {
  return greetings[language] ?? greetings.en;
}

export function createSession(language: string, scope: IntakeScope = 'priority'): IntakeSession {
  if (scope === 'test') language = 'en';
  if (!greetings[language]) throw new Error('지원하지 않는 대화 언어입니다.');
  const session: IntakeSession = {
    version: 1, id: globalThis.crypto.randomUUID(), language, scope,
    // The full form starts with app-authored questions (see nextStep); the
    // 14.1-14.3 test scope opens the free conversation immediately.
    messages: scope === 'priority' ? [message('assistant', greetings[language], 1, { kind: 'narrative' })] : [],
    facts: [], coverage: [], draft: [], draftRevision: 0, updatedAt: now(),
    narrativeDone: false, tableRows: {}, closedTables: [], form: {}, withdrawnFacts: [], topicAttempts: {}, guidedDone: false,
  };
  return { ...session, coverage: calculateCoverage(session) };
}

export function getActiveFacts(session: IntakeSession): IntakeFact[] {
  const retired = new Set([...session.facts.flatMap(fact => fact.supersedes ?? []), ...session.withdrawnFacts]);
  return session.facts.filter(fact => !retired.has(fact.id));
}



/** Source changes invalidate both generated prose and the editable application. */
export function invalidateDraft(session: IntakeSession): IntakeSession {
  return { ...session, draft: [], question14: undefined, draftReviews: undefined, draftRevision: 0, updatedAt: now() };
}

/** IDs must not depend on array length: same-turn refinements can remove entries. */
export function nextFactId(facts: IntakeFact[]): string {
  return `fact-${facts.reduce((max, fact) => Math.max(max, Number(/^fact-(\d+)$/.exec(fact.id)?.[1] ?? 0)), 0) + 1}`;
}

export function appendUserMessage(session: IntakeSession, text: string): IntakeSession {
  if (!text.trim()) throw new IntakeError('답변을 입력해 주세요.', session);
  if (text.length > MAX_USER_LENGTH) throw new IntakeError('한 번에 보낼 수 있는 답변은 12,000자까지입니다. 내용을 나누어 입력해 주세요.', session);
  return { ...invalidateDraft(session), messages: [...session.messages, message('user', text, session.messages.length + 1)] };
}

/** Append an app-authored assistant message (fixed question, narrative prompt or closing note). */
export function appendAssistantMessage(session: IntakeSession, content: string, ask: MessageAsk): IntakeSession {
  return { ...session, messages: [...session.messages, message('assistant', content, session.messages.length + 1, ask)], updatedAt: now() };
}
