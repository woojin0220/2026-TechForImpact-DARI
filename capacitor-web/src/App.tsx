import { useEffect, useRef, useState } from 'react';
import { applyFormAnswers, guideConversation, needsTopicQuestion, deriveQuestion14, formatFormAnswer, isFieldVisible, narrativeFieldFor, question14Steps, type FormValue, formSteps, isNarrative, metadataGroups, openTopic, answerScripted, appendAssistantMessage, isFormSection, appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, exportSession, finishNarrative, generateDraft, getActiveFacts, getProgress, IntakeError, narrativeOpening, nextStep, pendingAsk, reaskQuestion, requirementsById, tableRowIds, type IntakeFact, type IntakeSession, type ScriptedAnswer, type ScriptedAsk } from './intake';
import { cancelIntakeGeneration, generateIntakeModel, getIntakeRuntimeStatus, getPreviewModel, importIntakeModel, INTAKE_API_URL, previewModels, setPreviewModel, type IntakeRuntimeStatus } from './lib/intakeModel';
import { intakeCopies, intakeFieldLabels, intakeLanguages, intakeProcessCopy, scriptedCopy } from './intakeCopy';
import { hasQuestionPhrase, localize } from './form/localize';
import { FieldInput, FormStage, formPageOf } from './FormStage';
import { invalidateDraft } from './intake';
import { EnglishMeaning } from './revision/EnglishMeaning';
import { SentenceReview } from './revision/SentenceReview';
import { EditorModal } from './revision/EditorModal';
import { saveDraftReview } from './revision/pipeline';
import { testOpening } from './intake/testMode';
import { exampleAnswerRequest, parseExampleAnswer } from './intake/exampleAnswer';
import { generateReviewModel } from './revision/queue';

