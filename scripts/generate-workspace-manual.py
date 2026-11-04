"""Build the trainer manual from the same source content as the in-app manuals."""
from pathlib import Path
from collections import OrderedDict
from html import escape
import json
import math
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreakIfNotEmpty, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Circle, Line, String, Rect, Polygon

BASE = Path(__file__).resolve().parents[1]
FRONT = BASE.parent / 'lobnos'
OUT = BASE / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)

def read_literal(file, declaration, opening, closing):
    source = (FRONT / file).read_text(encoding='utf-8')
    start = source.index(opening, source.index(declaration)) + len(opening) - 1
    end = source.index(closing, start) + 2
    return json.loads(source[start:end])

modules = read_literal('lib/workspaceLearning.ts', 'export const workspaceLearning:', ' = [', '\n];')
introductions = read_literal('lib/workspaceManual.ts', 'export const manualIntroductions:', ' = {', '\n};')

for name, file in [('Manual', 'segoeui.ttf'), ('Manual-Bold', 'segoeuib.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
pdfmetrics.registerFontFamily('Manual', normal='Manual', bold='Manual-Bold', italic='Manual', boldItalic='Manual-Bold')
green = colors.HexColor('#1b5e20')
ink = colors.HexColor('#203028')
muted = colors.HexColor('#58635c')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ManualBody', fontName='Manual', fontSize=10, leading=15.5, textColor=ink, spaceAfter=8))
styles.add(ParagraphStyle(name='ManualTitle', fontName='Manual-Bold', fontSize=34, leading=42, textColor=green, spaceAfter=22))
styles.add(ParagraphStyle(name='ManualPart', fontName='Manual-Bold', fontSize=27, leading=34, textColor=green, spaceAfter=20, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualH1', fontName='Manual-Bold', fontSize=19, leading=25, textColor=green, spaceBefore=20, spaceAfter=14, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualH2', fontName='Manual-Bold', fontSize=14, leading=20, textColor=ink, spaceBefore=17, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualH3', fontName='Manual-Bold', fontSize=10.5, leading=16, textColor=ink, spaceBefore=12, spaceAfter=5, keepWithNext=True))
styles.add(ParagraphStyle(name='ManualSmall', fontName='Manual', fontSize=8.5, leading=13, textColor=muted, spaceAfter=8))
styles.add(ParagraphStyle(name='ManualStep', parent=styles['ManualBody'], leftIndent=19, firstLineIndent=-19))
styles.add(ParagraphStyle(name='ManualExample', parent=styles['ManualBody'], backColor=colors.HexColor('#f1f6f2'), borderPadding=10, spaceBefore=5, spaceAfter=14))

def clean(text):
    return str(text).replace('→', ' / ').replace('–', '-').replace('—', '-').replace('\u2011', '-').replace('’', "'")

def para(text, style='ManualBody'):
    return Paragraph(escape(clean(text)), styles[style])

def heading(text, level, key):
    value = para(text, ['ManualH1', 'ManualH2'][min(level, 1)])
    value.toc_level = level
    value.bookmark = key
    return value

def steps(values, numbered=True):
    return [para(f'{index + 1}. {value}' if numbered else f'- {value}', 'ManualStep') for index, value in enumerate(values)]

def definitions(values):
    result=[]
    for name, meaning in values:
        result.extend([para(name, 'ManualH3'), para(meaning)])
    return result

class ManualDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark'):
            self.canv.bookmarkPage(flowable.bookmark)
            self.canv.addOutlineEntry(flowable.getPlainText(), flowable.bookmark, level=flowable.toc_level, closed=False)
            self.notify('TOCEntry', (flowable.toc_level, flowable.getPlainText(), self.page, flowable.bookmark))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#dce5de'))
    canvas.line(19*mm, 16*mm, A4[0]-19*mm, 16*mm)
    canvas.setFont('Manual', 8)
    canvas.setFillColor(muted)
    canvas.drawString(19*mm, 11*mm, 'Prime Laboratory System | User and training manual')
    canvas.drawRightString(A4[0]-19*mm, 11*mm, str(doc.page))
    canvas.restoreState()

def diagram(module_id):
    labels={
        'operations':[('Collect','specimen'),('Review','sample'),('Record','results'),('Validate','revision'),('Deliver','report')],
        'crm':[('Search','patient'),('Confirm','identity'),('Register','if needed'),('Track','visit'),('Billing','handoff')],
        'billing':[('Patient','and payer'),('Services','and prices'),('Save','bill'),('Collect','payment'),('Print','receipt')],
        'inventory':[('Request','items'),('Approve','quantity'),('Issue','stock'),('Confirm','receipt'),('Record','usage')],
    }[module_id]
    drawing=Drawing(450, 340)
    cx,cy,r=225,165,105
    drawing.add(Circle(cx,cy,r,fillColor=None,strokeColor=colors.HexColor('#d4e5d7'),strokeWidth=7))
    for index in range(4):
        previous=None
        for n in range(36):
            angle=math.radians(90-index*72-12-n*48/35)
            point=(cx+r*math.cos(angle),cy+r*math.sin(angle))
            if previous and n%4<2:drawing.add(Line(*previous,*point,strokeColor=green,strokeWidth=1.8))
            previous=point
        angle=math.radians(90-index*72-60)
        x,y=cx+r*math.cos(angle),cy+r*math.sin(angle)
        tangent=(math.sin(angle),-math.cos(angle))
        drawing.add(Polygon([x,y,x-tangent[0]*8-math.cos(angle)*4,y-tangent[1]*8-math.sin(angle)*4,x-tangent[0]*8+math.cos(angle)*4,y-tangent[1]*8+math.sin(angle)*4],fillColor=green,strokeColor=None))
    positions=[(225,310,'middle'),(350,200,'start'),(310,28,'middle'),(140,28,'middle'),(100,200,'end')]
    for index,(first,second) in enumerate(labels):
        angle=math.radians(90-index*72);x,y=cx+r*math.cos(angle),cy+r*math.sin(angle)
        drawing.add(Circle(x,y,18,fillColor=green,strokeColor=colors.white,strokeWidth=3))
        drawing.add(String(x,y-5,f'{index+1:02}',fontName='Manual-Bold',fontSize=14,fillColor=colors.white,textAnchor='middle'))
        lx,ly,anchor=positions[index]
        drawing.add(String(lx,ly,first,fontName='Manual',fontSize=10,fillColor=ink,textAnchor=anchor))
        drawing.add(String(lx,ly-14,second,fontName='Manual',fontSize=10,fillColor=ink,textAnchor=anchor))
    drawing.add(Rect(207,161,36,44,rx=5,fillColor=colors.white,strokeColor=green,strokeWidth=1.5))
    for offset in [172,182,192]:drawing.add(Line(214,offset,236,offset,strokeColor=green,strokeWidth=1.5))
    drawing.add(String(225,139,'Connected work',fontName='Manual-Bold',fontSize=12,fillColor=ink,textAnchor='middle'))
    drawing.add(String(225,122,'Trace each handoff',fontName='Manual',fontSize=9,fillColor=muted,textAnchor='middle'))
    return drawing

target=OUT/'primelabsys-operations-crm-billing-inventory-user-manual.pdf'
doc=ManualDoc(str(target),pagesize=A4,leftMargin=19*mm,rightMargin=19*mm,topMargin=20*mm,bottomMargin=22*mm,title='Prime Laboratory System - Operations, CRM, Billing and Inventory User Manual',author='Prime Laboratory System')
frame=Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id='normal',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates(PageTemplate(id='manual',frames=[frame],onPage=footer))
story=[Spacer(1,35*mm),para('PRIME LABORATORY SYSTEM','ManualH2'),para('Operations, CRM,\nBilling and Inventory\nUser Manual'.replace('\n',' '),'ManualTitle'),para('Administrator and trainer edition','ManualH1'),para('Detailed operating procedures, responsibilities, controls, worked examples and recovery.'),Spacer(1,12*mm),para('Source reviewed 4 November 2026'),para('This trainer edition includes the documented procedures for all four modules. Staff use the in-application edition filtered to their active role and enabled modules. The manual does not grant permission to perform an action.','ManualSmall'),PageBreakIfNotEmpty(),para('Contents','ManualH1')]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='TOC0',fontName='Manual-Bold',fontSize=10.5,leading=16,spaceBefore=10,textColor=green),ParagraphStyle(name='TOC1',fontName='Manual',fontSize=9.5,leading=14,leftIndent=14,spaceBefore=4,textColor=ink)]
story.extend([toc,PageBreakIfNotEmpty(),heading('How to use this manual',0,'how-to-use'),para('Begin with the relevant module introduction, its roles and operating rules. Use the numbered procedures to prepare, perform and verify each task. The controls listed in a procedure explain the screen information that must be reviewed. Worked examples are illustrative training scenarios. Use a training environment when practising transactions.'),para('This document is generated from the same procedure content used by the application manuals. The task route identifies the application page. Record-specific pages are opened from the selected record rather than by entering an invented patient or transaction reference.'),para('Procedures describe the source-reviewed implementation. Site configuration, active role, assigned record scope and financial controls affect the actions available. Live representative-user acceptance remains a separate activity.'),para('Reading conventions','ManualH2'),*definitions([('Preparation','Information and access to review before starting.'),('Controls and fields','The purpose of the relevant screen controls.'),('Steps','Actions to perform in the stated order.'),('Verification','Evidence to inspect after the save or transition.'),('Recovery','What to check before retrying or escalating an exception.')]),PageBreakIfNotEmpty()])
procedure_count=0
for part,module in enumerate(modules,1):
    intro=introductions[module['id']]
    story.extend([heading(f'Part {part}. {module["title"]}',0,module['id']),para(module['description'],'ManualH2'),para(intro['overview']),para('Audience','ManualH3'),para(intro['audience']),para('Learning objectives','ManualH2'),*steps(intro['objectives'],False),para('Roles and responsibilities','ManualH2'),*definitions(intro['roles']),para('Before you start','ManualH2'),*steps(intro['readiness']),para('Rules and controls','ManualH2'),*steps(intro['rules'],False),para('Daily operating sequence','ManualH2'),*steps(intro['daily'])])
    groups=OrderedDict()
    for article in module['articles']:groups.setdefault(article['category'],[]).append(article)
    for chapter,(category,articles) in enumerate(groups.items(),1):
        story.extend([PageBreakIfNotEmpty(),heading(f'{part}.{chapter} {category}',1,f'{module["id"]}-chapter-{chapter}')])
        for number,article in enumerate(articles,1):
            procedure_count+=1
            story.extend([para(f'{part}.{chapter}.{number} {article["title"]}','ManualH2'),para(article['concept']),para('Where to open it','ManualH3'),para(article['open']),para(article['route'],'ManualSmall')])
            if article['kind']=='workflow':story.extend([diagram(module['id'])])
            story.extend([para('Before you begin','ManualH3'),*steps(article['before'],False),para('Controls and fields','ManualH3'),*definitions([(c['name'],c['description']) for c in article['controls']]),para('Step-by-step procedure','ManualH3'),*steps(article['steps']),para('Expected outcome and verification','ManualH3'),para(article['after']),para(article['verify']),para('Worked example','ManualH3'),para('Situation. '+article['example']['situation']+' Action. '+article['example']['action']+' Expected outcome. '+article['example']['expected'],'ManualExample'),para('Troubleshooting and recovery','ManualH3'),para(article['recovery'])])
    story.extend([PageBreakIfNotEmpty(),heading(f'{part}. Glossary',1,module['id']+'-glossary'),*definitions([(entry['term'],entry['meaning']) for entry in module['glossary']]),PageBreakIfNotEmpty()])
doc.multiBuild(story)
from pypdf import PdfReader
reader=PdfReader(str(target));all_text='\n'.join(page.extract_text() or '' for page in reader.pages)
assert len(reader.pages)>10
assert all(article['title'] in all_text or clean(article['title']) in all_text for module in modules for article in module['articles'])
assert '\ufffd' not in all_text
summary={'file':str(target),'pages':len(reader.pages),'procedures':procedure_count,'words':len(all_text.split()),'modules':{module['id']:len(module['articles']) for module in modules}}
validation_dir = BASE / 'tmp/pdfs'
validation_dir.mkdir(parents=True, exist_ok=True)
(validation_dir/'manual-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
