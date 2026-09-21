import { registerPlugin } from '@capacitor/core';

type MlKitTranslationPlugin = {
  translate(options: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ translation: string }>;
};

export const MlKitTranslation = registerPlugin<MlKitTranslationPlugin>('MlKitTranslation');
