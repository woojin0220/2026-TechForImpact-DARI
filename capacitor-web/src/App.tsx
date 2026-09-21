import { useMemo, useState } from 'react';
import { API_URL, isOnDeviceTranslationAvailable, translationProvider, verifyTranslation } from './lib/api';
import type { DraftEntry, LanguageOption, VerificationModel, VerificationReport } from './types';

const languages: LanguageOption[] = [
  {
    code: 'ru', label: 'Русский', answerLabel: '러시아어',
    questions: [
      { number: '14.1', korean: '본국을 떠나게 된 경위와 귀국하기 어려운 이유를 설명해 주세요.', prompt: 'Опишите, почему вы покинули свою страну и почему вам трудно вернуться.' },
      { number: '14.2', korean: '본인에게 있었던 위협·피해와 그 시기, 장소, 관련 인물을 가능한 범위에서 적어 주세요.', prompt: 'Опишите угрозы или вред, которые вы испытали, включая время, место и связанных лиц, насколько это возможно.' },
    ],
  },
  {
    code: 'ar', label: 'العربية', answerLabel: '아랍어',
    questions: [
      { number: '14.1', korean: '본국을 떠나게 된 경위와 귀국하기 어려운 이유를 설명해 주세요.', prompt: 'اشرح لماذا غادرت بلدك ولماذا يصعب عليك العودة إليه.' },
      { number: '14.2', korean: '본인에게 있었던 위협·피해와 그 시기, 장소, 관련 인물을 가능한 범위에서 적어 주세요.', prompt: 'اشرح التهديدات أو الأذى الذي تعرضت له، مع الوقت والمكان والأشخاص ذوي الصلة قدر الإمكان.' },
    ],
  },
  {
    code: 'fr', label: 'Français', answerLabel: '프랑스어',
    questions: [
      { number: '14.1', korean: '본국을 떠나게 된 경위와 귀국하기 어려운 이유를 설명해 주세요.', prompt: 'Expliquez pourquoi vous avez quitté votre pays et pourquoi il vous est difficile d’y retourner.' },
      { number: '14.2', korean: '본인에게 있었던 위협·피해와 그 시기, 장소, 관련 인물을 가능한 범위에서 적어 주세요.', prompt: 'Décrivez les menaces ou préjudices subis, avec la période, le lieu et les personnes concernées dans la mesure du possible.' },
    ],
  },
  {
    code: 'fa', label: 'فارسی', answerLabel: '페르시아어',
    questions: [
      { number: '14.1', korean: '본국을 떠나게 된 경위와 귀국하기 어려운 이유를 설명해 주세요.', prompt: 'توضیح دهید چرا کشور خود را ترک کردید و چرا بازگشت برایتان دشوار است.' },
      { number: '14.2', korean: '본인에게 있었던 위협·피해와 그 시기, 장소, 관련 인물을 가능한 범위에서 적어 주세요.', prompt: 'تهدیدها یا آسیب‌هایی را که تجربه کرده‌اید، همراه با زمان، مکان و افراد مرتبط تا حد امکان شرح دهید.' },
    ],
  },
];

const models: VerificationModel[] = [
  { name: 'Qwen3 4B', model: 'qwen3:4b', detail: '가벼운 오픈웨이트 모델' },
  { name: 'Llama 3.2 3B', model: 'llama3.2:3b', detail: '대안 검증 모델' },
];

type Stage = 'setup' | 'writing' | 'translating' | 'review' | 'redact' | 'verifying' | 'report';

function redactForPrototype(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REMOVED]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE REMOVED]');
}

