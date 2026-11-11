import { dummyFormAnswers, formSteps, isFieldVisible, type FormAnswers, type FormValue } from './intake';
import type { FormField } from './form/schema';
import { localizedLabel } from './form/localize';
import type { ScriptedCopy } from './intakeCopy';
import { samePrompt } from './form/presentation';
import { OTHER_OPTION, takesOtherText } from './form/otherChoice';
import { ChoiceList, withOtherText } from './ChoiceList';

// Development builds, or a build made with VITE_DARI_DEV_TOOLS=true, show test helpers.
export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_DARI_DEV_TOOLS === 'true';

function text(language: string, ko: string, en: string) {
  return localizedLabel(language, ko, en);
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
  focusField?: string;
  hiddenFieldNotice?: string;
};

export function FormStage({ language, answers, page, copy, back, next, onChange, onPage, onDone, focusField, hiddenFieldNotice }: Props) {
  const step = formSteps[page];
  const last = page === formSteps.length - 1;
  const title = text(language, step.titleKo, step.titleEn);
  const visibleFields = step.fields.filter(field => isFieldVisible(field, answers) || field.id === focusField);
  const editingHidden = step.fields.some(field => field.id === focusField && !isFieldVisible(field, answers));
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
    {DEV_TOOLS && <button className="quiet dev-fill" onClick={() => onChange(dummyFormAnswers())}>{copy.devFill}</button>}
    <section className="panel form-card" key={step.id}>
      <h2>{title}</h2>
      {editingHidden && hiddenFieldNotice && <p className="notice" role="status">{hiddenFieldNotice}</p>}
      {visibleFields.map(field =>
        <FieldInput key={field.id} field={field} language={language} value={answers[field.id]} copy={copy} showLabel={!samePrompt(title, text(language, field.ko, field.en))} onChange={value => set(field.id, value)} />)}
    </section>
    <div className="form-nav">
      <button className="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>{back}</button>
      <button className="primary" onClick={() => last ? onDone() : onPage(page + 1)}>{last ? copy.toConversation : next}<span aria-hidden="true">{['ar', 'fa'].includes(language) ? '←' : '→'}</span></button>
    </div>
  </div>;
}

export function FieldInput({ field, language, valueLanguage, value, copy, onChange, showStatus = true, showLabel = true }: { field: FormField; language: string; valueLanguage?: string; value?: FormValue; copy: ScriptedCopy; onChange: (value: FormValue | undefined) => void; showStatus?: boolean; showLabel?: boolean }) {
  const label = text(language, field.ko, field.en);
  const selected = value?.kind === 'choice' ? value.values : [];
  const other = value?.kind === 'choice' ? value.other ?? '' : '';
  const status = value?.kind === 'status' ? value.status : undefined;
  // The “기타” text belongs to the Other option: deselecting Other drops it.
  const choose = (values: string[]) => onChange(values.length ? { kind: 'choice', values, ...(values.includes(OTHER_OPTION) && other ? { other } : {}) } : undefined);
  const toggleStatus = (next: 'unknown' | 'not_applicable') => onChange(status === next ? undefined : { kind: 'status', status: next });
  return <div className="form-field" data-field-id={field.id} tabIndex={-1}>
    {showLabel && <p className="form-label">{label}</p>}
    {(field.type === 'single' || field.type === 'multi') && <ChoiceList label={label} multi={field.type === 'multi'} selected={selected}
      items={(field.options ?? []).map(option => ({ value: option.value, label: text(language, option.ko, option.en) }))}
      onToggle={value => { const on = selected.includes(value); choose(field.type === 'multi' ? (on ? selected.filter(item => item !== value) : [...selected, value]) : (on ? [] : [value])); }}
      otherValue={takesOtherText(field.id, field.options) ? OTHER_OPTION : undefined} otherText={other} otherLabel={copy.otherLabel} moreLabel={copy.moreChoices} lessLabel={copy.fewerChoices} hiddenSelectedLabel={copy.hiddenSelected}
      onOtherText={value => { const values = withOtherText(selected, OTHER_OPTION, value, field.type === 'multi'); onChange(values.length || value ? { kind: 'choice', values, ...(value ? { other: value } : {}) } : undefined); }} />}
    {(field.type === 'single' || field.type === 'multi') && selected.length > 0 && <button className="quiet clear-choice" onClick={() => onChange(undefined)}>{copy.clearChoice}</button>}
    {(field.type === 'short' || field.type === 'date') && <input lang={valueLanguage} dir={valueLanguage ? (['ar', 'fa'].includes(valueLanguage) ? 'rtl' : 'ltr') : field.type === 'date' ? 'ltr' : 'auto'} value={value?.kind === 'text' ? value.text : ''} placeholder={field.type === 'date' ? copy.datePlaceholder : ''} title={field.type === 'date' ? copy.dateFormat : undefined} aria-label={label}
      onChange={event => onChange(event.target.value ? { kind: 'text', text: event.target.value } : undefined)} />}
    {field.type === 'long' && <textarea lang={valueLanguage} dir={valueLanguage ? (['ar', 'fa'].includes(valueLanguage) ? 'rtl' : 'ltr') : 'auto'} rows={4} value={value?.kind === 'text' ? value.text : ''} aria-label={label}
      onChange={event => onChange(event.target.value ? { kind: 'text', text: event.target.value } : undefined)} />}
    {field.type === 'table' && <TableInput field={field} language={language} value={value} copy={copy} onChange={onChange} />}
    {showStatus && field.type !== 'table' && <div className="status-toggles">
      <button className="quiet status-toggle" aria-pressed={status === 'unknown'} onClick={() => toggleStatus('unknown')}>{copy.unknown}</button>
      <button className="quiet status-toggle" aria-pressed={status === 'not_applicable'} onClick={() => toggleStatus('not_applicable')}>{copy.notApplicable}</button>
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
        <div className="table-entry-head"><b>{copy.row.split('{n}')[0]}<bdi dir="ltr">{index + 1}</bdi>{copy.row.split('{n}')[1]}</b>{rows.length > 1 && <button className="quiet" onClick={() => update(rows.filter((_, item) => item !== index))}>{copy.removeRow}</button>}</div>
        {field.columns?.map(column => <label key={column.id}>{text(language, column.ko, column.en)}
          <input dir={column.kind === 'date' ? 'ltr' : 'auto'} value={row[column.id] ?? ''} placeholder={column.kind === 'date' ? copy.datePlaceholder : ''} title={column.kind === 'date' ? copy.dateFormat : undefined}
            onChange={event => update(rows.map((item, rowIndex) => rowIndex === index ? { ...item, [column.id]: event.target.value } : item))} /></label>)}
      </div>)}
      <button className="secondary" onClick={() => update([...rows, {}])}>{copy.addRow}</button>
    </>}
  </div>;
}
