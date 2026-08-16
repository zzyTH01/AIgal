import type { ZodType } from 'zod';
import { LLMError } from './llm-port.js';

export class StructuredResponseError extends LLMError {
  override readonly name = 'StructuredResponseError';

  constructor(message: string, cause?: unknown) {
    super('parse_error', message, { retryable: true, cause });
  }
}

/** Provider 响应 → 结构化校验入口：剥离 fence → JSON.parse → Zod。 */
export function validateStructuredResponse<T>(text: string, schema: ZodType<T>): T {
  const jsonText = stripCodeFence(text);
  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch (error) {
    throw new StructuredResponseError(`Failed to parse structured JSON: ${String(error)}`, error);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new StructuredResponseError(
      `Structured response failed schema: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
      parsed.error,
    );
  }
  return parsed.data;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}
