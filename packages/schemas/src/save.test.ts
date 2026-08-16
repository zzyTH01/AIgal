import { describe, expect, it } from 'vitest';
import { saveMetadataSchema, saveSnapshotSchema } from './save.js';
import { makeSaveSnapshot } from './test-data.js';

describe('SaveSnapshot schema', () => {
  it('accepts a complete save snapshot', () => {
    expect(saveSnapshotSchema.safeParse(makeSaveSnapshot()).success).toBe(true);
  });

  it('accepts metadata without label', () => {
    const snapshot = makeSaveSnapshot();
    delete snapshot.metadata.label;
    expect(saveMetadataSchema.safeParse(snapshot.metadata).success).toBe(true);
    expect(saveSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('rejects negative day in metadata', () => {
    const snapshot = makeSaveSnapshot();
    snapshot.metadata.day = -1;
    expect(saveSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
});
