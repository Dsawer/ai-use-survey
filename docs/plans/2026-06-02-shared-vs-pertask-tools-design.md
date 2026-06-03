# Shared vs per-task AI tools + drop the "In progress" badge

Date: 2026-06-02

## Problems

1. A ticked task showed an "In progress" status pill — the user does not want that label.
2. Tools were asked once per ticked task. For students who use the same tools across every task
   this is repetitive. They wanted a "common" option ("same tools for all"), while still allowing
   "this for this, that for that" when the tools differ per task.

## Decision

Move the tool picker out of the per-task rows into one dedicated **AI-tools block** below the task
checklist, with a **Same for all / Different per task** toggle. Drop the "In progress" badge; show
only a green "Done" pill when a ticked task's ratings are complete.

## UI

Per section: checklist (clean check + name + examples; no inline tools, no "In progress") → the
**tools block** (only when >=1 task is ticked) → rating matrix.

Tools block: heading "Which AI tools do you use?" plus, when **2+** tasks are ticked, a segmented
toggle **( Same for all | Different per task )** (default "Same for all"):
- **Same for all:** one ranked picker; those tools apply to every ticked task.
- **Different per task:** one ranked picker per ticked task, each labelled with the task name.
- With exactly 1 ticked task: no toggle, one picker.

A ticked task shows a green "Done" pill only once every statement in its matrix column is rated.

## Data model

New keys (model-shape change -> `LS_KEY` bumped `v6` -> `v7`):
- `toolsModeKey(sec)` = "shared" | "per" (default "shared").
- `sharedToolsKey(sec)` = the section's shared ranked tool list.
- Per-task lists keep using the existing `toolsKey(sec,col)`.

`toolsOf(sec,col)` becomes the single **effective** accessor used by completion + export:
returns `[]` unless the task is ticked ("yes"); in "shared" mode returns the section's shared list
(so every ticked task carries the same tools); in "per" mode returns that task's own list. Export
(`buildExportSections`, CSV) is unchanged in shape — each selected task row still carries its own
`tools`, which equals the shared list in shared mode.

## Validation (Next)

- Usage unanswered -> shake the `.usagepicker` (unchanged).
- A ticked task without tools -> "shared": one message + scroll to the `.toolsblock`; "per":
  per-task message + scroll to that `.toolgroup`.
- A ticked task with tools but unrated cells -> rate-everything prompt (unchanged).

## Scope

`assets/js/app.js` (effective `toolsOf` + `toolsMode`/`sharedToolsOf`/`rawColTools`; `renderSetup`
appends `renderToolsBlock`; `renderUsageItem` drops inline tools + In-progress; generic
`buildToolPicker` + `changeTools`/`addOtherTool`; `setToolsMode`; `onNext` + `updateSetupBadges`
updated; removed `colStatus`/`badgeHtml`/`renderToolPicker`/`toggleColTool`/`addColOther`) and
`assets/css/styles.css` (`.toolsblock`/`.toolgroup`, Done check, drop inline-tools rule). Bump
`index.html` cache `v16 -> v17`. `data.js`/`parse_excel.py` untouched.
