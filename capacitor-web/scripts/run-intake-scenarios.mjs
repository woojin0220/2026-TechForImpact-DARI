// Runs the fictional scenarios (src/bench/scenarios.ts) and scores the collected
// question 14 metadata, recording latency, tokens and memory per model call.
// Usage (from capacitor-web):
//   node --experimental-strip-types scripts/run-intake-scenarios.mjs [scenario ...] [options]
//
//   --backend ollama|litertlm   ollama: local preview server + Ollama (default)
//                               litertlm: the phone's .litertlm file on this Mac (tools/litertlm-bench)
//   --model M                   Ollama tag (default gemma4:e4b or $DARI_TEST_MODEL) or .litertlm path
//   --format schema|json|none   Ollama output constraint (default schema)
//   --constrained on|off        LiteRT-LM JSON-schema constrained decoding (default off, the app default)
//   --accel gpu|cpu             LiteRT-LM backend (default gpu)
//   --ctx N                     LiteRT-LM context window in tokens (default 16384)
//   --lang ko,fa,ar | all       languages (default ko)
//   --repeat N                  runs per scenario and language (default 1)
//   --label L                   name for the output file
// Rows go to tmp/bench/<time>-<label>.jsonl; summarize with scripts/bench-summary.mjs.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import { createInterface } from 'node:readline';
import { exportSession } from '../src/intake/index.ts';
import { benchLanguages, runScenario, scenarios, summarize, summaryTable } from '../src/bench/index.ts';

const args = process.argv.slice(2);
const flags = {};
const selected = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index].startsWith('--')) flags[args[index].slice(2)] = args[++index];
  else selected.push(args[index]);
}
const backend = flags.backend ?? 'ollama';
const langs = !flags.lang ? ['ko'] : flags.lang === 'all' ? [...benchLanguages] : flags.lang.split(',');
const repeat = Number(flags.repeat ?? 1);
if (!['ollama', 'litertlm'].includes(backend)) throw new Error(`알 수 없는 backend: ${backend}`);
if (langs.some(lang => !benchLanguages.includes(lang))) throw new Error(`지원 언어: ${benchLanguages.join(', ')}`);
const chosen = scenarios.filter(item => !selected.length || selected.includes(item.id));
if (!chosen.length) throw new Error(`시나리오 ID: ${scenarios.map(item => item.id).join(', ')}`);

let adapter;
let retryTurn = async () => false;
let close = () => {};
let config;
if (backend === 'ollama') {
  const model = flags.model ?? process.env.DARI_TEST_MODEL ?? 'gemma4:e4b';
  const format = flags.format ?? 'schema';
  config = { backend, model, format };
  // The server keeps working after a client timeout and rejects new requests until
  // it finishes, so wait until it is idle before each call.
  const waitIdle = async (limitMs = 600000) => {
    const until = Date.now() + limitMs;
    while (Date.now() < until) {
      try { const status = await (await fetch('http://127.0.0.1:8765/v1/intake/status')).json(); if (!status.busy) return; } catch { /* server restarting */ }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };
  adapter = async request => {
    await waitIdle();
    const response = await fetch('http://127.0.0.1:8765/v1/intake/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: request.task, system: request.system, prompt: request.prompt, responseSchema: request.responseSchema, model, format }),
      signal: AbortSignal.timeout(310000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return { text: result.text, stats: result.stats };
  };
  retryTurn = async failure => {
    if (!/처리하고 있습니다|timeout|aborted/i.test(failure.message)) return false;
    console.log(`  … 서버가 바빠 기다렸다가 다시 시도: ${failure.message}`);
    await waitIdle();
    return true;
  };
} else {
  if (!flags.model?.endsWith('.litertlm')) throw new Error('--model 에 .litertlm 파일 경로를 지정해 주세요.');
  const binary = new URL('../../tools/litertlm-bench/.build/release/litertlm-bench', import.meta.url).pathname;
  await access(binary).catch(() => { throw new Error('먼저 빌드하세요: swift build -c release --package-path tools/litertlm-bench'); });
  const accel = flags.accel ?? 'gpu';
  const ctx = Number(flags.ctx ?? 16384);
  const constrained = flags.constrained === 'on';
  config = { backend, model: flags.model.split('/').at(-1), accel, ctx, constrained };
  const child = spawn(binary, ['--model', flags.model, '--backend', accel, '--max-num-tokens', String(ctx)], { stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = new Map();
  let nextId = 1;
  createInterface({ input: child.stdout }).on('line', line => {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error)); else waiter.resolve({ text: message.text, stats: message.stats });
  });
  child.on('exit', code => { for (const waiter of pending.values()) waiter.reject(new Error(`litertlm-bench 종료 (${code})`)); pending.clear(); });
  // Same generation settings as the phone adapter (src/lib/intakeModel.ts).
  adapter = request => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ id, system: request.system, prompt: request.prompt, maxTokens: request.task === 'draft' ? 4096 : 3072, temperature: 0.1,
      ...(constrained && request.responseSchema ? { responseSchema: request.responseSchema } : {}) })}\n`);
  });
  close = () => child.stdin.end();
}

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${flags.label ?? `${backend}-${config.model}`.replace(/[^\w.-]+/g, '_')}`;
await mkdir('tmp/bench', { recursive: true });
await mkdir('tmp/scenarios', { recursive: true });
const file = `tmp/bench/${runId}.jsonl`;
const out = createWriteStream(file);
const rows = [];
const write = row => { rows.push(row); out.write(`${JSON.stringify(row)}\n`); };
write({ type: 'meta', runId, startedAt: new Date().toISOString(), config: { ...config, langs, scenarios: chosen.map(item => item.id), repeat },
  device: { kind: 'host', platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, totalRamMB: Math.round(os.totalmem() / 1048576) } });

// Unrecorded warm-up so a cold model load does not land in (or time out) the first measured turn.
console.log('모델 예열 중…');
await adapter({ task: 'intake', system: 'Return ONLY JSON {"ok":true}.', prompt: '{}' }).catch(error => console.log(`  예열 실패 (계속 진행): ${error.message}`));

for (let round = 1; round <= repeat; round += 1) {
  for (const lang of langs) {
    for (const scenario of chosen) {
      console.log(`\n■ ${scenario.id} [${lang}${repeat > 1 ? ` #${round}` : ''}] — ${scenario.title}`);
      const { session, result } = await runScenario(scenario, lang, adapter, { runId, repeat: round, onRow: write, retryTurn });
      for (const [index, turn] of scenario.turns[lang].entries()) {
        const reply = session.messages.filter(item => item.role === 'assistant')[index + 1]?.content;
        console.log(`  사용자: ${turn.slice(0, 50)}…${reply ? `\n  DARI: ${reply}` : ''}`);
      }
      if (result.error) console.log(`  ✖ 실패: ${result.error}`);
      for (const check of result.checks) console.log(`  ${check.ok ? '✔' : '✖'}${check.safety ? ' [안전]' : ''} ${check.label}${check.ok ? '' : `  → 실제: ${check.actual}`}`);
      console.log(`  ${result.passed}/${result.total} 통과 · 안전 ${result.safetyPassed}/${result.safetyTotal} · ${Math.round(result.ms / 1000)}초`);
      await writeFile(`tmp/scenarios/${scenario.id}-${lang}${repeat > 1 ? `-r${round}` : ''}.json`, exportSession(session));
    }
  }
}
close();
out.end();
console.log(`\n${JSON.stringify(config)}\n${summaryTable(summarize(rows))}\n\n기록: ${file}`);
