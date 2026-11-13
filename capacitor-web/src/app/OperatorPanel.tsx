import { lazy, Suspense } from 'react';
import { importIntakeModel, INTAKE_API_URL, previewModels, setPreviewModel, type IntakeRuntimeStatus } from '../lib/intakeModel';
import { localizeAppError } from '../appCopy';
import { DEV_TOOLS } from '../FormStage';
import type { IntakeScope } from '../intake';
import type { AppTexts } from './texts';

// Benchmark tools ship only in development builds or builds made with VITE_DARI_BENCH=1.
const BenchPanel = import.meta.env.DEV || import.meta.env.VITE_DARI_BENCH === '1' ? lazy(() => import('../bench/BenchPanel')) : null;

type Props = {
  texts: AppTexts;
  language: string;
  runtime: IntakeRuntimeStatus | null;
  onRuntime: (runtime: IntakeRuntimeStatus) => void;
  refreshRuntime: () => Promise<void>;
  model: string;
  onModel: (model: string) => void;
  importing: boolean;
  onImporting: (importing: boolean) => void;
  scope: IntakeScope;
  onScope: (scope: IntakeScope) => void;
  /** A model request is running or an interrupted one awaits a decision. */
  locked: boolean;
  /** The applicant has written something, so the scope and demo are fixed. */
  started: boolean;
  onError: (message: string) => void;
  onStartDemo: () => void;
  onExport: () => void;
  onClose: () => void;
};

/** Operator settings: model runtime, preview model, scope, demo and benchmark tools. */
export function OperatorPanel({ texts, language, runtime, onRuntime, refreshRuntime, model, onModel, importing, onImporting, scope, onScope, locked, started, onError, onStartDemo, onExport, onClose }: Props) {
  const { ui, copy, direction } = texts;
  async function importModel() {
    onImporting(true);
    try { onRuntime(await importIntakeModel()); } catch (failure) { onError(String(failure)); } finally { onImporting(false); }
  }
  return <section id="operator" className="operator-popover" lang={language} dir={direction} aria-label={ui.operator}>
    <div className="operator-head"><b>{ui.operator}</b><button className="quiet" onClick={onClose}>{copy.close}</button></div>
    <div className="operator-grid">
      <p className="status-line">{runtime?.mode === 'on-device' ? ui.onDevice : ui.localPreview}<br /><bdi dir="ltr">{runtime?.modelName ?? ui.checking}{runtime?.backend && ` · ${runtime.backend.toUpperCase()}`}</bdi> · {runtime?.modelReady ? (runtime.mode === 'on-device' ? ui.fileReady : ui.modelReady) : ui.modelNeeded}</p>
      {runtime?.mode !== 'on-device' && <>
        <code dir="ltr">{INTAKE_API_URL}</code>
        <label>{ui.previewModel}<select dir="ltr" value={model} disabled={locked} onChange={event => { onModel(event.target.value); setPreviewModel(event.target.value); void refreshRuntime(); }}>{previewModels.map(item => <option key={item}>{item}</option>)}</select></label>
        <small>{ui.previewNote}</small>
      </>}
      {runtime?.reason && <p className="status-line">{localizeAppError(language, runtime.reason)}</p>}
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="secondary" disabled={locked || importing} onClick={() => void refreshRuntime()}>{ui.refreshStatus}</button>
        {runtime?.mode === 'on-device' && <button className="secondary" disabled={locked || importing} onClick={() => void importModel()}>{importing ? ui.importBusy : ui.importModel}</button>}
      </div>
      <label>{ui.scopeLabel}<select value={scope} disabled={locked || started} onChange={event => onScope(event.target.value as IntakeScope)}><option value="test">{ui.scopeTest}</option><option value="full">{ui.scopeFull}</option><option value="priority">{ui.scopePriority}</option></select></label>
      {DEV_TOOLS && <><button className="secondary" disabled={locked || started} onClick={onStartDemo}>{ui.koreanDemo}</button><small>{ui.koreanDemoNote}</small></>}
      {started && <button className="secondary" onClick={onExport} disabled={locked}>{ui.exportCurrent}</button>}
      {BenchPanel && <Suspense fallback={null}><BenchPanel runtime={runtime} disabled={locked || importing} language={language} /></Suspense>}
    </div>
  </section>;
}
