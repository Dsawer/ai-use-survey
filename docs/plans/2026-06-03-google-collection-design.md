# Collect responses in Google — anonymous, one per person, no server

Date: 2026-06-03

## Decision

Keep the survey a fully static site published from GitHub Pages (transparent: all source, including
the Apps Script, lives in the repo). Responses are collected in a **Google Sheet** via a free,
Google-hosted **Apps Script Web App** (no server the researcher runs/maintains). One response per
person and anonymity are both achieved via a small **gate Google Form + one-time token**.

Rejected: pure static with no Google service (cannot collect centrally or enforce uniqueness);
native Google Form for everything (loses the custom UI); Google Sign-In/OAuth on the site (stores a
hashed identity, more setup, less anonymous than the token design).

## Flow

1. **Gate Google Form** (tiny, separate): Collect email (Verified) + **Limit to 1 response** →
   Google enforces one entry per Google account. One consent item.
2. **Apps Script `onFormSubmit`**: makes a random one-time token, **emails** the participant their
   personal link `https://<site>/index.html?t=TOKEN`, and stores in the `Tokens` sheet **only**
   `token, status` (no email, and now **no creation timestamp** — see Anonymity).
3. Participant opens the link → fills the static survey → **Submit**. The site POSTs the answers to
   the Web App (`no-cors`) and then confirms via a JSONP token-status check.
4. **Apps Script `doPost`**: rejects an unknown/used token; otherwise appends `timestamp, token,
   payload(JSON)` to `Responses` and marks the token `recorded`. Reuse is refused.

## Anonymity

The answer rows carry only a random token, never email/name. The email exists only in the gate
Form's own responses (a separate sheet the researcher controls / can delete after tokens are sent).
The `Tokens` sheet no longer stores the token **creation time**, so a token cannot be correlated
with the gate Form's submission timestamp. The `Responses` timestamp is the survey-submission time
(later than the gate, low correlation).

## What is already built (client)

`assets/js/app.js`: `gateCheck`/`validateToken`/`showGate` (hold rendering until `?t=` confirmed),
`submitResponses` (POST `{t, payload}` where payload = `background()` + `buildExportSections()`),
`renderDone` gated "Submit" step + one-time `localStorage` guard. `assets/js/config.js`:
`webAppUrl` (empty until deployed) + `requireToken: true`. `GATED = webAppUrl && requireToken`.

When `webAppUrl` is empty the site stays in **open/local mode** (JSON/CSV download) for previewing.

## This change

`docs/google-setup.md`: `apps_script.gs` updated for anonymity (Tokens = `token, status,
recordedAt`; no `createdAt`; `recordedAt` moved to column 3). Added an optional `flatten` helper
that expands the JSON payloads into a `Flat` analysis sheet (one row per rated statement, mirroring
the site's CSV). No app code changed; no cache bump needed until the user pastes `webAppUrl`.

## Verified

Gated mode (dummy `webAppUrl`, no `?t=`) blocks the survey with "Please use your personal link."
Open mode (empty `webAppUrl`) shows the survey + JSON/CSV download. The end-to-end token success
path requires the user's own deployed Web App (covered by the doc's "Test it" steps).
