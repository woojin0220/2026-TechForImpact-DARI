import { dummyFormAnswers, formSteps, isFieldVisible, requirementsById, type FormAnswers, type FormValue } from './intake';
import type { FormField } from './form/schema';
import { hasQuestionPhrase, localize } from './form/localize';
import type { ScriptedCopy } from './intakeCopy';
import { samePrompt } from './form/presentation';

// Development builds, or a build made with VITE_DARI_DEV_TOOLS=true, show test helpers.
export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_DARI_DEV_TOOLS === 'true';

function text(language: string, ko: string, en: string) {
  if (language === 'ko') return ko;
  if (language === 'en') return en;
  return hasQuestionPhrase(ko) ? localize(language, ko) : en;
}

export function formPageOf(requirementId: string): number {
  const fieldId = requirementsById.get(requirementId)?.parentId ?? requirementId;
  return Math.max(0, formSteps.findIndex(step => step.fields.some(field => field.id === fieldId)));
}

type Props = {
  language: string;
  answers: FormAnswers;
  page: number;
  copy: ScriptedCopy;
  back: string;
  next: string;
  onChange: (answers: FormAnswers) => void;
  onPage: (page: number) => void;
  onDone: () => void;
};

export function FormStage({ language, answers, page, copy, back, next, onChange, onPage, onDone }: Props) {
  const step = formSteps[page];
  const last = page === formSteps.length - 1;
  const title = text(language, step.titleKo, step.titleEn);
  const visibleFields = step.fields.filter(field => isFieldVisible(field, answers));
  const set = (id: string, value: FormValue | undefined) => {
    const updated = { ...answers };
    if (value) updated[id] = value; else delete updated[id];
    onChange(updated);
  };
  return <div className="form-stage">
    <div className="form-head">
      <span>{text(language, step.sectionKo, step.sectionEn)}</span>
      <span dir="ltr">{page + 1} / {formSteps.length}</span>
    </div>
    <div className="form-progress" aria-hidden="true"><span style={{ width: `${100 * (page + 1) / formSteps.length}%` }} /></div>
    {DEV_TOOLS && <button className="quiet dev-fill" onClick={() => onChange(dummyFormAnswers())}>개발용 · 더미 데이터로 자동 채우기</button>}
    <section className="panel form-card" key={step.id}>
      <h2>{title}</h2>
      {visibleFields.map(field =>
        <FieldInput key={field.id} field={field} language={language} value={answers[field.id]} copy={copy} showLabel={!samePrompt(title, text(language, field.ko, field.en))} onChange={value => set(field.id, value)} />)}
    </section>
    <div className="form-nav">
      <button className="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>{back}</button>
      <button className="primary" onClick={() => last ? onDone() : onPage(page + 1)}>{last ? copy.toConversation : next}<span aria-hidden="true">→</span></button>
    </div>
  </div>;
}

export function FieldInput({ field, language, value, copy, onChange, showStatus = true, showLabel = true }: { field: FormField; language: string; value?: FormValue; copy: ScriptedCopy; onChange: (value: FormValue | undefined) => void; showStatus?: boolean; showLabel?: boolean }) {
  const label = text(language, field.ko, field.en);
  const selected = value?.kind === 'choice' ? value.values : [];
  const status = value?.kind === 'status' ? value.status : undefined;
  const toggleStatus = (next: 'unknown' | 'not_applicable') => onChange(status === next ? undefined : { kind: 'status', status: next });
  return <div className="form-field">
    {showLabel && <p className="form-label">{label}</p>}
    {(field.type === 'single' || field.type === 'multi') && <div className="choice-list" role="group" aria-label={label}>
      {field.options?.map(option => {
        const on = selected.includes(option.value);
        const values = field.type === 'multi' ? (on ? selected.filter(item => item !== option.value) : [...selected, option.value]) : (on ? [] : [option.value]);
        return <button key={option.value} aria-pressed={on} onClick={() => onChange(values.length ? { kind: 'choice', values } : undefined)}>{text(language, option.ko, option.en)}</button>;
      })}
    </div>}
    {(field.type === 'short' || field.type === 'date') && <input dir="auto" value={value?.kind === 'text' ? value.text : ''} placeholder={field.type === 'date' ? 'yyyy/mm/dd' : ''} aria-label={label}
      onChange={event => onChange(event.target.value ? { kind: 'text', text: event.target.value } : undefined)} />}
    {field.type === 'long' && <textarea dir="auto" rows={4} value={value?.kind === 'text' ? value.text : ''} aria-label={label}
      onChange={event => onChange(event.target.value ? { kind: 'text', text: event.target.value } : undefined)} />}
    {field.type === 'table' && <TableInput field={field} language={language} value={value} copy={copy} onChange={onChange} />}
    {showStatus && field.type !== 'table' && <div className="status-toggles">
      <button className="quiet" aria-pressed={status === 'unknown'} onClick={() => toggleStatus('unknown')}>{copy.unknown}</button>
      <button className="quiet" aria-pressed={status === 'not_applicable'} onClick={() => toggleStatus('not_applicable')}>{copy.notApplicable}</button>
    </div>}
  </div>;
}

function TableInput({ field, language, value, copy, onChange }: { field: FormField; language: string; value?: FormValue; copy: ScriptedCopy; onChange: (value: FormValue | undefined) => void }) {
  const none = value?.kind === 'table' && value.rows.length === 0;
  const rows = value?.kind === 'table' && value.rows.length ? value.rows : [{}];
  const update = (next: Record<string, string>[]) => onChange({ kind: 'table', rows: next });
  return <div className="table-input">
    <label className="check-row"><input type="checkbox" checked={none} onChange={event => onChange(event.target.checked ? { kind: 'table', rows: [] } : undefined)} />{copy.tableNone}</label>
    {!none && <>
      {rows.map((row, index) => <div className="table-entry" key={index}>
        <div className="table-entry-head"><b>{copy.row.replace('{n}', String(index + 1))}</b>{rows.length > 1 && <button className="quiet" onClick={() => update(rows.filter((_, item) => item !== index))}>{copy.removeRow}</button>}</div>
        {field.columns?.map(column => <label key={column.id}>{text(language, column.ko, column.en)}
          <input dir="auto" value={row[column.id] ?? ''} placeholder={column.kind === 'date' ? 'yyyy/mm/dd' : ''}
            onChange={event => update(rows.map((item, rowIndex) => rowIndex === index ? { ...item, [column.id]: event.target.value } : item))} /></label>)}
      </div>)}
      <button className="secondary" onClick={() => update([...rows, {}])}>{copy.addRow}</button>
    </>}
  </div>;
}
