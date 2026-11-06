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
  /** Value whose row opens the free-text box when selected. */
  otherValue?: string;
  otherText?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  onOtherText?: (text: string) => void;
};

export function ChoiceList({ items, multi, selected, onToggle, disabled, label, otherValue, otherText = '', otherLabel, otherPlaceholder, onOtherText }: ListProps) {
  return <div className={`choice-rows${multi ? ' multi' : ''}`} role="group" aria-label={label}>
    {items.map((item, index) => {
      const on = selected.includes(item.value);
      const other = item.value === otherValue && on && onOtherText;
      return <div key={item.value} className={`choice-row-wrap${on ? ' on' : ''}`}>
        <button type="button" className="choice-row" aria-pressed={on} disabled={disabled} onClick={() => onToggle(item.value)}>
          <span className="choice-marker" aria-hidden="true">{multi ? (on ? '✓' : '') : on ? '✓' : <bdi dir="ltr">{index + 1}</bdi>}</span>
          <span className="choice-label" dir="auto">{item.label}</span>
        </button>
        {other && <label className="choice-other"><span className="sr-only">{otherLabel}</span>
          <input dir="auto" autoFocus value={otherText} maxLength={500} placeholder={otherPlaceholder ?? otherLabel} disabled={disabled} onChange={event => onOtherText!(event.target.value)} /></label>}
      </div>;
    })}
  </div>;
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
  const { multi, selected, otherValue, disabled } = list;
  const waiting = multi || (!!otherValue && selected.includes(otherValue));
  const toggle = (value: string) => {
    if (!multi && value !== otherValue) { onAnswer([value]); return; }
    const on = selected.includes(value);
    onPick(multi ? (on ? selected.filter(item => item !== value) : [...selected, value]) : on ? [] : [value]);
  };
  return <div className="choice-card">
    {hint && multi && <p className="choice-card-hint">{hint}</p>}
    <ChoiceList {...list} onToggle={toggle} />
    {waiting && <div className="choice-card-actions">
      <button type="button" className="primary" disabled={disabled || !selected.length} onClick={() => onAnswer(selected)}>{submitLabel}{multi && selected.length > 0 && <bdi dir="ltr"> · {selected.length}</bdi>}</button>
      {selected.length > 0 && <button type="button" className="quiet" disabled={disabled} onClick={() => onPick([])}>{clearLabel}</button>}
    </div>}
    {footer.length > 0 && <div className="choice-card-footer">{footer.map(item => <button type="button" key={item.label} className="quiet" disabled={disabled} onClick={item.onClick}>{item.label}</button>)}</div>}
  </div>;
}
