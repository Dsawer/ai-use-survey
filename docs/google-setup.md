# Collect responses in a private Google Sheet (no server, per-device lock)

Goal: every response is saved to **your** Google Sheet, **only you can read them**, and the **same
device cannot submit/enter twice**. No server to run, no Google Form, no email, no login.

## How it works
1. The static site (GitHub Pages) collects the answers and, on **Submit**, POSTs them to a free,
   Google-hosted **Apps Script Web App**, tagged with a random **device id** (stored in the
   participant's browser).
2. The Web App appends one row to your **Responses** sheet (`timestamp, device, payload`). It is
   **idempotent**: a repeat of the same device id is ignored, so retries never double-record.
3. **Privacy:** the Sheet is owned by you and is **private** — only you can open it. The Web App is
   deployed "Who has access: Anyone", which only lets people **submit**; it never returns response
   data (its only GET reply is a yes/no used to confirm a submission and lock the device).
4. **Per-device lock:** after a successful submit the site marks the browser as done; reopening the
   survey on that device shows "You have already responded." (This is a device/browser-level
   deterrent: a different device, a different browser, a private window, or clearing site data can
   still submit again — there is no way to harden this further without identifying people.)

---

## Step 1 — Make the Sheet
1. Create a new **Google Sheet** (this is where responses land; keep it private to you).

## Step 2 — Apps Script
1. In the Sheet: **Extensions → Apps Script**.
2. Delete the default code, paste **`apps_script.gs`** (below), **Save**.
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy (authorize when asked — only Sheets access is needed), copy the **Web app URL**
     (ends with `/exec`).

## Step 3 — Connect the site
1. Open `assets/js/config.js` and paste the URL (leave `requireToken` as `false`):
   ```js
   window.SURVEY_CONFIG = { webAppUrl: "https://script.google.com/macros/s/XXXX/exec", requireToken: false };
   ```
2. Bump the cache version in `index.html` (the `?v=` on the four links) and push to GitHub Pages.

## Test it
- Open the live site, complete it, press **Submit** → "Your response has been recorded", and a new
  row appears in your **Responses** sheet.
- Reopen the survey on the same browser → "You have already responded" (device locked).
- `webAppUrl` empty = local preview mode (the site offers JSON/CSV download instead of submitting).

> The site sends answers with `no-cors` (it cannot read Google's reply directly), then re-checks via
> a JSONP call that the row landed before showing success.

---

## apps_script.gs
```js
var RESPONSES_SHEET = 'Responses';

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { var s = ss_().getSheetByName(name); if (!s) s = ss_().insertSheet(name); return s; }
function out_(obj, cb) {
  var s = JSON.stringify(obj);
  return cb ? ContentService.createTextOutput(cb + '(' + s + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
            : ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
function deviceSeen_(d) {
  if (!d) return false;
  var data = sheet_(RESPONSES_SHEET).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][1]) === String(d)) return true;
  return false;
}

// Confirm a submission / device-lock check (site calls via JSONP). Returns ONLY a boolean, never data.
// NOTE: doGet/doPost are called by the web app, not by the editor's Run button. The `e = e || {}`
// guards just stop a harmless TypeError if you accidentally press Run here.
function doGet(e) {
  e = e || {}; var p = e.parameter || {};
  if (p.action === 'check') return out_({ recorded: deviceSeen_(p.d) }, p.callback);
  return out_({ ok: true }, p.callback);
}

// Receive answers (site POSTs). One row per device id; a repeat device id is ignored (idempotent).
function doPost(e) {
  e = e || {};
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out_({ ok: false, reason: 'busy' }); }
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    var rs = sheet_(RESPONSES_SHEET);
    if (rs.getLastRow() === 0) rs.appendRow(['timestamp', 'device', 'payload']);
    if (deviceSeen_(body.d)) return out_({ ok: true, dup: true });
    rs.appendRow([new Date(), body.d || '', JSON.stringify(body.payload)]);
    return out_({ ok: true });
  } finally { lock.releaseLock(); }
}
```

> The **Responses** sheet stores `timestamp, device, payload` (payload = the full answers as JSON).
> The `device` value is a random per-browser id (not a name, email, or IP). To analyse, add the
> `flatten` helper below and run it.

## Optional: expand the JSON into one row per rating (`flatten`)

Paste this into the same project, then **Run → flatten** to build a `Flat` sheet: one row per rated
statement, with the background answers repeated as leading columns (same shape as the site's CSV).

```js
function flatten() {
  var rs = sheet_(RESPONSES_SHEET);
  var data = rs.getDataRange().getValues();
  var out = sheet_('Flat'); out.clear();
  var bgIds = [], rows = [];
  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0], dev = data[i][1], payload;
    try { payload = JSON.parse(data[i][2]); } catch (e) { continue; }
    var bg = payload.background || {};
    Object.keys(bg).forEach(function (k) { if (bgIds.indexOf(k) < 0) bgIds.push(k); });
    (payload.sections || []).forEach(function (sec) {
      (sec.responses || []).forEach(function (r) { rows.push({ ts: ts, dev: dev, bg: bg, sec: sec.section, r: r }); });
    });
  }
  var header = ['timestamp', 'device'].concat(bgIds.map(function (k) { return 'bg:' + k; }))
    .concat(['section', 'sub_area', 'construct', 'code', 'question', 'uses_ai', 'tools', 'value', 'label']);
  var table = [header];
  rows.forEach(function (x) {
    var lead = [x.ts, x.dev].concat(bgIds.map(function (k) { return x.bg[k] ? x.bg[k].answer : ''; }));
    var tools = (x.r.tools || []).map(function (t, i) { return (i + 1) + ') ' + t; }).join('; ');
    table.push(lead.concat([x.sec, x.r.sub_area, x.r.construct, x.r.code, x.r.question, x.r.uses_ai, tools, x.r.value, x.r.label]));
  });
  if (table.length > 1) out.getRange(1, 1, table.length, header.length).setValues(table);
}
```
