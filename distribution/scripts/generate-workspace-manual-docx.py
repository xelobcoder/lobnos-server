"""Build the editable trainer manual from the same content as the PDF manual."""
from collections import OrderedDict
from pathlib import Path
import json

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

BASE = Path(__file__).resolve().parents[1]
FRONT = BASE.parent / "lobnos"
OUTPUT = BASE / "output/docx"
OUTPUT.mkdir(parents=True, exist_ok=True)
TARGET = OUTPUT / "primelabsys-operations-crm-billing-inventory-user-manual.docx"


def read_literal(file, declaration, opening, closing):
    source = (FRONT / file).read_text(encoding="utf-8")
    start = source.index(opening, source.index(declaration)) + len(opening) - 1
    end = source.index(closing, start) + 2
    return json.loads(source[start:end])


modules = read_literal("lib/workspaceLearning.ts", "export const workspaceLearning:", " = [", "\n];")
introductions = read_literal("lib/workspaceManual.ts", "export const manualIntroductions:", " = {", "\n};")
software = read_literal("lib/softwareManualOverview.ts", "export const softwareManualOverview:", " = {", "\n};")
modules.sort(key=lambda module: ["crm", "billing", "operations", "inventory"].index(module["id"]))

GREEN = "1B5E20"
INK = "203028"
MUTED = "58635C"
PALE_GREEN = "E8F1E9"


def clean(value):
    return str(value).replace("→", " / ").replace("–", "-").replace("—", "-").replace("\u2011", "-").replace("’", "'").replace("“", '"').replace("”", '"')


def set_cell_shading(cell, fill):
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    properties.append(shading)


def repeat_table_header(row):
    properties = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    properties.append(header)


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    value = OxmlElement("w:t")
    value.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for element in (begin, instruction, separate, value, end):
        run._r.append(element)


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.7)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)

normal = doc.styles["Normal"]
normal.font.name = "Segoe UI"
normal.font.size = Pt(9)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_after = Pt(5)
for style_name, size, color in [
    ("Title", 30, GREEN),
    ("Heading 1", 19, GREEN),
    ("Heading 2", 14, INK),
    ("Heading 3", 10.5, INK),
]:
    style = doc.styles[style_name]
    style.font.name = "Segoe UI"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)

header = section.header.paragraphs[0]
header.text = "PRIME LABORATORY SOFTWARE (PLS)  |  USER AND TRAINING MANUAL"
header.style = doc.styles["Caption"]
footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run("Prime Laboratory Software  |  ")
add_page_field(footer)


def paragraph(text="", style=None, bold_label=None):
    item = doc.add_paragraph(style=style)
    if bold_label and text.startswith(bold_label):
        item.add_run(bold_label).bold = True
        item.add_run(text[len(bold_label):])
    else:
        item.add_run(clean(text))
    return item


def bullet_list(values):
    for value in values:
        paragraph(clean(value), "List Bullet")


def numbered_list(values):
    for value in values:
        paragraph(clean(value), "List Number")


def add_table(headers, rows, font_size=8):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    table.autofit = True
    repeat_table_header(table.rows[0])
    for index, value in enumerate(headers):
        cell = table.rows[0].cells[index]
        cell.text = clean(value)
        set_cell_shading(cell, PALE_GREEN)
        for run in cell.paragraphs[0].runs:
            run.bold = True
            run.font.color.rgb = RGBColor.from_string(GREEN)
            run.font.size = Pt(font_size)
    for row in rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = clean(value)
            cells[index].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            for item in cells[index].paragraphs:
                item.paragraph_format.space_after = Pt(2)
                for run in item.runs:
                    run.font.size = Pt(font_size)
    doc.add_paragraph()
    return table


def definitions(values):
    add_table(["Item", "Description"], values)


def add_image(image_path, caption, callouts=None):
    image_path = Path(image_path)
    if not image_path.is_file():
        paragraph(f"[Figure pending: {caption}]")
        return
    doc.add_picture(str(image_path), width=Inches(6.2))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph(caption, "Caption")
    if callouts:
        numbered_list([callout["label"] for callout in callouts])


