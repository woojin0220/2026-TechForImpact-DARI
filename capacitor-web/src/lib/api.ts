import { Capacitor } from '@capacitor/core';
import type { VerificationReport } from '../types';

const nativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
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

class LocalServerTranslationProvider implements TranslationProvider {
  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    return translateText('qwen3:4b', sourceLanguage, targetLanguage, text);
  }
}

export async function translateText(
  model: string,
  sourceLanguage: string,
  targetLanguage: string,
  text: string,
): Promise<string> {
  const result = await request<{ translation: string }>('/v1/translate', {
    model,
    source_language: sourceLanguage,
    target_language: targetLanguage,
    text,
  });
  if (!result.translation?.trim()) {
    throw new Error('번역 결과가 비어 있습니다.');
  }
  return result.translation.trim();
}

export async function translateTexts(
  model: string,
  sourceLanguage: string,
  targetLanguage: string,
  items: { id: string; text: string }[],
  onItem: (id: string) => void,
): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const group of chunkItems(items)) {
    let translated: Record<string, string> | null = null;
    if (group.length > 1) {
      try {
        translated = await translateBatch(model, sourceLanguage, targetLanguage, group);
      } catch {
        translated = null;
      }
    }
    if (!translated) {
      translated = {};
      for (const item of group) {
        translated[item.id] = await translateText(model, sourceLanguage, targetLanguage, item.text);
        onItem(item.id);
      }
    } else {
      group.forEach((item) => onItem(item.id));
    }
    Object.assign(output, translated);
  }
  return output;
}

async function translateBatch(
  model: string,
  sourceLanguage: string,
  targetLanguage: string,
  items: { id: string; text: string }[],
): Promise<Record<string, string>> {
  const result = await request<{ items: { id: string; translation: string }[] }>('/v1/translate/batch', {
    model,
    source_language: sourceLanguage,
    target_language: targetLanguage,
    items,
  });
  const output: Record<string, string> = {};
  for (const item of result.items ?? []) {
    if (item.id && item.translation?.trim()) output[item.id] = item.translation.trim();
  }
  if (items.some((item) => !output[item.id])) {
    throw new Error('묶음 번역에서 빠진 문항이 있습니다.');
  }
  return output;
}

function chunkItems(items: { id: string; text: string }[]) {
  const groups: { id: string; text: string }[][] = [];
  let current: { id: string; text: string }[] = [];
  let size = 0;
  for (const item of items) {
    if (item.text.length > 900) {
      if (current.length) groups.push(current);
      groups.push([item]);
      current = [];
      size = 0;
      continue;
    }
    if (current.length >= 4 || size + item.text.length > 3500) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.text.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

export const translationProvider: TranslationProvider = new LocalServerTranslationProvider();

export function verifyTranslation(
  model: string,
  sourceLanguage: string,
  source: string,
  translation: string,
): Promise<VerificationReport> {
  return request<{ distortion_found: boolean; summary: string; distortions: Array<Record<string, string>> }>('/v1/translation/verify', {
    model,
    source_language: sourceLanguage,
    source,
    translation,
  }).then((result) => ({
    hasDistortion: result.distortion_found,
    summary: result.summary,
    items: (result.distortions ?? []).map((item) => ({
      type: item.type ?? '',
      direction: item.direction ?? '',
      severity: item.severity ?? '',
      questionNumber: item.questionNumber ?? item.question_number ?? '',
      sourceExcerpt: item.sourceExcerpt ?? item.source_excerpt ?? '',
      translationExcerpt: item.translationExcerpt ?? item.translation_excerpt ?? '',
      explanation: item.explanation ?? '',
    })),
  }));
}

export { API_URL };
