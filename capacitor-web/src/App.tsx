import { useEffect, useMemo, useRef, useState } from 'react';
import { answerScripted, appendAssistantMessage, appendUserMessage, applyFormAnswers, calculateCoverage, clarifyStatement, confirmFacts, continueConversation, createSession, deriveQuestion14, exportSession, finishNarrative, formPageOf, formSteps, generateDraft, getActiveFacts, guideConversation, IntakeError, invalidateDraft, isFormSection, metadataGroups, narrativeFieldFor, needsTopicQuestion, nextStep, openTopic, pendingAsk, question14Steps, reaskQuestion, requirementsById, tableRowIds, type FormValue, type IntakeFact, type IntakeScope, type IntakeSession, type ScriptedAnswer, type ScriptedAsk } from './intake';
import { cancelIntakeGeneration, generateIntakeModel, getIntakeRuntimeStatus, getPreviewModel, type IntakeRuntimeStatus } from './lib/intakeModel';
import { intakeLanguages } from './intakeCopy';
import { localizedLabel } from './form/localize';
import { takesOtherText } from './form/otherChoice';
import { localizeAppError } from './appCopy';
import { DEV_TOOLS, FormStage } from './FormStage';
import { saveDraftReview } from './revision/pipeline';
import type { TxtDocument } from './revision/state.mjs';
import { testOpening } from './intake/testMode';
import { exampleAnswerRequest, parseExampleAnswer } from './intake/exampleAnswer';
import { generateReviewModel } from './revision/queue';
import { deferCurrentTopics, reviewBundles } from './intake/journey';
import { SessionOverview } from './sessionOverview/SessionOverview';
import type { OverviewEditTarget } from './sessionOverview/model';
import { formRowIndex } from './sessionOverview/navigation';
import { clearWorkingCopy, readWorkingCopy, initialOutput, type WorkingCopy, type Stage, type Output } from './workingCopy';
import { ProcessingStatus } from './ProcessingStatus';
import { stepProgress } from './stepProgress';
import { appTexts } from './app/texts';
import { isDraftFieldShown, koreanValue, optionLabel, questionText, requirementLabel } from './app/labels';
import { syncConversation, topicOf } from './app/review';
import { useModelTask } from './app/useModelTask';
import { useAutosave } from './app/useAutosave';
import { useChatViewportHeight, useComposerAutosize } from './app/useViewportSizing';
import { demoAnswer } from './app/demo';
import { download } from './app/download';
import { LanguageEntry } from './app/LanguageEntry';
import { OperatorPanel } from './app/OperatorPanel';
import { StepSidebar } from './app/StepSidebar';
import { ConversationStage } from './app/ConversationStage';
import { FactsStage } from './app/FactsStage';
import { DraftStage } from './app/DraftStage';

