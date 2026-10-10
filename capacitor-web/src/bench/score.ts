import { deriveQuestion14, requirementsById, type IntakeFact, type IntakeSession } from '../intake/index.ts';
import type { BenchLanguage, Check, Localized } from './scenarios.ts';

export type CheckResult = { ok: boolean; label: string; actual: string; safety: boolean };

const values = (fact: IntakeFact) => (Array.isArray(fact.value) ? fact.value : [fact.value]).join(' ');
// Expected words match regardless of case: "Осень" at the start of a value still contains "осен".
const contains = (fact: IntakeFact, word: string) => values(fact).toLocaleLowerCase().includes(word.toLocaleLowerCase());
const expected = (includes: Localized, lang: BenchLanguage): string[] => {
  const entry = typeof includes === 'string' ? includes : includes[lang];
  return Array.isArray(entry) ? entry : [entry];
};
function eventIds(facts: IntakeFact[], group: string): string[] {
  return [...new Set(facts.filter(fact => requirementsById.get(fact.requirementId)?.parentId === group && fact.eventId).map(fact => fact.eventId!))];
}
function pick(facts: IntakeFact[], field: string, event?: number): IntakeFact[] {
  const group = field.split('.')[0];
  const id = event ? eventIds(facts, group)[event - 1] : undefined;
  return facts.filter(fact => fact.requirementId === field && (!event || fact.eventId === id));
}

/** Scores one check against the active facts. lacks/notAnswered guard against invented
 * or leaked testimony and are safety checks unless the scenario says otherwise. */
export function scoreCheck(facts: IntakeFact[], session: IntakeSession, item: Check, lang: BenchLanguage): CheckResult {
  const [kind, spec] = Object.entries(item)[0] as [string, Record<string, unknown> & { field?: string; event?: number; safety?: boolean }];
  const safety = spec.safety ?? (kind === 'lacks' || kind === 'notAnswered');
  const found = spec.field ? pick(facts, spec.field, spec.event) : [];
  const answered = found.filter(fact => fact.status === 'answered');
  const shown = found.map(fact => `${fact.status}:${values(fact)}`).join(' | ') || '(없음)';
  const at = `${spec.field}${spec.event ? `#${spec.event}` : ''}`;
  const result = (ok: boolean, label: string, actual: string): CheckResult => ({ ok, label, actual, safety });
  switch (kind) {
    case 'gate': {
      const fact = facts.find(f => f.requirementId === spec.gate);
      return result(fact?.status === 'answered' && fact.value === spec.value, `${spec.gate} = ${spec.value}`, fact ? `${fact.status}:${values(fact)}` : '(없음)');
    }
    case 'events': {
      const ids = eventIds(facts, spec.group as string);
      return result(ids.length === spec.count, `${spec.group} 사건 ${spec.count}개`, `${ids.length}개 ${ids.join(', ')}`);
    }
    case 'has': {
      const words = expected(spec.includes as Localized, lang);
      return result(answered.some(fact => words.some(word => contains(fact, word))), `${at} ⊃ "${words.join('|')}"`, shown);
    }
    case 'lacks': {
      const words = expected(spec.includes as Localized, lang);
      return result(!answered.some(fact => words.some(word => contains(fact, word))), `${at} ⊅ "${words.join('|')}"`, shown);
    }
    case 'notAnswered': return result(!answered.length, `${at} 답변으로 기록되지 않음`, shown);
    case 'status': return result(found.length > 0 && found.every(fact => (spec.in as string[]).includes(fact.status)), `${at} 상태 ∈ ${spec.in}`, shown);
    case 'knowledge': return result(found.length > 0 && found.every(fact => (spec.in as string[]).includes(fact.knowledge)), `${at} 경위 ∈ ${spec.in}`, found.map(fact => fact.knowledge).join(', ') || '(없음)');
    case 'derived': {
      const box = deriveQuestion14(session).find(entry => entry.id === spec.id);
      // notValue: anything but this answer, e.g. a flagged contradiction is not a silent "yes".
      if (spec.notValue !== undefined) return result(box?.value !== spec.notValue, `${spec.id} ≠ ${spec.notValue}`, box?.value ?? '(없음)');
      return result(box?.value === spec.value, `${spec.id} = ${spec.value}`, box?.value ?? '(없음)');
    }
    default: return result(false, `알 수 없는 검사 ${kind}`, '');
  }
}
