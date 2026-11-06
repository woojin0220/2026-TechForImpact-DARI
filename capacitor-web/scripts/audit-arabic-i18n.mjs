import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { appEnglish, appArabic, appKorean } from '../src/appCopy.ts';
import { statusWords } from '../src/statusCopy.ts';
import { journeyCopies } from '../src/journeyCopy.ts';
import { revisionCopies } from '../src/revision/revisionCopy.ts';
import { benchCopies } from '../src/bench/benchCopy.ts';
import { intakeCopies, intakeProcessCopy, scriptedCopy } from '../src/intakeCopy.ts';
import { applicationSteps } from '../src/form/schema.ts';
import { requirementCatalog } from '../src/intake/catalog.ts';
import { metadataGroups } from '../src/intake/metadata14.ts';
import { hasLocalizedPhrase, localizedLabel } from '../src/form/localize.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dictionaries = { app: { en: appEnglish, ko: appKorean, ar: appArabic }, journey: journeyCopies,
  revision: revisionCopies, bench: benchCopies, intake: intakeCopies, process: intakeProcessCopy, scripted: scriptedCopy, statuses: statusWords };
const issues = [], entries = [];
for (const [namespace, copies] of Object.entries(dictionaries)) {
  const keys = Object.keys(copies.en).sort();
  if (JSON.stringify(Object.keys(copies.ar).sort()) !== JSON.stringify(keys)) issues.push(`${namespace}: Arabic key mismatch`);
  for (const key of keys) {
    const value = copies.ar[key];
    if (!value?.trim() || !/\p{Script=Arabic}/u.test(value) || value === copies.en[key]) issues.push(`${namespace}.${key}: missing Arabic`);
    if (JSON.stringify((value?.match(/\{\w+\}/g) ?? []).sort()) !== JSON.stringify((copies.en[key].match(/\{\w+\}/g) ?? []).sort())) issues.push(`${namespace}.${key}: placeholder mismatch`);
    entries.push({ namespace, key, en: copies.en[key], ko: copies.ko[key], ar: value });
  }
}
const labelOccurrences = [];
function label(ko, en, context) {
  if (!ko) return;
  const ar = localizedLabel('ar', ko, en ?? '');
  if (!hasLocalizedPhrase('ar', ko) || !/\p{Script=Arabic}/u.test(ar) || /\p{Script=Hangul}/u.test(ar)) issues.push(`label:${context}: ${ko}`);
  labelOccurrences.push({ key: ko, en, ar, context });
}
for (const step of applicationSteps) {
  label(step.sectionKo, step.sectionEn, `${step.id}:section`); label(step.titleKo, step.titleEn, `${step.id}:title`);
  for (const field of step.fields) {
    label(field.ko, field.en, field.id); label(field.hintKo, field.hintEn, `${field.id}:hint`);
    for (const option of field.options ?? []) label(option.ko, option.en, `${field.id}:option:${option.value}`);
    for (const column of field.columns ?? []) label(column.ko, column.en, `${field.id}:column:${column.id}`);
  }
}
for (const requirement of requirementCatalog) {
  label(requirement.label, requirement.labelEn, requirement.id);
  for (const option of requirement.options ?? []) label(option.ko, option.en, `${requirement.id}:option:${option.value}`);
}
for (const group of metadataGroups) label(group.ko, group.en, `${group.id}:group`);

// Static prose in actually reachable components must use a translation key.
// Brand names and explicitly technical CPU/GPU values are not translated.
const components = ['App.tsx', 'FormStage.tsx', 'JourneyPanels.tsx', 'StatementDetails.tsx',
  'revision/SentenceReview.tsx', 'revision/EnglishMeaning.tsx', 'revision/EditorModal.tsx', 'bench/BenchPanel.tsx'];
const literalFindings = [];
function renderedStrings(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...renderedStrings(node.whenTrue), ...renderedStrings(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return renderedStrings(node.expression);
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return [...renderedStrings(node.left), ...renderedStrings(node.right)];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
  return [];
}
// Regression fixture for the original ko-versus-English bug. Do not inspect the
// condition's language codes or non-visible CSS class names as applicant prose.
const regression = ts.createSourceFile('fixture.tsx', `<p>{language === 'ko' ? '수정' : 'Correct'}</p>`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const regressionText = [];
function verifyRule(node) { if (ts.isJsxExpression(node)) regressionText.push(...renderedStrings(node.expression)); ts.forEachChild(node, verifyRule); }
verifyRule(regression);
if (!regressionText.includes('Correct') || regressionText.includes('ko')) throw new Error('Arabic JSX audit regression failed');
for (const name of components) {
  const path = resolve(root, 'src', name), source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    const values = [];
    if (ts.isJsxText(node)) values.push(node.text.trim());
    if (ts.isJsxAttribute(node) && ['aria-label', 'title', 'placeholder'].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) values.push(node.initializer.text);
    if (ts.isJsxExpression(node) && (!ts.isJsxAttribute(node.parent) || ['aria-label', 'title', 'placeholder'].includes(node.parent.name.getText(ast)))) values.push(...renderedStrings(node.expression));
    for (const value of values) {
      if (value && /[A-Za-z가-힣]/u.test(value) && !['DARI', 'DARI / 01', 'GPU', 'CPU'].includes(value)) {
        const finding = { file: `src/${name}`, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, value };
        literalFindings.push(finding); issues.push(`literal UI prose: ${finding.file}:${finding.line}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const result = {
  baseCommit: '2b298384f5e6914b48a77a969ed9f99c5c344073', targetLanguage: 'ar',
  counts: { uiKeys: entries.length, uiKeysByNamespace: Object.fromEntries(Object.entries(dictionaries).map(([name, copy]) => [name, Object.keys(copy.en).length])),
    officialSteps: applicationSteps.length, requirements: requirementCatalog.length, metadataGroups: metadataGroups.length,
    uniqueLabelKeys: new Set(labelOccurrences.map(item => item.key)).size, labelOccurrences: labelOccurrences.length,
    missingKeys: issues.length, hardcodedLiteralUiProse: literalFindings.length },
  scope: 'Arabic UI chrome, known official labels, metadata, errors/loading and RTL. Other language dictionaries retain their pre-existing coverage.',
  preservedData: ['verbatim user input and source quotations', 'Korean draft text', 'model names, URLs, IDs and raw developer JSON'],
  explicitLimitations: ['Arabic final meaning/backtranslation remains unsupported and approval remains disabled.', 'English-only developer quick test is explicitly labelled and hidden from the ordinary production start screen.', 'Script detection cannot prove the linguistic quality of generated Arabic.', 'LegacyApp.tsx is not imported by main.tsx and is outside the active user route.'],
  issues, literalFindings, entries, labelOccurrences,
};
const output = resolve(root, '../docs/arabic-fix/TRANSLATION_AUDIT.json');
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, ...result.counts }, null, 2));
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
