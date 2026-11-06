import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyFormAnswers, guideConversation, needsTopicQuestion, deriveQuestion14, formatFormAnswer, isFieldVisible, narrativeFieldFor, question14Steps, type FormValue, formSteps, isNarrative, metadataGroups, openTopic, answerScripted, appendAssistantMessage, isFormSection, appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, exportSession, finishNarrative, generateDraft, getActiveFacts, getProgress, IntakeError, narrativeOpening, nextStep, pendingAsk, reaskQuestion, requirementsById, tableRowIds, type IntakeFact, type IntakeSession, type ScriptedAnswer, type ScriptedAsk } from './intake';
import { cancelIntakeGeneration, generateIntakeModel, getIntakeRuntimeStatus, getPreviewModel, importIntakeModel, INTAKE_API_URL, previewModels, setPreviewModel, type IntakeRuntimeStatus } from './lib/intakeModel';
import { intakeCopies, intakeLanguages, intakeProcessCopy, scriptedCopy } from './intakeCopy';
import { localize, localizedLabel, localizedRequirementLabel } from './form/localize';
import { koreanChoiceText, OTHER_OPTION, takesOtherText } from './form/otherChoice';
import { appCopyFor, localizeAppError } from './appCopy';
import { statusWords } from './statusCopy';
import { DEV_TOOLS, FieldInput, FormStage, formPageOf } from './FormStage';
import { draftSectionTitle } from './form/presentation';
import { invalidateDraft } from './intake';
import { EnglishMeaning } from './revision/EnglishMeaning';
import { SentenceReview } from './revision/SentenceReview';
import { EditorModal } from './revision/EditorModal';
import { saveDraftReview } from './revision/pipeline';
import { testOpening } from './intake/testMode';
import { exampleAnswerRequest, parseExampleAnswer } from './intake/exampleAnswer';
import { generateReviewModel } from './revision/queue';
import { clarifyStatement, eventReview } from './intake';
import { StatementDetails } from './StatementDetails';
import { TopicProgress, ReviewSummaries, FinalCheck } from './JourneyPanels';
import { deferCurrentTopics, reviewBundles } from './intake/journey';
import {HwpDownloadButton} from './export/HwpDownloadButton';

// Benchmark tools ship only in development builds or builds made with VITE_DARI_BENCH=1.
const BenchPanel = import.meta.env.DEV || import.meta.env.VITE_DARI_BENCH === '1' ? lazy(() => import('./bench/BenchPanel')) : null;
const ApplicationExport = lazy(() => import('./export/ApplicationExport'));

import { clearWorkingCopy, readWorkingCopy, writeWorkingCopy, type WorkingCopy, type Stage, type Output } from './workingCopy';
import { sessionUxCopy } from './sessionUxCopy';
import { ProcessingStatus } from './ProcessingStatus';
import { estimateProcessingTime, type ProcessingTask } from './processingTime';
const demoAnswer = '이것은 기능 테스트를 위한 가상 이야기입니다. 저는 정치적 의견 때문에 보호를 신청하려고 합니다. 2025년 봄쯤 제 나라의 작은 도시에서 평화적인 집회에 참여한 뒤 경찰 제복을 입은 두 사람이 집에 찾아왔습니다. 정확한 날짜는 기억나지 않습니다. 그들은 저에게 집회에 다시 나가지 말라고 말했고 저는 무서웠습니다. 저는 구금되거나 다치지는 않았습니다. 이 일이 정치적 의견 때문이라고 생각하지만 그들의 실제 소속은 확인하지 못했습니다. 그 뒤 다른 도시의 친구 집으로 옮겼습니다. 가족이 직접 피해를 입은 일은 없습니다. 돌아가면 다시 위협받을까 두렵습니다. 무기를 보지는 못했습니다.';


