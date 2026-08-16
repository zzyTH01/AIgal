import { describe, expect, it } from 'vitest';
import {
  baseStateDeltaSchema,
  finalStateDeltaSchema,
  modifierStateDeltaSchema,
  stateDeltaSchema,
} from './state-delta.js';
import { makeBaseDelta, makeFinalDelta, makeModifierDelta } from './test-data.js';

describe('StateDelta schema', () => {
  it('accepts BaseDelta / ModifierDelta / FinalDelta phases', () => {
    expect(baseStateDeltaSchema.safeParse(makeBaseDelta()).success).toBe(true);
    expect(modifierStateDeltaSchema.safeParse(makeModifierDelta()).success).toBe(true);
    expect(finalStateDeltaSchema.safeParse(makeFinalDelta()).success).toBe(true);
    expect(stateDeltaSchema.safeParse(makeBaseDelta()).success).toBe(true);
    expect(stateDeltaSchema.safeParse(makeFinalDelta()).success).toBe(true);
  });

  it('rejects final relationship metric change without audit triple', () => {
    const delta = makeFinalDelta();
    const relationships = delta.relationships as Record<string, Record<string, unknown>>;
    delete relationships.rel_player_mio?.affection;
    relationships.rel_player_mio!.trust = { before: 40, after: 44 };
    expect(finalStateDeltaSchema.safeParse(delta).success).toBe(false);
  });

  it('rejects BaseDelta with out-of-range final semantics mixed in', () => {
    const delta = makeBaseDelta();
    // BaseDelta must not contain a `final` field at top level; extra keys are rejected by strict.
    (delta as unknown as Record<string, unknown>).final = {};
    expect(baseStateDeltaSchema.safeParse(delta).success).toBe(false);
  });

  it('rejects unknown phase', () => {
    expect(stateDeltaSchema.safeParse({ phase: 'applied' }).success).toBe(false);
  });
});
