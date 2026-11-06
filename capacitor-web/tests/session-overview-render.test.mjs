import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { overviewCopies } from '../src/sessionOverview/copy.ts';

const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const compiled = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, sourcefile: 'tests/session-overview-render.fixture.tsx', contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { SessionOverview } from './src/sessionOverview/SessionOverview';
    import { createSession } from './src/intake';
    import { createDocument, addUserMessage, addAssistantMessage, applySuggestion, storeTranslation } from './src/revision/state.mjs';
    export const raw = 'Original user text <script>alert(1)</script> with an exact uncertainty: I do not know.';
    const fact = (id, requirementId, value, confirmed, status = 'answered') => ({
      id, requirementId, value, confirmed, status, certainty:'uncertain', knowledge:'heard',
      sourceIds:['u1'], sourceQuotes:[{sourceId:'u1',quote:raw}],
    });
    const old = fact('old-fact', 'harm.event', 'Previous collected value', true);
    const current = {...fact('current-fact', 'harm.event', 'Current confirmed value', true), supersedes:['old-fact']};
    const unclear = fact('conflict-fact', 'fear.harm', 'Unresolved contradictory value', true, 'conflict');
    const unconfirmed = fact('new-fact', 'grounds.summary', 'Unconfirmed extracted value', false);
    let doc = createDocument('최초 한국어 초안 문장입니다.');
    const sentence = doc.pieces.find(piece => piece.kind === 'sentence');
    doc = addUserMessage(doc, sentence.id, 'Please preserve the negative statement in my draft.');
    doc = addAssistantMessage(doc, sentence.id, {type:'proposal', message:'A synthetic wording suggestion.', replacement:'부정 표현을 보존한 한국어 초안입니다.'}, sentence.revision);
    const proposal = doc.threads[sentence.id].at(-1);
    doc = applySuggestion(doc, sentence.id, proposal.id);
    const updated = doc.pieces.find(piece => piece.kind === 'sentence');
    doc = storeTranslation(doc, updated.id, 'en', 'A stored English review translation.', updated.revision);
    const session = {
      ...createSession('ar','full'),
      form:{'1.2':{kind:'text',text:'FORM-ORIGINAL'}, 'unknown.future':{kind:'text',text:'Future stored value'},
        '1.1':{kind:'choice',values:['no']}, '3.1':{kind:'table',rows:[{unknownColumn:'Table value that must remain',empty:''}]},
        '2.1':{kind:'status',status:'unknown'}},
      facts:[old,current,unclear,unconfirmed],
      messages:[
        {id:'a1',role:'assistant',content:'Original first question',createdAt:'2026-11-05',ask:{kind:'narrative',topics:['harm']}},
        {id:'u1',role:'user',content:raw,createdAt:'2026-11-05'},
        {id:'u2',role:'user',content:'Unlinked failed-extraction reply',createdAt:'2026-11-05'},
        {id:'a2',role:'assistant',content:'Follow-up question',createdAt:'2026-11-05',ask:{kind:'field',requirementId:'fear.harm'}},
        {id:'u3',role:'user',content:'Latest exact original reply',createdAt:'2026-11-05'},
      ],
      question14:{'14.2-detail':{kind:'text',text:'사용자가 수정한 현재 한국어 답변입니다.'}, '14.future':{kind:'text',text:'Unknown current draft value'}},
      draft:[{questionId:'14.2',text:'모델이 생성한 한국어 초안입니다.',factIds:['current-fact'],sourceIds:['u1'],sentences:[]}, {questionId:'99.77',text:'Unknown generated draft value',factIds:[],sourceIds:[],sentences:[]}],
      draftReviews:{'14.2-detail':doc, '14.future':{...doc, pieces:[{kind:'sentence',id:'future-sentence',text:'Unknown review current text',originalText:'Unknown review original text',revision:0}],threads:{},history:[],undo:[],translations:{}}}, topicDecisions:{family_harm:'skipped'},
    };
    const noop = () => {};
    export function render(language='ar', busy=false) {
      return renderToStaticMarkup(<SessionOverview session={session} language={language} pendingText="Not sent yet: preserve this exact text." busy={busy} onClose={noop} onEdit={noop} />);
    }
    export function empty() { return renderToStaticMarkup(<SessionOverview session={{...createSession('ko','full'),messages:[]}} language="ko" onClose={noop} onEdit={noop} />); }
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'], loader: { '.css': 'empty' },
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, mod, mod.exports);
const ui = mod.exports;

function factArticle(html, id) {
  const start = html.indexOf(`data-overview-fact="${id}"`);
  assert.notEqual(start, -1);
  return html.slice(start, html.indexOf('</article>', start));
}
function buttons(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)].map(match => ({ attributes: match[1], text: match[2].replace(/<[^>]*>/gu, '') }));
}

test('overview copy has complete matching keys in all six selectable languages', () => {
  const expected = Object.keys(overviewCopies.en).sort();
  for (const [language, values] of Object.entries(overviewCopies)) {
    assert.deepEqual(Object.keys(values).sort(), expected, language);
    assert.ok(Object.values(values).every(value => value.trim().length > 0), language);
  }
  assert.ok(Object.values(overviewCopies.ar).every(value => /\p{Script=Arabic}/u.test(value)));
});

