import { describe, expect, it, vi } from 'vitest';
import { releaseSyncLock, tryAcquireSyncLock, type D1Database } from '../sync-worker/src/db';

function databaseWithRunResult(runResult: unknown) {
  const run = vi.fn().mockResolvedValue(runResult);
  const prepare = vi.fn().mockReturnValue({ run });
  return { db: { prepare } as unknown as D1Database, prepare, run };
}

describe('sync lock', () => {
  it('acquires a missing or expired lease', async () => {
    const { db } = databaseWithRunResult({ meta: { changes: 1 } });
    await expect(tryAcquireSyncLock(db)).resolves.toBe(true);
  });

  it('rejects a concurrent lease', async () => {
    const { db } = databaseWithRunResult({ meta: { changes: 0 } });
    await expect(tryAcquireSyncLock(db)).resolves.toBe(false);
  });

  it('releases the global lease', async () => {
    const { db, prepare, run } = databaseWithRunResult({ meta: { changes: 1 } });
    await releaseSyncLock(db);

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM sync_locks"));
    expect(run).toHaveBeenCalledOnce();
  });
});
