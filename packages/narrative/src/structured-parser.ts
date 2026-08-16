import type { ZodType } from 'zod';

export class NarrativeParseError extends Error {
  override readonly name = 'NarrativeParseError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.cause = options?.cause;
  }
}

/** 剥离 markdown code fence，返回可 JSON.parse 的字符串。 */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

/** LLM 双通道的结构化通道解析 + Schema 校验。 */
export function parseStructuredResponse<T>(text: string, schema: ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(text));
  } catch (error) {
    throw new NarrativeParseError(`Failed to parse JSON from LLM response: ${String(error)}`, {
      cause: error,
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new NarrativeParseError(
      `LLM structured response failed schema validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