function App() {
  const [stage, setStage] = useState<Stage>('setup');
  const [languageCode, setLanguageCode] = useState('ru');
  const [model, setModel] = useState(models[0].model);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [error, setError] = useState('');

  const language = useMemo(
    () => languages.find((item) => item.code === languageCode) ?? languages[0],
    [languageCode],
  );
  const question = language.questions[questionIndex];

  async function translateCurrentAnswer() {
    if (!answer.trim()) return;
    setError('');
    setStage('translating');
    try {
      const english = await translationProvider.translate(answer.trim(), language.code, 'en');
      const korean = await translationProvider.translate(english, 'en', 'ko');
      const next = [...drafts, {
        questionNumber: question.number,
        questionKorean: question.korean,
        source: answer.trim(),
        english,
        korean,
      }];
      setDrafts(next);
      setAnswer('');
      if (questionIndex + 1 < language.questions.length) {
        setQuestionIndex(questionIndex + 1);
        setStage('writing');
      } else {
        setStage('review');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '번역 중 오류가 발생했습니다.');
      setStage('writing');
    }
  }

  async function runVerification() {
    setError('');
    setStage('verifying');
    try {
      const source = drafts.map((item) => `[${item.questionNumber}] ${item.source}`).join('\n\n');
      const english = drafts.map((item) => `[${item.questionNumber}] ${item.english}`).join('\n\n');
      const result = await verifyTranslation(model, language.code, redactForPrototype(source), redactForPrototype(english));
      setReport(result);
      setStage('report');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검증 중 오류가 발생했습니다.');
      setStage('redact');
    }
  }

  function restart() {
    setStage('setup'); setDrafts([]); setQuestionIndex(0); setAnswer(''); setReport(null); setError('');
  }

  return (
    <main className="app-shell">
      <header className="brand"><span className="brand-mark">D</span><div><strong>DARI</strong><small>난민인정신청서 작성 지원 MVP</small></div></header>
      <section className="progress" aria-label="진행 단계">
        {['언어 선택', '모국어 작성', '번역 검토', '검증'].map((label, index) => <span key={label} className={index <= (stage === 'setup' ? 0 : stage === 'writing' || stage === 'translating' ? 1 : stage === 'review' ? 2 : 3) ? 'active' : ''}>{label}</span>)}
      </section>

      {error && <p className="notice error" role="alert">{error}{stage === 'redact' ? ` 검증 서버 주소: ${API_URL}` : ''}</p>}

      {stage === 'setup' && <section className="card">
        <p className="eyebrow">1단계 · 작성 언어와 검증 모델</p>
        <h1>신청자의 언어로 답변을 작성해 주세요.</h1>
        <p>공식 문항을 선택한 언어로 제시하고, 답변을 영어와 한국어 초안으로 정리합니다. 번역은 기기에 내려받은 ML Kit 언어 모델로 처리합니다. 법률 자문이나 신청 결과를 보장하지 않습니다.</p>
        {!isOnDeviceTranslationAvailable() && <p className="notice">현재 브라우저 미리보기에서는 온디바이스 ML Kit 번역을 실행할 수 없습니다. Android 또는 iOS Capacitor 앱에서 테스트해 주세요.</p>}
        <label>답변 언어<select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}>{languages.map((item) => <option value={item.code} key={item.code}>{item.label} · {item.answerLabel}</option>)}</select></label>
        <label>검증 모델<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.model} key={item.model}>{item.name} · {item.detail}</option>)}</select></label>
        <button disabled={!isOnDeviceTranslationAvailable()} onClick={() => setStage('writing')}>문항 작성 시작</button>
      </section>}

      {stage === 'writing' && <section className="card">
        <p className="eyebrow">문항 {questionIndex + 1} / {language.questions.length} · {question.number}</p>
        <h1 lang={language.code}>{question.prompt}</h1>
        <p className="question-guide">한국어 뜻: {question.korean}</p>
        <label className="sr-only" htmlFor="answer">답변</label>
        <textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={`${language.answerLabel}로 자유롭게 작성해 주세요.`} rows={10} />
        <button disabled={!answer.trim()} onClick={translateCurrentAnswer}>영어·한국어 초안 만들기</button>
      </section>}

      {stage === 'translating' && <section className="card centered"><div className="spinner" /><h1>번역 초안을 만들고 있습니다.</h1><p>선택 언어 → 영어 → 한국어 순서로 처리합니다.</p></section>}

      {stage === 'review' && <section className="card">
        <p className="eyebrow">2단계 · 최종 번역본 검토</p><h1>원문과 영어·한국어 초안을 함께 확인해 주세요.</h1>
        {drafts.map((item) => <article className="draft" key={item.questionNumber}><h2>{item.questionNumber}. {item.questionKorean}</h2><div><b>원문 ({language.answerLabel})</b><p lang={language.code}>{item.source}</p></div><div><b>English</b><p>{item.english}</p></div><div><b>한국어</b><p>{item.korean}</p></div></article>)}
        <div className="actions"><button className="secondary" onClick={() => { setQuestionIndex(Math.max(0, language.questions.length - 1)); setStage('writing'); }}>답변 다시 작성</button><button onClick={() => setStage('redact')}>번역 왜곡 검증하기</button></div>
      </section>}

      {stage === 'redact' && <section className="card"><p className="eyebrow">3단계 · 검증 전 확인</p><h1>내용상 왜곡만 검토합니다.</h1><p>검증에는 원문과 영어 초안만 전송됩니다. 현재 MVP는 이메일과 전화번호만 자동으로 가립니다. 이름, 주소, 여권·등록번호, 정확한 날짜 등 추가 개인정보는 실제 서비스 전에 별도 정책과 기술로 다뤄야 합니다.</p><p className="notice">검증 모델은 번역이 난민 심사에 유리하거나 불리하게 과장·완화·생략·추가되었는지 찾도록 설정됩니다. 결과는 참고용이며, 전문 번역 또는 법률 검토를 대체하지 않습니다.</p><div className="actions"><button className="secondary" onClick={() => setStage('review')}>번역본으로 돌아가기</button><button onClick={runVerification}>내용 검증 실행</button></div></section>}

      {stage === 'verifying' && <section className="card centered"><div className="spinner" /><h1>번역 왜곡을 검토하고 있습니다.</h1><p>유리·불리한 왜곡, 사실 추가·생략, 강도 변화, 불확실성 변화 등을 구분합니다.</p></section>}

      {stage === 'report' && report && <section className="card"><p className="eyebrow">검증 결과</p><h1>{report.hasDistortion ? '확인이 필요한 번역 차이가 있습니다.' : '명확한 왜곡 신호가 발견되지 않았습니다.'}</h1><p>{report.summary}</p>{report.items.length > 0 ? <div className="findings">{report.items.map((item, index) => <article className="finding" key={`${item.type}-${index}`}><div className="finding-top"><strong>{item.type}</strong><span>{item.direction} · {item.severity}</span></div>{item.questionNumber && <small>문항 {item.questionNumber}</small>}<p><b>원문:</b> {item.sourceExcerpt}</p><p><b>영어 초안:</b> {item.translationExcerpt}</p><p>{item.explanation}</p></article>)}</div> : <p className="notice">모델이 판단하지 못한 차이가 있을 수 있으므로 원문과 번역문을 직접 검토해 주세요.</p>}{report.limitations?.length ? <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : null}<button onClick={restart}>새 신청서 작성</button></section>}
      <footer>웹 기반 프로토타입 · 번역은 기기 내 ML Kit 모델로 처리합니다. 검증만 개발용 로컬 서버를 사용합니다.</footer>
    </main>
  );
}

export default App;
