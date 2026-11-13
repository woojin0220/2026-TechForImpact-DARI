/**
 * Intake public API. The implementation is split by concern:
 * - session.ts      session creation and the message log
 * - coverage.ts     which requirements are answered, missing or contradictory
 * - flow.ts         scripted questions and what comes next
 * - extraction.ts   model extraction of facts from free answers
 * - guidance.ts     model-phrased follow-up and clarification questions
 * - draft.ts        the Korean question 14 draft
 * - review.ts       confirming facts and exporting the record
 * - modelOutput.ts  validation of model JSON and the prompt size guard
 */
export * from './types.ts';
export * from './catalog.ts';
export * from './form.ts';
export * from './derive14.ts';
export { metadataGroups } from './metadata14.ts';
export { eventReview, questionUses, statementMetadata, statementQuestions } from './statements.ts';

export { appendAssistantMessage, appendUserMessage, createSession, getActiveFacts, invalidateDraft, narrativeOpening, nextFactId } from './session.ts';
export { calculateCoverage, getProgress } from './coverage.ts';
export { answerScripted, finishNarrative, needsTopicQuestion, nextStep, openTopic, pendingAsk, reaskQuestion, tableRowIds, type IntakeStep, type ScriptedAnswer } from './flow.ts';
export { advanceConversation, continueConversation, getAuxiliaryPasses, getExtractionFormat, setAuxiliaryPasses, setExtractionFormat, type AuxiliaryPasses, type ExtractionFormat } from './extraction.ts';
export { clarifyStatement, guideConversation } from './guidance.ts';
export { generateDraft } from './draft.ts';
export { confirmFacts, exportSession } from './review.ts';
