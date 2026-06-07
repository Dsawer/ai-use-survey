/* ============================================================
   Survey delivery config — fill this in after you deploy the
   Google Apps Script Web App (see docs/google-setup.md).

   - Leave webAppUrl EMPTY for local preview / open mode:
     the survey works and offers JSON/CSV download, no token needed.
   - Once webAppUrl is set and requireToken is true, the survey can
     only be opened with a valid personal link (?t=TOKEN) emailed to
     the participant after the Google Form, and each token records
     exactly one response.
   ============================================================ */
window.SURVEY_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbyV-l8yNOs7qV9fWBtDKM9gTBXUwjukvEmrdyKGsjVkcOp9qgDu0jWStGwbRCc2HRVI/exec",        // paste your Apps Script Web App URL here, e.g. "https://script.google.com/macros/s/AKfycb..../exec"
  requireToken: false   // false = open collection to your private Google Sheet + per-device lock (no token/Form/email)
};
