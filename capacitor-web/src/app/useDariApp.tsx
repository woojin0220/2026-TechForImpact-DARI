import { lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyFormAnswers, guideConversation, needsTopicQuestion, deriveQuestion14, isFieldVisible, narrativeFieldFor, question14Steps, type FormValue, formSteps, isNarrative, metadataGroups, openTopic, answerScripted, appendAssistantMessage, isFormSection, appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, exportSession, generateDraft, getActiveFacts, IntakeError, narrativeOpening, nextStep, pendingAsk, reaskQuestion, requirementsById, tableRowIds, type IntakeFact, type IntakeSession, type ScriptedAnswer, type ScriptedAsk } from '../intake';
import { cancelIntakeGeneration, generateIntakeModel, getIntakeRuntimeStatus, getPreviewModel, type IntakeRuntimeStatus } from '../lib/intakeModel';
import { intakeCopies, intakeProcessCopy, scriptedCopy } from '../intakeCopy';
import { localize, localizedLabel, localizedRequirementLabel } from '../form/localize';
import { koreanChoiceText, OTHER_OPTION, takesOtherText } from '../form/otherChoice';
import { appCopyFor } from '../appCopy';
import { statusWords } from '../statusCopy';
import { DEV_TOOLS, formPageOf } from '../FormStage';
import { testOpening } from '../intake/testMode';
import { exampleAnswerRequest, parseExampleAnswer } from '../intake/exampleAnswer';
import { generateReviewModel } from '../revision/queue';
import { clarifyStatement, eventReview } from '../intake';
import { deferCurrentTopics, reviewBundles } from '../intake/journey';
import { overviewCopyFor } from '../sessionOverview/copy';
import type { OverviewEditTarget } from '../sessionOverview/model';
import { formRowIndex } from '../sessionOverview/navigation';
import { clearWorkingCopy, readWorkingCopy, writeWorkingCopy, initialOutput, type WorkingCopy, type Stage, type Output } from '../workingCopy';
import { sessionUxCopy } from '../sessionUxCopy';
import { ProcessingStatus } from '../ProcessingStatus';
import { stepProgress } from '../stepProgress';
import { estimateProcessingTime, type ProcessingTask } from '../processingTime';

// Module-level helpers shared by the screens.

// Benchmark tools ship only in development builds or builds made with VITE_DARI_BENCH=1.
export const BenchPanel = import.meta.env.DEV || import.meta.env.VITE_DARI_BENCH === '1' ? lazy(() => import('../bench/BenchPanel')) : null;
export const ApplicationExport = lazy(() => import('../export/ApplicationExport'));

export const demoAnswer = '이것은 기능 테스트를 위한 가상 이야기입니다. 저는 정치적 의견 때문에 보호를 신청하려고 합니다. 2025년 봄쯤 제 나라의 작은 도시에서 평화적인 집회에 참여한 뒤 경찰 제복을 입은 두 사람이 집에 찾아왔습니다. 정확한 날짜는 기억나지 않습니다. 그들은 저에게 집회에 다시 나가지 말라고 말했고 저는 무서웠습니다. 저는 구금되거나 다치지는 않았습니다. 이 일이 정치적 의견 때문이라고 생각하지만 그들의 실제 소속은 확인하지 못했습니다. 그 뒤 다른 도시의 친구 집으로 옮겼습니다. 가족이 직접 피해를 입은 일은 없습니다. 돌아가면 다시 위협받을까 두렵습니다. 무기를 보지는 못했습니다.';


export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Optional initial data supports isolated UI verification; normal startup is unchanged.

