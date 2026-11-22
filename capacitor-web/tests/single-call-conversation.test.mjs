import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceConversation,continueConversation,createSession,getActiveFacts,guideConversation,
  needsTopicQuestion,finishNarrative,setAuxiliaryPasses,setExtractionFormat,IntakeError} from '../src/intake/index.ts';

const single = handler => Object.assign(handler, {conversationMode:'single-call'});
// Exercise the strongest legacy setting: the adapter policy must override it.
setAuxiliaryPasses('on');

test('one extraction handles negations and bare yes, including the next local question', async () => {
  for (const facts of [[],[{r:'fear',v:'yes',k:'d',q:['2.1']}]]) {
    let calls=0;
    const adapter=single(async request=>{
      calls++;
      assert.match(request.system,/only extraction pass/);
      return JSON.stringify({reply:'Thank you.',facts});
    });
    const original=createSession('en','priority');
    const result=await advanceConversation(original,
      'I am afraid to return. I could not ask the police for help because they threatened me. I never belonged to any organization.',adapter);
    assert.equal(calls,1);
    assert.equal(needsTopicQuestion(result),false);
    assert.equal(result.messages.at(-1).ask.kind,'narrative');
    assert.equal(result.messages.at(-1).ask.topics.length,1);
    assert.equal(await guideConversation(result,adapter),result,'App effect cannot trigger another call');
    assert.equal(calls,1);
    assert.equal(original.messages.length,1,'source session stays immutable');
    if(facts.length)assert.equal(getActiveFacts(result).find(f=>f.requirementId==='fear').value,'yes');
  }
});

test('local guidance works in every supported language without invoking an adapter', async () => {
  for (const [language,script] of [['ko',/\p{Script=Hangul}/u],['en',/Next/],['fr',/interroger/],['ru',/\p{Script=Cyrillic}/u],['ar',/\p{Script=Arabic}/u],['fa',/\p{Script=Arabic}/u]]) {
    const session=finishNarrative(createSession(language,'priority'));
    const result=await guideConversation(session,single(async()=>{throw Error('must remain local');}));
    assert.match(result.messages.at(-1).content,script,language);
    assert.ok(!result.messages.at(-1).content.includes('{topic}'));
    assert.equal(Object.values(result.topicAttempts).reduce((a,b)=>a+b,0),1);
  }
});

test('invalid provenance fails after one call and explicit retry preserves one user answer', async () => {
  setExtractionFormat('full');
  let calls=0,saved;
  const adapter=single(async()=>{
    calls++;
    return JSON.stringify({reply:'Thank you.',facts:[{requirementId:'fear',value:'yes',status:'answered',
      certainty:'exact',knowledge:'direct',sourceIds:['message-2'],sourceQuotes:[{sourceId:'message-2',quote:'fabricated quotation'}]}]});
  });
  try {
    await assert.rejects(advanceConversation(createSession('en','priority'),'I am afraid to return.',adapter),error=>{
      assert.ok(error instanceof IntakeError);saved=error.session;return /인용/.test(error.message);
    });
    assert.equal(calls,1);
    const retry=await continueConversation(saved,single(async()=>{calls++;return JSON.stringify({reply:'Thank you.',facts:[]});}));
    assert.equal(calls,2);
    assert.equal(retry.messages.filter(m=>m.role==='user').length,1);
    assert.equal(needsTopicQuestion(retry),false);
  } finally {setExtractionFormat('compact');}
});

test('cancelled extraction cannot append a local question or start another request', async () => {
  const controller=new AbortController();let calls=0;
  await assert.rejects(advanceConversation(createSession('en','priority'),'I do not remember.',single(async()=>{
    calls++;controller.abort();return JSON.stringify({reply:'Thank you.',facts:[]});
  }),controller.signal));
  assert.equal(calls,1);
});
