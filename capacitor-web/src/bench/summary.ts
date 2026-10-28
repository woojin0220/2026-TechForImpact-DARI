import type { BenchRow } from './types.ts';

export type LanguageSummary = {
  lang: string; sessions: number; failedSessions: number;
  /** Non-safety checks passed / total, over every session. */
  quality: number;
  /** Safety checks are only meaningful when the conversation ran: a session whose turn
   * failed extracted nothing and would pass "did not invent" checks trivially. */
  safetyPassed: number; safetyTotal: number;
  callsPerTurn: number; jsonFailRate: number;
  turnP50: number; turnP90: number; draftP50?: number;
  /** The app's separate next-question call after a turn (from runs that time it). */
  questionP50?: number;
  promptTokens?: number; decodeTokPerSec?: number; ttftP50?: number; peakMemMB?: number;
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

export function summarize(rows: BenchRow[]): LanguageSummary[] {
  const sessions = rows.filter((row): row is Extract<BenchRow, { type: 'session' }> => row.type === 'session');
  const calls = rows.filter((row): row is Extract<BenchRow, { type: 'call' }> => row.type === 'call');
  const langs = [...new Set(sessions.map(row => row.lang))];
  return langs.map(lang => {
    const own = sessions.filter(row => row.lang === lang);
    const ran = own.filter(row => !row.error);
    const ownCalls = calls.filter(row => row.lang === lang);
    const quality = own.flatMap(row => row.checks.filter(check => !check.safety));
    const safety = ran.flatMap(row => row.checks.filter(check => check.safety));
    const turns = own.flatMap(row => row.turnMs);
    const peak = ownCalls.map(row => row.stats?.peakRssMB ?? row.stats?.peakFootprintMB ?? row.stats?.pssMB).filter((value): value is number => typeof value === 'number');
    const drafts = own.map(row => row.draftMs).filter((value): value is number => typeof value === 'number');
    return {
      lang, sessions: own.length, failedSessions: own.length - ran.length,
      quality: quality.length ? quality.filter(check => check.ok).length / quality.length : NaN,
      safetyPassed: safety.filter(check => check.ok).length, safetyTotal: safety.length,
      callsPerTurn: turns.length ? ownCalls.filter(row => row.turn !== 'draft' && !row.question).length / turns.length : NaN,
      jsonFailRate: ownCalls.length ? ownCalls.filter(row => !row.jsonOk).length / ownCalls.length : NaN,
      turnP50: percentile(turns, 0.5), turnP90: percentile(turns, 0.9),
      ...(drafts.length ? { draftP50: percentile(drafts, 0.5) } : {}),
      ...(own.some(row => row.questionMs?.length) ? { questionP50: percentile(own.flatMap(row => row.questionMs ?? []), 0.5) } : {}),
      promptTokens: mean(ownCalls.map(row => row.stats?.prefillTokens).filter((value): value is number => typeof value === 'number')),
      decodeTokPerSec: mean(ownCalls.map(row => row.stats?.decodeTokPerSec).filter((value): value is number => typeof value === 'number' && value > 0)),
      ttftP50: percentile(ownCalls.map(row => row.stats?.ttftMs).filter((value): value is number => typeof value === 'number'), 0.5),
      peakMemMB: peak.length ? Math.max(...peak) : undefined,
    };
  });
}

const fmt = (value: number | undefined, digits = 0) => value === undefined || Number.isNaN(value) ? '–' : value.toFixed(digits);
const pct = (value: number) => Number.isNaN(value) ? '–' : `${Math.round(value * 100)}%`;
const sec = (ms: number | undefined) => ms === undefined || Number.isNaN(ms) ? '–' : `${(ms / 1000).toFixed(1)}s`;

/** Markdown table, worst language first by quality so a collapse in one language is not hidden. */
export function summaryTable(summaries: LanguageSummary[]): string {
  const head = '| 언어 | 세션(실패) | 품질 | 안전 | 턴 p50 | 턴 p90 | 초안 p50 | 호출/턴 | JSON 실패 | 입력 토큰 | 생성 tok/s | TTFT p50 | 최대 메모리 MB |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = [...summaries].sort((a, b) => (a.quality || 0) - (b.quality || 0)).map(item =>
    `| ${item.lang} | ${item.sessions}(${item.failedSessions}) | ${pct(item.quality)} | ${item.safetyPassed}/${item.safetyTotal} | ${sec(item.turnP50)} | ${sec(item.turnP90)} | ${sec(item.draftP50)} | ${fmt(item.callsPerTurn, 1)} | ${pct(item.jsonFailRate)} | ${fmt(item.promptTokens)} | ${fmt(item.decodeTokPerSec, 1)} | ${sec(item.ttftP50)} | ${fmt(item.peakMemMB)} |`);
  return [head, ...rows].join('\n');
}