def add_pilot(pilot):
    paragraph("Enhanced training procedure", "Heading 3")
    paragraph(pilot["status"])
    paragraph("Reviewed " + pilot["reviewedAt"], "Caption")
    paragraph("Checks completed", "Heading 3")
    bullet_list(pilot["checked"])
    paragraph("Still to verify", "Heading 3")
    bullet_list(pilot["pending"])
    for shot in pilot["screenshots"]:
        add_image(FRONT / "public/manuals/pilots" / shot["file"], shot["caption"], shot["callouts"])
    paragraph("Field rules and common mistakes", "Heading 3")
    for field in pilot["fields"]:
        paragraph(field["name"], "Heading 3")
        paragraph(field["rule"])
        paragraph("Check: " + field["mistake"], "Caption")
    paragraph("Independent practice and pass criteria", "Heading 3")
    paragraph(pilot["exercise"])
    paragraph("Record the facility, branch, role, date, saved references and observed outcome. Review unresolved checks with your trainer before working independently.")


def add_test_panel(article):
    procedure = article["procedure"]
    paragraph(procedure["id"] + " - " + article["title"], "Heading 2")
    paragraph("Purpose: " + article["purpose"], bold_label="Purpose:")
    paragraph("Who can do this?", "Heading 3")
    add_table(["Role", "What you can do"], [(row["role"], row["permissions"]) for row in procedure["roles"]])
    paragraph("Before you begin", "Heading 3")
    bullet_list(article["before"])
    paragraph("Where to go", "Heading 3")
    paragraph(article["open"])
    paragraph("Important", "Heading 3")
    bullet_list(procedure["warnings"])
    paragraph("Steps", "Heading 3")
    numbered_list(article["steps"])
    paragraph("Fields", "Heading 3")
    add_table(
        ["Field", "Required?", "What to enter", "Validation / dependencies"],
        [(row["field"], row["required"], row["entry"], row["validation"]) for row in procedure["fields"]],
        font_size=7,
    )
    paragraph("Expected result", "Heading 3")
    paragraph(procedure["expectedResult"])
    paragraph("Other ways to proceed", "Heading 3")
    bullet_list(procedure["alternatives"] or ["None."])
    paragraph("Common problems", "Heading 3")
    add_table(["Message or symptom", "Cause", "What to do"], [(row["symptom"], row["cause"], row["fix"]) for row in procedure["commonErrors"]])
    paragraph("Related procedures", "Heading 3")
    bullet_list(procedure["related"] or ["None."])
    paragraph("Figures", "Heading 3")
    bullet_list([f'{row["figure"]} pending: {row["screen"]}. State: {row["state"]} Data/access needed: {row["dataNeeded"]}' for row in procedure["screenshotsPending"]])
    for subsection in article.get("sections", []):
        paragraph(subsection["title"], "Heading 3")
        for text in subsection["paragraphs"]:
            paragraph(text)
        if subsection.get("steps"):
            numbered_list(subsection["steps"])
        for table in subsection.get("tables", []):
            paragraph(table["caption"], "Caption")
            add_table(table["headers"], table["rows"], font_size=7)
        if subsection.get("checklist"):
            bullet_list(subsection["checklist"])


def add_procedure(article, module_id):
    paragraph(article["concept"])
    paragraph("Where to open it", "Heading 3")
    paragraph(article["open"])
    if article.get("pilot"):
        add_pilot(article["pilot"])
    if article["kind"] == "workflow":
        flow = {
            "operations": "Collect specimen  →  Review sample  →  Record results  →  Validate revision  →  Deliver report",
            "crm": "Search patient  →  Confirm identity  →  Register if needed  →  Track visit  →  Billing handoff",
            "billing": "Patient and payer  →  Services and prices  →  Save bill  →  Collect payment  →  Print receipt",
            "inventory": "Request items  →  Approve quantity  →  Issue stock  →  Confirm receipt  →  Record usage",
        }[module_id]
        paragraph(flow, "Caption")
    paragraph("Before you begin", "Heading 3")
    bullet_list(article["before"])
    paragraph("Controls and fields", "Heading 3")
    definitions([(control["name"], control["description"]) for control in article["controls"]])
    paragraph("Step-by-step procedure", "Heading 3")
    numbered_list(article["steps"])
    for subsection in article.get("sections", []):
        paragraph(subsection["title"], "Heading 3")
        for text in subsection["paragraphs"]:
            paragraph(text)
        if subsection.get("checklist"):
            bullet_list(subsection["checklist"])
    paragraph("Expected outcome and verification", "Heading 3")
    paragraph(article["after"])
    paragraph(article["verify"])
    paragraph("Worked example", "Heading 3")
    paragraph(
        "Situation. " + article["example"]["situation"] +
        " Action. " + article["example"]["action"] +
        " Expected outcome. " + article["example"]["expected"]
    )
    paragraph("Troubleshooting and recovery", "Heading 3")
    paragraph(article["recovery"])
    if article["related"]:
        paragraph("Related procedures", "Heading 3")
        bullet_list([next(item["title"] for item in module_articles if item["slug"] == slug) for slug in article["related"]])


