#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
snapshot_dir=$(mktemp -d "${TMPDIR:-/tmp}/basalt-d1.XXXXXX")
snapshot_file="$snapshot_dir/basalt.sql"
persist_dir="$project_dir/.wrangler/state"

cleanup() {
  rm -rf -- "$snapshot_dir"
}
trap cleanup EXIT INT TERM

cd "$project_dir"

pnpm exec wrangler d1 export basalt --remote --output="$snapshot_file"
pnpm exec wrangler d1 execute basalt --local --persist-to="$persist_dir" --yes --command \
  "DROP TABLE IF EXISTS friends; DROP TABLE IF EXISTS article_bodies; DROP TABLE IF EXISTS link_metadata; DROP TABLE IF EXISTS sync_state; DROP TABLE IF EXISTS sync_locks; DROP TABLE IF EXISTS steam_state; DROP TABLE IF EXISTS steam_games; DROP TABLE IF EXISTS items; DROP TABLE IF EXISTS d1_migrations;"
pnpm exec wrangler d1 execute basalt --local --persist-to="$persist_dir" --yes --file="$snapshot_file"

echo "Local D1 refreshed from production."
