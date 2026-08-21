-- Match the public site's common filtered, newest-first query patterns.
CREATE INDEX IF NOT EXISTS idx_items_type_source_date
  ON items(type, source, date DESC);

CREATE INDEX IF NOT EXISTS idx_items_source_type_id
  ON items(source, type, id);
