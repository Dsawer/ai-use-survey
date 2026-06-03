# Unique, anonymous responses with Google Form + Apps Script

Goal: each person answers **once** (no second submission), responses are **anonymous**
(no email stored with answers), and everything lands in a **Google Sheet**. No server.

## How it works
1. A **Google Form** is the entry gate. It **collects email** and is set to **limit 1 response**
   (so Google enforces one entry per Google account).
2. When someone submits that Form, an **Apps Script** trigger creates a **one time token** and
   **emails them a personal link**: `https://<your-site>/index.html?t=TOKEN`.
3. They open that link, fill in the survey on our site, and press **Submit**. The site sends the
   answers to the Apps Script, which:
   - rejects the token if it was already used (no second submission),
   - otherwise writes the answers to the **Responses** sheet (token only, **no email**) and marks
     the token as used.
4. The email lives only in the gate Form's own responses (kept separately by you). The answer data
   in the Responses sheet is anonymous (token only). Keep the two unlinked.

---

## Step 1 — Google Form (the gate)
1. Create a Google Form, e.g. "AI Use Survey — Access".
2. Settings → **Responses** → turn on **Collect email addresses** (Verified).
3. Settings → **Responses** → **Limit to 1 response** (this requires Google sign in).
4. Add one short item, e.g. a consent checkbox ("I agree to take part"). Keep it minimal.
5. **Presentation → Confirmation message:**
   *"Thank you. We have emailed you a personal link to the survey. Please open it to continue."*
6. Link the form to a spreadsheet: **Responses → Link to Sheets** → create a new spreadsheet.

## Step 2 — Apps Script (token + email + storage)
1. Open the linked **Google Sheet** → **Extensions → Apps Script**.
2. Delete the default code and paste **`apps_script.gs`** below.
3. Set `SITE_URL` to your published page, e.g.
   `https://<username>.github.io/<repo>/index.html`.
4. **Triggers** (clock icon) → **Add Trigger** → choose `onFormSubmit`, event source **From
   spreadsheet**, event type **On form submit** → save (authorize when asked; allow Mail + Sheets).
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, copy the **Web app URL** (ends with `/exec`).

## Step 3 — Connect the site
1. Open `assets/js/config.js` and paste the Web app URL:
   ```js
   window.SURVEY_CONFIG = { webAppUrl: "https://script.google.com/macros/s/XXXX/exec", requireToken: true };
   ```
2. Bump the cache version in `index.html` (the `?v=` on the script/style links) so visitors get the
   new file, then push to GitHub Pages.

## Test it
- Submit the Google Form with your own email → you should receive the link email.
- Open the link → fill the survey → **Submit** → "Your response has been recorded".
- Open the same link again → "You have already responded" (blocked).
- Open the site without `?t=` → "Please use your personal link".

