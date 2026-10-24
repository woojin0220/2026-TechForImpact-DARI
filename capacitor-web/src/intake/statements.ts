import { requirementsById, requirementsForScope } from './catalog.ts';
import type { IntakeFact, IntakeSession, SourceQuote, Statement } from './types.ts';

export function onlyDenials(fact: IntakeFact): boolean {
  return !!fact.statements?.length && fact.statements.every(item => item.polarity === 'negative');
}

/** Different aspects of the same account are additions, not contradictions.
 * Comparable subject/action statements still require review when their content differs. */
export function comparableStatements(left: Statement[], right: Statement[]): boolean {
  const normalize = (value: string | null) => value?.trim().toLocaleLowerCase();
  return left.some(a => right.some(b => {
    const first = normalize(a.action)!, second = normalize(b.action)!;
    // Substring stems catch "threaten" / "threatened" without rewriting source text.
    return (first.includes(second) || second.includes(first))
      && (normalize(a.subject) === normalize(b.subject) || (a.object && normalize(a.object) === normalize(b.object)) || a.polarity !== b.polarity);
  }));
}

/** Roles and actions must be verbatim spans, not translated names or inferred identities.
 * This validates provenance, not the semantic accuracy of the model's interpretation. */
export function parseStatements(raw: unknown, evidence: SourceQuote[], hasNegation?: (quote: string) => boolean): { statements: Statement[]; clarification: NonNullable<IntakeFact['clarification']> } {
  const statements: Statement[] = [];
  const clarification = new Set<NonNullable<IntakeFact['clarification']>[number]>();
  if (raw === undefined) return { statements, clarification: [] }; // Older responses remain readable.
  if (!Array.isArray(raw) || raw.length > 16) return { statements, clarification: ['structure'] };
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { clarification.add('structure'); continue; }
    const row = item as Record<string, unknown>;
    const quotes = typeof row.quote === 'string' && row.quote.trim()
      ? evidence.filter(source => source.quote.includes(row.quote as string)).map(source => ({ sourceId: source.sourceId, quote: row.quote as string })) : [];
    if (!quotes.length || typeof row.action !== 'string' || !row.action.trim() || !quotes[0].quote.includes(row.action)
      || !['positive', 'negative', 'unspecified'].includes(String(row.polarity))
      || !['exact', 'approximate', 'uncertain'].includes(String(row.certainty))
      || !['direct', 'heard', 'inferred', 'unspecified'].includes(String(row.knowledge))) {
      clarification.add('structure'); continue;
    }
    const role = (value: unknown) => typeof value === 'string' && value.trim() && quotes[0].quote.includes(value) ? value : null;
    const subject = role(row.subject), object = role(row.object);
    // Reject invented role text rather than silently displaying it as established.
    if ((row.subject != null && !subject) || (row.object != null && !object)) { clarification.add('roles'); continue; }
    if (!subject) clarification.add('roles');
    // A model label cannot negate a clearly affirmative quote. An inconsistency
    // remains unresolved rather than being silently changed to a positive claim.
    const polarity = row.polarity === 'negative' && hasNegation && !hasNegation(quotes[0].quote) ? 'unspecified' : row.polarity as Statement['polarity'];
    if (polarity === 'unspecified') clarification.add('polarity');
    const belief = /\bI (think|believe|suspect)\b|\bje (pense|crois)\b|думаю|предполагаю|생각|추측|أعتقد|أظن|فکر می|گمان می/iu.test(quotes[0].quote);
    const hedged = belief || /\bmight\b|\bmaybe\b|\bperhaps\b|\bnot sure\b|peut-être|возможно|кажется|아마|일지도|확실하지|ربما|شاید/iu.test(quotes[0].quote);
    statements.push({ subject, action: row.action, object, polarity,
      certainty: hedged ? 'uncertain' : row.certainty as Statement['certainty'], knowledge: belief ? 'inferred' : row.knowledge as Statement['knowledge'], sourceQuotes: quotes });
  }
  return { statements, clarification: [...clarification] };
}

/** Cross-question reuse is explicit and restricted to narrative text. It cannot
 * choose a legal ground, set a yes/no gate, or fill an identity/table field. */
