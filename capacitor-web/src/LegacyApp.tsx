import { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, isOnDeviceTranslationAvailable, translateTexts, verifyTranslation } from './lib/api';
import { applicationSteps, type FormField } from './form/schema';
import { localize } from './form/localize';
import { buildReview, isVisible } from './form/model';
import { translateAnswers } from './form/translateAnswers';
import { createRussianDemoAnswers, demoScenarioNotice } from './form/demoAnswers';
import { guidedCopy, guidedPastHarmPrompts, guidedSourceDraft, guidedText, type GuidedAnswer, type GuidedAnswers, type GuidedStatus } from './form/guidedPastHarm';
import { prepareReconfirmation, reconfirmationText, type ReconfirmationDecision, type ReconfirmationView } from './form/reconfirmation';
import type { Answers, DraftEntry, FieldAnswer, LanguageOption, VerificationModel, VerificationReport } from './types';

const languages: LanguageOption[] = [
  { code: 'ko', label: '한국어', answerLabel: '한국어', notApplicable: '해당 없음' },
  { code: 'ru', label: 'Русский', answerLabel: '러시아어', notApplicable: 'не применимо' },
  { code: 'ar', label: 'العربية', answerLabel: '아랍어', notApplicable: 'غير منطبق' },
  { code: 'fr', label: 'Français', answerLabel: '프랑스어', notApplicable: 'non applicable' },
  { code: 'fa', label: 'فارسی', answerLabel: '페르시아어', notApplicable: 'قابل اعمال نیست' },
];

const models: VerificationModel[] = [
  { name: 'Qwen3 4B', model: 'qwen3:4b', detail: '가벼운 오픈웨이트 모델' },
  { name: 'Llama 3.2 3B', model: 'llama3.2:3b', detail: '대안 검증 모델' },
];

type Stage = 'setup' | 'writing' | 'fact-review' | 'translating' | 'review' | 'redact' | 'verifying' | 'preparing-reconfirmation' | 'reconfirm' | 'report';

function stepForQuestion(questionNumber?: string): string | undefined {
  if (!questionNumber) return undefined;
  const normalized = questionNumber.replace(/^\[|\]$/g, '').trim();
  return applicationSteps.find((item) => item.id === normalized || item.fields.some((field) => field.id === normalized))?.id;
}

function redactForPrototype(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REMOVED]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE REMOVED]');
}

