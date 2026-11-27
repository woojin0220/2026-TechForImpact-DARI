import { registerPlugin } from '@capacitor/core';

type MlKitTranslationPlugin = {
  getStatus(options: { sourceLanguage: string; targetLanguage: string }): Promise<{ready: boolean}>;
  prepare(options: { sourceLanguage: string; targetLanguage: string; allowCellular: boolean }): Promise<void>;
  translate(options: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ translation: string }>;
};

export const MlKitTranslation = registerPlugin<MlKitTranslationPlugin>('MlKitTranslation');
