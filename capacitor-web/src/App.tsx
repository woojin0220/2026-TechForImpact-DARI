import { useEffect, useRef, useState } from 'react';
import { appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, exportSession, generateDraft, getActiveFacts, getProgress, IntakeError, requirementsById, type IntakeSession } from './intake';
import { cancelIntakeGeneration, generateIntakeModel, getIntakeRuntimeStatus, getPreviewModel, importIntakeModel, INTAKE_API_URL, previewModels, setPreviewModel, type IntakeRuntimeStatus } from './lib/intakeModel';
import { intakeCopies, intakeFieldLabels, intakeLanguages, intakeProcessCopy } from './intakeCopy';
import { hasQuestionPhrase, localize } from './form/localize';

type Stage = 'language' | 'basics' | 'conversation' | 'facts' | 'draft';
type Output = 'draft' | 'source' | 'metadata';
const demoAnswer = '이것은 기능 테스트를 위한 가상 이야기입니다. 저는 정치적 의견 때문에 보호를 신청하려고 합니다. 2025년 봄쯤 제 나라의 작은 도시에서 평화적인 집회에 참여한 뒤 경찰 제복을 입은 두 사람이 집에 찾아왔습니다. 정확한 날짜는 기억나지 않습니다. 그들은 저에게 집회에 다시 나가지 말라고 말했고 저는 무서웠습니다. 저는 구금되거나 다치지는 않았습니다. 이 일이 정치적 의견 때문이라고 생각하지만 그들의 실제 소속은 확인하지 못했습니다. 그 뒤 다른 도시의 친구 집으로 옮겼습니다. 가족이 직접 피해를 입은 일은 없습니다. 돌아가면 다시 위협받을까 두렵습니다. 무기를 보지는 못했습니다.';
const nationalityQuestions: Record<string, string> = { ko: '현재 국적은 무엇인가요? (모르거나 없는 경우 그렇게 적어주세요)', en: 'What is your current nationality? (You can say unknown or none.)', ru: 'Какое у вас сейчас гражданство? (Можно указать, что оно неизвестно или отсутствует.)', fr: 'Quelle est votre nationalité actuelle ? (Vous pouvez indiquer « inconnue » ou « aucune ».)', ar: 'ما جنسيتك الحالية؟ (يمكنك القول إنها غير معروفة أو أنك بلا جنسية.)', fa: 'ملیت فعلی شما چیست؟ (می‌توانید بگویید نامعلوم است یا تابعیت ندارید.)' };
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
  const [stage, setStage] = useState<Stage>('language');
  const [language, setLanguage] = useState('ko');
  const [session, setSession] = useState<IntakeSession>(() => createSession('ko', 'full'));
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState<'intake' | 'draft' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [retryTask, setRetryTask] = useState<'intake' | 'draft' | null>(null);
  const [runtime, setRuntime] = useState<IntakeRuntimeStatus | null>(null);
  const [model, setModel] = useState(getPreviewModel());
  const [scope, setScope] = useState<'priority' | 'full'>('full');
  const [demo, setDemo] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [output, setOutput] = useState<Output>('draft');
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const copy = { ...(intakeCopies[language] ?? intakeCopies.en), country: nationalityQuestions[language] ?? nationalityQuestions.en };
  const processCopy = intakeProcessCopy[language] ?? intakeProcessCopy.en;
  const direction = ['ar', 'fa'].includes(language) ? 'rtl' : 'ltr';
  const facts = getActiveFacts(session);
  const started = session.messages.some(item => item.role === 'user');
  const progress = getProgress(session);
  const coverage = calculateCoverage(session);
  const conflicts = new Set(coverage.filter(item => item.status === 'conflict').map(item => item.requirementId));
  const pending = coverage.filter(item => item.status !== 'answered' && item.status !== 'not_applicable');
  const steps: { id: Stage; label: string }[] = [{ id: 'basics', label: copy.basics }, { id: 'conversation', label: copy.conversation }, { id: 'facts', label: copy.facts }, { id: 'draft', label: copy.draft }];
  const stepIndex = Math.max(0, steps.findIndex(item => item.id === stage));

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = direction; }, [language, direction]);
  useEffect(() => { void refreshRuntime(); }, []);
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
  function selectLanguage(code: string) {
    setLanguage(code);
    if (!session.messages.some(item => item.role === 'user')) setSession(createSession(code, scope));
    else setSession(current => ({ ...current, language: code }));
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
      setSession(result);
      if (task === 'draft') { setDraftEdits({}); setOutput('draft'); setStage('draft'); }
    } catch (failure) {
      if (failure instanceof IntakeError) setSession(failure.session);
      setError(failure instanceof Error ? failure.message : String(failure));
      setRetryTask(task);
    } finally { controller.current = null; setBusy(null); void refreshRuntime(); }
  }
  async function send(text = input, base = session) {
    if (!text.trim() || busy) return;
    try {
      const next = appendUserMessage(base, text);
      setInput(''); setReviewed(false); setDraftEdits({}); setStage('conversation');
      await run(next, 'intake');
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  }
  async function start() {
    setStage('conversation');
    if (session.messages.some(item => item.role === 'user')) return;
    const text = [name.trim() && `${copy.name}: ${name.trim()}`, country.trim() && `${copy.country}: ${country.trim()}`].filter(Boolean).join('\n');
    if (text) await send(text, createSession(language, scope));
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
    setDemo(true); setLanguage('ko'); setScope('priority');
    await send(demoAnswer, createSession('ko', 'priority'));
  }
  function exportAll() {
    const data = JSON.parse(exportSession(session));
    data.draft.userEdits = Object.entries(draftEdits).map(([questionId, text]) => ({ questionId, text, provenance: 'user-edited; generated sentence references are not automatically reassigned' }));
    data.synthetic = demo;
    download(`DARI-${session.id.slice(0, 8)}.json`, JSON.stringify(data, null, 2));
  }
  function closeDialog() { setShowHelp(false); setSourceIds([]); }

  if (stage === 'language') return <div className="language-entry"><div className="language-entry-content">
    <h1 className="entry-logo" lang="en" dir="ltr">DARI</h1>
    <nav className="language-scroll" aria-label="Language / 언어">{intakeLanguages.map(item => <button className="language-option" lang={item.code} dir="auto" key={item.code} onClick={() => selectLanguage(item.code)}>{item.name}</button>)}</nav>
  </div></div>;

  return <>
    <a className="skip-link" href="#main">{copy.continue}</a>
    <div className="prototype-bar"><span><b>DARI</b>{copy.preview}</span><span>{copy.purpose}</span></div>
    <header className="site-header"><button className="brand" onClick={() => setStage('basics')} disabled={!!busy}><strong lang="en" dir="ltr">DARI</strong><span>{copy.tagline}</span></button><div className="header-actions"><button className="quiet" onClick={() => setStage('language')} disabled={!!busy}>{intakeLanguages.find(item => item.code === language)?.name}</button><button className="quiet" onClick={() => setShowHelp(true)}><span className="help-mark">?</span>{copy.help}</button></div></header>
    <div className="workspace">
      <aside className="sidebar"><p className="overline">DARI / 01</p><h2>{copy.sidebar}</h2><ol className="steps">{steps.map((item, index) => <li key={item.id}><button className={stage === item.id ? 'active' : ''} aria-current={stage === item.id ? 'step' : undefined} disabled={!!busy || (item.id === 'draft' && !session.draft.length)} onClick={() => setStage(item.id)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span></button></li>)}</ol><div className="sidebar-note"><p>{copy.pace}</p><small>{copy.memory}</small></div><div className="sidebar-footer">DARI</div></aside>
      <main id="main" ref={main} tabIndex={-1}>
        <p className="eyebrow">{String(stepIndex + 1).padStart(2, '0')} / 04 · {steps[stepIndex].label}</p>
        <h1>{stage === 'basics' ? copy.startTitle : stage === 'conversation' ? copy.chatTitle : stage === 'facts' ? copy.factsTitle : copy.draftTitle}</h1>
        <p className="intro">{stage === 'basics' ? copy.startIntro : stage === 'conversation' ? copy.chatIntro : stage === 'facts' ? copy.factsIntro : copy.draftIntro}</p>
        {demo && <div className="notice"><b>{copy.demo}</b> · {copy.demoNotice}</div>}
        {busy && <div className="notice"><p role="status">{processCopy[busy]}</p><small aria-live="off">{processCopy.elapsed} · <span dir="ltr">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span></small></div>}
        {error && <div className="notice error" role="alert"><p>{error}</p>{retryTask && <div className="actions"><button className="secondary" disabled={!!busy} onClick={() => void run(session, retryTask)}>{copy.retry}</button></div>}</div>}
        {runtime && (!runtime.available || !runtime.modelReady) && <div className="notice"><p>{copy.unavailable}</p><a href="#operator">Operator / 운영자</a></div>}
        {stage === 'basics' && <div className="content-grid"><section className="panel"><div className="form-grid"><label>{copy.name}<input value={name} disabled={started} maxLength={150} placeholder={copy.namePlaceholder} onChange={event => setName(event.target.value)} /></label><label>{copy.country}<input value={country} disabled={started} maxLength={250} placeholder={copy.countryPlaceholder} onChange={event => setCountry(event.target.value)} /></label></div>{started && <p className="micro">{copy.factsIntro}</p>}<div className="actions"><button className="primary full" onClick={() => void start()}>{started ? copy.continue : copy.start}<span aria-hidden="true">{direction === 'rtl' ? '←' : '→'}</span></button></div></section><aside className="support-card"><h2>{copy.pace}</h2><p>{copy.chatIntro}</p><p className="micro">{copy.memory}</p></aside></div>}
        {stage === 'conversation' && <div className="content-grid"><div><section className="panel chat-panel"><div className="chat-thread" ref={thread} role="log" aria-label={copy.conversation} aria-live="polite">{session.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small>{message.role === 'assistant' ? 'DARI' : copy.input}</small><p dir="auto">{message.content}</p></article>)}{busy && <div className="chat-message pending" role="status"><span className="spinner" />{busy === 'draft' ? copy.drafting : copy.thinking}</div>}</div><form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label>{copy.input}<textarea value={input} maxLength={12000} rows={3} placeholder={copy.placeholder} onChange={event => setInput(event.target.value)} disabled={!!busy} /></label><div className="composer-actions"><small>{copy.pace}</small>{busy ? <button className="secondary" type="button" onClick={() => void stop()}>{copy.stop}</button> : <button className="primary" disabled={!input.trim()} type="submit">{copy.send}<span aria-hidden="true">↑</span></button>}</div></form></section><div className="actions end"><button className="secondary" disabled={!!busy} onClick={() => setStage('facts')}>{copy.review}</button><small>{copy.answered} {progress.answered} / {progress.total}</small></div></div><aside className="support-card"><h2>{copy.status}</h2><div className="fact-count">{progress.answered}<small>/ {progress.total}</small></div><div className="progress-rule"><span style={{ width: `${100 * (progress.answered + progress.notApplicable) / Math.max(1, progress.total)}%` }} /></div><p>{copy.factsIntro}</p></aside></div>}
        {stage === 'facts' && <>
          {conflicts.size > 0 && <div className="notice" role="status">{statusWords[language].conflict} · {conflicts.size}<p>{copy.factsIntro}</p></div>}
          <div className="fact-list">{!facts.length && <p className="empty-state">{copy.noFacts}</p>}{facts.map(fact => <article className="fact-card" key={fact.id}><header><h3>{requirementLabel(fact.requirementId)}</h3><span className="small-tag">{statusWords[language]?.[conflicts.has(fact.requirementId) ? 'conflict' : fact.status] ?? fact.status}</span></header><p dir="auto">{factValue(fact.requirementId, fact.value)}</p><div className="fact-qualifiers"><small>{processCopy.certainty}: {processCopy[fact.certainty]}</small>{fact.knowledge !== 'unspecified' && <small>{processCopy.knowledge}: {processCopy[fact.knowledge]}</small>}</div><details className="details"><summary>{copy.source}</summary><div className="details-content">{fact.sourceQuotes.map((quote, index) => <blockquote key={index} dir="auto">{quote.quote}</blockquote>)}</div></details></article>)}</div>
          <details className="details"><summary>{copy.missing} · {pending.length}</summary><div className="details-content"><ul className="pending-list">{pending.map(item => <li key={item.requirementId}>{requirementLabel(item.requirementId)} — {statusWords[language]?.[item.status]}</li>)}</ul></div></details>
          <form className="panel" style={{ marginTop: 22 }} onSubmit={event => { event.preventDefault(); void send(); }}><label>{copy.correction}<textarea value={input} rows={3} maxLength={12000} placeholder={copy.correctionPlaceholder} onChange={event => setInput(event.target.value)} disabled={!!busy} /></label><div className="actions"><button className="secondary" disabled={!input.trim() || !!busy}>{copy.send}</button></div></form>
          {facts.length > 0 && <label className="check-row"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={!!busy} />{copy.confirmed}</label>}
          <div className="actions"><button className="secondary" disabled={!!busy} onClick={() => setStage('conversation')}>{copy.back}</button><button className="primary" disabled={!reviewed || !!busy || !facts.some(item => item.status === 'answered')} onClick={() => void draft()}>{busy === 'draft' ? copy.drafting : copy.draftAction}</button>{busy && <button className="secondary" onClick={() => void stop()}>{copy.stop}</button>}</div>
        </>}
        {stage === 'draft' && <>
          <div className="notice">{copy.draftNote}</div>
          <div className="output-tabs" aria-label={copy.draft}>{(['draft', 'source', 'metadata'] as Output[]).map(item => <button key={item} aria-pressed={output === item} onClick={() => setOutput(item)}>{item === 'draft' ? copy.draft : item === 'source' ? copy.original : copy.metadata}</button>)}</div>
          {output === 'draft' && session.draft.map(section => <section className="panel draft-card" key={section.questionId} lang="ko" dir="ltr"><div className="section-title"><h2>{section.questionId} · {requirementsById.get(section.questionId)?.label ?? '신청서 답변'}</h2><span className="small-tag">한국어</span></div><textarea aria-label={`${section.questionId} 한국어 초안`} value={draftEdits[section.questionId] ?? section.text} onChange={event => setDraftEdits(current => ({ ...current, [section.questionId]: event.target.value }))} /><details className="details"><summary>{copy.evidence}</summary><div className="details-content">{section.sentences.map((sentence, index) => <div key={index}><p>{sentence.text}</p><button className="quiet" onClick={() => setSourceIds(sentence.sourceIds)}>{copy.source} ↗</button></div>)}{draftEdits[section.questionId] !== undefined && <p>직접 수정한 문장은 자동 생성문과 별도로 보관됩니다. 위 근거는 자동 생성 당시의 문장에 연결되어 있습니다.</p>}</div></details></section>)}
          {output === 'source' && <div className="fact-list">{session.messages.map(message => <article className="fact-card" key={message.id}><small>{message.role === 'user' ? copy.input : 'DARI'} · {message.id}</small><p dir="auto">{message.content}</p></article>)}</div>}
          {output === 'metadata' && <section className="panel"><p className="developer-label">Metadata / Developer view</p><div className="details-content" dir="ltr"><pre>{JSON.stringify(JSON.parse(exportSession(session)).metadata, null, 2)}</pre></div></section>}
          <div className="actions"><button className="secondary" onClick={() => setStage('facts')}>{copy.back}</button><button className="primary" onClick={exportAll}>{copy.export}</button><button className="secondary" onClick={() => download('DARI-Korean-draft.txt', session.draft.map(item => `${item.questionId}\n${draftEdits[item.questionId] ?? item.text}`).join('\n\n'), 'text/plain')}>{copy.downloadText}</button></div>
        </>}
        <details id="operator" className="details operator-panel"><summary>운영자·개발자 설정 / Operator</summary><div className="details-content operator-grid" lang="ko" dir="ltr">
          <p className="status-line">{runtime?.mode === 'on-device' ? '모바일 기기에서 실행 · 온디바이스' : '브라우저 테스트 · 연결된 로컬 서버에서 연산'}<br />{runtime?.modelName ?? '상태 확인 중'} · {runtime?.modelReady ? (runtime.mode === 'on-device' ? '모델 파일 준비됨 · 실행 호환성은 첫 응답에서 확인' : '모델 준비됨') : '모델 준비 필요'}</p>
          {runtime?.mode !== 'on-device' && <><code>{INTAKE_API_URL}</code><label>미리보기 모델<select value={model} disabled={!!busy} onChange={event => { setModel(event.target.value); setPreviewModel(event.target.value); void refreshRuntime(); }}>{previewModels.map(item => <option key={item}>{item}</option>)}</select></label><small>브라우저에서는 원문과 수집 정보를 위 서버에 보내 연산합니다. 모바일 앱은 네이티브 모델을 사용하며 서버로 자동 전환하지 않습니다.</small></>}
          {runtime?.reason && <p className="status-line">{runtime.reason}</p>}
          <div className="actions" style={{ marginTop: 0 }}><button className="secondary" disabled={!!busy || importing} onClick={() => void refreshRuntime()}>상태 새로고침</button>{runtime?.mode === 'on-device' && <button className="secondary" disabled={!!busy || importing} onClick={async () => { setImporting(true); try { setRuntime(await importIntakeModel()); } catch (failure) { setError(String(failure)); } finally { setImporting(false); } }}>{importing ? '모델 가져오는 중…' : '.litertlm 모델 가져오기'}</button>}</div>
          <label>새 대화의 수집 범위<select value={scope} disabled={!!busy || session.messages.some(item => item.role === 'user')} onChange={event => { const value = event.target.value as 'priority' | 'full'; setScope(value); setSession(createSession(language, value)); }}><option value="full">신청서 전체</option><option value="priority">14.1~14.3 우선 테스트</option></select></label>
          <button className="secondary" disabled={!!busy || session.messages.some(item => item.role === 'user')} onClick={() => void startDemo()}>한국어 가상 예시로 LLM 대화 테스트</button>
          <small>이 버튼은 14.1~14.3의 가상 원문을 실제 모델에 보냅니다. 정해진 응답을 재생하지 않습니다. 현재 대화가 있으면 새로고침 후 테스트해 주세요.</small>
          {session.messages.some(item => item.role === 'user') && <button className="secondary" onClick={exportAll} disabled={!!busy}>현재 원문·메타데이터·초안 JSON 내보내기</button>}
        </div></details>
      </main>
    </div>
    <footer className="site-footer"><span>{copy.tagline}</span><span>{copy.memory}</span></footer>
    <dialog ref={dialog} className="help-dialog" onCancel={closeDialog} onClose={closeDialog}><h2>{showHelp ? copy.help : copy.source}</h2>{showHelp ? <><p>{copy.helpBody}</p><p>{copy.memory}</p></> : session.messages.filter(item => sourceIds.includes(item.id)).map(item => <div key={item.id}><small>{item.id}</small><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p></div>)}<div className="actions"><button className="primary" onClick={closeDialog}>{copy.close}</button></div></dialog>
  </>;
}
