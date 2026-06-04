# Collect responses in a private Google Sheet, with a per-device lock

Date: 2026-06-03 (final decision 2026-06-04)

## Decision

The survey stays a fully static GitHub Pages site. On **Submit**, answers are POSTed to a free,
Google-hosted **Apps Script Web App** that appends them to the researcher's **private Google
Sheet**. Responses are visible **only to the Sheet owner**. The **same device** cannot submit or
re-enter twice.

We deliberately dropped strict one-response-per-person: every server-side guarantee (email/token,
Google sign-in, IP) was rejected by the user — email/token is bypassable with a new account,
Google sign-in was unwanted, and IP both blocks legitimate students sharing a campus network and is
itself personal data. So uniqueness is a **device-level deterrent**, not a hard guarantee, and the
user accepted that.

## How it works

- `assets/js/config.js`: `webAppUrl` (empty until deployed) + `requireToken: false`. With a URL set
  and `requireToken:false` the app is in **open-submit** mode; empty URL = local download mode.
- A persistent random **device id** is stored in the browser (`localStorage`). On Submit the site
  POSTs `{ d: deviceId, payload }` (`no-cors`) to the Web App, then confirms via a JSONP
  `?action=check&d=` call that the row landed.
- Apps Script `doPost` appends `timestamp, device, payload(JSON)`; it is **idempotent** (a repeat of
  the same device id is ignored). `doGet` returns only a boolean (`recorded`) — **never** response
  data — so the Sheet stays private.
- After a successful submit the site sets a "done" flag; reopening on that device shows
  "You have already responded" (`showDeviceBlocked`, enforced in `render`). Bypassable by another
  device/browser/incognito/cleared storage — accepted.

## Privacy

No name, email, IP, or Google identity is collected — only a random per-browser device id. The
Sheet is owned by and private to the researcher; the Web App's "Anyone" access only allows
submitting, not reading.

## Client functions (app.js)

`OPEN_SUBMIT = webAppUrl && !requireToken`; `deviceId`/`deviceSubmitted`/`markDeviceSubmitted`;
`submitOpen`/`checkOpen`; `showDeviceBlocked`; `render` and `init` guard on `DEVICE_BLOCKED`;
`renderDone` adds the open "Ready to submit" step and hides downloads once recorded.

## Verified (browser, dummy URL)

Open mode shows "Ready to submit"; a failed confirm reverts the button (no false success); setting
the done flag blocks re-entry with "You have already responded"; no code errors (only the expected
404 from the dummy URL). End-to-end success needs the user's deployed Web App (docs/google-setup.md).
