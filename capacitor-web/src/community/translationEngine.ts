import { Capacitor } from '@capacitor/core';
import { MlKitTranslation } from '../lib/mlKitTranslation';
import { generateIntakeModel, getIntakeRuntimeStatus } from '../lib/intakeModel';
import { createTranslator, translationPrompt, type Translator } from './translation';

let pending: Promise<Translator | null> | null = null;

/** Picks the best translator this device has, once per app session. */
export function deviceTranslator(): Promise<Translator | null> {
  pending ??= detect().catch(() => null);
  void pending.then(found=>{if(!found)pending=null;});
  return pending;
}

async function detect(): Promise<Translator | null> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MlKitTranslation')) {
    return createTranslator({
      fast: true,
      translate: async (text, sourceLanguage, targetLanguage) => {
        // Keep the existing automatic feed translation, downloading missing models on Wi-Fi only.
        // A visible feed must never silently start a cellular model download.
        await MlKitTranslation.prepare({ sourceLanguage, targetLanguage, allowCellular: false });
        return (await MlKitTranslation.translate({ text, sourceLanguage, targetLanguage })).translation;
      },
    });
  }
  const status = await getIntakeRuntimeStatus();
  if (!status.available || !status.modelReady || status.mode === 'hybrid') return null;
  return createTranslator({
    fast: false,
    translate: (text, source, target) => {
      const { system, prompt } = translationPrompt(text, source, target);
      return generateIntakeModel({ task: 'intake', system, prompt, priority: 'background' });
    },
  });
}
