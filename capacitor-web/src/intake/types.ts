import type { IntakeScope } from './catalog.ts';

export type FactStatus = 'answered' | 'unknown' | 'skipped' | 'not_applicable' | 'conflict';
export type CoverageStatus = FactStatus | 'missing' | 'blocked';
export type SourceMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
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
export type DraftSection = { questionId: string; text: string; factIds: string[]; sourceIds: string[]; sentences: DraftSentence[] };
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
