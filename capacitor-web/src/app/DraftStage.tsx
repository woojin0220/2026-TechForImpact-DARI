import { Suspense } from 'react';
import { isFieldVisible, question14Steps, exportSession } from '../intake';
import { localizedLabel } from '../form/localize';
import { DEV_TOOLS, FieldInput } from '../FormStage';
import { draftSectionTitle } from '../form/presentation';
import { EnglishMeaning } from '../revision/EnglishMeaning';
import { SentenceReview } from '../revision/SentenceReview';
import { EditorModal } from '../revision/EditorModal';
import { saveDraftReview } from '../revision/pipeline';
import { FinalCheck } from '../JourneyPanels';
import { HwpDownloadButton } from '../export/HwpDownloadButton';
import { visibleOutputs } from '../workingCopy';
import { type DariApp, ApplicationExport } from './useDariApp';

/** Korean draft step: question 14 editing, outputs and export. */
export function DraftStage({ app }: { app: DariApp }) {
  const { stage, language, session, setSession, busy, setError, reviewed, setMeaningReady, setFinalReviewedText, savedNotice, setSavedNotice, output, setOutput, editingField, setEditingField, setSourceIds, exportOpen, setExportOpen, overviewTarget, recoveryPending, copy, ui, sc, direction, facts, formFacts, derived14, requirementLabel, factValue, sentenceOrigins, answer, answers14, reviewTextKey, finalReviewed, englishReady, sectionsByField, updateQuestion14, setStage, draft, exportAll } = app;
  return <>
        {stage === 'draft' && <>
          <div className="notice">{copy.draftNote}</div>
          <div className="output-tabs" aria-label={copy.draft}>{visibleOutputs(DEV_TOOLS).map(item => <button key={item} aria-pressed={output === item} onClick={() => setOutput(item)}>{item === 'draft' ? copy.draft : item === 'source' ? copy.original : copy.metadata}</button>)}</div>
          {output === 'draft' && <section className="panel q14-draft" lang={language} dir={direction}>
            <div className="section-title"><h2>{ui.q14Title}</h2><span className="small-tag">{ui.editableDraft}</span></div>
            <p className="micro">{ui.draftIntro}</p>
            {language === 'en' && <p className="micro">{ui.backtranslationNote}</p>}
            {question14Steps.map(step => { const visible = step.fields.filter(field => (isFieldVisible(field, answers14) && (session.scope !== 'test' || /^14\.[123](?:-|$)/.test(field.id))) || (overviewTarget?.kind === 'draft' && overviewTarget.fieldId === field.id)); return visible.length > 0 && <div className="q14-step" key={step.id}>
              <h3>{draftSectionTitle(step, language)}</h3>
              {visible.map(field => { const section = sectionsByField.get(field.id); const derived = derived14.find(item => item.id === field.id); return <div className="q14-field" key={field.id}>
                <h4 className="q14-id">{localizedLabel(language, field.ko, field.en)}</h4>
                {derived?.needsReview && <p className="draft-missing">{ui.needsReview}{derived.value}</p>}
                {!!section?.missingFactIds?.length && <p className="draft-missing">{ui.draftMissing}{section.missingFactIds.map(id => { const fact = session.facts.find(item => item.id === id); return fact ? `${requirementLabel(fact.requirementId)} — ${factValue(fact.requirementId, fact.value)}` : id; }).join(' · ')}{ui.addMissing}</p>}
                {!!section?.staleValues?.length && <p className="draft-missing">{ui.stalePrefix}{section.staleValues.join(' · ')}{ui.correctStale}</p>}
                {language === 'en' && answers14[field.id]?.kind === 'text' && <EnglishMeaning uiLanguage={language} text={(answers14[field.id] as { text: string }).text} onReady={text => setMeaningReady(current => current[field.id] === text ? current : { ...current, [field.id]: text })} />}
                <fieldset className="stage-readonly" disabled={!!busy || recoveryPending}><FieldInput field={field} language={language} valueLanguage="ko" value={answers14[field.id]} copy={sc} showLabel={false} showStatus={!answers14[field.id] || answers14[field.id].kind === 'status'} onChange={value => updateQuestion14(field.id, value)} /></fieldset>
                {answers14[field.id]?.kind === 'text' && (answers14[field.id] as { text: string }).text.trim() && <>
                  <div className="draft-field-actions">
                    <button className="secondary" disabled={!!busy || recoveryPending} onClick={() => setEditingField(field.id)}>{ui.refine}</button>
                    <button className="secondary" disabled={!section?.sourceIds.some(id => session.messages.some(message => message.id === id && message.role === 'user'))} onClick={() => setSourceIds(section?.sourceIds ?? [])}>{ui.sources}</button>
                  </div>
                  {editingField === field.id && <EditorModal uiLanguage={language} title={ui.sentenceEditor} closeLabel={copy.close} onClose={() => setEditingField(null)}><SentenceReview uiLanguage={language} sourceLanguage={session.language} origins={sentenceOrigins(section)} key={`${session.id}-${session.draftRevision}-${field.id}`} text={(answers14[field.id] as { text: string }).text} saved={session.draftReviews?.[field.id]} onChange={(doc, expected) => setSession(current => {
                    const answer = current.question14?.[field.id];
                    if (!current.draftRevision || answer?.kind !== 'text' || answer.text !== expected) return current;
                    return saveDraftReview(current, field.id, expected, doc);
                  })} /></EditorModal>}
                </>}
              </div>; })}
            </div>; })}
          </section>}
          {output === 'draft' && formFacts.length > 0 && <section className="panel draft-card" lang={language} dir={direction}><div className="section-title"><h2>{ui.formValues}</h2><span className="small-tag">{ui.asEntered}</span></div><dl className="form-values">{formFacts.map(fact => <div key={fact.id}><dt><bdi dir="ltr">{fact.requirementId}</bdi> · {requirementLabel(fact.requirementId)}{fact.eventId && <bdi dir="ltr"> ({fact.eventId})</bdi>}</dt><dd dir="auto">{factValue(fact.requirementId, fact.value)}</dd></div>)}</dl></section>}
          {output === 'source' && <div className="fact-list">{session.messages.map(message => <article className="fact-card" key={message.id}><small>{message.role === 'user' ? copy.input : 'DARI'} · {message.id}</small><p dir="auto">{message.content}</p></article>)}</div>}
          {DEV_TOOLS && output === 'metadata' && <section className="panel"><p className="developer-label">{ui.metadataDeveloper}</p><div className="details-content" dir="ltr"><pre>{JSON.stringify(JSON.parse(exportSession(session)).metadata, null, 2)}</pre></div></section>}
          {output === 'draft' && <fieldset className="stage-readonly" disabled={!!busy || recoveryPending}><FinalCheck session={session} language={language} checked={finalReviewed} ready={englishReady} onCheck={checked => setFinalReviewedText(checked ? reviewTextKey : '')} onReturn={() => setStage('facts')} /></fieldset>}
          {savedNotice && <p role="status">{savedNotice}</p>}
          <div className="actions"><button className="secondary" onClick={() => setStage('facts')}>{copy.back}</button><button className="primary" disabled={!!busy} onClick={() => setExportOpen(true)}>{ui.exportApplication}</button><button className="secondary" onClick={exportAll}>{ui.saveRecord}</button><HwpDownloadButton session={session} reviewed={finalReviewed && englishReady} language={language} label={copy.downloadText} disabled={!!busy} onNotice={setSavedNotice} onError={setError} /></div>
          {exportOpen && <EditorModal title={ui.exportFormTitle} closeLabel={copy.close} onClose={() => setExportOpen(false)}><Suspense fallback={<p role="status">{ui.exportLoading}</p>}><ApplicationExport session={session} reviewed={finalReviewed && englishReady} language={language} /></Suspense></EditorModal>}
        </>}
  </>;
}
