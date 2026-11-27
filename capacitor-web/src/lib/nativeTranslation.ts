import { Capacitor } from '@capacitor/core';
import { MlKitTranslation } from './mlKitTranslation';

export type DownloadRequest = { sourceLanguage: string; targetLanguage: string; downloading: boolean; error: boolean };
let request: DownloadRequest | null = null;
let resolveRequest: ((value: boolean) => void) | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const translationSetup = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => request,
  async download(allowCellular: boolean) {
    if (!request || request.downloading) return;
    request = { ...request, downloading: true, error: false }; emit();
    const resolve = resolveRequest;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([MlKitTranslation.prepare({ sourceLanguage:request.sourceLanguage,targetLanguage:request.targetLanguage,allowCellular }), new Promise<never>((_, reject) => { timer=setTimeout(()=>reject(new Error('MODEL_DOWNLOAD_TIMEOUT')),120000); })]);
      } finally { if(timer)clearTimeout(timer); }
      if(resolveRequest!==resolve)return;
      request = null; resolveRequest = undefined; emit(); resolve?.(true);
    } catch { if(resolveRequest!==resolve)return; request = { ...request!, downloading: false, error: true }; emit(); }
  },
  cancel() { const resolve = resolveRequest; request = null; resolveRequest = undefined; emit(); resolve?.(false); },
};
let queue: Promise<unknown> = Promise.resolve();

/** Native only. No LLM, HTTP translation or model-output rewriting. */
export function translateOnDevice(text: string, sourceLanguage: string, targetLanguage: string, interactive = true): Promise<string> {
  const task = queue.catch(() => undefined).then(async () => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('MlKitTranslation')) throw new Error('TRANSLATOR_UNAVAILABLE');
    const pair = { sourceLanguage, targetLanguage };
    const status = await MlKitTranslation.getStatus(pair);
    if (!status.ready) {
      // Feed browsing must not unexpectedly open a model download dialog.
      if (!interactive) throw new Error('TRANSLATION_MODEL_REQUIRED');
      const accepted = await new Promise<boolean>(resolve => { resolveRequest = resolve; request = { ...pair, downloading: false, error: false }; emit(); });
      if (!accepted) throw new Error('TRANSLATION_CANCELLED');
    }
    return (await MlKitTranslation.translate({ text, ...pair })).translation;
  });
  queue = task;
  return task;
}
