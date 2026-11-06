import { useRef, useState } from 'react';
import { generateIntakeModelWithStats, getPreviewModel, setBenchOptions, type IntakeRuntimeStatus } from '../lib/intakeModel';
import { getExtractionFormat, setExtractionFormat, type ExtractionFormat } from '../intake/index.ts';
import { Capacitor } from '@capacitor/core';
import { onDeviceLlm } from '../lib/onDeviceLlm';
import { runScenario } from './run';
import { benchLanguages, scenarios, type BenchLanguage } from './scenarios';
import { summarize } from './summary';
import { benchCopy, formatBenchCopy } from './benchCopy';
import type { BenchRow } from './types';

type Progress = { state: 'running' | 'completed' | 'cancelled' | 'failed'; done: number; total: number };
const number = (value: number | undefined, digits = 0) => value === undefined || !Number.isFinite(value) ? '–' : value.toFixed(digits);
const seconds = (value: number | undefined) => value === undefined ? '–' : number(value / 1000, 1);
const percent = (value: number) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '–';

/** Runs fictional model benchmarks. Machine-readable rows remain in the console/JSONL export. */
export default function BenchPanel({ runtime, disabled, language = 'ko' }: { runtime: IntakeRuntimeStatus | null; disabled: boolean; language?: string }) {
  const copy = benchCopy(language);
  const direction = language === 'ar' || language === 'fa' ? 'rtl' : 'ltr';
  const onDevice = runtime?.mode === 'on-device';
  const [langs, setLangs] = useState<BenchLanguage[]>([...benchLanguages]);
  const [repeat, setRepeat] = useState(1);
  const [constrained, setConstrained] = useState(false);
  const [ctx, setCtx] = useState(16384);
  const [backend, setBackend] = useState<'gpu' | 'cpu'>('gpu');
  const [format, setFormat] = useState<'schema' | 'json' | 'none'>('schema');
  const [extract, setExtract] = useState<ExtractionFormat>(getExtractionFormat);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [savedPath, setSavedPath] = useState('');
  const [notice, setNotice] = useState<'copied' | null>(null);
  const [error, setError] = useState<'runFailed' | 'copyFailed' | null>(null);
  const [rows, setRows] = useState<BenchRow[]>([]);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const total = langs.length * scenarios.length * repeat;

  async function run() {
    if (controller.current || disabled || !langs.length || !runtime?.modelReady) return;
    const abort = new AbortController(); controller.current = abort;
    setRunning(true); setError(null); setNotice(null); setSavedPath('');
    setProgress({ state: 'running', done: 0, total });
    const collected: BenchRow[] = [];
    const write = (row: BenchRow) => { collected.push(row); console.info(`DARI_BENCH ${JSON.stringify(row)}`); setRows([...collected]); };
    const config = onDevice ? { backend: 'device', model: runtime?.modelName, constrained, ctx, accel: backend, extract } : { backend: 'preview', model: getPreviewModel(), format, extract };
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Object.values(config).join('-').replace(/[^\w.-]+/g, '_')}`;
    const appFormat = getExtractionFormat();
    let done = 0;
    try {
      setBenchOptions(onDevice ? { constrained, maxNumTokens: ctx, backend } : { previewFormat: format });
      setExtractionFormat(extract);
      await onDeviceLlm.setKeepAwake?.({ on: true }).catch(() => {});
      write({ type: 'meta', runId, startedAt: new Date().toISOString(), config: { ...config, langs, scenarios: scenarios.map(item => item.id), repeat },
        device: runtime?.device ?? { kind: 'browser', userAgent: navigator.userAgent } });
      for (let round = 1; round <= repeat; round += 1) {
        for (const lang of langs) {
          for (const scenario of scenarios) {
            if (abort.signal.aborted) return;
            await runScenario(scenario, lang, generateIntakeModelWithStats, { runId, repeat: round, signal: abort.signal, onRow: write,
              // The runner's diagnostic message can be Korean; UI progress is translated separately.
              onProgress: () => setProgress({ state: 'running', done: done + 1, total }) });
            done += 1;
          }
        }
      }
      setProgress({ state: abort.signal.aborted ? 'cancelled' : 'completed', done, total });
    } catch {
      if (!abort.signal.aborted) { setError('runFailed'); setProgress({ state: 'failed', done, total }); }
    } finally {
      if (abort.signal.aborted) setProgress({ state: 'cancelled', done, total });
      setBenchOptions({}); setExtractionFormat(appFormat);
      await onDeviceLlm.setKeepAwake?.({ on: false }).catch(() => {});
      if (Capacitor.getPlatform() === 'ios') await onDeviceLlm.saveBenchFile?.({ name: `${runId}.jsonl`, text: collected.map(row => JSON.stringify(row)).join('\n') + '\n' })
        .then(result => setSavedPath(result.path.split('/').slice(-2).join('/'))).catch(() => {});
      controller.current = null; setRunning(false);
    }
  }

  const jsonl = () => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  async function copyRecords() {
    setError(null); setNotice(null);
    try { await navigator.clipboard.writeText(jsonl()); setNotice('copied'); }
    catch { setError('copyFailed'); }
  }
  const summaries = summarize(rows);
  const headers = [copy.language, copy.sessionsFailed, copy.quality, copy.safety, copy.turnP50, copy.turnP90, copy.draftP50, copy.callsPerTurn, copy.jsonFailRate, copy.promptTokens, copy.decodeRate, copy.ttftP50, copy.peakMemory];
  return <details className="bench-panel" lang={language} dir={direction}>
    <summary>{copy.title}</summary>
    <fieldset disabled={running || disabled} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
      <div role="group" aria-label={copy.languages}>{benchLanguages.map(lang => <label key={lang} style={{ marginInlineEnd: 10 }}><input type="checkbox" checked={langs.includes(lang)}
        onChange={event => setLangs(event.target.checked ? benchLanguages.filter(item => item === lang || langs.includes(item)) : langs.filter(item => item !== lang))} /> {copy[lang]}</label>)}</div>
      <label>{copy.extraction}<select value={extract} onChange={event => setExtract(event.target.value as ExtractionFormat)}><option value="full">{copy.full}</option><option value="compact">{copy.compact}</option></select></label>
      <label>{copy.repeat}<select value={repeat} onChange={event => setRepeat(Number(event.target.value))}>{[1, 2, 3].map(item => <option key={item}>{item}</option>)}</select></label>
      {onDevice ? <>
        <label>{copy.constrained}<select value={String(constrained)} onChange={event => setConstrained(event.target.value === 'true')}><option value="false">{copy.off}</option><option value="true">{copy.on}</option></select></label>
        <label>{copy.context}<select value={ctx} onChange={event => setCtx(Number(event.target.value))}>{[16384, 8192, 4096].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>{copy.backend}<select value={backend} dir="ltr" onChange={event => setBackend(event.target.value as 'gpu' | 'cpu')}><option value="gpu">GPU</option><option value="cpu">CPU</option></select></label>
      </> : <label>{copy.previewFormat}<select value={format} onChange={event => setFormat(event.target.value as 'schema' | 'json' | 'none')}><option value="schema">{copy.schema}</option><option value="json">{copy.json}</option><option value="none">{copy.none}</option></select></label>}
    </fieldset>
    <small>{formatBenchCopy(copy.count, { languages: langs.length, scenarios: scenarios.length, repeats: repeat, total })} {copy.awake}</small>
    <div className="actions" style={{ marginTop: 0 }}>
      {running ? <button className="secondary" onClick={() => controller.current?.abort()}>{copy.stop}</button>
        : <button className="secondary" disabled={disabled || !langs.length || !runtime?.modelReady} onClick={() => void run()}>{copy.start}</button>}
      {rows.length > 0 && !running && <button className="secondary" onClick={() => void copyRecords()}>{copy.copy}</button>}
    </div>
    {progress && <p className="status-line" role="status">{formatBenchCopy(copy[progress.state], { done: progress.done, total: progress.total })}</p>}
    {savedPath && <p className="status-line">{copy.saved}: <bdi dir="ltr">{savedPath}</bdi></p>}
    {notice && <p role="status">{copy[notice]}</p>}
    {error && <p role="alert">{copy[error]}</p>}
    {summaries.length > 0 && <div style={{ overflowX: 'auto' }}><table style={{ fontSize: 10 }}><caption>{copy.summary}</caption><thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{summaries.map(item => <tr key={item.lang}>
      <th scope="row">{copy[item.lang as BenchLanguage] ?? item.lang}</th>
      {[`${item.sessions}(${item.failedSessions})`, percent(item.quality), `${item.safetyPassed}/${item.safetyTotal}`, seconds(item.turnP50), seconds(item.turnP90), seconds(item.draftP50), number(item.callsPerTurn, 1), percent(item.jsonFailRate), number(item.promptTokens), number(item.decodeTokPerSec, 1), seconds(item.ttftP50), number(item.peakMemMB)].map((value, index) => <td key={index} dir="ltr">{value}</td>)}
    </tr>)}</tbody></table></div>}
  </details>;
}
