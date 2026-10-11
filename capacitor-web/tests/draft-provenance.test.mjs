import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, generateDraft, exportSession } from '../src/intake/index.ts';
import { draftResponseSchema } from '../src/intake/responseSchemas.ts';
const fact = (id, requirementId, value, sourceIds) => ({ id, requirementId, value, sourceIds, sourceQuotes: sourceIds.map(sourceId => ({ sourceId, quote:value })), status:'answered', certainty:'exact', knowledge:'direct', confirmed:true });
const session = () => ({ ...createSession('en','test'), facts: [
  fact('fact-1','grounds.summary','I was threatened.',['message-2']),
  fact('fact-2','grounds.summary','I fear returning.',['message-4','message-2']),
] });
test('draft schema asks for fact links only, not redundant source links', () => {
  const sentence = draftResponseSchema('14.1',['fact-1']).properties.sections.items.properties.sentences.items;
  assert.deepEqual(sentence.required, ['text','factIds']);
  assert.equal(sentence.properties.sourceIds, undefined);
});
test('missing or incorrect model source IDs cannot corrupt canonical provenance', async () => {
  for (const extra of [{}, { sourceIds:['message-999'] }, { sourceIds:['message-2'] }]) {
    let calls = 0;
    const result = await generateDraft(session(), async request => {
      calls++;
      assert.match(request.system, /Do not output sourceIds/);
      return JSON.stringify({sections:[{questionId:'14.1',sentences:[{text:'위협을 받았고 돌아가는 것이 두렵습니다.',factIds:['fact-1','fact-2'],...extra}]}]});
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.draft[0].sentences[0].sourceIds, ['message-2','message-4']);
    assert.deepEqual(JSON.parse(exportSession(result)).draft.sections[0].sourceIds, ['message-2','message-4']);
  }
});
test('invalid fact IDs and absent evidence still block drafts', async () => {
  for (const ids of [[], ['fact-999']]) {
    await assert.rejects(generateDraft(session(), async () => JSON.stringify({sections:[{questionId:'14.1',sentences:[{text:'위협을 받았습니다.',factIds:ids}]}]})), /근거/);
  }
  const broken = session(); broken.facts[0].sourceIds = [];
  await assert.rejects(generateDraft(broken, async () => JSON.stringify({sections:[{questionId:'14.1',sentences:[{text:'위협을 받았습니다.',factIds:['fact-1','fact-2']}]}]})), /원문 근거/);
});
