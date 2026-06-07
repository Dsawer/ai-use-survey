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

# The cleaned instrument (Downloads/yapilandirilmis_anket_sorulari.txt) swaps the proposed
# anxiety item for the original ANX4. The Excel still carries the ANX-prop row, so we remap the
# code here (text comes from CROSS_ITEMS["ANX4"]); the Excel itself is left untouched.
CODE_REMAP = {"ANX-prop": "ANX4"}

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

# Mandatory background ("About you") questions asked once, at the very start.
# First: which year's courses the student mostly takes (pills). Second: exact semester (dropdown).
INTAKE = [
    {"id": "year", "label": "Which year's courses are you mostly taking?",
     "options": ["1st year", "2nd year", "3rd year", "4th year", "Postgraduate"]},
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

# Clarifying examples shown under each sub-area (in the "What does this cover?" expandable AND the
# column-header "?" popup). TRANSLATED from the study's own Turkish usage-area sheet
# (source: "Öğrenci AI Kullanım Alanları.xlsx") so the wording matches the intended scope exactly.
# Keyed by the FINAL sub-area label (after nodash()); values are run through nodash() too, so keep
# them free of dashes. The UI prefixes "For example:" and appends a period.
COLUMN_EXAMPLES = {
    # GENERAL
    "Academic & Professional Communication":
        "writing an email to a professor (a question, an extension or a reminder), a team "
        "announcement or status update, a professional message in English; writing up your "
        "experience and skills, editing your CV, a cover or motivation letter, a statement of "
        "purpose, a research or teaching statement, a scholarship application; generating likely "
        "interview questions, drafting answers, rehearsing an English or technical interview, "
        "and a self introduction",
    "Non Academic Use / Exploration":
        "asking questions out of curiosity, planning a trip or your monthly budget, getting movie "
        "or book recommendations, brainstorming ideas for a personal hobby, and looking up "
        "everyday facts unrelated to your studies",
    # LEARNING & BRAINSTORMING
    "Active Learning":
        "having a topic explained from scratch, in simple or technical language, with examples, "
        "step by step or as a quick recap; explaining a term, formula, variable, symbol or unit, "
        "comparing two concepts, telling apart things that are often confused; building a concept "
        "map, making a real life analogy, correcting common misconceptions; and planning how to "
        "start a topic, setting prerequisites, ordering what to learn, and a weekly, daily or pre "
        "exam study plan",
    "Learning Material Preparation":
        "tidying up scattered notes, merging several sources, building a glossary or term list, "
        "making flashcards; and summarizing a PDF, slides, lecture notes, a book chapter, an "
        "article, a technical report, a regulation or a standard",
    "Research Process":
        "suggesting or narrowing a topic, finding a research question, defining the aim and "
        "scope, writing the expected contribution; and generating keywords, building a source "
        "list, matching Turkish and English search terms, and planning a database search strategy",
    # PROBLEM SOLVING
    "Understanding & Planning Problems (Homework / Self Exercise)":
        "breaking a question into parts, listing what is given and what is asked, drawing out the "
        "assumptions, choosing a suitable formula or method; making a solution plan, explaining "
        "each step, producing a short or detailed solution, suggesting an alternative method; "
        "checking for math, unit, sign or logic errors, spotting a missing step, interpreting the "
        "physical meaning of the result; and simplifying the question, listing what to submit, "
        "reading a rubric, and drawing up a work plan",
    "Exam Preparation (Self Exercise)":
        "practicing multiple choice, true or false, fill in the blank, open ended, calculation "
        "and case questions at easy, medium or hard difficulty; planning your midterm or final, a "
        "last three days plan, finding the most frequently tested topics, spotting your weak "
        "areas; and making a formula sheet, a one page review note, a list of common mistakes and "
        "flashcards",
    # REPORTING, PRESENTATION & ORGANIZATION
    "Planning & Drafting (Report/Essay)":
        "structuring a report (introduction, method, findings, discussion, conclusion), setting "
        "headings and subheadings, building the flow of content; and drafting the abstract, "
        "introduction, literature review, methodology, results, discussion and conclusion",
    "Quality Checks Before Submission (Report & Pres.)":
        "checking spelling, grammar, formatting and citations, matching text with tables and "
        "figures, spotting a missing heading, source or calculation step; and improving academic "
        "tone, fixing grammar, shortening or strengthening sentences, passive voice, and Turkish "
        "to English translation support",
    "Presentation Preparation":
        "writing slide titles and bullet points, turning technical content into presentation "
        "language, making a first draft; writing a speaker script or notes, opening, transition "
        "and closing lines, generating likely questions, rehearsing out loud, an English script; "
        "slide layout, font and colour palette, balancing text and visuals, an academic or "
        "corporate style; and splitting into headings, building the flow, dividing slides by "
        "time, and splitting parts between speakers",
    "Charts, Diagrams & Visuals (Report & Pres.)":
        "choosing the right chart type, making a diagram, flow chart, timeline or comparison "
        "matrix; and poster titles, section layout, short texts, balancing visuals and text, and "
        "design suggestions",
    "Productivity":
        "merging the different parts you have produced and keeping the language consistent; and a "
        "weekly plan, a to do list, a deadline plan, prioritizing, and a schedule for clashing "
        "tasks",
    # DATA PROCESSING & CODING
    "Data Collection & Processing (Excel & others)":
        "deciding what data you need, listing sources, preparing a data template or dictionary, "
        "standardizing the input format; and finding missing or duplicate data, fixing format, "
        "unit, date or category errors, and standardizing column headers",
    "Data Representation (Excel & others)":
        "descriptive statistics, correlation and regression, trend analysis and outliers; and "
        "reading charts, tables and results, and styling the results",
    "Code Development & Debugging":
        "a skeleton, project structure, choosing a language or library, writing a function or "
        "algorithm, reading and writing data, plotting code; and explaining an error message, "
        "analyzing why it does not work, refactoring, line by line explanation, and adding "
        "comments",
    "Code Execution & Output Representation":
        "putting code output into words, preparing figure or table captions, the method section, "
        "and turning results into report sentences",
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
    "OE7": "Using AI for {d} increases my chances of gaining additional benefits.",
    "EOU3": "My interaction with AI for {d} is clear and understandable.",
    "EOU6": "I find AI easy to use for {d}.",
    "EOU5": "It is easy to become skillful with the AI tools I use for {d}.",
}
GENERAL_PE_EE = {
    "RA1": "Using AI lets me accomplish tasks more quickly.",
    "RA5": "Using AI increases my productivity.",
    "U6": "I find AI useful.",
    "OE7": "Using AI increases my chances of gaining additional benefits.",
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
    "ANX1": "I feel anxious about using AI.",
    "ANX3": "I hesitate to use AI for fear of making mistakes.",
    "ANX-add": "I hesitate to use AI for fear of getting recognized for using it.",
    "ANX4": "AI is somewhat intimidating to me.",
    "BI1": "I intend to use AI in the coming term.",
    "BI2": "I predict I will use AI in the coming term.",
}

# Extra constructs added on top of the UTAUT matrix, adapted from the Trust (Yuen et al. 2020)
# and Task Technology Fit (Cheng 2019) scales in the autonomous-vehicle acceptance literature
# (source/trust ttf). Only the items selected for this study are kept (Trust: TR2, TR3, TR4;
# Task Technology Fit: TTF1, TTF2, TTF4). build_section() appends them as matrix rows after the
# Excel-derived constructs, resolved per section by extra_text(). Keep text dash-free.
#
# Trust is a GENERAL construct (confidence in the AI's safety/reliability), so its wording is
# identical across all sections, like CROSS_ITEMS. Task Technology Fit is TASK-bound by definition,
# so it names the section domain via the "{d}" placeholder (filled from DOMAIN_PHRASES), exactly
# like PE_EE_TEMPLATES; the GENERAL section uses the un-named TTF_GENERAL forms. This keeps each TTF
# item relevant at every level (e.g. "fits well with my data processing and coding tasks") instead
# of being frozen to the learning/problem-solving domain.
TRUST_ITEMS = {
    "TR2": "I trust the AI tools to be safe and reliable in tackling complex or difficult tasks.",
    "TR3": "I would trust the problem solving and teaching skills of the AI tools more than the skill of the professors and/or teaching assistants.",
    "TR4": "AI tools can be trusted to carry out tasks safely (without grave errors).",
}
TTF_TEMPLATES = {
    "TTF1": "Using AI for {d} fits well with my goals and needs.",
    "TTF2": "Using AI fits well with the way I like to enhance my efficiency in {d}.",
    "TTF4": "Using AI fits well with all aspects of my {d} tasks.",
}
TTF_GENERAL = {
    "TTF1": "Using AI fits well with my academic goals and needs.",
    "TTF2": "Using AI fits well with the way I like to enhance my efficiency.",
    "TTF4": "Using AI fits well with all aspects of my academic tasks.",
}
EXTRA_CONSTRUCTS = [
    ("Trust", ["TR2", "TR3", "TR4"]),
    ("Task Technology Fit", ["TTF1", "TTF2", "TTF4"]),
]


def extra_text(code, title):
    """Resolve a Trust/TTF item for a given section (title), mirroring item_text()."""
    if code in TRUST_ITEMS:
        return TRUST_ITEMS[code]
    if code in TTF_TEMPLATES:
        if title.upper().startswith("GENERAL"):
            return TTF_GENERAL[code]
        d = DOMAIN_PHRASES.get(title)
        return TTF_TEMPLATES[code].replace("{d}", d) if d else TTF_GENERAL[code]
    return code


# Plain-language explanation shown at the top of each construct block in the matrix (statement
# column): a short title + a one-line "what this asks" note, so respondents understand the intent
# without the academic construct jargon. Keyed by the rendered (nodash) group name. Keep dash-free.
CONSTRUCT_INFO = {
    "Performance Expectancy": ("Usefulness and productivity",
        "Whether AI helps you get this work done better and faster (more done, higher quality)."),
    "Effort Expectancy": ("Ease of use",
        "How easy AI is to use and to get good at for this work."),
    "Attitude Toward Using AI": ("Attitude and enjoyment",
        "How you feel about using AI here: whether it is a good idea, interesting, and enjoyable."),
    "Social Influence": ("What people around you think",
        "Whether people who matter to you (instructors, classmates, family) think you should use AI."),
    "Facilitating Conditions": ("Resources and support",
        "Whether you have what you need to use AI: a device, internet, access, the know how, and support."),
    "Self Efficacy": ("Confidence on your own",
        "How confident you are completing a task with AI by yourself, under different conditions."),
    "Anxiety (reverse coded)": ("Worries and hesitations",
        "Worries that hold you back: making mistakes, being noticed for using AI, or feeling intimidated."),
    "Behavioral Intention": ("Plans to keep using AI",
        "Whether you intend and expect to keep using AI in the coming term."),
    "Trust": ("Trust in AI",
        "How much you trust AI to be safe, reliable, and capable for this work."),
    "Task Technology Fit": ("Fit with how you work",
        "How well AI fits your goals and the way you actually study and work in this area."),
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
            code = CODE_REMAP.get(norm(m.group(1)), norm(m.group(1)))
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
    for cname, codes in EXTRA_CONSTRUCTS:
        qs = []
        for code in codes:
            qn += 1
            qs.append({"id": "q%d" % qn, "code": code, "text": nodash(extra_text(code, title))})
        groups.append({"name": nodash(cname), "questions": qs})
    for g in groups:
        info = CONSTRUCT_INFO.get(g["name"])
        if info:
            g["title"] = nodash(info[0])
            g["help"] = nodash(info[1])
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
