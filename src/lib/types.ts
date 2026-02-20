/**
 * Core type definitions for the Digital Garden & Aggregator
 */

/**
 * Feed item types supported by the aggregator
 */
export type FeedItemType = 'article' | 'microblog' | 'media' | 'photo';

/**
 * Content sources for the aggregator
 */
export type ContentSource = 'notion' | 'telegram' | 'douban' | 'rss';

/**
 * Unified feed item interface - all content sources map to this
 */
export interface FeedItem {
  /** Unique identifier */
  id: string;
  /** Type of content */
  type: FeedItemType;
  /** Title (optional for microblogs) */
  title?: string;
  /** Main content (HTML for articles, plain text for microblogs) */
  content: string;
  /** Publication date */
  date: Date;
  /** Content source */
  source: ContentSource;
  /** External URL (e.g., original Notion page, Telegram message) */
  url?: string;
  /** Cover/thumbnail image */
  image?: string;
  /** Additional metadata specific to content type */
  metadata?: ArticleMetadata | MicroblogMetadata | MediaMetadata | PhotoMetadata;
}

/**
 * Article-specific metadata
 */
export interface ArticleMetadata {
  /** Reading time in minutes */
  readingTime?: number;
  /** Article tags/categories */
  tags?: string[];
  /** Article excerpt/summary */
  excerpt?: string;
  /** Whether the article is featured */
  featured?: boolean;
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
}

/**
 * Media attachment for microblog posts
 */
export interface MediaAttachment {
  type: 'image' | 'video' | 'link';
  url: string;
  thumbnail?: string;
  alt?: string;
}

/**
 * Media log metadata (Douban, NeoDB - books, movies, music)
 */
export interface MediaMetadata {
  /** Type of media */
  mediaType: 'book' | 'movie' | 'music' | 'game' | 'tv';
  /** Rating (1-5 or 1-10) */
  rating?: number;
  /** Maximum rating value */
  maxRating?: number;
  /** User's review/notes */
  review?: string;
  /** Status (e.g., "read", "watching", "want to read") */
  status?: 'completed' | 'in_progress' | 'wishlist';
  /** Author/director/artist */
  creator?: string;
  /** Release year */
  year?: number;
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
  mediaType?: 'book' | 'movie' | 'tv' | 'music' | 'game';
  title: string;
  author?: string;
  cover?: string;
  url?: string;
  progress?: number; // 0-100 percentage
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
