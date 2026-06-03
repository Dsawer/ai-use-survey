# Per-sub-task Tools + Apple Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the usage gate and ranked tool picker from section level to sub-area (matrix column) level, rendered as Apple-like accordion cards with inline-SVG icons.

**Architecture:** Each section page renders one collapsible card per sub-area. A card holds its own Yes/No gate, ranked tool picker (Yes-only), and that sub-area's ~25 statements as a single-column 1–5 list. State, completion, validation, and JSON/CSV export all move to per-sub-area scope. Only `assets/js/app.js`, `assets/css/styles.css`, `index.html`, and docs change — `parse_excel.py`/`data.js` are untouched.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build). `window.SURVEY` data is inlined. Verification via `python -m http.server` + Playwright MCP (no unit-test framework exists; not adding one).

**Design doc:** `docs/plans/2026-06-01-per-subtask-tools-apple-redesign-design.md`

---

## Conventions for every task

- After each code change, verify in a browser: start `python -m http.server 8000` (from repo root) and load `http://localhost:8000/index.html?v=dev` via Playwright MCP, or reload.
- `localStorage` key is bumped to `v6`; if stale state interferes, clear it via `localStorage.clear()` in the Playwright console.
- No git in this repo — "Commit" steps are replaced by "Checkpoint: verify in browser, then continue."

---

### Task 1: Cache-bust + baseline

**Files:**
- Modify: `index.html:13,39,40`

**Step 1:** Bump all three `?v=8` to `?v=9` in `index.html` (css, data.js, app.js).

**Step 2:** Start server: `python -m http.server 8000` (run in background from repo root).

**Step 3:** Playwright: navigate to `http://localhost:8000/`, snapshot the welcome page. Confirm it still loads (baseline before refactor).

**Checkpoint:** Welcome renders, no console errors.

---

### Task 2: Per-sub-area state helpers + LS bump

**Files:**
- Modify: `assets/js/app.js` (helpers block ~lines 21, 32-46)

**Step 1:** Change the storage key:
```js
var LS_KEY = "utaut_survey_answers_v6";
```

**Step 2:** Replace the section-scoped `useKey`/`toolsKey`/`usageOf`/`toolsOf` with sub-area-scoped versions and add per-column completion helpers:
```js
function useKey(sec, col)   { return sec.id + "::" + col.id + "::__use"; }
function toolsKey(sec, col) { return sec.id + "::" + col.id + "::__tools"; }
function usageOf(sec, col)  { return answers[useKey(sec, col)] || ""; }
function toolsOf(sec, col)  { var t = answers[toolsKey(sec, col)]; return Array.isArray(t) ? t : []; }
function colCellsComplete(sec, col) {
  return questionsOf(sec).every(function (q) { return answers[keyOf(sec.id, q.id, col.id)] != null; });
}
function colResolved(sec, col) {
  var u = usageOf(sec, col);
  if (u === "no")  return true;
  if (u === "yes") return toolsOf(sec, col).length >= 1 && colCellsComplete(sec, col);
  return false;
}
```

**Step 3:** Rewrite `sectionComplete` to require all sub-areas resolved (keep extras check):
```js
function sectionComplete(sec) {
  if (!extrasComplete(sec)) return false;
  return (sec.columns || []).every(function (col) { return colResolved(sec, col); });
}
```
Delete the old `cellsComplete(sec)` (replaced by `colCellsComplete`).

