# -*- coding: utf-8 -*-
"""
Excel -> assets/js/data.js  (window.SURVEY)  +  source/survey_data.json  +  docs/parse_report.md

Builds an English model consumed by assets/js/app.js. The respondent-facing UI shows a flat
list of (reworded, example-rich) questions per section; construct names and item codes are kept
in the data only for the researcher's export, never shown in the UI.

Model:
  SURVEY = {
    meta:  {title, intro, sourceFile, aiTools:[...]},
    scale: {min, max, labels:{1..5}},
    sections: [
      { id, slug, name, description,
        columns: [ {id, label} ],                              # sub-areas (matrix columns)
        groups:  [ {name, questions:[ {id, code, text} ]} ]    # construct kept for export only
      }
    ],
    rawSheets: [ {name, grid} ]
  }
"""
import json, re, os, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PRIMARY = os.path.join(ROOT, "source", "UTAUT_Group_Matrices_2.xlsx")
OUT_DATA_JS = os.path.join(ROOT, "assets", "js", "data.js")
OUT_JSON = os.path.join(ROOT, "source", "survey_data.json")
OUT_REPORT = os.path.join(ROOT, "docs", "parse_report.md")
OUT_STATUS = os.path.join(ROOT, "docs", "_build_status.txt")

MATRIX_SHEETS = ["GENERAL", "LEARNING_BRAINSTORMING", "PROBLEM_SOLVING",
                 "REPORTING_PRESENTATION_ORGAN", "DATA_PROCESSING_CODING"]

CODE_RE = re.compile(r"^([A-Za-z][A-Za-z0-9\-]{0,9})\s*:\s*(.+)$", re.S)

SCALE = {1: "Strongly disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly agree"}

# Conducting institution + welcome copy (written plainly, no dashes)
TITLE = "AI Use in Civil Engineering Studies"
ORG = "Middle East Technical University (METU) · Department of Civil Engineering"
INTRO = ("We are studying how civil engineering students use AI tools such as ChatGPT, Copilot "
         "and others in their everyday academic work, including learning, problem solving, "
         "reports and presentations, and coding. Our aim is to understand where AI genuinely "
         "helps, what gets in the way, and how it can better support engineering education at METU.")
HOWLONG = ("It takes about five to seven minutes. First a few quick questions about you, then for "
           "five task areas you tell us whether you use AI and rate a short set of statements. You "
           "only answer the areas where you actually use AI, and there are no right or wrong answers.")
ORG_NOTE = ("Participation is voluntary and your responses are anonymous. They are used only for "
            "this academic study.")

# Mandatory background ("About you") question asked once, at the very start (dropdown).
INTAKE = [
    {"id": "semester", "type": "select", "label": "Which semester are you in?",
     "options": ["1st semester", "2nd semester", "3rd semester", "4th semester", "5th semester",
                 "6th semester", "7th semester", "8th semester", "9th semester", "10th semester",
                 "11th semester", "12th semester", "13th semester", "14th semester",
                 "Master's", "PhD"]},
]

# General AI usage questions shown at the top of the GENERAL section (required there).
GENERAL_EXTRA = [
    {"id": "ai_experience", "label": "How would you describe your experience with AI tools?",
     "options": ["Never used", "Beginner", "Intermediate", "Advanced"]},
    {"id": "freq", "label": "How often do you use AI for your coursework or engineering tasks?",
     "options": ["Daily", "A few times a week", "About once a week", "Rarely", "Never"]},
    {"id": "paid", "label": "Do you pay for any AI tool (paid subscription)?",
     "options": ["No", "Yes, one", "Yes, more than one"]},
]

# Per-section AI tool lists (researched, 2026-current). "+ Other…" is always added in the UI.
SECTION_TOOLS = {
    "GENERAL": ["ChatGPT", "Google Gemini", "Claude", "Microsoft Copilot",
                "Perplexity", "DeepSeek", "Grok", "Meta AI"],
    "LEARNING & BRAINSTORMING": ["ChatGPT", "Google Gemini", "Claude", "Perplexity",
                                 "NotebookLM", "Elicit", "Consensus", "Microsoft Copilot", "DeepSeek"],
    "PROBLEM SOLVING": ["ChatGPT", "Google Gemini", "Claude", "DeepSeek", "Wolfram Alpha",
                        "Photomath", "Symbolab", "Microsoft Copilot", "Perplexity"],
    "REPORTING, PRESENTATION & ORGANIZATION": ["ChatGPT", "Claude", "Google Gemini", "Microsoft Copilot",
                                               "Grammarly", "QuillBot", "Gamma", "Canva",
                                               "Beautiful.ai", "Notion AI"],
    "DATA PROCESSING & CODING": ["ChatGPT", "Claude", "GitHub Copilot", "Cursor", "Claude Code",
                                 "Windsurf", "Google Gemini", "Microsoft Copilot", "DeepSeek",
                                 "Replit", "Julius AI"],
}
ALL_TOOLS = []
for _lst in SECTION_TOOLS.values():
    for _t in _lst:
        if _t not in ALL_TOOLS:
            ALL_TOOLS.append(_t)

