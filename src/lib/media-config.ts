/**
 * Shared media type configuration
 * Used by FeedList.tsx and Sidebar.astro
 */

export type MediaType = 'book' | 'movie' | 'tv' | 'music' | 'game';

export const mediaTypeLabels: Record<MediaType, string> = {
  book: '书籍',
  movie: '电影',
  tv: '剧集',
  music: '音乐',
  game: '游戏',
};

/**
 * Status label for completed/in_progress/wishlist by media type
 */
export function getStatusLabel(status: 'completed' | 'in_progress' | 'wishlist', mediaType: MediaType): string {
  const labels: Record<string, Record<MediaType, string>> = {
    completed: { book: '读完', movie: '看完', tv: '看完', music: '听完', game: '通关' },
    in_progress: { book: '在读', movie: '在看', tv: '在看', music: '在听', game: '在玩' },
    wishlist: { book: '想读', movie: '想看', tv: '想看', music: '想听', game: '想玩' },
  };
  return labels[status]?.[mediaType] || '';
}
