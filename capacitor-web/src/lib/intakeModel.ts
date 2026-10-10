import { Capacitor } from '@capacitor/core';
import { onDeviceLlm as native } from './onDeviceLlm';
import type { ModelStats, NativeBenchOptions } from '../bench/types';

export type IntakeRuntimeStatus = {
  platform: string;
  mode: 'on-device' | 'local-preview';
  available: boolean;
  modelReady: boolean;
  modelName?: string;
  backend?: string;
  busy?: boolean;
  reason?: string;
  models?: string[];
  device?: Record<string, unknown>;
};

const browserHost = window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1';
export const INTAKE_API_URL = (import.meta.env.VITE_DARI_INTAKE_API_URL ?? `http://${browserHost}:8765`).replace(/\/$/, '');
export const previewModels = ['gemma4:e4b', 'gemma3n:e4b', 'qwen3:4b', 'llama3.2:3b'];
let previewModel = 'gemma4:e4b';
let activeController: AbortController | null = null;
let benchOptions: NativeBenchOptions = {};
let previewFormat: 'schema' | 'json' | 'none' = 'schema';

/** Benchmark-only overrides; the app itself always runs with the defaults. */
export function setBenchOptions(options: NativeBenchOptions & { previewFormat?: 'schema' | 'json' | 'none' }) {
  const { previewFormat: format, ...native } = options;
  benchOptions = native;
  previewFormat = format ?? 'schema';
}

export function getPreviewModel() { return previewModel; }
export function setPreviewModel(model: string) {
  if (!previewModels.includes(model)) throw new Error('지원하지 않는 미리보기 모델입니다.');
  previewModel = model;
}

export async function getIntakeRuntimeStatus(): Promise<IntakeRuntimeStatus> {
  if (Capacitor.isNativePlatform()) {
    try { return { ...await native.getStatus(), mode: 'on-device' }; }
    catch (error) {
      return { platform: Capacitor.getPlatform(), mode: 'on-device', available: false, modelReady: false,
        reason: error instanceof Error ? error.message : '기기 모델 실행부를 연결하지 못했습니다.' };
    }
  }
  try {
    const response = await fetch(`${INTAKE_API_URL}/v1/intake/status`, { signal: AbortSignal.timeout(7000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '로컬 미리보기 서버 연결 실패');
    const models: string[] = result.models ?? [];
    return { platform: 'web', mode: 'local-preview', available: true,
      modelReady: models.includes(previewModel), modelName: previewModel, models, busy: result.busy,
      reason: models.includes(previewModel) ? undefined : `${previewModel} 모델을 Mac에 먼저 준비해 주세요.` };
  } catch (error) {
    return { platform: 'web', mode: 'local-preview', available: false, modelReady: false,
      modelName: previewModel, reason: error instanceof Error ? error.message : '로컬 미리보기 서버 연결 실패' };
  }
}

export async function importIntakeModel(): Promise<IntakeRuntimeStatus> {
  if (!Capacitor.isNativePlatform()) throw new Error('모델 파일 가져오기는 설치한 모바일 앱에서 사용합니다.');
  await native.importModel();
  return getIntakeRuntimeStatus();
}

export async function cancelIntakeGeneration(): Promise<void> {
  activeController?.abort();
  if (Capacitor.isNativePlatform()) await native.cancel();
}

const pause = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('요청을 취소했습니다.', 'AbortError')); }, { once: true });
});

/** A request that timed out on this side may still be running in the model.
 * Wait until it finishes (up to ~5.5 minutes) instead of failing with "busy". */
async function waitUntilIdle(isBusy: () => Promise<boolean>, signal?: AbortSignal) {
  const until = Date.now() + 330000;
  while (Date.now() < until) {
    if (!(await isBusy().catch(() => false))) return;
    await pause(2000, signal);
  }
}
const serverBusy = async () => (await (await fetch(`${INTAKE_API_URL}/v1/intake/status`, { signal: AbortSignal.timeout(7000) })).json()).busy === true;
const isBusyError = (error: unknown) => /이전 모델 요청|BUSY|작업 중/.test(error instanceof Error ? `${error.message} ${(error as { code?: string }).code ?? ''}` : String(error));

type GenerateRequest = { task: 'intake' | 'draft'; system: string; prompt: string; signal?: AbortSignal; responseSchema?: Record<string, unknown> };

export async function generateIntakeModel(request: GenerateRequest): Promise<string> {
  return (await generateIntakeModelWithStats(request)).text;
}

/** Same as generateIntakeModel, plus the runtime's latency/token/memory measurements. */
export async function generateIntakeModelWithStats(request: GenerateRequest): Promise<{ text: string; stats?: ModelStats }> {
  if (request.signal?.aborted) throw new DOMException('요청을 취소했습니다.', 'AbortError');
  if (Capacitor.isNativePlatform()) {
    const cancel = () => { void native.cancel().catch(() => {}); };
    request.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const { constrained, ...engine } = benchOptions;
      const options = { system: request.system, prompt: request.prompt, maxTokens: request.task === 'draft' ? 4096 : 3072, temperature: 0.1,
        ...engine, ...(constrained && request.responseSchema ? { responseSchema: request.responseSchema } : {}) };
      let result: { text: string; stats?: ModelStats };
      try { result = await native.generate(options); }
      catch (error) {
        if (!isBusyError(error)) throw error;
        await waitUntilIdle(async () => (await native.getStatus()).busy === true, request.signal);
        result = await native.generate(options);
      }
      if (request.signal?.aborted) throw new DOMException('요청을 취소했습니다.', 'AbortError');
      if (!result.text?.trim()) throw new Error('기기 모델이 빈 응답을 반환했습니다.');
      return result;
    } finally { request.signal?.removeEventListener('abort', cancel); }
  }
  if (activeController) throw new Error('이전 요청을 처리하고 있습니다.');
  try { return await previewGenerate(request); }
  catch (error) {
    if (!isBusyError(error) || request.signal?.aborted) throw error;
    await waitUntilIdle(serverBusy, request.signal);
    return previewGenerate(request);
  }
}

async function previewGenerate(request: GenerateRequest): Promise<{ text: string; stats?: ModelStats }> {
  const controller = new AbortController();
  activeController = controller;
  const cancel = () => controller.abort();
  request.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 310000);
  try {
    const response = await fetch(`${INTAKE_API_URL}/v1/intake/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ task: request.task, system: request.system, prompt: request.prompt, responseSchema: request.responseSchema, model: previewModel, format: previewFormat }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '대화 모델 요청에 실패했습니다.');
    if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('모델 응답이 비어 있습니다.');
    return { text: result.text, stats: result.stats };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('요청이 취소되었거나 처리 시간을 초과했습니다. 로컬 모델이 이전 작업을 마치면 다시 시도해 주세요.');
    throw error;
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener('abort', cancel);
    activeController = null;
  }
}
