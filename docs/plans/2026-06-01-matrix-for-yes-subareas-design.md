# Bring back the rating matrix (for "Yes" sub-areas) — Design

Date: 2026-06-01
Status: Approved (revised — see note below)

> **Revision (2026-06-01):** the matrix now shows **all** of a section's sub-areas as columns, not
> only the "Yes" ones. A column is interactive only when its sub-area is marked "Yes"; sub-areas
> left at No / unanswered render as **greyed, locked columns** (cells `disabled`, with a "Skipped" /
> "Mark Yes above" note). This keeps every sub-area header visible (e.g. GENERAL always shows both
> Academic and Non-Academic). Completion/validation are unchanged (a locked column is not required).

## Goal

Keep the per-sub-area usage gate + tool selection, but render the **ratings** as the old compact
**matrix** (statements × sub-areas, cells = vertical-stacked 1–5) instead of long per-card
statement lists. ~~The matrix columns are only the sub-areas the user marked "Yes".~~ All sub-areas
are shown as columns; non-"Yes" ones are greyed/locked (see revision note above).

## Section page layout (new)

1. Header (icon + name + description) — unchanged.
2. 1–5 scale strip — unchanged. GENERAL extras — unchanged.
3. **Setup block** (`.setup`): one compact card per sub-area — name + status badge
   (Pending / In progress / Done / Skipped) + **Yes/No** segmented gate + (if Yes) the ranked
   tool picker. No statements here. No accordion (cards are short).
4. **Matrix block** (`.matrix-host`): a single table, rows = the 25 statements, **columns = the
   sub-areas with usage = "Yes"** (original order), cells = vertical 1–5 (`buildNumberScale`,
   styled column). Sticky question column + sticky header row; horizontal scroll + "Scroll →" cue
   when columns overflow. If no sub-area is "Yes", the matrix is omitted.

## What changes vs. stays

- **Changes:** only the section render in `assets/js/app.js` (accordion-with-statements →
  setup cards + Yes-column matrix) and `assets/css/styles.css` (re-add matrix styles + revert
  `.numscale` to vertical; add `.setup`/`.setupcard`).
- **Unchanged (do not touch):** answer keys `useKey(sec,col)`/`toolsKey(sec,col)`/`keyOf`,
  completion `colResolved`/`colCellsComplete`/`sectionComplete`, `LS_KEY` = `v6`, the export
  (already per sub-area), and the **entire Google Apps Script delivery/token system**.

## Interactions / re-render

- Toggling **Yes/No** changes which columns exist → re-render setup **and** matrix
  (`rerenderSection`).
- Toggling a **tool** only affects that setup card/badge → re-render setup only (`rerenderSetup`);
  the matrix is untouched (keeps cell state).
- Rating a **cell** → save + update progress/stepper + `updateSetupBadges` (a column becoming
  complete flips its setup card to "Done"); the matrix is **not** rebuilt (preserves focus).

## Validation (Next)

Extras first, then each sub-area in order: a "Yes" sub-area needs ≥1 tool and every cell in its
column filled. On failure: gate unanswered → flag/scroll its setup card; no tools → flag its
tool chips; missing cells → mark + scroll to the first empty cell in that column. "No" sub-areas
pass.

## Removed (dead after this change)

`renderCards`/`renderCard`/`renderStatements`/`rerenderCards`/`updateCardBadges`, the `expanded`
accordion state + `exKey`, and the `.sacard*`/`.statements`/`.stmt` CSS. `renderToolPicker`,
`colStatus`, `badgeHtml`, the icons, and the `.usegate`/`.segmented`/`.chip` styles are reused.

## Cache

`index.html` `?v=10 → ?v=11` on all four asset links.
