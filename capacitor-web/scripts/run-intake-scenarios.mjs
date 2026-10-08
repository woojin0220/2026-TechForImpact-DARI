// Runs the fictional scenarios against the local preview server and scores the
// collected question 14 metadata. Usage (from capacitor-web, server + Ollama running):
//   node --experimental-strip-types scripts/run-intake-scenarios.mjs            # all
//   node --experimental-strip-types scripts/run-intake-scenarios.mjs basic correction
import { appendAssistantMessage, appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, generateDraft, deriveQuestion14, getActiveFacts, narrativeOpening, requirementsById, exportSession } from '../src/intake/index.ts';
import { scenarios } from './intake-scenarios.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const model = process.env.DARI_TEST_MODEL || 'gemma4:e4b';
const adapter = async request => {
  const response = await fetch('http://127.0.0.1:8765/v1/intake/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, model }), signal: AbortSignal.timeout(310000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.text;
};

// One slow call must not fail the rest: the server keeps working after a client
// timeout and rejects new requests until it finishes, so wait until it is idle.
async function waitIdle(limitMs = 600000) {
  const until = Date.now() + limitMs;
  while (Date.now() < until) {
    try { const status = await (await fetch('http://127.0.0.1:8765/v1/intake/status')).json(); if (!status.busy) return; } catch { /* server restarting */ }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

const values = fact => (Array.isArray(fact.value) ? fact.value : [fact.value]).join(' ');
function eventIds(facts, group) {
  return [...new Set(facts.filter(fact => requirementsById.get(fact.requirementId)?.parentId === group && fact.eventId).map(fact => fact.eventId))];
}
function pick(facts, field, event) {
  const group = field.split('.')[0];
  const id = event ? eventIds(facts, group)[event - 1] : undefined;
  return facts.filter(fact => fact.requirementId === field && (!event || fact.eventId === id));
}

function check(facts, session, item) {
  const [kind, spec] = Object.entries(item)[0];
  const found = spec.field ? pick(facts, spec.field, spec.event) : [];
  const answered = found.filter(fact => fact.status === 'answered');
  const shown = found.map(fact => `${fact.status}:${values(fact)}`).join(' | ') || '(없음)';
  switch (kind) {
    case 'gate': { const fact = facts.find(f => f.requirementId === spec.gate); return [fact?.status === 'answered' && fact.value === spec.value, `${spec.gate} = ${spec.value}`, fact ? `${fact.status}:${values(fact)}` : '(없음)']; }
    case 'events': { const ids = eventIds(facts, spec.group); return [ids.length === spec.count, `${spec.group} 사건 ${spec.count}개`, `${ids.length}개 ${ids.join(', ')}`]; }
    case 'has': return [answered.some(fact => values(fact).includes(spec.includes)), `${spec.field}${spec.event ? `#${spec.event}` : ''} ⊃ "${spec.includes}"`, shown];
    case 'lacks': return [!answered.some(fact => values(fact).includes(spec.includes)), `${spec.field}${spec.event ? `#${spec.event}` : ''} ⊅ "${spec.includes}"`, shown];
    case 'notAnswered': return [!answered.length, `${spec.field}${spec.event ? `#${spec.event}` : ''} 답변으로 기록되지 않음`, shown];
    case 'status': return [found.length > 0 && found.every(fact => spec.in.includes(fact.status)), `${spec.field} 상태 ∈ ${spec.in}`, shown];
    case 'knowledge': return [found.length > 0 && found.every(fact => spec.in.includes(fact.knowledge)), `${spec.field} 경위 ∈ ${spec.in}`, found.map(fact => fact.knowledge).join(', ') || '(없음)'];
    case 'derived': { const box = deriveQuestion14(session).find(entry => entry.id === spec.id); return [box?.value === spec.value, `${spec.id} = ${spec.value}`, box?.value ?? '(없음)']; }
    default: return [false, `알 수 없는 검사 ${kind}`, ''];
  }
}

const selected = process.argv.slice(2);
const results = [];
await mkdir('tmp/scenarios', { recursive: true });
for (const scenario of scenarios.filter(item => !selected.length || selected.includes(item.id))) {
  console.log(`\n■ ${scenario.id} — ${scenario.title}`);
  let session = appendAssistantMessage(createSession('ko', 'full'), narrativeOpening('ko'), { kind: 'narrative' });
  const started = Date.now();
  let error;
  for (const turn of scenario.turns) {
    try {
      await waitIdle();
      const asked = appendUserMessage(session, turn);
      try { session = await continueConversation(asked, adapter); }
      catch (failure) {
        if (!/처리하고 있습니다|timeout|aborted/i.test(failure.message)) throw failure;
        console.log(`  … 서버가 바빠 기다렸다가 다시 시도: ${failure.message}`);
        await waitIdle();
        session = await continueConversation(asked, adapter);
      }
      console.log(`  사용자: ${turn.slice(0, 50)}…\n  DARI: ${session.messages.at(-1).content}`);
    } catch (failure) {
      error = failure.message; session = failure.session ?? session;
      console.log(`  ✖ 턴 실패: ${error}`); break;
    }
  }
  const facts = getActiveFacts(session);
  let passed = 0;
  for (const item of scenario.checks) {
    const [ok, label, actual] = check(facts, session, item);
    if (ok) passed += 1;
    console.log(`  ${ok ? '✔' : '✖'} ${label}${ok ? '' : `  → 실제: ${actual}`}`);
  }
  let total = scenario.checks.length;
  if (scenario.draft && !error) {
    // Simulates the applicant's explicit review, then writes the Korean draft.
    const conflicts = new Set(calculateCoverage(session).filter(item => item.status === 'conflict').map(item => item.requirementId));
    try {
      await waitIdle();
      session = await generateDraft(confirmFacts(session, getActiveFacts(session).filter(fact => fact.status !== 'conflict' && !conflicts.has(fact.requirementId)).map(fact => fact.id)), adapter);
    } catch (failure) { console.log(`  ✖ 초안 실패: ${failure.message}`); }
    for (const spec of scenario.draft) {
      const text = session.draft.find(section => section.questionId === spec.question)?.text ?? '';
      for (const word of spec.has ?? []) { total += 1; const ok = text.includes(word); if (ok) passed += 1; console.log(`  ${ok ? '✔' : '✖'} 초안 ${spec.question} ⊃ "${word}"${ok ? '' : `  → ${text.slice(0, 160)}`}`); }
      for (const word of spec.lacks ?? []) { total += 1; const ok = !text.includes(word); if (ok) passed += 1; console.log(`  ${ok ? '✔' : '✖'} 초안 ${spec.question} ⊅ "${word}"${ok ? '' : `  → ${text.slice(0, 160)}`}`); }
    }
  }
  console.log(`  ${passed}/${total} 통과 · ${Math.round((Date.now() - started) / 1000)}초`);
  results.push({ id: scenario.id, passed, total, error });
  await writeFile(`tmp/scenarios/${scenario.id}.json`, exportSession(session));
}
const sum = results.reduce((total, item) => total + item.passed, 0);
const all = results.reduce((total, item) => total + item.total, 0);
console.log(`\n합계 ${sum}/${all} 검사 통과 (${model})`);
for (const item of results) console.log(`  ${item.passed === item.total ? '✔' : '✖'} ${item.id} ${item.passed}/${item.total}${item.error ? ` (턴 실패: ${item.error})` : ''}`);
