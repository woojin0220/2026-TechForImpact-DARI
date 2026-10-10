import { appendAssistantMessage, appendUserMessage, calculateCoverage, confirmFacts, continueConversation, createSession, generateDraft, getActiveFacts, narrativeOpening, type IntakeSession, type ModelRequest } from '../intake/index.ts';
import type { BenchLanguage, Scenario } from './scenarios.ts';
import { scoreCheck } from './score.ts';
import type { BenchRow, ModelStats } from './types.ts';

export type StatsAdapter = (request: ModelRequest) => Promise<{ text: string; stats?: ModelStats }>;
type CallRow = Extract<BenchRow, { type: 'call' }>;
type SessionRow = Extract<BenchRow, { type: 'session' }>;
export type ScenarioRun = { session: IntakeSession; calls: CallRow[]; result: SessionRow };

export type RunOptions = {
  runId: string;
  repeat?: number;
  signal?: AbortSignal;
  /** Called with each row as soon as it exists, so long runs can be streamed to disk or a log. */
  onRow?: (row: BenchRow) => void;
  onProgress?: (message: string) => void;
  /** Return true to retry a failed turn once (e.g. the server was still busy with a timed-out call). */
  retryTurn?: (error: Error) => Promise<boolean>;
};

function isJsonObject(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1'));
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch { return false; }
}

/** Runs one scenario in one language through the real intake code and scores it.
 * Every model call is recorded with its size, latency and runtime stats. */
export async function runScenario(scenario: Scenario, lang: BenchLanguage, adapter: StatsAdapter, options: RunOptions): Promise<ScenarioRun> {
  const repeat = options.repeat ?? 1;
  const base = { runId: options.runId, scenario: scenario.id, lang, repeat };
  const calls: CallRow[] = [];
  let turn: number | 'draft' = 1;
  // Engine loading is reported per call (stats.initMs) and kept out of turn latency.
  let initMs = 0;
  const instrumented = async (request: ModelRequest): Promise<string> => {
    const started = Date.now();
    const row: CallRow = { type: 'call', ...base, turn, call: calls.length + 1, task: request.task,
      systemChars: request.system.length, promptChars: request.prompt.length, outputChars: 0, ms: 0, jsonOk: false };
    try {
      const { text, stats } = await adapter(request);
      Object.assign(row, { outputChars: text.length, jsonOk: isJsonObject(text), ...(stats ? { stats } : {}) });
      initMs += stats?.initMs ?? 0;
      return text;
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      row.ms = Date.now() - started;
      calls.push(row);
      options.onRow?.(row);
    }
  };

  let session = appendAssistantMessage(createSession(lang, 'full'), narrativeOpening(lang), { kind: 'narrative' });
  const started = Date.now();
  const turnMs: number[] = [];
  let error: string | undefined;
  for (const [index, text] of scenario.turns[lang].entries()) {
    if (options.signal?.aborted) { error = '중단됨'; break; }
    turn = index + 1;
    options.onProgress?.(`${scenario.id} · ${lang} · 턴 ${turn}/${scenario.turns[lang].length}`);
    const turnStarted = Date.now();
    initMs = 0;
    const asked = appendUserMessage(session, text);
    try {
      try { session = await continueConversation(asked, instrumented, options.signal); }
      catch (failure) {
        if (!(failure instanceof Error) || !(await options.retryTurn?.(failure))) throw failure;
        session = await continueConversation(asked, instrumented, options.signal);
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
      session = (failure as { session?: IntakeSession }).session ?? asked;
      break;
    } finally { turnMs.push(Date.now() - turnStarted - initMs); }
  }

  const facts = getActiveFacts(session);
  const checks = scenario.checks.map(item => scoreCheck(facts, session, item, lang));
  let draftMs: number | undefined;
  if (scenario.draft && !error && !options.signal?.aborted) {
    // Simulates the applicant's explicit review, then writes the Korean draft.
    turn = 'draft';
    options.onProgress?.(`${scenario.id} · ${lang} · 초안`);
    const draftStarted = Date.now();
    initMs = 0;
    const conflicts = new Set(calculateCoverage(session).filter(item => item.status === 'conflict').map(item => item.requirementId));
    try {
      session = await generateDraft(confirmFacts(session, facts.filter(fact => fact.status !== 'conflict' && !conflicts.has(fact.requirementId)).map(fact => fact.id)), instrumented, options.signal);
    } catch (failure) { error = `초안: ${failure instanceof Error ? failure.message : String(failure)}`; }
    draftMs = Date.now() - draftStarted - initMs;
    for (const spec of scenario.draft) {
      const text = session.draft.find(section => section.questionId === spec.question)?.text ?? '';
      // Draft checks run on the Korean draft, so their words are the same for every source language.
      for (const word of spec.has ?? []) checks.push({ ok: text.includes(word), label: `초안 ${spec.question} ⊃ "${word}"`, actual: text.slice(0, 160), safety: false });
      for (const word of spec.lacks ?? []) checks.push({ ok: !text.includes(word), label: `초안 ${spec.question} ⊅ "${word}"`, actual: text.slice(0, 160), safety: true });
    }
  }
  const result: SessionRow = {
    type: 'session', ...base,
    passed: checks.filter(item => item.ok).length, total: checks.length,
    safetyPassed: checks.filter(item => item.safety && item.ok).length, safetyTotal: checks.filter(item => item.safety).length,
    ms: Date.now() - started, turnMs, ...(draftMs !== undefined ? { draftMs } : {}), ...(error ? { error } : {}),
    checks: checks.map(({ ok, label, safety, actual }) => ({ ok, label, safety, ...(ok ? {} : { actual }) })),
  };
  options.onRow?.(result);
  return { session, calls, result };
}
