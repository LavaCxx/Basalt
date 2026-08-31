import { describe, expect, it } from 'vitest';
import { formatDay, formatDayKey, formatTime, formatWeekday } from '../src/components/islands/feed-cards/formatDate';

describe('feed date formatting', () => {
  const afterShanghaiMidnight = new Date('2026-08-30T16:30:00.000Z');

  it('uses the site timezone for timeline grouping', () => {
    expect(formatDayKey(afterShanghaiMidnight)).toBe('2026-08-31');
  });

  it('uses the same timezone for visible date and time labels', () => {
    expect(formatDay(afterShanghaiMidnight, new Date('2026-08-31T04:00:00.000Z'))).toBe('8月31日');
    expect(formatWeekday(afterShanghaiMidnight)).toBe('周一');
    expect(formatTime(afterShanghaiMidnight)).toBe('00:30');
  });
});
