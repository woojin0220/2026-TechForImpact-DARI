import { lazy, Suspense } from 'react';
import { exportSession, narrativeFieldFor, question14Steps, type Derived14, type FormValue, type IntakeFact, type IntakeSession } from '../intake';
import { localizedLabel } from '../form/localize';
import { draftSectionTitle } from '../form/presentation';
import { DEV_TOOLS, FieldInput } from '../FormStage';
import { FinalCheck } from '../JourneyPanels';
import { EnglishMeaning } from '../revision/EnglishMeaning';
import { SentenceReview } from '../revision/SentenceReview';
import { EditorModal } from '../revision/EditorModal';
import { HwpDownloadButton } from '../export/HwpDownloadButton';
import { visibleOutputs, type Output } from '../workingCopy';
import type { TxtDocument } from '../revision/state.mjs';
import { factValue, isDraftFieldShown, requirementLabel } from './labels';
import { sentenceOrigins } from './review';
import type { BusyKind } from './useModelTask';
import type { AppTexts } from './texts';

const ApplicationExport = lazy(() => import('../export/ApplicationExport'));

type Props = {
  texts: AppTexts;
  language: string;
  session: IntakeSession;
  busy: BusyKind | null;
  locked: boolean;
  output: Output;
  onOutput: (output: Output) => void;
  derived14: Derived14[];
  /** Form answers shown as entered, outside the question 14 draft. */
  formFacts: IntakeFact[];
  /** A draft field opened from the overview stays visible even if hidden by its gate. */
  focusField?: string;
  editingField: string | null;
  onEditingField: (fieldId: string | null) => void;
  onSources: (ids: string[]) => void;
  onMeaningReady: (fieldId: string, text: string) => void;
  onQuestion14: (fieldId: string, value: FormValue | undefined) => void;
  onSentenceReview: (fieldId: string, doc: TxtDocument, expectedText: string) => void;
  finalReviewed: boolean;
  englishReady: boolean;
  onFinalCheck: (checked: boolean) => void;
  savedNotice: string;
  onNotice: (notice: string) => void;
  onError: (message: string) => void;
  exportOpen: boolean;
  onExportOpen: (open: boolean) => void;
  onBack: () => void;
  onSaveRecord: () => void;
};

/** The editable Korean draft of question 14, the other outputs and the export actions. */
export function DraftStage(props: Props) {
  const { texts: { copy, ui, direction }, language, session, busy, locked, output, formFacts, finalReviewed, englishReady } = props;
  return <>
    <div className="notice">{copy.draftNote}</div>
    <div className="output-tabs" aria-label={copy.draft}>{visibleOutputs(DEV_TOOLS).map(item => <button key={item} aria-pressed={output === item} onClick={() => props.onOutput(item)}>{item === 'draft' ? copy.draft : item === 'source' ? copy.original : copy.metadata}</button>)}</div>
    {output === 'draft' && <Question14Draft {...props} />}
    {output === 'draft' && formFacts.length > 0 && <section className="panel draft-card" lang={language} dir={direction}>
      <div className="section-title"><h2>{ui.formValues}</h2><span className="small-tag">{ui.asEntered}</span></div>
      <dl className="form-values">{formFacts.map(fact => <div key={fact.id}><dt><bdi dir="ltr">{fact.requirementId}</bdi> · {requirementLabel(fact.requirementId, language)}{fact.eventId && <bdi dir="ltr"> ({fact.eventId})</bdi>}</dt><dd dir="auto">{factValue(fact.requirementId, fact.value, language)}</dd></div>)}</dl>
    </section>}
    {output === 'source' && <div className="fact-list">{session.messages.map(message => <article className="fact-card" key={message.id}><small>{message.role === 'user' ? copy.input : 'DARI'} · {message.id}</small><p dir="auto">{message.content}</p></article>)}</div>}
    {DEV_TOOLS && output === 'metadata' && <section className="panel"><p className="developer-label">{ui.metadataDeveloper}</p><div className="details-content" dir="ltr"><pre>{JSON.stringify(JSON.parse(exportSession(session)).metadata, null, 2)}</pre></div></section>}
    {output === 'draft' && <fieldset className="stage-readonly" disabled={locked}><FinalCheck session={session} language={language} checked={finalReviewed} ready={englishReady} onCheck={props.onFinalCheck} onReturn={props.onBack} /></fieldset>}
    {props.savedNotice && <p role="status">{props.savedNotice}</p>}
    <div className="actions">
      <button className="secondary" onClick={props.onBack}>{copy.back}</button>
      <button className="primary" disabled={!!busy} onClick={() => props.onExportOpen(true)}>{ui.exportApplication}</button>
      <button className="secondary" onClick={props.onSaveRecord}>{ui.saveRecord}</button>
      <HwpDownloadButton session={session} reviewed={finalReviewed && englishReady} language={language} label={copy.downloadText} disabled={!!busy} onNotice={props.onNotice} onError={props.onError} />
    </div>
    {props.exportOpen && <EditorModal title={ui.exportFormTitle} closeLabel={copy.close} onClose={() => props.onExportOpen(false)}><Suspense fallback={<p role="status">{ui.exportLoading}</p>}><ApplicationExport session={session} reviewed={finalReviewed && englishReady} language={language} /></Suspense></EditorModal>}
  </>;
}

