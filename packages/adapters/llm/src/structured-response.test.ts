import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateStructuredResponse } from './structured-response.js';

const schema = z.object({ text: z.string().min(1), value: z.number().min(0).max(100) });

describe('validateStructuredResponse', () => {
  it('accepts valid JSON with code fence', () => {
    expect(validateStructuredResponse('```json\n{"text":"ok","value":10}\n```', schema)).toEqual({
      text: 'ok',
      value: 10,
    });
  });

  it('throws parse_error for invalid JSON and out-of-range values', () => {
    try {
      validateStructuredResponse('not-json', schema);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'parse_error' });
    }

    try {
      validateStructuredResponse('{"text":"x","value":500}', schema);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'parse_error' });
    }
  });
});
