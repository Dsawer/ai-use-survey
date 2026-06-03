# Multi-page Redesign — Design (2026-06-01)

## User-approved decisions
- **Pages:** 5 pages (one per task group) + **sub-area tabs** inside each page.
- **Background/visual:** soft indigo→teal gradient glow + subtle grid, light theme, white shadowed cards.
- **Answer control:** vertical, full-width **word bars** (Strongly disagree … Strongly agree), **words only** (no numbers); selecting fills the whole bar.
- Each section starts with its name + a short "what this measures" description.

## App shell (single-page app, hash routing — each view has its own address)
- `#welcome` — title, short overview, the 5 word-scale legend, **Begin** button.
- `#<group>/<subareaIndex>` — the 16 (group × sub-area) steps, e.g. `#general/0`.
  Rendered as **5 group pages** with a top **stepper** (the 5 groups) + **sub-area tabs** inside.
- `#done` — completion: summary + Download JSON/CSV.

## Group page layout
1. **Header:** step number + GROUP NAME + *"What this section measures:"* domain description.
2. **Sub-area tabs** (pills): the group's sub-areas; selected tab shows that sub-area's items.
   Small line: *"Rate your AI use for: <sub-area>"*.
3. **Items** (25), grouped into the 8 **construct blocks**. Each block shows the construct
   name + a one-line *"what this construct measures"* note.
   Each item = statement + a **vertical word-bar scale** (5 full-width bars, words only).
4. **Nav:** ‹ Back / Next › — advances tab-by-tab; past the last tab → next group; final → `#done`.
   Direct clicks on stepper/tabs also allowed.

## Behaviour
- Progress (answered / 400) in the top bar; per-step completion ticks.
- Validation: Next/Submit highlights unanswered items on the current sub-area and scrolls to the first.
- Autosave to localStorage (same keys as before, so answers survive).
- Responsive: tabs scroll horizontally on mobile; word bars are full-width, large tap targets.
- Export JSON/CSV on the done page.

## Content additions (in data via parser)
- `section.description` — task-domain explanation per group.
- `group.description` — short explanation per UTAUT construct.

## Files
- `index.html` — app shell (topbar, stepper, view container, footer, overlay, toast).
- `assets/css/styles.css` — new background, stepper, tabs, word bars, pages, responsive.
- `assets/js/app.js` — hash router, 16-step model, rendering, validation, export.
- `assets/js/data.js` — regenerated (adds section/construct descriptions).
- `tools/parse_excel.py` — adds description dictionaries.
