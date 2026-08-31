/**
 * Shared date formatters for feed cards. Explicitly use the site's timezone so
 * Cloudflare SSR and browser hydration produce the same timeline structure.
 */
const FEED_TIME_ZONE = 'Asia/Shanghai';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEED_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatDayKey(date: Date): string {
  const parts = dayKeyFormatter.formatToParts(new Date(date));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatDay(date: Date, now = new Date()): string {
  const dateYear = formatDayKey(date).slice(0, 4);
  const currentYear = formatDayKey(now).slice(0, 4);
  return new Date(date).toLocaleDateString('zh-CN', {
    ...(dateYear !== currentYear ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
    timeZone: FEED_TIME_ZONE,
  });
}

export function formatWeekday(date: Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    weekday: 'short',
    timeZone: FEED_TIME_ZONE,
  });
}

export function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: FEED_TIME_ZONE,
  });
}
