# Per-sub-task tool selection + Apple-like redesign — Design

Date: 2026-06-01
Status: Approved

## Goal

Two user-requested changes to the static AI-use survey:

1. **Tool selection per sub-task.** Today each of the 5 sections has ONE tool picker and one
   usage gate; the sub-tasks (matrix columns) share them. Move both the **usage gate (Yes/No)**
   and the **ranked tool picker** down to the **sub-task (column) level**.
2. **Apple-like clean redesign with icons.** Calmer visual language, more whitespace, hairline
   borders, larger radii, segmented controls, smooth accordion animation, and inline-SVG icons.

## Decisions (user-approved)

- **Granularity:** per sub-area (matrix column), not per section.
- **Usage gate:** per sub-area. Each sub-area card has its own "Do you use AI for this task?"
  Yes/No. "No" marks that sub-area complete (skipped). "Yes" reveals tool picker + statements.
- **Layout:** accordion cards. Each sub-area is a collapsed card on the section page; tap to
  expand. The 6-step flow (About + 5 sections) and top stepper stay unchanged.
- **Accent:** Apple blue (`#0071e3` / `#0a84ff`). Everything else white/gray, single accent.
- **Tool brand logos:** NOT used (too many tools, maintenance/licensing). Clean ranked chips only.

## Why this is *less* work for respondents

The statement count is unchanged (25 statements × N sub-areas = same cells as the old matrix).
But the old per-section gate forced "Yes" respondents through *every* sub-area. Per-sub-area
gating lets them skip each unused sub-task individually, so the typical respondent answers fewer
cells than before.

## Structure & flow (unchanged shell)

`#welcome → #about → one #<slug> page per section → #done`. Stepper = About + 5 sections.

Section page interior changes:
- **Header:** section icon + name + description + 1–5 scale strip.
- **GENERAL only:** the general AI-usage extras (`ai_experience`, `freq`, `paid`) stay pinned at
  the top of the page, above the accordion.
- **Body:** one accordion card per sub-area (column). The old single matrix table and the old
  section-level usage gate / section-level tool picker are removed.

## Sub-area accordion card anatomy

- **Collapsed:** sub-area name + status badge — `bekliyor` (pending) / `✓ tamam` (done) /
  `atlandı` (skipped).
- **Expanded:**
  1. Usage gate: "Bu görev için AI kullanıyor musun?" → segmented control [Evet] [Hayır].
  2. **No →** badge becomes "atlandı ✓", content hidden, nothing else required.
  3. **Yes →** reveal:
     - **Tool picker** for that sub-area. Tool *list* stays the section's relevant list
       (`toolListFor(sec)`); only the *selection* is per sub-area. Rank 1·2·3 (MAX_TOOLS=3),
       "+ Other".
     - **Statements:** that sub-area's ~25 statements, each one row with a clean 1–5 control.
- Smooth expand/collapse animation. A completed card keeps its ✓ badge; it does not auto-collapse.

## Data model & storage

- `tools/parse_excel.py` and `assets/js/data.js`: **no change**. The existing
  section → `columns` (sub-areas) → `groups`/`questions` shape already supports per-column logic.
  `SECTION_TOOLS` stays per section.
- Answer keys move to sub-area scope:
  - `useKey(sec, col)` → `sec.id + "::" + col.id + "::__use"`
  - `toolsKey(sec, col)` → `sec.id + "::" + col.id + "::__tools"`
  - Rating key unchanged: `keyOf(sec.id, q.id, col.id)`.
  - Background keys unchanged: `bgKey(id)`.
- **Bump `LS_KEY` to `utaut_survey_answers_v6`** (model shape changed; discard stale saves).

## Completion / progress logic

- **Sub-area resolved** = usage == "no" OR (usage == "yes" AND ≥1 tool AND every statement cell
  for that column filled).
- **Section complete** = all extras answered (GENERAL) AND every sub-area resolved.
- Progress stays step-based (About + 5 sections). `sectionComplete`, `cellsComplete`,
  `firstIncompleteStep`, and the Next-button validation are rewritten around sub-area resolution.
- Validation on "Next": flag the first unresolved sub-area (expand it, scroll to it) — first
  unanswered gate, then missing tools, then first empty cell.

## Export changes (researcher-facing)

Usage and tools are now per sub-area, so the export must carry them per row.

- **JSON** `buildExportSections`: each `responses[]` row already has `sub_area`; add
  `uses_ai` and `tools` (the column's own values) to each row. Optionally also emit a
  `subAreas: [{sub_area, uses_ai, tools}]` summary per section.
- **CSV**: replace the single section-level "Uses AI" / "Ranked Tools" columns with per-row
  **"Uses AI"** and **"Ranked Tools"** reflecting that row's sub-area. Background columns and
  Construct/Code/Statement/Sub-area/Value/Label stay. Construct names + item codes remain
  export-only.

## Apple-like visual language

- **Font stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`
  (Inter remains as the cross-platform fallback already loaded).
- **Palette:** white/gray surfaces, hairline (1px, low-contrast) borders, larger corner radii
  (16–20px on cards), very soft shadows, Apple blue accent only.
- **Controls:** Yes/No and 1–5 rendered as segmented controls; smooth transitions; accordion
  open/close animation (max-height/opacity).
- **Icons (inline SVG, no external dependency — works on Pages and `file://`):**
  - 5 section icons keyed by slug: general→globe, learning→lightbulb, problem_solving→puzzle,
    reporting→document, data_coding→code brackets.
  - Stepper: section icon, ✓ when done.
  - Card status badges and Yes/No: check / slash glyphs.
  - A small `icon(name)` helper in `app.js` returns SVG strings; CSS sizes/colors them.

## Touched files

- `assets/js/app.js` — section render, accordion cards, per-sub-area gate/tools, completion,
  validation, export, icon helper.
- `assets/css/styles.css` — Apple-like theme, accordion, segmented controls, icons, chips.
- `index.html` — bump `?v=8 → ?v=9` on all three asset links.
- (No change to `parse_excel.py` / `data.js`.)
- Update `README.md` + `CLAUDE.md` to describe per-sub-area gate/tools and the new key scheme.

## Out of scope (YAGNI)

- Per-sub-area tool *lists* (keep one list per section).
- AI tool brand logos.
- Backend response collection (still client-side JSON/CSV download).
