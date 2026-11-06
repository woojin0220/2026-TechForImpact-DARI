import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

// Render the actual TSX component graph, not a copied version of its strings.
// CSS is deliberately excluded: browser layout/overflow is tested separately.
// React effects do not run during SSR, and the model adapter additionally throws
// if anything accidentally attempts inference while this fixture is evaluated.
const result = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, sourcefile: 'tests/arabic-render.fixture.tsx', contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { TopicProgress, ReviewSummaries, FinalCheck } from './src/JourneyPanels';
    import { StatementDetails } from './src/StatementDetails';
    import { FormStage, FieldInput } from './src/FormStage';
    import { SentenceReview } from './src/revision/SentenceReview';
    import { EnglishMeaning } from './src/revision/EnglishMeaning';
    import { EditorModal } from './src/revision/EditorModal';
    import { createDocument, addUserMessage, addAssistantMessage } from './src/revision/state.mjs';
    import { createSession, formSteps } from './src/intake';
    import { intakeCopies, scriptedCopy } from './src/intakeCopy';
    import { journeyDetailTitle } from './src/journeyCopy';
    const noop = () => {};
    export const originalQuote = 'Original English evidence must remain unchanged.';
    export const koreanDraft = '이것은 검토용 한국어 문장입니다.';
    const fact = {
      id: 'fixture-fact', requirementId: 'harm.event', value: originalQuote,
      sourceIds: ['message-1'], sourceQuotes: [{ sourceId: 'message-1', quote: originalQuote }],
      status: 'unknown', certainty: 'uncertain', knowledge: 'heard', confirmed: false, eventId: 'one',
      relatedRequirementIds: ['fear.harm'], clarification: ['roles'],
      statements: [{ subject: null, action: 'Original action', object: 'Original object',
        polarity: 'negative', certainty: 'uncertain', knowledge: 'heard',
        sourceQuotes: [{ sourceId: 'message-1', quote: originalQuote }] }],
    };
    const session = { ...createSession('ar', 'test'), narrativeDone: true, guidedDone: true,
      facts: [fact], topicDecisions: { harm: 'skipped' } };
    const formatValue = (_id, value) => Array.isArray(value) ? value.join(' · ') : value;
    const label = id => journeyDetailTitle(id, 'UNTRANSLATED LABEL', 'ar');
    export function renderJourney() {
      return renderToStaticMarkup(<div lang="ar" dir="rtl">
        <TopicProgress session={session} language="ar" />
        <ReviewSummaries session={session} language="ar" busy={false} value={formatValue} label={label} onConfirm={noop} onCorrect={noop} />
        <StatementDetails fact={fact} language="ar" disabled={false} onClarify={noop} />
      </div>);
    }
    export function renderFinal() {
      return renderToStaticMarkup(<div lang="ar" dir="rtl"><FinalCheck session={session} language="ar" checked={true} ready={false} onCheck={noop} onReturn={noop} /></div>);
    }
    export const formPageCount = formSteps.length;
    export const datePage = formSteps.findIndex(step => step.fields.some(field => field.type === 'date'));
    export const tablePage = formSteps.findIndex(step => step.fields.some(field => field.type === 'table'));
    export function renderForm(page, answers = {}) {
      return renderToStaticMarkup(<div lang="ar" dir="rtl"><FormStage
        language="ar" answers={answers} page={page} copy={scriptedCopy.ar} back={intakeCopies.ar.back}
        next={intakeCopies.ar.continue} onChange={noop} onPage={noop} onDone={noop}
      /></div>);
    }
    export function renderTableForm() {
      const field = formSteps[tablePage].fields.find(field => field.type === 'table');
      const answers = Object.fromEntries((field.when ?? []).map(rule => [rule.id, { kind: 'choice', values: [rule.anyOf[0]] }]));
      return renderForm(tablePage, answers);
    }
    export function renderKoreanDraftField() {
      const field = { id: '14.2-detail', ko: '무슨 일이 있었는지', en: 'What happened', type: 'long' };
      return renderToStaticMarkup(<FieldInput field={field} language="ar" valueLanguage="ko"
        value={{ kind: 'text', text: koreanDraft }} copy={scriptedCopy.ar} onChange={noop} />);
    }
    export function renderSentence(proposal = false) {
      let saved;
      if (proposal) {
        const initial = createDocument(koreanDraft);
        const selected = initial.pieces.find(piece => piece.kind === 'sentence');
        const user = addUserMessage(initial, selected.id, 'يرجى توضيح هذه الجملة.');
        saved = addAssistantMessage(user, selected.id, { type: 'proposal', message: 'هذا اقتراح يحافظ على المعنى.', replacement: '이것은 수정 제안 문장입니다.' }, selected.revision);
      }
      return renderToStaticMarkup(<SentenceReview text={koreanDraft} saved={saved} uiLanguage="ar" onChange={noop} />);
    }
    export function renderMeaning() { return renderToStaticMarkup(<EnglishMeaning text={koreanDraft} uiLanguage="ar" />); }
    export function renderEditor() {
      return renderToStaticMarkup(<EditorModal title="مراجعة الجملة" closeLabel="إغلاق" uiLanguage="ar" onClose={noop}><p>محتوى المحرر</p></EditorModal>);
    }
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  loader: { '.css': 'empty' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_DARI_DEV_TOOLS': '"false"', 'import.meta.env': '{}' },
  plugins: [{ name: 'no-model-in-ssr', setup(api) {
    api.onResolve({ filter: /^\.\/queue$/ }, args => args.importer.includes('/revision/') ? { path: 'adapter', namespace: 'no-model' } : undefined);
    api.onLoad({ filter: /.*/, namespace: 'no-model' }, () => ({ contents: 'export async function generateReviewModel() { throw new Error("SSR must not call a model"); }', loader: 'js' }));
  } }],
});

