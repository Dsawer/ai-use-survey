# Per-section AI-usage gate + de-UTAUT redesign (2026-06-01)

## User-approved decisions
- **AI tools list (wide):** ChatGPT, Google Gemini, Claude, Microsoft Copilot, Perplexity,
  DeepSeek, Grok, Meta AI, GitHub Copilot, Cursor, Canva, Gamma + **Other…** (free text).
- **"No, I don't use AI here" → skip** that section's questions (matrix hidden; section counts
  as complete).
- **Flat questions:** no construct grouping, **no codes (EOU3)**, no construct descriptions.

## Each section page (top → bottom)
1. **Header:** number + section name + short task description (kept; not UTAUT jargon).
2. **Usage gate:** "Do you use AI for these tasks?" → **Yes / No**.
   - **No →** hide the tools + questions; section is complete; Next is allowed.
   - **Yes →** show the tools picker:
       *"Select the AI tools you use most for these tasks, in order — tap up to 3."*
       Tool chips; tapping assigns rank **1 / 2 / 3** (badge shown); tap again to remove;
       **+ Other…** adds a custom tool. (At least 1 required if Yes.)
     Then the line: *"Answer the questions below for the AI tool(s) you selected above."*
3. **Questions (flat list)** × sub-areas (matrix columns), **1–5 number cells** (word scale
   strip + tooltips kept). No codes, no construct headers. Wording is clearer, with
   **examples in parentheses** where a question is abstract.

## Other changes
- **Title:** drop "(UTAUT)" → **"AI Use Survey"**.
- **Progress** becomes **section-based** ("X / 5 sections") because sections can be skipped.
  A section is complete when: No, OR (Yes + ≥1 tool + all its cells answered).
- **Validation (Next):** gate must be answered; if Yes → need ≥1 tool and all cells.
- **Export (JSON/CSV):** per section records the **usage (yes/no)** and the **ranked tools**,
  plus the answers. Construct/code stay in the export only (for the researcher's analysis),
  never shown in the UI — can be removed too if you prefer.
- Background, stepper, multi-page flow, autosave, Done page: unchanged.

## Files
- `tools/parse_excel.py` — add `AI_TOOLS`, improved `QUESTION_TEXT`; emit `meta.aiTools`,
  cleaner question text; keep code/construct for export only.
- `assets/js/app.js` — usage gate + tools ranking state, flat matrix, section-based progress,
  validation, export.
- `assets/css/styles.css` — gate buttons, tool chips with rank badges.
- `index.html` — bump asset version to `?v=4`.
