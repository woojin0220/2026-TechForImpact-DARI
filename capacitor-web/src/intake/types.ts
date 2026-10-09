import type { IntakeScope } from './catalog.ts';
import type { FormAnswers } from './form.ts';
import type { TxtDocument } from '../revision/state.mjs';

export type FactStatus = 'answered' | 'unknown' | 'skipped' | 'not_applicable' | 'conflict';
export type CoverageStatus = FactStatus | 'missing' | 'blocked';
/** What an app-authored assistant message is asking. LLM replies carry no ask. */
export type ScriptedAsk = { kind: 'field' | 'table' | 'more'; requirementId: string; eventId?: string };
export type MessageAsk = ScriptedAsk | { kind: 'narrative'; topics?: string[] } | { kind: 'done' };
export type SourceMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; ask?: MessageAsk };
export type SourceQuote = { sourceId: string; quote: string };
export type IntakeFact = {
  id: string;
  requirementId: string;
  value: string | string[];
  sourceIds: string[];
  sourceQuotes: SourceQuote[];
  status: FactStatus;
  certainty: 'exact' | 'approximate' | 'uncertain';
  knowledge: 'direct' | 'heard' | 'inferred' | 'unspecified';
  eventId?: string;
  supersedes?: string[];
  confirmed: boolean;
};
export type CoverageEntry = { requirementId: string; status: CoverageStatus; factIds: string[] };
export type DraftSentence = { text: string; factIds: string[]; sourceIds: string[] };
/** missingFactIds / staleValues: confirmed facts the model still left out, or corrected values it still used, after one repair; shown for review. */
export type DraftSection = { questionId: string; text: string; factIds: string[]; sourceIds: string[]; sentences: DraftSentence[]; missingFactIds?: string[]; staleValues?: string[] };
export type IntakeSession = {
  version: 1;
  id: string;
  language: string;
  scope: IntakeScope;
  messages: SourceMessage[];
  facts: IntakeFact[];
  coverage: CoverageEntry[];
  draft: DraftSection[];
  draftRevision: number;
  /** Section 14 free conversation was ended by the applicant. */
  narrativeDone: boolean;
  /** Rows the applicant opened per table, and tables they said are complete. */
  tableRows: Record<string, number>;
  closedTables: string[];
  /** Raw form answers for questions 1–13, and form facts withdrawn after a field was cleared. */
  form: FormAnswers;
  withdrawnFacts: string[];
  /** Guided questions after the free story: topics the last question targeted, how often
   * each question 14 group has been asked, and whether the applicant ended the questions. */
  narrativeFocus?: string;
  topicAttempts: Record<string, number>;
  guidedDone: boolean;
  /** Editable question 14 answers built from metadata and the draft; the applicant's edits live here. */
  question14?: FormAnswers;
  /** Applicant-approved wording edits, separate from source and extracted facts. */
  draftReviews?: Record<string, TxtDocument>;
  updatedAt: string;
};
export type ModelRequest = { task: 'intake' | 'draft'; system: string; prompt: string; signal?: AbortSignal; responseSchema?: Record<string, unknown> };
export type ModelAdapter = (request: ModelRequest) => Promise<string>;

/** Carries the original answer even if inference, JSON parsing or provenance checks fail. */
export class IntakeError extends Error {
  readonly session: IntakeSession;
  constructor(message: string, session: IntakeSession) {
    super(message);
    this.name = 'IntakeError';
    this.session = session;
  }
}
