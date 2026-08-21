import { describe, expect, it } from 'vitest';
import { decodeFeedCursor, encodeFeedCursor } from '../src/lib/db';

describe('feed cursor', () => {
  it('round-trips a stable date and Unicode ID', () => {
    const cursor = { date: '2026-08-21T13:00:00.000Z', id: '文章/同一时间' };
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it('rejects malformed and incomplete cursors', () => {
    expect(decodeFeedCursor('not-base64')).toBeNull();
    expect(decodeFeedCursor(encodeFeedCursor({ date: 'invalid', id: 'item' }))).toBeNull();
    expect(decodeFeedCursor(encodeFeedCursor({ date: '2026-08-21T13:00:00.000Z', id: '' }))).toBeNull();
  });
});
