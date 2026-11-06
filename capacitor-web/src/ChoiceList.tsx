import { useState } from 'react';
import { CHOICE_LIMIT, collapseRows } from './form/collapseChoices';

/** Answer choices presented as a vertical list of tappable rows, like the
 * multiple-choice prompts in the Claude mobile app: numbered rows for a single
 * choice, check circles for several, and “기타” opening a text box in place. */
export type ChoiceItem = { value: string; label: string };

type ListProps = {
  items: ChoiceItem[];
  multi: boolean;
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  label?: string;
  /** “기타” value: instead of a row, a text box stays open under the choices. */
  otherValue?: string;
  otherText?: string;
  otherLabel?: string;
  onOtherText?: (text: string) => void;
  /** Long lists show this many rows until expanded (issue #7). */
  limit?: number;
  moreLabel?: string;
  lessLabel?: string;
  hiddenSelectedLabel?: string;
};

export function ChoiceList({ items, multi, selected, onToggle, disabled, label, otherValue, otherText = '', otherLabel, onOtherText, limit = CHOICE_LIMIT, moreLabel, lessLabel, hiddenSelectedLabel }: ListProps) {
  const freeText = !!otherValue && !!onOtherText;
  const allRows = freeText ? items.filter(item => item.value !== otherValue) : items;
  // Start expanded when a saved choice would otherwise be hidden.
  const [expanded, setExpanded] = useState(() => collapseRows(allRows, selected, false, limit).hiddenSelected > 0);
  const canCollapse = !!moreLabel && !!lessLabel;
  const view = collapseRows(allRows, selected, expanded || !canCollapse, limit);
  const rows = view.visible;
  const otherOn = freeText && selected.includes(otherValue!);
  return <div className={`choice-rows${multi ? ' multi' : ''}`} role="group" aria-label={label}>
    {rows.map((item, index) => {
      const on = selected.includes(item.value);
      return <div key={item.value} className={`choice-row-wrap${on ? ' on' : ''}`}>
        <button type="button" className="choice-row" aria-pressed={on} disabled={disabled} onClick={() => onToggle(item.value)}>
          <span className="choice-marker" aria-hidden="true">{on ? '✓' : multi ? '' : <bdi dir="ltr">{index + 1}</bdi>}</span>
          <span className="choice-label" dir="auto">{item.label}</span>
        </button>
      </div>;
    })}
    {canCollapse && collapseRows(allRows, selected, false, limit).collapsible && <div className="choice-row-wrap choice-toggle-row">
      <button type="button" className="choice-row choice-toggle" aria-expanded={expanded} disabled={disabled} onClick={() => setExpanded(open => !open)}>
        <span className="choice-marker" aria-hidden="true">{expanded ? '−' : '+'}</span>
        <span className="choice-label">{expanded ? lessLabel : moreLabel!.replace('{n}', String(view.hidden))}{!expanded && view.hiddenSelected > 0 && hiddenSelectedLabel && <small className="choice-hidden-selected"> · {hiddenSelectedLabel.replace('{n}', String(view.hiddenSelected))}</small>}</span>
      </button>
    </div>}
    {freeText && <label className={`choice-row-wrap choice-other-row${otherOn ? ' on' : ''}`}>
      <span className="choice-marker" aria-hidden="true">{otherOn ? '✓' : '✎'}</span>
      <input dir="auto" value={otherText} maxLength={500} placeholder={otherLabel} aria-label={otherLabel} disabled={disabled} onChange={event => onOtherText!(event.target.value)} />
    </label>}
  </div>;
}

/** Selection after typing in the 기타 box: text selects 기타, an empty box removes it.
 * A single choice keeps only 기타 once the applicant writes their own answer. */
export function withOtherText(selected: string[], otherValue: string, text: string, multi: boolean): string[] {
  const rest = selected.filter(value => value !== otherValue);
  if (!text.trim()) return rest;
  return multi ? [...rest, otherValue] : [otherValue];
}

type CardProps = Omit<ListProps, 'onToggle'> & {
  onPick: (values: string[]) => void;
  /** Single choice answers at once on tap, except the 기타 row which waits for its text. */
  onAnswer: (values: string[]) => void;
  submitLabel: string;
  clearLabel: string;
  hint?: string;
  footer?: { label: string; onClick: () => void }[];
};

export function ChoiceCard({ onPick, onAnswer, submitLabel, clearLabel, hint, footer = [], ...list }: CardProps) {
  const { multi, selected, otherValue, disabled, onOtherText } = list;
  const waiting = multi || (!!otherValue && selected.includes(otherValue));
  const toggle = (value: string) => {
    if (!multi && value !== otherValue) { onAnswer([value]); return; }
    const on = selected.includes(value);
    onPick(multi ? (on ? selected.filter(item => item !== value) : [...selected, value]) : on ? [] : [value]);
  };
  return <div className="choice-card">
    {hint && multi && <p className="choice-card-hint">{hint}</p>}
    <ChoiceList {...list} onToggle={toggle} onOtherText={onOtherText && otherValue ? text => { onOtherText(text); onPick(withOtherText(selected, otherValue, text, multi)); } : undefined} />
    {waiting && <div className="choice-card-actions">
      <button type="button" className="primary" disabled={disabled || !selected.length} onClick={() => onAnswer(selected)}>{submitLabel}{multi && selected.length > 0 && <bdi dir="ltr"> · {selected.length}</bdi>}</button>
      {selected.length > 0 && <button type="button" className="quiet" disabled={disabled} onClick={() => onPick([])}>{clearLabel}</button>}
    </div>}
    {footer.length > 0 && <div className="choice-card-footer">{footer.map(item => <button type="button" key={item.label} className="quiet" disabled={disabled} onClick={item.onClick}>{item.label}</button>)}</div>}
  </div>;
}
