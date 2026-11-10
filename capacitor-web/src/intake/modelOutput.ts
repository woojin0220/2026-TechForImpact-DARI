/** Validation of the JSON a model returns, and the size guard for prompts sent to it. */

// Character guard is conservative, not a tokenizer-derived guarantee. The native
// adapter additionally enforces its model context window.
const MAX_PROMPT_LENGTH = 26000;
const MAX_OUTPUT_LENGTH = 64000;

export function parseObject(raw: string): Record<string, unknown> {
  if (raw.length > MAX_OUTPUT_LENGTH) throw new Error('모델 응답이 허용 길이를 넘었습니다.');
  const clean = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1');
  const parsed: unknown = JSON.parse(clean);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('모델이 올바른 JSON 객체를 반환하지 않았습니다.');
  return parsed as Record<string, unknown>;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('모델 응답의 항목 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, limit = 6000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return value;
}
export function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`${label} 목록이 올바르지 않습니다.`);
  return [...new Set(value)] as string[];
}
export function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`${label} 값이 올바르지 않습니다.`);
  return value as T;
}
export function boundedPrompt(data: unknown): string {
  const prompt = JSON.stringify(data);
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error('현재 처리할 수 있는 문맥 길이를 넘었습니다. 대화 기록은 보존되었습니다. 더 긴 문맥을 지원하는 모델 설정이 필요합니다.');
  return prompt;
}
