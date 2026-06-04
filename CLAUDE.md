# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A fully static (HTML/CSS/JS, no build step, no framework) multi-page survey about how civil
engineering students use AI tools, run as an academic study at **METU**. It is designed to be
served from GitHub Pages or opened directly via `file://` — survey data is inlined into
`assets/js/data.js` as `window.SURVEY`, so there is no `fetch`/CORS dependency.

Despite the folder name ("IPCMC Anket") and the Turkish `docs/SPEC.md`, the **shipping app is
English** and the survey is reworded, not a literal translation of the source Excel.

## Commands

There is no test runner, linter, or package manager. The only build step regenerates the survey
content from Excel:

```bash
python tools/parse_excel.py
```

This reads `source/UTAUT_Group_Matrices_2.xlsx` and writes three outputs: `assets/js/data.js`
(the `window.SURVEY` object the app consumes), `source/survey_data.json` (audit copy), and
`docs/parse_report.md`. Requires `openpyxl`. A one-line status (`OK sections=… items=… cells=…`)
is printed and written to `docs/_build_status.txt`.

To preview: open `index.html` directly, or `python -m http.server` and visit `localhost:8000`.

## Editing content — do it in `parse_excel.py`, not `data.js`

`assets/js/data.js` is **generated** — hand edits are lost on the next parse. The single source of
truth for survey copy is the constants near the top of `tools/parse_excel.py`:

- `SECTION_TOOLS` — the AI-tool picker list per section (each section has its own).
- **Statement wording** is faithful to the original UTAUT items (Venkatesh et al. 2003), resolved
  per (code, section) by `item_text()`. Only Performance Expectancy + Effort Expectancy name the
  section domain: `PE_EE_TEMPLATES` (a `{d}` placeholder filled from `DOMAIN_PHRASES`) for the four
  non-general sections, and `GENERAL_PE_EE` (no domain) for the GENERAL section. All other
  constructs are general and identical across sections via `CROSS_ITEMS`. Short parenthetical
  examples live inside those strings; item codes never render; any code with no entry falls back to
  the raw Excel text. (Edit these dicts, not the old `QUESTION_TEXT`, which was removed.)
- `INTAKE` — the mandatory "About you" questions (currently a semester dropdown; supports
  `"type": "select"`).
- `GENERAL_EXTRA` — general AI-usage questions injected at the top of the GENERAL section only.
- `SECTION_DESC`, `TITLE`, `ORG`, `INTRO`, `HOWLONG`, `ORG_NOTE` — section blurbs and welcome copy.
- `MATRIX_SHEETS` — which Excel sheets become sections, in order.

**User-facing text must avoid dashes** (`-`, `–`, `—`). The parser strips them via `nodash()`, and
the hand-written copy follows the same rule; keep it that way when editing.

## Architecture

The app is one IIFE in `assets/js/app.js` driving a hash-router over a single `<main id="view">`.
Three layers:

