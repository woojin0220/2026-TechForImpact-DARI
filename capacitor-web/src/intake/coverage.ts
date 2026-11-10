import { requirementsById, requirementsForScope, type Requirement } from './catalog.ts';
import type { CoverageEntry, CoverageStatus, IntakeFact, IntakeSession } from './types.ts';
import { onlyDenials } from './statements.ts';
import { getActiveFacts } from './session.ts';

/** Which requirements are answered, missing, not applicable or contradictory. */

/** Whether a per-incident condition (e.g. "released" only if detained) holds for one incident. */
export function eventMatches(requirement: Requirement, eventId: string, facts: IntakeFact[]): boolean {
  const condition = requirement.whenEvent;
  if (!condition) return true;
  return facts.some(fact => fact.requirementId === condition.id && fact.eventId === eventId && fact.status === 'answered'
    && (Array.isArray(fact.value) ? fact.value : [fact.value]).some(value => condition.anyOf.includes(value)));
}

/** Detect a structural contradiction without deciding which testimony is true. */
function hasConflictingChildren(requirementId: string, facts: IntakeFact[]): boolean {
  const gates = facts.filter(fact => fact.requirementId === requirementId && fact.status === 'answered');
  if (!gates.length) return false;
  const values = gates.flatMap(fact => Array.isArray(fact.value) ? fact.value : [fact.value]);
  return facts.some(fact => fact.status === 'answered' && requirementsById.get(fact.requirementId)?.when?.some(condition =>
    condition.id === requirementId && !condition.anyOf.some(value => values.includes(value)) && !(onlyDenials(fact) && condition.anyOf.includes('yes'))));
}

function applicability(requirement: Requirement, facts: IntakeFact[], seen = new Set<string>()): 'yes' | 'no' | 'unknown' {
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
