// Explicit integration smoke test using fictional data and the local preview server.
import { createSession, advanceConversation, generateDraft, getActiveFacts, exportSession, confirmFacts, calculateCoverage } from '../src/intake/index.ts';
import { writeFile, mkdir, readFile } from 'node:fs/promises';

const model = process.env.DARI_TEST_MODEL || 'gemma4:e4b';
let callIndex = 0;
const adapter = async request => {
  const start = Date.now();
  const response = await fetch('http://127.0.0.1:8765/v1/intake/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, model }), signal: AbortSignal.timeout(310000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  await mkdir('tmp', { recursive: true });
  await writeFile(`tmp/intake-model-${++callIndex}.json`, result.text);
  console.log(`${request.task}: ${Math.round((Date.now() - start) / 1000)}s`);
  return result.text;
};

let session = createSession('ko', 'priority');
try {
  const demoMode = process.env.DARI_TEST_DEMO === '1';
  const demoSource = demoMode ? (await readFile('src/App.tsx', 'utf8')).match(/const demoAnswer = '([^']+)';/)?.[1] : undefined;
  if (demoMode && !demoSource) throw new Error('UI demo fixture was not found');
  session = await advanceConversation(session,
    demoSource ?? '이것은 기능 시험을 위한 가상 사례입니다. 저는 정치적 의견 때문에 보호를 신청합니다. 2025년 3월쯤 경찰이라고 밝힌 두 사람이 제 집에 와서 제가 참가한 집회에 대해 물었습니다. 정확한 날짜는 기억나지 않습니다. 저를 때리거나 구금하지는 않았습니다. 그 뒤 다시 찾아올까 두려워 다른 도시로 갔습니다. 돌아가면 다시 조사를 받을까 두렵습니다.', adapter);
  console.log('Follow-up:', session.messages.at(-1).content);
  console.log('Extracted facts:', getActiveFacts(session).length);
  if (!demoMode) {
    session = await advanceConversation(session,
      '앞서 3월이라고 말했는데 정정하겠습니다. 4월쯤이었습니다. 그들이 경찰 신분증을 보여주었지만 이름은 기억하지 못합니다. 장소는 가상의 도시 A에 있는 제 집입니다. 다른 피해 사건은 없습니다.', adapter);
    console.log('Follow-up:', session.messages.at(-1).content);
  }
  // The fictional integration fixture simulates the user's explicit review action.
  const conflicts = new Set(calculateCoverage(session).filter(item => item.status === 'conflict').map(item => item.requirementId));
  session = confirmFacts(session, getActiveFacts(session).filter(fact => fact.status !== 'conflict' && !conflicts.has(fact.requirementId)).map(fact => fact.id));
  session = await generateDraft(session, adapter);
  console.log('Korean sections:', session.draft.map(item => ({ question: item.questionId, text: item.text })));
  await mkdir('tmp', { recursive: true });
  await writeFile('tmp/intake-smoke.json', exportSession(session));
  if (!session.draft.length) throw new Error('No draft returned');
  console.log('PASS: fictional source, grounded metadata, Korean draft exported to tmp/intake-smoke.json');
} catch (error) {
  if (error.session) session = error.session;
  await mkdir('tmp', { recursive: true });
  await writeFile('tmp/intake-smoke-failed.json', exportSession(session));
  console.error(error);
  process.exitCode = 1;
}