# Clarifying examples shown under each sub-area title (and as a matrix column tooltip), so the
# respondent knows what kind of task the sub-area means before answering "Do you use AI for this
# task?". Keyed by the FINAL sub-area label (after nodash()); values are run through nodash() too,
# so keep them free of dashes. The UI prefixes "For example:" and appends a period.
COLUMN_EXAMPLES = {
    # GENERAL
    "Academic & Professional Communication":
        "writing an email to a professor about a missed deadline, drafting an internship "
        "application to a construction firm, writing a cover letter for a summer job, rewording "
        "a message to sound more formal, translating a professional email into English",
    "Non Academic Use / Exploration":
        "asking random questions out of curiosity, planning a weekend trip or your monthly "
        "budget, getting movie or book recommendations, brainstorming ideas for a personal "
        "hobby, looking up everyday facts unrelated to your studies",
    # LEARNING & BRAINSTORMING
    "Active Learning":
        "understanding a tough statics or mechanics concept, asking follow up questions until it "
        "clicks, getting a step by step worked solution, having a topic explained in simpler "
        "words, practicing with problems the AI quizzes you on",
    "Learning Material Preparation":
        "summarizing your own lecture notes or readings, making flashcards for exam terms, "
        "building a study guide or formula cheat sheet, turning lecture slides into clean notes, "
        "drawing up a concept map of a topic",
    "Research Process":
        "finding sources or references for a report, summarizing a journal paper, comparing "
        "findings across different studies, brainstorming a project or thesis topic, organizing "
        "a literature review",
    # PROBLEM SOLVING
    "Understanding & Planning Problems (Homework / Self Exercise)":
        "figuring out what a homework question is actually asking, deciding which method to use "
        "on a statics problem, getting a hint when you are stuck on a beam or truss question, "
        "checking whether your free body diagram and equations make sense, walking through a "
        "worked example step by step",
    "Exam Preparation (Self Exercise)":
        "solving old midterm and final questions to revise, asking for extra practice problems "
        "on a weak topic, quizzing yourself with timed questions to test your readiness, listing "
        "which subjects to focus on before the exam, recalling key formulas and when to apply them",
    # REPORTING, PRESENTATION & ORGANIZATION
    "Planning & Drafting (Report/Essay)":
        "outlining the sections of a lab or project report, drafting the introduction or "
        "conclusion, turning your rough notes into full paragraphs, expanding a short bullet "
        "into a proper paragraph, deciding what order to present your results",
    "Quality Checks Before Submission (Report & Pres.)":
        "fixing grammar and spelling mistakes, making the wording clearer and easier to read, "
        "smoothing the tone of an academic sentence, formatting your references in the required "
        "citation style, a final proofread before you hand it in",
    "Presentation Preparation":
        "planning how many slides and what goes on each one, writing the bullet points and "
        "speaker notes, condensing a long report into a few slides, deciding what to actually "
        "say out loud, practicing answers to questions the instructor might ask",
    "Charts, Diagrams & Visuals (Report & Pres.)":
        "making a chart or graph from your data, choosing whether a bar or line chart fits "
        "better, sketching a simple diagram or figure for your report, cleaning up a messy plot "
        "so it looks clearer, generating an icon or illustration for a slide",
    "Productivity":
        "planning a weekly schedule around your deadlines, organizing your tasks and study notes "
        "into folders, setting reminders for upcoming submission dates, splitting the work for a "
        "group project, tracking who does what so the team stays on schedule",
    # DATA PROCESSING & CODING
    "Data Collection & Processing (Excel & others)":
        "cleaning messy lab measurements in Excel, writing a formula to convert units, removing "
        "duplicate or wrong readings, organizing survey or sensor data into columns, importing a "
        "CSV file of test results",
    "Data Representation (Excel & others)":
        "plotting a stress strain curve in Excel, building a bar chart for a project report, "
        "making a pivot table to summarize results, formatting a clean results table, turning "
        "concrete test numbers into a graph",
    "Code Development & Debugging":
        "writing a MATLAB script for a beam calculation, fixing an error in Python code, "
        "explaining what a chunk of code does, adding comments to a numerical solver, rewriting "
        "code from MATLAB into Python",
    "Code Execution & Output Representation":
        "understanding why a script crashed, reading the numbers a program printed out, checking "
        "if the computed results look reasonable, interpreting what the output values mean, "
        "copying program results into a report",
}

