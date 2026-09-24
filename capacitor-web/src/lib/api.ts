import { Capacitor } from '@capacitor/core';
import type { VerificationReport } from '../types';
import { MlKitTranslation } from './mlKitTranslation';
import { demoVerificationReport, translateDemoText } from './demoData';

const nativePlatform = Capacitor.isNativePlatform();
const nativeAndroid = nativePlatform && Capacitor.getPlatform() === 'android';
const demoMode = !nativePlatform && import.meta.env.VITE_DARI_DEMO_MODE !== 'false';
const browserHost = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
const defaultApiUrl = nativeAndroid ? 'http://10.0.2.2:8765' : `http://${browserHost}:8765`;
const API_URL = (import.meta.env.VITE_DARI_API_URL ?? defaultApiUrl).replace(/\/$/, '');

export interface TranslationProvider {
  translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string>;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? '로컬 서버 요청에 실패했습니다.');
  }
  return payload;
}

class MlKitTranslationProvider implements TranslationProvider {
  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const result = await MlKitTranslation.translate({
      text,
      sourceLanguage,
      targetLanguage,
    });
    if (!result.translation?.trim()) {
      throw new Error('번역 결과가 비어 있습니다.');
    }
    return result.translation.trim();
  }
}

class DemoTranslationProvider implements TranslationProvider {
  async translate(text: string, _sourceLanguage: string, targetLanguage: string): Promise<string> {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    return translateDemoText(text, targetLanguage);
  }
}

export const translationProvider: TranslationProvider = demoMode
  ? new DemoTranslationProvider()
  : new MlKitTranslationProvider();

export function isOnDeviceTranslationAvailable() {
  return nativePlatform;
}

export function isDemoMode() {
  return demoMode;
}

export function verifyTranslation(
  model: string,
  sourceLanguage: string,
  source: string,
  translation: string,
): Promise<VerificationReport> {
  if (demoMode) {
    return new Promise((resolve) => window.setTimeout(() => resolve(demoVerificationReport), 700));
  }
  return request<{ distortion_found: boolean; summary: string; distortions: VerificationReport['items'] }>('/v1/translation/verify', {
    model,
    source_language: sourceLanguage,
    source,
    translation,
  }).then((result) => ({
    hasDistortion: result.distortion_found,
    summary: result.summary,
    items: result.distortions,
  }));
}

export { API_URL };
