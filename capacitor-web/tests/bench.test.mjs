import assert from 'node:assert/strict';
import test from 'node:test';
import { benchLanguages, runScenario, scenarios, summarize, summaryTable } from '../src/bench/index.ts';

test('every scenario has the same turns in every candidate language', () => {
  for (const scenario of scenarios) {
    for (const lang of benchLanguages) {
      assert.equal(scenario.turns[lang]?.length, scenario.turns.ko.length, `${scenario.id}/${lang}`);
      assert.ok(scenario.turns[lang].every(turn => turn.trim()), `${scenario.id}/${lang}`);
    }
  }
});

test('per-language expected words appear in that language\'s source text', () => {
  // Free-text values stay in the applicant's language, so a localized check whose
  // word is not in the story would be impossible to pass (or trivially pass for lacks).
  for (const scenario of scenarios) {
    for (const check of scenario.checks) {
      const spec = Object.values(check)[0];
      if (!spec.includes || typeof spec.includes === 'string') continue;
      for (const lang of benchLanguages) {
        const words = [spec.includes[lang]].flat();
        assert.ok(words.length && words.every(Boolean), `${scenario.id}/${lang} ${spec.field}`);
        const source = scenario.turns[lang].join(' ');
        assert.ok(words.some(word => source.includes(word)), `${scenario.id}/${lang} ${spec.field}: ${words.join('|')}`);
      }
    }
  }
});

test('runScenario records every call and scores safety separately', async () => {
  const quote = '2024년 가을쯤 정부를 비판하는 글을 인터넷에 올린 뒤 경찰이 집에 찾아와서 그 글에 대해 두 시간 동안 조사했습니다.';
  const fact = (requirementId, value, eventId = 'general') => ({ requirementId, value, status: 'answered', certainty: 'approximate', knowledge: 'direct',
    sourceIds: ['message-2'], sourceQuotes: [{ sourceId: 'message-2', quote }], eventId, supersedes: [] });
  let extractions = 0;
  const adapter = async request => {
    if (request.system.startsWith('List every topic')) return { text: '{"groups":[]}' };
    if (request.task === 'draft') return { text: 'not json' };
    extractions += 1;
    const facts = extractions === 1 ? [fact('grounds.category', ['political']), fact('harm', 'yes'), fact('harm.time', '2024년 가을쯤', 'harm-1'), fact('harm.type', ['questioning'], 'harm-1')] : [];
    return { text: JSON.stringify({ reply: '그때 어떤 일이 있었나요?', facts }), stats: { runtime: 'litertlm', prefillTokens: 1500, decodeTokPerSec: 12, ttftMs: 900, peakRssMB: 3100 } };
  };
  const rows = [];
  const basic = scenarios.find(item => item.id === 'basic');
  const { result, calls } = await runScenario(basic, 'ko', adapter, { runId: 'test', onRow: row => rows.push(row) });

  assert.ok(calls.length >= 2);
  assert.equal(calls.filter(call => call.turn === 'draft').length, 2, 'one draft attempt plus one repair');
  assert.ok(calls.every(call => call.turn === 'draft' ? !call.jsonOk : call.jsonOk));
  assert.equal(rows.at(-1).type, 'session');
  assert.match(result.error, /^초안/);
  const label = text => result.checks.find(check => check.label.includes(text));
  assert.equal(label('harm.time').ok, true);
  assert.equal(label('fear').ok, false);
  // The failed draft has no text: "has" fails, while "lacks" (a safety check) holds.
  assert.equal(label('초안 14.2 ⊃').ok, false);
  assert.equal(label('초안 14.2 ⊅ "글 때문에"').safety, true);
  assert.equal(label('departure.date').ok, true, 'a date never mentioned stays empty');
  assert.equal(result.safetyTotal, 7);

  const [summary] = summarize(rows);
  assert.equal(summary.lang, 'ko');
  assert.equal(summary.failedSessions, 1);
  assert.equal(summary.safetyTotal, 0, 'safety is not credited for a session that failed');
  assert.equal(summary.peakMemMB, 3100);
  assert.match(summaryTable([summary]), /\| ko \| 1\(1\) \|/);
});
