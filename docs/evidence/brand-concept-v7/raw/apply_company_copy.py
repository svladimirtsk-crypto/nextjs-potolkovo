from pathlib import Path
import re
R=Path('/home/user/repo')
# Approved change of narrator, not a change of scope, arithmetic, contract fields or quotations.
words={
'работаю':'работаем','Работаю':'Работаем','делаю':'делаем','Делаю':'Делаем',
'веду':'ведём','отвечаю':'отвечаем','Отвечаю':'Отвечаем','согласовываю':'согласовываем','Согласовываю':'Согласовываем',
'фиксирую':'фиксируем','Фиксирую':'Фиксируем','подберу':'подберём','Подберу':'Подберём','покажу':'покажем','Покажу':'Покажем',
'посчитаю':'посчитаем','Посчитаю':'Посчитаем','помогу':'поможем','Помогу':'Поможем','предложу':'предложим','Предложу':'Предложим',
'расскажу':'расскажем','Расскажу':'Расскажем','уточню':'уточним','Уточню':'Уточним','перезвоню':'перезвоним','Перезвоню':'Перезвоним',
'свяжусь':'свяжемся','Свяжусь':'Свяжемся','сориентирую':'сориентируем','Сориентирую':'Сориентируем','проговорю':'проговорим',
'проверю':'проверим','Проверю':'Проверим','пришлю':'пришлём','Пришлю':'Пришлём','выезжаю':'выезжаем','Выезжаю':'Выезжаем',
'снимаю':'снимаем','Снимаю':'Снимаем','смотрю':'смотрим','Смотрю':'Смотрим','контролирую':'контролируем','Контролирую':'Контролируем',
'показываю':'показываем','Показываю':'Показываем','подбираю':'подбираем','Подбираю':'Подбираем','планирую':'планируем',
'объясняю':'объясняем','Объясняю':'Объясняем','разбираю':'разбираем','Разбираю':'Разбираем','считаю':'считаем','Считаю':'Считаем',
'выравниваю':'выравниваем','скажу':'скажем','Скажу':'Скажем','проверяю':'проверяем','Проверяю':'Проверяем',
'подскажу':'подскажем','Подскажу':'Подскажем','монтирую':'монтируем','Монтирую':'Монтируем','согласую':'согласуем','Согласую':'Согласуем',
'приезжаю':'приезжаем','Приезжаю':'Приезжаем','зафиксирую':'зафиксируем','Зафиксирую':'Зафиксируем',
'выезжаю':'выезжаем','подключаю':'подключаем','предлагаю':'предлагаем','Предлагаю':'Предлагаем',
'обсуждаю':'обсуждаем','Обсуждаю':'Обсуждаем','гарантирую':'гарантируем'
}
paths=[R/'content/homepage.ts',R/'content/services.ts',R/'content/service-facts.ts',R/'lib/calculator-flow.ts',R/'components/home/home-action.tsx']
phrases={
'Личный монтаж':'Монтаж потолков и освещения','личный монтаж':'монтаж потолков и освещения','монтаж лично':'монтаж по согласованному проекту',
'Работаю лично':'Работаем с мастерами и партнёрскими бригадами','работаю лично':'работаем с мастерами и партнёрскими бригадами',
'Лично веду объект и отвечаю за результат.':'Состав работ и условия согласовываются до монтажа.',
'Лично веду объект':'Организация работ','Личное ведение':'Согласованный состав',
'Личный контроль на каждом этапе':'Понятный порядок работ',
'Сам приезжаю на замер, согласовываю решение и контролирую монтаж на объекте.':'Уточняем условия объекта, согласовываем решение и состав монтажных работ.',
'Я лично приезжаю на замер, делаю смету и контролирую монтаж.':'Мастера и партнёрские бригады под задачи вашего объекта.',
'Работаю без посредников и “передач” объекта бригаде.':'Модель работы — мастера и партнёрские монтажные бригады.',
'Без обезличенной компании и менеджеров между нами. От замера до монтажа объект веду сам и заранее проговариваю все решения.':'ПОТОЛКОВО объединяет мастеров и партнёрские монтажные бригады. Состав и условия работ согласовываются до монтажа.',
'Я свяжусь':'Свяжемся','Я подберу':'Подберём','я зафиксирую':'зафиксируем','я выравниваю':'выравниваем',
'Перезвоню лично':'Свяжемся по заявке','Или напишите мне':'Или свяжитесь с компанией','без посредников':'по согласованному проекту'
}
for p in paths:
 s=p.read_text()
 for a,b in phrases.items():s=s.replace(a,b)
 for a,b in words.items():s=re.sub(r'(?<![А-Яа-яЁё])'+re.escape(a)+r'(?![А-Яа-яЁё])',b,s)
 p.write_text(s)
