CREATE TABLE IF NOT EXISTS steam_games (
  appid INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  cover TEXT NOT NULL,
  url TEXT NOT NULL,
  playtime_forever_minutes INTEGER NOT NULL DEFAULT 0,
  playtime_two_weeks_minutes INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_steam_games_display_order
  ON steam_games(display_order);

CREATE TABLE IF NOT EXISTS steam_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  online INTEGER NOT NULL DEFAULT 0,
  current_game_id INTEGER,
  current_game_name TEXT,
  avatar TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
