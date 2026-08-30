-- Notion-managed standalone pages reuse items/article_bodies with type = 'page'.
-- Friend metadata and cached latest RSS entries live separately from the public feed.
CREATE TABLE IF NOT EXISTS friends (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  url                   TEXT NOT NULL,
  icon_url              TEXT,
  description           TEXT,
  rss_url               TEXT,
  source_created_at     TEXT NOT NULL,
  source_updated_at     TEXT NOT NULL,
  latest_post_title     TEXT,
  latest_post_url       TEXT,
  latest_post_published_at TEXT,
  rss_checked_at        TEXT,
  rss_error             TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_friends_source_created_at
  ON friends(source_created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_friends_rss_checked_at
  ON friends(rss_checked_at);
