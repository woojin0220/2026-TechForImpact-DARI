import { calculateCoverage, createSession, type IntakeSession } from './intake/index.ts';
import { validateDocument } from './revision/state.mjs';

export type Stage = 'language' | 'basics' | 'form' | 'conversation' | 'facts' | 'draft';
export type Output = 'draft' | 'source' | 'metadata';
export type WorkingCopy = {
  version: 1;
  session: IntakeSession;
  language: string;
  stage: Stage;
  formPage: number;
  input: string;
  picked: string[];
  demo: boolean;
  finalReviewedText: string;
  output: Output;
  pendingTask: 'intake' | 'draft' | null;
};

/** Raw metadata JSON is a developer view (#6); applicants only see the draft and their own words. */
export function visibleOutputs(devTools: boolean): Output[] {
  return devTools ? ['draft', 'source', 'metadata'] : ['draft', 'source'];
}
export function initialOutput(saved: Output | undefined, devTools: boolean): Output {
  return saved && visibleOutputs(devTools).includes(saved) ? saved : 'draft';
}

export const WORKING_COPY_KEY = 'dari.working-copy.v1';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserStorage: StorageAccess = () => window.sessionStorage;
const languages = ['ko', 'en', 'fr', 'ru', 'ar', 'fa'];
const stages: Stage[] = ['language', 'basics', 'form', 'conversation', 'facts', 'draft'];
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const nonnegative = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

function validForm(value: unknown): boolean {
  return object(value) && Object.values(value).every(item => {
    if (!object(item)) return false;
    if (item.kind === 'text') return typeof item.text === 'string';
    if (item.kind === 'choice') return strings(item.values) && (item.other === undefined || typeof item.other === 'string');
    if (item.kind === 'status') return ['unknown', 'not_applicable'].includes(item.status);
    return item.kind === 'table' && Array.isArray(item.rows)
      && item.rows.every((row: unknown) => object(row) && Object.values(row).every(cell => typeof cell === 'string'));
  });
}