SECTION_DESC = {
    "GENERAL": "Your overall, everyday use of AI for academic and professional communication, and "
               "for non academic exploration.",
    "LEARNING & BRAINSTORMING": "Using AI to learn and generate ideas: active learning, preparing "
                                "study materials, and the research process.",
    "PROBLEM SOLVING": "Using AI to understand, plan, and solve problems for homework, self study, "
                       "and exam preparation.",
    "REPORTING, PRESENTATION & ORGANIZATION": "Using AI to plan, draft, review, and present academic "
                                              "work such as reports, essays, presentations, visuals, "
                                              "and productivity.",
    "DATA PROCESSING & CODING": "Using AI for data and code: collecting and processing data, "
                                "representing data, and developing, debugging, and running code.",
}

# Question wording: faithful to the ORIGINAL UTAUT items (Venkatesh et al. 2003), lightly adapted.
# Only Performance Expectancy + Effort Expectancy name the section's domain: PE_EE_TEMPLATES carry a
# "{d}" placeholder filled from DOMAIN_PHRASES, while the GENERAL section uses the un-named
# GENERAL_PE_EE forms. Every other construct is general and identical across all five sections
# (CROSS_ITEMS) so the items stay comparable. Short parenthetical examples are added only where they
# aid clarity. Item codes never render; keep text dash-free (nodash() also strips any). `item_text()`
# resolves the right wording per (code, section).
DOMAIN_PHRASES = {
    "LEARNING & BRAINSTORMING": "learning and brainstorming",
    "PROBLEM SOLVING": "problem solving",
    "REPORTING, PRESENTATION & ORGANIZATION": "reporting, presentations and organization",
    "DATA PROCESSING & CODING": "data processing and coding",
}
PE_EE_TEMPLATES = {
    "RA1": "Using AI for {d} lets me accomplish tasks more quickly.",
    "RA5": "Using AI increases my productivity in {d}.",
    "U6": "I find AI useful for {d}.",
    "OE7": "Using AI for {d} improves the quality of my academic output.",
    "EOU3": "My interaction with AI for {d} is clear and understandable.",
    "EOU6": "I find AI easy to use for {d}.",
    "EOU5": "It is easy to become skillful with the AI tools I use for {d}.",
}
GENERAL_PE_EE = {
    "RA1": "Using AI lets me accomplish tasks more quickly.",
    "RA5": "Using AI increases my productivity.",
    "U6": "I find AI useful.",
    "OE7": "Using AI improves the quality of my academic output.",
    "EOU3": "My interaction with AI is clear and understandable.",
    "EOU6": "I find AI easy to use.",
    "EOU5": "It is easy to become skillful with the AI tools I use.",
}
CROSS_ITEMS = {
    "A1": "Using AI is a good idea.",
    "AF1": "AI makes work more interesting.",
    "AF2": "Working with AI is fun.",
    "Affect1": "I like working with AI.",
    "SN1": "People who influence my behavior (for example, instructors, classmates, or family) think I should use AI.",
    "SN2": "People who are important to me think I should use AI.",
    "SF4": "In general, my department or university supports the use of AI.",
    "PBC2": "I have the resources necessary to use AI (for example, a device, internet access, and a free or paid subscription).",
    "PBC3": "I have the knowledge necessary to use AI.",
    "SE1": "I could complete a task using AI even if there was no one around to tell me what to do.",
    "SE4": "I could complete a task using AI if I could call someone for help when I got stuck.",
    "SE6": "I could complete a task using AI if I had a lot of time to complete it.",
    "ANX1": "I feel apprehensive about using AI.",
    "ANX3": "I hesitate to use AI for fear of making mistakes that cannot be corrected.",
    "ANX-add": "I hesitate to use AI for fear of being noticed or questioned for using it (for example, academic integrity concerns).",
    "ANX-prop": "I feel anxious about learning wrong or insufficient information from AI.",
    "BI1": "I intend to use AI in the coming term.",
    "BI2": "I predict I will use AI in the coming term.",
}


def item_text(code, title, raw):
    """Resolve the visible statement for an item code in a given section (title)."""
    if code in PE_EE_TEMPLATES:
        if title.upper().startswith("GENERAL"):
            return GENERAL_PE_EE.get(code, raw)
        d = DOMAIN_PHRASES.get(title)
        return PE_EE_TEMPLATES[code].replace("{d}", d) if d else GENERAL_PE_EE.get(code, raw)
    return CROSS_ITEMS.get(code, raw)


