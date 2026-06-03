# Progress bar advances on Continue (position-based)

Date: 2026-06-02

## Problem

The top progress bar was completion-based (`completedSteps()/totalSteps()`), so it only moved when
a whole section's answers were finished, and stayed put when pressing Continue. The user wanted the
bar to advance when they press Continue/Next.

## Decision (chosen by user from previews)

Make the bar position-based: it reflects how far you have advanced through the pages, so each
successful Continue moves it one step, while filling in answers leaves it unchanged. It never
regresses within a session (holds the furthest page reached). Total = About + 5 sections = 6.

Mapping (matches the approved preview): Welcome 0, About 0, section i -> i+1 (GENERAL 1/6 = 17% …
Data & Coding 5/6 = 83%), Done -> 6/6 = 100%.

## Change (`assets/js/app.js`)

- New module var `maxReached` (furthest page this session; never regresses).
- `routeReached(route)`: step -> `route.step.index + 1`; done -> `total` only if
  `completedSteps() === total`, else `maxReached` (so an incomplete #done does not read 100%);
  welcome/about -> 0.
- `updateProgress()` computes `routeReached(parseHash())`, bumps `maxReached`, and renders
  `min(maxReached, total)` as both the bar width and the "X / N" text.

Completion logic (`completedSteps`, `sectionComplete`) is unchanged and still drives the stepper
checkmarks, Next validation, and the Done-page gate. `index.html` cache `v18 -> v19`. No data/model
change; `LS_KEY` stays `v7`.

## Verified (browser)

Welcome 0% → GENERAL 1/6 (17%) → Problem Solving 3/6 (50%); back-nav holds 50% (monotonic);
#done while incomplete stays 50% (not 100%); answering (extras, tick, rate cell) does not move the
bar; fresh reload on GENERAL shows 1/6. Zero console errors.
