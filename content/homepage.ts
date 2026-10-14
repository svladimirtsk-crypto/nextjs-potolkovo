import {
  buildProofBudgetBreakdown,
  toProofPriceLabel,
  type HomeCalculatorConfig,
} from "@/lib/home-proof-pricing";

const homeCalculator: HomeCalculatorConfig = {
  areaMin: 1,
  areaMax: 1000,
  areaStep: 1,
  areaDefault: 1,
  perimeterHintMinMultiplier: 4,
  perimeterHintMaxMultiplier: 4.5,
  specialMeters: { min: 1, max: 150, step: 1 },
  corniceMeters: { min: 1, max: 50, step: 1, default: 2 },
  lightLineMeters: { min: 1, max: 50, step: 1, default: 2 },
  trackMeters: { min: 1, max: 50, step: 1, default: 2 },
  baseDescription: "Базовая стоимость простого потолка — от 1 000 ₽ / м²",
  ceilingTypes: [
    { slug: "standard", label: "Простой потолок", baseRatePerSqm: 1000, extraLabel: null, extraRatePerMeter: 0 },
    { slug: "shadow", label: "Теневой потолок", baseRatePerSqm: 800, extraLabel: "Теневой профиль", extraRatePerMeter: 950 },
    { slug: "floating", label: "Парящий потолок", baseRatePerSqm: 800, extraLabel: "Парящий профиль", extraRatePerMeter: 2500 },
  ],
  cornices: [
    { slug: "none", label: "Без карниза", ratePerMeter: 0 },
    { slug: "built-in", label: "Встроенный карниз", ratePerMeter: 4500 },
    { slug: "hidden-niche", label: "Скрытая ниша", ratePerMeter: 1800 },
    { slug: "surface", label: "Накладной карниз", ratePerMeter: 1000 },
  ],
  lightLines: { label: "Световые линии", ratePerMeter: 3500 },
  tracks: [
    { slug: "none", label: "Без трека", ratePerMeter: 0 },
    { slug: "built-in", label: "Встроенный трек", ratePerMeter: 2500 },
    { slug: "surface", label: "Накладной трек", ratePerMeter: 1500 },
  ],
  lights: {
    label: "Светильники",
    ratePerUnit: 750,
    countMin: 1,
    countMax: 40,
    countStep: 1,
    countDefault: 6,
  },
  corniceLighting: {
    label: "Подсветка карниза или ниши",
    ratePerMeter: 1500,
    powerSupplyLabel: "Блок питания подсветки",
    powerSupplyRate: 1500,
    powerSupplyDefault: 1,
  },
  chandeliers: {
    label: "Установка люстр",
    ratePerUnit: 1000,
    countMin: 1,
    countMax: 10,
    countStep: 1,
    countDefault: 1,
  },
} as const;

const proofBudgetCase1 = buildProofBudgetBreakdown(homeCalculator, {
  area: 18,
  ceilingType: "shadow",
  shadowMeters: 19,
  trackInstallType: "built-in",
  trackInstallMeters: 10,
  lightingTrackProfileSystem: "COLIBRI_220",
  lightingTrackProfileMeters: 10,
  lightingFixtures: [
    { vendorCode: "0У-00002000", qty: 4 },
    { vendorCode: "0У-00002003", qty: 2 },
  ],
});

const proofBudgetCase2 = buildProofBudgetBreakdown(homeCalculator, {
  area: 48,
  ceilingType: "floating",
  floatingMeters: 38,
  lightLineMeters: 10,
  corniceType: "built-in",
  corniceMeters: 8,
  trackInstallType: "built-in",
  trackInstallMeters: 8,
  lightingTrackProfileSystem: "COLIBRI_220",
  lightingTrackProfileMeters: 8,
  lightingFixtures: [{ vendorCode: "0У-00001339", qty: 6 }],
  customCharges: [
    {
      label: `${homeCalculator.corniceLighting.label} · 5 м.п.`,
      amountRub: 5 * homeCalculator.corniceLighting.ratePerMeter,
    },
    {
      label: `${homeCalculator.corniceLighting.powerSupplyLabel} · 1 шт.`,
      amountRub: homeCalculator.corniceLighting.powerSupplyRate,
    },
  ],
});