function Question14Draft(props: Props) {
  const { texts: { ui, direction }, language, session, focusField } = props;
  const answers14 = session.question14 ?? {};
  const sectionsByField = new Map(session.draft.map(section => [narrativeFieldFor(section.questionId, answers14), section]));
  return <section className="panel q14-draft" lang={language} dir={direction}>
    <div className="section-title"><h2>{ui.q14Title}</h2><span className="small-tag">{ui.editableDraft}</span></div>
    <p className="micro">{ui.draftIntro}</p>
    {language === 'en' && <p className="micro">{ui.backtranslationNote}</p>}
    {question14Steps.map(step => {
      const visible = step.fields.filter(field => isDraftFieldShown(field, answers14, session.scope) || focusField === field.id);
      return visible.length > 0 && <div className="q14-step" key={step.id}>
        <h3>{draftSectionTitle(step, language)}</h3>
        {visible.map(field => <DraftField key={field.id} {...props} field={field} answer={answers14[field.id]} section={sectionsByField.get(field.id)} />)}
      </div>;
    })}
  </section>;
}

type FieldProps = Props & {
  field: (typeof question14Steps)[number]['fields'][number];
  answer?: FormValue;
  section?: IntakeSession['draft'][number];
};

/** One question 14 box: review notes, the editable answer and its sentence editor. */
function DraftField({ texts: { copy, ui, sc }, language, session, locked, derived14, field, answer, section, editingField, onEditingField, onSources, onMeaningReady, onQuestion14, onSentenceReview }: FieldProps) {
  const derived = derived14.find(item => item.id === field.id);
  const text = answer?.kind === 'text' ? answer.text : undefined;
  const missing = section?.missingFactIds?.map(id => {
    const fact = session.facts.find(item => item.id === id);
    return fact ? `${requirementLabel(fact.requirementId, language)} — ${factValue(fact.requirementId, fact.value, language)}` : id;
  }).join(' · ');
  return <div className="q14-field">
    <h4 className="q14-id">{localizedLabel(language, field.ko, field.en)}</h4>
    {derived?.needsReview && <p className="draft-missing">{ui.needsReview}{derived.value}</p>}
    {!!section?.missingFactIds?.length && <p className="draft-missing">{ui.draftMissing}{missing}{ui.addMissing}</p>}
    {!!section?.staleValues?.length && <p className="draft-missing">{ui.stalePrefix}{section.staleValues.join(' · ')}{ui.correctStale}</p>}
    {language === 'en' && text !== undefined && <EnglishMeaning uiLanguage={language} text={text} onReady={ready => onMeaningReady(field.id, ready)} />}
    <fieldset className="stage-readonly" disabled={locked}><FieldInput field={field} language={language} valueLanguage="ko" value={answer} copy={sc} showLabel={false} showStatus={!answer || answer.kind === 'status'} onChange={value => onQuestion14(field.id, value)} /></fieldset>
    {text?.trim() && <>
      <div className="draft-field-actions">
        <button className="secondary" disabled={locked} onClick={() => onEditingField(field.id)}>{ui.refine}</button>
        <button className="secondary" disabled={!section?.sourceIds.some(id => session.messages.some(message => message.id === id && message.role === 'user'))} onClick={() => onSources(section?.sourceIds ?? [])}>{ui.sources}</button>
      </div>
      {editingField === field.id && <EditorModal uiLanguage={language} title={ui.sentenceEditor} closeLabel={copy.close} onClose={() => onEditingField(null)}>
        <SentenceReview uiLanguage={language} sourceLanguage={session.language} origins={sentenceOrigins(session, section)} key={`${session.id}-${session.draftRevision}-${field.id}`} text={text} saved={session.draftReviews?.[field.id]} onChange={(doc, expected) => onSentenceReview(field.id, doc, expected)} />
      </EditorModal>}
    </>}
  </div>;
}