// Previous translation/reconfirmation prototype, retained for later integration.
function App() {
  const [stage, setStage] = useState<Stage>('setup');
  const [languageCode, setLanguageCode] = useState('ko');
  const [model, setModel] = useState(models[0].model);
  const [stepId, setStepId] = useState(applicationSteps[0].id);
  const [answers, setAnswers] = useState<Answers>({});
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({});
  const [guidedPromptIndex, setGuidedPromptIndex] = useState(0);
  const [guidedEnabled, setGuidedEnabled] = useState(true);
  const [guidedConfirmed, setGuidedConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [reconfirmationViews, setReconfirmationViews] = useState<ReconfirmationView[]>([]);
  const [reconfirmationDecisions, setReconfirmationDecisions] = useState<Record<number, ReconfirmationDecision>>({});
  const [reconfirmationIndex, setReconfirmationIndex] = useState(0);
  const [isReconfirmationDemo, setIsReconfirmationDemo] = useState(false);
  const [error, setError] = useState('');
  const chatThreadRef = useRef<HTMLDivElement>(null);

  const language = languages.find((item) => item.code === languageCode) ?? languages[0];
  const stepIndex = Math.max(0, applicationSteps.findIndex((item) => item.id === stepId));
  const step = applicationSteps[stepIndex] ?? applicationSteps[0];
  const narrative = drafts.filter((item) => item.verify);
  const writingDirection = language.code === 'ar' || language.code === 'fa' ? 'rtl' : 'ltr';
  const isGuidedPastHarm = step.id === '14.2' && guidedEnabled;
  const pastHarmChoice = answers['14.2']?.kind === 'choice' ? answers['14.2'].values[0] : undefined;
  const currentGuidedPrompt = guidedPastHarmPrompts[guidedPromptIndex];
  const currentGuidedAnswer = guidedAnswers[currentGuidedPrompt.id] ?? { status: 'unanswered' as GuidedStatus, text: '' };
  const currentDifference = report?.items[reconfirmationIndex];
  const currentReconfirmation = reconfirmationViews[reconfirmationIndex];

  useEffect(() => {
    if (stage === 'writing' && isGuidedPastHarm) {
      chatThreadRef.current?.scrollTo({ top: chatThreadRef.current.scrollHeight });
    }
  }, [stage, isGuidedPastHarm, guidedPromptIndex]);

  const groups = useMemo(() => {
    const next: { section: string; steps: typeof applicationSteps }[] = [];
    for (const item of applicationSteps) {
      const last = next[next.length - 1];
      if (!last || last.section !== item.sectionKo) next.push({ section: item.sectionKo, steps: [item] });
      else last.steps.push(item);
    }
    return next;
  }, []);

  function updateAnswer(fieldId: string, answer: FieldAnswer) {
    if (fieldId === '14.2' && guidedEnabled) {
      setGuidedConfirmed(false);
      setAnswers((current) => ({ ...current, [fieldId]: answer, '14.2-detail': { kind: 'text', text: '' } }));
      return;
    }
    setAnswers((current) => ({ ...current, [fieldId]: answer }));
  }

  function updateGuidedAnswer(id: string, patch: Partial<GuidedAnswer>) {
    setGuidedAnswers((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { status: 'unanswered', text: '' }), ...patch },
    }));
    setGuidedConfirmed(false);
    setAnswers((current) => ({ ...current, '14.2-detail': { kind: 'text', text: '' } }));
  }

  function choosePastHarm(value: 'yes' | 'no') {
    updateAnswer('14.2', { kind: 'choice', values: [value] });
    setGuidedPromptIndex(0);
  }

  function advanceGuidedPrompt() {
    if (guidedPromptIndex === guidedPastHarmPrompts.length - 1) setStage('fact-review');
    else setGuidedPromptIndex((current) => current + 1);
  }

  function confirmGuidedAnswers() {
    setAnswers((current) => ({ ...current, '14.2-detail': { kind: 'text', text: guidedSourceDraft(guidedAnswers, language.code) } }));
    setGuidedConfirmed(true);
    setStepId(applicationSteps[stepIndex + 1]?.id ?? stepId);
    setStage('writing');
  }

  function needsFactReview(candidate: Answers) {
    return guidedEnabled && candidate['14.2']?.kind === 'choice'
      && candidate['14.2'].values.includes('yes') && !guidedConfirmed;
  }

  async function finishWriting(
    answersToTranslate = answers,
    sourceLanguage = language.code,
    notApplicable = language.notApplicable,
    translationModel = model,
  ) {
    if (needsFactReview(answersToTranslate)) {
      setStepId('14.2');
      setStage('fact-review');
      return;
    }
    setError('');
    setStage('translating');
    setProgress({ done: 0, total: 0, label: '' });
    try {
      const rendered = await translateAnswers(translationModel, sourceLanguage, notApplicable, answersToTranslate, (done, total, label) => {
        setProgress({ done, total, label });
      });
      const nextDrafts = buildReview(answersToTranslate, rendered);
      setDrafts(nextDrafts);
      const prose = nextDrafts.filter((item) => item.verify);
      setSourceText(redactForPrototype(prose.map((item) => `[${item.questionNumber}]\n${item.source}`).join('\n\n')));
      setEnglishText(redactForPrototype(prose.map((item) => `[${item.questionNumber}]\n${item.english}`).join('\n\n')));
      setStage('review');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '번역 중 오류가 발생했습니다.');
      setStage('writing');
    }
  }

  function startRussianDemo() {
    const demoAnswers = createRussianDemoAnswers();
    const demoModel = 'llama3.2:3b';
    setLanguageCode('ru');
    setModel(demoModel);
    setAnswers(demoAnswers);
    setGuidedAnswers({});
    setGuidedPromptIndex(0);
    setGuidedEnabled(false);
    setGuidedConfirmed(false);
    setStepId(applicationSteps[0].id);
    setReport(null);
    setIsReconfirmationDemo(false);
    void finishWriting(demoAnswers, 'ru', languages.find((item) => item.code === 'ru')!.notApplicable, demoModel);
  }

  function startKoreanGuidedDemo() {
    setLanguageCode('ko');
    setAnswers({ '14.2': { kind: 'choice', values: ['yes'] } });
    setGuidedAnswers({});
    setGuidedPromptIndex(0);
    setGuidedEnabled(true);
    setGuidedConfirmed(false);
    setDrafts([]);
    setReport(null);
    setIsReconfirmationDemo(false);
    setError('');
    setStepId('14.2');
    setStage('writing');
  }

  function startKoreanReconfirmationDemo() {
    const demoFacts: GuidedAnswers = {
      event: { status: 'answered', text: '경찰이 저를 조사했습니다.' },
      time: { status: 'uncertain', text: '2025년 3월쯤입니다. 정확한 날짜는 기억나지 않습니다.' },
      extra: { status: 'answered', text: '무기를 보지는 못했습니다.' },
    };
    setLanguageCode('ko');
    setGuidedEnabled(true);
    setGuidedAnswers(demoFacts);
    setGuidedConfirmed(true);
    setAnswers({ '14.2': { kind: 'choice', values: ['yes'] }, '14.2-detail': { kind: 'text', text: guidedSourceDraft(demoFacts, 'ko') } });
    setStepId('14.2');
    setReport({
      hasDistortion: true,
      summary: '화면 테스트용 가상 사례입니다. 실제 모델 검증 결과가 아닙니다.',
      items: [
        { type: '불확실성·행위 변화', direction: '방향 불명확', severity: '높음', questionNumber: '14.2', sourceExcerpt: '2025년 3월쯤 경찰이 저를 조사했습니다. 정확한 날짜는 기억나지 않습니다.', translationExcerpt: 'The police detained me on March 15, 2025.', explanation: '원문은 날짜가 불확실하고 조사라고 했지만 영어본은 특정 날짜의 구금으로 바뀌었습니다.' },
        { type: '원문에 없는 내용 추가', direction: '유리하게 강화', severity: '높음', questionNumber: '14.2', sourceExcerpt: '무기를 보지는 못했습니다.', translationExcerpt: 'He threatened me with a gun.', explanation: '원문에는 무기를 보지 못했다고 했지만 영어본에는 총을 사용한 위협이 추가되었습니다.' },
      ],
    });
    setReconfirmationViews([
      { englishMeaning: '경찰이 2025년 3월 15일에 저를 구금했습니다.', explanation: '원문은 날짜가 불확실하고 조사라고 했지만 영어본은 특정 날짜의 구금으로 바뀌었습니다.' },
      { englishMeaning: '그가 총으로 저를 위협했습니다.', explanation: '원문에는 무기를 보지 못했다고 했지만 영어본에는 총을 사용한 위협이 추가되었습니다.' },
    ]);
    setReconfirmationDecisions({});
    setReconfirmationIndex(0);
    setIsReconfirmationDemo(true);
    setError('');
    setStage('reconfirm');
  }

  async function showReconfirmation(result: VerificationReport) {
    setIsReconfirmationDemo(false);
    setReport(result);
    setReconfirmationDecisions({});
    setReconfirmationIndex(0);
    if (!result.items.length) {
      setStage('report');
      return;
    }
    setStage('preparing-reconfirmation');
    const views = await prepareReconfirmation(result.items, language.code, model, translateTexts);
    setReconfirmationViews(views);
    setStage('reconfirm');
  }

  async function runVerification() {
    setError('');
    setStage('verifying');
    try {
      const result = await verifyTranslation(model, language.code, sourceText, englishText);
      await showReconfirmation(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검증 중 오류가 발생했습니다.');
      setStage('redact');
    }
  }

  function editSourceForDifference() {
    const target = stepForQuestion(currentDifference?.questionNumber);
    if (!target) return;
    setReport(null);
    setReconfirmationViews([]);
    setReconfirmationDecisions({});
    setStepId(target);
    if (target === '14.2' && guidedEnabled) {
      setGuidedPromptIndex(0);
      setStage('fact-review');
    } else {
      setStage('writing');
    }
  }

  function restart() {
    setStage('setup');
    setStepId(applicationSteps[0].id);
    setAnswers({});
    setGuidedAnswers({});
    setGuidedPromptIndex(0);
    setGuidedEnabled(true);
    setGuidedConfirmed(false);
    setDrafts([]);
    setSourceText('');
    setEnglishText('');
    setReport(null);
    setReconfirmationViews([]);
    setReconfirmationDecisions({});
    setReconfirmationIndex(0);
    setIsReconfirmationDemo(false);
    setError('');
  }

  const stageIndex = stage === 'setup' ? 0 : stage === 'writing' || stage === 'fact-review' || stage === 'translating' ? 1 : stage === 'review' ? 2 : 3;

  return (
    <main className="app-shell">
      <header className="brand"><span className="brand-mark">D</span><div><strong>DARI</strong><small>난민인정신청서 작성 지원 MVP</small></div></header>
      <section className="progress" aria-label="진행 단계">
        {['언어 선택', '문항 작성', '번역 검토', '검증'].map((label, index) => <span key={label} className={index <= stageIndex ? 'active' : ''}>{label}</span>)}
      </section>

      {error && <p className="notice error" role="alert">{error}{stage === 'redact' ? ` 검증 서버 주소: ${API_URL}` : ''}</p>}

      {stage === 'setup' && <section className="card">
        <p className="eyebrow">1단계 · 작성 언어와 검증 모델</p>
        <h1>신청서 문항을 모두 작성한 뒤 번역합니다.</h1>
        <p>문항은 선택한 언어로 보여 주고, 바로 아래에 서식의 영어를 둡니다. 답변도 그 언어로 적습니다. 작성이 끝나면 자유 서술을 한 번에 영어와 한국어로 번역하고, 그 원문과 영어본을 한 번에 검증합니다.</p>
        <p className="notice">접수번호처럼 공무원이 적는 칸과 자필 서명은 빠져 있습니다. 예·아니요와 날짜는 공식 표기를 쓰고, 번역 모델에는 보내지 않습니다. 법률 자문이나 신청 결과를 보장하지 않습니다.</p>
        {isOnDeviceTranslationAvailable()
          ? <p className="notice">번역은 기기에 받은 ML Kit으로 처리합니다. 아래 모델은 검증에만 사용합니다.</p>
          : <p className="notice">브라우저 미리보기에서는 로컬 서버로 번역합니다. Android·iOS 앱에서는 ML Kit을 사용합니다.</p>}
        <label>답변 언어<select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}>{languages.map((item) => <option value={item.code} key={item.code}>{item.label} · {item.answerLabel}</option>)}</select></label>
        {language.code === 'ko' && <p className="notice">한국어는 화면 흐름 확인용입니다. 실제 지원 언어 선정이나 문항 번역 검수를 대신하지 않습니다.</p>}
        <label>{isOnDeviceTranslationAvailable() ? '검증 모델' : '번역·검증 모델'}<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.model} key={item.model}>{item.name} · {item.detail}</option>)}</select></label>
        <button onClick={() => { setError(''); setStage('writing'); }}>문항 작성 시작</button>
        <button className="secondary" onClick={startKoreanGuidedDemo}>한국어로 14.2 흐름 바로 테스트</button>
        <button className="secondary" onClick={startKoreanReconfirmationDemo}>한국어 재확인 가상 사례 테스트</button>
        <button className="secondary" onClick={startRussianDemo}>러시아어 예시로 채우고 번역</button>
        <p className="hint">{demoScenarioNotice} 모든 기본 문항을 채우고, 조건부 문항은 하나의 일관된 예시 경로로 채웁니다.</p>
      </section>}

      {stage === 'writing' && <section className="card">
        <p className="eyebrow" lang={language.code} dir={writingDirection}>{localize(language.code, step.sectionKo)} · {stepIndex + 1} / {applicationSteps.length}</p>
        <label className="jump">문항 이동
          <select value={step.id} onChange={(event) => setStepId(event.target.value)}>
            {groups.map((group) => <optgroup label={localize(language.code, group.section)} key={group.section}>{group.steps.map((item) => <option value={item.id} key={item.id}>{localize(language.code, item.titleKo)}</option>)}</optgroup>)}
          </select>
        </label>
        <h1 lang={language.code} dir={writingDirection}>{localize(language.code, step.titleKo)}</h1>
        <p className={writingDirection === 'rtl' ? 'question-guide align-end' : 'question-guide'}>{step.titleEn}</p>
        {step.noteKo && <>
          <p className="notice" lang={language.code} dir={writingDirection}>{localize(language.code, step.noteKo)}</p>
          {step.noteEn && <p className={writingDirection === 'rtl' ? 'question-guide align-end' : 'question-guide'}>{step.noteEn}</p>}
        </>}
        {step.fields.filter((field) => isVisible(field, answers) && !isGuidedPastHarm).map((field) => (
          <FieldEditor key={field.id} field={field} languageCode={language.code} answer={answers[field.id]} notApplicable={language.notApplicable} dir={writingDirection} onChange={(answer) => updateAnswer(field.id, answer)} />
        ))}
        {isGuidedPastHarm && <div className="chat-flow" lang={language.code} dir={writingDirection}>
          <div className="chat-thread" ref={chatThreadRef} aria-live="polite">
            <p className="chat-bubble bot">{guidedText(guidedCopy.intro, language.code)}</p>
            <p className="chat-bubble bot">{localize(language.code, step.fields[0].ko)}</p>
            {pastHarmChoice && <p className="chat-bubble user">{localize(language.code, pastHarmChoice === 'yes' ? '예' : '아니요')}</p>}
            {pastHarmChoice === 'yes' && guidedPastHarmPrompts.slice(0, guidedPromptIndex).map((prompt) => {
              const answer = guidedAnswers[prompt.id];
              return <div className="chat-exchange" key={prompt.id}>
                <p className="chat-bubble bot">{guidedText(prompt.question, language.code)}</p>
                <p className="chat-bubble user">{answer?.status === 'skipped' ? guidedText(guidedCopy.skipped, language.code) : answer?.status === 'uncertain' ? `${guidedText(guidedCopy.uncertain, language.code)}${answer.text.trim() ? `: ${answer.text.trim()}` : ''}` : answer?.text.trim()}</p>
              </div>;
            })}
            {pastHarmChoice === 'yes' && <p className="chat-bubble bot current">{guidedText(currentGuidedPrompt.question, language.code)}</p>}
          </div>
          {!pastHarmChoice && <div className="chat-quick-replies" role="group" aria-label={localize(language.code, step.fields[0].ko)}>
            <button type="button" onClick={() => choosePastHarm('yes')}>{localize(language.code, '예')}</button>
            <button type="button" className="secondary" onClick={() => choosePastHarm('no')}>{localize(language.code, '아니요')}</button>
          </div>}
          {pastHarmChoice && <button type="button" className="tiny chat-change" onClick={() => updateAnswer('14.2', { kind: 'choice', values: [] })}>{guidedText(guidedCopy.changeChoice, language.code)}</button>}
          {pastHarmChoice === 'yes' && <div className="chat-composer">
            <p className="chat-count">{guidedPromptIndex + 1} / {guidedPastHarmPrompts.length}</p>
            <div className="guided-status" role="group" aria-label={guidedText(currentGuidedPrompt.question, language.code)}>
              {(['answered', 'uncertain', 'skipped'] as GuidedStatus[]).map((status) => <button type="button" key={status} className={currentGuidedAnswer.status === status ? 'selected' : ''} aria-pressed={currentGuidedAnswer.status === status} onClick={() => updateGuidedAnswer(currentGuidedPrompt.id, { status, text: status === 'skipped' ? '' : currentGuidedAnswer.text })}>{guidedText(guidedCopy[status], language.code)}</button>)}
            </div>
            {currentGuidedAnswer.status !== 'skipped' && <textarea aria-label={guidedText(currentGuidedPrompt.question, language.code)} rows={4} lang={language.code} dir={writingDirection} value={currentGuidedAnswer.text} placeholder={guidedText(guidedCopy.placeholder, language.code)} onChange={(event) => updateGuidedAnswer(currentGuidedPrompt.id, { text: event.target.value, status: currentGuidedAnswer.status === 'unanswered' ? 'answered' : currentGuidedAnswer.status })} />}
            <div className="actions chat-actions">
              <button className="secondary" type="button" onClick={() => guidedPromptIndex ? setGuidedPromptIndex((current) => current - 1) : updateAnswer('14.2', { kind: 'choice', values: [] })}>{guidedText(guidedCopy.previous, language.code)}</button>
              <button type="button" disabled={currentGuidedAnswer.status !== 'skipped' && currentGuidedAnswer.status !== 'uncertain' && !currentGuidedAnswer.text.trim()} onClick={advanceGuidedPrompt}>{guidedText(guidedPromptIndex === guidedPastHarmPrompts.length - 1 ? guidedCopy.reviewFacts : guidedCopy.nextQuestion, language.code)}</button>
            </div>
          </div>}
          {pastHarmChoice === 'no' && <div className="actions chat-actions"><button className="secondary" onClick={() => setStepId(applicationSteps[stepIndex - 1].id)}>이전 문항</button><button onClick={() => setStepId(applicationSteps[stepIndex + 1].id)}>다음 문항</button></div>}
          {!pastHarmChoice && <button type="button" className="tiny" onClick={() => setStepId(applicationSteps[stepIndex - 1].id)}>이전 문항</button>}
          <p className="hint">대화형 질문은 작성 보조용입니다. 공식 14.2 문항의 뜻과 문구는 전문가 검수 전입니다.</p>
          <button type="button" className="tiny" onClick={() => { setGuidedEnabled(false); setGuidedConfirmed(false); }}>긴 글로 직접 작성</button>
        </div>}
        {step.id === '14.2' && !guidedEnabled && <button type="button" className="tiny" onClick={() => { setGuidedEnabled(true); setGuidedConfirmed(false); updateAnswer('14.2-detail', { kind: 'text', text: '' }); }}>대화형 질문으로 작성</button>}
        {!isGuidedPastHarm && <div className="actions sticky">
          <button className="secondary" disabled={stepIndex === 0} onClick={() => setStepId(applicationSteps[stepIndex - 1].id)}>이전</button>
          {stepIndex < applicationSteps.length - 1
            ? <button onClick={() => setStepId(applicationSteps[stepIndex + 1].id)}>다음 문항</button>
            : <button onClick={() => void finishWriting()}>작성 완료 후 한 번에 번역</button>}
        </div>}
      </section>}

      {stage === 'fact-review' && <section className="card">
        <p className="eyebrow">14.2 · 작성 내용 확인</p>
        <h1 lang={language.code} dir={writingDirection}>{guidedText(guidedCopy.reviewTitle, language.code)}</h1>
        <p lang={language.code} dir={writingDirection}>{guidedText(guidedCopy.reviewIntro, language.code)}</p>
        <div className="fact-cards">{guidedPastHarmPrompts.map((prompt) => {
          const answer = guidedAnswers[prompt.id] ?? { status: 'unanswered' as GuidedStatus, text: '' };
          return <article className="fact-card" key={prompt.id}>
            <h2 lang={language.code} dir={writingDirection}>{guidedText(prompt.label, language.code)}</h2>
            <p className="fact-status">{answer.status === 'uncertain' ? guidedText(guidedCopy.uncertain, language.code) : answer.status === 'skipped' ? guidedText(guidedCopy.skipped, language.code) : answer.text.trim() ? guidedText(guidedCopy.answered, language.code) : guidedText(guidedCopy.missing, language.code)}</p>
            {answer.status !== 'skipped' && <textarea rows={3} lang={language.code} dir={writingDirection} value={answer.text} onChange={(event) => updateGuidedAnswer(prompt.id, { text: event.target.value, status: answer.status === 'unanswered' ? 'answered' : answer.status })} />}
          </article>;
        })}</div>
        <h2 lang={language.code} dir={writingDirection}>{guidedText(guidedCopy.draftTitle, language.code)}</h2>
        <p className="source-draft" lang={language.code} dir={writingDirection}>{guidedSourceDraft(guidedAnswers, language.code) || guidedText(guidedCopy.missing, language.code)}</p>
        <p className="notice" lang={language.code} dir={writingDirection}>{guidedText(guidedCopy.reviewNotice, language.code)}</p>
        <div className="actions"><button className="secondary" onClick={() => setStage('writing')}>{guidedText(guidedCopy.back, language.code)}</button><button onClick={confirmGuidedAnswers}>{guidedText(guidedCopy.confirm, language.code)}</button></div>
      </section>}

      {stage === 'translating' && <section className="card centered">
        <div className="spinner" />
        <h1>작성한 답변을 한 번에 번역하고 있습니다.</h1>
        <p>{progress.total ? `${progress.done} / ${progress.total}` : '번역할 서술을 확인하고 있습니다.'}</p>
        {progress.label && <p>{progress.label}</p>}
        <p>선택 언어로 적은 자유 서술을 영어 초안으로 만든 뒤, 그 영어본을 한국어 참고본으로 다시 옮깁니다.</p>
      </section>}

      {stage === 'review' && <section className="card">
        <p className="eyebrow">2단계 · 최종 번역본 검토</p>
        <h1>원문과 영어·한국어 초안을 함께 확인해 주세요.</h1>
        <p>선택형 답변과 날짜·번호는 공식 한국어·영어 표기입니다. 자유 서술만 모델이 번역했습니다.</p>
        {drafts.length === 0 && <p className="notice">저장된 답변이 없습니다. 문항으로 돌아가 입력해 주세요.</p>}
        {drafts.map((item) => <article className="draft" key={item.questionNumber}><h2>{item.questionNumber}. {item.questionKorean}</h2><div><b>{item.verify ? `원문 (${language.answerLabel})` : '선택·기재'}</b><p lang={item.verify ? language.code : 'ko'}>{item.source}</p></div><div><b>English</b><p>{item.english}</p></div><div><b>한국어</b><p>{item.korean}</p></div></article>)}
        <div className="actions">
          <button className="secondary" onClick={() => setStage('writing')}>답변 수정</button>
          <button onClick={() => setStage('redact')} disabled={!narrative.length}>번역 왜곡 검증하기</button>
        </div>
        {!narrative.length && <p className="notice">검증할 자유 서술이 없습니다. 선택형 답변과 날짜는 모델 번역을 거치지 않습니다.</p>}
      </section>}

      {stage === 'redact' && <section className="card">
        <p className="eyebrow">3단계 · 검증 전 확인</p>
        <h1>자유 서술만 한 번에 검증합니다.</h1>
        <p>아래 원문과 영어 초안만 전송됩니다. 이메일과 전화번호 형태는 자동으로 가려져 있습니다. 이름, 주소, 여권번호처럼 남은 개인정보는 보내기 전에 직접 지우세요.</p>
        <label>원문<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={10} /></label>
        <label>English<textarea value={englishText} onChange={(event) => setEnglishText(event.target.value)} rows={10} /></label>
        <p className="notice">검증 모델은 번역이 과장·완화·생략·추가되었는지 찾도록 설정됩니다. 결과는 참고용이며, 전문 번역 또는 법률 검토를 대체하지 않습니다.</p>
        <div className="actions">
          <button className="secondary" onClick={() => setStage('review')}>번역본으로 돌아가기</button>
          <button onClick={runVerification} disabled={!sourceText.trim() || !englishText.trim()}>내용 검증 실행</button>
        </div>
      </section>}

      {stage === 'verifying' && <section className="card centered"><div className="spinner" /><h1>번역 왜곡을 한 번에 검토하고 있습니다.</h1><p>문항마다 따로 검증하지 않고, 자유 서술 전체를 비교합니다.</p></section>}

      {stage === 'preparing-reconfirmation' && <section className="card centered"><div className="spinner" /><h1>확인할 차이를 작성 언어로 옮기고 있습니다.</h1><p>영어 문장의 참고 번역과 검출 설명을 준비합니다. 참고 번역만으로 일치 여부를 판단하지는 않습니다.</p></section>}

      {stage === 'reconfirm' && report && currentDifference && <section className="card">
        <p className="eyebrow">{reconfirmationIndex + 1} / {report.items.length}</p>
        <h1 lang={language.code} dir={writingDirection}>{reconfirmationText('title', language.code)}</h1>
        <div className="chat-thread reconfirm-thread" lang={language.code} dir={writingDirection}>
          <p className="chat-bubble bot">{reconfirmationText(isReconfirmationDemo ? 'demoIntro' : 'intro', language.code)}</p>
          <p className="chat-bubble bot"><b>{reconfirmationText('source', language.code)}</b><br />{currentDifference.sourceExcerpt || reconfirmationText('noExcerpt', language.code)}</p>
          <p className="chat-bubble bot"><b>{reconfirmationText('english', language.code)}</b><br /><span lang="en" dir="ltr">{currentDifference.translationExcerpt || reconfirmationText('noExcerpt', language.code)}</span></p>
          <p className="chat-bubble bot"><b>{reconfirmationText('meaning', language.code)}</b><br />{currentReconfirmation?.englishMeaning || reconfirmationText('unavailable', language.code)}</p>
          {currentReconfirmation?.explanation && <p className="chat-bubble bot"><b>{reconfirmationText('explanation', language.code)}</b><br />{currentReconfirmation.explanation}</p>}
          <p className="chat-bubble bot current">{reconfirmationText('question', language.code)}</p>
          {reconfirmationDecisions[reconfirmationIndex] && <p className="chat-bubble user">{reconfirmationText(reconfirmationDecisions[reconfirmationIndex], language.code)}</p>}
        </div>
        <p className="notice" lang={language.code} dir={writingDirection}>{currentReconfirmation?.englishMeaning && currentReconfirmation.explanation ? reconfirmationText('caution', language.code) : reconfirmationText('unavailable', language.code)}</p>
        <div className="reconfirm-choices" role="group" aria-label={reconfirmationText('question', language.code)}>
          {(['matches', 'needs_edit', 'unknown'] as ReconfirmationDecision[]).map((decision) => <button type="button" key={decision} className={reconfirmationDecisions[reconfirmationIndex] === decision ? 'selected' : ''} aria-pressed={reconfirmationDecisions[reconfirmationIndex] === decision} disabled={decision === 'matches' && (!currentReconfirmation?.englishMeaning || !currentReconfirmation.explanation || !currentDifference.sourceExcerpt)} onClick={() => setReconfirmationDecisions((current) => ({ ...current, [reconfirmationIndex]: decision }))}>{reconfirmationText(decision, language.code)}</button>)}
        </div>
        {reconfirmationDecisions[reconfirmationIndex] === 'needs_edit' && <div className="reconfirm-edit"><p lang={language.code} dir={writingDirection}>{reconfirmationText('editNotice', language.code)}</p>{stepForQuestion(currentDifference.questionNumber) && <button type="button" className="secondary" onClick={editSourceForDifference}>{reconfirmationText('editSource', language.code)}</button>}</div>}
        <div className="actions">
          <button className="secondary" disabled={reconfirmationIndex === 0} onClick={() => setReconfirmationIndex((current) => current - 1)}>{reconfirmationText('previous', language.code)}</button>
          <button disabled={!reconfirmationDecisions[reconfirmationIndex]} onClick={() => reconfirmationIndex === report.items.length - 1 ? setStage('report') : setReconfirmationIndex((current) => current + 1)}>{reconfirmationText(reconfirmationIndex === report.items.length - 1 ? 'finish' : 'next', language.code)}</button>
        </div>
      </section>}

      {stage === 'report' && report && <section className="card">
        <p className="eyebrow">검증 결과</p>
        <h1>{report.hasDistortion ? '확인이 필요한 번역 차이가 있습니다.' : '명확한 왜곡 신호가 발견되지 않았습니다.'}</h1>
        <p>{report.summary}</p>
        {report.items.length > 0 ? <div className="findings">{report.items.map((item, index) => <article className="finding" key={`${item.type}-${index}`}><div className="finding-top"><strong>{item.type}</strong><span>{item.direction} · {item.severity}</span></div>{item.questionNumber && <small>문항 {item.questionNumber}</small>}<p><b>원문:</b> {item.sourceExcerpt}</p><p><b>영어 초안:</b> {item.translationExcerpt}</p><p>{item.explanation}</p><p><b>신청자 재확인:</b> {reconfirmationDecisions[index] ? reconfirmationText(reconfirmationDecisions[index], language.code) : '미확인'}</p></article>)}</div> : <p className="notice">모델이 판단하지 못한 차이가 있을 수 있으므로 원문과 번역문을 직접 검토해 주세요.</p>}
        {report.limitations?.length ? <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        {report.items.length > 0 && <button className="secondary" onClick={() => { setReconfirmationIndex(0); setStage('reconfirm'); }}>재확인 답변 다시 보기</button>}
        <button onClick={restart}>새 신청서 작성</button>
      </section>}
      <footer>웹 기반 프로토타입 · 기기 번역은 ML Kit, 브라우저 미리보기와 검증은 로컬 서버를 사용합니다. 선택 언어 문항은 전문가 검수 전입니다.</footer>
    </main>
  );
}

