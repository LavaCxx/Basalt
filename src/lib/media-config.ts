/**
 * Shared media type configuration
 * Used by FeedList.tsx and Sidebar.astro
 */

export type MediaType = 'book' | 'movie' | 'tv' | 'music' | 'game' | 'manga' | 'anime';

export const mediaTypeLabels: Record<MediaType, string> = {
  book: '书籍',
  movie: '电影',
  tv: '剧集',
  music: '音乐',
  game: '游戏',
  manga: '漫画',
  anime: '番剧',
};

/**
 * Status label for completed/in_progress/wishlist/paused by media type
 */
export function getStatusLabel(status: 'completed' | 'in_progress' | 'wishlist' | 'paused', mediaType: MediaType): string {
  const labels: Record<string, Record<MediaType, string>> = {
    completed: { book: '读完', movie: '看完', tv: '看完', music: '听完', game: '通关', manga: '看完', anime: '看完' },
    in_progress: { book: '在读', movie: '在看', tv: '在看', music: '在听', game: '在玩', manga: '在看', anime: '在看' },
    wishlist: { book: '想读', movie: '想看', tv: '想看', music: '想听', game: '想玩', manga: '想看', anime: '想看' },
    paused: { book: '搁置', movie: '搁置', tv: '搁置', music: '搁置', game: '搁置', manga: '搁置', anime: '搁置' },
  };
  return labels[status]?.[mediaType] || '';
}
