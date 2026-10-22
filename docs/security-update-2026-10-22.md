# 2026-10-22 security update

This release keeps the existing Cloudflare Pages deployment and D1 bindings.

## Updates

- Pin local and Pages build Node to 24.22.1 using Volta and `.node-version`; require patched supported Node release lines in both packages.
- Update Astro to 5.18.2, Solid to 1.9.17, fast-xml-parser to 5.11.2, Vite to 6.4.5, and the remaining compatible dependencies and transitive dependencies.
- Update both Wrangler installations to 4.151.3. Override the older Wrangler pulled in by the Pages adapter and Sharp to >=0.35.5.
- Explicitly use the adapter's passthrough image service. The application uses its own image routes rather than Astro image optimization.
- Keep the Notion SDK API version unchanged to avoid changing the synchronization data contract.

## Verification

- Official Node 24.22.1 archive checksum verified; production build and all 29 tests pass using that binary.
- Sync Worker production packaging (`wrangler deploy --dry-run`) passes.
- npm audit using registry.npmjs.org: main site 109 -> 12 advisories; independent sync-worker 0 advisories after update. This counts advisories, including build dependencies, rather than confirmed exploitable application paths.
- Astro check reports 44 errors. The same 44 diagnostics reproduce against the pre-change source with the updated dependencies; no new diagnostics result from the source/config changes in this release.
- The sync-worker TypeScript configuration includes all shared `src/lib` files, including browser-only code, and its full typecheck fails. Production Worker bundling passes.

## Remaining work

The main-site audit still reports 10 Astro advisories, one Cloudflare adapter advisory, and one build-time esbuild advisory. Do not treat this release as a clean security audit.

Astro's AVIF advisory is conditional on untrusted image optimization; this release uses passthrough and updates Sharp. Source inspection did not find Astro asset image components, `server:defer`, `define:vars`, or direct Seroval JSON deserialization. Other Astro advisories require further reachability analysis; lack of a direct call is not proof of safety.

Fully removing the remaining framework advisories requires upgrading Astro and its Cloudflare adapter. The current adapter has removed Cloudflare Pages support and changes runtime bindings, so that upgrade needs a separately verified Pages-to-Workers migration. This patch does not silently change the hosting platform.

Cloudflare compatibility dates are behavior selectors, not runtime security patch versions; they are intentionally unchanged.