# Cover and navigable contents.
paragraph("PRIME LABORATORY SOFTWARE (PLS)", "Heading 2")
paragraph("Front Desk, Billing, Laboratory and Inventory User Manual", "Title")
paragraph("Administrator and trainer edition", "Heading 1")
paragraph("Detailed operating procedures, responsibilities, controls, worked examples and recovery.")
paragraph("Application version 1.0.0")
paragraph("This trainer edition includes the documented procedures for all four modules. Staff use the in-application edition filtered to their active role and enabled modules. The manual does not grant permission to perform an action.")
paragraph("Contents", "Heading 1")
contents = doc.add_paragraph()
field = OxmlElement("w:fldSimple")
field.set(qn("w:instr"), 'TOC \\o "1-3" \\h \\z \\u')
contents._p.append(field)
paragraph("To populate or refresh the table of contents, open the document in Word, select the contents area, and choose Update Field.")
doc.add_page_break()

paragraph(software["title"], "Heading 1")
paragraph(software["purpose"])
paragraph("Our operating philosophy", "Heading 2")
definitions(software["philosophy"])
paragraph("How PLS supports the organization", "Heading 2")
definitions(software["organizationalValue"])
paragraph("Modules and manual coverage", "Heading 2")
paragraph("Only enabled modules and permitted actions appear in your workspace. This overview does not grant access.")
for title, purpose, coverage in software["modules"]:
    paragraph(title, "Heading 3")
    paragraph(purpose)
    paragraph("Manual coverage: " + coverage, "Caption")
for figure in software.get("figures", []):
    add_image(FRONT / "public/manuals/pilots" / figure["file"], figure["caption"], figure["callouts"])
paragraph("How work moves between teams", "Heading 2")
for actor, action, evidence in software["journey"]:
    paragraph(actor, "Heading 3")
    paragraph(action)
    paragraph("Handoff evidence: " + evidence, "Caption")
paragraph("Recommended learning sequence", "Heading 2")
numbered_list(software["readingOrder"])
paragraph("Scope of this edition", "Heading 2")
paragraph(software["scope"])
doc.add_page_break()

paragraph("How to use this manual", "Heading 1")
paragraph("Begin with the relevant module introduction, its roles and operating rules. Use the numbered procedures to prepare, perform and verify each task. The controls listed in a procedure explain the screen information that must be reviewed. Worked examples are illustrative training scenarios. Use a training environment when practising transactions.")
paragraph("This document is generated from the same procedure content used by the application manuals. Five enhanced pilot procedures include field rules, original application screenshots where captured, worked examples and explicit verification status. Other procedures remain reference material awaiting equivalent live walkthroughs. Record-specific pages are opened from the selected record.")
paragraph("Procedures describe the source-reviewed implementation. Site configuration, active role, assigned record scope and financial controls affect the actions available. Live representative-user acceptance remains a separate activity.")
paragraph("Reading conventions", "Heading 2")
definitions([
    ("Preparation", "Information and access to review before starting."),
    ("Controls and fields", "The purpose of the relevant screen controls."),
    ("Steps", "Actions to perform in the stated order."),
    ("Verification", "Evidence to inspect after the save or transition."),
    ("Recovery", "What to check before retrying or escalating an exception."),
])
paragraph("First sign-in and finding your workspace", "Heading 2")
numbered_list([
    "Open the facility application address supplied by your administrator and sign in using your assigned credentials. Confirm the facility, branch and active role shown in the application.",
    "Open the relevant module from the sidebar. Open its Learning Center to find the online manual and searchable guides. If a module or action is missing, ask an authorized administrator to review your access and the enabled facility modules.",
    "Use the named sidebar menus and selected record to reach the page. Menu availability depends on your active role and enabled modules. The PDF does not assume a shared production address.",
    "For practice, use a designated training environment and fictional patient or document data. Confirm that you are in that environment before saving or collecting money.",
])
paragraph("When an action fails", "Heading 2")
numbered_list([
    "Read the message and check the current patient, document, branch, active role and required fields.",
    "After an uncertain response, reopen or reload the saved record and inspect its history or reference before retrying. A repeated payment, stock issue or clinical save can create conflicting work.",
    "If another user changed the record, reload it and review the current values before submitting again.",
    "If the problem persists, give support the page, document reference, action, time and exact error. Use your approved support channel for patient details and omit passwords, session tokens and API keys.",
])
doc.add_page_break()

