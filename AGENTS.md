# Repository Guidelines

## Project Structure & Module Organization

This Astro site publishes content stored in Cloudflare D1 rather than local Markdown. Main-site routes live in `src/pages`, with dynamic API routes under `src/pages/api`. Static UI belongs in `src/components/ui/*.astro`; interactive SolidJS components belong in `src/components/islands/*.tsx`. Shared database queries, source adapters, utilities, and types live in `src/lib`. Cloudflare D1 migrations are in `migrations/`, and `sync-worker/` contains the independently deployed worker that synchronizes Notion, Telegram, and RSS data into D1. Static assets belong in `public/`; do not commit content images.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies.
- `pnpm dev`: run the local Astro server; it uses mock data without D1.
- `pnpm build`: create a production Astro build.
- `cd sync-worker && pnpm run dev`: run the sync worker with scheduled-event testing.
- `cd sync-worker && pnpm run migrate-local`: apply D1 migrations locally.
- `cd sync-worker && pnpm run deploy`: deploy the sync worker.

Configure local bindings from `wrangler.toml` and secrets through Wrangler; use `.env.example` only as a reference.

## Coding Style & Naming Conventions

TypeScript uses the repository's strict Astro configuration. Keep imports explicit and preserve Solid's JSX import source. Use two-space indentation, PascalCase for component filenames and exports, camelCase for functions and variables, and descriptive route-level filenames. Astro files should contain markup-first page/component logic; move reusable behavior into `src/lib` or focused island components. Follow Tailwind conventions in existing components and keep the Linear-style thin borders, restrained surfaces, and editorial typography.

## Testing Guidelines

There is no automated test suite or coverage requirement. At minimum, run `pnpm build` before submitting. Exercise changed routes and sync behavior locally, including the mock-data fallback when appropriate. For UI changes, check both light and dark themes as well as responsive layouts.

## Commit & Pull Request Guidelines

History uses concise, imperative subject lines focused on the user-visible outcome, such as `Fix Notion photo expiry` or `Refine lightbox drag interaction`; keep the same style and omit merge-noise wording. Pull requests should include a short problem statement, implementation summary, and verification performed. Link related issues and add before/after screenshots or recordings for visual changes. Note any required D1 migrations, Wrangler configuration, or environmental secrets.

## Security & Configuration Tips

Never commit credentials, private Notion tokens, or database contents. Secrets must use `wrangler secret put`. When changing data flows, keep worker writes isolated from the public Astro application, which should read from D1.

## Agent Workflow

For style-related features, pause before committing so the user can inspect the local result first. For other changes, test and build, then push directly to the repository to trigger the Cloudflare Pages deployment; afterward, the user will verify the result online.
