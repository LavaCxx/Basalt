-- Basalt D1 Schema: Unified content store
-- This replaces the real-time aggregation model with a sync-then-serve model.

-- ============================================================
-- items: unified feed content (articles, photos, microblogs, media)
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,          -- source-native ID (Notion page ID, Telegram GUID, etc.)
  type        TEXT NOT NULL,             -- 'article' | 'photo' | 'microblog' | 'media'
  source      TEXT NOT NULL,             -- 'notion' | 'telegram' | 'douban' | 'rss'
  title       TEXT,
  content     TEXT NOT NULL DEFAULT '',  -- plain text or summary (full HTML for articles is in article_bodies)
  url         TEXT,
  image       TEXT,
  date        TEXT NOT NULL,             -- ISO 8601
  metadata_json TEXT,                    -- type-specific metadata as JSON string
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_type   ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_date   ON items(date);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);

-- ============================================================
-- article_bodies: full HTML for articles (kept separate for fast list queries)
-- ============================================================
CREATE TABLE IF NOT EXISTS article_bodies (
  item_id      TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  html         TEXT NOT NULL,
  reading_time INTEGER DEFAULT 5
);

-- ============================================================
-- link_metadata: enriched link preview data for Notion bookmark blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS link_metadata (
  url         TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT,
  image       TEXT,
  favicon     TEXT,
  domain      TEXT,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- sync_state: incremental sync bookkeeping
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_state (
  source         TEXT PRIMARY KEY,       -- 'notion:articles' | 'notion:photos' | 'telegram' | 'douban'
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  cursor         TEXT                    -- pagination cursor (e.g. Notion start_cursor); NULL = start from beginning
);
