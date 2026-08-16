import { describe, expect, it } from 'vitest';
import { runV1Acceptance } from './acceptance.js';

describe('V1 acceptance', () => {
  it('passes the three automated V1 success criteria', async () => {
    const result = await runV1Acceptance();
    expect(result).toEqual({
      memoryInContext: true,
      differentCharacterDifferentDelta: true,
      metaProgressionInherited: true,
      passed: true,
    });
  });
});