export const homepage = {
  metadata: {
    title:
      "Натяжные потолки и свет: стоимость решений | ПОТОЛКОВО",
    description:
      "Натяжные потолки в Москве и Московской области. Теневой профиль, парящие потолки, световые линии, трековое освещение, скрытые карнизы. Монтаж потолков и освещения, договор и гарантия, бесплатный замер.",
    canonicalPath: "/",
    ogTitle: "ПОТОЛКОВО — натяжные потолки в Москве и МО",
    ogDescription:
      "Современные натяжные потолки: теневой профиль, парящие, световые линии, треки и скрытые карнизы. Состав работ и условия согласовываются до монтажа.",
    ogImageAssetKey: "hero-after",
    /**
     * N-062 (F-30): отдельный кадр 1200×630 под соцсети. Раньше в og уходил
     * hero1.jpeg — 752 КБ и пропорции 3:2, которые соцсети обрезают по центру.
     * Собирается `scripts/build-og-image.mjs`.
     */
    ogImageSrc: "/brand/v7/company-og.webp",
    ogImageWidth: 1200,
    ogImageHeight: 630,
    robots: "index, follow",
  },

  header: {
    navItems: [
      { label: "Работы", targetId: "proof" },
      { label: "Цена", targetId: "price" },
      { label: "Компания", targetId: "trust" },
    ],
    servicesMenuLabel: "Услуги",
    // T-040: primary хедера ведёт в калькулятор, замер остаётся телефоном рядом.
    primaryCtaLabel: "Рассчитать стоимость",
    mobileMenuLabel: "Открыть меню",
    phoneLabelPrefix: "Позвонить",
  },

  hero: {
    mode: "static",
    // T-040: тексты раздела 6.2 ТЗ. Один primary CTA, один подзаголовок.
    h1: "Потолок и свет, продуманные вместе.",
    subtitle:
      "От аккуратного теневого примыкания до света под ваш ритм жизни. Подберём решение, согласуем состав и организуем монтаж.",
    primaryCtaLabel: "Рассчитать стоимость",
    secondaryCtaLabel: "Записаться на замер",
    /** Строка фактов под CTA. `{reviews}` подставляется из профиля Avito. */
    factsTemplate: "Потолки и освещение · Состав и условия — до монтажа",
    portraitAssetKey: "vladimir-portrait",
    portraitCaption: "Владимир Сотниченко — основатель ПОТОЛКОВО",
    servicesInlineLabel: "Натяжные потолки и освещение в Москве и Московской области",
    heroAfterAssetKey: "hero-after",
  },

  proof: {
    sectionTitle: "Проекты и решения",
    sectionIntro:
      "Примеры работ из портфолио основателя: решения, состав и расчётные ориентиры. Новые визуализации на странице отмечены отдельно.",
    cardCtaLabel: "Хочу так же",
    items: [
      {
        slug: "shadow-track-apartment",
        title: "Теневой профиль + трековое освещение COLIBRI",
        serviceType: "Теневой профиль и трековое освещение",
        roomType: "Кухня-гостиная",
        addressLabel: "Частный дом · Видное",
        summary:
          "Нужно было сделать теневой потолок и современное решение по освещению без визуального шума.",
        challenge:
          "Заказчик хотел теневой потолок и современную систему направленного света для кухни-гостиной в частном доме.",
        workDone:
          "Установлен теневой профиль Flexy и трековая система COLIBRI с магнитными SMART-светильниками, которые подключаются к системе Умный Дом.",
        configurationLines: [
          "Площадь потолка: 18 м²",
          "Теневой профиль: 19 м.п.",
          "Встроенный трек в потолке: 10 м.п.",
          "Профиль COLIBRI: 10 м.п.",
          "Светильники 0У-00002000: 4 шт.",
          "Светильники 0У-00002003: 2 шт.",
        ],
        scopeLabel: "Расчёт по помещению",
        areaLabel: "18 м²",
        timelineLabel: "1 день",
        priceLabel: toProofPriceLabel(proofBudgetCase1),
        budgetBreakdown: proofBudgetCase1,
        imageAssetKey: "proof-01",
        alt: "Теневой профиль и трековое освещение в частном доме в Видном",
        budgetNote: "Цена включает потолок, трековый комплект и скидку −25% на свет с потолком.",
        ctaLabel: "Хочу похожее решение",
        actionTargetId: "action",
        actionPreset: {
          ceilingType: "shadow",
          calculationScopeDefault: "room",
          roomLabelDefault: "Кухня-гостиная",
          areaDefault: 18,
          shadowLengthDefault: 19,
          trackType: "built-in",
          trackLengthDefault: 10,
          introNote: "Стартовые параметры загружены по этому кейсу. Проверьте площадь и скорректируйте метры только на нужных участках.",
        },
      },
      {
        slug: "floating-led-living-room",
        title: "Парящий профиль, линии, трек и карниз",
        serviceType: "Парящий потолок, линии, трек и встроенный карниз",
        roomType: "Прихожая, гостиная и комната",
        addressLabel: "Частный дом · Дмитровское шоссе, МО",
        summary:
          "Комплексный проект с парящим профилем, световыми линиями, встроенными карнизами и трековой системой COLIBRI.",
        challenge:
          "Нужно было подсветить декоративную панель в прихожей, сделать основной свет в гостиной и собрать в спальне современную трековую систему с управлением через Умный Дом.",
        workDone:
          "Собран парящий потолок по ключевым участкам, добавлены световые линии, встроенный карниз с подсветкой и без неё, а также встроенная трековая система COLIBRI.",
        configurationLines: [
          "Площадь потолков: 48 м²",
          "Парящий профиль: 38 м.п.",
          "Световые линии: 10 м.п.",
          "Встроенный карниз: 8 м.п. (5 м с подсветкой, 3 м без)",
          "Встроенный трек в потолке: 8 м.п.",
          "Профиль COLIBRI: 8 м.п.",
          "Светильники 0У-00001339: 6 шт.",
          "Блок питания подсветки карниза: 1 шт.",
        ],
        scopeLabel: "Расчёт по объекту",
        areaLabel: "48 м²",
        timelineLabel: "3 дня",
        priceLabel: toProofPriceLabel(proofBudgetCase2),
        budgetBreakdown: proofBudgetCase2,
        imageAssetKey: "proof-02",
        alt: "Парящий потолок, световые линии и трековое освещение в частном доме в Московской области",
        budgetNote: "Цена включает потолок, карнизную нишу, трековый комплект и скидку −25% на свет с потолком.",
        ctaLabel: "Хочу похожее решение",
        actionTargetId: "action",
        actionPreset: {
          ceilingType: "floating",
          calculationScopeDefault: "object",
          areaDefault: 48,
          floatingLengthDefault: 38,
          lightLinesEnabled: true,
          lightLinesLengthDefault: 10,
          corniceType: "built-in",
          corniceLengthDefault: 8,
          corniceLightingEnabled: true,
          corniceLightingLengthDefault: 5,
          corniceLightingPowerSuppliesDefault: 1,
          trackType: "built-in",
          trackLengthDefault: 8,
          introNote: "Стартовые параметры загружены по этому объекту. Площадь считается отдельно, а парящий профиль, карнизы и трек — только по фактическим метрам участков.",
        },
      },
      {
        slug: "light-lines-office",
        title: "Световые линии",
        serviceType: "Световые линии",
        roomType: "Офис",
        summary:
          "Геометричный встроенный свет вместо стандартных светильников с расчётом освещённости.",
        areaLabel: "40 м²",
        timelineLabel: "1 день",
        priceLabel: "от 80 000 ₽",
        imageAssetKey: "proof-03",
        alt: "Световые линии в натяжном потолке в офисном пространстве",
        ctaLabel: "Хочу так же",
        actionTargetId: "action",
        actionPreset: { ceilingType: "standard" },
      },
      {
        slug: "hidden-cornice-flat",
        title: "Скрытый карниз",
        serviceType: "Скрытый карниз",
        roomType: "Квартира",
        summary:
          "Шторы идут от потолка без видимого карниза и лишних накладок.",
        areaLabel: "20 м²",
        timelineLabel: "1 день",
        priceLabel: "от 25 000 ₽",
        imageAssetKey: "proof-04",
        alt: "Скрытый карниз в натяжном потолке в жилом интерьере",
        ctaLabel: "Хочу так же",
        actionTargetId: "action",
        actionPreset: { ceilingType: "standard", corniceType: "hidden-niche" },
      },
      {
        slug: "matte-apartment",
        title: "Матовый потолок",
        serviceType: "Простой матовый потолок",
        roomType: "Квартира",
        summary:
          "Ровная спокойная поверхность без лишних деталей — быстрое и аккуратное решение для жилых комнат.",
        areaLabel: "45 м²",
        timelineLabel: "1 день",
        priceLabel: "от 45 000 ₽",
        imageAssetKey: "proof-05",
        alt: "Белый матовый натяжной потолок в квартире",
        ctaLabel: "Хочу так же",
        actionTargetId: "action",
        actionPreset: { ceilingType: "standard" },
      },
      {
        slug: "custom-dome",
        title: "Индивидуальный проект",
        serviceType: "Сложная геометрия и подсветка",
        roomType: "Нестандартный интерьер",
        summary:
          "Объёмная форма, сложная геометрия и кастомная подсветка под конкретный проект.",
        areaLabel: "18 м²",
        timelineLabel: "4 дня",
        priceLabel: "от 300 000 ₽",
        imageAssetKey: "proof-06",
        alt: "Индивидуальный проект натяжного потолка со сложной геометрией",
        ctaLabel: "Обсудить проект",
        actionTargetId: "action",
      },
    ],
  },

  price: {
    sectionTitle: "Быстрый ориентир по цене",
    sectionIntro:
      "Выберите площадь и нужные параметры. После расчёта потолка освещение в каталоге будет со скидкой 25%, а точную смету зафиксируем после замера.",
    includedLine:
      "Это ориентировочный расчёт для понимания бюджета. Итоговая смета фиксируется после осмотра помещения и согласования решения.",
    fixedPriceNote: " ",
    noExtraChargeNote: " ",
    primaryCtaLabel: "Записаться на бесплатный замер",
    calculator: homeCalculator,
  },

  trust: {
    sectionTitle: "Компания ПОТОЛКОВО: потолки и освещение",
    sectionIntro:
      "ПОТОЛКОВО объединяет мастеров и партнёрские монтажные бригады. Состав и условия работ согласовываются до монтажа.",

    founder: {
      portraitAssetKey: "vladimir-portrait",
      portraitAlt: "Владимир Сотниченко — основатель ПОТОЛКОВО",
      role: "Основатель ПОТОЛКОВО",
      name: "Владимир",
      responsibilityLine:
        "Мастера и партнёрские бригады под задачи вашего объекта.",
      specializationLine:
        "Теневой профиль, парящие потолки, световые линии, треки и скрытые карнизы.",
      bioLines: [
        "Модель работы — мастера и партнёрские монтажные бригады.",
        "Согласовываем решения заранее и фиксируем смету до старта работ.",
      ],
      microproofLines: ["Договор и гарантия", "Москва и МО", "Замер бесплатно"],
    },

    bullets: [
      {
        title: "Понятный порядок работ",
        description:
          "Уточняем условия объекта, согласовываем решение и состав монтажных работ.",
      },
      {
        title: "Прозрачная смета до старта работ",
        description:
          "Фиксируем объем, материалы и стоимость заранее, без скрытых доплат после начала монтажа.",
      },
      {
        title: "Понятные сроки",
        description:
          "Согласовываем удобную дату монтажа и соблюдаем договоренности по времени.",
      },
      {
        title: "Договор и гарантия",
        description:
          "Оформляем документы официально, чтобы у вас были понятные обязательства и гарантия на результат.",
      },
    ],

    externalRatingLabel: "Отзывы",
    externalRatingValue: null,
    externalRatingSource: null,
    externalRatingUrl: null,

    stats: [
      { valueDisplay: "Проект", label: "по вашей задаче" },
      { valueDisplay: "Замер", label: "бесплатно" },
      { valueDisplay: "Договор", label: "и гарантия" },
    ],

  },

  promise: {
    sectionTitle: "Как проходит работа",
    sectionIntro:
      "От обсуждения задачи до приёмки: уточняем условия объекта, согласовываем состав и организуем выполнение работ.",

    guarantees: [
      {
        label: "Договор и гарантия",
        detail: "Фиксируем стоимость и сроки до начала работ.",
      },
      {
        label: "Организация работ",
        detail: "От замера до сдачи — на связи и отвечаем за результат.",
      },
      {
        label: "Аккуратный монтаж",
        detail: "Согласовываем решения заранее, чтобы всё выглядело чисто.",
      },
    ],

    includedLine:
      "После замера фиксируем решение и смету. По желанию — подберём освещение и крепления под ваш проект.",

    closingNote:
      "Обычно монтаж занимает 1 день для стандартных объектов. По сложным проектам срок согласуем заранее.",

    processTitle: "Этапы",
    processSteps: [
      {
        stepLabel: "Шаг 1",
        title: "Заявка и консультация",
        description: "Уточняем задачу, тип помещения и желаемое решение.",
      },
      {
        stepLabel: "Шаг 2",
        title: "Бесплатный замер",
        description:
          "Снимаем размеры, смотрим геометрию, примыкания, крепления и свет.",
      },
      {
        stepLabel: "Шаг 3",
        title: "Смета и согласование",
        description:
          "Предлагаем оптимальный вариант под бюджет и фиксируем стоимость и сроки.",
      },
      {
        stepLabel: "Шаг 4",
        title: "Монтаж и сдача",
        description:
          "Делаем монтаж аккуратно и в срок. Принимаете готовый результат.",
      },
    ],

  },

  action: {
    // ДОБАВЛЕНО: нужно для components/home/home-action.tsx
    anchorId: "action",

    sectionTitle: "Оставьте заявку на бесплатный замер",
    sectionSubtitle:
      "Перезвоним, уточним детали и предложим решение под ваш объект и бюджет.",

    formTitle: "Заявка",
    secondaryContactsTitle: "Или свяжитесь с компанией",

    successTitle: "Заявка отправлена",
    errorMessage: "Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.",
    submitButtonLabel: "Записаться на бесплатный замер",
    helperText:
      "Можно указать район и этап ремонта — это поможет подготовиться к обсуждению проекта.",
    addressFieldHint: "Необязательно. Это поможет быстрее сориентироваться по выезду.",
  },

  footer: {
    footerNote:
      "Натяжные потолки: теневой профиль, парящие, световые линии, трековое освещение.",
    servicesGroupLabel: "Услуги",
    contactsGroupLabel: "Контакты",
    copyrightLine: "ПОТОЛКОВО",
    privacyLinkLabelOverride: null,

    // оставляем старое поле на всякий случай
    legalLine:
      "ПОТОЛКОВО • Натяжные потолки в Москве и МО • Замер бесплатно • Договор и гарантия",
  },
} as const;