p=R/'content/homepage.ts';s=p.read_text()
s=re.sub(r'title:\n\s*"Натяжные потолки:.*?",','title:\n      "Натяжные потолки и свет: стоимость решений | ПОТОЛКОВО",',s,count=1)
s=s.replace('Лично ведём объект и отвечаем за результат.','Согласовываем состав и организуем выполнение работ.')
s=s.replace('{ label: "О мастере", targetId: "trust" }','{ label: "Компания", targetId: "trust" }').replace('      { label: "Заявка", targetId: "action" },\n','')
s=s.replace('Рассчитать за 2 минуты','Рассчитать стоимость')
s=re.sub(r'h1: "Теневые и парящие потолки под ключ.*?",','h1: "Потолок и свет, продуманные вместе.",',s,count=1)
s=s.replace('От 1 000 ₽/м² · ориентир за 2 минуты в калькуляторе · 5.0 на Avito','От аккуратного теневого примыкания до света под ваш ритм жизни. Подберём решение, согласуем состав и организуем монтаж.')
s=s.replace('factsTemplate: "5.0 на Avito · {reviews} отзывов · договор и гарантия 2 года"','factsTemplate: "Потолки и освещение · Состав и условия — до монтажа"')
s=s.replace('Владимир. 1 объект = 1 мастер, без бригад-подрядчиков','Владимир Сотниченко — основатель ПОТОЛКОВО')
s=s.replace('servicesInlineLabel: "Москва и МО · Бесплатный замер · Договор и гарантия"','servicesInlineLabel: "Натяжные потолки и освещение в Москве и Московской области"')
s=s.replace('ogImageSrc: "/optimized/og-cover-1200x630.webp"','ogImageSrc: "/brand/v7/company-og.webp"')
s=s.replace('sectionTitle: "Реальные работы, а не рендеры"','sectionTitle: "Проекты и решения"')
s=s.replace('Показываем не абстрактные картинки, а реальные объекты: тип решения, площадь, срок и ориентир по бюджету.','Примеры работ из портфолио основателя: решения, состав и расчётные ориентиры. Новые визуализации на странице отмечены отдельно.')
s=s.replace('Работаем с мастерами и партнёрскими бригадами. Отвечаем за результат.','Компания ПОТОЛКОВО: потолки и освещение')
s=s.replace('role: "Мастер по натяжным потолкам"','role: "Основатель ПОТОЛКОВО"')
s=s.replace('portraitAlt: "Владимир — мастер по натяжным потолкам"','portraitAlt: "Владимир Сотниченко — основатель ПОТОЛКОВО"')
s=s.replace('      { valueDisplay: "1 день", label: "обычный монтаж" },','      { valueDisplay: "Проект", label: "по вашей задаче" },')
s=s.replace('Без сложной бюрократии: быстро выходим на замер, согласовываем решение, фиксируем смету и делаем монтаж в согласованный день.','От обсуждения задачи до приёмки: уточняем условия объекта, согласовываем состав и организуем выполнение работ.')
s=s.replace('Обычно отвечаем быстро. Можно указать район — так проще сориентироваться по выезду.','Можно указать район и этап ремонта — это поможет подготовиться к обсуждению проекта.')
p.write_text(s)
p=R/'app/layout.tsx';s=p.read_text().replace('import "./globals.css";','import "./globals.css";\nimport "./brand.css";').replace('Личный монтаж, договор и гарантия.','Теневые и парящие потолки, световые линии, подбор освещения и монтаж.');p.write_text(s)
p=R/'components/home/hero-cta.tsx';s=p.read_text().replace('className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"','className="pk-hero-actions"').replace('className="text-center text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white sm:text-left"','className="pk-text-link"');p.write_text(s)
p=R/'components/home/home-page.tsx';s=p.read_text().replace('import { HomeHeader }','import { CompanySolutions, CompanyLighting } from "./company-solutions";\nimport { HomeHeader }',1).replace('<main>','<main className="pk-home">').replace('          <HomeProof />\n          <HomePrice />','          <CompanySolutions />\n          <HomePrice />\n          <CompanyLighting />\n          <HomeProof />');p.write_text(s)
p=R/'components/home/home-footer.tsx';s=p.read_text().replace('import { contacts','import { BrandLogo } from "@/components/brand/brand-logo";\nimport { contacts',1).replace('<footer className="border-t border-slate-200 bg-white">','<footer className="pk-footer border-t border-slate-200">');s=re.sub(r'<p className="font-mono text-sm font-bold uppercase tracking-\[0.24em\] text-slate-950">\s*\{contacts.brandName\}\s*</p>','<BrandLogo />',s);p.write_text(s)
p=R/'components/ui/button.tsx';s=p.read_text().replace('"inline-flex items-center justify-center rounded-full font-semibold"','"pk-button inline-flex items-center justify-center rounded-full font-semibold"').replace('primary — акцентный синий, а не чёрный.','R7: primary — цвет компании, задаваемый дизайн-токеном.');p.write_text(s)
p=R/'components/home/avito-reviews-section.tsx';s=p.read_text().replace('description="Реальные отзывы с Avito — 19 отзывов, рейтинг 5.0"','description="Отзывы из профиля основателя на Avito. Цитаты клиентов сохранены без изменений."');p.write_text(s)
p=R/'lib/calculator-flow.ts';s=p.read_text().replace('chips: ["Договор", "Гарантия 2 года", "Монтаж за 1 день", "Уборка после"]','chips: ["Состав сметы", "Условия до монтажа", "Потолок и свет", "Компания ПОТОЛКОВО"]');s=s.replace('"Договор, монтаж за 1 день"','"Согласование условий и даты монтажа"');p.write_text(s)
p=R/'lib/seo-schema.ts';s=p.read_text().replace('image: toAbsoluteUrl("/hero1.jpeg")','image: toAbsoluteUrl(homepage.metadata.ogImageSrc)');p.write_text(s)
p=R/'app/page.tsx';s=p.read_text().replace('alt: ogAsset?.alt ?? homepage.metadata.title','alt: "ПОТОЛКОВО — потолки и освещение. Визуализация интерьера."');s=s.replace('import { homeAssets } from "@/content/home-assets";\n','');s=re.sub(r'const ogAsset = homepage.metadata.ogImageAssetKey\n.*?\n  : null;\n\n','',s,flags=re.S);p.write_text(s)
p=R/'app/brand.css';s=p.read_text().replace('@theme inline {',':root {',1);p.write_text(s)
# The old copy test explicitly forbade the owner-approved corporate narrator.
p=R/'tests/copy-lint.test.ts';s=p.read_text();s=s.replace('«Узел», «точки», «закладные» ему ничего не говорят, а «мы подберём» от\n * мастера-одиночки звучит как обезличенная компания, от которой он как раз\n * уходит.','R7: понятный язык сохраняется. Первое лицо множественного числа теперь\n * соответствует утверждённому позиционированию компании; обещания\n * исключительного личного монтажа запрещены.');start=s.index('  { pattern: new RegExp(`${EDGE}мы');end=s.index('\n];',start);s=s[:start]+'''  {
    pattern: /(?:работаю лично|делаю сам|монтаж лично|без бригад|1 объект = 1 мастер|личное ведение)/gi,
    hint: "R7: компания и партнёрские исполнители, без обещания личного выполнения всех заказов",
  },'''+s[end:];s=s.replace('без жаргона и «мы»','без жаргона и обещаний мастера-одиночки');p.write_text(s)
# Explicit command, not expensive re-encoding on every build.
p=R/'package.json';import json
j=json.loads(p.read_text());j['scripts']['build:brand-images']='node scripts/build-brand-images.mjs';p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
print('Company copy, identity, existing functional entries updated')
