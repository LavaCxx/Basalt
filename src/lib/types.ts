/**
 * Core type definitions for the Digital Garden & Aggregator
 */

/**
 * Feed item types supported by the aggregator
 */
export type FeedItemType = 'article' | 'page' | 'microblog' | 'media' | 'photo';

export type PublicFeedItemType = Exclude<FeedItemType, 'page'>;

/**
 * Content sources for the aggregator
 */
export type ContentSource = 'notion' | 'telegram' | 'douban' | 'rss';

/**
 * Unified feed item interface - all content sources map to this
 */
interface FeedItemBase {
  /** Unique identifier */
  id: string;
  /** Title (optional for microblogs) */
  title?: string;
  /** Main content (HTML for articles, plain text for microblogs) */
  content: string;
  /** Publication date */
  date: Date;
  /** Last modification time reported by the content source */
  updatedDate?: Date;
  /** Content source */
  source: ContentSource;
  /** External URL (e.g., original Notion page, Telegram message) */
  url?: string;
  /** Cover/thumbnail image */
  image?: string;
}

export interface ArticleFeedItem extends FeedItemBase {
  type: 'article';
  metadata?: ArticleMetadata;
}

export interface PageFeedItem extends FeedItemBase {
  type: 'page';
  metadata?: ArticleMetadata;
}

export interface MicroblogFeedItem extends FeedItemBase {
  type: 'microblog';
  metadata?: MicroblogMetadata;
}

export interface MediaFeedItem extends FeedItemBase {
  type: 'media';
  metadata?: MediaMetadata;
}

export interface PhotoFeedItem extends FeedItemBase {
  type: 'photo';
  metadata?: PhotoMetadata;
}

export type FeedItem = ArticleFeedItem | PageFeedItem | MicroblogFeedItem | MediaFeedItem | PhotoFeedItem;

export interface FriendLatestPost {
  title: string;
  url: string;
  publishedAt?: Date;
}

export interface Friend {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  description?: string;
  rssUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  latestPost?: FriendLatestPost;
}

export interface FeedCursor {
  date: string;
  id: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface FeedStats {
  articles: number;
  photos: number;
  microblogs: number;
  media: number;
}

/**
 * Article-specific metadata
 */
export interface ArticleMetadata {
  /** Display name for articles imported from an RSS feed */
  feedName?: string;
  /** Reading time in minutes */
  readingTime?: number;
  /** Article tags/categories */
  tags?: string[];
  /** Article excerpt/summary */
  excerpt?: string;
  /** Whether the article is featured */
  featured?: boolean;
  /** Degree to which AI assisted with the article */
  aiInvolvement?: '未使用' | '辅助润色' | '协作创作' | '主要生成';
}

/**
 * Microblog-specific metadata (Telegram, Twitter, etc.)
 */
export interface MicroblogMetadata {
  /** Original platform */
  platform?: 'telegram' | 'twitter' | 'mastodon';
  /** Channel name (for Telegram) */
  channel?: string;
  /** Number of likes/hearts */
  likes?: number;
  /** Number of replies */
  replies?: number;
  /** Associated media attachments */
  attachments?: MediaAttachment[];
  /** Telegram-generated link preview card */
  linkPreview?: TelegramLinkPreview;
}

export interface TelegramLinkPreview {
  /** Destination URL shown by Telegram */
  url: string;
  /** Publisher/site label */
  siteName?: string;
  /** Link preview title */
  title?: string;
  /** Link preview description */
  description?: string;
  /** Stable internal image proxy URL */
  image?: string;
}

/**
 * Media attachment for microblog posts
 */
export interface MediaAttachment {
  type: 'image' | 'video' | 'link';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  alt?: string;
}

/**
 * Media log metadata (Douban, NeoDB - books, movies, music)
 */
export interface MediaMetadata {
  /** Type of media */
  mediaType: 'book' | 'movie' | 'music' | 'game' | 'tv' | 'manga' | 'anime';
  /** Rating (1-5 or 1-10) */
  rating?: number;
  /** Maximum rating value */
  maxRating?: number;
  /** User's review/notes */
  review?: string;
  /** Status (e.g., "read", "watching", "want to read") */
  status?: 'completed' | 'in_progress' | 'wishlist' | 'paused';
  /** Author/director/artist */
  creator?: string;
  /** Release year */
  year?: number;
  /** End date for media consumption (ISO string) */
  endDate?: string;
}

/**
 * Photo metadata including EXIF data
 */
export interface PhotoMetadata {
  /** EXIF information */
  exif?: PhotoEXIF;
  /** Album/collection name */
  album?: string;
  /** Location */
  location?: string;
  /** Stable reference for a Notion-hosted photo */
  notionImage?: {
    pageId: string;
    property: string;
    index: number;
  };
  /** Camera used */
  camera?: string;
  /** Lens used */
  lens?: string;
  /** Tags */
  tags?: string[];
}

/**
 * EXIF data extracted from photos
 */
export interface PhotoEXIF {
  /** Camera manufacturer and model */
  camera?: string;
  /** Lens model */
  lens?: string;
  /** ISO sensitivity */
  iso?: number;
  /** Shutter speed (e.g., "1/250") */
  shutterSpeed?: string;
  /** Aperture (e.g., "f/2.8") */
  aperture?: string;
  /** Focal length in mm */
  focalLength?: number;
  /** Date photo was taken */
  dateTaken?: Date;
  /** GPS coordinates */
  gps?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Site configuration
 */
export interface SiteConfig {
  title: string;
  description: string;
  author: string;
  url: string;
  social: SocialLinks;
}

/**
 * Social media links
 */
export interface SocialLinks {
  twitter?: string;
  github?: string;
  telegram?: string;
  email?: string;
}

/**
 * Friend link for sidebar
 */
export interface FriendLink {
  name: string;
  url: string;
  avatar?: string;
  description?: string;
}

/**
 * Currently consuming item (reading, watching, playing)
 */
export interface CurrentItem {
  type: 'reading' | 'watching' | 'playing' | 'listening';
  /** Media type: book, movie, tv, music, game */
  mediaType?: 'book' | 'movie' | 'tv' | 'music' | 'game' | 'manga' | 'anime';
  title: string;
  author?: string;
  cover?: string;
  url?: string;
  date?: Date;
  endDate?: Date;
}

export interface SteamGame {
  id: number;
  name: string;
  cover: string;
  url: string;
  playtimeForeverMinutes: number;
  playtimeTwoWeeksMinutes: number;
}

export interface SteamStatus {
  online: boolean;
  currentGameId?: number;
  currentGameName?: string;
  avatar?: string;
}

export interface SteamSnapshot {
  games: SteamGame[];
  status: SteamStatus;
}

export interface ManualGame {
  id: string;
  title: string;
  cover?: string;
  url?: string;
  date?: Date;
}

/**
 * Archive item for the archives page
 */
export interface ArchiveItem {
  id: string;
  title: string;
  date: Date;
  type: FeedItemType;
  url: string;
}

/**
 * Archive items grouped by year
 */
export interface ArchiveGroup {
  year: number;
  items: ArchiveItem[];
  count: number;
}
