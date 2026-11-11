// Public API of the intake engine. Implementation lives in:
//   session.ts    session state, coverage and shared parsing helpers
//   extraction.ts model extraction of facts from the conversation
//   flow.ts       which question comes next and scripted answers
//   draft.ts      Korean draft writing and session export
export { eventReview, questionUses, statementMetadata, statementQuestions } from './statements.ts';
export * from './types.ts';
export * from './catalog.ts';
export * from './form.ts';
export * from './derive14.ts';
export { metadataGroups } from './metadata14.ts';
export { narrativeOpening, createSession, getActiveFacts, calculateCoverage, getProgress, invalidateDraft, nextFactId, appendUserMessage } from './session.ts';
export { type ExtractionFormat, setExtractionFormat, getExtractionFormat, type AuxiliaryPasses, setAuxiliaryPasses, getAuxiliaryPasses, continueConversation, advanceConversation, confirmFacts } from './extraction.ts';
export { type IntakeStep, tableRowIds, nextStep, appendAssistantMessage, pendingAsk, type ScriptedAnswer, answerScripted, reaskQuestion, finishNarrative, openTopic, needsTopicQuestion, clarifyStatement, guideConversation } from './flow.ts';
export { generateDraft, exportSession } from './draft.ts';
