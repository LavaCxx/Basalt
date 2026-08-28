---
name: LavaC's Stash
description: A personal editorial archive for writing, links, photos, and experiments.
colors:
  paper: "#faf9f6"
  paper-alt: "#ededf0"
  ink: "#1a1a1a"
  ink-secondary: "#666666"
  ink-muted: "#999999"
  rule: "#e5e5e5"
  rule-subtle: "#f0f0f0"
  riso-paper: "#f2f8e9"
  riso-paper-alt: "#e3f1d7"
  riso-ink: "#173227"
  riso-body-ink: "#2b4b3b"
  riso-accent: "#17855b"
typography:
  display:
    fontFamily: "SN Pro, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "SN Pro, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "SN Pro, system-ui, PingFang SC, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  prose:
    fontFamily: "Newsreader, Georgia, Songti SC, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "SN Pro, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  sm: "0.3rem"
  md: "0.5rem"
  lg: "0.75rem"
  pill: "999px"
spacing:
  content: "1.5rem"
  section: "4rem"
  page-top: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-riso-primary:
    backgroundColor: "{colors.riso-accent}"
    textColor: "{colors.riso-paper}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1rem"

## Overview

**Creative North Star: "The Personal Editorial Desk"**

LavaC's Stash treats a personal website as an editorial desk: part reading room, part archive, and part laboratory. The interface is quiet enough for text and images to lead, but has a distinct point of view through precise typography, fine rules, small labels, and occasional one-bit or RISO interventions.

The default light world is restrained, off-white, and ink-led. The RISO world is not a dark-mode variant; it is a paper-green overprint material with halftone texture, translucent surfaces, and deliberately misregistered plate shadows. `/lab` can be more experimental, while `/drive` remains its own visual experience.

**Key Characteristics:**
- Editorial and archive-oriented rather than dashboard-like.
- Restrained neutral surfaces with a single ink-led accent in Light mode.
- Paper green, halftone dots, translucent overprint, and offset plates in RISO mode.
- Typography and spacing carry hierarchy; decoration stays purposeful.

## Colors

The palette is built around warm off-white paper and near-black ink, with a complete green RISO plate system available as a deliberate alternate material.

### Primary
- **Archive Ink** (`{colors.ink}`): Primary text, active controls, strong rules, and high-emphasis marks in Light mode.
- **RISO Accent Green** (`{colors.riso-accent}`): Primary action and overprint color in RISO mode.

### Neutral
- **Warm Paper** (`{colors.paper}`): Light-mode page canvas.
- **Cool Paper Alt** (`{colors.paper-alt}`): Secondary surfaces and contrast blocks.
- **Secondary Ink** (`{colors.ink-secondary}`): Supporting copy and metadata.
- **Muted Ink** (`{colors.ink-muted}`): Captions, dates, and low-priority labels.
- **Fine Rule** (`{colors.rule}`): Dividers and understated borders.
- **RISO Paper** (`{colors.riso-paper}`): Green paper base for the RISO theme.
- **RISO Deep Ink** (`{colors.riso-ink}`): High-contrast RISO text and code surfaces.

### Named Rules
**The Material Theme Rule.** RISO changes the material language—paper, dots, overprint, and plate shadows—not only the background color.

## Typography

**Display Font:** SN Pro (with system-ui fallbacks)
**Body Font:** SN Pro (with PingFang SC and system fallbacks)
**Prose Font:** Newsreader (with Georgia and Songti SC fallbacks)

**Character:** SN Pro provides compact, modern editorial UI text and strong small labels. Newsreader adds a warmer reading voice for long-form article content without competing with the interface.

### Hierarchy
- **Display** (700, `clamp(2.25rem, 6vw, 3.75rem)`, 1.1): Page-level titles and distinctive introductions.
- **Headline** (700, `clamp(1.5rem, 3vw, 2.25rem)`, 1.2): Section and article headings.
- **Body** (400, 1rem, 1.6): Interface copy, summaries, and metadata explanations.
- **Prose** (400, 1.125rem, 1.8): Article reading content.
- **Label** (650, 0.75rem, 0.06em tracking): Dates, categories, navigation metadata, and compact controls.

### Named Rules
**The Two-Voice Rule.** Use SN Pro for navigation and interface structure; reserve Newsreader for sustained reading.

## Layout