export function relatedRequirements(raw: unknown, primary: string, scope: IntakeSession['scope']): string[] {
  const allowed = new Set(requirementsForScope(scope).filter(item => item.collection === 'conversation' && !item.options
    && !item.gate && item.questionId.startsWith('14.')).map(item => item.id));
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id !== primary && allowed.has(id)))].slice(0, 8);
}

export function factSupportsQuestion(fact: IntakeFact, questionId: string): boolean {
  return [fact.requirementId, ...(fact.status === 'answered' ? fact.relatedRequirementIds ?? [] : [])].some(id => requirementsById.get(id)?.questionId === questionId);
}

/** One canonical fact can supply multiple sections. Unknown/deferred/conflicting
 * statements are never used to fill a different missing field. */
export function questionUses(facts: IntakeFact[]) {
  const statements = statementMetadata(facts);
  return facts.flatMap(fact => [fact.requirementId, ...(fact.status === 'answered' ? fact.relatedRequirementIds ?? [] : [])]
    .map(requirementId => ({ factId: fact.id, statementIds: statements.filter(item => item.factIds.includes(fact.id)).map(item => item.id),
      requirementId, questionId: requirementsById.get(requirementId)?.questionId })));
}

export function statementMetadata(facts: IntakeFact[]) {
  const items = new Map<string, { id: string; factId: string; factIds: string[]; eventId?: string; status: IntakeFact['status']; confirmed: boolean } & Statement>();
  for (const fact of facts) for (const [index, statement] of (fact.statements ?? []).entries()) {
    const key = JSON.stringify([fact.eventId, statement]);
    const existing = items.get(key);
    if (existing) {
      existing.factIds.push(fact.id);
      existing.confirmed = existing.confirmed && fact.confirmed;
      if (fact.status === 'conflict') existing.status = 'conflict';
    } else items.set(key, { id: `${fact.id}/statement-${index + 1}`, factId: fact.id, factIds: [fact.id], eventId: fact.eventId,
      status: fact.status, confirmed: fact.confirmed, ...statement });
  }
  return [...items.values()];
}

/** Targeted gaps are review prompts, not a diagnosis of inconsistent testimony. */
export function statementQuestions(facts: IntakeFact[]) {
  return facts.filter(fact => fact.clarification?.length && !['unknown', 'skipped', 'not_applicable'].includes(fact.status))
    .map(fact => ({ factId: fact.id, eventId: fact.eventId, requirementId: fact.requirementId, reasons: fact.clarification! }));
}

/** Per-incident gaps: an answer about one incident never completes another one. */
export function eventReview(session: IntakeSession) {
  const retired = new Set([...session.facts.flatMap(item => item.supersedes ?? []), ...session.withdrawnFacts]);
  const facts = session.facts.filter(item => !retired.has(item.id));
  const requirements = requirementsForScope(session.scope);
  const events = new Map<string, { eventId: string; groupId: string }>();
  for (const fact of facts) {
    const requirement = requirementsById.get(fact.requirementId);
    if (fact.eventId && requirement?.repeatable && requirement.parentId) events.set(`${requirement.parentId}/${fact.eventId}`, { groupId: requirement.parentId, eventId: fact.eventId });
  }
  return [...events.values()].map(event => {
    const own = facts.filter(fact => fact.eventId === event.eventId && requirementsById.get(fact.requirementId)?.parentId === event.groupId);
    const needed = requirements.filter(item => item.repeatable && item.parentId === event.groupId && (!item.whenEvent || own.some(fact =>
      fact.requirementId === item.whenEvent!.id && fact.status === 'answered'
      && (Array.isArray(fact.value) ? fact.value : [fact.value]).some(value => item.whenEvent!.anyOf.includes(value)))));
    return { ...event, factIds: own.map(item => item.id),
      missingRequirementIds: needed.filter(item => !own.some(fact => fact.requirementId === item.id)).map(item => item.id),
      unknownRequirementIds: own.filter(item => ['unknown', 'skipped'].includes(item.status)).map(item => item.requirementId),
      clarificationFactIds: own.filter(item => item.status === 'conflict' || item.clarification?.length).map(item => item.id) };
  });
}
