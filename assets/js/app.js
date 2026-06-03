/* ============================================================
   AI Use Survey (METU, Civil Engineering) — multi-page app
   Flow: Welcome → About you (semester) → 5 section pages → Done
   - Each section page is a stack of sub-area ACCORDION cards.
   - Each sub-area card has its OWN usage gate (Yes/No), ranked
     tool picker (Yes only), and its own 1..5 statements.
   - Apple-like: segmented controls, hairline cards, inline-SVG icons.
   - Optional token-gated delivery to a Google Apps Script Web App
     (see assets/js/config.js); open mode falls back to JSON/CSV.
   - Text avoids dashes.
   Data: window.SURVEY (assets/js/data.js)
   ============================================================ */
(function () {
  "use strict";

  var S = window.SURVEY || { meta: {}, scale: { min: 1, max: 5, labels: {} }, intake: [], sections: [], rawSheets: [] };
  var SECTIONS = S.sections || [];
  var INTAKE = S.intake || [];
  var HAS_INTAKE = INTAKE.length > 0;
  var SCALE = S.scale || { min: 1, max: 5, labels: {} };
  var MIN = SCALE.min || 1, MAX = SCALE.max || 5;
  var FALLBACK_TOOLS = (S.meta && S.meta.aiTools) || [];
  var MAX_TOOLS = 3;
  var LS_KEY = "utaut_survey_answers_v7";

  var answers = loadAnswers();
  var STEPS = SECTIONS.map(function (sec, si) { return { index: si, si: si, sec: sec }; });
  var currentStep = null;
  var maxReached = 0;                                 // furthest page reached this session (progress bar never regresses)
  var cueUpdate = null;                               // matrix horizontal-scroll cue updater (or null)
  var CFG = window.SURVEY_CONFIG || {};
  var GATED = !!(CFG.webAppUrl && CFG.requireToken !== false);
  var TOKEN = null, ACCESS_OK = false, SUBMITTED = false;
  function submittedKey(t) { return "submitted::" + t; }

  // ---------- icons (inline SVG, no external dependency) ----------
  var ICONS = {
    globe:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>',
    bulb:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    puzzle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1 4 0v2h3a1 1 0 0 1 1 1v3h-2a2 2 0 1 0 0 4h2v3a1 1 0 0 1-1 1h-3v-2a2 2 0 1 0-4 0v2H7a1 1 0 0 1-1-1v-3H4a2 2 0 1 1 0-4h2V7a1 1 0 0 1 1-1h3V4z"/></svg>',
    doc:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    code:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4 10-10"/></svg>',
    slash:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><path d="M8.5 12h7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>'
  };
  function icon(name) { return ICONS[name] || ""; }
  var SECTION_ICONS = {
    general: "globe", learning_brainstorming: "bulb", problem_solving: "puzzle",
    reporting_presentation_organization: "doc", data_processing_coding: "code"
  };
  function sectionIcon(sec) { return icon(SECTION_ICONS[sec.slug] || "globe"); }

  // ---------- helpers ----------
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function keyOf(secId, qId, colId) { return secId + "::" + qId + "::" + colId; }
  function useKey(sec, col) { return sec.id + "::" + col.id + "::__use"; }
  function toolsKey(sec, col) { return sec.id + "::" + col.id + "::__tools"; }
  function toolsModeKey(sec) { return sec.id + "::__toolsmode"; }
  function sharedToolsKey(sec) { return sec.id + "::__sharedtools"; }
  function bgKey(id) { return "bg::" + id; }
  function idSafe(s) { return String(s).replace(/[^a-z0-9]/gi, "_"); }
  function scaleLabel(n) { return (SCALE.labels && SCALE.labels[n]) ? SCALE.labels[n] : ("" + n); }
  function loadAnswers() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function saveAnswers() { try { localStorage.setItem(LS_KEY, JSON.stringify(answers)); } catch (e) {} }
  function questionsOf(sec) { var o = []; (sec.groups || []).forEach(function (g) { (g.questions || []).forEach(function (q) { o.push(q); }); }); return o; }
  function extrasOf(sec) { return sec.extra || []; }
  function usageOf(sec, col) { return answers[useKey(sec, col)] || ""; }
  function toolsMode(sec) { return answers[toolsModeKey(sec)] === "per" ? "per" : "shared"; }
  function rawColTools(sec, col) { var t = answers[toolsKey(sec, col)]; return Array.isArray(t) ? t : []; }
  function sharedToolsOf(sec) { var t = answers[sharedToolsKey(sec)]; return Array.isArray(t) ? t : []; }
  // effective tools for a sub-area (used by completion + export): only a selected ("yes") task has
  // tools, and in "shared" mode every selected task carries the section's one shared list.
  function toolsOf(sec, col) { if (usageOf(sec, col) !== "yes") return []; return toolsMode(sec) === "per" ? rawColTools(sec, col) : sharedToolsOf(sec); }
  function toolListFor(sec) { return (sec.aiTools && sec.aiTools.length) ? sec.aiTools : FALLBACK_TOOLS; }
  function bgAnswered(q) { return answers[bgKey(q.id)] != null && answers[bgKey(q.id)] !== ""; }

  // ---------- completion (per sub-area) ----------
  function colCellsComplete(sec, col) { return questionsOf(sec).every(function (q) { return answers[keyOf(sec.id, q.id, col.id)] != null; }); }
  function colResolved(sec, col) {
    var u = usageOf(sec, col);
    if (u === "no") return true;
    if (u === "yes") return toolsOf(sec, col).length >= 1 && colCellsComplete(sec, col);
    return false;
  }
  function extrasComplete(sec) { return extrasOf(sec).every(bgAnswered); }
  function sectionComplete(sec) {
    if (!extrasComplete(sec)) return false;
    return (sec.columns || []).every(function (col) { return colResolved(sec, col); });
  }
  function aboutComplete() { return !HAS_INTAKE || INTAKE.every(bgAnswered); }
  function completedSections() { var n = 0; SECTIONS.forEach(function (s) { if (sectionComplete(s)) n++; }); return n; }
  function totalSteps() { return (HAS_INTAKE ? 1 : 0) + SECTIONS.length; }
  function completedSteps() { return (HAS_INTAKE ? (aboutComplete() ? 1 : 0) : 0) + completedSections(); }
  function firstIncompleteStep() { for (var i = 0; i < STEPS.length; i++) if (!sectionComplete(STEPS[i].sec)) return STEPS[i]; return null; }
  function startHash() { if (HAS_INTAKE && !aboutComplete()) return "#about"; var st = firstIncompleteStep(); return st ? stepHash(st) : (STEPS[0] ? stepHash(STEPS[0]) : "#about"); }

  // ---------- routing ----------
  function stepHash(step) { return "#" + step.sec.slug; }
  function findStep(slug) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].sec.slug === slug) return STEPS[i]; return null; }
  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h || h === "welcome") return { view: "welcome" };
    if (h === "about") return { view: "about" };
    if (h === "done") return { view: "done" };
    var step = findStep(h.split("/")[0]);
    return step ? { view: "step", step: step } : { view: "welcome" };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  // ---------- meta / progress ----------
  function applyMeta() { var t = (S.meta && S.meta.title) || "Survey"; document.getElementById("brandTitle").textContent = t; document.title = t; }
  // Position-based progress: the bar reflects how far you have advanced (each Continue moves it
  // one step), not how much you have filled in. It never regresses (holds the furthest page
  // reached this session). About + 5 sections = `total`; Welcome/About = 0, section i = i+1,
  // Done = total (100%).
  function routeReached(route) {
    var total = totalSteps();
    if (route.view === "step") return route.step.index + 1;
    if (route.view === "done") return completedSteps() === total ? total : maxReached;
    return 0; // welcome / about
  }
  function updateProgress() {
    var total = totalSteps();
    var reached = routeReached(parseHash());
    if (reached > maxReached) maxReached = reached;
    var shown = Math.min(maxReached, total);
    document.getElementById("progressFill").style.width = (total ? Math.round(shown / total * 100) : 0) + "%";
    document.getElementById("progressText").textContent = shown + " / " + total;
  }
  function refreshStepper() {
    document.querySelectorAll(".stepper .step").forEach(function (stepEl) {
      var kind = stepEl.getAttribute("data-kind");
      var complete = kind === "about" ? aboutComplete() : sectionComplete(SECTIONS[+stepEl.getAttribute("data-si")]);
      stepEl.classList.toggle("done", complete);
      var dot = stepEl.querySelector(".step-dot");
      if (dot && !stepEl.classList.contains("active")) dot.textContent = complete ? "✓" : (kind === "about" ? "i" : "" + (+stepEl.getAttribute("data-si") + 1));
    });
  }

  // ---------- stepper ----------
  function stepperPill(opts) {
    var step = el("div", "step" + (opts.active ? " active" : "") + (opts.done ? " done" : ""));
    step.setAttribute("data-kind", opts.kind);
    if (opts.kind === "section") step.setAttribute("data-si", opts.si);
    var btn = el("button", "step-btn"); btn.type = "button";
    btn.appendChild(el("span", "step-dot", opts.done && !opts.active ? "✓" : opts.dot));
    btn.appendChild(el("span", "step-label", esc(opts.label)));
    btn.addEventListener("click", opts.onClick);
    step.appendChild(btn); step.appendChild(el("span", "step-line"));
    return step;
  }
  function renderStepper(activeKey) {
    var nav = document.getElementById("stepper");
    if (activeKey == null) { nav.hidden = true; nav.innerHTML = ""; return; }
    nav.hidden = false; nav.innerHTML = "";
    var inner = el("div", "stepper-inner");
    if (HAS_INTAKE) inner.appendChild(stepperPill({ kind: "about", dot: "i", label: "About you", active: activeKey === "about", done: aboutComplete(), onClick: function () { go("#about"); } }));
    SECTIONS.forEach(function (sec, si) { inner.appendChild(stepperPill({ kind: "section", si: si, dot: "" + (si + 1), label: sec.name, active: activeKey === si, done: sectionComplete(sec), onClick: function () { go("#" + sec.slug); } })); });
    nav.appendChild(inner);
  }

  // ---------- shared bits ----------
  function scaleStrip() {
    var bar = el("div", "scalebar");
    bar.appendChild(el("span", "scalebar-title", "Scale"));
    for (var n = MIN; n <= MAX; n++) {
      var sb = el("span", "sb"); sb.setAttribute("data-n", n);
      sb.appendChild(el("span", "sb-num", "" + n)); sb.appendChild(el("span", null, esc(scaleLabel(n))));
      bar.appendChild(sb);
    }
    return bar;
  }
  // a single-select question (pills or dropdown), answer stored under bg::id
  function bgBlock(q) {
    var block = el("div", "intake-block"); block.setAttribute("data-bg", q.id);
    block.appendChild(el("p", "intake-q", esc(q.label)));
    if (q.type === "select") {
      var sel = document.createElement("select"); sel.className = "intake-select";
      var ph = document.createElement("option"); ph.value = ""; ph.textContent = "Select your answer"; sel.appendChild(ph);
      (q.options || []).forEach(function (opt) { var o = document.createElement("option"); o.value = opt; o.textContent = opt; if (answers[bgKey(q.id)] === opt) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", function () { answers[bgKey(q.id)] = sel.value; saveAnswers(); block.classList.remove("missing"); updateProgress(); refreshStepper(); });
      block.appendChild(sel);
    } else {
      var row = el("div", "opt-row");
      (q.options || []).forEach(function (opt) {
        var b = el("button", "opt" + (answers[bgKey(q.id)] === opt ? " active" : "")); b.type = "button"; b.textContent = opt;
        b.addEventListener("click", function () { answers[bgKey(q.id)] = opt; saveAnswers(); row.querySelectorAll(".opt").forEach(function (x) { x.classList.toggle("active", x.textContent === opt); }); block.classList.remove("missing"); updateProgress(); refreshStepper(); });
        row.appendChild(b);
      });
      block.appendChild(row);
    }
    return block;
  }
  function flagBg(ids, msg) {
    var first = null;
    ids.forEach(function (id) { var b = document.querySelector('.intake-block[data-bg="' + id + '"]'); if (b && (answers[bgKey(id)] == null || answers[bgKey(id)] === "")) { b.classList.add("missing"); if (!first) first = b; } });
    showToast(msg, true);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function buildNumberScale(secId, qId, colId) {
    var wrap = el("div", "numscale"); wrap.setAttribute("role", "radiogroup");
    var name = keyOf(secId, qId, colId), saved = answers[name];
    for (var n = MIN; n <= MAX; n++) {
      var ns = el("div", "ns");
      var rid = "r_" + idSafe(name) + "_" + n;
      var input = document.createElement("input");
      input.type = "radio"; input.name = name; input.id = rid; input.value = "" + n;
      if (saved != null && +saved === n) input.checked = true;
      input.addEventListener("change", onCellChange);
      // Likert: show the number 1..5; the scale word stays in the top legend + on hover/screen reader
      var label = el("label", null, "" + n);
      label.setAttribute("for", rid); label.title = n + " · " + scaleLabel(n); label.setAttribute("aria-label", n + " " + scaleLabel(n));
      ns.appendChild(input); ns.appendChild(label); wrap.appendChild(ns);
    }
    return wrap;
  }

  // ---------- views ----------
  function clearView() { var v = document.getElementById("view"); v.innerHTML = ""; return v; }
  function topFocus() { window.scrollTo(0, 0); var v = document.getElementById("view"); if (v && v.focus) v.focus({ preventScroll: true }); }

  function renderWelcome() {
    renderStepper(null);
    var v = clearView();
    var page = el("div", "page welcome");
    var hero = el("div", "hero-card");
    hero.appendChild(el("p", "eyebrow", esc((S.meta && S.meta.org) || "Academic Research Survey")));
    hero.appendChild(el("h1", null, esc((S.meta && S.meta.title) || "AI Use Survey")));
    if (S.meta && S.meta.intro) hero.appendChild(el("p", "welcome-sub", esc(S.meta.intro)));
    if (S.meta && S.meta.howlong) hero.appendChild(el("p", "welcome-sub small", esc(S.meta.howlong)));
    if (S.meta && S.meta.note) hero.appendChild(el("p", "consent", esc(S.meta.note)));
    page.appendChild(hero);

    var actions = el("div", "welcome-actions");
    var begin = el("button", "btn btn-primary btn-lg", (completedSteps() > 0 ? "Continue" : "Begin") + " ›"); begin.type = "button";
    begin.addEventListener("click", function () { go(startHash()); });
    actions.appendChild(begin);
    actions.appendChild(el("span", "save-hint", "Your answers are saved automatically in this browser."));
    page.appendChild(actions);
    v.appendChild(page); topFocus();
  }

  function renderAbout() {
    renderStepper("about");
    var v = clearView();
    var page = el("div", "page about");
    var head = el("div", "gp-head");
    head.appendChild(el("div", "gp-icon info", icon("info")));
    var hbox = el("div", null);
    hbox.appendChild(el("p", "eyebrow", "Background"));
    hbox.appendChild(el("h2", null, "About you"));
    hbox.appendChild(el("p", "gp-desc", "Used only to describe who took part in this study."));
    head.appendChild(hbox); page.appendChild(head);

    var card = el("div", "card intake");
    INTAKE.forEach(function (q) { card.appendChild(bgBlock(q)); });
    page.appendChild(card);

    var nav = el("div", "pagenav");
    var back = el("button", "btn btn-ghost", "‹ Back"); back.type = "button";
    back.addEventListener("click", function () { go("#welcome"); });
    var next = el("button", "btn btn-primary", "Continue ›"); next.type = "button";
    next.addEventListener("click", function () { if (!aboutComplete()) { flagBg(INTAKE.map(function (q) { return q.id; }), "Please answer to continue."); return; } go(STEPS[0] ? stepHash(STEPS[0]) : "#done"); });
    nav.appendChild(back); nav.appendChild(el("div", "spacer")); nav.appendChild(next);
    page.appendChild(nav);
    v.appendChild(page); topFocus();
  }

  function renderStep(step) {
    currentStep = step;
    renderStepper(step.si);
    var v = clearView();
    var sec = step.sec;
    var page = el("div", "page group-page");

    var head = el("div", "gp-head");
    head.appendChild(el("div", "gp-icon", sectionIcon(sec)));
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

    page.appendChild(el("div", "setup", ""));
    page.appendChild(el("div", "matrix-host", ""));

    var nav = el("div", "pagenav");
    var back = el("button", "btn btn-ghost", "‹ Back"); back.type = "button";
    back.addEventListener("click", function () { go(step.index === 0 ? (HAS_INTAKE ? "#about" : "#welcome") : stepHash(STEPS[step.index - 1])); });
    var isLast = step.index === STEPS.length - 1;
    var next = el("button", "btn btn-primary", isLast ? "Finish ›" : "Next ›"); next.type = "button";
    next.addEventListener("click", onNext);
    nav.appendChild(back); nav.appendChild(el("div", "spacer")); nav.appendChild(next);
    page.appendChild(nav);

    v.appendChild(page);
    renderSetup(sec); renderMatrix(sec);
    topFocus();
  }

  // ---------- usage picker (one combined question) + tools block + rating matrix ----------
  function setupHostEl() { return document.querySelector(".setup"); }
  function matrixHostEl() { return document.querySelector(".matrix-host"); }
  function rerenderSetup() { if (currentStep && setupHostEl()) renderSetup(currentStep.sec); }
  function rerenderSection() { if (currentStep) { renderSetup(currentStep.sec); renderMatrix(currentStep.sec); } }

  // one combined question per section: which tasks do you use AI for? (multi-select)
  function renderSetup(sec) {
    var host = setupHostEl(); if (!host) return;
    host.innerHTML = "";
    var block = el("div", "usagepicker");
    var q = el("p", "usagepicker-q", "Which of these tasks do you use AI for?");
    q.appendChild(el("span", "usagepicker-hint", "Select all that apply. Leave a task unticked if you do not use AI for it."));
    block.appendChild(q);
    var list = el("div", "usage-list");
    (sec.columns || []).forEach(function (col) { list.appendChild(renderUsageItem(sec, col)); });
    list.appendChild(renderNoneItem(sec));
    block.appendChild(list);
    host.appendChild(block);
    var tb = renderToolsBlock(sec); if (tb) host.appendChild(tb);
  }
  function renderUsageItem(sec, col) {
    var on = usageOf(sec, col) === "yes", done = on && colResolved(sec, col);
    var item = el("div", "usage-item" + (on ? " on" : "") + (done ? " done" : "")); item.setAttribute("data-col", col.id);
    var toggle = el("button", "usage-toggle"); toggle.type = "button"; toggle.setAttribute("aria-pressed", on ? "true" : "false");
    toggle.appendChild(el("span", "usage-check" + (on ? " on" : ""), on ? icon("check") : ""));
    var body = el("span", "usage-body");
    var nameRow = el("span", "usage-namerow");
    nameRow.appendChild(el("span", "usage-name", esc(col.label)));
    if (done) nameRow.appendChild(el("span", "usage-badge done", icon("check") + "<span>Done</span>"));
    body.appendChild(nameRow);
    if (col.examples) body.appendChild(el("span", "usage-ex", '<span class="ex-lead">For example:</span> ' + esc(col.examples) + "."));
    toggle.appendChild(body);
    toggle.addEventListener("click", function () { toggleTaskUsed(sec, col); });
    item.appendChild(toggle);
    return item;
  }
  function noneSelected(sec) {
    var cols = sec.columns || [];
    return cols.length > 0 && cols.every(function (c) { return usageOf(sec, c) === "no"; });
  }
  function renderNoneItem(sec) {
    var on = noneSelected(sec);
    var item = el("div", "usage-item none" + (on ? " on" : ""));
    var toggle = el("button", "usage-toggle"); toggle.type = "button"; toggle.setAttribute("aria-pressed", on ? "true" : "false");
    toggle.appendChild(el("span", "usage-check" + (on ? " on" : ""), on ? icon("check") : ""));
    var body = el("span", "usage-body");
    body.appendChild(el("span", "usage-name", "I don’t use AI for any of these"));
    toggle.appendChild(body);
    toggle.addEventListener("click", function () { setNoneUsed(sec); });
    item.appendChild(toggle);
    return item;
  }
  function buildToolPicker(sec, opts) {
    var wrap = el("div", "tools");
    wrap.appendChild(el("p", "tools-instruction", opts.instruction));
    var chips = el("div", "toolchips");
    var tools = opts.tools;
    var list = toolListFor(sec).slice();
    tools.forEach(function (t) { if (list.indexOf(t) < 0) list.push(t); });
    list.forEach(function (name) {
      var rank = tools.indexOf(name);
      var chip = el("button", "chip" + (rank >= 0 ? " selected" : "")); chip.type = "button";
      if (rank >= 0) chip.appendChild(el("span", "rank", "" + (rank + 1)));
      chip.appendChild(el("span", "chip-label", esc(name)));
      chip.addEventListener("click", function () { opts.onToggle(name); });
      chips.appendChild(chip);
    });
    var other = el("button", "chip other"); other.type = "button"; other.textContent = "+ Other";
    other.addEventListener("click", function () { opts.onOther(); });
    chips.appendChild(other);
    wrap.appendChild(chips);
    wrap.appendChild(el("p", "tools-hint", "Tap to rank 1, 2, 3 · tap again to remove · selected " + tools.length + "/" + MAX_TOOLS));
    return wrap;
  }
  // tools block below the checklist: one combined picker (Same for all) or one per task (Different)
  function renderToolsBlock(sec) {
    var sel = (sec.columns || []).filter(function (c) { return usageOf(sec, c) === "yes"; });
    if (!sel.length) return null;
    var mode = toolsMode(sec);
    var block = el("div", "toolsblock");
    var head = el("div", "toolsblock-head");
    head.appendChild(el("p", "toolsblock-q", "Which AI tools do you use?"));
    if (sel.length >= 2) {
      var seg = el("div", "segmented toolsmode");
      var sameB = el("button", "seg-opt" + (mode !== "per" ? " on" : "")); sameB.type = "button"; sameB.innerHTML = "<span>Same for all</span>";
      var diffB = el("button", "seg-opt" + (mode === "per" ? " on" : "")); diffB.type = "button"; diffB.innerHTML = "<span>Different per task</span>";
      sameB.addEventListener("click", function () { setToolsMode(sec, "shared"); });
      diffB.addEventListener("click", function () { setToolsMode(sec, "per"); });
      seg.appendChild(sameB); seg.appendChild(diffB); head.appendChild(seg);
    }
    block.appendChild(head);
    if (mode === "per") {
      sel.forEach(function (col) {
        var grp = el("div", "toolgroup"); grp.setAttribute("data-col", col.id);
        grp.appendChild(el("p", "toolgroup-name", esc(col.label)));
        grp.appendChild(buildToolPicker(sec, {
          tools: rawColTools(sec, col),
          instruction: "Select the tools you use most, in order. Tap up to " + MAX_TOOLS + ".",
          onToggle: function (name) { changeTools(function () { return rawColTools(sec, col); }, function (t) { answers[toolsKey(sec, col)] = t; }, name); },
          onOther: function () { addOtherTool(function () { return rawColTools(sec, col); }, function (t) { answers[toolsKey(sec, col)] = t; }); }
        }));
        block.appendChild(grp);
      });
    } else {
      block.appendChild(buildToolPicker(sec, {
        tools: sharedToolsOf(sec),
        instruction: "Pick the tools you use most, in order. They apply to every task you selected. Tap up to " + MAX_TOOLS + ".",
        onToggle: function (name) { changeTools(function () { return sharedToolsOf(sec); }, function (t) { answers[sharedToolsKey(sec)] = t; }, name); },
        onOther: function () { addOtherTool(function () { return sharedToolsOf(sec); }, function (t) { answers[sharedToolsKey(sec)] = t; }); }
      }));
    }
    return block;
  }
  function setToolsMode(sec, m) { answers[toolsModeKey(sec)] = m; saveAnswers(); rerenderSetup(); updateProgress(); refreshStepper(); }
  // matrix: rows = statements, columns = ALL sub-areas; columns not marked "Yes" are locked/greyed
  function renderMatrix(sec) {
    var host = matrixHostEl(); if (!host) return;
    host.innerHTML = ""; cueUpdate = null;
    var cols = sec.columns || [];
    if (!cols.length) return;
    host.appendChild(el("p", "matrix-lead", "Rate each statement (1 = " + esc(scaleLabel(MIN)) + ", " + MAX + " = " + esc(scaleLabel(MAX)) + "). Greyed columns are tasks you have not selected above."));
    var wrap = el("div", "matrix-wrap");
    var scroll = el("div", "matrix-scroll");
    var table = el("table", "matrix");
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    tr.appendChild(el("th", "corner", "Statement"));
    cols.forEach(function (col) {
      var u = usageOf(sec, col), active = u === "yes";
      var th = el("th", "colhead" + (active ? "" : " locked"));
      if (col.examples) th.setAttribute("title", col.label + ". For example: " + col.examples);
      th.appendChild(el("span", "colhead-label", esc(col.label)));
      if (!active) th.appendChild(el("span", "colhead-note", u === "no" ? "Skipped" : "Select above"));
      tr.appendChild(th);
    });
    thead.appendChild(tr); table.appendChild(thead);
    var tbody = document.createElement("tbody");
    questionsOf(sec).forEach(function (q) {
      var rtr = el("tr", "qrow");
      rtr.appendChild(el("th", "qcell", esc(q.text || "")));
      cols.forEach(function (col) {
        var active = usageOf(sec, col) === "yes";
        var td = el("td", "answer" + (active ? "" : " locked")); td.setAttribute("data-key", keyOf(sec.id, q.id, col.id));
        var ns = buildNumberScale(sec.id, q.id, col.id);
        if (!active) ns.querySelectorAll("input").forEach(function (inp) { inp.disabled = true; });
        td.appendChild(ns);
        rtr.appendChild(td);
      });
      tbody.appendChild(rtr);
    });
    table.appendChild(tbody); scroll.appendChild(table); wrap.appendChild(scroll);
    var cue = el("div", "scroll-cue"); cue.innerHTML = '<span class="cue-pill">Scroll&nbsp;→</span>'; cue.style.display = "none";
    wrap.appendChild(cue); host.appendChild(wrap);
    setupScrollCue(scroll, cue);
  }
  function setupScrollCue(scrollEl, cueEl) {
    cueUpdate = function () {
      var max = scrollEl.scrollWidth - scrollEl.clientWidth;
      var atEnd = scrollEl.scrollLeft >= max - 4;
      cueEl.style.display = (max > 6 && !atEnd) ? "flex" : "none";
    };
    scrollEl.addEventListener("scroll", cueUpdate, { passive: true });
    cueUpdate(); setTimeout(cueUpdate, 60);
  }

  // ---------- interactions ----------
  // first interaction "activates" the section: any untouched task becomes "no" (single-question
  // semantics — an unticked task means "I do not use AI for it").
  function baselineSection(sec) { (sec.columns || []).forEach(function (c) { if (!usageOf(sec, c)) answers[useKey(sec, c)] = "no"; }); }
  function clearColTools(sec, col) { delete answers[toolsKey(sec, col)]; }
  function toggleTaskUsed(sec, col) {
    var cur = usageOf(sec, col);
    baselineSection(sec);
    if (cur === "yes") { answers[useKey(sec, col)] = "no"; clearColTools(sec, col); }
    else { answers[useKey(sec, col)] = "yes"; }
    saveAnswers(); rerenderSection(); updateProgress(); refreshStepper();
  }
  function setNoneUsed(sec) {
    (sec.columns || []).forEach(function (c) { answers[useKey(sec, c)] = "no"; clearColTools(sec, c); });
    saveAnswers(); rerenderSection(); updateProgress(); refreshStepper();
  }
  // generic tool toggle/add, parameterized by where the list is read/written (per-col or shared)
  function changeTools(get, set, name) {
    var t = get().slice(), i = t.indexOf(name);
    if (i >= 0) t.splice(i, 1);
    else if (t.length < MAX_TOOLS) t.push(name);
    else { showToast("You can rank up to " + MAX_TOOLS + " tools.", true); return; }
    set(t); saveAnswers(); rerenderSetup(); updateProgress(); refreshStepper();
  }
  function addOtherTool(get, set) {
    var t = get().slice();
    if (t.length >= MAX_TOOLS) { showToast("You can rank up to " + MAX_TOOLS + " tools.", true); return; }
    var name = (window.prompt("Add another AI tool:") || "").trim();
    if (!name || t.indexOf(name) >= 0) return;
    t.push(name); set(t); saveAnswers(); rerenderSetup(); updateProgress(); refreshStepper();
  }
  function onCellChange(e) {
    answers[e.target.name] = +e.target.value; saveAnswers();
    var td = e.target.closest("td.answer"); if (td) td.classList.remove("missing");
    updateProgress(); refreshStepper(); updateSetupBadges();
  }
  // light refresh of usage-row "Done" state without touching the matrix inputs (keeps radio focus)
  function updateSetupBadges() {
    if (!currentStep) return; var sec = currentStep.sec;
    document.querySelectorAll(".setup .usage-item").forEach(function (itemEl) {
      var colId = itemEl.getAttribute("data-col"); if (!colId) return;
      var col = (sec.columns || []).filter(function (c) { return c.id === colId; })[0]; if (!col) return;
      var on = usageOf(sec, col) === "yes", done = on && colResolved(sec, col);
      itemEl.className = "usage-item" + (on ? " on" : "") + (done ? " done" : "");
      var nameRow = itemEl.querySelector(".usage-namerow"); if (!nameRow) return;
      var badge = nameRow.querySelector(".usage-badge");
      if (done && !badge) nameRow.appendChild(el("span", "usage-badge done", icon("check") + "<span>Done</span>"));
      else if (!done && badge) badge.parentNode.removeChild(badge);
    });
  }
  function onNext() {
    var sec = currentStep.sec, step = currentStep;
    if (extrasOf(sec).length && !extrasComplete(sec)) { flagBg(extrasOf(sec).map(function (q) { return q.id; }), "Please answer the questions at the top of this section."); return; }
    var cols = sec.columns || [], host = setupHostEl();
    var answered = cols.every(function (c) { return usageOf(sec, c) !== ""; });
    if (cols.length && !answered) {
      showToast("Please choose which tasks you use AI for, or select “I don’t use AI for any of these”.", true);
      var pick = host && host.querySelector(".usagepicker");
      if (pick) { pick.classList.add("needs"); setTimeout(function () { pick.classList.remove("needs"); }, 400); pick.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    var per = toolsMode(sec) === "per";
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      if (colResolved(sec, col)) continue;
      if (toolsOf(sec, col).length === 0) {
        showToast(per ? "Please select at least one AI tool for “" + col.label + "”." : "Please select at least one AI tool for the tasks you picked.", true);
        var target = host && (per ? host.querySelector('.toolgroup[data-col="' + col.id + '"]') : host.querySelector(".toolsblock"));
        if (target) { var tc = target.querySelector(".toolchips"); if (tc) tc.classList.add("needs"); target.scrollIntoView({ behavior: "smooth", block: "center" }); }
        return;
      }
      flagFirstMissingCell(sec, col);
      showToast("Please rate every statement for “" + col.label + "”.", true);
      return;
    }
    var isLast = step.index === STEPS.length - 1;
    go(isLast ? "#done" : stepHash(STEPS[step.index + 1]));
  }
  function flagFirstMissingCell(sec, col) {
    var first = null;
    questionsOf(sec).forEach(function (q) {
      var key = keyOf(sec.id, q.id, col.id);
      if (answers[key] == null) {
        var td = document.querySelector('td.answer[data-key="' + key + '"]');
        if (td) { td.classList.add("missing"); if (!first) first = td; }
      }
    });
    if (first) setTimeout(function () { first.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); }, 60);
  }

  function alreadySubmitted() { return SUBMITTED || (TOKEN && (function () { try { return !!localStorage.getItem(submittedKey(TOKEN)); } catch (e) { return false; } })()); }

  function renderDone() {
    cueUpdate = null; renderStepper(null);
    var v = clearView();
    var total = totalSteps(), done = completedSteps(), remaining = total - done;

    // not finished yet
    if (remaining) {
      var page = el("div", "page done incomplete");
      page.appendChild(el("div", "check", "!"));
      page.appendChild(el("h2", null, "Almost there"));
      page.appendChild(el("p", null, done + " of " + total + " steps completed. " + remaining + " still need attention."));
      var a0 = el("div", "done-actions");
      var fix = el("button", "btn btn-primary", "Go to first unfinished"); fix.type = "button";
      fix.addEventListener("click", function () { if (HAS_INTAKE && !aboutComplete()) { go("#about"); return; } var st = firstIncompleteStep(); if (st) go(stepHash(st)); });
      a0.appendChild(fix); page.appendChild(a0);
      v.appendChild(page); topFocus(); return;
    }

    // finished + delivery configured + not yet sent -> submit step
    if (GATED && !alreadySubmitted()) {
      var p1 = el("div", "page done");
      p1.appendChild(el("div", "check", "✓"));
      p1.appendChild(el("h2", null, "Ready to submit"));
      p1.appendChild(el("p", null, "You have completed every section. Submit your responses to record them. This can be done once."));
      var a1 = el("div", "done-actions");
      var sub = el("button", "btn btn-primary", "Submit responses"); sub.type = "button";
      sub.addEventListener("click", function () {
        sub.disabled = true; sub.textContent = "Submitting…";
        submitResponses(function (ok) {
          if (ok) { SUBMITTED = true; try { localStorage.setItem(submittedKey(TOKEN), "1"); } catch (e) {} renderDone(); }
          else { sub.disabled = false; sub.textContent = "Submit responses"; showToast("We could not confirm your submission. Please check your connection and try again.", true); }
        });
      });
      a1.appendChild(sub); p1.appendChild(a1);
      v.appendChild(p1); topFocus(); return;
    }

    // submitted (gated) or finished (open mode)
    var page2 = el("div", "page done");
    page2.appendChild(el("div", "check", "✓"));
    page2.appendChild(el("h2", null, "Thank you!"));
    page2.appendChild(el("p", null, GATED
      ? "Your response has been recorded. Thank you for taking part in this METU study."
      : "All steps are complete. Thank you for taking part in this METU study. You can download your responses below."));
    var actions = el("div", "done-actions");
    var dj = el("button", "btn btn-primary", "Download JSON"); dj.type = "button"; dj.addEventListener("click", exportJson);
    var dc = el("button", "btn btn-ghost", "Download CSV"); dc.type = "button"; dc.addEventListener("click", exportCsv);
    actions.appendChild(dj); actions.appendChild(dc); page2.appendChild(actions);
    v.appendChild(page2); topFocus();
  }

  // ---------- access gate + delivery (Google Apps Script) ----------
  function getParam(name) { var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search || ""); return m ? decodeURIComponent(m[1]) : ""; }
  function jsonp(url, cb) {
    var name = "cb_" + (jsonp._n = (jsonp._n || 0) + 1); var s, done = false;
    function cleanup() { try { delete window[name]; } catch (e) { window[name] = undefined; } if (s && s.parentNode) s.parentNode.removeChild(s); }
    window[name] = function (data) { if (done) return; done = true; cleanup(); cb(null, data); };
    s = document.createElement("script");
    s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + name;
    s.onerror = function () { if (done) return; done = true; cleanup(); cb(new Error("network")); };
    document.head.appendChild(s);
    setTimeout(function () { if (done) return; done = true; cleanup(); cb(new Error("timeout")); }, 12000);
  }
  function validateToken(t, cb) { jsonp(CFG.webAppUrl + "?action=validate&t=" + encodeURIComponent(t), function (err, data) { cb(err ? "error" : ((data && data.status) || "invalid")); }); }
  function submitResponses(cb) {
    var payload = { background: background(), sections: buildExportSections() };
    function confirm() { setTimeout(function () { validateToken(TOKEN, function (status) { cb(status === "recorded"); }); }, 1400); }
    try {
      fetch(CFG.webAppUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ t: TOKEN, payload: payload }) })
        .then(confirm, confirm);
    } catch (e) { confirm(); }
  }
  function showGate(kind) {
    renderStepper(null);
    var v = clearView();
    var box = el("div", "page gate");
    var cls = kind === "recorded" ? " ok" : (kind === "checking" ? " wait" : "");
    box.appendChild(el("div", "gate-icon" + cls, kind === "recorded" ? "✓" : (kind === "checking" ? "…" : "!")));
    var title, msg;
    if (kind === "checking") { title = "Checking your link…"; msg = "One moment, please."; }
    else if (kind === "recorded") { title = "You have already responded"; msg = "Our records show this link has already been used. Thank you for taking part."; }
    else if (kind === "notoken") { title = "Please use your personal link"; msg = "Open the survey from the personal link we emailed you after the Google Form. The survey can only be opened with that link."; }
    else if (kind === "error") { title = "Connection problem"; msg = "We could not check your link. Please check your connection and try again."; }
    else { title = "This link is not valid"; msg = "Your link is invalid or has expired. Please start again from the Google Form to receive a new link."; }
    box.appendChild(el("h2", null, title));
    box.appendChild(el("p", null, msg));
    if (kind === "error") { var b = el("button", "btn btn-primary", "Try again"); b.type = "button"; b.addEventListener("click", gateCheck); box.appendChild(b); }
    v.appendChild(box); topFocus();
  }
  function gateCheck() {
    var t = getParam("t");
    if (!t) { showGate("notoken"); return; }
    TOKEN = t;
    try { if (localStorage.getItem(submittedKey(t))) { showGate("recorded"); return; } } catch (e) {}
    showGate("checking");
    validateToken(t, function (status) {
      if (status === "pending") { ACCESS_OK = true; render(); }
      else if (status === "recorded") { showGate("recorded"); }
      else if (status === "error") { showGate("error"); }
      else { showGate("invalid"); }
    });
  }

  // ---------- toast ----------
  function showToast(msg, warn) {
    var t = document.getElementById("toast"); t.textContent = msg; t.className = "toast" + (warn ? " warn" : "");
    t.hidden = false; clearTimeout(showToast._t); showToast._t = setTimeout(function () { t.hidden = true; }, 3600);
  }

  // ---------- export ----------
  function bgQuestions() { var arr = INTAKE.slice(); SECTIONS.forEach(function (s) { extrasOf(s).forEach(function (q) { arr.push(q); }); }); return arr; }
  function background() { var o = {}; bgQuestions().forEach(function (q) { o[q.id] = { label: q.label, answer: answers[bgKey(q.id)] || "" }; }); return o; }
  function usesAi(sec, col) { var u = usageOf(sec, col); return u === "yes" ? "Yes" : (u === "no" ? "No" : ""); }
  function toolsString(sec, col) { return toolsOf(sec, col).map(function (t, i) { return (i + 1) + ") " + t; }).join("; "); }
  function buildExportSections() {
    return SECTIONS.map(function (sec) {
      var responses = [];
      (sec.columns || []).forEach(function (col) {
        var u = usageOf(sec, col), used = u === "yes";
        (sec.groups || []).forEach(function (g) {
          (g.questions || []).forEach(function (q) {
            var key = keyOf(sec.id, q.id, col.id), has = used && answers[key] != null;
            responses.push({ construct: g.name, code: q.code || "", question: q.text || "", sub_area: col.label || "",
              uses_ai: usesAi(sec, col), tools: toolsOf(sec, col),
              value: has ? answers[key] : "", label: has ? scaleLabel(answers[key]) : "" });
          });
        });
      });
      var subAreas = (sec.columns || []).map(function (col) { return { sub_area: col.label || "", uses_ai: usesAi(sec, col), tools: toolsOf(sec, col) }; });
      return { section: sec.name, subAreas: subAreas, responses: responses };
    });
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob); var a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function exportJson() { download("ai_survey_responses.json", JSON.stringify({ title: (S.meta && S.meta.title) || "Survey", org: (S.meta && S.meta.org) || "", background: background(), scale: SCALE, sections: buildExportSections() }, null, 2), "application/json;charset=utf-8"); }
  function exportCsv() {
    var bgQ = bgQuestions();
    var lines = [bgQ.map(function (q) { return q.label; }).concat(["Section", "Sub-area", "Uses AI", "Ranked Tools", "Construct", "Code", "Statement", "Value", "Label"]).map(csvCell).join(",")];
    var bgVals = bgQ.map(function (q) { return answers[bgKey(q.id)] || ""; });
    SECTIONS.forEach(function (sec) {
      (sec.columns || []).forEach(function (col) {
        var uses = usesAi(sec, col), ts = toolsString(sec, col), used = usageOf(sec, col) === "yes";
        (sec.groups || []).forEach(function (g) {
          (g.questions || []).forEach(function (q) {
            var key = keyOf(sec.id, q.id, col.id);
            var val = (used && answers[key] != null) ? answers[key] : "";
            var lab = (used && answers[key] != null) ? scaleLabel(answers[key]) : "";
            lines.push(bgVals.concat([sec.name, col.label || "", uses, ts, g.name, q.code || "", q.text || "", val, lab]).map(csvCell).join(","));
          });
        });
      });
    });
    download("ai_survey_responses.csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }
  function csvCell(v) { v = v == null ? "" : String(v); if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'; return v; }

  // ---------- render / init ----------
  function render() {
    if (GATED && !ACCESS_OK) return; // hold the survey until a valid link is confirmed
    var route = parseHash();
    if (route.view === "welcome") renderWelcome();
    else if (route.view === "about") (HAS_INTAKE ? renderAbout() : renderWelcome());
    else if (route.view === "done") renderDone();
    else renderStep(route.step);
    updateProgress();
  }
  function init() {
    applyMeta();
    if (!SECTIONS.length) { document.getElementById("view").innerHTML = '<p class="page">No survey data found.</p>'; return; }
    window.addEventListener("hashchange", render);
    window.addEventListener("resize", function () { if (cueUpdate) cueUpdate(); });
    if (GATED) gateCheck(); else { ACCESS_OK = true; render(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