function FieldEditor({
  field, languageCode, answer, notApplicable, dir, onChange,
}: {
  field: FormField;
  languageCode: string;
  answer: FieldAnswer | undefined;
  notApplicable: string;
  dir: 'rtl' | 'ltr';
  onChange: (answer: FieldAnswer) => void;
}) {
  const selected = answer?.kind === 'choice' ? answer.values : [];
  const question = localize(languageCode, field.ko);
  const guideClass = dir === 'rtl' ? 'question-guide align-end' : 'question-guide';
  const choiceClass = (on: boolean) => ['choice', on ? 'on' : '', dir === 'rtl' ? 'align-end' : ''].filter(Boolean).join(' ');
  return (
    <div className="field-block">
      <p className="field-label" lang={languageCode} dir={dir}>{field.id}. {question}</p>
      <p className={guideClass}>{field.en}</p>
      {field.hintKo && <p className="hint" lang={languageCode} dir={dir}>{localize(languageCode, field.hintKo)}</p>}
      {field.hintEn && <p className={guideClass}>{field.hintEn}</p>}
      {(field.type === 'single' || field.type === 'multi') && (
        <div className="choices" role="group" aria-label={question}>
          {field.options?.map((option) => {
            const on = selected.includes(option.value);
            return (
              <button type="button" key={option.value} className={choiceClass(on)} aria-pressed={on} onClick={() => onChange({ kind: 'choice', values: nextChoice(field.type, selected, option.value) })}>
                <span lang={languageCode} dir={dir}>{localize(languageCode, option.ko)}</span>
                <small>{option.en}</small>
              </button>
            );
          })}
        </div>
      )}
      {(field.type === 'short' || field.type === 'date') && (
        <input dir={dir} value={answer?.kind === 'text' ? answer.text : ''} placeholder={field.type === 'date' ? 'yyyy/mm/dd' : undefined} onChange={(event) => onChange({ kind: 'text', text: event.target.value })} />
      )}
      {field.type === 'long' && (
        <textarea dir={dir} rows={8} value={answer?.kind === 'text' ? answer.text : ''} onChange={(event) => onChange({ kind: 'text', text: event.target.value })} />
      )}
      {(field.type === 'short' || field.type === 'long') && (
        <button type="button" className="tiny" onClick={() => onChange({ kind: 'text', text: notApplicable })}>해당 없음</button>
      )}
      {field.type === 'table' && field.columns && (
        <TableEditor columns={field.columns} languageCode={languageCode} rows={answer?.kind === 'table' && answer.rows.length ? answer.rows : [{}]} dir={dir} onChange={(rows) => onChange({ kind: 'table', rows })} />
      )}
    </div>
  );
}