function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [initialWork] = useState(() => readWorkingCopy());
  const [stage, updateStage] = useState<Stage>(initialWork.work?.stage ?? 'language');
  const currentStage = useRef(stage);
  const languageReturnStage = useRef<Stage>('basics');
  function setStageRaw(next: Stage) { currentStage.current = next; updateStage(next); }
  const [formPage, setFormPage] = useState(Math.min(initialWork.work?.formPage ?? 0, formSteps.length - 1));
  const [language, setLanguage] = useState(initialWork.work?.language ?? 'ko');
  const [session, setSession] = useState<IntakeSession>(() => initialWork.work?.session ?? createSession('ko', 'full'));
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
  const [output, setOutput] = useState<Output>(initialWork.work?.output ?? 'draft');
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
  const [stageNotice, setStageNotice] = useState('');
  const [restoredNotice, setRestoredNotice] = useState(!!initialWork.work);
  const [recoveryPending, setRecoveryPending] = useState(!!initialWork.work?.pendingTask);
  const [storageFailed, setStorageFailed] = useState(initialWork.problem === 'unavailable');
  const autosaveEnabled = useRef(initialWork.problem !== 'invalid');
  const ux = sessionUxCopy[language] ?? sessionUxCopy.en;
  const copy = { ...(intakeCopies[language] ?? intakeCopies.en), memory: ux.memory };
  const ui = appCopyFor(language);
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
  function optionLabel(option: { ko: string; en: string }) { return language === 'en' ? option.en : localize(language, option.ko); }
  /** The applicant's message for a confirmed choice; “기타” text stays verbatim. */
  function pickedText(options: { value: string; ko: string; en: string }[]) {
    const detail = askOther && picked.includes(OTHER_OPTION) ? otherText.trim() : '';
    return options.filter(option => picked.includes(option.value)).map(option => option.value === OTHER_OPTION && detail ? `${optionLabel(option)}: ${detail}` : optionLabel(option)).join(', ');
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
  function openOperator() { setOperatorOpen(true); }
  function closeDialog() { setShowHelp(false); setSourceIds([]); }

  function processingStatus(showStop = true) {
    return busy && <ProcessingStatus task={processingTask} language={language} elapsed={elapsed}
      estimate={estimateProcessingTime(processingTask, processingSamples[timingKey(processingTask)])}
      onStop={() => void stop()} showStop={showStop} />;
  }

  if (stage === 'language') return <div className="language-entry"><div className="language-entry-content">
    <h1 className="entry-logo" lang="en" dir="ltr">DARI</h1>{processingStatus()}{busy && <button className="quiet" onClick={() => setStageRaw(languageReturnStage.current)}>{copy.back}</button>}
    {DEV_TOOLS && !started && !Object.keys(session.form).length && <button className="secondary" disabled={!!busy || recoveryPending} onClick={startQuickTest}>{ui.quickEnglishTest}</button>}
    <nav className="language-scroll" aria-label={ui.languagePicker}>{intakeLanguages.map(item => <button className="language-option" lang={item.code} dir="auto" key={item.code} disabled={!!busy || recoveryPending} onClick={() => selectLanguage(item.code)}>{item.name}</button>)}</nav>
  </div></div>;

  return <div className={stage === 'conversation' || stage === 'form' ? 'app-shell chat-mode' : stage === 'basics' ? 'app-shell start-mode' : 'app-shell page-mode'}>
    <a className="skip-link" href="#main">{copy.continue}</a>
    <header className="site-header"><button className="brand" onClick={() => setStage('basics')}><strong lang="en" dir="ltr">DARI</strong><span>{copy.tagline}</span></button><div className="header-actions"><button className="quiet" onClick={() => { languageReturnStage.current = currentStage.current; setStage('language'); }}>{intakeLanguages.find(item => item.code === language)?.name}</button><button className="quiet" onClick={() => setShowHelp(true)}><span className="help-mark">?</span>{copy.help}</button><div className="operator-entry"><button className="operator-toggle" aria-expanded={operatorOpen} aria-controls="operator" aria-label={ui.operator} title={ui.operator} onClick={() => setOperatorOpen(open => !open)}>⚙</button>
    {operatorOpen && <section id="operator" className="operator-popover" lang={language} dir={direction} aria-label={ui.operator}><div className="operator-head"><b>{ui.operator}</b><button className="quiet" onClick={() => setOperatorOpen(false)}>{copy.close}</button></div><div className="operator-grid">
          <p className="status-line">{runtime?.mode === 'on-device' ? ui.onDevice : ui.localPreview}<br /><bdi dir="ltr">{runtime?.modelName ?? ui.checking}{runtime?.backend && ` · ${runtime.backend.toUpperCase()}`}</bdi> · {runtime?.modelReady ? (runtime.mode === 'on-device' ? ui.fileReady : ui.modelReady) : ui.modelNeeded}</p>
          {runtime?.mode !== 'on-device' && <><code dir="ltr">{INTAKE_API_URL}</code><label>{ui.previewModel}<select dir="ltr" value={model} disabled={(!!busy || recoveryPending)} onChange={event => { setModel(event.target.value); setPreviewModel(event.target.value); void refreshRuntime(); }}>{previewModels.map(item => <option key={item}>{item}</option>)}</select></label><small>{ui.previewNote}</small></>}
          {runtime?.reason && <p className="status-line">{localizeAppError(language, runtime.reason)}</p>}
          <div className="actions" style={{ marginTop: 0 }}><button className="secondary" disabled={(!!busy || recoveryPending) || importing} onClick={() => void refreshRuntime()}>{ui.refreshStatus}</button>{runtime?.mode === 'on-device' && <button className="secondary" disabled={(!!busy || recoveryPending) || importing} onClick={async () => { setImporting(true); try { setRuntime(await importIntakeModel()); } catch (failure) { setError(String(failure)); } finally { setImporting(false); } }}>{importing ? ui.importBusy : ui.importModel}</button>}</div>
          <label>{ui.scopeLabel}<select value={scope} disabled={(!!busy || recoveryPending) || session.messages.some(item => item.role === 'user')} onChange={event => { const value = event.target.value as 'priority' | 'full' | 'test'; setScope(value); setSession(stage === 'conversation' ? sync(createSession(language, value)) : createSession(language, value)); }}><option value="test">{ui.scopeTest}</option><option value="full">{ui.scopeFull}</option><option value="priority">{ui.scopePriority}</option></select></label>
          {DEV_TOOLS && <><button className="secondary" disabled={(!!busy || recoveryPending) || session.messages.some(item => item.role === 'user')} onClick={() => void startDemo()}>{ui.koreanDemo}</button><small>{ui.koreanDemoNote}</small></>}
          {session.messages.some(item => item.role === 'user') && <button className="secondary" onClick={exportAll} disabled={(!!busy || recoveryPending)}>{ui.exportCurrent}</button>}
          {BenchPanel && <Suspense fallback={null}><BenchPanel runtime={runtime} disabled={(!!busy || recoveryPending) || importing} language={language} /></Suspense>}
        </div></section>}</div></div></header>
    <div className="workspace">
      <aside className="sidebar"><p className="overline">DARI / 01</p><h2>{copy.sidebar}</h2><ol className="steps">{steps.map((item, index) => <li key={item.id} className={stage === item.id ? 'current-step' : undefined}><button className={stage === item.id ? 'active' : ''} aria-current={stage === item.id ? 'step' : undefined} aria-disabled={item.id === 'draft' && !session.draftRevision} onClick={() => navigateToStep(item.id)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span></button></li>)}</ol>{stageNotice && <div className="step-notice" role="status"><span>{stageNotice}</span><button className="quiet" onClick={() => setStageNotice('')}>{copy.close}</button></div>}<div className="sidebar-note"><p>{copy.pace}</p><small>{copy.memory}</small></div><div className="sidebar-footer">DARI</div></aside>
      {processingStatus(stage !== 'conversation' || !showComposer)}
      <main id="main" ref={main} tabIndex={-1}>
        {(restoredNotice || recoveryPending || storageFailed || initialWork.problem === 'invalid') && <div className="session-status" role="status">
          <span>{storageFailed ? ux.storageFailed : initialWork.problem === 'invalid' ? ux.invalid : recoveryPending ? ux.interrupted : ux.restored}</span>
          {recoveryPending && <button className="quiet" onClick={resumeInterruptedWork}>{ux.resume}</button>}
          {initialWork.problem === 'invalid' ? <button className="quiet" onClick={resetWork}>{ux.newSession}</button> : !recoveryPending && !storageFailed && <button className="quiet" onClick={() => setRestoredNotice(false)}>{copy.close}</button>}
        </div>}
        <h1>{stage === 'form' ? sc.formTitle : stage === 'basics' ? copy.startTitle : stage === 'conversation' ? copy.chatTitle : stage === 'facts' ? copy.factsTitle : copy.draftTitle}</h1>
        <p className="intro">{stage === 'form' ? sc.formIntro : stage === 'basics' ? copy.startIntro : stage === 'conversation' ? copy.chatIntro : stage === 'facts' ? copy.factsIntro : copy.draftIntro}</p>
        {stage === 'basics' && DEV_TOOLS && language === 'en' && !started && !Object.keys(session.form).length && <button className="secondary" disabled={!!busy || recoveryPending} onClick={startQuickTest}>{ui.shortConversation}</button>}
        {error && <div className="notice error" role="alert"><p>{localizeAppError(language, error)}</p>{retryTask && <div className="actions"><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => void run(session, retryTask)}>{copy.retry}</button></div>}</div>}
        {runtime && (!runtime.available || !runtime.modelReady) && (narrativeOpened || stage === 'facts') && <div className="notice"><p>{copy.unavailable}</p><button className="quiet" onClick={openOperator}>{ui.operator}</button></div>}
        {stage === 'basics' && <div className="content-grid"><section className="start-panel">{started && <p className="micro">{copy.factsIntro}</p>}<div className="actions" style={started ? undefined : { marginTop: 0 }}><button className="primary full" onClick={start}>{started ? copy.continue : copy.start}<span aria-hidden="true">{direction === 'rtl' ? '←' : '→'}</span></button></div></section><aside className="support-card"><h2>{copy.pace}</h2><p>{copy.chatIntro}</p><p className="micro">{copy.memory}</p></aside></div>}
        {stage === 'form' && <fieldset className="form-stage-guard" disabled={!!busy || recoveryPending}><FormStage language={language} answers={session.form} page={formPage} copy={sc} back={copy.back} next={copy.continue}
          onChange={form => { setReviewed(false); setSession(current => ({ ...invalidateDraft(current), form })); }} onPage={setFormPage} onDone={() => setStage('conversation')} /></fieldset>}
        {stage === 'conversation' && <div className="content-grid"><div><section className="panel chat-panel"><div className="chat-toolbar"><details className="chat-options"><summary>{ui.more}</summary><div className="chat-options-sheet" onClick={event => { if ((event.target as HTMLElement).closest('button')) { const details = event.currentTarget.closest('details'); if (details) details.open = false; } }}><TopicProgress session={session} language={language} />{session.scope === 'test' && <div className="actions test-actions"><button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim() || session.messages.at(-1)?.role !== 'assistant' || session.messages.at(-1)?.ask?.kind === 'done'} onClick={() => void generateExample()}>{generatingExample ? ui.exampleGenerating : ui.exampleGenerate}</button><button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={endConversation}>{ui.finish}</button></div>}<button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setStage('facts')}>{copy.review}</button>{inNarrative && <div className="conversation-controls">
                  {session.narrativeDone ? <><button className="quiet" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => deferTopic('unknown')}>{sc.unknown}</button><button className="quiet" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => deferTopic('skipped')}>{sc.skip}</button></> : <button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setSession(current => sync(finishNarrative(current)))}>{ui.finishStory}</button>}
                  {session.narrativeDone && <button className="secondary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={endConversation}>{ui.finishQuestions}</button>}
                </div>}</div></details></div><div className="chat-thread" ref={thread} role="log" aria-label={copy.conversation} aria-live="polite">{session.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small className="sr-only">{message.role === 'assistant' ? 'DARI' : copy.input}</small><p dir="auto">{message.content}</p></article>)}</div>{ask && (ask.kind !== 'field' || askRequirement?.options) && <div className="answer-choices">
                  {ask.kind === 'table' && <><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.have, status: 'answered' })}>{sc.have}</button><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.none, status: 'not_applicable' })}>{sc.none}</button></>}
                  {ask.kind === 'more' && <><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.yes, status: 'answered', value: 'yes' })}>{sc.yes}</button><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.no, status: 'answered', value: 'no' })}>{sc.no}</button></>}
                  {ask.kind === 'field' && askRequirement?.type === 'single' && <>{askRequirement.options?.map(option => askOther && option.value === OTHER_OPTION
                    ? <button key={option.value} className="chip" aria-pressed={picked.includes(option.value)} disabled={(!!busy || recoveryPending)} onClick={() => setPicked(current => current.includes(option.value) ? [] : [option.value])}>{optionLabel(option)}</button>
                    : <button key={option.value} className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: optionLabel(option), status: 'answered', value: option.value })}>{optionLabel(option)}</button>)}
                    {picked.includes(OTHER_OPTION) && <button className="primary" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: pickedText(askRequirement.options!), status: 'answered', value: OTHER_OPTION, other: otherText })}>{sc.choose}</button>}</>}
                  {ask.kind === 'field' && askRequirement?.type === 'multi' && <>{askRequirement.options?.map(option => <button key={option.value} className="chip" aria-pressed={picked.includes(option.value)} disabled={(!!busy || recoveryPending)} onClick={() => setPicked(current => current.includes(option.value) ? current.filter(item => item !== option.value) : [...current, option.value])}>{optionLabel(option)}</button>)}<button className="primary" disabled={!picked.length || (!!busy || recoveryPending)} onClick={() => answer({ text: pickedText(askRequirement.options!), status: 'answered', value: picked, other: otherText })}>{sc.choose}</button>{!picked.length && <small className="choice-hint">{sc.choiceHint}</small>}</>}
                  {ask.kind === 'field' && askOther && picked.includes(OTHER_OPTION) && <label className="other-input">{sc.otherLabel}<input dir="auto" value={otherText} maxLength={500} placeholder={sc.otherPlaceholder} disabled={(!!busy || recoveryPending)} onChange={event => setOtherText(event.target.value)} /></label>}
                  {ask.kind === 'field' && picked.length > 0 && <button className="quiet clear-choice" disabled={(!!busy || recoveryPending)} onClick={() => { setPicked([]); setOtherText(''); }}>{sc.clearChoice}</button>}
                </div>}
                {ask && ask.kind !== 'more' && <div className="answer-choices quiet-choices"><button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.unknown, status: 'unknown' })}>{sc.unknown}</button><button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => answer({ text: sc.skip, status: 'skipped' })}>{sc.skip}</button></div>}
                {nextStep(session).kind === 'done' && <div className="actions"><button className="primary" disabled={(!!busy || recoveryPending) || !!input.trim()} onClick={() => setStage('facts')}>{ui.continueReview}</button></div>}
                {showComposer && <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label><span className="composer-label">{copy.input}</span><textarea dir="auto" ref={composerInput} value={input} maxLength={12000} rows={1} placeholder={copy.placeholder} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia('(pointer: coarse)').matches) { event.preventDefault(); void send(); } }} disabled={(!!busy || recoveryPending)} /></label><div className="composer-actions"><small>{copy.pace}</small>{busy ? <button className="primary send-icon composer-stop" type="button" onClick={() => void stop()} aria-label={copy.stop} title={copy.stop}><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" /></svg></button> : <button className="primary send-icon" disabled={!input.trim() || recoveryPending} type="submit" aria-label={copy.send} title={copy.send}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}</div></form>}
                </section></div><aside className="support-card"><h2>{ui.nextStep}</h2><p>{ui.flow}</p><p>{copy.pace}</p></aside></div>}
        {stage === 'facts' && <>
          {conflicts.size > 0 && <div className="notice" role="status">{statusWords[language].conflict} · {conflicts.size}<p>{copy.factsIntro}</p></div>}
          {!facts.length && <p className="empty-state">{copy.noFacts}</p>}
          <ReviewSummaries session={session} language={language} busy={(!!busy || recoveryPending)} value={factValue} label={requirementLabel} onConfirm={confirmBundle} onCorrect={fact => isFormSection(fact.requirementId) ? (setFormPage(formPageOf(fact.requirementId)), setStage('form')) : requirementsById.get(fact.requirementId)?.collection === 'conversation' ? void clarify(fact) : reask(fact)} />
          <details className="details"><summary>{ui.detailSources}</summary>
          <div className="fact-groups">{factGroups().map(group => <details className="fact-group" key={group.key} open={group.story}>
            <summary><span>{group.label}</span><span className="fact-count-chip">{group.facts.length}</span>{group.facts.some(fact => conflicts.has(fact.requirementId)) && <span className="small-tag">{statusWords[language].conflict}</span>}</summary>
            {group.events.map(({ eventId, facts: items }, index) => <div className="fact-event" key={eventId || 'general'}>
              {eventId && group.events.filter(item => item.eventId).length > 0 && <p className="event-label">{sc.row.replace('{n}', String(group.events.filter(item => item.eventId).findIndex(item => item.eventId === eventId) + 1))}</p>}
              {eventsToReview.filter(event => event.eventId === eventId && event.groupId === group.key && event.missingRequirementIds.length > 0).map(event => <details className="fact-more" key={`${event.groupId}/${eventId}`}><summary>{ui.eventMissing} · {event.missingRequirementIds.length}</summary><ul>{event.missingRequirementIds.map(id => <li key={id}>{requirementLabel(id)}</li>)}</ul></details>)}
              {items.map(fact => { const status = conflicts.has(fact.requirementId) ? 'conflict' : fact.status; return <article className="fact-row" key={fact.id}>
                <div className="fact-row-main"><small>{requirementLabel(fact.requirementId)}</small><p dir="auto">{factValue(fact.requirementId, fact.value, fact.otherText)}</p></div>
                {status !== 'answered' && <span className={`small-tag status-${status}`}>{statusWords[language]?.[status] ?? status}</span>}
                {isNarrative(requirementsById.get(fact.requirementId)!) && !requirementsById.get(fact.requirementId)?.gate && <StatementDetails fact={fact} language={language} disabled={(!!busy || recoveryPending)} onClarify={() => void clarify(fact)} />}
                <details className="fact-more"><summary>{copy.source}</summary>
                  {fact.sourceQuotes.map((quote, quoteIndex) => <blockquote key={quoteIndex} dir="auto">{quote.quote}</blockquote>)}
                  <div className="fact-qualifiers"><small>{processCopy.certainty}: {processCopy[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{processCopy.knowledge}: {processCopy[fact.knowledge]}</small>}</div>
                  {isFormSection(fact.requirementId) ? <button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => { setFormPage(formPageOf(fact.requirementId)); setStage('form'); }}>{sc.editInForm}</button> : requirementsById.get(fact.requirementId)?.collection !== 'conversation' && <button className="quiet" disabled={(!!busy || recoveryPending)} onClick={() => reask(fact)}>{sc.reask}</button>}
                </details>
              </article>; })}
            </div>)}
          </details>)}</div>
          </details>
          <details className="details"><summary>{copy.missing} · {pending.length}</summary><div className="details-content"><ul className="pending-list">{pending.map(item => <li key={item.requirementId}>{requirementLabel(item.requirementId)} — {statusWords[language]?.[item.status]}</li>)}</ul></div></details>
          {narrativeOpened && <form className="panel" style={{ marginTop: 22 }} onSubmit={event => { event.preventDefault(); void send(input, session, true); }}><label>{copy.correction}<textarea dir="auto" value={input} rows={3} maxLength={12000} placeholder={copy.correctionPlaceholder} onChange={event => setInput(event.target.value)} disabled={(!!busy || recoveryPending)} /></label><div className="actions"><button className="secondary" disabled={!input.trim() || (!!busy || recoveryPending)}>{copy.send}</button></div></form>}
          <div className="review-bar">{facts.length > 0 && <label className="check-row"><input type="checkbox" checked={bundlesReviewed} onChange={event => { setReviewed(event.target.checked); setSession(current => ({ ...current, facts: current.facts.map(f => ({ ...f, confirmed: event.target.checked })) })); }} disabled={(!!busy || recoveryPending)} />{ui.reviewedAll}</label>}
          <div className="actions"><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => setStage('conversation')}>{copy.back}</button><button className="primary" disabled={!bundlesReviewed || (!!busy || recoveryPending) || !facts.some(item => item.status === 'answered')} onClick={() => void draft()}>{busy === 'draft' ? copy.drafting : copy.draftAction}</button>{busy && <button className="secondary" onClick={() => void stop()}>{copy.stop}</button>}</div></div>
        </>}
        {stage === 'draft' && <>
          <div className="notice">{copy.draftNote}</div>
          <div className="output-tabs" aria-label={copy.draft}>{(['draft', 'source', 'metadata'] as Output[]).map(item => <button key={item} aria-pressed={output === item} onClick={() => setOutput(item)}>{item === 'draft' ? copy.draft : item === 'source' ? copy.original : copy.metadata}</button>)}</div>
          {output === 'draft' && <section className="panel q14-draft" lang={language} dir={direction}>
            <div className="section-title"><h2>{ui.q14Title}</h2><span className="small-tag">{ui.editableDraft}</span></div>
            <p className="micro">{ui.draftIntro}</p>
            {language === 'en' && <p className="micro">{ui.backtranslationNote}</p>}
            {question14Steps.map(step => { const visible = step.fields.filter(field => isFieldVisible(field, answers14) && (session.scope !== 'test' || /^14\.[123](?:-|$)/.test(field.id))); return visible.length > 0 && <div className="q14-step" key={step.id}>
              <h3>{draftSectionTitle(step, language)}</h3>
              {visible.map(field => { const section = sectionsByField.get(field.id); const derived = derived14.find(item => item.id === field.id); return <div className="q14-field" key={field.id}>
                <h4 className="q14-id">{localizedLabel(language, field.ko, field.en)}</h4>
                {derived?.needsReview && <p className="draft-missing">{ui.needsReview}{derived.value}</p>}
                {!!section?.missingFactIds?.length && <p className="draft-missing">{ui.draftMissing}{section.missingFactIds.map(id => { const fact = session.facts.find(item => item.id === id); return fact ? `${requirementLabel(fact.requirementId)} — ${factValue(fact.requirementId, fact.value)}` : id; }).join(' · ')}{ui.addMissing}</p>}
                {!!section?.staleValues?.length && <p className="draft-missing">{ui.stalePrefix}{section.staleValues.join(' · ')}{ui.correctStale}</p>}
                {language === 'en' && answers14[field.id]?.kind === 'text' && <EnglishMeaning uiLanguage={language} text={(answers14[field.id] as { text: string }).text} onReady={text => setMeaningReady(current => current[field.id] === text ? current : { ...current, [field.id]: text })} />}
                <fieldset className="stage-readonly" disabled={!!busy || recoveryPending}><FieldInput field={field} language={language} valueLanguage="ko" value={answers14[field.id]} copy={sc} showLabel={false} showStatus={!answers14[field.id] || answers14[field.id].kind === 'status'} onChange={value => updateQuestion14(field.id, value)} /></fieldset>
                {answers14[field.id]?.kind === 'text' && (answers14[field.id] as { text: string }).text.trim() && <>
                  <div className="draft-field-actions">
                    <button className="secondary" disabled={!!busy || recoveryPending} onClick={() => setEditingField(field.id)}>{ui.refine}</button>
                    <button className="secondary" disabled={!section?.sourceIds.some(id => session.messages.some(message => message.id === id && message.role === 'user'))} onClick={() => setSourceIds(section?.sourceIds ?? [])}>{ui.sources}</button>
                  </div>
                  {editingField === field.id && <EditorModal uiLanguage={language} title={ui.sentenceEditor} closeLabel={copy.close} onClose={() => setEditingField(null)}><SentenceReview uiLanguage={language} key={`${session.id}-${session.draftRevision}-${field.id}`} text={(answers14[field.id] as { text: string }).text} saved={session.draftReviews?.[field.id]} onChange={(doc, expected) => setSession(current => {
                    const answer = current.question14?.[field.id];
                    if (!current.draftRevision || answer?.kind !== 'text' || answer.text !== expected) return current;
                    return saveDraftReview(current, field.id, expected, doc);
                  })} /></EditorModal>}
                </>}
              </div>; })}
            </div>; })}
          </section>}
          {output === 'draft' && formFacts.length > 0 && <section className="panel draft-card" lang={language} dir={direction}><div className="section-title"><h2>{ui.formValues}</h2><span className="small-tag">{ui.asEntered}</span></div><dl className="form-values">{formFacts.map(fact => <div key={fact.id}><dt><bdi dir="ltr">{fact.requirementId}</bdi> · {requirementLabel(fact.requirementId)}{fact.eventId && <bdi dir="ltr"> ({fact.eventId})</bdi>}</dt><dd dir="auto">{factValue(fact.requirementId, fact.value)}</dd></div>)}</dl></section>}
          {output === 'source' && <div className="fact-list">{session.messages.map(message => <article className="fact-card" key={message.id}><small>{message.role === 'user' ? copy.input : 'DARI'} · {message.id}</small><p dir="auto">{message.content}</p></article>)}</div>}
          {output === 'metadata' && <section className="panel"><p className="developer-label">{ui.metadataDeveloper}</p><div className="details-content" dir="ltr"><pre>{JSON.stringify(JSON.parse(exportSession(session)).metadata, null, 2)}</pre></div></section>}
          {output === 'draft' && <fieldset className="stage-readonly" disabled={!!busy || recoveryPending}><FinalCheck session={session} language={language} checked={finalReviewed} ready={englishReady} onCheck={checked => setFinalReviewedText(checked ? reviewTextKey : '')} onReturn={() => setStage('facts')} /></fieldset>}
          {savedNotice && <p role="status">{savedNotice}</p>}
          <div className="actions"><button className="secondary" onClick={() => setStage('facts')}>{copy.back}</button><button className="primary" disabled={!!busy} onClick={() => setExportOpen(true)}>{ui.exportApplication}</button><button className="secondary" onClick={exportAll}>{ui.saveRecord}</button><HwpDownloadButton session={session} reviewed={finalReviewed && englishReady} language={language} label={copy.downloadText} disabled={!!busy} onNotice={setSavedNotice} onError={setError} /></div>
          {exportOpen && <EditorModal title={ui.exportFormTitle} closeLabel={copy.close} onClose={() => setExportOpen(false)}><Suspense fallback={<p role="status">{ui.exportLoading}</p>}><ApplicationExport session={session} reviewed={finalReviewed && englishReady} language={language} /></Suspense></EditorModal>}
        </>}
      </main>
    </div>
    <footer className="site-footer"><span>{copy.tagline}</span><span>{copy.memory}</span></footer>
    <dialog ref={dialog} className="help-dialog" onCancel={closeDialog} onClose={closeDialog}><h2>{showHelp ? copy.help : copy.source}</h2>{showHelp ? <><p>{copy.helpBody}</p><p>{copy.memory}</p><button className="secondary" disabled={!!busy} onClick={resetWork}>{ux.newSession}</button></> : session.messages.filter(item => item.role === 'user' && sourceIds.includes(item.id)).map(item => <div key={item.id}><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p></div>)}<div className="actions"><button className="primary" onClick={closeDialog}>{copy.close}</button></div></dialog>
  </div>;
}
