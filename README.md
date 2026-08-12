# Basalt — Digital Garden & Aggregator

A serverless blog that aggregates content from multiple sources (Notion, Telegram, Douban) into a unified feed. Built with **"Write Elsewhere, Publish Here"** philosophy.

## Architecture

```
Notion / Telegram / Douban
        │
        ▼
  ┌─────────────────┐
  │   Sync Worker   │  Cloudflare Worker + Cron Trigger (every 10 min)
  │   (sync-worker/) │  Pulls data, enriches bookmarks, writes to D1
  └────────┬────────┘
           │
           ▼
  ┌───────────────┐
  │   D1 (SQLite)  │  Single source of truth
  └───────┬───────┘
          │
          ▼
  ┌─────────────────┐
  │  Astro on Pages  │  SSR reads D1 only — never contacts third-party APIs
  └─────────────────┘
```

## Setup

### 1. Create D1 database

```sh
wrangler d1 create basalt
# Copy the database_id into wrangler.toml and sync-worker/wrangler.toml
wrangler d1 migrations apply basalt --local   # local dev
wrangler d1 migrations apply basalt            # production
```

### 2. Configure sync worker

```sh
cd sync-worker
pnpm install
wrangler secret put NOTION_API_KEY
wrangler secret put NOTION_ARTICLES_DATABASE_ID
wrangler secret put NOTION_PHOTOS_DATABASE_ID
# Optional: TELEGRAM_CHANNEL_USERNAME, DOUBAN_USER_RSS, RSSHUB_INSTANCE
wrangler deploy
```

### 3. Run the blog

```sh
pnpm install
pnpm dev      # local dev (uses mock data if D1 unavailable)
pnpm build    # production build
```

## Project Structure

```text
/
├── migrations/          D1 SQL migrations
├── sync-worker/         Independent Cloudflare Worker for data sync
│   ├── src/
│   │   ├── index.ts     Entry: scheduled (Cron) + fetch (manual trigger)
│   │   ├── sync.ts      Per-source sync functions
│   │   ├── db.ts        D1 upsert helpers
│   │   └── link-enricher.ts  Bookmark OG metadata fetcher
│   └── wrangler.toml
├── src/
│   ├── lib/
│   │   ├── api/         Source fetchers (Notion, RSS, Telegram) — used by sync worker
│   │   ├── db.ts        D1 read queries — used by Pages
│   │   ├── types.ts     Unified FeedItem types
│   │   └── mock-data.ts Dev fallback data
│   ├── pages/           Astro routes
│   └── components/      UI + SolidJS islands
└── wrangler.toml        Pages wrangler config (D1 binding)
```

## Commands

| Command | Action |
|:--|:--|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Local dev server (falls back to mock data without D1) |
| `pnpm build` | Production build |
| `cd sync-worker && pnpm run dev` | Run sync worker locally with `--test-scheduled` |
| `cd sync-worker && pnpm run deploy` | Deploy sync worker |
| `wrangler d1 migrations apply basalt` | Apply DB migrations |
