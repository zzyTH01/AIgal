import { describe, expect, it } from 'vitest';
import { memoryCandidateSchema, memoryRecordSchema, memoryStateSchema } from './memory.js';
import { metaStateSchema } from './meta.js';
import { playerModelSchema } from './player-model.js';
import { rngStateSchema } from './rng.js';
import {
  makeMemoryCandidate,
  makeMemoryRecord,
  makeMemoryState,
  makeMetaState,
  makePlayerModel,
  makeRngState,
} from './test-data.js';

describe('Memory schemas', () => {
  it('accepts valid record / state / candidate', () => {
    expect(memoryRecordSchema.safeParse(makeMemoryRecord()).success).toBe(true);
    expect(memoryStateSchema.safeParse(makeMemoryState()).success).toBe(true);
    expect(memoryCandidateSchema.safeParse(makeMemoryCandidate()).success).toBe(true);
  });

  it('rejects unknown memory type and invalid valence', () => {
    const record = makeMemoryRecord();
    record.type = 'procedural' as never;
    expect(memoryRecordSchema.safeParse(record).success).toBe(false);

    record.type = 'episodic';
    record.valence = 101;
    expect(memoryRecordSchema.safeParse(record).success).toBe(false);
  });
});

describe('MetaState schema', () => {
  it('accepts valid meta state', () => {
    expect(metaStateSchema.safeParse(makeMetaState()).success).toBe(true);
  });

  it('rejects negative run counters', () => {
    const meta = makeMetaState();
    meta.runCount = -1;
    expect(metaStateSchema.safeParse(meta).success).toBe(false);
  });
});

describe('PlayerModel schema', () => {
  it('accepts valid player model', () => {
    expect(playerModelSchema.safeParse(makePlayerModel()).success).toBe(true);
  });

  it('rejects out-of-range perceived trait', () => {
    const model = makePlayerModel();
    model.perceivedTraits.kind = 200;
    expect(playerModelSchema.safeParse(model).success).toBe(false);
  });
});

describe('RNGState schema', () => {
  it('accepts valid RNG state', () => {
    expect(rngStateSchema.safeParse(makeRngState()).success).toBe(true);
  });

  it('rejects negative seed', () => {
    const rng = makeRngState();
    rng.seed = -1;
    expect(rngStateSchema.safeParse(rng).success).toBe(false);
  });
});
