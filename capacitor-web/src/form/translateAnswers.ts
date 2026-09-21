import { translateTexts } from '../lib/api';
import { collectUnits, fixedTranslation, type RenderedText } from './model';
import type { Answers } from '../types';

export async function translateAnswers(
  model: string,
  sourceLanguage: string,
  notApplicable: string,
  answers: Answers,
  onProgress: (done: number, total: number, label: string) => void,
): Promise<Record<string, RenderedText>> {
  const units = collectUnits(answers);
  const rendered: Record<string, RenderedText> = {};
  const pending = units.filter((unit) => {
    const fixed = fixedTranslation(unit.text, notApplicable);
    if (!fixed) return true;
    rendered[unit.id] = fixed;
    return false;
  });
  const total = pending.length * 2;
  let done = 0;
  onProgress(done, total, '');
  if (!pending.length) return rendered;

  const english = await translateTexts(model, sourceLanguage, 'en', pending, (id) => {
    done += 1;
    onProgress(done, total, units.find((unit) => unit.id === id)?.label ?? '');
  });
  const korean = await translateTexts(
    model,
    'en',
    'ko',
    pending.map((unit) => ({ id: unit.id, text: english[unit.id] })),
    (id) => {
      done += 1;
      onProgress(done, total, units.find((unit) => unit.id === id)?.label ?? '');
    },
  );
  for (const unit of pending) {
    rendered[unit.id] = { english: english[unit.id], korean: korean[unit.id], machine: true };
  }
  return rendered;
}
