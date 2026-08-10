/**
 * Shared date formatter for feed cards
 */
export function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const isCurrentYear = d.getFullYear() === now.getFullYear();

  if (isCurrentYear) {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