const module = { exports: {} };
// A portal cannot be rendered by React's server renderer. Only the portal host
// is replaced with an identity function to inspect the real dialog's lang/dir
// markup; this does not test showModal, focus trapping, or DOM lifecycle.
const fixtureRequire = id => id === 'react-dom'
  ? { ...require(id), createPortal: children => children }
  : require(id);
new Function('require', 'module', 'exports', result.outputFiles[0].text)(fixtureRequire, module, module.exports);
const ui = module.exports;

const oldEnglish = [
  'Check the information grouped by topic and incident', 'This reflects what I told you',
  'Confirm information', 'See all topics', 'Items still to check', 'Before you save',
  'Check who did what', 'Clarify or correct this', 'Select a sentence',
  'Request an edit', 'Undo last edit', 'Preparing the English meaning', 'Loading…',
];
function noEnglishInstructions(html) {
  for (const phrase of oldEnglish) assert.ok(!html.includes(phrase), `Leaked UI instruction: ${phrase}`);
  assert.ok(!html.includes('UNTRANSLATED LABEL'));
}
function buttons(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)].map(match => ({ attributes: match[1], text: match[2].replace(/<[^>]*>/gu, '') }));
}

test('actual Arabic journey, review and statement components translate controls while preserving quoted evidence', () => {
  const html = ui.renderJourney();
  noEnglishInstructions(html);
  assert.match(html, /lang="ar" dir="rtl"/u);
  assert.match(html, /هذه المعلومات تعكس إجابتي بشكل صحيح/u);
  assert.match(html, /تأكيد المعلومات 1/u);
  assert.match(html, /التحقق ممن قام بالفعل وما فعله/u);
  assert.match(html, /غير مؤكد/u);
  assert.match(html, /منقول عن الآخرين/u);
  assert.ok(html.includes(ui.originalQuote), 'Application translation must not replace original evidence');
  assert.match(html, /<bdi dir="auto">Original English evidence must remain unchanged\.<\/bdi>/u);
  assert.match(html, /<dd dir="auto">Original action<\/dd>/u);
  assert.match(html, /<bdi>14\.3<\/bdi>/u);
});