**Checkpoint:** App still loads (rendering not updated yet — section pages may look broken; that's expected until Task 5). No reference errors on welcome/about.

---

### Task 3: Inline-SVG icon helper + section-icon map

**Files:**
- Modify: `assets/js/app.js` (add near the helpers block)

**Step 1:** Add an icon registry returning SVG strings (stroke uses `currentColor` so CSS controls color). Keep paths simple (24×24, stroke-width 1.7):
```js
var ICONS = {
  globe:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  bulb:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  puzzle:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 4a2 2 0 1 1 4 0v2h3a1 1 0 0 1 1 1v3h-2a2 2 0 1 0 0 4h2v3a1 1 0 0 1-1 1h-3v-2a2 2 0 1 0-4 0v2H7a1 1 0 0 1-1-1v-3H4a2 2 0 1 1 0-4h2V7a1 1 0 0 1 1-1h3V4z"/></svg>',
  doc:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  code:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg>',
  slash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>',
  chevron:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  info:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};
function icon(name) { return ICONS[name] || ""; }
var SECTION_ICONS = { general: "globe", learning_brainstorming: "bulb", problem_solving: "puzzle",
  reporting_presentation_organization: "doc", data_processing_coding: "code" };
function sectionIcon(sec) { return icon(SECTION_ICONS[sec.slug] || "globe"); }
```
> Note: confirm the actual `sec.slug` values from `data.js` and adjust `SECTION_ICONS` keys to match. The parser slugs the sheet title; verify by logging `SECTIONS.map(s=>s.slug)` once.

**Step 2:** Playwright console: run `window.SURVEY.sections.map(s=>s.slug)` and confirm the 5 slugs match the `SECTION_ICONS` keys; fix any mismatch.

**Checkpoint:** `icon('globe')` returns SVG; no errors.

---

### Task 4: Rewrite `renderStep` to host an accordion (remove old gate/matrix)

**Files:**
- Modify: `assets/js/app.js` `renderStep` (~220-259), delete `fillPreamble`/`fillBody`/`setupScrollCue`/`preHost`/`bodyHost`.

**Step 1:** Add a transient (not persisted) expanded-state map near the top-level vars:
```js
var expanded = {};                       // key: sec.id+"::"+col.id -> bool
function exKey(sec, col) { return sec.id + "::" + col.id; }
```

**Step 2:** Replace `renderStep` body so the head shows the section icon, keeps the scale strip and GENERAL extras, and renders a cards host instead of preamble/matrix:
```js
function renderStep(step) {
  currentStep = step; cueUpdate = null;
  renderStepper(step.si);
  var v = clearView();
  var sec = step.sec;
  var page = el("div", "page group-page");

  var head = el("div", "gp-head");
  var ic = el("div", "gp-icon"); ic.innerHTML = sectionIcon(sec); head.appendChild(ic);
  var hbox = el("div", null);
  hbox.appendChild(el("p", "eyebrow", "About this section"));
  hbox.appendChild(el("h2", null, esc(sec.name)));
  if (sec.description) hbox.appendChild(el("p", "gp-desc", esc(sec.description)));
  head.appendChild(hbox); page.appendChild(head);

  page.appendChild(scaleStrip());

  if (extrasOf(sec).length) {
    var ec = el("div", "card intake extra");
    ec.appendChild(el("p", "extra-title", "Your AI use overall"));
    extrasOf(sec).forEach(function (q) { ec.appendChild(bgBlock(q)); });
    page.appendChild(ec);
  }

  var host = el("div", "subareas"); page.appendChild(host);

  var nav = el("div", "pagenav");
  var back = el("button", "btn btn-ghost", "‹ Back"); back.type = "button";
  back.addEventListener("click", function () { go(step.index === 0 ? (HAS_INTAKE ? "#about" : "#welcome") : stepHash(STEPS[step.index - 1])); });
  var isLast = step.index === STEPS.length - 1;
  var next = el("button", "btn btn-primary", isLast ? "Finish ›" : "Next ›"); next.type = "button";
  next.addEventListener("click", onNext);
  nav.appendChild(back); nav.appendChild(el("div", "spacer")); nav.appendChild(next);
  page.appendChild(nav);

  v.appendChild(page);
  // auto-expand first unresolved sub-area
  var firstOpen = (sec.columns || []).filter(function (c) { return !colResolved(sec, c); })[0];
  (sec.columns || []).forEach(function (col) { if (expanded[exKey(sec, col)] == null) expanded[exKey(sec, col)] = (col === firstOpen); });
  renderCards(sec, host);
  topFocus();
}
```

**Checkpoint:** Section page shows header (with icon placeholder), scale strip, GENERAL extras, an empty `.subareas` host, and nav. No console errors.

---

### Task 5: Sub-area card render (gate + tools + statements + accordion)

**Files:**
- Modify: `assets/js/app.js` (add `renderCards`, `renderCard`, status helpers; reuse `buildNumberScale`, tool logic)

**Step 1:** Add card rendering. Cards re-render in place on every change so badges/locks stay correct:
```js
function colStatus(sec, col) {
  var u = usageOf(sec, col);
  if (u === "no") return { key: "skip", label: "Skipped" };
  if (colResolved(sec, col)) return { key: "done", label: "Done" };
  if (u === "yes") return { key: "active", label: "In progress" };
  return { key: "pending", label: "Pending" };
}
function renderCards(sec, host) {
  host.innerHTML = "";
  (sec.columns || []).forEach(function (col) { host.appendChild(renderCard(sec, col, host)); });
}
function renderCard(sec, col, host) {
  var open = !!expanded[exKey(sec, col)];
  var st = colStatus(sec, col);
  var card = el("div", "sacard " + st.key + (open ? " open" : ""));

  var header = el("button", "sacard-head"); header.type = "button";
  header.appendChild(el("span", "sacard-chev", icon("chevron")));
  header.appendChild(el("span", "sacard-name", esc(col.label)));
  var badge = el("span", "sacard-badge " + st.key);
  if (st.key === "done" || st.key === "skip") badge.innerHTML = icon("check") + "<span>" + st.label + "</span>";
  else badge.innerHTML = "<span>" + st.label + "</span>";
  header.appendChild(badge);
  header.addEventListener("click", function () { expanded[exKey(sec, col)] = !open; renderCards(sec, host); });
  card.appendChild(header);

  var body = el("div", "sacard-body");
  // gate
  var gate = el("div", "gate");
  gate.appendChild(el("p", "gate-q", "Do you use AI for this task?"));
  var seg = el("div", "segmented yesno");
  var u = usageOf(sec, col);
  var yesB = el("button", "seg-opt" + (u === "yes" ? " on" : "")); yesB.type = "button"; yesB.innerHTML = icon("check") + "<span>Yes</span>";
  var noB  = el("button", "seg-opt" + (u === "no"  ? " on" : "")); noB.type  = "button"; noB.innerHTML  = icon("slash") + "<span>No</span>";
  yesB.addEventListener("click", function () { setColUsage(sec, col, "yes", host); });
  noB.addEventListener("click",  function () { setColUsage(sec, col, "no",  host); });
  seg.appendChild(yesB); seg.appendChild(noB); gate.appendChild(seg);
  body.appendChild(gate);

  if (u === "no") {
    body.appendChild(el("p", "skip-note", "You selected “No”, so this task is skipped."));
  } else if (u === "yes") {
    body.appendChild(renderToolPicker(sec, col, host));
    body.appendChild(renderStatements(sec, col));
  }
  card.appendChild(body);
  return card;
}
```

**Step 2:** Tool picker for a column (reuses tool list + ranking, scoped to col):
```js
function renderToolPicker(sec, col) {
  var wrap = el("div", "tools");
  wrap.appendChild(el("p", "tools-instruction", "Select the AI tools you use most for this task, in order. Tap up to " + MAX_TOOLS + "."));
  var chips = el("div", "toolchips");
  var tools = toolsOf(sec, col);
  var list = toolListFor(sec).slice();
  tools.forEach(function (t) { if (list.indexOf(t) < 0) list.push(t); });
  list.forEach(function (name) {
    var rank = tools.indexOf(name);
    var chip = el("button", "chip" + (rank >= 0 ? " selected" : "")); chip.type = "button";
    if (rank >= 0) chip.appendChild(el("span", "rank", "" + (rank + 1)));
    chip.appendChild(el("span", "chip-label", esc(name)));
    chip.addEventListener("click", function () { toggleColTool(sec, col, name); });
    chips.appendChild(chip);
  });
  var other = el("button", "chip other"); other.type = "button"; other.textContent = "+ Other";
  other.addEventListener("click", function () { addColOther(sec, col); });
  chips.appendChild(other);
  wrap.appendChild(chips);
  wrap.appendChild(el("p", "tools-hint", "Tap to rank 1, 2, 3 · tap again to remove · selected " + tools.length + "/" + MAX_TOOLS));
  return wrap;
}
```

**Step 3:** Statements list (single column of 1–5 for this sub-area):
```js
function renderStatements(sec, col) {
  var wrap = el("div", "statements");
  questionsOf(sec).forEach(function (q) {
    var row = el("div", "stmt"); row.setAttribute("data-key", keyOf(sec.id, q.id, col.id));
    row.appendChild(el("p", "stmt-text", esc(q.text || "")));
    row.appendChild(buildNumberScale(sec.id, q.id, col.id));
    wrap.appendChild(row);
  });
  return wrap;
}
```
(`buildNumberScale` is unchanged; CSS in Task 8 restyles `.numscale` as a segmented control.)

**Step 4:** Interaction handlers (per-column). The host element is needed to re-render:
```js
function setColUsage(sec, col, val, host) { answers[useKey(sec, col)] = val; expanded[exKey(sec, col)] = true; saveAnswers(); renderCards(sec, host); updateProgress(); refreshStepper(); }
function toggleColTool(sec, col, name) {
  var t = toolsOf(sec, col).slice(), i = t.indexOf(name);
  if (i >= 0) t.splice(i, 1);
  else if (t.length < MAX_TOOLS) t.push(name);
  else { showToast("You can rank up to " + MAX_TOOLS + " tools.", true); return; }
  answers[toolsKey(sec, col)] = t; saveAnswers(); renderCardsCurrent(); updateProgress(); refreshStepper();
}
function addColOther(sec, col) {
  var t = toolsOf(sec, col).slice();
  if (t.length >= MAX_TOOLS) { showToast("You can rank up to " + MAX_TOOLS + " tools.", true); return; }
  var name = (window.prompt("Add another AI tool:") || "").trim();
  if (!name || t.indexOf(name) >= 0) return;
  t.push(name); answers[toolsKey(sec, col)] = t; saveAnswers(); renderCardsCurrent(); updateProgress(); refreshStepper();
}
function renderCardsCurrent() { var host = document.querySelector(".subareas"); if (host && currentStep) renderCards(currentStep.sec, host); }
```
Update `onCellChange` to refresh the current section's cards (so the card badge flips to Done when the last cell is filled) — but DON'T re-render mid-interaction in a way that loses focus. Minimal approach: keep `onCellChange` as-is (updates progress + stepper) and additionally update just that card's badge. Simplest correct version: after setting the answer, update progress/stepper and toggle the owning card's status class:
```js
function onCellChange(e) {
  answers[e.target.name] = +e.target.value; saveAnswers();
  var row = e.target.closest(".stmt"); if (row) row.classList.remove("missing");
  updateProgress(); refreshStepper(); updateCardBadges();
}
function updateCardBadges() {
  if (!currentStep) return; var sec = currentStep.sec;
  document.querySelectorAll(".subareas .sacard").forEach(function (cardEl, i) {
    var col = sec.columns[i]; if (!col) return;
    var st = colStatus(sec, col);
    cardEl.className = "sacard " + st.key + (expanded[exKey(sec, col)] ? " open" : "");
    var b = cardEl.querySelector(".sacard-badge");
    if (b) { b.className = "sacard-badge " + st.key; b.innerHTML = (st.key === "done" || st.key === "skip") ? (icon("check") + "<span>" + st.label + "</span>") : ("<span>" + st.label + "</span>"); }
  });
}
```

**Checkpoint (Playwright):** On a section page: cards listed; expanding one shows the gate; clicking "No" collapses content + badge → Skipped; clicking "Yes" reveals tool chips + statements; ranking a chip shows badge 1; answering all cells flips badge → Done.

---

### Task 6: Rewrite `onNext` validation for sub-areas

**Files:**
- Modify: `assets/js/app.js` `onNext` (~366-376), delete old `flagMissing`.

**Step 1:** Validate extras first, then each sub-area in order; expand + scroll to the first problem:
```js
function onNext() {
  var sec = currentStep.sec, step = currentStep;
  if (extrasOf(sec).length && !extrasComplete(sec)) { flagBg(extrasOf(sec).map(function (q) { return q.id; }), "Please answer the questions at the top of this section."); return; }
  var cols = sec.columns || [];
  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    if (colResolved(sec, col)) continue;
    expanded[exKey(sec, col)] = true; renderCardsCurrent();
    var u = usageOf(sec, col);
    var cardEl = document.querySelectorAll(".subareas .sacard")[i];
    if (cardEl) cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!u) { showToast("Please tell us whether you use AI for “" + col.label + "”.", true); }
    else if (toolsOf(sec, col).length === 0) { showToast("Select at least one AI tool for “" + col.label + "”.", true); }
    else { flagFirstMissingCell(cardEl); showToast("Please answer every statement for “" + col.label + "”.", true); }
    return;
  }
  var isLast = step.index === STEPS.length - 1;
  go(isLast ? "#done" : stepHash(STEPS[step.index + 1]));
}
function flagFirstMissingCell(cardEl) {
  if (!cardEl) return; var first = null;
  cardEl.querySelectorAll(".stmt[data-key]").forEach(function (row) {
    if (answers[row.getAttribute("data-key")] == null) { row.classList.add("missing"); if (!first) first = row; }
  });
  if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
}
```

**Checkpoint:** With one sub-area half-filled, "Next" expands it and scrolls to the first empty statement; completing every sub-area lets "Next" advance.

---

### Task 7: Per-sub-area export (JSON + CSV)

**Files:**
- Modify: `assets/js/app.js` `buildExportSections` (~418-431), `exportCsv` (~439-457), `toolsString`.

**Step 1:** `toolsString` takes a column:
```js
function toolsString(sec, col) { return toolsOf(sec, col).map(function (t, i) { return (i + 1) + ") " + t; }).join("; "); }
```

**Step 2:** JSON — carry `uses_ai` + `tools` per row, and add a `subAreas` summary:
```js
function buildExportSections() {
  return SECTIONS.map(function (sec) {
    var responses = [];
    (sec.columns || []).forEach(function (col) {
      var u = usageOf(sec, col), used = u === "yes";
      (sec.groups || []).forEach(function (g) {
        (g.questions || []).forEach(function (q) {
          var key = keyOf(sec.id, q.id, col.id), has = used && answers[key] != null;
          responses.push({ construct: g.name, code: q.code || "", question: q.text || "", sub_area: col.label || "",
            uses_ai: u === "yes" ? "Yes" : (u === "no" ? "No" : ""), tools: toolsOf(sec, col),
            value: has ? answers[key] : "", label: has ? scaleLabel(answers[key]) : "" });
        });
      });
    });
    var subAreas = (sec.columns || []).map(function (col) {
      var u = usageOf(sec, col);
      return { sub_area: col.label, uses_ai: u === "yes" ? "Yes" : (u === "no" ? "No" : ""), tools: toolsOf(sec, col) };
    });
    return { section: sec.name, subAreas: subAreas, responses: responses };
  });
}
```

**Step 3:** CSV — replace section-level Uses/Tools with per-row (per sub-area) values; reorder columns:
```js
function exportCsv() {
  var bgQ = bgQuestions();
  var lines = [bgQ.map(function (q) { return q.label; }).concat(["Section", "Sub-area", "Uses AI", "Ranked Tools", "Construct", "Code", "Statement", "Value", "Label"]).map(csvCell).join(",")];
  var bgVals = bgQ.map(function (q) { return answers[bgKey(q.id)] || ""; });
  SECTIONS.forEach(function (sec) {
    (sec.columns || []).forEach(function (col) {
      var u = usageOf(sec, col), uses = u === "yes" ? "Yes" : (u === "no" ? "No" : ""), ts = toolsString(sec, col);
      (sec.groups || []).forEach(function (g) {
        (g.questions || []).forEach(function (q) {
          var key = keyOf(sec.id, q.id, col.id);
          var val = (u === "yes" && answers[key] != null) ? answers[key] : "";
          var lab = (u === "yes" && answers[key] != null) ? scaleLabel(answers[key]) : "";
          lines.push(bgVals.concat([sec.name, col.label || "", uses, ts, g.name, q.code || "", q.text || "", val, lab]).map(csvCell).join(","));
        });
      });
    });
  });
  download("ai_survey_responses.csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
}
```

**Checkpoint:** Fill one section (one sub-area Yes with tools, one No), Download JSON + CSV, inspect: tools/uses_ai appear per sub-area; skipped sub-area shows `No` with empty values.

---

### Task 8: Apple-like CSS theme

**Files:**
- Modify: `assets/css/styles.css` (theme tokens + new components; remove `.matrix*`/`.preamble`/`.yesno`/`.tools-wrap` rules that are no longer used or repurpose them)

**Step 1:** Update design tokens at `:root` — Apple blue accent, neutral grays, larger radii, hairline borders, soft shadows, system font stack:
```css
:root{
  --accent:#0071e3; --accent-press:#0a84ff; --ink:#1d1d1f; --ink-2:#6e6e73;
  --bg:#fafafa; --card:#ffffff; --line:rgba(0,0,0,.08);
  --radius:18px; --radius-sm:12px; --shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05);
}
body{ font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,"Segoe UI",sans-serif; color:var(--ink); background:var(--bg); }
```

**Step 2:** Section header icon + accordion card styles:
```css
.gp-icon{ width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(0,113,227,.1);color:var(--accent); }
.gp-icon svg{ width:24px;height:24px; }
.subareas{ display:flex;flex-direction:column;gap:12px;margin-top:16px; }
.sacard{ background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden; }
.sacard-head{ width:100%;display:flex;align-items:center;gap:12px;padding:16px 18px;background:none;border:0;cursor:pointer;text-align:left;font:inherit; }
.sacard-chev{ color:var(--ink-2);display:grid;place-items:center;transition:transform .2s ease; }
.sacard-chev svg{ width:18px;height:18px; }
.sacard.open .sacard-chev{ transform:rotate(90deg); }
.sacard-name{ flex:1;font-weight:600; }
.sacard-badge{ display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--ink-2);padding:4px 10px;border-radius:999px;background:#f2f2f7; }
.sacard-badge svg{ width:14px;height:14px; }
.sacard-badge.done{ color:#1d8a3a;background:rgba(40,167,69,.12); }
.sacard-badge.skip{ color:var(--ink-2); }
.sacard-badge.active{ color:var(--accent);background:rgba(0,113,227,.12); }
.sacard-body{ max-height:0;opacity:0;overflow:hidden;transition:max-height .28s ease,opacity .2s ease;padding:0 18px; }
.sacard.open .sacard-body{ max-height:6000px;opacity:1;padding:0 18px 18px; }
```
> The `max-height` transition is a pragmatic accordion (large cap). Acceptable for this app; no JS height measurement needed.

**Step 3:** Segmented controls (Yes/No and the 1–5 cells):
```css
.segmented{ display:inline-flex;background:#f2f2f7;border-radius:12px;padding:3px;gap:3px; }
.seg-opt{ display:inline-flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-weight:500;color:var(--ink);padding:8px 16px;border-radius:9px;cursor:pointer;transition:.15s; }
.seg-opt svg{ width:16px;height:16px; }
.seg-opt.on{ background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12);color:var(--accent); }
.numscale{ display:inline-flex;background:#f2f2f7;border-radius:10px;padding:3px;gap:2px; }
.numscale .ns input{ position:absolute;opacity:0;pointer-events:none; }
.numscale .ns label{ display:grid;place-items:center;min-width:36px;height:34px;border-radius:8px;cursor:pointer;color:var(--ink-2);font-weight:600;transition:.15s; }
.numscale .ns input:checked + label{ background:var(--accent);color:#fff; }
```

**Step 4:** Tool chips + statement rows (clean, hairline, rounded):
```css
.toolchips{ display:flex;flex-wrap:wrap;gap:8px;margin:10px 0; }
.chip{ display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 14px;font:inherit;cursor:pointer;transition:.15s; }
.chip.selected{ border-color:var(--accent);background:rgba(0,113,227,.06);color:var(--accent); }
.chip .rank{ display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:var(--accent);color:#fff;font-size:12px;font-weight:700; }
.chip.other{ border-style:dashed;color:var(--ink-2); }
.stmt{ display:flex;flex-direction:column;gap:8px;padding:14px 0;border-top:1px solid var(--line); }
.stmt-text{ margin:0;line-height:1.45; }
.stmt.missing{ background:rgba(255,59,48,.05);border-radius:10px;padding:14px;margin:0 -14px; }
@media(min-width:720px){ .stmt{ flex-direction:row;align-items:center;justify-content:space-between; } .stmt-text{ flex:1;padding-right:16px; } }
```

**Step 5:** Stepper — show section icons + ✓ when done (lightweight tweak to existing `.step-dot`). Keep existing layout; ensure dots can hold an SVG. Verify nothing references removed `.matrix`/`.preamble` classes that break layout.

**Checkpoint (Playwright, desktop + mobile viewport):** Cards look clean and Apple-like; Yes/No and 1–5 render as segmented controls; chevron rotates on open; accent is Apple blue; statement rows go single-line on wide screens, stacked on narrow.

---

### Task 9: Docs

**Files:**
- Modify: `README.md` ("How it works" usage-gate + tool-picker bullets), `CLAUDE.md` (Architecture: per-sub-area gate/tools, key scheme `useKey(sec,col)`/`toolsKey(sec,col)`, `LS_KEY` v6, export columns).

**Step 1:** Update the README bullets describing the gate and tool picker to say they are per sub-area (accordion cards), and update the export note (per-sub-area Uses AI + Tools columns).

**Step 2:** Update CLAUDE.md "Architecture" + "State" paragraphs: gate/tools are per sub-area; new key helpers; `LS_KEY` bumped to v6; cards replace the matrix; export columns reordered.

**Checkpoint:** Docs match the shipped behavior.

---

### Task 10: Full end-to-end verification

**Step 1 (Playwright):** Fresh `localStorage.clear()`. Walk Welcome → About (pick semester) → GENERAL: answer the 3 extras; sub-area A = Yes + 2 tools + all statements; sub-area B = No. Confirm section badge in stepper turns ✓.

**Step 2:** Continue through all 5 sections (mix Yes/No per sub-area), reach Done, confirm "Thank you".

**Step 3:** Download JSON + CSV; open and verify: per-sub-area `uses_ai`/`tools` correct; "No" sub-areas have empty values; background columns present; construct/code present in export only.

**Step 4:** Reload page mid-survey; confirm autosave restored answers (v6 key) and resumed at first incomplete step.

**Step 5:** Mobile viewport (390px): cards, chips, segmented 1–5 all usable; no horizontal overflow.

**Checkpoint:** All pass → feature complete. Then run an adversarial code review (ultracode workflow) over the diff.