> Note: the site sends answers with `no-cors` (it cannot read Google's reply directly), so after
> sending it re-checks the token status to confirm. Uniqueness is enforced **server side** by the
> script (it refuses an already used token), so a cleared browser or another device cannot get a
> second response in.

---

## apps_script.gs
```js
// Personal survey link page (set to your published page)
var SITE_URL = 'https://USERNAME.github.io/REPO/index.html';
var TOKENS_SHEET = 'Tokens';
var RESPONSES_SHEET = 'Responses';

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { var s = ss_().getSheetByName(name); if (!s) s = ss_().insertSheet(name); return s; }

// Runs when the gate Form is submitted: make a token and email the personal link.
function onFormSubmit(e) {
  var email = '';
  try { email = e.response.getRespondentEmail(); } catch (err) {}
  if (!email && e.namedValues) {
    var k = Object.keys(e.namedValues).filter(function (x) { return /e.?mail/i.test(x); })[0];
    if (k) email = e.namedValues[k][0];
  }
  if (!email) return;
  var token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  var tk = sheet_(TOKENS_SHEET);
  // Anonymity: we deliberately DO NOT store the token creation time, so a token can never be
  // correlated with the gate Form's submission timestamp (the email lives only in the Form's own
  // responses). The Tokens sheet holds token + status (+ recordedAt) only, never the email.
  if (tk.getLastRow() === 0) tk.appendRow(['token', 'status', 'recordedAt']);
  tk.appendRow([token, 'pending', '']);
  var link = SITE_URL + '?t=' + token;
  MailApp.sendEmail(email, 'Your survey link',
    'Thank you for taking part.\n\nOpen your personal survey link to continue:\n' + link +
    '\n\nThis link works once.');
}

function findToken_(token) {
  var tk = sheet_(TOKENS_SHEET); var data = tk.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === String(token)) return { row: i + 1, status: data[i][1] };
  return null;
}
function out_(obj, callback) {
  var s = JSON.stringify(obj);
  if (callback) return ContentService.createTextOutput(callback + '(' + s + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

// Validate a token (called by the site via JSONP).
function doGet(e) {
  var cb = e.parameter.callback;
  if (e.parameter.action === 'validate') {
    var f = findToken_(e.parameter.t);
    var status = f ? (f.status === 'recorded' ? 'recorded' : 'pending') : 'invalid';
    return out_({ status: status }, cb);
  }
  return out_({ ok: true }, cb);
}

// Receive the answers (called by the site via POST). Rejects an already used token.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out_({ ok: false, reason: 'busy' }); }
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    var f = findToken_(body.t);
    if (!f) return out_({ ok: false, reason: 'invalid' });
    if (f.status === 'recorded') return out_({ ok: false, reason: 'used' });
    var rs = sheet_(RESPONSES_SHEET);
    if (rs.getLastRow() === 0) rs.appendRow(['timestamp', 'token', 'payload']);
    rs.appendRow([new Date(), body.t, JSON.stringify(body.payload)]);
    var tk = sheet_(TOKENS_SHEET);
    tk.getRange(f.row, 2).setValue('recorded');
    tk.getRange(f.row, 3).setValue(new Date());
    return out_({ ok: true });
  } finally { lock.releaseLock(); }
}
```

> The **Responses** sheet stores `timestamp, token, payload` (payload = the full answers as JSON,
> no email). The `timestamp` here is the survey **submission** time, which is not linkable to a
> person (the gate Form's email + time live in a separate sheet, and the Tokens sheet no longer
> stores the token creation time). To analyse, add the `flatten` helper below and run it.

## Optional: expand the JSON into one row per rating (`flatten`)

Paste this into the same Apps Script project, then **Run → flatten** whenever you want an analysis
table. It reads the `Responses` sheet and writes a `Flat` sheet: one row per rated statement, with
the background answers repeated as leading columns (same shape as the site's CSV export).

```js
function flatten() {
  var rs = sheet_(RESPONSES_SHEET);
  var data = rs.getDataRange().getValues();
  var out = sheet_('Flat'); out.clear();
  var bgIds = [], rows = [];
  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0], token = data[i][1], payload;
    try { payload = JSON.parse(data[i][2]); } catch (e) { continue; }
    var bg = payload.background || {};
    Object.keys(bg).forEach(function (k) { if (bgIds.indexOf(k) < 0) bgIds.push(k); });
    (payload.sections || []).forEach(function (sec) {
      (sec.responses || []).forEach(function (r) { rows.push({ ts: ts, token: token, bg: bg, sec: sec.section, r: r }); });
    });
  }
  var header = ['timestamp', 'token'].concat(bgIds.map(function (k) { return 'bg:' + k; }))
    .concat(['section', 'sub_area', 'construct', 'code', 'question', 'uses_ai', 'tools', 'value', 'label']);
  var table = [header];
  rows.forEach(function (x) {
    var lead = [x.ts, x.token].concat(bgIds.map(function (k) { return x.bg[k] ? x.bg[k].answer : ''; }));
    var tools = (x.r.tools || []).map(function (t, i) { return (i + 1) + ') ' + t; }).join('; ');
    table.push(lead.concat([x.sec, x.r.sub_area, x.r.construct, x.r.code, x.r.question, x.r.uses_ai, tools, x.r.value, x.r.label]));
  });
  if (table.length > 1) out.getRange(1, 1, table.length, header.length).setValues(table);
}
```
