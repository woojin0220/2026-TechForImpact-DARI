// Summarizes benchmark JSONL files (from run-intake-scenarios.mjs or the in-app
// bench panel) per run and language, worst language first.
//   node --experimental-strip-types scripts/bench-summary.mjs tmp/bench/*.jsonl
import { readFile } from 'node:fs/promises';
import { summarize, summaryTable } from '../src/bench/index.ts';

const files = process.argv.slice(2);
if (!files.length) throw new Error('JSONL 파일을 지정해 주세요.');
const rows = (await Promise.all(files.map(file => readFile(file, 'utf8'))))
  .flatMap(text => text.split('\n').filter(Boolean).map(line => JSON.parse(line)));
for (const runId of [...new Set(rows.map(row => row.runId))]) {
  const own = rows.filter(row => row.runId === runId);
  const meta = own.find(row => row.type === 'meta');
  console.log(`\n## ${runId}\n${JSON.stringify(meta?.config ?? {})}${meta?.device ? `\n${JSON.stringify(meta.device)}` : ''}\n`);
  console.log(summaryTable(summarize(own)));
  const failed = own.filter(row => row.type === 'session').flatMap(row => row.checks.filter(check => check.safety && !check.ok).map(check => `${row.lang}/${row.scenario}: ${check.label}`));
  if (failed.length) console.log(`\n안전 검사 실패:\n${failed.map(item => `- ${item}`).join('\n')}`);
}
