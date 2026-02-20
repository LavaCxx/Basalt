# CLAUDE.md - Context & Development Guidelines

## 1. Project Manifesto
**This is NOT a boilerplate blog.** It is a "Digital Garden & Aggregator".
- **Core Philosophy**: **"Write Elsewhere, Publish Here."**
  - No local Markdown files.
  - No Git-based content management.
  - Content is aggregated from APIs (Notion, Telegram, Douban, RSS).
- **Visual Identity**: **"Linear Container x Editorial Content"**. A hybrid utility-focused shell hosting magazine-quality content.
- **Pain Point**: The user finds writing local markdown cumbersome. The goal is zero-friction posting via mobile apps (Notion/Telegram).

## 2. Visual References & Aesthetic Benchmarks (Strict)
AI MUST emulate the following styles. Do not deviate into "Generic Bootstrap" or "Hacker Green".

1.  **The Container (Layout & Structure)**:
    -   **Reference**: [Linear.app](https://linear.app) / [Raycast](https://www.raycast.com)
    -   **Traits**: High-density information, subtle borders, geometric sans-serif UI, "Tool-like" precision.
2.  **The Content (Typography & Rhythm)**:
    -   **Reference**: [Craig Mod](https://craigmod.com) / [Frank Chimero](https://frankchimero.com)
    -   **Traits**: High contrast Serif headings, massive whitespace, "Book-like" readability, off-white/warm backgrounds.
3.  **The Texture**:
    -   **Reference**: [Modern Font Stacks](https://modernfontstacks.com)
    -   **Traits**: Subtle CSS-based **Dot Grid** backgrounds (`radial-gradient`), technical but organic.

## 3. Tech Stack
-   **Package Manager**: `pnpm` (Start commands with `pnpm`).
-   **Framework**: **Astro** (SSG + SSR for dynamic feeds).
-   **Interactivity**: **SolidJS** (For interactive islands: Lightbox, Comments, Infinite Scroll).
-   **Styling**: **Tailwind CSS** + `@tailwindcss/typography` (Prose) + **UnoCSS** (Optional, for attributify mode).
-   **State**: **Nano Stores** (Cross-island communication).
-   **Deployment**: Vercel / Cloudflare Pages.

## 4. Design System Specs

### A. Typography Stack
*Contrast between "Machine" (UI) and "Human" (Content).*
-   **CN Sans**: `MiSans` (Modern, Neutral, Xiaomi).
-   **EN Sans (UI/Nav)**: `SN Pro` (Geometric, Rounded-square feel).
-   **EN Serif (Headings/Body)**: `Newsreader` (Optical sizing, elegant).
-   **Rule**:
    -   All UI elements (Nav, Sidebar, Date, Tags, Footer) → **SN Pro**.
    -   All Content (Article Title, Body, Blockquotes) → **Newsreader**.

### B. Colors & Textures
-   **Background**: OFF-WHITE (`#faf9f6` or `#f5f5f7`). Never pure `#ffffff` in light mode.
-   **Texture**:
    ```css
    /* Dot Grid Pattern */
    background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
    background-size: 24px 24px;
    ```
-   **Borders**: Ultra-thin borders (`1px solid #e5e5e5` equivalent). No drop-shadows on containers unless hopping/active.
-   **Corners**: `rounded-md` or `rounded-sm`. Avoid fully rounded pills.

## 5. Data Pipeline (Aggegation Logic)
1.  **Articles (Notion API)**:
    -   Use Notion as Headless CMS.
    -   Fetch blocks -> Render to semantic HTML.
    -   Cache strategy: ISR (Incremental Static Regeneration) on build or short TTL.
2.  **Micro-blog (Telegram)**:
    -   Source: Telegram Channel RSS or API.
    -   Render as "Tweet-style" cards in the main feed.
3.  **Media Log (Douban/NeoDB)**:
    -   Source: RSS feeds.
    -   Display: Cover image + Rating + Short review.
4.  **Photos (R2 + Cloudinary)**:
    -   Storage: **Cloudflare R2** (Source of Truth).
    -   Delivery: Cloudinary (for resizing/format) OR Client-side R2 fetch.
    -   **Do NOT commit content images to Git.**

## 6. Page Architecture

### A. Home (The "Hub")
-   **Layout**: **Bento Grid** (Dashboard style) OR **Masonry Timeline**.
-   **Content**: A unified stream of Articles, Micro-blogs, and Media logs.
-   **Sidebar**: Profile, Friend Links, "Currently Reading/Playing".

### B. Archives (The "Library")
-   **Layout**: Minimalist text list.
-   **Grouping**: Strictly by **Year**.
-   **Style**: Just Typography. No thumbnails. High density.

### C. Memories (The "Gallery")
-   **Layout**: **Justified Gallery** (Flickr/Google Photos style, row-based) OR **Masonry**.
-   **Grouping**: Group by Year.
-   **Feature - EXIF Lightbox**:
    -   Click thumbnail → Open Fullscreen Modal (SolidJS).
    -   Load high-res image.
    -   **Frontend Parse**: Use `exifr` to read metadata.
    -   **Display**: Camera Model, Lens, ISO, Shutter Speed, Aperture (overlay at bottom).

### D. Friends / About
-   **Style**: Simple card grid for friends.
-   **Content**: Static Markdown or config file.

## 7. Development Guidelines
-   **Component Strategy**:
    -   `src/layouts/*.astro` -> Global shells.
    -   `src/components/ui/*.astro` -> Static UI (Headers, Footer, Cards).
    -   `src/components/islands/*.tsx` -> SolidJS Interactive components.
-   **Type Safety**:
    -   Create a unified `FeedItem` interface that all sources (Notion, RSS, Telegram) map to.
    -   Strict TypeScript mode enabled.
-   **File Structure**:
    -   Keep data fetchers separated in `src/lib/api/`.
    -   Keep adapters (Notion to HTML, RSS to JSON) in `src/lib/adapters/`.

## 8. Development Commands
-   `pnpm install`
-   `pnpm dev`
-   `pnpm build`
-   `pnpm preview`
