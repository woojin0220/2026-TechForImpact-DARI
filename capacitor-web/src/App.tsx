import { useMemo, useState } from 'react';
import { API_URL, isOnDeviceTranslationAvailable, verifyTranslation } from './lib/api';
import { applicationSteps, type FormField } from './form/schema';
import { localize } from './form/localize';
import { buildReview, isVisible } from './form/model';
import { translateAnswers } from './form/translateAnswers';
import type { Answers, DraftEntry, FieldAnswer, LanguageOption, VerificationModel, VerificationReport } from './types';

const languages: LanguageOption[] = [
  { code: 'ru', label: 'Русский', answerLabel: '러시아어', notApplicable: 'не применимо' },
  { code: 'ar', label: 'العربية', answerLabel: '아랍어', notApplicable: 'غير منطبق' },
  { code: 'fr', label: 'Français', answerLabel: '프랑스어', notApplicable: 'non applicable' },
  { code: 'fa', label: 'فارسی', answerLabel: '페르시아어', notApplicable: 'قابل اعمال نیست' },
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
  const [stepId, setStepId] = useState(applicationSteps[0].id);
  const [answers, setAnswers] = useState<Answers>({});
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [error, setError] = useState('');

  const language = languages.find((item) => item.code === languageCode) ?? languages[0];
  const stepIndex = Math.max(0, applicationSteps.findIndex((item) => item.id === stepId));
  const step = applicationSteps[stepIndex] ?? applicationSteps[0];
  const narrative = drafts.filter((item) => item.verify);
  const writingDirection = language.code === 'ar' || language.code === 'fa' ? 'rtl' : 'ltr';

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
    setAnswers((current) => ({ ...current, [fieldId]: answer }));
  }

  async function finishWriting() {
    setError('');
    setStage('translating');
    setProgress({ done: 0, total: 0, label: '' });
    try {
      const rendered = await translateAnswers(model, language.code, language.notApplicable, answers, (done, total, label) => {
        setProgress({ done, total, label });
      });
      const nextDrafts = buildReview(answers, rendered);
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

  async function runVerification() {
    setError('');
    setStage('verifying');
    try {
      const result = await verifyTranslation(model, language.code, sourceText, englishText);
      setReport(result);
      setStage('report');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '검증 중 오류가 발생했습니다.');
      setStage('redact');
    }
  }

  function restart() {
    setStage('setup');
    setStepId(applicationSteps[0].id);
    setAnswers({});
    setDrafts([]);
    setSourceText('');
    setEnglishText('');
    setReport(null);
    setError('');
  }

  const stageIndex = stage === 'setup' ? 0 : stage === 'writing' || stage === 'translating' ? 1 : stage === 'review' ? 2 : 3;

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
        <label>{isOnDeviceTranslationAvailable() ? '검증 모델' : '번역·검증 모델'}<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.model} key={item.model}>{item.name} · {item.detail}</option>)}</select></label>
        <button onClick={() => { setError(''); setStage('writing'); }}>문항 작성 시작</button>
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
        {step.fields.filter((field) => isVisible(field, answers)).map((field) => (
          <FieldEditor key={field.id} field={field} languageCode={language.code} answer={answers[field.id]} notApplicable={language.notApplicable} dir={writingDirection} onChange={(answer) => updateAnswer(field.id, answer)} />
        ))}
        <div className="actions sticky">
          <button className="secondary" disabled={stepIndex === 0} onClick={() => setStepId(applicationSteps[stepIndex - 1].id)}>이전</button>
          {stepIndex < applicationSteps.length - 1
            ? <button onClick={() => setStepId(applicationSteps[stepIndex + 1].id)}>다음 문항</button>
            : <button onClick={finishWriting}>작성 완료 후 한 번에 번역</button>}
        </div>
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

      {stage === 'report' && report && <section className="card">
        <p className="eyebrow">검증 결과</p>
        <h1>{report.hasDistortion ? '확인이 필요한 번역 차이가 있습니다.' : '명확한 왜곡 신호가 발견되지 않았습니다.'}</h1>
        <p>{report.summary}</p>
        {report.items.length > 0 ? <div className="findings">{report.items.map((item, index) => <article className="finding" key={`${item.type}-${index}`}><div className="finding-top"><strong>{item.type}</strong><span>{item.direction} · {item.severity}</span></div>{item.questionNumber && <small>문항 {item.questionNumber}</small>}<p><b>원문:</b> {item.sourceExcerpt}</p><p><b>영어 초안:</b> {item.translationExcerpt}</p><p>{item.explanation}</p></article>)}</div> : <p className="notice">모델이 판단하지 못한 차이가 있을 수 있으므로 원문과 번역문을 직접 검토해 주세요.</p>}
        {report.limitations?.length ? <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : null}
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
