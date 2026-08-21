CREATE TABLE IF NOT EXISTS sync_locks (
  name        TEXT PRIMARY KEY,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now'))
);
