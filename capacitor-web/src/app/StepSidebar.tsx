import type { Stage } from '../workingCopy';
import type { stepProgress } from '../stepProgress';
import type { AppTexts } from './texts';

type Props = {
  texts: AppTexts;
  steps: { id: Stage; label: string }[];
  stage: Stage;
  progress: ReturnType<typeof stepProgress>;
  draftReady: boolean;
  notice: string;
  onDismissNotice: () => void;
  onNavigate: (stage: Stage) => void;
};

/** Numbered step list with overall progress and any notice about a blocked step. */
export function StepSidebar({ texts: { copy }, steps, stage, progress, draftReady, notice, onDismissNotice, onNavigate }: Props) {
  return <aside className="sidebar">
    <p className="overline">DARI / 01</p>
    <h2>{copy.sidebar}</h2>
    <ol className="steps">{steps.map((item, index) => <li key={item.id} className={stage === item.id ? 'current-step' : progress.passed(item.id) ? 'done-step' : undefined}>
      <button className={stage === item.id ? 'active' : ''} aria-current={stage === item.id ? 'step' : undefined} aria-disabled={item.id === 'draft' && !draftReady} onClick={() => onNavigate(item.id)}>
        <span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span>
      </button>
    </li>)}</ol>
    <div className="step-progress" role="progressbar" aria-label={copy.sidebar} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.current}><span style={{ width: `${progress.percent}%` }} /></div>
    {notice && <div className="step-notice" role="status"><span>{notice}</span><button className="quiet" onClick={onDismissNotice}>{copy.close}</button></div>}
    <div className="sidebar-note"><p>{copy.pace}</p><small>{copy.memory}</small></div>
    <div className="sidebar-footer">DARI</div>
  </aside>;
}
