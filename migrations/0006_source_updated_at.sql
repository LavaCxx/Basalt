-- Preserve the source's content modification time separately from sync bookkeeping.
ALTER TABLE items ADD COLUMN source_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_items_source_updated_at ON items(source_updated_at);
