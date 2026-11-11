import { Suspense } from 'react';
import { createSession } from '../intake';
import { importIntakeModel, INTAKE_API_URL, previewModels, setPreviewModel } from '../lib/intakeModel';
import { intakeLanguages } from '../intakeCopy';
import { localizeAppError } from '../appCopy';
import { DEV_TOOLS } from '../FormStage';
import { type DariApp, BenchPanel } from './useDariApp';

/** Site header: brand, overview, language, help and the operator panel. */
export function AppHeader({ app }: { app: DariApp }) {
  const { stage, currentStage, languageReturnStage, language, session, setSession, busy, setError, runtime, setRuntime, model, setModel, scope, setScope, setShowHelp, importing, setImporting, dialog, operatorOpen, setOperatorOpen, overviewOpen, setOverviewOpen, recoveryPending, copy, ui, overviewCopy, direction, refreshRuntime, sync, setStage, startDemo, exportAll } = app;
  return <>
    <header className="site-header"><button className="brand" onClick={() => setStage('basics')}><strong lang="en" dir="ltr">DARI</strong><span>{copy.tagline}</span></button><div className="header-actions"><button className="secondary overview-trigger" aria-haspopup="dialog" aria-expanded={overviewOpen} onClick={() => { setOperatorOpen(false); setOverviewOpen(true); }}>{overviewCopy.open}</button><button className="quiet" onClick={() => { languageReturnStage.current = currentStage.current; setStage('language'); }}>{intakeLanguages.find(item => item.code === language)?.name}</button><button className="quiet" onClick={() => setShowHelp(true)}><span className="help-mark">?</span>{copy.help}</button><div className="operator-entry"><button className="operator-toggle" aria-expanded={operatorOpen} aria-controls="operator" aria-label={ui.operator} title={ui.operator} onClick={() => setOperatorOpen(open => !open)}>⚙</button>
    {operatorOpen && <section id="operator" className="operator-popover" lang={language} dir={direction} aria-label={ui.operator}><div className="operator-head"><b>{ui.operator}</b><button className="quiet" onClick={() => setOperatorOpen(false)}>{copy.close}</button></div><div className="operator-grid">
          <p className="status-line">{runtime?.mode === 'on-device' ? ui.onDevice : ui.localPreview}<br /><bdi dir="ltr">{runtime?.modelName ?? ui.checking}{runtime?.backend && ` · ${runtime.backend.toUpperCase()}`}</bdi> · {runtime?.modelReady ? (runtime.mode === 'on-device' ? ui.fileReady : ui.modelReady) : ui.modelNeeded}</p>
          {runtime?.mode !== 'on-device' && <><code dir="ltr">{INTAKE_API_URL}</code><label>{ui.previewModel}<select dir="ltr" value={model} disabled={(!!busy || recoveryPending)} onChange={event => { setModel(event.target.value); setPreviewModel(event.target.value); void refreshRuntime(); }}>{previewModels.map(item => <option key={item}>{item}</option>)}</select></label><small>{ui.previewNote}</small></>}
          {runtime?.reason && <p className="status-line">{localizeAppError(language, runtime.reason)}</p>}
          <div className="actions" style={{ marginTop: 0 }}><button className="secondary" disabled={(!!busy || recoveryPending) || importing} onClick={() => void refreshRuntime()}>{ui.refreshStatus}</button>{runtime?.mode === 'on-device' && <button className="secondary" disabled={(!!busy || recoveryPending) || importing} onClick={async () => { setImporting(true); try { setRuntime(await importIntakeModel()); } catch (failure) { setError(String(failure)); } finally { setImporting(false); } }}>{importing ? ui.importBusy : ui.importModel}</button>}</div>
          <label>{ui.scopeLabel}<select value={scope} disabled={(!!busy || recoveryPending) || session.messages.some(item => item.role === 'user')} onChange={event => { const value = event.target.value as 'priority' | 'full' | 'test'; setScope(value); setSession(stage === 'conversation' ? sync(createSession(language, value)) : createSession(language, value)); }}><option value="test">{ui.scopeTest}</option><option value="full">{ui.scopeFull}</option><option value="priority">{ui.scopePriority}</option></select></label>
          {DEV_TOOLS && <><button className="secondary" disabled={(!!busy || recoveryPending) || session.messages.some(item => item.role === 'user')} onClick={() => void startDemo()}>{ui.koreanDemo}</button><small>{ui.koreanDemoNote}</small></>}
          {session.messages.some(item => item.role === 'user') && <button className="secondary" onClick={exportAll} disabled={(!!busy || recoveryPending)}>{ui.exportCurrent}</button>}
          {BenchPanel && <Suspense fallback={null}><BenchPanel runtime={runtime} disabled={(!!busy || recoveryPending) || importing} language={language} /></Suspense>}
        </div></section>}</div></div></header>
  </>;
}