test('actual overview renders every original transcript message exactly once and escapes raw content', () => {
  const html = ui.render();
  assert.equal([...html.matchAll(/data-overview-message=/gu)].length, 5);
  for (const id of ['a1','u1','u2','a2','u3']) assert.equal([...html.matchAll(new RegExp(`data-overview-message="${id}"`, 'gu'))].length, 1);
  assert.ok(html.includes('Original first question'));
  assert.ok(html.includes('Unlinked failed-extraction reply'));
  assert.ok(html.includes('Latest exact original reply'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Not sent yet: preserve this exact text.'));
});

test('overview keeps directly entered form values, unknown schema keys, table cells, draft edits and review records', () => {
  const html = ui.render();
  for (const text of ['FORM-ORIGINAL','Future stored value','Table value that must remain','사용자가 수정한 현재 한국어 답변입니다.','모델이 생성한 한국어 초안입니다.','최초 한국어 초안 문장입니다.','부정 표현을 보존한 한국어 초안입니다.','Please preserve the negative statement in my draft.','A synthetic wording suggestion.','A stored English review translation.']) assert.ok(html.includes(text), text);
  assert.match(html, /data-overview-field="unknown.future"/u);
  assert.ok(html.includes(overviewCopies.ar.noValue));
  assert.ok(html.includes(overviewCopies.ar.decisions));
  assert.ok(html.includes(overviewCopies.ar.skipped));
});

test('unknown stored form and draft fields remain visible without a misleading edit action', () => {
  const html = ui.render('ko');
  for (const id of ['unknown.future','14.future']) {
    const start = html.indexOf(`data-overview-field="${id}"`);
    assert.notEqual(start,-1,id);
    const article = html.slice(start,html.indexOf('</article>',start));
    assert.ok(article.includes(overviewCopies.ko.unsupportedEdit),id);
    assert.ok(!article.includes('<button'),id);
  }
  assert.ok(html.includes('Unknown current draft value'));
  assert.ok(html.includes('Unknown generated draft value'));
  assert.ok(html.includes('Unknown review original text'));
  assert.ok(html.includes('Unknown review current text'));
});

test('only currently confirmed nonconflicting facts have the user-confirmed label', () => {
  const html = ui.render('ko');
  assert.ok(factArticle(html,'current-fact').includes(overviewCopies.ko.confirmed));
  assert.ok(factArticle(html,'new-fact').includes(overviewCopies.ko.unconfirmed));
  assert.ok(!factArticle(html,'new-fact').includes(overviewCopies.ko.confirmed));
  assert.ok(factArticle(html,'conflict-fact').includes(overviewCopies.ko.conflict));
  assert.ok(!factArticle(html,'conflict-fact').includes(overviewCopies.ko.confirmed));
  assert.ok(factArticle(html,'old-fact').includes(overviewCopies.ko.previousRecord));
  assert.ok(!factArticle(html,'old-fact').includes(overviewCopies.ko.confirmed));
});

test('overview has Arabic RTL chrome and Korean LTR draft islands without translating original values', () => {
  const html = ui.render('ar');
  assert.match(html, /<dialog[^>]*class="overview-modal"[^>]*lang="ar" dir="rtl"/u);
  assert.match(html, /lang="ko" dir="ltr">사용자가 수정한 현재 한국어 답변입니다\./u);
  for (const text of [overviewCopies.ar.title,overviewCopies.ar.forms,overviewCopies.ar.collected,overviewCopies.ar.original,overviewCopies.ar.conversation,overviewCopies.ar.close]) assert.ok(html.includes(text),text);
  for (const text of [overviewCopies.en.title,overviewCopies.en.edit,overviewCopies.en.conversation,overviewCopies.en.collected]) assert.ok(!html.includes(text),text);
  assert.ok(html.includes('Current confirmed value'));
  const labelledBy = /aria-labelledby="([^"]+)"/u.exec(html)?.[1];
  assert.ok(labelledBy && html.includes(`id="${labelledBy}"`));
});

test('overview renders each supported locale, disabling only edit navigation while processing', () => {
  for (const language of Object.keys(overviewCopies)) {
    const copy=overviewCopies[language], html=ui.render(language,true), controls=buttons(html);
    assert.ok(html.includes(copy.title),language);
    const close=controls.find(button=>button.text===copy.close);
    assert.ok(close && !/\sdisabled(?:=|\s|$)/u.test(close.attributes),language);
    const edit=controls.filter(button=>button.text===copy.edit || button.text===copy.continueConversation);
    assert.ok(edit.length>0 && edit.every(button=>/\sdisabled(?:=|\s|$)/u.test(button.attributes)),language);
    assert.ok(html.includes(copy.busyNote),language);
  }
});

test('empty overview explains that no data has been entered and keeps a close action', () => {
  const html=ui.empty();
  assert.ok(html.includes(overviewCopies.ko.empty));
  assert.ok(buttons(html).some(button=>button.text===overviewCopies.ko.close));
});
