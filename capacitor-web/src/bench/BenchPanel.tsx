import { useRef, useState } from 'react';
import { generateIntakeModelWithStats, getPreviewModel, setBenchOptions, type IntakeRuntimeStatus } from '../lib/intakeModel';
import { getExtractionFormat, setExtractionFormat, type ExtractionFormat } from '../intake/index.ts';
import { Capacitor } from '@capacitor/core';
import { onDeviceLlm } from '../lib/onDeviceLlm';
import { runScenario } from './run';
import { benchLanguages, scenarios, type BenchLanguage } from './scenarios';
import { summarize, summaryTable } from './summary';
import type { BenchRow } from './types';

/** Runs the fictional benchmark scenarios on this device's model. Every row is also logged
 * as "DARI_BENCH {json}" so `adb logcat` or the Xcode console can collect it. */
export default function BenchPanel({ runtime, disabled }: { runtime: IntakeRuntimeStatus | null; disabled: boolean }) {
  const onDevice = runtime?.mode === 'on-device';
  const [langs, setLangs] = useState<BenchLanguage[]>([...benchLanguages]);
  const [repeat, setRepeat] = useState(1);
  const [constrained, setConstrained] = useState(false);
  const [ctx, setCtx] = useState(16384);
  const [backend, setBackend] = useState<'gpu' | 'cpu'>('gpu');
  const [format, setFormat] = useState<'schema' | 'json' | 'none'>('schema');
  const [extract, setExtract] = useState<ExtractionFormat>(getExtractionFormat);
  const [progress, setProgress] = useState('');
  const [rows, setRows] = useState<BenchRow[]>([]);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const total = langs.length * scenarios.length * repeat;

  async function run() {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    const collected: BenchRow[] = [];
    const write = (row: BenchRow) => { collected.push(row); console.info(`DARI_BENCH ${JSON.stringify(row)}`); setRows([...collected]); };
    const config = onDevice ? { backend: 'device', model: runtime?.modelName, constrained, ctx, accel: backend, extract } : { backend: 'preview', model: getPreviewModel(), format, extract };
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Object.values(config).join('-').replace(/[^\w.-]+/g, '_')}`;
    setBenchOptions(onDevice ? { constrained, maxNumTokens: ctx, backend } : { previewFormat: format });
    const appFormat = getExtractionFormat();
    setExtractionFormat(extract);
    await onDeviceLlm.setKeepAwake?.({ on: true }).catch(() => {});
    write({ type: 'meta', runId, startedAt: new Date().toISOString(), config: { ...config, langs, scenarios: scenarios.map(item => item.id), repeat },
      device: runtime?.device ?? { kind: 'browser', userAgent: navigator.userAgent } });
    let done = 0;
    try {
      for (let round = 1; round <= repeat; round += 1) {
        for (const lang of langs) {
          for (const scenario of scenarios) {
            if (abort.signal.aborted) return;
            await runScenario(scenario, lang, generateIntakeModelWithStats, { runId, repeat: round, signal: abort.signal, onRow: write,
              onProgress: message => setProgress(`${done + 1}/${total} · ${message}`) });
            done += 1;
          }
        }
      }
      setProgress(`완료 ${done}/${total}`);
    } finally {
      setBenchOptions({});
      setExtractionFormat(appFormat);
      await onDeviceLlm.setKeepAwake?.({ on: false }).catch(() => {});
      // On iOS the rows are also saved to Documents/bench so they survive and can be copied off the phone.
      if (Capacitor.getPlatform() === 'ios') await onDeviceLlm.saveBenchFile?.({ name: `${runId}.jsonl`, text: collected.map(row => JSON.stringify(row)).join('\n') + '\n' })
        .then(result => setProgress(current => `${current} · 저장: ${result.path.split('/').slice(-2).join('/')}`)).catch(() => {});
      controller.current = null;
      setRunning(false);
    }
  }

  const jsonl = () => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  return <details className="bench-panel">
    <summary>성능 벤치마크 (가상 시나리오)</summary>
    <fieldset disabled={running || disabled} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
      <div>{benchLanguages.map(lang => <label key={lang} style={{ marginInlineEnd: 10 }}><input type="checkbox" checked={langs.includes(lang)}
        onChange={event => setLangs(event.target.checked ? benchLanguages.filter(item => item === lang || langs.includes(item)) : langs.filter(item => item !== lang))} /> {lang}</label>)}</div>
      <label>추출 형식<select value={extract} onChange={event => setExtract(event.target.value as ExtractionFormat)}><option value="full">full (앱 기본)</option><option value="compact">compact</option></select></label>
      <label>반복<select value={repeat} onChange={event => setRepeat(Number(event.target.value))}>{[1, 2, 3].map(item => <option key={item}>{item}</option>)}</select></label>
      {onDevice ? <>
        <label>JSON 스키마 강제<select value={String(constrained)} onChange={event => setConstrained(event.target.value === 'true')}><option value="false">끔 (앱 기본)</option><option value="true">켬</option></select></label>
        <label>문맥 한도<select value={ctx} onChange={event => setCtx(Number(event.target.value))}>{[16384, 8192, 4096].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>백엔드<select value={backend} onChange={event => setBackend(event.target.value as 'gpu' | 'cpu')}><option value="gpu">GPU</option><option value="cpu">CPU</option></select></label>
      </> : <label>출력 제약 (미리보기)<select value={format} onChange={event => setFormat(event.target.value as 'schema' | 'json' | 'none')}><option value="schema">schema</option><option value="json">json</option><option value="none">none</option></select></label>}
    </fieldset>
    <small>{langs.length}개 언어 × 시나리오 {scenarios.length}개 × {repeat}회 = 세션 {total}개. 화면이 꺼지면 진행이 멈출 수 있습니다.</small>
    <div className="actions" style={{ marginTop: 0 }}>
      {running ? <button className="secondary" onClick={() => controller.current?.abort()}>중단</button>
        : <button className="secondary" disabled={disabled || !langs.length || !runtime?.modelReady} onClick={() => void run()}>벤치마크 실행</button>}
      {rows.length > 0 && !running && <button className="secondary" onClick={() => void navigator.clipboard.writeText(jsonl())}>JSONL 복사</button>}
    </div>
    {progress && <p className="status-line">{progress}</p>}
    {rows.some(row => row.type === 'session') && <pre style={{ overflowX: 'auto', fontSize: 10 }}>{summaryTable(summarize(rows))}</pre>}
  </details>;
}