1. **`tools/parse_excel.py`** flattens the UTAUT matrix Excel into the `SURVEY` model: sections →
   `groups` (construct, kept for export only) → `questions`, plus `columns` (the sub-areas — one
   row each in the section's combined usage question). Each column also carries an `examples`
   string (clarifying "For example: …" text) from the `COLUMN_EXAMPLES` constant, keyed by the
   final sub-area label. Construct names and item codes **never render in the UI** — they exist
   only so the export can reconstruct the original instrument.

2. **`assets/js/data.js`** = `window.SURVEY` (meta, scale, intake, sections). Generated; don't edit.

3. **`assets/js/app.js`** = router + state + UI. Routes: `#welcome → #about → one #<slug> page per
   section → #done`. The `.setup` host holds, in order: ONE combined usage question
   (`renderSetup` → `.usagepicker`) — "Which of these tasks do you use AI for?" with a multi-select
   checklist (`renderUsageItem`, one clean row per sub-area: a check toggle + name + its
   `examples`, plus a green "Done" pill once that task's matrix column is fully rated; NO inline
   tools, NO "In progress"), ending in a "I don't use AI for any of these" row (`renderNoneItem`);
   then the **AI-tools block** (`renderToolsBlock` → `.toolsblock`, rendered only when ≥1 task is
   ticked) — "Which AI tools do you use?" with, when ≥2 tasks are ticked, a **Same for all /
   Different per task** segmented toggle (`setToolsMode`): "shared" shows ONE ranked picker applied
   to every ticked task; "per" shows one labelled picker (`.toolgroup`) per ticked task. Pickers are
   built by the generic `buildToolPicker` (rank 1/2/3, up to `MAX_TOOLS`=3, plus "+ Other";
   read/write via `changeTools`/`addOtherTool`). Then a **`.matrix-host` block** (`renderMatrix`) —
   rows are statements, **columns are all of the section's sub-areas**; a column is interactive only
   when its sub-area is ticked ("yes"), otherwise greyed/`disabled` (a "Skipped" / "Select above"
   note), each cell a vertical joined 1–5 Likert scale of full-width bars (`buildNumberScale` —
   radios value 1–5; the visible label is the number, with the scale word in the top legend
   (`scaleStrip`) and on hover/`aria-label`). Ticking a task (`toggleTaskUsed`) sets usage "yes"
   and baselines every still-untouched sibling to "no" (unticked = not used); unticking sets "no"
   and clears that task's per-task tools. The "none" row (`setNoneUsed`) sets every task to "no". A
   usage/mode change re-renders setup + matrix (`rerenderSection`); a tool toggle re-renders setup
   only (`rerenderSetup`); a cell change only refreshes usage-row Done state (`updateSetupBadges`)
   so matrix radio focus is kept. Icons are inline SVG from an `ICONS`/`icon()` registry; section
   icons map by slug in `SECTION_ICONS` (keys must match `sec.slug`).

**State** lives entirely in `answers` (a flat object) persisted to `localStorage` under
`LS_KEY` (`utaut_survey_answers_v7`). Keys are built by helpers — `keyOf(secId,qId,colId)` for a
rating cell, **`useKey(sec,col)`** for the per-sub-area usage, **`toolsKey(sec,col)`** for a task's
own tools ("per" mode), **`toolsModeKey(sec)`** ("shared"/"per", default shared) and
**`sharedToolsKey(sec)`** for the section's one shared tool list ("shared" mode), and `bgKey(id)`
for background answers. **`toolsOf(sec,col)` is the *effective* accessor** (used by completion +
export): `[]` unless the task is ticked, the shared list in shared mode, the task's own list in per
mode. If you change the key scheme or model shape, bump `LS_KEY` so stale saved state is discarded
(it was `v6` before the shared/per-tools move, `v5` before the per-sub-area move).

**Completion** is step-based (`completedSteps()` / `totalSteps()`): About + 5 sections (6 steps).
A **sub-area** is resolved (`colResolved`) when usage = "no", OR usage = "yes" with ≥1 tool and
every cell in its matrix column rated (`colCellsComplete`). A **section** is complete when its
extras are answered AND every sub-area is resolved. Completion drives the stepper checkmarks
(`refreshStepper`) and the Done-page gate (`renderDone`). Validation on "Next" (`onNext`): if the
section's usage is unanswered (any column still ""), it shakes + scrolls to the `.usagepicker`;
otherwise it flags the first ticked task missing a tool or the first empty matrix cell.

**The progress bar is position-based, not completion-based** (`updateProgress` / `routeReached`):
it reflects how far you have *advanced* (Welcome/About = 0, section i = i+1, Done = total), so each
successful "Next/Continue" moves it one step while answering does not. It never regresses within a
session (`maxReached` holds the furthest page), and a #done route only reads 100% when the survey
is actually complete.

**Export** (Done page) writes JSON and CSV via Blob download. Usage and tools are **per sub-area**:
each response row carries its own `uses_ai`/`tools`, and the JSON adds a `subAreas` summary per
section. Only here do construct names/codes reappear; the CSV repeats every background answer as
leading columns on each row.

**Delivery.** `assets/js/config.js` (`window.SURVEY_CONFIG`) selects the mode by `webAppUrl` +
`requireToken`. Three modes:
- **Empty `webAppUrl`** = local mode: Done page offers JSON/CSV download (used for preview).
- **`webAppUrl` set + `requireToken: false`** (the chosen production mode) = **open submit to a
  private Google Sheet with a per-device lock**. `OPEN_SUBMIT` is true; the Done page shows a
  **Submit** step (`submitOpen` POSTs `{d: deviceId, payload}` `no-cors`, then `checkOpen` confirms
  via JSONP). A persistent `localStorage` device id + "done" flag block re-entry from the same
  device (`deviceSubmitted`/`markDeviceSubmitted`/`showDeviceBlocked`, guarded in `render`/`init`).
  The Apps Script appends to the owner's private Sheet and never returns response data.
- **`webAppUrl` set + `requireToken: true`** = legacy token gate (`gateCheck`/`validateToken`/
  `submitResponses`, `GATED`/`ACCESS_OK`) for a `?t=TOKEN` personal-link flow; still present but not
  the chosen mode.
See `docs/google-setup.md` for the open-mode Apps Script + setup. Deployed at
https://dsawer.github.io/ai-use-survey/ (repo Dsawer/ai-use-survey, Pages from main).

## Cache busting

`index.html` references the CSS/JS with a `?v=N` query (currently `?v=21`). After editing any file
in `assets/`, **bump `N` on all four links in `index.html`** (config.js, data.js, app.js, styles.css)
so GitHub Pages / browsers fetch the new version instead of a cached copy.

## Notes

- `docs/plans/` holds dated design docs; `docs/SPEC.md` is the original (Turkish) spec and is
  partly stale (it predates the multi-page redesign and references a `verify_data.py` that no
  longer exists). Trust the code and README over SPEC.md.
- Not a git repository.