type Stage = 'language' | 'basics' | 'form' | 'conversation' | 'facts' | 'draft';
type Output = 'draft' | 'source' | 'metadata';
const demoAnswer = '이것은 기능 테스트를 위한 가상 이야기입니다. 저는 정치적 의견 때문에 보호를 신청하려고 합니다. 2025년 봄쯤 제 나라의 작은 도시에서 평화적인 집회에 참여한 뒤 경찰 제복을 입은 두 사람이 집에 찾아왔습니다. 정확한 날짜는 기억나지 않습니다. 그들은 저에게 집회에 다시 나가지 말라고 말했고 저는 무서웠습니다. 저는 구금되거나 다치지는 않았습니다. 이 일이 정치적 의견 때문이라고 생각하지만 그들의 실제 소속은 확인하지 못했습니다. 그 뒤 다른 도시의 친구 집으로 옮겼습니다. 가족이 직접 피해를 입은 일은 없습니다. 돌아가면 다시 위협받을까 두렵습니다. 무기를 보지는 못했습니다.';
const statusWords: Record<string, Record<string, string>> = {
  ko: { answered: '답변 있음', unknown: '기억·정보 불확실', skipped: '답변 보류', not_applicable: '해당 없음', conflict: '다시 확인 필요', missing: '아직 묻지 않음', blocked: '이전 답변에 따라 확인' },
  en: { answered: 'Answered', unknown: 'Unknown', skipped: 'Deferred', not_applicable: 'Not applicable', conflict: 'Needs clarification', missing: 'Not asked yet', blocked: 'Depends on another answer' },
  ru: { answered: 'Есть ответ', unknown: 'Неизвестно', skipped: 'Отложено', not_applicable: 'Не применимо', conflict: 'Нужно уточнить', missing: 'Ещё не спрашивали', blocked: 'Зависит от другого ответа' },
  fr: { answered: 'Répondu', unknown: 'Inconnu', skipped: 'Reporté', not_applicable: 'Sans objet', conflict: 'À clarifier', missing: 'Pas encore demandé', blocked: 'Selon une autre réponse' },
  ar: { answered: 'تمت الإجابة', unknown: 'غير معروف', skipped: 'مؤجل', not_applicable: 'لا ينطبق', conflict: 'يحتاج توضيحًا', missing: 'لم يُسأل بعد', blocked: 'يعتمد على إجابة أخرى' },
  fa: { answered: 'پاسخ داده‌شده', unknown: 'نامعلوم', skipped: 'به تعویق افتاده', not_applicable: 'نامربوط', conflict: 'نیاز به روشن‌سازی', missing: 'هنوز پرسیده نشده', blocked: 'وابسته به پاسخ دیگر' },
};

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [stage, setStageRaw] = useState<Stage>('language');
  const [formPage, setFormPage] = useState(0);
  const [language, setLanguage] = useState('ko');
  const [session, setSession] = useState<IntakeSession>(() => createSession('ko', 'full'));
  const [input, setInput] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<'intake' | 'draft' | null>(null);
  const [generatingExample, setGeneratingExample] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [retryTask, setRetryTask] = useState<'intake' | 'draft' | null>(null);
  const [runtime, setRuntime] = useState<IntakeRuntimeStatus | null>(null);
  const [model, setModel] = useState(getPreviewModel());
  const [scope, setScope] = useState<'priority' | 'full' | 'test'>('full');
  const [demo, setDemo] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [output, setOutput] = useState<Output>('draft');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const copy = intakeCopies[language] ?? intakeCopies.en;
  const sc = scriptedCopy[language] ?? scriptedCopy.en;
  const processCopy = intakeProcessCopy[language] ?? intakeProcessCopy.en;
  const direction = ['ar', 'fa'].includes(language) ? 'rtl' : 'ltr';
  const facts = getActiveFacts(session);
  const started = session.messages.some(item => item.role === 'user');
  const progress = getProgress(session);
  const coverage = calculateCoverage(session);
  const conflicts = new Set(coverage.filter(item => item.status === 'conflict').map(item => item.requirementId));
  const pending = coverage.filter(item => item.status !== 'answered' && item.status !== 'not_applicable');
  const ask = pendingAsk(session);
  const askRequirement = ask && requirementsById.get(ask.requirementId);
  const inNarrative = !ask && nextStep(session).kind === 'narrative';
  const narrativeOpened = session.messages.some(item => item.ask?.kind === 'narrative');
  const draftedQuestions = new Set(session.draft.map(item => item.questionId));
  // Question 14 boxes are derived from metadata; other undrafted facts are shown as entered.
  const formFacts = facts.filter(fact => fact.status !== 'conflict' && !draftedQuestions.has(requirementsById.get(fact.requirementId)?.questionId ?? '') && !requirementsById.get(fact.requirementId)?.questionId.startsWith('14'));
  const derived14 = deriveQuestion14(session);
  const steps: { id: Stage; label: string }[] = [{ id: 'basics', label: copy.basics }, ...(session.scope === 'test' ? [] : [{ id: 'form' as Stage, label: sc.formStep }]), { id: 'conversation', label: copy.conversation }, { id: 'facts', label: copy.facts }, { id: 'draft', label: copy.draft }];
  const stepIndex = Math.max(0, steps.findIndex(item => item.id === stage));

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = direction; }, [language, direction]);
  useEffect(() => { if (session.scope === 'test' && language !== 'en') setLanguage('en'); }, [session.scope, language]);
  useEffect(() => { void refreshRuntime(); }, []);
  // Guided question 14 conversation: when the next topic needs a question, ask the model once.
  const guidedAt = useRef(-1);
  useEffect(() => {
    if (stage !== 'conversation' || busy || error || !session.narrativeDone || pendingAsk(session)) return;
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
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [session.messages.length, busy]);
  useEffect(() => { if (stage !== 'language') main.current?.focus(); }, [stage]);
  useEffect(() => {
    if (showHelp || sourceIds.length) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showHelp, sourceIds]);

  async function refreshRuntime() { setRuntime(await getIntakeRuntimeStatus()); }
  function requirementLabel(id: string) {
    const requirement = requirementsById.get(id);
    if (!requirement) return id;
    if (language === 'ko') return requirement.label;
    if (language === 'en') return requirement.labelEn;
    const subfield = id.slice(id.lastIndexOf('.') + 1);
    if (requirement.parentId && intakeFieldLabels[language]?.[subfield]) return intakeFieldLabels[language][subfield];
    if (requirement.label.includes(' / ')) {
      const labels = requirement.label.split(' / ');
      if (labels.every(hasQuestionPhrase)) return labels.map(label => localize(language, label)).join(' / ');
    }
    return hasQuestionPhrase(requirement.label) ? localize(language, requirement.label) : requirement.labelEn;
  }
  function factValue(id: string, value: string | string[]) {
    const options = requirementsById.get(id)?.options ?? [];
    return (Array.isArray(value) ? value : [value]).map(item => {
      const option = options.find(choice => choice.value === item);
      if (!option) return item;
      return language === 'en' ? option.en : localize(language, option.ko);
    }).join(' · ');
  }
  /** Review list: question 14 groups first (from the conversation), then form sections; incidents kept apart. */
  function factGroups() {
    const groups = new Map<string, { label: string; order: number; story: boolean; facts: IntakeFact[] }>();
    for (const fact of facts) {
      const requirement = requirementsById.get(fact.requirementId);
      let key = 'other', label = requirement?.label ?? fact.requirementId, order = 999, story = false;
      const group = requirement && isNarrative(requirement) ? metadataGroups.find(item => fact.requirementId === item.id || fact.requirementId.startsWith(`${item.id}.`)) : undefined;
      if (group) { key = group.id; label = language === 'ko' ? group.ko : group.en; order = metadataGroups.indexOf(group); story = true; }
      else if (isFormSection(fact.requirementId)) {
        const page = formPageOf(fact.requirementId); const step = formSteps[page];
        key = `form-${page}`; label = language === 'ko' ? step.titleKo : step.titleEn; order = 100 + page;
      }
      if (!groups.has(key)) groups.set(key, { label, order, story, facts: [] });
      groups.get(key)!.facts.push(fact);
    }
    return [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([key, group]) => ({ key, ...group,
      events: [...new Set(group.facts.map(fact => fact.eventId ?? ''))].map(eventId => ({ eventId, facts: group.facts.filter(fact => (fact.eventId ?? '') === eventId) })) }));
  }
  function optionLabel(option: { ko: string; en: string }) { return language === 'en' ? option.en : localize(language, option.ko); }
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
      setInput(''); setPicked([]); setReviewed(false); setError(''); setStage('conversation');
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
    const value = (Array.isArray(fact.value) ? fact.value : [fact.value]).map(item => options.find(choice => choice.value === item)?.ko ?? item).join(', ');
    return fact.status === 'answered' ? value : `${statusWords.ko[fact.status]} (${value})`;
  }
  const answers14 = session.question14 ?? {};
  const sectionsByField = new Map(session.draft.map(section => [narrativeFieldFor(section.questionId, answers14), section]));
  function updateQuestion14(id: string, value: FormValue | undefined) {
    setSession(current => { const next = { ...(current.question14 ?? {}) }; if (value) next[id] = value; else delete next[id]; const reviews = { ...current.draftReviews }; delete reviews[id]; return { ...current, question14: next, draftReviews: reviews }; });
  }
  function question14Text() {
    return (session.scope === 'test' ? 'Conversation test only — not for submission.\n\n' : '') + question14Steps.flatMap(step => step.fields.filter(field => isFieldVisible(field, answers14) && answers14[field.id])
      .map(field => `${field.id} ${field.ko}\n${formatFormAnswer(field, answers14[field.id])}`)).join('\n\n');
  }
  function formValuesText() {
    return formFacts.map(fact => `${fact.requirementId}${fact.eventId ? ` [${fact.eventId}]` : ''} ${requirementsById.get(fact.requirementId)?.label}: ${koreanValue(fact)}`).join('\n');
  }
  /** Leaving the form saves it into metadata; entering the chat shows the next prompt. */
  function setStage(next: Stage) {
    setSession(current => {
      let updated = stage === 'form' && next !== 'form' ? applyFormAnswers(current, current.form) : current;
      // Keep a re-asked question or a failed answer awaiting retry as the last message.
      if (next === 'conversation' && !pendingAsk(updated) && updated.messages.at(-1)?.role !== 'user') updated = sync(updated);
      return updated;
    });
    setStageRaw(next);
  }
  function selectLanguage(code: string) {
    setLanguage(code);
    if (!session.messages.some(item => item.role === 'user')) setSession(createSession(code, scope));
    else setSession(current => ({ ...current, language: current.scope === 'test' ? 'en' : code }));
    setStage('basics');
  }
  async function run(next: IntakeSession, task: 'intake' | 'draft') {
    if (busy) return;
    setSession(next); setBusy(task); setError(''); setRetryTask(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = task === 'intake'
        ? await continueConversation(next, generateIntakeModel, abort.signal)
        : await generateDraft(next, generateIntakeModel, abort.signal);
      if (abort.signal.aborted) return;
      setSession(task === 'intake' ? sync(result) : result);
      if (task === 'intake' && result.scope === 'test' && nextStep(result).kind === 'done') setStageRaw('facts');
      if (task === 'draft') { setOutput('draft'); setStage('draft'); }
    } catch (failure) {
      if (failure instanceof IntakeError) setSession(failure.session);
      setError(failure instanceof Error ? failure.message : String(failure));
      setRetryTask(task);
    } finally { controller.current = null; setBusy(null); void refreshRuntime(); }
  }
  async function guide(base: IntakeSession, groups: string[]) {
    setBusy('intake'); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      setSession(await guideConversation(base, generateIntakeModel, abort.signal));
    } catch (failure) {
      if (abort.signal.aborted) return;
      // Fallback: a fixed, neutral topic question so the conversation can continue.
      const focus = (failure as { targets?: string[] }).targets?.[0] ?? groups[0];
      const group = metadataGroups.find(item => item.id === focus);
      const said = getActiveFacts(base).find(fact => fact.requirementId === focus)?.value;
      setSession(openTopic(base, [focus], (said === 'no' ? sc.topicNo : sc.topic).replace('{topic}', group ? (language === 'ko' ? group.ko : group.en) : focus)));
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
    setBusy('intake'); setGeneratingExample(true); setError(''); setRetryTask(null);
    try {
      const answer = parseExampleAnswer(await generateReviewModel({ ...exampleAnswerRequest(session), signal: abort.signal }));
      if (!abort.signal.aborted) { setInput(answer); setDemo(true); }
    } catch (failure) {
      if (!abort.signal.aborted) setError('Could not generate an example answer. ' + String(failure));
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
    data.question14Derived = derived14;
    data.formValues = formFacts.map(fact => ({ factId: fact.id, requirementId: fact.requirementId, eventId: fact.eventId, ko: koreanValue(fact) }));
    download(`DARI-${session.id.slice(0, 8)}.json`, JSON.stringify(data, null, 2));
  }
  function openOperator() { setOperatorOpen(true); }
  function closeDialog() { setShowHelp(false); setSourceIds([]); }

  if (stage === 'language') return <div className="language-entry"><div className="language-entry-content">
    <h1 className="entry-logo" lang="en" dir="ltr">DARI</h1>
    {!started && !Object.keys(session.form).length && <button className="secondary" onClick={startQuickTest}>Conversation test · English → Korean</button>}
    <nav className="language-scroll" aria-label="Language / 언어">{intakeLanguages.map(item => <button className="language-option" lang={item.code} dir="auto" key={item.code} onClick={() => selectLanguage(item.code)}>{item.name}</button>)}</nav>
  </div></div>;

  return <div className={stage === 'conversation' || stage === 'form' ? 'app-shell chat-mode' : stage === 'basics' ? 'app-shell start-mode' : 'app-shell page-mode'}>
    <a className="skip-link" href="#main">{copy.continue}</a>
    <header className="site-header"><button className="brand" onClick={() => setStage('basics')} disabled={!!busy}><strong lang="en" dir="ltr">DARI</strong><span>{copy.tagline}</span></button><div className="header-actions"><button className="quiet" onClick={() => setStage('language')} disabled={!!busy}>{intakeLanguages.find(item => item.code === language)?.name}</button><button className="quiet" onClick={() => setShowHelp(true)}><span className="help-mark">?</span>{copy.help}</button></div></header>
    <div className="workspace">
      <aside className="sidebar"><p className="overline">DARI / 01</p><h2>{copy.sidebar}</h2><ol className="steps">{steps.map((item, index) => <li key={item.id}><button className={stage === item.id ? 'active' : ''} aria-current={stage === item.id ? 'step' : undefined} disabled={!!busy || (item.id === 'draft' && !session.draftRevision)} onClick={() => setStage(item.id)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span></button></li>)}</ol><div className="sidebar-note"><p>{copy.pace}</p><small>{copy.memory}</small></div><div className="sidebar-footer">DARI</div></aside>
      <main id="main" ref={main} tabIndex={-1}>
        <p className="eyebrow">{String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')} · {steps[stepIndex].label}</p>
        <h1>{stage === 'form' ? sc.formTitle : stage === 'basics' ? copy.startTitle : stage === 'conversation' ? copy.chatTitle : stage === 'facts' ? copy.factsTitle : copy.draftTitle}</h1>
        <p className="intro">{stage === 'form' ? sc.formIntro : stage === 'basics' ? copy.startIntro : stage === 'conversation' ? copy.chatIntro : stage === 'facts' ? copy.factsIntro : copy.draftIntro}</p>
        {stage === 'basics' && !started && !Object.keys(session.form).length && <button className="secondary" onClick={startQuickTest}>Try a short conversation</button>}
        {stage === 'conversation' && session.scope === 'test' && <div className="actions test-actions"><span>Short test</span><button className="secondary" disabled={!!busy || !!input.trim() || session.messages.at(-1)?.role !== 'assistant' || session.messages.at(-1)?.ask?.kind === 'done'} onClick={() => void generateExample()}>{generatingExample ? 'Generating a fictional answer…' : 'Generate an example'}</button><button className="secondary" disabled={!!busy} onClick={() => { setSession(current => finishNarrative({ ...current, narrativeDone: true })); setStage('facts'); }}>Finish</button></div>}
        {busy && <div className="notice busy-notice"><p role="status">{generatingExample ? 'Generating a fictional example. It will be placed in the input box, not sent automatically.' : processCopy[busy]}</p><small aria-live="off">{processCopy.elapsed} · <span dir="ltr">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span></small></div>}
        {error && <div className="notice error" role="alert"><p>{error}</p>{retryTask && <div className="actions"><button className="secondary" disabled={!!busy} onClick={() => void run(session, retryTask)}>{copy.retry}</button></div>}</div>}
        {runtime && (!runtime.available || !runtime.modelReady) && (narrativeOpened || stage === 'facts') && <div className="notice"><p>{copy.unavailable}</p><button className="quiet" onClick={openOperator}>Operator / 운영자</button></div>}
        {stage === 'basics' && <div className="content-grid"><section className="start-panel">{started && <p className="micro">{copy.factsIntro}</p>}<div className="actions" style={started ? undefined : { marginTop: 0 }}><button className="primary full" onClick={start}>{started ? copy.continue : copy.start}<span aria-hidden="true">{direction === 'rtl' ? '←' : '→'}</span></button></div></section><aside className="support-card"><h2>{copy.pace}</h2><p>{copy.chatIntro}</p><p className="micro">{copy.memory}</p></aside></div>}
        {stage === 'form' && <FormStage language={language} answers={session.form} page={formPage} copy={sc} back={copy.back} next={copy.continue}
          onChange={form => { setReviewed(false); setSession(current => ({ ...invalidateDraft(current), form })); }} onPage={setFormPage} onDone={() => setStage('conversation')} />}
        {stage === 'conversation' && <div className="content-grid"><div><section className="panel chat-panel"><div className="chat-toolbar"><button className="chat-chip" disabled={!!busy} onClick={() => setStage('facts')}>{copy.review} <span dir="ltr">{progress.answered}/{progress.total}</span></button>{inNarrative && session.narrativeDone && !busy && <button className="chat-chip" onClick={() => setSession(sync(finishNarrative(session)))}>{sc.finishTopic}</button>}</div><div className="chat-thread" ref={thread} role="log" aria-label={copy.conversation} aria-live="polite">{session.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small className="sr-only">{message.role === 'assistant' ? 'DARI' : copy.input}</small><p dir="auto">{message.content}</p></article>)}{busy && <div className="chat-message pending" role="status"><span className="spinner" />{generatingExample ? 'Generating a fictional answer for this question…' : busy === 'draft' ? copy.drafting : copy.thinking}</div>}</div>{ask && (ask.kind !== 'field' || askRequirement?.options) && <div className="answer-choices">
                  {ask.kind === 'table' && <><button className="secondary" disabled={!!busy} onClick={() => answer({ text: sc.have, status: 'answered' })}>{sc.have}</button><button className="secondary" disabled={!!busy} onClick={() => answer({ text: sc.none, status: 'not_applicable' })}>{sc.none}</button></>}
                  {ask.kind === 'more' && <><button className="secondary" disabled={!!busy} onClick={() => answer({ text: sc.yes, status: 'answered', value: 'yes' })}>{sc.yes}</button><button className="secondary" disabled={!!busy} onClick={() => answer({ text: sc.no, status: 'answered', value: 'no' })}>{sc.no}</button></>}
                  {ask.kind === 'field' && askRequirement?.type === 'single' && askRequirement.options?.map(option => <button key={option.value} className="secondary" disabled={!!busy} onClick={() => answer({ text: optionLabel(option), status: 'answered', value: option.value })}>{optionLabel(option)}</button>)}
                  {ask.kind === 'field' && askRequirement?.type === 'multi' && <>{askRequirement.options?.map(option => <button key={option.value} className="chip" aria-pressed={picked.includes(option.value)} disabled={!!busy} onClick={() => setPicked(current => current.includes(option.value) ? current.filter(item => item !== option.value) : [...current, option.value])}>{optionLabel(option)}</button>)}<button className="primary" disabled={!picked.length || !!busy} onClick={() => answer({ text: askRequirement.options!.filter(option => picked.includes(option.value)).map(optionLabel).join(', '), status: 'answered', value: picked })}>{sc.choose}</button></>}
                </div>}
                {ask && ask.kind !== 'more' && <div className="answer-choices quiet-choices"><button className="quiet" disabled={!!busy} onClick={() => answer({ text: sc.unknown, status: 'unknown' })}>{sc.unknown}</button><button className="quiet" disabled={!!busy} onClick={() => answer({ text: sc.skip, status: 'skipped' })}>{sc.skip}</button></div>}
                {(!ask || (ask.kind === 'field' && !askRequirement?.options)) && <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label><span className="composer-label">{copy.input}</span><textarea value={input} maxLength={12000} rows={3} placeholder={copy.placeholder} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} disabled={!!busy} /></label><div className="composer-actions"><small>{copy.pace}</small>{busy ? <button className="secondary" type="button" onClick={() => void stop()}>{copy.stop}</button> : <button className="primary send-icon" disabled={!input.trim()} type="submit" aria-label={copy.send} title={copy.send}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}</div></form>}
                </section></div><aside className="support-card"><h2>{copy.status}</h2><div className="fact-count">{progress.answered}<small>/ {progress.total}</small></div><div className="progress-rule"><span style={{ width: `${100 * (progress.answered + progress.notApplicable) / Math.max(1, progress.total)}%` }} /></div><p>{copy.factsIntro}</p></aside></div>}
        {stage === 'facts' && <>
          {conflicts.size > 0 && <div className="notice" role="status">{statusWords[language].conflict} · {conflicts.size}<p>{copy.factsIntro}</p></div>}
          {!facts.length && <p className="empty-state">{copy.noFacts}</p>}
          <div className="fact-groups">{factGroups().map(group => <details className="fact-group" key={group.key} open={group.story}>
            <summary><span>{group.label}</span><span className="fact-count-chip">{group.facts.length}</span>{group.facts.some(fact => conflicts.has(fact.requirementId)) && <span className="small-tag">{statusWords[language].conflict}</span>}</summary>
            {group.events.map(({ eventId, facts: items }, index) => <div className="fact-event" key={eventId || 'general'}>
              {eventId && group.events.filter(item => item.eventId).length > 0 && <p className="event-label">{sc.row.replace('{n}', String(group.events.filter(item => item.eventId).findIndex(item => item.eventId === eventId) + 1))}</p>}
              {items.map(fact => { const status = conflicts.has(fact.requirementId) ? 'conflict' : fact.status; return <article className="fact-row" key={fact.id}>
                <div className="fact-row-main"><small>{requirementLabel(fact.requirementId)}</small><p dir="auto">{factValue(fact.requirementId, fact.value)}</p></div>
                {status !== 'answered' && <span className={`small-tag status-${status}`}>{statusWords[language]?.[status] ?? status}</span>}
                <details className="fact-more"><summary>{copy.source}</summary>
                  {fact.sourceQuotes.map((quote, quoteIndex) => <blockquote key={quoteIndex} dir="auto">{quote.quote}</blockquote>)}
                  <div className="fact-qualifiers"><small>{processCopy.certainty}: {processCopy[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{processCopy.knowledge}: {processCopy[fact.knowledge]}</small>}</div>
                  {isFormSection(fact.requirementId) ? <button className="quiet" disabled={!!busy} onClick={() => { setFormPage(formPageOf(fact.requirementId)); setStage('form'); }}>{sc.editInForm}</button> : requirementsById.get(fact.requirementId)?.collection !== 'conversation' && <button className="quiet" disabled={!!busy} onClick={() => reask(fact)}>{sc.reask}</button>}
                </details>
              </article>; })}
            </div>)}
          </details>)}</div>
          <details className="details"><summary>{copy.missing} · {pending.length}</summary><div className="details-content"><ul className="pending-list">{pending.map(item => <li key={item.requirementId}>{requirementLabel(item.requirementId)} — {statusWords[language]?.[item.status]}</li>)}</ul></div></details>
          {narrativeOpened && <form className="panel" style={{ marginTop: 22 }} onSubmit={event => { event.preventDefault(); void send(input, session, true); }}><label>{copy.correction}<textarea value={input} rows={3} maxLength={12000} placeholder={copy.correctionPlaceholder} onChange={event => setInput(event.target.value)} disabled={!!busy} /></label><div className="actions"><button className="secondary" disabled={!input.trim() || !!busy}>{copy.send}</button></div></form>}
          <div className="review-bar">{facts.length > 0 && <label className="check-row"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={!!busy} />{copy.confirmed}</label>}
          <div className="actions"><button className="secondary" disabled={!!busy} onClick={() => setStage('conversation')}>{copy.back}</button><button className="primary" disabled={!reviewed || !!busy || !facts.some(item => item.status === 'answered')} onClick={() => void draft()}>{busy === 'draft' ? copy.drafting : copy.draftAction}</button>{busy && <button className="secondary" onClick={() => void stop()}>{copy.stop}</button>}</div></div>
        </>}
        {stage === 'draft' && <>
          <div className="notice">{copy.draftNote}</div>
          <div className="output-tabs" aria-label={copy.draft}>{(['draft', 'source', 'metadata'] as Output[]).map(item => <button key={item} aria-pressed={output === item} onClick={() => setOutput(item)}>{item === 'draft' ? copy.draft : item === 'source' ? copy.original : copy.metadata}</button>)}</div>
          {output === 'draft' && <section className="panel q14-draft" lang={language === 'en' ? 'en' : 'ko'} dir="ltr">
            <div className="section-title"><h2>{language === 'en' ? '14. Reasons for seeking protection' : '14. 난민인정 신청 사유'}</h2><span className="small-tag">{language === 'en' ? 'Editable Korean draft' : '직접 수정 가능'}</span></div>
            <p className="micro">{language === 'en' ? 'This Korean draft uses the information you shared. Your edits are stored separately from your original answers. You can discuss a sentence in English; replacement text remains Korean.' : '대화에서 수집한 내용으로 채운 초안입니다. 선택, 표, 문장을 직접 고칠 수 있으며 고친 내용은 수집한 원문과 따로 저장됩니다.'}</p>
            {question14Steps.map(step => { const visible = step.fields.filter(field => isFieldVisible(field, answers14) && (session.scope !== 'test' || /^14\.[123](?:-|$)/.test(field.id))); return visible.length > 0 && <div className="q14-step" key={step.id}>
              <h3>{language === 'en' ? step.titleEn : step.titleKo}</h3>
              {visible.map(field => { const section = sectionsByField.get(field.id); const derived = derived14.find(item => item.id === field.id); return <div className="q14-field" key={field.id}>
                <h4 className="q14-id">{field.id} · {language === 'en' ? field.en : field.ko}</h4>
                {derived?.needsReview && <p className="draft-missing">{language === 'en' ? 'Needs your review: ' : '다시 확인 필요: '}{derived.value}</p>}
                {!!section?.missingFactIds?.length && <p className="draft-missing">초안에 빠진 확인 내용: {section.missingFactIds.map(id => { const fact = session.facts.find(item => item.id === id); return fact ? `${requirementsById.get(fact.requirementId)?.label} — ${factValue(fact.requirementId, fact.value)}` : id; }).join(' · ')}. 직접 보완해 주세요.</p>}
                {!!section?.staleValues?.length && <p className="draft-missing">정정하기 전 내용이 남아 있습니다: {section.staleValues.join(' · ')}. 직접 고쳐 주세요.</p>}
                {language === 'en' && answers14[field.id]?.kind === 'text' && <EnglishMeaning text={(answers14[field.id] as { text: string }).text} />}
                <FieldInput field={field} language={language === 'en' ? 'en' : 'ko'} value={answers14[field.id]} copy={sc} onChange={value => updateQuestion14(field.id, value)} />
                {answers14[field.id]?.kind === 'text' && (answers14[field.id] as { text: string }).text.trim() && <>
                  <button className="secondary" onClick={() => setEditingField(editingField === field.id ? null : field.id)}>{editingField === field.id ? (language === 'en' ? 'Close sentence editor' : '문장 수정 닫기') : (language === 'en' ? 'Discuss and refine this text' : '문장별 대화로 다듬기')}</button>
                  {editingField === field.id && <EditorModal title={language === 'en' ? 'Sentence editor' : '문장 수정'} closeLabel={language === 'en' ? 'Close' : '닫기'} onClose={() => setEditingField(null)}><SentenceReview uiLanguage={language} key={`${session.id}-${session.draftRevision}-${field.id}`} text={(answers14[field.id] as { text: string }).text} saved={session.draftReviews?.[field.id]} onChange={(doc, expected) => setSession(current => {
                    const answer = current.question14?.[field.id];
                    if (!current.draftRevision || answer?.kind !== 'text' || answer.text !== expected) return current;
                    return saveDraftReview(current, field.id, expected, doc);
                  })} /></EditorModal>}
                </>}
                {section && <details className="fact-more"><summary>{copy.evidence}</summary>{section.sentences.map((sentence, index) => <div key={index}><p>{sentence.text}</p><button className="quiet" onClick={() => setSourceIds(sentence.sourceIds)}>{copy.source} ↗</button></div>)}<p className="micro">근거는 자동 작성 당시의 문장에 연결되어 있으며, 직접 고친 문장에는 자동으로 다시 연결되지 않습니다.</p></details>}
              </div>; })}
            </div>; })}
          </section>}
          {output === 'draft' && formFacts.length > 0 && <section className="panel draft-card" lang="ko" dir="ltr"><div className="section-title"><h2>{scriptedCopy.ko.formValues}</h2><span className="small-tag">{scriptedCopy.ko.asEntered}</span></div><dl className="form-values">{formFacts.map(fact => <div key={fact.id}><dt>{fact.requirementId} · {requirementsById.get(fact.requirementId)?.label}{fact.eventId && ` (${fact.eventId})`}</dt><dd dir="auto">{koreanValue(fact)}</dd></div>)}</dl></section>}
          {output === 'source' && <div className="fact-list">{session.messages.map(message => <article className="fact-card" key={message.id}><small>{message.role === 'user' ? copy.input : 'DARI'} · {message.id}</small><p dir="auto">{message.content}</p></article>)}</div>}
          {output === 'metadata' && <section className="panel"><p className="developer-label">Metadata / Developer view</p><div className="details-content" dir="ltr"><pre>{JSON.stringify(JSON.parse(exportSession(session)).metadata, null, 2)}</pre></div></section>}
          <div className="actions"><button className="secondary" onClick={() => setStage('facts')}>{copy.back}</button><button className="primary" onClick={exportAll}>{copy.export}</button><button className="secondary" onClick={() => download('DARI-Korean-draft.txt', [question14Text(), formFacts.length ? `${scriptedCopy.ko.formValues}\n${formValuesText()}` : ''].filter(Boolean).join('\n\n'), 'text/plain')}>{copy.downloadText}</button></div>
        </>}
      </main>
    </div>
    <button className="operator-fab" aria-expanded={operatorOpen} aria-controls="operator" aria-label="운영자·개발자 설정 / Operator" title="운영자·개발자 설정" onClick={() => setOperatorOpen(open => !open)}>⚙</button>
    {operatorOpen && <section id="operator" className="operator-popover" lang="ko" dir="ltr" aria-label="운영자·개발자 설정"><div className="operator-head"><b>운영자·개발자 설정</b><button className="quiet" onClick={() => setOperatorOpen(false)}>닫기</button></div><div className="operator-grid">
          <p className="status-line">{runtime?.mode === 'on-device' ? '모바일 기기에서 실행 · 온디바이스' : '브라우저 테스트 · 연결된 로컬 서버에서 연산'}<br />{runtime?.modelName ?? '상태 확인 중'}{runtime?.backend && ` · ${runtime.backend.toUpperCase()}`} · {runtime?.modelReady ? (runtime.mode === 'on-device' ? '모델 파일 준비됨 · 실행 호환성은 첫 응답에서 확인' : '모델 준비됨') : '모델 준비 필요'}</p>
          {runtime?.mode !== 'on-device' && <><code>{INTAKE_API_URL}</code><label>미리보기 모델<select value={model} disabled={!!busy} onChange={event => { setModel(event.target.value); setPreviewModel(event.target.value); void refreshRuntime(); }}>{previewModels.map(item => <option key={item}>{item}</option>)}</select></label><small>브라우저에서는 원문과 수집 정보를 위 서버에 보내 연산합니다. 모바일 앱은 네이티브 모델을 사용하며 서버로 자동 전환하지 않습니다.</small></>}
          {runtime?.reason && <p className="status-line">{runtime.reason}</p>}
          <div className="actions" style={{ marginTop: 0 }}><button className="secondary" disabled={!!busy || importing} onClick={() => void refreshRuntime()}>상태 새로고침</button>{runtime?.mode === 'on-device' && <button className="secondary" disabled={!!busy || importing} onClick={async () => { setImporting(true); try { setRuntime(await importIntakeModel()); } catch (failure) { setError(String(failure)); } finally { setImporting(false); } }}>{importing ? '모델 가져오는 중…' : '.litertlm 모델 가져오기'}</button>}</div>
          <label>새 대화의 수집 범위<select value={scope} disabled={!!busy || session.messages.some(item => item.role === 'user')} onChange={event => { const value = event.target.value as 'priority' | 'full' | 'test'; setScope(value); setSession(stage === 'conversation' ? sync(createSession(language, value)) : createSession(language, value)); }}><option value="test">핵심 메타데이터 대화 테스트</option><option value="full">신청서 전체</option><option value="priority">14.1~14.3 우선 테스트</option></select></label>
          <button className="secondary" disabled={!!busy || session.messages.some(item => item.role === 'user')} onClick={() => void startDemo()}>한국어 가상 예시로 LLM 대화 테스트</button>
          <small>이 버튼은 14.1~14.3의 가상 원문을 실제 모델에 보냅니다. 정해진 응답을 재생하지 않습니다. 현재 대화가 있으면 새로고침 후 테스트해 주세요.</small>
          {session.messages.some(item => item.role === 'user') && <button className="secondary" onClick={exportAll} disabled={!!busy}>현재 원문·메타데이터·초안 JSON 내보내기</button>}
        </div></section>}
    <footer className="site-footer"><span>{copy.tagline}</span><span>{copy.memory}</span></footer>
    <dialog ref={dialog} className="help-dialog" onCancel={closeDialog} onClose={closeDialog}><h2>{showHelp ? copy.help : copy.source}</h2>{showHelp ? <><p>{copy.helpBody}</p><p>{copy.memory}</p></> : session.messages.filter(item => sourceIds.includes(item.id)).map(item => <div key={item.id}><small>{item.id}</small><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p></div>)}<div className="actions"><button className="primary" onClick={closeDialog}>{copy.close}</button></div></dialog>
  </div>;
}
