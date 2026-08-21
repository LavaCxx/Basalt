import { describe, expect, it } from 'vitest';
import { findStaleItemIds } from '../sync-worker/src/db';

describe('findStaleItemIds', () => {
  it('keeps every ID in a snapshot larger than the SQL batch size', () => {
    const currentIds = Array.from({ length: 250 }, (_, index) => `current-${index}`);
    const existingIds = [...currentIds, 'stale-a', 'stale-b'];

    expect(findStaleItemIds(existingIds, currentIds)).toEqual(['stale-a', 'stale-b']);
  });

  it('marks all existing records stale when the source snapshot is empty', () => {
    expect(findStaleItemIds(['old-a', 'old-b'], [])).toEqual(['old-a', 'old-b']);
  });
});
