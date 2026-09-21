import type { Answers, DraftEntry, FieldAnswer } from '../types';
import { applicationSteps, fieldsById, type FormField, type TableColumn } from './schema';

export type TranslationUnit = { id: string; label: string; text: string };
export type RenderedText = { english: string; korean: string; machine: boolean };

const datePattern = /^[\d\s./:-]+$/;

export function isVisible(field: FormField, answers: Answers, stack: Set<string> = new Set()): boolean {
  if (!field.when?.length) return true;
  if (stack.has(field.id)) return false;
  stack.add(field.id);
  const visible = field.when.every((rule) => {
    const parent = fieldsById.get(rule.id);
    if (parent && !isVisible(parent, answers, stack)) return false;
    const answer = answers[rule.id];
    return answer?.kind === 'choice' && rule.anyOf.some((value) => answer.values.includes(value));
  });
  stack.delete(field.id);
  return visible;
}

export function fixedTranslation(text: string, notApplicable: string): RenderedText | null {
  const normalized = text.trim().toLowerCase();
  const fixed = new Set([
    notApplicable.trim().toLowerCase(),
    '해당 없음',
    'non applicable',
    'not applicable',
    'n/a',
    'na',
  ]);
  if (fixed.has(normalized)) {
    return { english: 'non applicable', korean: '해당 없음', machine: false };
  }
  if (datePattern.test(text.trim())) {
    return { english: text.trim(), korean: text.trim(), machine: false };
  }
  return null;
}

export function collectUnits(answers: Answers): TranslationUnit[] {
  const units: TranslationUnit[] = [];
  for (const step of applicationSteps) {
    for (const field of step.fields) {
      if (!isVisible(field, answers)) continue;
      const answer = answers[field.id];
      if (!answer) continue;
      if ((field.type === 'short' || field.type === 'long' || field.type === 'date') && answer.kind === 'text') {
        const text = answer.text.trim();
        if (text) units.push({ id: field.id, label: field.ko, text });
      }
      if (field.type === 'table' && answer.kind === 'table') {
        answer.rows.forEach((row, rowIndex) => {
          field.columns?.forEach((column) => {
            const text = (row[column.id] ?? '').trim();
            if (!text) return;
            units.push({
              id: cellId(field.id, rowIndex, column.id),
              label: `${field.ko} · ${column.ko}`,
              text,
            });
          });
        });
      }
    }
  }
  return units;
}

export function buildReview(answers: Answers, rendered: Record<string, RenderedText>): DraftEntry[] {
  const entries: DraftEntry[] = [];
  for (const step of applicationSteps) {
    for (const field of step.fields) {
      if (!isVisible(field, answers)) continue;
      const answer = answers[field.id];
      const entry = answer ? formatField(field, answer, rendered) : null;
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

function formatField(field: FormField, answer: FieldAnswer, rendered: Record<string, RenderedText>): DraftEntry | null {
  if ((field.type === 'single' || field.type === 'multi') && answer.kind === 'choice' && answer.values.length) {
    return {
      questionNumber: field.id,
      questionKorean: field.ko,
      source: labels(field, answer.values, 'ko'),
      english: labels(field, answer.values, 'en'),
      korean: labels(field, answer.values, 'ko'),
      verify: false,
    };
  }
  if ((field.type === 'short' || field.type === 'long' || field.type === 'date') && answer.kind === 'text' && answer.text.trim()) {
    const text = rendered[field.id];
    if (!text) return null;
    return {
      questionNumber: field.id,
      questionKorean: field.ko,
      source: answer.text.trim(),
      english: text.english,
      korean: text.korean,
      verify: text.machine,
    };
  }
  if (field.type === 'table' && answer.kind === 'table' && field.columns) {
    const filled = answer.rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ row }) => field.columns!.some((column) => (row[column.id] ?? '').trim()));
    if (!filled.length) return null;
    const source: string[] = [];
    const english: string[] = [];
    const korean: string[] = [];
    let machine = false;
    filled.forEach(({ row, rowIndex }, displayIndex) => {
      const sourceLines = [`${displayIndex + 1}.`];
      const englishLines = [`${displayIndex + 1}.`];
      const koreanLines = [`${displayIndex + 1}.`];
      field.columns!.forEach((column) => {
        const value = (row[column.id] ?? '').trim();
        if (!value) return;
        const text = rendered[cellId(field.id, rowIndex, column.id)];
        if (!text) return;
        if (text.machine) machine = true;
        sourceLines.push(line(column, value));
        englishLines.push(line(column, text.english));
        koreanLines.push(line(column, text.korean));
      });
      source.push(sourceLines.join('\n'));
      english.push(englishLines.join('\n'));
      korean.push(koreanLines.join('\n'));
    });
    return {
      questionNumber: field.id,
      questionKorean: field.ko,
      source: source.join('\n\n'),
      english: english.join('\n\n'),
      korean: korean.join('\n\n'),
      verify: machine,
    };
  }
  return null;
}

function labels(field: FormField, values: string[], language: 'ko' | 'en') {
  return values.map((value) => field.options?.find((option) => option.value === value)?.[language] ?? value).join(', ');
}

function line(column: TableColumn, value: string) {
  return `${column.ko} / ${column.en}: ${value}`;
}

function cellId(fieldId: string, rowIndex: number, columnId: string) {
  return `${fieldId}:${rowIndex}:${columnId}`;
}
