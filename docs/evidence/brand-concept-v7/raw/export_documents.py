from pathlib import Path
import json,re,html,base64
import mistune
from bs4 import BeautifulSoup,NavigableString
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment
from openpyxl.utils import get_column_letter
B=Path('/home/user/rebrand');A=Path('/home/user/audit')
tasks=json.loads((B/'tasks-r7.json').read_text());p=B/'POTOLKOVO-BRAND-REDESIGN-TZ-V7.md';s=p.read_text()
if '{{TASKS}}' in s:
 chunk=''
 for t in tasks:
  chunk+=f"### {t['id']} · {t['title']}\n\n**Приоритет:** {t['priority']}. **Ответственные:** {t['owner']}. **Ориентир:** {t['days']} person-days.\n\n**Зависимости:** {t['depends']}. **Связь с v6:** {t['v6']}.\n\n**Работа:** {t['work']}\n\n**Приёмка:** {t['acceptance']}\n\n**Откат:** {t['rollback']}\n\n"
 s=s.replace('{{TASKS}}',chunk);p.write_text(s)
checks=json.loads((B/'prototype-checks.json').read_text())['summary']
render=mistune.create_markdown(plugins=['table']);markup=render(s);soup=BeautifulSoup(markup,'html.parser')
# Keep document title but give a clear branded cover.
for t in list(soup.find_all(['h1','h2','h3']))[:3]:t.decompose()
for i,t in enumerate(soup.find_all('h2')):t['id']='chapter-'+str(i)
cover='''<section class="cover"><div class="eyebrow">ПОТОЛКОВО / BRAND & DIGITAL</div><div class="pill">ТЗ V7 · КОНЦЕПЦИЯ 01</div><h1>Компания<br>в центре.<br><em>Результат —<br>в пространстве.</em></h1><p>Ребрендинг и редизайн<br>«Спокойная архитектура»</p><div class="meta">Средний+ · мастера и партнёрские бригады<br>14 октября 2026 · предложение к утверждению</div></section>'''
toc='<section class="toc"><h2>Содержание</h2>'+''.join(f'<p><a href="#{x["id"]}">{html.escape(x.get_text())}</a></p>' for x in soup.find_all('h2'))+'</section>'
css='''@page{size:A4;margin:18mm 17mm 18mm}*{box-sizing:border-box}body{font:10pt/1.47 Arial,sans-serif;color:#173c36;background:#fff;margin:0}h1,h2,h3{line-height:1.18;letter-spacing:-.025em}h2{font-size:21pt;break-after:avoid;margin-top:26px}h3{font-size:13pt;break-after:avoid;margin-top:22px}p{margin:8px 0}li{margin:5px 0}ul,ol{padding-left:20px}blockquote{padding:14px 18px;background:#ecf0e2;border-left:4px solid #8d9f60;margin:18px 0}table{border-collapse:collapse;width:100%;font-size:8.7pt;line-height:1.4;margin:15px 0}th{background:#173c36;color:white;text-align:left}th,td{padding:9px;border-bottom:1px solid #d6ded2;vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even) td{background:#f3f5ef}tr{break-inside:avoid}thead{display:table-header-group}a{color:#365f47;text-decoration:none}code{font:8.8pt monospace;background:#f1f3ec;padding:1px 3px;overflow-wrap:anywhere}hr{border:0;border-top:1px solid #d6ded2;margin:25px 0}.cover{height:255mm;position:relative;padding:13mm 5mm;break-after:page;background:#f6f5ef}.eyebrow{font-size:10pt;letter-spacing:2px;font-weight:bold}.pill{margin-top:35mm;font-size:11pt;letter-spacing:1.5px}.cover h1{font-size:43pt;line-height:1.1;margin:22px 0}.cover h1 em{font-style:normal;color:#728354}.cover p{font-size:17pt}.meta{position:absolute;bottom:14mm;font-size:10pt;line-height:1.8}.toc{break-after:page;padding:10mm 0}.toc p{margin:10px 0;font-size:11pt}#chapter-3,#chapter-6,#chapter-8,#chapter-11,#chapter-12{break-before:page}p,li{orphans:2;widows:2}@media screen{body{max-width:960px;margin:auto;padding:30px}.cover{padding:50px;height:930px}}'''
(B/'POTOLKOVO-BRAND-REDESIGN-TZ-V7.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><title>ПОТОЛКОВО — ТЗ v7</title><style>'+css+'</style><body>'+cover+toc+str(soup)+'</body></html>')
# Editable Word.
D=Document();sec=D.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.top_margin=Cm(1.8);sec.bottom_margin=Cm(1.8);sec.left_margin=Cm(1.8);sec.right_margin=Cm(1.8)
for name,size in [('Normal',10),('Title',35),('Heading 1',22),('Heading 2',14),('Heading 3',12)]:D.styles[name].font.name='Calibri';D.styles[name].font.size=Pt(size);D.styles[name].font.color.rgb=RGBColor.from_string('173C36')
D.styles['Normal'].paragraph_format.space_after=Pt(6)
header=sec.header.paragraphs[0];header.text='ПОТОЛКОВО / КОМПАНИЯ · РЕБРЕНДИНГ И РЕДИЗАЙН V7';header.style='Caption'
f=sec.footer.paragraphs[0];f.text='Концепция к утверждению · 14.10.2026                                      ';field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');f._p.append(field)
D.add_paragraph('ПОТОЛКОВО / BRAND & DIGITAL','Subtitle');D.add_paragraph('\n');D.add_paragraph('Компания в центре.\nРезультат —\nв пространстве.','Title');D.add_paragraph('Ребрендинг и редизайн · ТЗ v7\nКонцепция 01 «Спокойная архитектура»','Subtitle');D.add_paragraph('\nСредний+ · мастера и партнёрские бригады\n14 октября 2026 · предложение к утверждению');D.add_page_break()
def inline(p,node,bold=False,italic=False):
 if isinstance(node,NavigableString):
  r=p.add_run(str(node));r.bold=bold;r.italic=italic;return
 if node.name=='br':p.add_run().add_break();return
 if node.name=='code':r=p.add_run(node.get_text());r.font.name='Consolas';r.font.size=Pt(8.5);return
 for c in node.children:inline(p,c,bold or node.name in ['b','strong'],italic or node.name in ['i','em'])