function restoreSession(value: unknown): IntakeSession {
  if (!object(value) || value.version !== 1 || typeof value.id !== 'string'
    || !languages.includes(value.language) || !['full', 'priority', 'test'].includes(value.scope)
    || !nonnegative(value.draftRevision) || !Array.isArray(value.messages)
    || !Array.isArray(value.facts) || !Array.isArray(value.draft)) throw new Error('Invalid session');
  for (const message of value.messages) {
    if (!object(message) || typeof message.id !== 'string' || typeof message.content !== 'string'
      || !['user', 'assistant'].includes(message.role) || typeof message.createdAt !== 'string') throw new Error('Invalid message');
    if (message.ask && (!object(message.ask) || !['field', 'table', 'more', 'narrative', 'done'].includes(message.ask.kind)
      || (['field', 'table', 'more'].includes(message.ask.kind) && typeof message.ask.requirementId !== 'string')
      || (message.ask.topics !== undefined && !strings(message.ask.topics))
      || (message.ask.clarifies !== undefined && !strings(message.ask.clarifies)))) throw new Error('Invalid question');
  }
  for (const fact of value.facts) {
    if (!object(fact) || typeof fact.id !== 'string' || typeof fact.requirementId !== 'string'
      || !(typeof fact.value === 'string' || strings(fact.value)) || !strings(fact.sourceIds)
      || !Array.isArray(fact.sourceQuotes) || !fact.sourceQuotes.every((quote: any) => object(quote) && typeof quote.sourceId === 'string' && typeof quote.quote === 'string')
      || !['answered', 'unknown', 'skipped', 'not_applicable', 'conflict'].includes(fact.status)
      || !['exact', 'approximate', 'uncertain'].includes(fact.certainty)
      || !['direct', 'heard', 'inferred', 'unspecified'].includes(fact.knowledge)
      || typeof fact.confirmed !== 'boolean'
      || (fact.supersedes !== undefined && !strings(fact.supersedes))
      || (fact.relatedRequirementIds !== undefined && !strings(fact.relatedRequirementIds))
      || (fact.clarification !== undefined && !strings(fact.clarification))
      || (fact.statements !== undefined && (!Array.isArray(fact.statements) || !fact.statements.every((statement: any) => object(statement)
        && (statement.subject === null || typeof statement.subject === 'string') && typeof statement.action === 'string'
        && (statement.object === null || typeof statement.object === 'string') && typeof statement.polarity === 'string'
        && typeof statement.certainty === 'string' && typeof statement.knowledge === 'string' && Array.isArray(statement.sourceQuotes))))) throw new Error('Invalid fact');
  }
  for (const section of value.draft) {
    if (!object(section) || typeof section.questionId !== 'string' || typeof section.text !== 'string'
      || !strings(section.factIds) || !strings(section.sourceIds) || !Array.isArray(section.sentences)
      || !section.sentences.every((sentence: any) => object(sentence) && typeof sentence.text === 'string' && strings(sentence.factIds) && strings(sentence.sourceIds))
      || (section.missingFactIds !== undefined && !strings(section.missingFactIds))
      || (section.staleValues !== undefined && !strings(section.staleValues))) throw new Error('Invalid draft');
  }
  // Older records may lack optional workflow fields. Keep the original answers and wording.
  const session = { ...createSession(value.language, value.scope), ...value } as IntakeSession;
  if (!validForm(session.form) || (session.question14 !== undefined && !validForm(session.question14))
    || !object(session.tableRows) || !Object.values(session.tableRows).every(nonnegative)
    || !strings(session.closedTables) || !strings(session.withdrawnFacts)
    || !object(session.topicAttempts) || !Object.values(session.topicAttempts).every(nonnegative)
    || typeof session.narrativeDone !== 'boolean' || typeof session.guidedDone !== 'boolean'
    || (session.topicDecisions !== undefined && (!object(session.topicDecisions) || !Object.values(session.topicDecisions).every(status => ['unknown', 'skipped'].includes(status))))) throw new Error('Invalid workflow');
  if (session.draftReviews !== undefined) {
    if (!object(session.draftReviews)) throw new Error('Invalid reviews');
    Object.values(session.draftReviews).forEach(validateDocument);
  }
  return { ...session, coverage: calculateCoverage(session) };
}

export function readWorkingCopy(storage: StorageAccess = browserStorage): { work: WorkingCopy | null; problem?: 'invalid' | 'unavailable' } {
  let raw: string | null;
  try { raw = storage().getItem(WORKING_COPY_KEY); }
  catch { return { work: null, problem: 'unavailable' }; }
  if (!raw) return { work: null };
  try {
    const value = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !languages.includes(value.language)
      || !stages.includes(value.stage) || !nonnegative(value.formPage) || typeof value.input !== 'string'
      || !strings(value.picked) || typeof value.demo !== 'boolean' || typeof value.finalReviewedText !== 'string'
      || !['draft', 'source', 'metadata'].includes(value.output)
      || ![null, 'intake', 'draft'].includes(value.pendingTask)) throw new Error('Invalid working copy');
    const session = restoreSession(value.session);
    const stage = value.stage === 'draft' && !session.draftRevision ? 'facts'
      : value.stage === 'form' && session.scope === 'test' ? 'basics' : value.stage;
    return { work: { ...value, stage, session } as WorkingCopy };
  } catch { return { work: null, problem: 'invalid' }; }
}

export function writeWorkingCopy(work: WorkingCopy, storage: StorageAccess = browserStorage): boolean {
  try { storage().setItem(WORKING_COPY_KEY, JSON.stringify(work)); return true; }
  catch { return false; }
}

export function clearWorkingCopy(storage: StorageAccess = browserStorage): boolean {
  try { storage().removeItem(WORKING_COPY_KEY); return true; }
  catch { return false; }
}
