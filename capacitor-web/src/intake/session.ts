import { requirementsById, requirementsForScope, type IntakeScope, type Requirement } from './catalog.ts';
import { IntakeError, type CoverageEntry, type CoverageStatus, type IntakeFact, type IntakeSession, type MessageAsk, type SourceMessage } from './types.ts';
import { onlyDenials } from './statements.ts';

export const MAX_USER_LENGTH = 12000;
// Character guard is conservative, not a tokenizer-derived guarantee. The native
// adapter additionally enforces its model context window.
export const MAX_PROMPT_LENGTH = 26000;
export const MAX_OUTPUT_LENGTH = 64000;
// Negation words in every candidate UI language. Words are matched whole (\b only knows ASCII
// letters, so "не" never matched and "لا" matched inside "الاحتجاج"); "동안 " and "잘못" are not
// negations. Persian negates verbs with a prefix, so common negated stems are listed.
// No lookbehind: iOS 15 WebViews (the app's minimum) reject it when the module loads.
export const wordStart = '(?:^|[^\\p{L}])';
export const wholeWord = (words: string) => `${wordStart}(?:${words})(?!\\p{L})`;
export const NEGATION = new RegExp([
  '않|없|(?:^|[^잘])못|아니|(?:^|[^가-힣])안\\s',
  wholeWord('no|not|never|nobody|nothing|cannot|without|neither|nor'), "n't",
  wholeWord('ne|pas|jamais|non|rien|personne'),
  wholeWord('не|нет|никогда|ни|без'),
  wholeWord('لا|لم|لن|ليس|ليست|لست|دون|بدون'),
  wholeWord('نه|هیچ'), `${wordStart}(?:نمی|نکرد|نکن|نداشت|ندار|نتوان|نبود|نیست|نشد|نخواست|نخواه|نخورد|ندید|نگفت|نزد|نرفت|نیامد|نبرد|نرسید|نگرفت)`,
].join('|'), 'iu');
// Self-corrections and "I don't know" in every candidate UI language (ko, en, fr, ru, ar, fa).
// Phrases are specific to the speaker correcting themselves, so a story that merely
// mentions a mistake ("arrested by mistake") is not read as a correction.
export const CORRECTION = new RegExp([
  '아니라|아니고|잘못\\s*(말|알)|정정|바로잡|틀렸',
  "correction|I meant|actually|that was wrong|I was wrong|my mistake|I made a mistake|let me correct",
  "je me suis tromp|je me trompe|j'ai fait une erreur|je voulais dire|en fait|je corrige",
  'ошибся|ошиблась|оговорил|точнее|вернее|на самом деле|имел в виду|имела в виду|поправлю|исправлю',
  'أخطأت|كنت مخطئ|خطأ مني|أقصد|قصدت|في الحقيقة|بالأحرى|أصحح',
  'اشتباه (کردم|گفتم)|منظورم|در واقع|درستش|تصحیح|بلکه',
].join('|'), 'i');
export const UNCERTAIN = new RegExp([
  '기억\\s*(이\\s*)?(나지\\s*않|안\\s*나)|모르겠|모릅니다|모름|알\\s*수\\s*없',
  "don'?t (really |quite |even )?(know|remember|understand)|do not (really )?(know|remember|understand)|can'?t remember|cannot remember|not sure|no idea|unknown",
  "je ne sais (pas|plus)|je ne (me|m'en) souviens (pas|plus)|je ne comprends pas|aucune idée|pas sûr|inconnu",
  'не (очень |совсем |совсем не )?(знаю|помню|понимаю)|не уверен|понятия не имею|неизвестно',
  'لا أعرف|لا أعلم|لا أتذكر|لا أذكر|لا أدري|لا أفهم|لست متأكد|غير معروف',
  'نمی[\\u200c ]?دانم|نمی[\\u200c ]?دونم|نمی[\\u200c ]?فهمم|یادم نیست|یادم نمی[\\u200c ]?آید|به یاد ندارم|مطمئن نیستم|نامعلوم',
].join('|'), 'i');
export const greetings: Record<string, string> = {
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

/** Whether a per-incident condition (e.g. "released" only if detained) holds for one incident. */
export function eventMatches(requirement: Requirement, eventId: string, facts: IntakeFact[]): boolean {
  const condition = requirement.whenEvent;
  if (!condition) return true;
  return facts.some(fact => fact.requirementId === condition.id && fact.eventId === eventId && fact.status === 'answered'
    && (Array.isArray(fact.value) ? fact.value : [fact.value]).some(value => condition.anyOf.includes(value)));
}

/** Detect a structural contradiction without deciding which testimony is true. */
export function hasConflictingChildren(requirementId: string, facts: IntakeFact[]): boolean {
  const gates = facts.filter(fact => fact.requirementId === requirementId && fact.status === 'answered');
  if (!gates.length) return false;
  const values = gates.flatMap(fact => Array.isArray(fact.value) ? fact.value : [fact.value]);
  return facts.some(fact => fact.status === 'answered' && requirementsById.get(fact.requirementId)?.when?.some(condition =>
    condition.id === requirementId && !condition.anyOf.some(value => values.includes(value)) && !(onlyDenials(fact) && condition.anyOf.includes('yes'))));
}

export function applicability(requirement: Requirement, facts: IntakeFact[], seen = new Set<string>()): 'yes' | 'no' | 'unknown' {
  if (seen.has(requirement.id)) return 'unknown';
  seen.add(requirement.id);
  let unknown = false;
  for (const condition of requirement.when ?? []) {
    const dependency = requirementsById.get(condition.id);
    if (dependency) {
      const parent = applicability(dependency, facts, new Set(seen));
      if (parent === 'no') return 'no';
      if (parent === 'unknown') { unknown = true; continue; }
    }
    const records = facts.filter(fact => fact.requirementId === condition.id);
    if (!records.length || records.some(fact => fact.status !== 'answered') || hasConflictingChildren(condition.id, facts)) { unknown = true; continue; }
    const values = records.flatMap(fact => Array.isArray(fact.value) ? fact.value : [fact.value]);
    if (!values.some(value => condition.anyOf.includes(value))) return 'no';
  }
  return unknown ? 'unknown' : 'yes';
}

export function calculateCoverage(session: IntakeSession): CoverageEntry[] {
  const active = getActiveFacts(session);
  return requirementsForScope(session.scope).map(requirement => {
    // Explicit links can fill a non-repeating narrative field. Per-event fields
    // still need their own incident binding and must not borrow another row.
    const records = active.filter(fact => fact.requirementId === requirement.id || (!requirement.repeatable && fact.status === 'answered'
      && fact.relatedRequirementIds?.includes(requirement.id)));
    const applicable = applicability(requirement, active);
    let status: CoverageStatus = applicable === 'no' ? 'not_applicable' : applicable === 'unknown' ? 'blocked' : 'missing';
    if (applicable === 'yes' && records.length) {
      status = records.some(fact => fact.status === 'conflict') || hasConflictingChildren(requirement.id, active) ? 'conflict'
        : records.some(fact => fact.status === 'unknown') ? 'unknown'
        : records.some(fact => fact.status === 'skipped') ? 'skipped'
        : records.every(fact => fact.status === 'not_applicable') ? 'not_applicable' : 'answered';
    }
    // Each known table row / incident must have this field, not just the first one,
    // unless a per-incident condition excludes that incident.
    if (applicable === 'yes' && requirement.parentId && requirement.repeatable) {
      const siblings = active.filter(fact => requirementsById.get(fact.requirementId)?.parentId === requirement.parentId);
      const events = [...new Set(siblings.map(fact => fact.eventId).filter(Boolean))] as string[];
      const relevant = events.filter(id => eventMatches(requirement, id, active));
      if (requirement.whenEvent && events.length && !relevant.length && !records.length) status = 'not_applicable';
      else if (['answered', 'unknown', 'skipped'].includes(status) && relevant.some(id => !records.some(fact => fact.eventId === id))) status = 'missing';
    }
    // An empty table (or a detail block the applicant said does not apply)
    // makes its per-row fields not applicable.
    if (requirement.parentId && !records.length) {
      const parent = active.filter(fact => fact.requirementId === requirement.parentId);
      if (parent.length && parent.every(fact => fact.status === 'not_applicable')) status = 'not_applicable';
    }
    // A gate that is still unknown must not hide a conflict in an already
    // supplied detail (and must not make an old contradictory value draftable).
    if (records.some(fact => fact.status === 'conflict')) status = 'conflict';
    return { requirementId: requirement.id, status, factIds: records.map(fact => fact.id) };
  });
}

export function getProgress(session: IntakeSession) {
  const coverage = calculateCoverage(session);
  return {
    total: coverage.length,
    answered: coverage.filter(item => item.status === 'answered').length,
    notApplicable: coverage.filter(item => item.status === 'not_applicable').length,
    unresolved: coverage.filter(item => !['answered', 'not_applicable'].includes(item.status)).length,
    complete: coverage.every(item => ['answered', 'not_applicable'].includes(item.status)),
  };
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

export function parseObject(raw: string): Record<string, unknown> {
  if (raw.length > MAX_OUTPUT_LENGTH) throw new Error('모델 응답이 허용 길이를 넘었습니다.');
  const clean = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1');
  const parsed: unknown = JSON.parse(clean);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('모델이 올바른 JSON 객체를 반환하지 않았습니다.');
  return parsed as Record<string, unknown>;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('모델 응답의 항목 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, limit = 6000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return value;
}
export function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`${label} 목록이 올바르지 않습니다.`);
  return [...new Set(value)] as string[];
}
export function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`${label} 값이 올바르지 않습니다.`);
  return value as T;
}
export function boundedPrompt(data: unknown): string {
  const prompt = JSON.stringify(data);
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error('현재 처리할 수 있는 문맥 길이를 넘었습니다. 대화 기록은 보존되었습니다. 더 긴 문맥을 지원하는 모델 설정이 필요합니다.');
  return prompt;
}
