/**
 * Shared time formatter for feed cards. Dates are rendered by the timeline.
 */
export function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
