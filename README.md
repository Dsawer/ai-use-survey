# AI Use Survey

A fully static (HTML/CSS/JS) **multi-page** survey about how people use AI tools across academic
tasks — conducted for a study at **Middle East Technical University (METU)**. Generated from
`source/UTAUT_Group_Matrices_2.xlsx`. Runs directly on GitHub Pages.

## How it works
- **Welcome** page shows the METU / Civil Engineering study context (voluntary, anonymous) with a
  plain "what and why" explanation. No rating scale here. Copy avoids dashes.
- **About you** — a required first step asking **which semester you are in** (a dropdown:
  Preparatory, 1st to 8th semester, 9th or beyond, Master's, PhD). The general AI-use questions
  (experience, frequency, paid subscription) appear at the **top of the GENERAL section** instead.
- **One page per task area.** Flow: **Welcome → About you → 5 section pages → Done**, with a top
  **stepper** (About + the 5 areas) and **‹ Back / Next ›**. Each page has its own address
  (`#about`, `#general`, `#problem_solving`, …). Progress is step-based (e.g. "3 / 6").
- The **rating scale (1–5) sits at the top of every section** (not on the welcome page).
- **Per-sub-area setup, then one matrix.** Each section is split in two:
  - **Setup cards** (top) — one compact card per sub-area / task (e.g. coding → "Code Development
    & Debugging", "Data Representation"), each with a status badge (**Pending / In progress / Done /
    Skipped**), a **"Do you use AI for this task?" → Yes / No** gate, and (on Yes) a **per-sub-area
    tool picker** with the AI tools relevant to that section (rank **1 / 2 / 3**; tap again to
    remove; **+ Other** for a custom tool). **No** marks the task Skipped.
  - **Rating matrix** (below) — rows = the statements, **columns = all of the section's
    sub-areas**, each cell a **vertical joined scale** (the five options "Strongly disagree …
    Strongly agree" as full-width stacked bars, no gaps; stored value 1–5). A column is
    fillable only when its sub-area is marked **"Yes"**; sub-areas left at **No / unanswered** show
    as **greyed, locked columns** (a "Skipped" / "Mark Yes above" note, not counted). The question
    column and header row stay pinned; a **"Scroll →"** cue appears when columns overflow. No item
    codes or construct headers in the UI.
- **Clean, Apple-like UI** — system font, white cards, hairline borders, a single Apple-blue accent,
  and **inline-SVG icons** (a per-section icon, segmented Yes/No, status checks). No external icon
  dependency, so it works on Pages and `file://`.
- **Step-based progress** ("X / 6": About + the 5 areas). A section is complete when **every
  sub-area is resolved** — each either "No", or "Yes" with at least one tool and every cell in its
  matrix column rated. **Next** flags and scrolls to the first unresolved sub-area / empty cell.
  Autosave to localStorage; a **Done page** that either lets the respondent **submit** (when a
  Google backend is configured) or **download JSON / CSV** (open mode).
- Responsive: the stepper collapses to dots, tool chips wrap, and the matrix scrolls horizontally
  with the question column pinned.

## Project structure
```
index.html                 # app shell (topbar, stepper, view container)
assets/css/styles.css      # Apple-like theme, stepper, setup cards, rating matrix, segmented chips
assets/js/config.js        # delivery config: Google Web App URL + token requirement (you edit this)
assets/js/data.js          # generated survey data (window.SURVEY)
assets/js/app.js           # router, per-sub-area gate + tools, rating matrix, validation, submit/export
source/                    # the two .xlsx + survey_data.json (audit)
tools/parse_excel.py       # Excel -> assets/js/data.js
docs/                      # SPEC.md, google-setup.md, plans/, excel_report.md, parse_report.md
```

## Edit the content
Run `python tools/parse_excel.py` after editing, or edit `assets/js/data.js` by hand.
In `tools/parse_excel.py`:
- `SECTION_TOOLS` — the AI tools shown per section (each section can have its own relevant list).
- `INTAKE` — the required "About you" questions (currently the semester dropdown; supports
  `"type": "select"`).
- `GENERAL_EXTRA` — the general AI-use questions shown at the top of the GENERAL section.
- `ORG` / `ORG_NOTE` — the institution name (METU) and the consent/voluntary note on the welcome page.
- `QUESTION_TEXT` — the (reworded, example-rich) statement texts, keyed by the original item code.
- `SECTION_DESC` — the short "about this section" text per task area.
- The survey **title** and **intro** are in `main()` (`meta`).

> **Export note:** the downloaded JSON/CSV records the **background answers**, then for **each
> sub-area** its **usage (Yes/No)** and **ranked tools** alongside the ratings (in the CSV the
> background answers are repeated as leading columns on every row, and Sub-area / Uses AI / Ranked
> Tools sit next to every rating). The original construct names and item codes are in the export
> **only** — they never appear in the survey UI.

> **Cache note:** the asset links in `index.html` use `?v=9`. After you change a CSS/JS file,
> bump that number (e.g. `?v=10`) so browsers fetch the new version instead of a cached copy.

## Publish on GitHub Pages
1. Push this folder to a GitHub repository.
2. Repo **Settings → Pages** → **Source:** `Deploy from a branch`, **Branch:** `main`, folder `/ (root)`.
3. Save — it goes live at `https://<username>.github.io/<repo>/` within a few minutes.

> Data is inlined in `data.js` (no `fetch`/CORS) — you can also just open `index.html` locally.

## Collecting responses
The site has two modes, switched purely by `assets/js/config.js`:

- **Open / preview mode** (default, `webAppUrl` empty). The survey opens for anyone and the Done
  page offers **JSON / CSV download**. Good for testing and for letting respondents send you a file.
- **Gated mode** (set `webAppUrl`, keep `requireToken: true`). Responses go straight into a
  **Google Sheet** with **one response per person, anonymously**:
  1. A **Google Form** is the entry gate. It signs the person in with Google, collects their email,
     and is set to **limit 1 response** (Google enforces one per account).
  2. An **Apps Script** trigger emails them a **personal one time link** (`index.html?t=TOKEN`).
  3. They open that link, take the survey, and press **Submit** — the answers (token only, **no
     email**) are written to the Sheet and the token is marked used. A second attempt is refused
     server side, so a cleared browser or another device cannot add a second response.

The email lives only in the gate Form's own responses; the survey data in the Sheet is anonymous.
**Full step-by-step setup and the ready-to-paste Apps Script are in [`docs/google-setup.md`](docs/google-setup.md).**

Without a personal link in gated mode the site shows a friendly gate ("Please use your personal
link"); an already used link shows "You have already responded".
