import { describe, expect, it } from 'vitest';
import { npcReactionSchema, turnResultSchema } from './turn-result.js';
import { makeTurnResult } from './test-data.js';

describe('TurnResult schema', () => {
  it('accepts a complete TurnResult', () => {
    expect(turnResultSchema.safeParse(makeTurnResult()).success).toBe(true);
  });

  it('accepts dual-channel NPC reaction', () => {
    const result = makeTurnResult();
    expect(npcReactionSchema.safeParse(result.reaction).success).toBe(true);
  });

  it('rejects reaction intensity outside 0~100', () => {
    const result = makeTurnResult();
    result.reaction.structured.emotion = { type: 'relief', intensity: 120 };
    expect(turnResultSchema.safeParse(result).success).toBe(false);
  });

  it('rejects directDelta that is not final phase', () => {
    const result = makeTurnResult();
    (result.directDelta as { phase: string }).phase = 'base';
    expect(turnResultSchema.safeParse(result).success).toBe(false);
  });
});