Pages use a centered shell with a maximum width of approximately `72rem`, horizontal padding of `1.5rem` that grows to `2rem` on large screens, and generous vertical breathing room. Reading surfaces narrow to approximately `42rem` for comfortable prose. Sidebar pages become a single column on small screens and a main-plus-sidebar composition at the large breakpoint, with the sidebar becoming sticky. A `24px` dot grid is an occasional structural background; RISO uses a denser `7px` paper halftone.

The layout favors vertical editorial rhythm over dense application grids. Content cards and feed entries can use thin rules and small offsets, while the page shell remains calm and legible.

## Elevation & Depth

Light mode is mostly flat, using tonal surface changes and fine borders. Cards use a restrained `3px 3px` offset rather than soft floating shadows. RISO adds a tactile print depth system: translucent green and deep-green plate offsets, halftone layers, and occasional backdrop blur. Shadows are graphic and directional, not ambient decoration.

### Shadow Vocabulary
- **Light card offset** (`3px 3px 0 var(--color-border-subtle)`): Quiet separation for cards and featured entries.
- **RISO plate offset** (`4px 3px 0 rgba(63,154,103,.18), -2px 5px 0 rgba(24,60,44,.09)`): Misregistered print depth for cards and controls.
- **RISO hover offset** (`6px 5px 0 ...`): Slightly increased misregistration on interactive hover.

## Shapes

The system uses gently rounded paper corners rather than fully pill-shaped containers. Common cards and controls sit around `0.5rem`; larger visual frames may reach `0.75rem`; pills are reserved for compact metadata or tags. Borders are thin and quiet in Light mode, with dashed rules used sparingly for editorial callouts. Circular silhouettes are reserved for avatars and small identity marks.

## Components

### Buttons
- **Shape:** Compact gently rounded corners (`0.5rem`) with a tactile offset response in RISO.
- **Primary:** Ink-filled in Light mode; RISO accent-green overprint in RISO mode.
- **Hover / Focus:** Darken or strengthen the border; RISO hover increases plate separation. Focus uses a visible `2px` outline.
- **Secondary / Ghost:** Transparent or paper-toned fill with a fine border and secondary-ink label.

### Chips
- **Style:** Small uppercase or compact metadata labels, usually pill-shaped (`999px`) with translucent overprint treatment in RISO.
- **State:** Keep selected state legible through ink/accent contrast rather than heavy fills.

### Cards / Containers
- **Corner Style:** Subtle rounded paper corners (`0.5rem` to `0.75rem`).
- **Background:** Warm paper or tonal alternate surface in Light; translucent white over RISO paper in RISO.
- **Shadow Strategy:** Flat with a small offset in Light; dual misregistered plates in RISO.
- **Border:** One-pixel neutral or green rule.
- **Internal Padding:** Usually `1rem` to `1.5rem`, with more space for editorial feature cards.

### Inputs / Fields
- **Style:** Paper or alternate-surface background, one-pixel border, and restrained radius.
- **Focus:** Visible ink-colored `2px` outline; preserve the quiet field surface.
- **Error / Disabled:** Use text and border contrast, not color alone.

### Navigation
- **Style:** Compact SN Pro labels in a restrained header; active links use primary ink and may receive RISO plate treatment. Mobile navigation collapses into a compact trigger and revealed list.

### Article Surface
Long-form content uses a dedicated reading column, serif prose, quieter texture, and code blocks with their own high-contrast paper/ink treatment. RISO texture is intentionally reduced or removed inside article content for readability.

## Do's and Don'ts

### Do:
- **Do** preserve the Light ↔ RISO theme model; the visible choice is not Dark/System.
- **Do** let typography, whitespace, and fine rules establish hierarchy before adding decoration.
- **Do** keep RISO halftone texture restrained and maintain readable body contrast.
- **Do** use offset shadows as graphic print registration, especially for RISO interactive surfaces.
- **Do** keep `/drive` visually independent from the site-wide paper system.

### Don't:
- **Don't** introduce a visible dark theme toggle without explicit approval.
- **Don't** flatten RISO into a simple green background swap.
- **Don't** use heavy soft shadows, excessive nested cards, or generic SaaS gradients.
- **Don't** add noisy halftone texture to long-form text or code blocks.
- **Don't** use rounded pills for every control; reserve them for tags and compact metadata.