// Optional initial data supports isolated UI verification; normal startup is unchanged.
export default function App({ initialSession, initialStage }: { initialSession?: IntakeSession; initialStage?: Stage } = {}) {
  const [initialWork] = useState(() => initialSession ? { work: null } as ReturnType<typeof readWorkingCopy> : readWorkingCopy());
  const [stage, updateStage] = useState<Stage>(initialStage ?? initialWork.work?.stage ?? 'language');
  const currentStage = useRef(stage);
  const languageReturnStage = useRef<Stage>('basics');
  function setStageRaw(next: Stage) { currentStage.current = next; updateStage(next); }
  const [formPage, setFormPage] = useState(Math.min(initialWork.work?.formPage ?? 0, formSteps.length - 1));
  const [language, setLanguage] = useState(initialSession?.language ?? initialWork.work?.language ?? 'ko');
  const [session, setSession] = useState<IntakeSession>(() => initialSession ?? initialWork.work?.session ?? createSession('ko', 'full'));
  const [input, setInput] = useState(initialWork.work?.input ?? '');
  const [picked, setPicked] = useState<string[]>(initialWork.work?.picked ?? []);
  const [otherText, setOtherText] = useState('');
  const [generatingExample, setGeneratingExample] = useState(false);
  const [error, setError] = useState('');
  const [retryTask, setRetryTask] = useState<'intake' | 'draft' | null>(null);
  const [runtime, setRuntime] = useState<IntakeRuntimeStatus | null>(null);
  const [model, setModel] = useState(getPreviewModel());
  const [scope, setScope] = useState<IntakeScope>(initialWork.work?.session.scope ?? 'full');
  const [demo, setDemo] = useState(initialWork.work?.demo ?? false);
  const [meaningReady, setMeaningReady] = useState<Record<string, string>>({});
  const [finalReviewedText, setFinalReviewedText] = useState(initialWork.work?.finalReviewedText ?? '');
  const [savedNotice, setSavedNotice] = useState('');
  const [output, setOutput] = useState<Output>(initialOutput(initialWork.work?.output, DEV_TOOLS));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewTarget, setOverviewTarget] = useState<OverviewEditTarget | null>(null);
  const [stageNotice, setStageNotice] = useState('');
  const [restoredNotice, setRestoredNotice] = useState(!!initialWork.work);
  const [recoveryPending, setRecoveryPending] = useState(!!initialWork.work?.pendingTask);
  const [storageFailed, setStorageFailed] = useState(initialWork.problem === 'unavailable');
  const autosaveEnabled = useRef(initialWork.problem !== 'invalid');
  const thread = useRef<HTMLDivElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const main = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modelTask = useModelTask(`${runtime?.mode ?? 'local-preview'}:${runtime?.modelName ?? model}`);
  const { busy, controller } = modelTask;
  /** A model request is running, or an interrupted one waits for the applicant. */
  const locked = !!busy || recoveryPending;

  const texts = appTexts(language);
  const { ux, copy, ui, sc, direction } = texts;
  const facts = getActiveFacts(session);
  const started = session.messages.some(item => item.role === 'user');
  const coverage = calculateCoverage(session);
  const conflicts = new Set(coverage.filter(item => item.status === 'conflict').map(item => item.requirementId));
  const pending = coverage.filter(item => item.status !== 'answered' && item.status !== 'not_applicable');
  const ask = pendingAsk(session);
  const askRequirement = ask && requirementsById.get(ask.requirementId);
  const askOther = !!askRequirement && takesOtherText(askRequirement.id, askRequirement.options);
  const inNarrative = !ask && nextStep(session).kind === 'narrative';
  const showComposer = nextStep(session).kind !== 'done' && (!ask || (ask.kind === 'field' && !askRequirement?.options));
  const narrativeOpened = session.messages.some(item => item.ask?.kind === 'narrative');
  const draftedQuestions = new Set(session.draft.map(item => item.questionId));
  // Question 14 boxes are derived from metadata; other undrafted facts are shown as entered.
  const formFacts = facts.filter(fact => fact.status !== 'conflict' && !draftedQuestions.has(requirementsById.get(fact.requirementId)?.questionId ?? '') && !requirementsById.get(fact.requirementId)?.questionId.startsWith('14'));
  const derived14 = deriveQuestion14(session);
  const steps: { id: Stage; label: string }[] = [{ id: 'basics', label: copy.basics }, ...(session.scope === 'test' ? [] : [{ id: 'form' as Stage, label: sc.formStep }]), { id: 'conversation', label: copy.conversation }, { id: 'facts', label: copy.facts }, { id: 'draft', label: copy.draft }];
  const progress = stepProgress(steps.map(item => item.id), stage);
  const workingCopy = useMemo<WorkingCopy>(() => ({
    version: 1, session, language, stage, formPage, input, picked, demo, finalReviewedText, output,
    pendingTask: recoveryPending ? initialWork.work?.pendingTask ?? null : generatingExample ? null : busy,
  }), [session, language, stage, formPage, input, picked, demo, finalReviewedText, output, recoveryPending, initialWork, generatingExample, busy]);
  useAutosave(workingCopy, autosaveEnabled, saved => setStorageFailed(!saved));
  useEffect(() => { setStageNotice(''); }, [stage, busy]);

  function navigateToStep(next: Stage) {
    if (next === 'draft' && !session.draftRevision) { setStageNotice(ux.draftLocked); return; }
    setStage(next);
  }
  function resumeInterruptedWork() {
    const pending = initialWork.work?.pendingTask;
    setRecoveryPending(false); setRestoredNotice(false);
    if (pending === 'draft' || session.messages.at(-1)?.role === 'user') void run(session, pending ?? 'intake');
  }
  function resetWork() {
    if (!window.confirm(ux.resetConfirm)) return;
    if (!clearWorkingCopy()) { setStorageFailed(true); return; }
    autosaveEnabled.current = false;
    window.location.reload();
  }

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = direction; }, [language, direction]);
  useEffect(() => { if (session.scope === 'test' && language !== 'en') setLanguage('en'); }, [session.scope, language]);
  useEffect(() => { void refreshRuntime(); }, []);
  // Guided question 14 conversation: when the next topic needs a question, ask the model once.
  const guidedAt = useRef(-1);
  useEffect(() => {
    if (stage !== 'conversation' || busy || recoveryPending || controller.current || error || !session.narrativeDone || pendingAsk(session)) return;
    if (!needsTopicQuestion(session) || guidedAt.current === session.messages.length) return;
    guidedAt.current = session.messages.length;
    const step = nextStep(session);
    if (step.kind === 'narrative' && step.guided) void guide(session, step.guided);
  });
  useComposerAutosize(composerInput, [input, stage, busy, ask?.kind, askRequirement?.id]);
  useChatViewportHeight();
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [session.messages.length, busy]);
  useEffect(() => { if (stage !== 'language') main.current?.focus(); }, [stage]);
  useEffect(() => {
    if (showHelp || sourceIds.length) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showHelp, sourceIds]);

  async function refreshRuntime() { setRuntime(await getIntakeRuntimeStatus()); }
  const label = (id: string) => requirementLabel(id, language);
  const topicLabel = (group: { ko: string; en: string }) => localizedLabel(language, group.ko, group.en);
  const sync = (current: IntakeSession) => syncConversation(current, language, sc);
  function showError(failure: unknown) { setError(failure instanceof Error ? failure.message : String(failure)); }
  function answer(reply: ScriptedAnswer) {
    if (busy) return;
    try {
      setSession(sync(answerScripted(session, reply)));
      setInput(''); setPicked([]); setOtherText(''); setError(''); setStage('conversation');
    } catch (failure) { showError(failure); }
  }
  function reask(fact: IntakeFact) {
    const requirement = requirementsById.get(fact.requirementId);
    if (!requirement) return;
    const item: ScriptedAsk = { kind: requirement.type === 'table' ? 'table' : 'field', requirementId: fact.requirementId, eventId: fact.eventId };
    const row = requirement.parentId && fact.eventId ? tableRowIds(session, requirement.parentId).indexOf(fact.eventId) + 1 : 0;
    setSession(reaskQuestion(session, questionText(item, language, sc, row || undefined), item));
    setStage('conversation');
  }
  function openFormAt(requirementId: string) { setFormPage(formPageOf(requirementId)); setStage('form'); }
  /** Form answers are edited in the form; conversation answers by a follow-up; others are asked again. */
  function correctFact(fact: IntakeFact) {
    if (isFormSection(fact.requirementId)) openFormAt(fact.requirementId);
    else if (requirementsById.get(fact.requirementId)?.collection === 'conversation') void clarify(fact);
    else reask(fact);
  }
  const answers14 = session.question14 ?? {};
  const reviewTextKey = JSON.stringify({ answers14, form: session.form, revision: session.draftRevision });
  const finalReviewed = finalReviewedText === reviewTextKey;
  const visibleDraftFields = question14Steps.flatMap(step => step.fields.filter(field => isDraftFieldShown(field, answers14, session.scope)));
  const englishReady = language === 'ko' || (language === 'en' && visibleDraftFields.every(field => { const answer = answers14[field.id]; return answer?.kind !== 'text' || !answer.text.trim() || meaningReady[field.id] === answer.text; }));
  useEffect(() => { setSavedNotice(''); }, [reviewTextKey]);
  const bundlesReviewed = reviewBundles(session).length > 0 && reviewBundles(session).every(bundle => bundle.confirmed);
  function confirmBundle(ids: string[]) {
    setSession(current => {
      const allConfirmed = getActiveFacts(current).filter(f => ids.includes(f.id)).every(f => f.confirmed);
      return { ...current, facts: current.facts.map(f => ids.includes(f.id) ? { ...f, confirmed: !allConfirmed } : f) };
    });
  }
  function confirmAll(checked: boolean) {
    setSession(current => ({ ...current, facts: current.facts.map(f => ({ ...f, confirmed: checked })) }));
  }
  function deferTopic(status: 'unknown' | 'skipped') {
    if (busy || input.trim()) return;
    setSession(current => deferCurrentTopics(current, status, status === 'unknown' ? sc.unknown : sc.skip));
    setError('');
  }
  function endConversation() {
    if (busy || input.trim()) return;
    setSession(current => ({ ...current, narrativeDone: true, guidedDone: true }));
    setStageRaw('facts');
  }
  function updateQuestion14(id: string, value: FormValue | undefined) {
    setSession(current => {
      const next = { ...(current.question14 ?? {}) };
      if (value) next[id] = value; else delete next[id];
      const reviews = { ...current.draftReviews }; delete reviews[id];
      return { ...current, question14: next, draftReviews: reviews };
    });
  }
  function saveSentenceReview(fieldId: string, doc: TxtDocument, expected: string) {
    setSession(current => {
      const answer = current.question14?.[fieldId];
      if (!current.draftRevision || answer?.kind !== 'text' || answer.text !== expected) return current;
      return saveDraftReview(current, fieldId, expected, doc);
    });
  }
  /** Leaving the form saves it into metadata; entering the chat shows the next prompt. */
  function setStage(next: Stage) {
    setOverviewTarget(null);
    const previous = currentStage.current;
    // Viewing another screen must not mutate a session whose model request is in flight.
    if (busy || recoveryPending) { setStageRaw(next); return; }
    setSession(current => {
      let updated = previous === 'form' && next !== 'form' ? applyFormAnswers(current, current.form) : current;
      // Keep a re-asked question or a failed answer awaiting retry as the last message.
      if (next === 'conversation' && !pendingAsk(updated) && updated.messages.at(-1)?.role !== 'user') updated = sync(updated);
      return updated;
    });
    setStageRaw(next);
  }
  function selectLanguage(code: string) {
    setLanguage(code);
    setSession(current => ({ ...current, language: current.scope === 'test' ? 'en' : code,
      messages: current.messages.some(item => item.role === 'user') ? current.messages : createSession(code, current.scope).messages }));
    setStage('basics');
  }
  function changeScope(value: IntakeScope) {
    setScope(value);
    setSession(stage === 'conversation' ? sync(createSession(language, value)) : createSession(language, value));
  }

  async function run(next: IntakeSession, task: 'intake' | 'draft') {
    if (busy) return;
    const requestStage = currentStage.current;
    setSession(next); setError(''); setRetryTask(null);
    await modelTask.track(task, task, async (signal, recordTime) => {
      const result = task === 'intake'
        ? await continueConversation(next, generateIntakeModel, signal)
        : await generateDraft(next, generateIntakeModel, signal);
      if (signal.aborted) return;
      recordTime();
      setSession(task === 'intake' ? sync(result) : result);
      if (task === 'intake' && result.scope === 'test' && nextStep(result).kind === 'done' && currentStage.current === 'conversation') setStageRaw('facts');
      if (task === 'draft' && currentStage.current === requestStage) { setOutput('draft'); setStageRaw('draft'); }
    }, failure => {
      if (failure instanceof IntakeError) setSession(failure.session);
      showError(failure);
      setRetryTask(task);
    }, () => void refreshRuntime());
  }
  async function guide(base: IntakeSession, groups: string[]) {
    setError('');
    await modelTask.track('followup', 'intake', async (signal, recordTime) => {
      const result = await guideConversation(base, generateIntakeModel, signal);
      if (!signal.aborted) { setSession(result); recordTime(); }
    }, (failure, signal) => {
      if (signal.aborted) return;
      // Fallback: a fixed, neutral topic question so the conversation can continue.
      const focus = (failure as { targets?: string[] }).targets?.[0] ?? groups[0];
      const group = metadataGroups.find(item => item.id === focus);
      const said = getActiveFacts(base).find(fact => fact.requirementId === focus)?.value;
      setSession(openTopic(base, [focus], (said === 'no' ? sc.topicNo : sc.topic).replace('{topic}', group ? topicLabel(group) : label(focus))));
    });
  }
  async function clarify(fact: IntakeFact) {
    if (busy || controller.current) return;
    const requestStage = currentStage.current;
    setError('');
    await modelTask.track('followup', 'intake', async (signal, recordTime) => {
      const next = await clarifyStatement(session, fact.id, generateIntakeModel, signal);
      if (!signal.aborted) { setSession(next); setInput(''); recordTime(); if (currentStage.current === requestStage) setStageRaw('conversation'); }
    }, (_failure, signal) => { if (!signal.aborted) setError('errorClarify'); });
  }
  async function send(text = input, base = session, narrative = false) {
    if (!text.trim() || busy) return;
    if (pendingAsk(base) && !narrative) { answer({ text, status: 'answered' }); return; }
    try {
      const next = appendUserMessage(base, text);
      setInput(''); setStage('conversation');
      await run(next, 'intake');
    } catch (failure) { showError(failure); }
  }
  function start() { setStage(scope === 'full' ? 'form' : 'conversation'); }
  function startQuickTest() {
    setLanguage('en'); setScope('test'); setDemo(false); setInput(''); setError(''); setRetryTask(null);
    setSession(appendAssistantMessage(createSession('en', 'test'), testOpening, { kind: 'narrative' })); setStageRaw('conversation');
  }
  async function generateExample() {
    if (busy || controller.current || input.trim() || session.scope !== 'test') return;
    setGeneratingExample(true); setError(''); setRetryTask(null);
    await modelTask.track('example', 'intake', async (signal, recordTime) => {
      const example = parseExampleAnswer(await generateReviewModel({ ...exampleAnswerRequest(session), signal }));
      if (!signal.aborted) { setInput(example); setDemo(true); recordTime(); }
    }, (_failure, signal) => { if (!signal.aborted) setError('errorExample'); }, () => setGeneratingExample(false));
  }
  async function stop() {
    controller.current?.abort();
    try { await cancelIntakeGeneration(); } catch (failure) { setError(String(failure)); }
  }
  async function draft() {
    try {
      const confirmed = confirmFacts(session, facts.filter(item => item.status !== 'conflict' && !conflicts.has(item.requirementId)).map(item => item.id));
      await run(confirmed, 'draft');
    } catch (failure) { showError(failure); }
  }
  async function startDemo() {
    if (session.messages.some(item => item.role === 'user') || busy) return;
    setDemo(true); setLanguage('ko'); setScope('priority'); setOperatorOpen(false);
    await send(demoAnswer, createSession('ko', 'priority'));
  }
  function exportAll() {
    const data = JSON.parse(exportSession(session));
    data.question14Edited = session.question14 ? 'question14 holds the applicant-reviewed answers; draft.sections keep the generated sentences and their sources' : undefined;
    data.synthetic = demo;
    data.applicantReview = { meaningChecked: finalReviewed && englishReady, draftRevision: session.draftRevision };
    data.question14Derived = derived14;
    data.formValues = formFacts.map(fact => ({ factId: fact.id, requirementId: fact.requirementId, eventId: fact.eventId, ko: koreanValue(fact) }));
    download(`DARI-${session.id.slice(0, 8)}.json`, JSON.stringify(data, null, 2));
    setSavedNotice(ui.savedRecord);
  }

  // Opening the overview is read-only. Editing uses the existing form, correction
  // composer or Korean draft controls; original messages are never rewritten.
  const overviewFact = overviewTarget?.kind === 'fact' ? session.facts.find(fact => fact.id === overviewTarget.factId) : undefined;
  const overviewTopic = overviewTarget?.kind === 'conversation' ? metadataGroups.find(item => item.id === overviewTarget.topicId) : undefined;
  const overviewFormField = overviewTarget?.kind === 'form' ? overviewTarget.fieldId
    : overviewFact && isFormSection(overviewFact.requirementId) ? requirementsById.get(overviewFact.requirementId)?.parentId ?? overviewFact.requirementId : undefined;
  /** The question asked at or before a message. */
  function questionBefore(messageId: string) {
    const index = session.messages.findIndex(item => item.id === messageId);
    return index >= 0 ? session.messages.slice(0, index + 1).reverse().find(item => item.ask) : undefined;
  }
  function editFromOverview(target: OverviewEditTarget) {
    if (busy || recoveryPending) return;
    setOverviewOpen(false);
    if (target.kind === 'form') {
      openFormAt(target.fieldId);
    } else if (target.kind === 'fact') {
      const fact = session.facts.find(item => item.id === target.factId);
      if (!fact) return;
      if (isFormSection(fact.requirementId)) openFormAt(fact.requirementId);
      else if (requirementsById.get(fact.requirementId)?.collection !== 'conversation') reask(fact);
      else setStage('facts');
    } else if (target.kind === 'draft') {
      setOutput('draft'); setEditingField(null); setStage('draft');
    } else {
      const questionMessage = target.messageId ? questionBefore(target.messageId) : undefined;
      const question = questionMessage?.ask;
      if (question && 'requirementId' in question && isFormSection(question.requirementId)) {
        editFromOverview({ kind: 'form', fieldId: requirementsById.get(question.requirementId)?.parentId ?? question.requirementId }); return;
      }
      if (!target.messageId && !target.topicId) { setStage(stage === 'facts' ? 'facts' : 'conversation'); }
      else if (question && 'requirementId' in question && questionMessage) {
        setSession(reaskQuestion(session, questionMessage.content, question)); setStage('conversation');
      } else setStage('facts');
    }
    setOverviewTarget({ ...target });
  }
  /** A correction reopens the topic (or repeats the question) it is about, then sends the text. */
  async function sendCorrection() {
    let base = session;
    const reopen = (topicId: string | undefined, topic: string, topics: string[]) => {
      const decisions = { ...base.topicDecisions }; if (topicId) delete decisions[topicId];
      return appendAssistantMessage({ ...base, topicDecisions: decisions }, sc.topic.replace('{topic}', topic), { kind: 'narrative', topics });
    };
    if (overviewTarget?.kind === 'conversation' && overviewTarget.topicId) {
      const topicId = overviewTarget.topicId;
      const group = metadataGroups.find(item => item.id === topicId);
      base = reopen(topicId, group ? topicLabel(group) : topicId, [topicId]);
    } else if (overviewFact && !isFormSection(overviewFact.requirementId)) {
      const group = topicOf(overviewFact.requirementId);
      base = reopen(group?.id, group ? topicLabel(group) : label(overviewFact.requirementId), [group?.id ?? overviewFact.requirementId]);
    } else if (overviewTarget?.kind === 'conversation' && overviewTarget.messageId) {
      const question = questionBefore(overviewTarget.messageId);
      if (question?.ask) base = appendAssistantMessage(base, question.content, question.ask);
    }
    await send(input, base, true);
  }
  useEffect(() => {
    if (!overviewTarget || overviewOpen) return;
    const frame = requestAnimationFrame(() => {
      let element: HTMLElement | null = null;
      const fieldId = overviewFormField ?? (overviewTarget.kind === 'draft' ? overviewTarget.fieldId : undefined);
      if (fieldId) {
        const container = main.current?.querySelector<HTMLElement>(`[data-field-id="${CSS.escape(fieldId)}"]`);
        if (overviewFact?.eventId && requirementsById.get(overviewFact.requirementId)?.parentId) {
          const row = formRowIndex(session.form, fieldId, overviewFact.eventId);
          const parent = formSteps.flatMap(step => step.fields).find(field => field.id === fieldId);
          const column = parent?.columns?.findIndex(item => `${fieldId}.${item.id}` === overviewFact.requirementId) ?? -1;
          element = row >= 0 && column >= 0 ? container?.querySelectorAll<HTMLElement>('.table-entry')[row]?.querySelectorAll<HTMLElement>('input')[column] ?? null : null;
        }
        element ??= container?.querySelector<HTMLElement>('input,textarea,button') ?? container ?? null;
      } else element = main.current?.querySelector<HTMLElement>(stage === 'conversation' ? '.chat-composer textarea,.answer-choices button' : '[data-overview-correction] textarea') ?? null;
      element?.scrollIntoView({ block: 'center' });
      (element ?? main.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  // Modal open/close alone must preserve correction context and restore its trigger.
  }, [overviewTarget, overviewFormField, stage, formPage]);

  function closeDialog() { setShowHelp(false); setSourceIds([]); }

  function processingStatus(showStop = true) {
    return busy && <ProcessingStatus task={modelTask.task} language={language} elapsed={modelTask.elapsed}
      estimate={modelTask.estimate} onStop={() => void stop()} showStop={showStop} />;
  }

  if (stage === 'language') return <LanguageEntry texts={texts} status={processingStatus()} locked={locked} onSelect={selectLanguage}
    onBack={busy ? () => setStageRaw(languageReturnStage.current) : undefined}
    onQuickTest={DEV_TOOLS && !started && !Object.keys(session.form).length ? startQuickTest : undefined} />;

  const titles: Record<Exclude<Stage, 'language'>, [string, string]> = {
    basics: [copy.startTitle, copy.startIntro], form: [sc.formTitle, sc.formIntro], conversation: [copy.chatTitle, copy.chatIntro],
    facts: [copy.factsTitle, copy.factsIntro], draft: [copy.draftTitle, copy.draftIntro],
  };
  const [title, intro] = titles[stage];
  const shellMode = stage === 'conversation' || stage === 'form' ? 'chat-mode' : stage === 'basics' ? 'start-mode' : 'page-mode';
  return <div className={`app-shell ${shellMode}`}>
    <a className="skip-link" href="#main">{copy.continue}</a>
    <header className="site-header">
      <button className="brand" onClick={() => setStage('basics')}><strong lang="en" dir="ltr">DARI</strong><span>{copy.tagline}</span></button>
      <div className="header-actions">
        <button className="secondary overview-trigger" aria-haspopup="dialog" aria-expanded={overviewOpen} onClick={() => { setOperatorOpen(false); setOverviewOpen(true); }}>{texts.overview.open}</button>
        <button className="quiet" onClick={() => { languageReturnStage.current = currentStage.current; setStage('language'); }}>{intakeLanguages.find(item => item.code === language)?.name}</button>
        <button className="quiet" onClick={() => setShowHelp(true)}><span className="help-mark">?</span>{copy.help}</button>
        <div className="operator-entry">
          <button className="operator-toggle" aria-expanded={operatorOpen} aria-controls="operator" aria-label={ui.operator} title={ui.operator} onClick={() => setOperatorOpen(open => !open)}>⚙</button>
          {operatorOpen && <OperatorPanel texts={texts} language={language} runtime={runtime} onRuntime={setRuntime} refreshRuntime={refreshRuntime}
            model={model} onModel={setModel} importing={importing} onImporting={setImporting} scope={scope} onScope={changeScope}
            locked={locked} started={started} onError={setError} onStartDemo={() => void startDemo()} onExport={exportAll} onClose={() => setOperatorOpen(false)} />}
        </div>
      </div>
    </header>
    <div className="workspace">
      <StepSidebar texts={texts} steps={steps} stage={stage} progress={progress} draftReady={!!session.draftRevision}
        notice={stageNotice} onDismissNotice={() => setStageNotice('')} onNavigate={navigateToStep} />
      {processingStatus(stage !== 'conversation' || !showComposer)}
      <main id="main" ref={main} tabIndex={-1}>
        {(restoredNotice || recoveryPending || storageFailed || initialWork.problem === 'invalid') && <div className="session-status" role="status">
          <span>{storageFailed ? ux.storageFailed : initialWork.problem === 'invalid' ? ux.invalid : recoveryPending ? ux.interrupted : ux.restored}</span>
          {recoveryPending && <button className="quiet" onClick={resumeInterruptedWork}>{ux.resume}</button>}
          {initialWork.problem === 'invalid' ? <button className="quiet" onClick={resetWork}>{ux.newSession}</button> : !recoveryPending && !storageFailed && <button className="quiet" onClick={() => setRestoredNotice(false)}>{copy.close}</button>}
        </div>}
        <h1>{title}</h1>
        <p className="intro">{intro}</p>
        {stage === 'basics' && DEV_TOOLS && language === 'en' && !started && !Object.keys(session.form).length && <button className="secondary" disabled={locked} onClick={startQuickTest}>{ui.shortConversation}</button>}
        {error && <div className="notice error" role="alert"><p>{localizeAppError(language, error)}</p>{retryTask && <div className="actions"><button className="secondary" disabled={locked} onClick={() => void run(session, retryTask)}>{copy.retry}</button></div>}</div>}
        {runtime && (!runtime.available || !runtime.modelReady) && (narrativeOpened || stage === 'facts') && <div className="notice"><p>{copy.unavailable}</p><button className="quiet" onClick={() => setOperatorOpen(true)}>{ui.operator}</button></div>}
        {stage === 'basics' && <div className="content-grid">
          <section className="start-panel">{started && <p className="micro">{copy.factsIntro}</p>}<div className="actions" style={started ? undefined : { marginTop: 0 }}><button className="primary full" onClick={start}>{started ? copy.continue : copy.start}<span aria-hidden="true">{direction === 'rtl' ? '←' : '→'}</span></button></div></section>
          <aside className="support-card"><h2>{copy.pace}</h2><p>{copy.chatIntro}</p><p className="micro">{copy.memory}</p></aside>
        </div>}
        {stage === 'form' && <fieldset className="form-stage-guard" disabled={locked}><FormStage language={language} answers={session.form} page={formPage} copy={sc} back={copy.back} next={copy.continue}
          onChange={form => { setSession(current => ({ ...invalidateDraft(current), form })); }} onPage={page => { setOverviewTarget(null); setFormPage(page); }} onDone={() => setStage('conversation')} focusField={overviewFormField} hiddenFieldNotice={texts.overview.hiddenFieldEditing} /></fieldset>}
        {stage === 'conversation' && <ConversationStage texts={texts} language={language} session={session} busy={busy} locked={locked} threadRef={thread} composerRef={composerInput}
          input={input} onInput={setInput} ask={ask} askRequirement={askRequirement} askOther={askOther} picked={picked} onPick={setPicked} otherText={otherText} onOtherText={setOtherText}
          inNarrative={inNarrative} showComposer={showComposer} generatingExample={generatingExample} onGenerateExample={() => void generateExample()} onEndConversation={endConversation}
          onReview={() => setStage('facts')} onDefer={deferTopic} onFinishStory={() => setSession(current => sync(finishNarrative(current)))} onAnswer={answer} onSend={() => void send()} onStop={() => void stop()} />}
        {stage === 'facts' && <FactsStage texts={texts} language={language} session={session} facts={facts} conflicts={conflicts} pending={pending} busy={busy} locked={locked}
          bundlesReviewed={bundlesReviewed} input={input} onInput={setInput}
          showCorrection={narrativeOpened || overviewTarget?.kind === 'fact' || overviewTarget?.kind === 'conversation'}
          correctionTopic={overviewFact ? label(overviewFact.requirementId) : overviewTopic ? topicLabel(overviewTopic) : undefined}
          onConfirmBundle={confirmBundle} onCorrect={correctFact} onClarify={fact => void clarify(fact)} onEditInForm={fact => openFormAt(fact.requirementId)} onReask={reask}
          onSendCorrection={() => void sendCorrection()} onReviewAll={confirmAll} onBack={() => setStage('conversation')} onDraft={() => void draft()} onStop={() => void stop()} />}
        {stage === 'draft' && <DraftStage texts={texts} language={language} session={session} busy={busy} locked={locked} output={output} onOutput={setOutput}
          derived14={derived14} formFacts={formFacts} focusField={overviewTarget?.kind === 'draft' ? overviewTarget.fieldId : undefined}
          editingField={editingField} onEditingField={setEditingField} onSources={setSourceIds}
          onMeaningReady={(fieldId, text) => setMeaningReady(current => current[fieldId] === text ? current : { ...current, [fieldId]: text })}
          onQuestion14={updateQuestion14} onSentenceReview={saveSentenceReview}
          finalReviewed={finalReviewed} englishReady={englishReady} onFinalCheck={checked => setFinalReviewedText(checked ? reviewTextKey : '')}
          savedNotice={savedNotice} onNotice={setSavedNotice} onError={setError} exportOpen={exportOpen} onExportOpen={setExportOpen}
          onBack={() => setStage('facts')} onSaveRecord={exportAll} />}
      </main>
    </div>
    <footer className="site-footer"><span>{copy.tagline}</span><span>{copy.memory}</span></footer>
    {overviewOpen && <SessionOverview session={session} language={language} pendingText={[input, ...picked.map(value => optionLabel(askRequirement?.options?.find(option => option.value === value) ?? { ko: value, en: value }, language))].filter(Boolean).join('\n')} busy={locked} onClose={() => setOverviewOpen(false)} onEdit={editFromOverview} />}
    <dialog ref={dialog} className="help-dialog" onCancel={closeDialog} onClose={closeDialog}>
      <h2>{showHelp ? copy.help : copy.source}</h2>
      {showHelp
        ? <><p>{copy.helpBody}</p><p>{copy.memory}</p><button className="secondary" disabled={!!busy} onClick={resetWork}>{ux.newSession}</button></>
        : session.messages.filter(item => item.role === 'user' && sourceIds.includes(item.id)).map(item => <div key={item.id}><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p></div>)}
      <div className="actions"><button className="primary" onClick={closeDialog}>{copy.close}</button></div>
    </dialog>
  </div>;
}
