CREATE INDEX IF NOT EXISTS idx_items_date_id
  ON items(date DESC, id DESC);
