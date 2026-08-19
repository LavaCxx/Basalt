# RISO Full Component Theme Plan

## Status

Deferred. This plan records the approved direction for a future full RISO migration. Do not start it unless explicitly requested.

## Summary

- Keep the current Light/RISO theme system and extend the existing RISO design tokens rather than creating a separate component set.
- Use `/lab` as the canonical RISO visual reference, especially the components before `Data Table`.
- Migrate component families progressively so every stage can be inspected, validated, and reverted independently.
- Preserve the core RISO identity: green paper, CSS halftone dots, translucent overprint surfaces, and misregistered plate shadows.

## Design System

### Tokens

- Extend the token layer in `src/styles/global.css` with component-level semantic tokens:
  - surfaces: page, section, card, quiet article surface, code paper
  - ink: title, body, muted, accent, status, code tokens
  - borders: quiet, standard, expressive, code
  - effects: standard and expressive offset shadows, hover and pressed states, title misregistration
  - halftone: page, component, quiet long-form variants
- Maintain three visual levels:
  - `quiet`: article body, code, nested Notion content
  - `standard`: regular navigation, cards, lists, forms
  - `expressive`: feature cards and key visual moments

### Recipes

- Extract reusable recipes for:
  - card
  - button
  - tag
  - form field
  - pagination
  - status badge
  - list row
  - navigation item
  - media frame and caption
  - table
  - Notion blocks
  - table of contents
- Recipes should consume semantic tokens and remain independent of page-specific DOM where practical.
- Avoid scattering `html.riso` overrides across feature components.
- Change component DOM only when the existing structure cannot express the design reliably.

## Migration Phases

1. **Foundation**
   - Audit the current token layer and add missing component tokens.
   - Define recipe naming and organization.
   - Require no visual change in this phase.

2. **Core UI**
   - Migrate buttons, tags, generic cards, list rows, pagination, and status badges.
   - Compare against the equivalent `/lab` prototypes.

3. **Site Components**
   - Migrate navigation, feed cards, archive lists, photo cards, friend cards, and page headers.
   - Check hover, focus, active, disabled, empty, and loading states.

4. **Article System**
   - Redesign the table of contents as a dedicated RISO component.
   - Complete Notion block mapping while keeping long-form areas quiet.
   - Retain the Lab-style code block language bar and copy control.

5. **Polish**
   - Audit responsive layouts, focus visibility, contrast, selection states, transitions, and print behavior.
   - Normalize shadows and halftone density across pages.
   - Remove obsolete one-off RISO overrides.

## Component Guidance

- Cards: translucent paper surface, printed border, expressive or standard offset shadow depending on prominence.
- Buttons: physical press interaction through translate and shadow changes; keep accessible focus rings.
- Tags: small translucent ink chips with restrained halftone.
- Status: translucent RISO inks rather than saturated solid screen colors.
- Forms: paper-like fields with inset ink pressure and clear focus plates.
- Tables: quiet readable rows with expressive header treatment.
- Media: put only the media in the printed frame; keep captions outside the frame.
- Long-form: no expressive shadow or dense halftone inside body text and nested content.

## Non-Goals

- No third theme and no Dark/System entry restoration.
- No replacement of Notion rendering with a separate content pipeline.
- No force-restyling of `/drive`.
- No image-based or Canvas-generated halftone texture.

## Validation

- Run `pnpm build` after each phase.
- Inspect homepage, article page, archive, albums, friends page, and `/lab` in both Light and RISO.
- Check mobile widths and keyboard navigation.
- Verify Light remains visually unchanged.
- Verify RISO article readability, especially nested Notion blocks and code.
- Keep each component family in an isolated commit for easy rollback.

## Current Baseline

- The small token extraction is complete.
- Existing RISO visuals remain in `src/styles/global.css`.
- Lab prototype styles remain local to `/lab`.
