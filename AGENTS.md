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

## RISO Theme Direction

- The public theme switch is intentionally **Light ↔ RISO**; do not reintroduce Dark/System through the visible toggle without explicit user approval. Legacy dark CSS may remain for future restoration.
- RISO is a full-site style system, not only a background color swap: preserve the **paper green base, CSS halftone dots, translucent overprint surfaces, and misregistered plate shadows**.
- Keep halftone texture visible globally at a restrained opacity, but reduce noise inside long-form article content and code blocks for readability.
- Prefer semantic CSS variables and `html.riso` overrides over restructuring components. `/drive` remains a standalone visual experience and should not be force-restyled.
- Interactive controls should use subtle offset-print hover/active states: hover increases misregistration slightly; active presses the element toward the paper.

## Testing Guidelines

There is no automated test suite or coverage requirement. At minimum, run `pnpm build` before submitting. Exercise changed routes and sync behavior locally, including the mock-data fallback when appropriate. For UI changes, check both Light and RISO themes as well as responsive layouts.

## Commit & Pull Request Guidelines

History uses concise, imperative subject lines focused on the user-visible outcome, such as `Fix Notion photo expiry` or `Refine lightbox drag interaction`; keep the same style and omit merge-noise wording. Pull requests should include a short problem statement, implementation summary, and verification performed. Link related issues and add before/after screenshots or recordings for visual changes. Note any required D1 migrations, Wrangler configuration, or environmental secrets.

## Security & Configuration Tips

Never commit credentials, private Notion tokens, or database contents. Secrets must use `wrangler secret put`. When changing data flows, keep worker writes isolated from the public Astro application, which should read from D1.

## Agent Workflow

For style-related features, pause before committing so the user can inspect the local result first. For other changes, test and build, then push directly to the repository to trigger the Cloudflare Pages deployment; afterward, the user will verify the result online.
- The `/lab` RISO UI section is the reference implementation. Its component recipe is:
  - **Paper:** gradient `#f2f8e9 → #e3f1d7`, fine dot overlay `rgba(18,58,41,0.075)` at `7px`, soft green edge, and dual offset plate shadows.
  - **Cards:** translucent white fill (`rgba(255,255,255,0.48)`), `#27855b` border, dual misregistration shadows (`rgba(63,154,103,0.22)` and `rgba(24,60,44,0.1)`), generous padding, and rounded paper corners.
  - **Titles:** green dual text-shadow offsets to echo misregistered plates; body text stays solid and readable.
  - **Tags:** uppercase green capsules using translucent overprint fill (`rgba(63,154,103,0.18)`) and soft green borders.
  - **Buttons:** secondary controls use translucent paper fill; primary uses `rgba(23,133,91,0.9)` overprint green. Hover moves slightly away from the paper and increases shadow; active moves into the paper and reduces shadow.
  - **Media frames:** layered radial halftone and green plate gradients, `multiply` blending, deep-green frame, and a caption baseline.
  - **Quotes:** translucent green overprint surface, dashed green border, oversized decorative quotation mark, and restrained width.
