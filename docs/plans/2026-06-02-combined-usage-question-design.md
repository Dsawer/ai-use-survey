# Combined per-section usage question (replace per-sub-area Yes/No gates)

Date: 2026-06-02

## Problem

On each section page the same prompt "Do you use AI for this task?" is repeated once per
sub-area (2 to 5 times), each in its own card with its own Yes/No segmented control. Respondents
found this repetitive and the per-task intent unclear. The user asked to collapse it into ONE
question per section: "which of these tasks do you use AI for", answerable in a single pass
("I use AI for all of them" / "I use it for these, not those").

## Decision

One combined multi-select question per section. AI-tool data stays **per selected task**
(export/CSV unchanged). The rating matrix is unchanged.

## UI (per section page)

Order: header + scale strip + (GENERAL only) "Your AI use overall" extras + **usage picker** +
rating matrix + page nav.

Usage picker (replaces the stack of `.setupcard`s):

- Question: "Which of these tasks do you use AI for?" with hint "Select all that apply. Pick your
  tools for each one you use."
- A list of rows, one per sub-area. Each row: a check toggle + the sub-area name + the
  "For example: ..." clarifying examples. Ticked rows expand to reveal that task's existing ranked
  tool picker (`renderToolPicker`, 1/2/3 + Other). Ticked rows show a small status pill
  (In progress / Done).
- A final row: "I don't use AI for any of these."

## Behavior

- First tick in a section "activates" it: the ticked task becomes `yes`, every still-untouched
  task becomes `no` (single-question semantics: unticked = not used). Further taps toggle a task
  yes/no. Unticking a task clears its tools.
- "I don't use AI for any of these" sets every task to `no` and clears all tools. It shows as
  selected when every task is `no`. Ticking any task clears it.
- Matrix columns are interactive only for `yes` tasks; others are greyed ("Skipped").

## Data model / completion

- No key-scheme change: still `useKey(sec,col)` = "yes"/"no"/"" and `toolsKey(sec,col)`.
  `LS_KEY` stays `v6`. `data.js` / `parse_excel.py` untouched.
- `colResolved` unchanged: `no` resolves; `yes` needs >=1 tool + all cells rated.
- A section's usage is "answered" when every column is non-empty. Returning users with stale
  partial state are re-prompted to confirm the selection.

## Validation (Next)

- Extras incomplete -> prompt (unchanged).
- Section not answered (any column "") -> "Please choose which tasks you use AI for, or select
  'I don't use AI for any of these'." + scroll to the picker.
- A `yes` task without tools / without all ratings -> prompt + scroll (as today).

## Scope

`assets/js/app.js` (rewrite `renderSetup`, drop `renderSetupCard`/`setColUsage`, add usage-item
renderers + `toggleTaskUsed`/`setNoneUsed`, update `onNext` + badge refresh) and
`assets/css/styles.css` (add `.usagepicker*` / `.usage-item*` rules; reuse `.tools`/`.chip`).
Bump `index.html` cache `?v=15 -> v=16`. Examples from the prior change are reused as-is.