/** All state and actions of the DARI screen flow. The screens in this folder render from it. */
export function useDariApp({ initialSession, initialStage }: { initialSession?: IntakeSession; initialStage?: Stage } = {}) {
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
  const [busy, setBusy] = useState<'intake' | 'draft' | null>(null);
  const [generatingExample, setGeneratingExample] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [processingTask, setProcessingTask] = useState<ProcessingTask>('intake');
  const [processingSamples, setProcessingSamples] = useState<Record<string, number[]>>({});
  const timingKey = (task: ProcessingTask) => `${runtime?.mode ?? 'local-preview'}:${runtime?.modelName ?? model}:${task}`;
  function recordProcessingTime(task: ProcessingTask, startedAt: number) {
    const key = timingKey(task);
    const seconds = (Date.now() - startedAt) / 1000;
    setProcessingSamples(current => ({ ...current, [key]: [...(current[key] ?? []), seconds].slice(-5) }));
  }
  const [error, setError] = useState('');
  const [retryTask, setRetryTask] = useState<'intake' | 'draft' | null>(null);
  const [runtime, setRuntime] = useState<IntakeRuntimeStatus | null>(null);
  const [model, setModel] = useState(getPreviewModel());
  const [scope, setScope] = useState<'priority' | 'full' | 'test'>(initialWork.work?.session.scope ?? 'full');
  const [demo, setDemo] = useState(initialWork.work?.demo ?? false);
  const [reviewed, setReviewed] = useState(false);
  const [meaningReady, setMeaningReady] = useState<Record<string, string>>({});
  const [finalReviewedText, setFinalReviewedText] = useState(initialWork.work?.finalReviewedText ?? '');
  const [savedNotice, setSavedNotice] = useState('');
  const [output, setOutput] = useState<Output>(initialOutput(initialWork.work?.output, DEV_TOOLS));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const main = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewTarget, setOverviewTarget] = useState<OverviewEditTarget | null>(null);
  const [stageNotice, setStageNotice] = useState('');
  const [restoredNotice, setRestoredNotice] = useState(!!initialWork.work);
  const [recoveryPending, setRecoveryPending] = useState(!!initialWork.work?.pendingTask);
  const [storageFailed, setStorageFailed] = useState(initialWork.problem === 'unavailable');
  const autosaveEnabled = useRef(initialWork.problem !== 'invalid');
  const ux = sessionUxCopy[language] ?? sessionUxCopy.en;
  const copy = { ...(intakeCopies[language] ?? intakeCopies.en), memory: ux.memory };
  const ui = appCopyFor(language);
  const overviewCopy = overviewCopyFor(language);
  const sc = scriptedCopy[language] ?? scriptedCopy.en;
  const processCopy = intakeProcessCopy[language] ?? intakeProcessCopy.en;
  const direction = ['ar', 'fa'].includes(language) ? 'rtl' : 'ltr';
  const facts = getActiveFacts(session);
  const started = session.messages.some(item => item.role === 'user');
  const coverage = calculateCoverage(session);
  const eventsToReview = eventReview(session);
  const conflicts = new Set(coverage.filter(item => item.status === 'conflict').map(item => item.requirementId));
  const pending = coverage.filter(item => item.status !== 'answered' && item.status !== 'not_applicable');
  const ask = pendingAsk(session);
  const askRequirement = ask && requirementsById.get(ask.requirementId);
  const askOther = !!askRequirement && takesOtherText(askRequirement.id, askRequirement.options);
  const [otherText, setOtherText] = useState('');
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
  const latestWork = useRef(workingCopy);
  latestWork.current = workingCopy;
  useEffect(() => {
    if (autosaveEnabled.current) setStorageFailed(!writeWorkingCopy(workingCopy));
  }, [workingCopy]);
  useEffect(() => {
    const save = () => { if (autosaveEnabled.current) writeWorkingCopy(latestWork.current); };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', save); };
  }, []);
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
  useEffect(() => {
    setElapsed(0);
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useLayoutEffect(() => {
    const resize = () => {
      const textarea = composerInput.current;
      if (!textarea) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const limit = Math.min(180, Math.max(88, viewportHeight * 0.25));
      textarea.style.height = '0px';
      textarea.style.height = `${Math.max(44, Math.min(textarea.scrollHeight, limit))}px`;
      textarea.style.overflowY = textarea.scrollHeight > limit ? 'auto' : 'hidden';
    };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); };
  }, [input, stage, busy, ask?.kind, askRequirement?.id]);
  useEffect(() => {
    const resize = () => document.documentElement.style.setProperty('--dari-chat-height', `${window.visualViewport?.height ?? window.innerHeight}px`);
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      document.documentElement.style.removeProperty('--dari-chat-height');
    };
  }, []);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [session.messages.length, busy]);
  useEffect(() => { if (stage !== 'language') main.current?.focus(); }, [stage]);
  useEffect(() => {
    if (showHelp || sourceIds.length) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showHelp, sourceIds]);

  async function refreshRuntime() { setRuntime(await getIntakeRuntimeStatus()); }
  function requirementLabel(id: string) {
    const requirement = requirementsById.get(id);
    return requirement ? localizedRequirementLabel(requirement, language) : id;
  }
  function factValue(id: string, value: string | string[], other?: string) {
    const options = requirementsById.get(id)?.options ?? [];
    return (Array.isArray(value) ? value : [value]).map(item => {
      const option = options.find(choice => choice.value === item);
      if (!option) return item;
      const label = language === 'en' ? option.en : localize(language, option.ko);
      return item === OTHER_OPTION && other ? `${label}: ${other}` : label;
    }).join(' · ');
  }
  /** Review list: question 14 groups first (from the conversation), then form sections; incidents kept apart. */
  function factGroups() {
    const groups = new Map<string, { label: string; order: number; story: boolean; facts: IntakeFact[] }>();
    for (const fact of facts) {
      const requirement = requirementsById.get(fact.requirementId);
      let key = 'other', label = requirement?.label ?? fact.requirementId, order = 999, story = false;
      const group = requirement && isNarrative(requirement) ? metadataGroups.find(item => fact.requirementId === item.id || fact.requirementId.startsWith(`${item.id}.`)) : undefined;
      if (group) { key = group.id; label = localizedLabel(language, group.ko, group.en); order = metadataGroups.indexOf(group); story = true; }
      else if (isFormSection(fact.requirementId)) {
        const page = formPageOf(fact.requirementId); const step = formSteps[page];
        key = `form-${page}`; label = localizedLabel(language, step.titleKo, step.titleEn); order = 100 + page;
      }
      if (!groups.has(key)) groups.set(key, { label, order, story, facts: [] });
      groups.get(key)!.facts.push(fact);
    }
    return [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([key, group]) => ({ key, ...group,
      events: [...new Set(group.facts.map(fact => fact.eventId ?? ''))].map(eventId => ({ eventId, facts: group.facts.filter(fact => (fact.eventId ?? '') === eventId) })) }));
  }
  /** Each drafted sentence with the applicant's own quoted words (not form entries). */
  function sentenceOrigins(section?: { sentences?: { text: string; factIds: string[]; sourceIds: string[] }[] }) {
    const userIds = new Set(session.messages.filter(message => message.role === 'user').map(message => message.id));
    return (section?.sentences ?? []).map(item => ({ text: item.text, quotes: item.factIds.flatMap(id => session.facts.find(fact => fact.id === id)?.sourceQuotes ?? [])
      .filter(quote => userIds.has(quote.sourceId)).map(quote => quote.quote) }));
  }
  function optionLabel(option: { ko: string; en: string }) { return language === 'en' ? option.en : localize(language, option.ko); }
  /** The applicant's message for a confirmed choice; “기타” text stays verbatim. */
  function pickedText(options: { value: string; ko: string; en: string }[], values = picked) {
    const detail = askOther && values.includes(OTHER_OPTION) ? otherText.trim() : '';
    return options.filter(option => values.includes(option.value)).map(option => option.value === OTHER_OPTION && detail ? `${optionLabel(option)}: ${detail}` : optionLabel(option)).join(', ');
  }
  function questionText(item: ScriptedAsk, row?: number) {
    const label = requirementLabel(item.requirementId);
    if (item.kind === 'table') return `${label} — ${sc.tableAsk}`;
    if (item.kind === 'more') return `${label} — ${sc.tableMore}`;
    return row ? `${sc.row.replace('{n}', String(row))} · ${label}` : label;
  }
  /** Append whatever the app should say next: a fixed question, the story prompt or the closing note. */
  function sync(current: IntakeSession): IntakeSession {
    const step = nextStep(current);
    const last = current.messages.at(-1);
    if (step.kind === 'ask') {
      const open = pendingAsk(current);
      if (open && open.kind === step.ask.kind && open.requirementId === step.ask.requirementId && open.eventId === step.ask.eventId) return current;
      return appendAssistantMessage(current, questionText(step.ask, step.row), step.ask);
    }
    if (step.kind === 'narrative') {
      // Guided questions are written by the model (see the guidance effect).
      if (step.guided) return current;
      if (!current.messages.some(item => item.ask?.kind === 'narrative')) return appendAssistantMessage(current, narrativeOpening(current.language), { kind: 'narrative' });
      return last?.role === 'user' ? appendAssistantMessage(current, sc.resume, { kind: 'narrative' }) : current;
    }
    return last?.ask?.kind === 'done' || pendingAsk(current) ? current : appendAssistantMessage(current, sc.done, { kind: 'done' });
  }
  function answer(reply: ScriptedAnswer) {
    if (busy) return;
    try {
      setSession(sync(answerScripted(session, reply)));
      setInput(''); setPicked([]); setOtherText(''); setReviewed(false); setError(''); setStage('conversation');
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  }
  function reask(fact: IntakeFact) {
    const requirement = requirementsById.get(fact.requirementId);
    if (!requirement) return;
    const item: ScriptedAsk = { kind: requirement.type === 'table' ? 'table' : 'field', requirementId: fact.requirementId, eventId: fact.eventId };
    const row = requirement.parentId && fact.eventId ? tableRowIds(session, requirement.parentId).indexOf(fact.eventId) + 1 : 0;
    setSession(reaskQuestion(session, questionText(item, row || undefined), item));
    setStage('conversation');
  }
  function koreanValue(fact: IntakeFact) {
    const options = requirementsById.get(fact.requirementId)?.options ?? [];
    const value = koreanChoiceText(options, Array.isArray(fact.value) ? fact.value : [fact.value], fact.otherText);
    return fact.status === 'answered' ? value : `${statusWords.ko[fact.status]} (${value})`;
  }
  const answers14 = session.question14 ?? {};
  const reviewTextKey = JSON.stringify({ answers14, form: session.form, revision: session.draftRevision });
  const finalReviewed = finalReviewedText === reviewTextKey;
  const visibleDraftFields = question14Steps.flatMap(step => step.fields.filter(field => isFieldVisible(field, answers14) && (session.scope !== 'test' || /^14\.[123](?:-|$)/.test(field.id))));
  const englishReady = language === 'ko' || (language === 'en' && visibleDraftFields.every(field => { const answer = answers14[field.id]; return answer?.kind !== 'text' || !answer.text.trim() || meaningReady[field.id] === answer.text; }));
  useEffect(() => { setSavedNotice(''); }, [reviewTextKey]);
  const bundlesReviewed = reviewBundles(session).length > 0 && reviewBundles(session).every(bundle => bundle.confirmed);
  function confirmBundle(ids: string[]) {
    setSession(current => {
      const allConfirmed = getActiveFacts(current).filter(f => ids.includes(f.id)).every(f => f.confirmed);
      return { ...current, facts: current.facts.map(f => ids.includes(f.id) ? { ...f, confirmed: !allConfirmed } : f) };
    });
    setReviewed(false);
  }
  function deferTopic(status: 'unknown' | 'skipped') {
    if (busy || input.trim()) return;
    setSession(current => deferCurrentTopics(current, status, status === 'unknown' ? sc.unknown : sc.skip));
    setReviewed(false); setError('');
  }
  function endConversation() {
    if (busy || input.trim()) return;
    setSession(current => ({ ...current, narrativeDone: true, guidedDone: true }));
    setStageRaw('facts');
  }
  const sectionsByField = new Map(session.draft.map(section => [narrativeFieldFor(section.questionId, answers14), section]));
  function updateQuestion14(id: string, value: FormValue | undefined) {
    setSession(current => { const next = { ...(current.question14 ?? {}) }; if (value) next[id] = value; else delete next[id]; const reviews = { ...current.draftReviews }; delete reviews[id]; return { ...current, question14: next, draftReviews: reviews }; });
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
  async function run(next: IntakeSession, task: 'intake' | 'draft') {
    if (busy) return;
    const requestStage = currentStage.current;
    const startedAt = Date.now();
    setProcessingTask(task);
    setSession(next); setBusy(task); setError(''); setRetryTask(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = task === 'intake'
        ? await continueConversation(next, generateIntakeModel, abort.signal)
        : await generateDraft(next, generateIntakeModel, abort.signal);
      if (abort.signal.aborted) return;
      recordProcessingTime(task, startedAt);
      setSession(task === 'intake' ? sync(result) : result);
      if (task === 'intake' && result.scope === 'test' && nextStep(result).kind === 'done' && currentStage.current === 'conversation') setStageRaw('facts');
      if (task === 'draft' && currentStage.current === requestStage) { setOutput('draft'); setStageRaw('draft'); }
    } catch (failure) {
      if (failure instanceof IntakeError) setSession(failure.session);
      setError(failure instanceof Error ? failure.message : String(failure));
      setRetryTask(task);
    } finally { controller.current = null; setBusy(null); void refreshRuntime(); }
  }
  async function guide(base: IntakeSession, groups: string[]) {
    const startedAt = Date.now();
    setProcessingTask('followup');
    setBusy('intake'); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = await guideConversation(base, generateIntakeModel, abort.signal);
      if (!abort.signal.aborted) { setSession(result); recordProcessingTime('followup', startedAt); }
    } catch (failure) {
      if (abort.signal.aborted) return;
      // Fallback: a fixed, neutral topic question so the conversation can continue.
      const focus = (failure as { targets?: string[] }).targets?.[0] ?? groups[0];
      const group = metadataGroups.find(item => item.id === focus);
      const said = getActiveFacts(base).find(fact => fact.requirementId === focus)?.value;
      setSession(openTopic(base, [focus], (said === 'no' ? sc.topicNo : sc.topic).replace('{topic}', group ? localizedLabel(language, group.ko, group.en) : requirementLabel(focus))));
    } finally { controller.current = null; setBusy(null); }
  }
  async function clarify(fact: IntakeFact) {
    if (busy || controller.current) return;
    const requestStage = currentStage.current;
    const startedAt = Date.now();
    setProcessingTask('followup');
    setBusy('intake'); setError(''); setReviewed(false);
    const abort = new AbortController(); controller.current = abort;
    try {
      const next = await clarifyStatement(session, fact.id, generateIntakeModel, abort.signal);
      if (!abort.signal.aborted) { setSession(next); setInput(''); recordProcessingTime('followup', startedAt); if (currentStage.current === requestStage) setStageRaw('conversation'); }
    } catch (failure) {
      if (!abort.signal.aborted) setError('errorClarify');
    } finally { controller.current = null; setBusy(null); }
  }
  async function send(text = input, base = session, narrative = false) {
    if (!text.trim() || busy) return;
    if (pendingAsk(base) && !narrative) { answer({ text, status: 'answered' }); return; }
    try {
      const next = appendUserMessage(base, text);
      setInput(''); setReviewed(false); setStage('conversation');
      await run(next, 'intake');
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  }
  function start() { setStage(scope === 'full' ? 'form' : 'conversation'); }
  function startQuickTest() {
    setLanguage('en'); setScope('test'); setDemo(false); setReviewed(false); setInput(''); setError(''); setRetryTask(null);
    setSession(appendAssistantMessage(createSession('en', 'test'), testOpening, { kind: 'narrative' })); setStageRaw('conversation');
  }
  async function generateExample() {
    if (busy || controller.current || input.trim() || session.scope !== 'test') return;
    const abort = new AbortController(); controller.current = abort;
    const startedAt = Date.now();
    setProcessingTask('example');
    setBusy('intake'); setGeneratingExample(true); setError(''); setRetryTask(null);
    try {
      const answer = parseExampleAnswer(await generateReviewModel({ ...exampleAnswerRequest(session), signal: abort.signal }));
      if (!abort.signal.aborted) { setInput(answer); setDemo(true); recordProcessingTime('example', startedAt); }
    } catch (failure) {
      if (!abort.signal.aborted) setError('errorExample');
    } finally { controller.current = null; setBusy(null); setGeneratingExample(false); }
  }
  async function stop() {
    controller.current?.abort();
    try { await cancelIntakeGeneration(); } catch (failure) { setError(String(failure)); }
  }
  async function draft() {
    try {
      const confirmed = confirmFacts(session, facts.filter(item => item.status !== 'conflict' && !conflicts.has(item.requirementId)).map(item => item.id));
      await run(confirmed, 'draft');
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
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
  function editFromOverview(target: OverviewEditTarget) {
    if (busy || recoveryPending) return;
    setOverviewOpen(false);
    if (target.kind === 'form') {
      setFormPage(formPageOf(target.fieldId)); setStage('form');
    } else if (target.kind === 'fact') {
      const fact = session.facts.find(item => item.id === target.factId);
      if (!fact) return;
      if (isFormSection(fact.requirementId)) { setFormPage(formPageOf(fact.requirementId)); setStage('form'); }
      else if (requirementsById.get(fact.requirementId)?.collection !== 'conversation') reask(fact);
      else setStage('facts');
    } else if (target.kind === 'draft') {
      setOutput('draft'); setEditingField(null); setStage('draft');
    } else {
      const index = session.messages.findIndex(item => item.id === target.messageId);
      const questionMessage = index >= 0 ? session.messages.slice(0, index + 1).reverse().find(item => item.ask) : undefined;
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
  async function sendCorrection() {
    let base = session;
    if (overviewTarget?.kind === 'conversation' && overviewTarget.topicId) {
      const topicId = overviewTarget.topicId;
      const group = metadataGroups.find(item => item.id === topicId);
      const decisions = { ...base.topicDecisions }; delete decisions[topicId];
      base = appendAssistantMessage({ ...base, topicDecisions: decisions }, sc.topic.replace('{topic}', group ? localizedLabel(language, group.ko, group.en) : topicId), { kind: 'narrative', topics: [topicId] });
    } else if (overviewFact && !isFormSection(overviewFact.requirementId)) {
      const group = metadataGroups.find(item => overviewFact.requirementId === item.id || overviewFact.requirementId.startsWith(`${item.id}.`));
      const topic = group ? localizedLabel(language, group.ko, group.en) : requirementLabel(overviewFact.requirementId);
      const decisions = { ...base.topicDecisions }; if (group) delete decisions[group.id];
      base = appendAssistantMessage({ ...base, topicDecisions: decisions }, sc.topic.replace('{topic}', topic), { kind: 'narrative', topics: [group?.id ?? overviewFact.requirementId] });
    } else if (overviewTarget?.kind === 'conversation' && overviewTarget.messageId) {
      const index = session.messages.findIndex(item => item.id === overviewTarget.messageId);
      const question = session.messages.slice(0, index + 1).reverse().find(item => item.ask);
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

  function openOperator() { setOperatorOpen(true); }
  function closeDialog() { setShowHelp(false); setSourceIds([]); }

  function processingStatus(showStop = true) {
    return busy && <ProcessingStatus task={processingTask} language={language} elapsed={elapsed}
      estimate={estimateProcessingTime(processingTask, processingSamples[timingKey(processingTask)])}
      onStop={() => void stop()} showStop={showStop} />;
  }

  return { initialWork, stage, updateStage, currentStage, languageReturnStage, setStageRaw, formPage, setFormPage, language, setLanguage, session, setSession, input, setInput, picked, setPicked, busy, setBusy, generatingExample, setGeneratingExample, elapsed, setElapsed, processingTask, setProcessingTask, processingSamples, setProcessingSamples, timingKey, recordProcessingTime, error, setError, retryTask, setRetryTask, runtime, setRuntime, model, setModel, scope, setScope, demo, setDemo, reviewed, setReviewed, meaningReady, setMeaningReady, finalReviewedText, setFinalReviewedText, savedNotice, setSavedNotice, output, setOutput, editingField, setEditingField, showHelp, setShowHelp, sourceIds, setSourceIds, importing, setImporting, controller, thread, composerInput, main, dialog, operatorOpen, setOperatorOpen, exportOpen, setExportOpen, overviewOpen, setOverviewOpen, overviewTarget, setOverviewTarget, stageNotice, setStageNotice, restoredNotice, setRestoredNotice, recoveryPending, setRecoveryPending, storageFailed, setStorageFailed, autosaveEnabled, ux, copy, ui, overviewCopy, sc, processCopy, direction, facts, started, coverage, eventsToReview, conflicts, pending, ask, askRequirement, askOther, otherText, setOtherText, inNarrative, showComposer, narrativeOpened, draftedQuestions, formFacts, derived14, steps, progress, workingCopy, latestWork, navigateToStep, resumeInterruptedWork, resetWork, guidedAt, refreshRuntime, requirementLabel, factValue, factGroups, sentenceOrigins, optionLabel, pickedText, questionText, sync, answer, reask, koreanValue, answers14, reviewTextKey, finalReviewed, visibleDraftFields, englishReady, bundlesReviewed, confirmBundle, deferTopic, endConversation, sectionsByField, updateQuestion14, setStage, selectLanguage, run, guide, clarify, send, start, startQuickTest, generateExample, stop, draft, startDemo, exportAll, overviewFact, overviewTopic, overviewFormField, editFromOverview, sendCorrection, openOperator, closeDialog, processingStatus };
}

export type DariApp = ReturnType<typeof useDariApp>;