def cstr(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def norm(s):
    return re.sub(r"\s+", " ", cstr(s)).strip()


def nodash(s):
    """Remove dashes from user-facing text (no '-', '—' or '–')."""
    s = (s or "").replace("—", " ").replace("–", " ").replace("-", " ")
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_") or "x"


def load(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    sheets, order = {}, []
    for ws in wb.worksheets:
        grid = [[cstr(c) for c in row] for row in ws.iter_rows(values_only=True)]
        maxc = max((len(r) for r in grid), default=0)
        for r in grid:
            r += [""] * (maxc - len(r))
        sheets[ws.title] = grid
        order.append(ws.title)
    return sheets, order


def build_section(name, grid):
    title = norm(grid[0][0]).replace("MAIN GROUP:", "").strip()
    columns = []
    if len(grid) > 3:
        for val in grid[3][1:]:
            lab = nodash(norm(val))
            if lab:
                col = {"id": "c%d" % len(columns), "label": lab}
                ex = nodash(COLUMN_EXAMPLES.get(lab, ""))
                if ex:
                    col["examples"] = ex
                columns.append(col)
    groups, cur, qn = [], None, 0
    for row in grid[4:]:
        a = norm(row[0])
        if not a:
            continue
        m = CODE_RE.match(row[0].strip())
        if m and " " not in m.group(1):
            qn += 1
            code = norm(m.group(1))
            if cur is None:
                cur = {"name": "", "questions": []}
                groups.append(cur)
            cur["questions"].append({"id": "q%d" % qn, "code": code,
                                     "text": nodash(item_text(code, title, norm(m.group(2))))})
        else:
            cname = re.split(r"\s+[—-]\s+rate", a)[0].strip()
            cur = {"name": nodash(cname), "questions": []}
            groups.append(cur)
    groups = [g for g in groups if g["questions"]]
    return {
        "id": "sec_" + slug(name), "slug": slug(title), "name": title or name,
        "description": SECTION_DESC.get(title, ""),
        "aiTools": SECTION_TOOLS.get(title, ALL_TOOLS),
        "columns": columns, "groups": groups,
    }


def main():
    sheets, order = load(PRIMARY)
    sections = [build_section(nm, sheets[nm]) for nm in MATRIX_SHEETS if nm in sheets]
    for s in sections:
        if s["name"].upper().startswith("GENERAL"):
            s["extra"] = GENERAL_EXTRA
    model = {
        "meta": {
            "title": TITLE,
            "org": ORG,
            "note": ORG_NOTE,
            "intro": INTRO,
            "howlong": HOWLONG,
            "sourceFile": "source/UTAUT_Group_Matrices_2.xlsx",
            "aiTools": ALL_TOOLS,
        },
        "scale": {"min": 1, "max": 5, "labels": {str(k): v for k, v in SCALE.items()}},
        "intake": INTAKE,
        "sections": sections,
    }

    os.makedirs(os.path.dirname(OUT_DATA_JS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_REPORT), exist_ok=True)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=1)
    with open(OUT_DATA_JS, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by tools/parse_excel.py (source: source/UTAUT_Group_Matrices_2.xlsx)\n")
        f.write("// To edit: change the Excel file and run `python tools/parse_excel.py`, or edit this object.\n")
        f.write("window.SURVEY = ")
        json.dump(model, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    rl = ["# Parse report\n", "Source: source/UTAUT_Group_Matrices_2.xlsx\n",
          "Scale: 1=%s … 5=%s\n" % (SCALE[1], SCALE[5]),
          "AI tools (union): %s\n" % ", ".join(ALL_TOOLS)]
    tot = 0
    for s in sections:
        nq = sum(len(g["questions"]) for g in s["groups"])
        tot += nq * len(s["columns"])
        rl.append("\n## %s  (%d sub-areas, %d items)\n" % (s["name"], len(s["columns"]), nq))
        rl.append("Tools: %s\n" % " · ".join(s["aiTools"]))
        rl.append("Sub-areas: %s\n" % " | ".join(c["label"] for c in s["columns"]))
    rl.append("\nMax rating cells (if all areas used): %d\n" % tot)
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("".join(rl))

    nq = sum(sum(len(g["questions"]) for g in s["groups"]) for s in sections)
    nc = sum(len(s["columns"]) for s in sections)
    status = "OK sections=%d items=%d subareas=%d cells=%d tools=%d" % (
        len(sections), nq, nc, tot, len(ALL_TOOLS))
    with open(OUT_STATUS, "w", encoding="utf-8") as f:
        f.write(status + "\n")
    print(status)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        msg = "FATAL: %s\n%s" % (e, traceback.format_exc())
        try:
            os.makedirs(os.path.dirname(OUT_STATUS), exist_ok=True)
            open(OUT_STATUS, "w", encoding="utf-8").write(msg)
        except Exception:
            pass
        print(msg)