def out(el):
 if isinstance(el,NavigableString):return
 if el.name in ['h2','h3','h4']:D.add_heading(el.get_text(),{'h2':1,'h3':2,'h4':3}[el.name]);return
 if el.name=='p':inline(D.add_paragraph(),el);return
 if el.name in ['ul','ol']:
  for li in el.find_all('li',recursive=False):inline(D.add_paragraph(style='List Bullet' if el.name=='ul' else 'List Number'),li)
  return
 if el.name=='table':
  rows=el.find_all('tr');n=max(len(r.find_all(['td','th'],recursive=False)) for r in rows);t=D.add_table(rows=0,cols=n);t.style='Light Shading Accent 1'
  for i,r in enumerate(rows):
   row=t.add_row()
   for j,c in enumerate(r.find_all(['td','th'],recursive=False)):
    p=row.cells[j].paragraphs[0];inline(p,c)
    for run in p.runs:run.font.size=Pt(8.5)
   if i==0:row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
   row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  D.add_paragraph();return
 if el.name=='blockquote':inline(D.add_paragraph(style='Intense Quote'),el);return
 if el.name=='hr':return
 for c in el.children:out(c)
for el in soup.children:out(el)
D.core_properties.title='ПОТОЛКОВО — ребрендинг компании и редизайн, ТЗ v7';D.core_properties.author='Проект ПОТОЛКОВО';D.save(B/'POTOLKOVO-BRAND-REDESIGN-TZ-V7.docx')
# Revised backlog: preserve source requirements, explicitly record amendments.
wb=Workbook();wb.remove(wb.active)
def sheet(name,heads,rows,widths):
 w=wb.create_sheet(name);w.append(heads)
 for r in rows:w.append(r)
 w.freeze_panes='A2';w.auto_filter.ref=w.dimensions
 for c in w[1]:c.fill=PatternFill('solid',fgColor='173C36');c.font=Font(name='Calibri',size=11,bold=True,color='FFFFFF');c.alignment=Alignment(wrap_text=True,vertical='center')
 w.row_dimensions[1].height=32
 for i,width in enumerate(widths,1):w.column_dimensions[get_column_letter(i)].width=width
 for row in w.iter_rows(min_row=2):
  for c in row:c.font=Font(name='Calibri',size=11);c.alignment=Alignment(wrap_text=True,vertical='top')
  if row[0].row%2==0:
   for c in row:c.fill=PatternFill('solid',fgColor='F1F4EA')
 return w
