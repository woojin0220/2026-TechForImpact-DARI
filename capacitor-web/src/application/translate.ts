import { Capacitor } from '@capacitor/core';
import { webFeedbackBuild } from '../platform/feedbackBuild';
import { exampleTranslation } from './uxExample';
import { translateOnDevice } from '../lib/nativeTranslation';
import { preserveOriginal, requireTranslation } from './translationQuality';
import type { TranslationLanguage } from './model';

export async function translateAnswer(text: string, language: string, questionId?: string,target:TranslationLanguage='ko'): Promise<string> {
  if (language === target || preserveOriginal(text, questionId)) return text;
  if (Capacitor.isNativePlatform()) {
    const result = await translateOnDevice(text, language, target);
    return requireTranslation(text, language, result, questionId, target);
  }
  if(webFeedbackBuild)return exampleTranslation(text,language,questionId,target);
  // Explicit local translation endpoint: never goes through the hybrid/Gemini intake router.
  const host = window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1';
  const base = (import.meta.env.VITE_DARI_INTAKE_API_URL ?? `http://${host}:8765`).replace(/\/$/, '');
  const response = await fetch(`${base}/v1/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_language: language, target_language: target, question_id: questionId }), signal: AbortSignal.timeout(180000) });
  const result = await response.json();
  if (!response.ok && result.error === 'UNTRANSLATED_ANSWER') throw new Error(`UNTRANSLATED_ANSWER:${questionId ?? ''}`);
  if (!response.ok || typeof result.translation !== 'string' || !result.translation.trim()) throw new Error('TRANSLATION_FAILED');
  return requireTranslation(text, language, result.translation, questionId,target);
}