procedure_count = 0
for part, module in enumerate(modules, 1):
    module_articles = module["articles"]
    intro = introductions[module["id"]]
    doc.add_page_break()
    paragraph(f'Part {part}. {module["title"]}', "Heading 1")
    paragraph(module["description"], "Heading 2")
    paragraph(intro["overview"])
    paragraph("Audience", "Heading 3")
    paragraph(intro["audience"])
    paragraph("Learning objectives", "Heading 2")
    bullet_list(intro["objectives"])
    paragraph("Roles and responsibilities", "Heading 2")
    definitions(intro["roles"])
    paragraph("Before you start", "Heading 2")
    bullet_list(intro["readiness"])
    paragraph("Rules and controls", "Heading 2")
    bullet_list(intro["rules"])
    paragraph("Daily operating sequence", "Heading 2")
    numbered_list(intro["daily"])
    for subsection in intro.get("sections", []):
        paragraph(subsection["title"], "Heading 2")
        for text in subsection["paragraphs"]:
            paragraph(text)
        paragraph("Staff check", "Heading 3")
        bullet_list(subsection["checklist"])
    paragraph("Recommended learning order", "Heading 2")
    numbered_list([next(article["title"] for article in module_articles if article["slug"] == slug) for slug in module["startPath"]])
    groups = OrderedDict()
    for article in module_articles:
        groups.setdefault(article["category"], []).append(article)
    for chapter, (category, articles) in enumerate(groups.items(), 1):
        doc.add_page_break()
        paragraph(f"{part}.{chapter} {category}", "Heading 2")
        for number, article in enumerate(articles, 1):
            procedure_count += 1
            paragraph(f'{part}.{chapter}.{number} {article["title"]}', "Heading 3")
            if article.get("procedure"):
                add_test_panel(article)
            else:
                add_procedure(article, module["id"])
        doc.add_page_break()
    paragraph(f"{part}. Practice and competency check", "Heading 2")
    paragraph("Work through the recommended learning order in the training environment. Use the worked examples in each procedure and record the saved references so that you can verify each handoff.")
    paragraph("Independent practice", "Heading 3")
    numbered_list([
        "Confirm the correct branch and active role, then locate the relevant record and identify its current status.",
        "Explain the prerequisites, required fields and responsible person before taking an action.",
        "Follow the procedure and inspect its expected outcome and verification evidence.",
        "Follow the next handoff with the appropriate authorized training account. Confirm that the same patient, bill or stock reference is carried forward.",
        "Use the troubleshooting instructions for a missing prerequisite or changed record. Explain how you would check whether an uncertain save already succeeded.",
    ])
    paragraph("Completion checklist", "Heading 3")
    bullet_list([
        "I can locate each task required for my assigned duties using the sidebar and guide contents.",
        "I can explain the distinction between saving, reviewing, approving and completing the relevant transaction.",
        "I can demonstrate the recorded evidence described in the verification section.",
        "I know when to stop, reload, seek authorized review or contact support.",
        "I have recorded any unresolved training questions and the responsible person for follow-up.",
    ])
    paragraph(f"{part}. Glossary", "Heading 2")
    definitions([(entry["term"], entry["meaning"]) for entry in module["glossary"]])
    doc.add_page_break()

doc.core_properties.title = "Prime Laboratory Software - Front Desk, Billing, Laboratory and Inventory User Manual"
doc.core_properties.subject = "Administrator and trainer edition, application version 1.0.0"
doc.core_properties.author = "Prime Laboratory Software"
doc.core_properties.keywords = "Prime Laboratory Software, PLS, user manual, operations"
doc.save(TARGET)

# Reopen the generated package to catch invalid DOCX output and verify key manual content.
check = Document(TARGET)
all_text = "\n".join(paragraph.text for paragraph in check.paragraphs)
all_text += "\n" + "\n".join(cell.text for table in check.tables for row in table.rows for cell in row.cells)
panel = next(article for module in modules for article in module["articles"] if article["slug"] == "test-panel-setup")
assert procedure_count == sum(len(module["articles"]) for module in modules)
assert panel["procedure"]["id"] in all_text
assert "Test Fields plans: purpose, configuration, and safe example" in all_text
assert "Critical-value actions and what each selection controls" in all_text
assert "Legacy means the older single-range setup" in all_text
assert "live system (sometimes called production)" in all_text
assert "Hold electronic delivery and portal release" in all_text
assert len(check.tables) > 20
print(json.dumps({
    "file": str(TARGET),
    "procedures": procedure_count,
    "tables": len(check.tables),
    "paragraphs": len(check.paragraphs),
    "bytes": TARGET.stat().st_size,
}, indent=2))
