import type { ZodType } from 'zod';
import { validateStructuredResponse } from '@ag/llm';

/**
 * Narrative 侧兼容入口：单实现收敛在 @ag/llm.validator，
 * 避免同一套“剥 fence + JSON.parse + Zod”逻辑两处漂移。
 */
export function parseStructuredResponse<T>(text: string, schema: ZodType<T>): T {
  return validateStructuredResponse(text, schema);
}

export { validateStructuredResponse };
