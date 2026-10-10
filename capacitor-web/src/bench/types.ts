/** Per-call measurements reported by a model runtime. Every field is optional:
 * each runtime fills what it can measure (see docs/BENCHMARK.md). */
export type ModelStats = {
  runtime?: 'litertlm' | 'ollama';
  backend?: string;
  maxNumTokens?: number;
  constrained?: boolean;
  /** Engine load time, only on the call that created the engine. */
  initMs?: number;
  totalMs?: number;
  ttftMs?: number;
  prefillTokens?: number;
  decodeTokens?: number;
  prefillTokPerSec?: number;
  decodeTokPerSec?: number;
  /** Resident memory after the call and its peak during the call (Android: VmHWM reset per call when allowed). */
  rssMB?: number;
  peakRssMB?: number;
  peakReset?: boolean;
  /** Android proportional set size including graphics where the driver reports it. */
  pssMB?: number;
  /** iOS memory footprint (what jetsam limits) and its process-lifetime peak. */
  footprintMB?: number;
  peakFootprintMB?: number;
  availMemMB?: number;
  thermal?: string;
  batteryTempC?: number;
  batteryLevel?: number;
};

/** Runtime configuration a benchmark run applies to the on-device engine. */
export type NativeBenchOptions = { constrained?: boolean; maxNumTokens?: number; backend?: 'gpu' | 'cpu' };

/** One JSONL row of benchmark output. */
export type BenchRow =
  | { type: 'meta'; runId: string; startedAt: string; config: Record<string, unknown>; device?: Record<string, unknown> }
  | { type: 'call'; runId: string; scenario: string; lang: string; repeat: number; turn: number | 'draft'; call: number; task: string;
      systemChars: number; promptChars: number; outputChars: number; ms: number; jsonOk: boolean; error?: string; stats?: ModelStats }
  | { type: 'session'; runId: string; scenario: string; lang: string; repeat: number; passed: number; total: number;
      safetyPassed: number; safetyTotal: number; ms: number; turnMs: number[]; draftMs?: number; error?: string;
      checks: { label: string; ok: boolean; safety: boolean; actual?: string }[] };
