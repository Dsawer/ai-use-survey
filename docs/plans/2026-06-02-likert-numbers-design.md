# Show 1–5 numbers in matrix cells (Likert look)

Date: 2026-06-02

## Problem

Each matrix cell showed the scale WORD ("Strongly disagree" … "Strongly agree") on five stacked
full-width bars. The user wanted a Likert look with the numbers 1–5 instead.

## Decision (chosen by user from previews)

Keep the existing vertical stacked-bar layout (preserves the matrix column width); just show the
number 1–5 on each bar instead of the word. The word meaning stays available via the top scale
legend (`scaleStrip`: 1=Strongly disagree … 5=Strongly agree) and on hover / screen reader
(`title` + `aria-label` = "4 · Agree"). Rejected: classic horizontal numbered circles (would widen
the multi-column matrix).

## Change

- `assets/js/app.js` `buildNumberScale`: label text `esc(scaleLabel(n))` -> `"" + n`; `title` /
  `aria-label` keep the number + word.
- `assets/css/styles.css` `.numscale .ns label`: font-size 11.5px -> 15px, weight 600 -> 700,
  min-height 30 -> 34px, `font-variant-numeric: tabular-nums`. Checked state (accent fill + white)
  and locked/greyed columns unchanged.
- `index.html` cache `v17 -> v18`. No data/model change; `LS_KEY` stays `v7`.

## Verified

Numbers 1–5 render in active cells; selected shows accent fill + white number; skipped columns
greyed; tooltip "4 · Agree"; top legend still maps numbers to words; zero console errors.