w=sheet('R7 Бренд и компания',['ID','Приоритет','Задача','Ответственный','Оценка person-days','Зависимости','Связь F6','Работа','Приёмка','Откат','Статус'],[[t[k] for k in ['id','priority','title','owner','days','depends','v6','work','acceptance','rollback']]+['Предложено — не внедрено'] for t in tasks],[14,23,45,36,23,46,34,80,90,65,27])
for i in range(2,w.max_row+1):w.row_dimensions[i].height=110
old=json.loads((A/'tasks.json').read_text());amend={
'001':'v7 — главный документ по бренду; v6 — технические факты. R7-001.',
'003':'Корпоративная подача не меняет прайс автоматически; сохраняется доказуемый состав. R7-006/007.',
'004':'Добавить факты о реальной команде, ответственности, контроле и гарантийном процессе. R7-002/011/014.',
'005':'Расширить на договорную модель партнёров; слово компания не создаёт юридическую форму. R7-002.',
'006':'Передача данных монтажникам, разграничение доступа и фактический оператор. R7-002/013.',
'016':'Четыре интента в корпоративных формах и новых CTA. R7-005/009.',
'017':'Новая визуальная подача не отменяет FSM/back/confirm fix. R7-009.',
'018':'Сохранить старые черновики при редизайне и смене экранов. R7-009.',
'020':'Guided flow от имени компании, без привязки ко времени и личному участию мастера. R7-009.',
'022':'Smart — направление компании, возможен сначала консультационный запуск. R7-008.',
'023':'Полный корпоративный копирайт сайта и уведомлений. R7-012.',
'024':'Перевести в P1: обязательный ребрендинг/редизайн. Портрет не главный герой. R7-003/004/006/007/015.',
'025':'Accessibility всей новой дизайн-системы, не только старых компонентов. R7-004/017.',
'026':'Форма/итог от имени компании; фактическое согласие и honest success сохранены. R7-009/012.',
'027':'Добавить назначение/роли/статусы компании. R7-013/016.',
'028':'Capacity нескольких исполнителей, резервное назначение, приёмка и сервис. R7-013/014.',
'029':'URL/SEO continuity при ребрендинге, домен сохраняется. R7-005/016.',
'030':'Дополнить визуальной регрессией и корпоративными claims. R7-017.',
'033':'Партнёры — фактическая операционная модель; внешнее привлечение отдельно после готовности.',
'036':'Раздельные флаги визуального релиза и smart commerce. R7-008/016.'}
rows=[]
for t in old:
 priority='P1' if t['id']=='F6-024' else t['priority']
 rows.append([t['id'],priority,t['title'],t['scope'],t['acceptance'],amend.get(t['id'][-3:],'Сохраняется без отмены технических требований v6.'),t['depends'],t['owner'],'Предложено — не внедрено'])
w=sheet('F6 с изменениями v7',['ID','Приоритет v7','Исходная задача','Исходная работа v6','Приёмка v6','Изменение / обязательное уточнение v7','Зависимости v6','Ответственный','Статус'],rows,[14,20,43,76,90,80,46,38,27])
for i in range(2,w.max_row+1):w.row_dimensions[i].height=135
screens=[
['S01','Главная desktop/mobile','Есть интерактивная концепция','Утверждение, реальные фото/claims, production frontend','R7-006'],
['S02','Smart-направление','Есть интерактивная концепция','Проверенные возможности и торговый режим','R7-008'],
['S03','Кейс / проект','Есть шаблон-разбор, не реальный новый кейс','Подтверждённые состав/бюджет/фото/история','R7-010'],
['S04','Компания','Блок главной и бренд-принципы','Полная страница с реальными ролями/процессом','R7-011'],
['S05','Подбор / выбор intent','4 пути в прототипе','Интеграция существующей модели и E2E','R7-009'],
['S06','Итог / контакт','Предварительная конфигурация и demo contact','Quote API, согласие, отправка, CRM','R7-009'],
['S07','9 страниц услуг','Правила в ТЗ; все 9 не отрисованы','Полные production-макеты по шаблону','R7-007'],
['S08','Каталог','Правила преемственности; новый UI не реализован','Units/stock/compatibility v6 + UI','R7-007/008'],
['S09','Error/empty/loading/stale','Требования, без полного визуального набора','Компонентная библиотека состояний','R7-004'],
['S10','Privacy/consent/legal','Требования, не юридически утверждённые тексты','Согласование специалиста','R7-002/012'],
['S11','Бренд-доска и знак','Есть концептуальный SVG и палитра','Финальные шрифт/кернинг/права/кривые','R7-003'],
['S12','Носители компании','Поставлена задача','Смета/заказ-наряд/инструкция/подписи','R7-018']]
sheet('Экраны и границы',['ID','Экран','Готово сейчас','Что ещё нужно','Задачи'],screens,[13,40,68,83,28])
gates=[['G1','Brand approval','Сообщение, аудитория, визуальное направление, роль основателя','Владелец'],['G2','Business readiness','Договорная сторона, партнёры, claims, ПДн, ответственность','Владелец + юрист'],['G3','Design approval','Все основные desktop/mobile templates и состояния','UX + владелец'],['G4','Brand release','Функции, URL/SEO, intent, формы, QA, rollback','Техлид + QA'],['G5','Smart release','Units/stock/BOM/quote/economics/bench/legal; отдельно от бренда','Инженер + владелец + техлид']]
sheet('Release gates',['ID','Gate','Обязательные условия','Ответственный'],gates,[12,24,110,40])
sheet('Как исполнять',['Правило','Содержание'],[['Документы','v7 управляет брендом/дизайном/компанией; v6 сохраняет технические факты. Не выполнять конфликтующие требования личного бренда.'],['Без дублей','R7 детализирует/расширяет указанные F6. Объединить объём и оценки, не складывать пересекающиеся задачи.'],['Статус','Концепция и проект ТЗ, не production. Внедрение отдельно после согласования.'],['Два запуска','Бренд компании отдельно от smart commerce. Не ждать полной EKS-линейки для корректной корпоративной подачи.'],['Проверка прототипа',json.dumps(checks,ensure_ascii=False)],['Дата','2026-10-14 Europe/Moscow']],[27,140])
wb.save(B/'POTOLKOVO-BACKLOG-V7.xlsx')
print('Specification and workbook exported; R7:',len(tasks),'F6:',len(old))