function nextChoice(type: FormField['type'], selected: string[], value: string) {
  if (type === 'multi') return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
  return selected.length === 1 && selected[0] === value ? [] : [value];
}

function TableEditor({
  columns, languageCode, rows, dir, onChange,
}: {
  columns: NonNullable<FormField['columns']>;
  languageCode: string;
  rows: Record<string, string>[];
  dir: 'rtl' | 'ltr';
  onChange: (rows: Record<string, string>[]) => void;
}) {
  function update(rowIndex: number, columnId: string, value: string) {
    onChange(rows.map((row, index) => index === rowIndex ? { ...row, [columnId]: value } : row));
  }
  return (
    <div className="tables">
      {rows.map((row, rowIndex) => (
        <div className="table-row" key={rowIndex}>
          <div className="table-row-top"><strong>{rowIndex + 1}</strong><button type="button" className="tiny" onClick={() => onChange(rows.length === 1 ? [{}] : rows.filter((_, index) => index !== rowIndex))}>행 삭제</button></div>
          {columns.map((column) => (
            <label key={column.id} className={dir === 'rtl' ? 'align-end' : undefined}><span lang={languageCode} dir={dir}>{localize(languageCode, column.ko)}</span><small>{column.en}</small>
              <input dir={dir} value={row[column.id] ?? ''} placeholder={column.kind === 'date' ? 'yyyy/mm/dd' : ''} onChange={(event) => update(rowIndex, column.id, event.target.value)} />
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...rows, {}])}>행 추가</button>
    </div>
  );
}

export default App;