test('Arabic final-check render states the current translation limitation and cannot display a false checked review', () => {
  const html = ui.renderFinal();
  noEnglishInstructions(html);
  assert.match(html, /المراجعة الأخيرة قبل الحفظ/u);
  assert.match(html, /بالإنجليزية فقط/u);
  assert.match(html, /ليست متاحة بالعربية/u);
  const inputs = [...html.matchAll(/<input\b[^>]*>/gu)].map(match => match[0]).filter(tag => tag.includes('type="checkbox"'));
  assert.equal(inputs.length, 1);
  assert.match(inputs[0], /\sdisabled(?:=|\s|>)/u);
  assert.doesNotMatch(inputs[0], /\schecked(?:=|\s|>)/u);
  assert.ok(buttons(html).some(button => button.text === 'العودة إلى المعلومات المجمّعة'));
});

test('all actual Arabic basic-form page renders have translated labels and a left-pointing forward action', () => {
  assert.ok(ui.formPageCount > 1);
  for (let page = 0; page < ui.formPageCount; page++) {
    const html = ui.renderForm(page);
    noEnglishInstructions(html);
    assert.match(html, /<div lang="ar" dir="rtl">/u);
    assert.doesNotMatch(html, /[\p{Script=Hangul}]/u, `Korean UI leaked on form page ${page}`);
    assert.doesNotMatch(html, />Continue<|>Back<|>I don.t know<|>Not applicable<|>Add another/u);
    assert.match(html, /<span aria-hidden="true">←<\/span>/u);
    assert.match(html, new RegExp(`<span dir="ltr">${page + 1} / ${ui.formPageCount}</span>`));
  }
  const dates = ui.renderForm(ui.datePage);
  const dateInputs = [...dates.matchAll(/<input\b[^>]*placeholder="سنة\/شهر\/يوم"[^>]*>/gu)].map(match => match[0]);
  assert.ok(dateInputs.length > 0);
  assert.ok(dateInputs.every(tag => /dir="ltr"/u.test(tag) && /title="[^"A-Za-z]*[\p{Script=Arabic}]/u.test(tag)));
  const table = ui.renderTableForm();
  assert.match(table, /class="table-entry"/u);
  assert.match(table, /<bdi dir="ltr">1<\/bdi>/u);
});

test('Korean draft content keeps its declared Korean LTR direction inside an Arabic form interface', () => {
  const html = ui.renderKoreanDraftField();
  assert.match(html, /<textarea lang="ko" dir="ltr"/u);
  assert.ok(html.includes(ui.koreanDraft));
  assert.match(html, /ما الذي حدث/u);
});

test('actual sentence editor renders Arabic instructions and preserves Korean content and approval guard', () => {
  for (const proposal of [false, true]) {
    const html = ui.renderSentence(proposal);
    noEnglishInstructions(html);
    assert.match(html, /class="sentence-review" lang="ar" dir="rtl"/u);
    assert.match(html, /class="revision-sentences" lang="ko" dir="ltr"/u);
    assert.ok(html.includes(ui.koreanDraft));
    assert.match(html, /ناقش هذه الجملة بالعربية/u);
    assert.match(html, /بالكورية والإنجليزية فقط/u);
    assert.match(html, /<textarea dir="auto"/u);
    if (proposal) {
      const apply = buttons(html).find(button => button.text === 'تطبيق هذا الاقتراح');
      assert.ok(apply);
      assert.match(apply.attributes, /\sdisabled(?:=|\s|$)/u);
      assert.match(html, /<p lang="ko" dir="ltr">이것은 수정 제안 문장입니다\.<\/p>/u);
    }
  }
});

test('meaning preparation displays Arabic loading and capability guidance, not hardcoded English', () => {
  const html = ui.renderMeaning();
  noEnglishInstructions(html);
  assert.match(html, /lang="ar" dir="rtl"/u);
  assert.match(html, /<p role="status">يجري إعداد المعنى باللغة الإنجليزية…<\/p>/u);
  assert.match(html, /لم تُدعَم مراجعة المعنى بالعربية بعد/u);
});

test('editor dialog presentation declares Arabic RTL even when portaled outside the app shell', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: { body: {} }, configurable: true, writable: true });
  try {
    const html = ui.renderEditor();
    assert.match(html, /<dialog[^>]*lang="ar" dir="rtl"/u);
    assert.match(html, /مراجعة الجملة/u);
    assert.ok(buttons(html).some(button => button.text === 'إغلاق'));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
