import { intakeCopies, intakeProcessCopy, scriptedCopy } from '../intakeCopy';
import { appCopyFor } from '../appCopy';
import { sessionUxCopy } from '../sessionUxCopy';
import { overviewCopyFor } from '../sessionOverview/copy';

/** Every copy table the app shell needs, resolved once per language (English fallback). */
export function appTexts(language: string) {
  const ux = sessionUxCopy[language] ?? sessionUxCopy.en;
  return {
    ux,
    copy: { ...(intakeCopies[language] ?? intakeCopies.en), memory: ux.memory },
    ui: appCopyFor(language),
    overview: overviewCopyFor(language),
    sc: scriptedCopy[language] ?? scriptedCopy.en,
    process: intakeProcessCopy[language] ?? intakeProcessCopy.en,
    direction: ['ar', 'fa'].includes(language) ? 'rtl' as const : 'ltr' as const,
  };
}

export type AppTexts = ReturnType<typeof appTexts>;
