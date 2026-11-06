import { type IntakeSession } from './intake';
import { intakeLanguages } from './intakeCopy';
import { localizeAppError } from './appCopy';
import { DEV_TOOLS, FormStage } from './FormStage';
import { invalidateDraft } from './intake';
import { SessionOverview } from './sessionOverview/SessionOverview';
import { type Stage } from './workingCopy';
import { useDariApp } from './app/useDariApp';
import { AppHeader } from './app/AppHeader';
import { ConversationStage } from './app/ConversationStage';
import { FactsStage } from './app/FactsStage';
import { DraftStage } from './app/DraftStage';

// Layout only. State and actions live in app/useDariApp.tsx; each step has its own file in app/.
export default function App(props: { initialSession?: IntakeSession; initialStage?: Stage } = {}) {
  const app = useDariApp(props);
  const { initialWork, stage, languageReturnStage, setStageRaw, formPage, setFormPage, language, session, setSession, input, picked, busy, error, retryTask, runtime, setReviewed, showHelp, sourceIds, main, dialog, overviewOpen, setOverviewOpen, setOverviewTarget, stageNotice, setStageNotice, restoredNotice, setRestoredNotice, recoveryPending, storageFailed, ux, copy, ui, overviewCopy, sc, direction, facts, started, askRequirement, showComposer, narrativeOpened, steps, progress, navigateToStep, resumeInterruptedWork, resetWork, optionLabel, setStage, selectLanguage, run, start, startQuickTest, draft, overviewFormField, editFromOverview, openOperator, closeDialog, processingStatus } = app;
  if (stage === 'language') return <div className="language-entry"><div className="language-entry-content">
    <h1 className="entry-logo" lang="en" dir="ltr">DARI</h1>{processingStatus()}{busy && <button className="quiet" onClick={() => setStageRaw(languageReturnStage.current)}>{copy.back}</button>}
    {DEV_TOOLS && !started && !Object.keys(session.form).length && <button className="secondary" disabled={!!busy || recoveryPending} onClick={startQuickTest}>{ui.quickEnglishTest}</button>}
    <nav className="language-scroll" aria-label={ui.languagePicker}>{intakeLanguages.map(item => <button className="language-option" lang={item.code} dir="auto" key={item.code} disabled={!!busy || recoveryPending} onClick={() => selectLanguage(item.code)}>{item.name}</button>)}</nav>
  </div></div>;

  return <div className={stage === 'conversation' || stage === 'form' ? 'app-shell chat-mode' : stage === 'basics' ? 'app-shell start-mode' : 'app-shell page-mode'}>
    <a className="skip-link" href="#main">{copy.continue}</a>
    <AppHeader app={app} />
    <div className="workspace">
      <aside className="sidebar"><p className="overline">DARI / 01</p><h2>{copy.sidebar}</h2><ol className="steps">{steps.map((item, index) => <li key={item.id} className={stage === item.id ? 'current-step' : progress.passed(item.id) ? 'done-step' : undefined}><button className={stage === item.id ? 'active' : ''} aria-current={stage === item.id ? 'step' : undefined} aria-disabled={item.id === 'draft' && !session.draftRevision} onClick={() => navigateToStep(item.id)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{item.label}</span></button></li>)}</ol>{stage !== 'form' && <div className="step-progress" role="progressbar" aria-label={copy.sidebar} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.current}><span style={{ width: `${progress.percent}%` }} /></div>}{stageNotice && <div className="step-notice" role="status"><span>{stageNotice}</span><button className="quiet" onClick={() => setStageNotice('')}>{copy.close}</button></div>}<div className="sidebar-note"><p>{copy.pace}</p><small>{copy.memory}</small></div><div className="sidebar-footer">DARI</div></aside>
      {processingStatus(stage !== 'conversation' || !showComposer)}
      <main id="main" ref={main} tabIndex={-1}>
        {(restoredNotice || recoveryPending || storageFailed || initialWork.problem === 'invalid') && <div className="session-status" role="status">
          <span>{storageFailed ? ux.storageFailed : initialWork.problem === 'invalid' ? ux.invalid : recoveryPending ? ux.interrupted : ux.restored}</span>
          {recoveryPending && <button className="quiet" onClick={resumeInterruptedWork}>{ux.resume}</button>}
          {initialWork.problem === 'invalid' ? <button className="quiet" onClick={resetWork}>{ux.newSession}</button> : !recoveryPending && !storageFailed && <button className="quiet" onClick={() => setRestoredNotice(false)}>{copy.close}</button>}
        </div>}
        <h1>{stage === 'form' ? sc.formTitle : stage === 'basics' ? copy.startTitle : stage === 'conversation' ? copy.chatTitle : stage === 'facts' ? copy.factsTitle : copy.draftTitle}</h1>
        <p className="intro">{stage === 'form' ? sc.formIntro : stage === 'basics' ? copy.startIntro : stage === 'conversation' ? copy.chatIntro : stage === 'facts' ? copy.factsIntro : copy.draftIntro}</p>
        {stage === 'basics' && DEV_TOOLS && language === 'en' && !started && !Object.keys(session.form).length && <button className="secondary" disabled={!!busy || recoveryPending} onClick={startQuickTest}>{ui.shortConversation}</button>}
        {error && <div className="notice error" role="alert"><p>{localizeAppError(language, error)}</p>{retryTask && <div className="actions"><button className="secondary" disabled={(!!busy || recoveryPending)} onClick={() => void run(session, retryTask)}>{copy.retry}</button></div>}</div>}
        {runtime && (!runtime.available || !runtime.modelReady) && ((narrativeOpened && stage === 'conversation') || stage === 'facts') && <div className="notice"><p>{copy.unavailable}</p>{DEV_TOOLS && <button className="quiet" onClick={openOperator}>{ui.operator}</button>}</div>}
        {stage === 'basics' && <div className="content-grid"><section className="start-panel">{started && <p className="micro">{copy.factsIntro}</p>}<div className="actions" style={started ? undefined : { marginTop: 0 }}><button className="primary full" onClick={start}>{started ? copy.continue : copy.start}<span aria-hidden="true">{direction === 'rtl' ? '←' : '→'}</span></button></div></section><aside className="support-card"><h2>{copy.pace}</h2><p>{copy.chatIntro}</p><p className="micro">{copy.memory}</p></aside></div>}
        {stage === 'form' && <fieldset className="form-stage-guard" disabled={!!busy || recoveryPending}><FormStage language={language} answers={session.form} page={formPage} copy={sc} back={copy.back} next={copy.continue}
          onChange={form => { setReviewed(false); setSession(current => ({ ...invalidateDraft(current), form })); }} onPage={page => { setOverviewTarget(null); setFormPage(page); }} onDone={() => setStage('conversation')} focusField={overviewFormField} hiddenFieldNotice={overviewCopy.hiddenFieldEditing} /></fieldset>}
        <ConversationStage app={app} />
        <FactsStage app={app} />
        <DraftStage app={app} />
      </main>
    </div>
    <footer className="site-footer"><span>{copy.tagline}</span><span>{copy.memory}</span></footer>
    {overviewOpen && <SessionOverview session={session} language={language} pendingText={[input, ...picked.map(value => optionLabel(askRequirement?.options?.find(option => option.value === value) ?? { ko: value, en: value }))].filter(Boolean).join('\n')} busy={!!busy || recoveryPending} onClose={() => setOverviewOpen(false)} onEdit={editFromOverview} />}
    <dialog ref={dialog} className="help-dialog" onCancel={closeDialog} onClose={closeDialog}><h2>{showHelp ? copy.help : copy.source}</h2>{showHelp ? <><p>{copy.helpBody}</p><p>{copy.memory}</p><button className="secondary" disabled={!!busy} onClick={resetWork}>{ux.newSession}</button></> : session.messages.filter(item => item.role === 'user' && sourceIds.includes(item.id)).map(item => <div key={item.id}><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p></div>)}<div className="actions"><button className="primary" onClick={closeDialog}>{copy.close}</button></div></dialog>
  </div>;
}
