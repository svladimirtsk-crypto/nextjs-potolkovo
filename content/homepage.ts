export const homepage = {
  metadata: {
    title:
      "Натяжные потолки в Москве и МО — теневой профиль, парящие, световые линии | ПОТОЛКОВО",
    description:
      "Натяжные потолки в Москве и Московской области. Теневой профиль, парящие потолки, световые линии, трековое освещение, скрытые карнизы. Личный монтаж, договор и гарантия, бесплатный замер.",
    canonicalPath: "/",
    ogTitle: "ПОТОЛКОВО — натяжные потолки в Москве и МО",
    ogDescription:
      "Современные натяжные потолки: теневой профиль, парящие, световые линии, треки и скрытые карнизы. Лично веду объект и отвечаю за результат.",
    ogImageAssetKey: "hero-after",
    robots: "index, follow",
  },

  header: {
    navItems: [
      { label: "Работы", targetId: "proof" },
      { label: "Цена", targetId: "price" },
      { label: "О мастере", targetId: "trust" },
      { label: "Заявка", targetId: "action" },
    ],
    servicesMenuLabel: "Услуги",
    primaryCtaLabel: "Записаться на замер",
    mobileMenuLabel: "Открыть меню",
    phoneLabelPrefix: "Позвонить",
  },

  hero: {
    mode: "static",
    h1: "Современные натяжные потолки в Москве и МО",
    subtitle:
      "Теневой профиль, парящие потолки, световые линии, трековое освещение и скрытые карнизы. Бесплатно приеду на замер, предложу решение и заранее зафиксирую смету.",
    primaryCtaLabel: "Записаться на замер",
    trustChips: [
      { label: "Бесплатный замер" },
      { label: "Монтаж за 1 день" },
      { label: "Без посредников" },
      { label: "Гарантия 2 года" },
    ],
    servicesInlineLabel: "Москва и МО · Бесплатный замер · Договор и гарантия",
    secondaryMicrocopy:
      "Без посредников, с понятной сметой и договором до начала монтажа.",
    heroAfterAssetKey: "hero-after",
  },

  proof: {
    sectionTitle: "Реальные работы, а не рендеры",
    sectionIntro:
      "Показываю не абстрактные картинки, а реальные объекты: тип решения, площадь, срок и ориентир по бюджету.",
    cardCtaLabel: "Хочу так же",
    items: [
      {
        slug: "shadow-track-apartment",
        title: "Теневой профиль + трек",
        serviceType: "Теневой профиль и трековое освещение",
        roomType: "Квартира",
        summary:
          "Чистые линии без плинтусов и аккуратный направленный свет для современного интерьера.",
        areaLabel: "24 м²",
        timelineLabel: "1 день",
        priceLabel: "от 50 000 ₽",
        imageAssetKey: "proof-01",
        alt: "Теневой профиль и трековое освещение в квартире в Москве",
        ctaLabel: "Хочу так же",
        actionTargetId: "action",
        actionPreset: { ceilingType: "shadow", trackType: "built-in" },
      },
      {
        slug: "floating-led-living-room",
        title: "Парящий потолок",
        serviceType: "Парящий потолок с LED-подсветкой",
        roomType: "Гостиная и коридор",
        summary:
          "Контурная подсветка по периметру и эффект лёгкого отрыва потолка от стен.",
        areaLabel: "22 м²",
        timelineLabel: "1 день",
        priceLabel: "от 50 000 ₽",
        imageAssetKey: "proof-02",
        alt: "Парящий натяжной потолок с LED-подсветкой в квартире",
        ctaLabel: "Хочу так же",
        actionTargetId: "action",
        actionPreset: { ceilingType: "floating" },
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
      "Выберите площадь и нужные параметры. Калькулятор покажет ориентировочную стоимость, а точную цену я зафиксирую после замера.",
    includedLine:
      "Это ориентировочный расчёт для понимания бюджета. Итоговая смета фиксируется после осмотра помещения и согласования решения.",
    fixedPriceNote: " ",
    noExtraChargeNote: " ",
    primaryCtaLabel: "Записаться на замер",
    calculator: {
      areaMin: 10,
      areaMax: 100,
      areaStep: 1,
      areaDefault: 10,
      perimeterHintMinMultiplier: 4,
      perimeterHintMaxMultiplier: 4.5,
      specialMeters: { min: 1, max: 150, step: 1 },
      corniceMeters: { min: 1, max: 50, step: 1, default: 2 },
      lightLineMeters: { min: 1, max: 50, step: 1, default: 2 },
      trackMeters: { min: 1, max: 50, step: 1, default: 2 },
      baseDescription: "Базовая стоимость простого потолка — от 1 000 ₽ / м²",
      ceilingTypes: [
        {
          slug: "standard",
          label: "Простой потолок",
          baseRatePerSqm: 1000,
          extraLabel: null,
          extraRatePerMeter: 0,
        },
        {
          slug: "shadow",
          label: "Теневой потолок",
          baseRatePerSqm: 800,
          extraLabel: "Теневой профиль",
          extraRatePerMeter: 950,
        },
        {
          slug: "floating",
          label: "Парящий потолок",
          baseRatePerSqm: 800,
          extraLabel: "Парящий профиль",
          extraRatePerMeter: 2500,
        },
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
    },
  },

  trust: {
    sectionTitle: "Работаю лично. Отвечаю за результат.",
    sectionIntro:
      "Без обезличенной компании и менеджеров между нами. От замера до монтажа объект веду сам и заранее проговариваю все узлы.",

    founder: {
      portraitAssetKey: "vladimir-portrait",
      portraitAlt: "Владимир — мастер по натяжным потолкам",
      role: "Мастер по натяжным потолкам",
      name: "Владимир",
      responsibilityLine:
        "Я лично приезжаю на замер, делаю смету и контролирую монтаж.",
      specializationLine:
        "Теневой профиль, парящие потолки, световые линии, треки и скрытые карнизы.",
      bioLines: [
        "Работаю без посредников и “передач” объекта бригаде.",
        "Согласовываю узлы заранее и фиксирую смету до старта работ.",
      ],
      microproofLines: ["Договор и гарантия", "Москва и МО", "Замер бесплатно"],
    },

    bullets: [
      {
        title: "Личный контроль на каждом этапе",
        description:
          "Сам приезжаю на замер, согласовываю решение и контролирую монтаж на объекте.",
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
      { valueDisplay: "1 день", label: "обычный монтаж" },
      { valueDisplay: "Замер", label: "бесплатно" },
      { valueDisplay: "Договор", label: "и гарантия" },
    ],

    reviewsTitle: "Отзывы клиентов",
    reviews: [
      {
        slug: "review-01",
        authorName: "Клиент",
        sourceLabel: "Отзыв",
        resultLabel: "Аккуратно и в срок",
        highlightQuote: "Смета понятная, без сюрпризов",
        quote:
          "Приехал на замер, всё объяснил, предложил варианты. Монтаж сделали аккуратно, результат понравился.",
        objectType: "Квартира",
      },
      {
        slug: "review-02",
        authorName: "Клиент",
        sourceLabel: "Отзыв",
        resultLabel: "Теневой профиль + трек",
        highlightQuote: "Сделали за один день, мусор вынесли",
        quote:
          "Заказывали теневой профиль и трековое освещение в коридоре. Сделали за один день, мусор вынесли. Свет выглядит дорого, жена довольна.",
        objectType: "Квартира",
      },
      {
        slug: "review-03",
        authorName: "Клиент",
        sourceLabel: "Отзыв",
        resultLabel: "Парящий потолок",
        highlightQuote: "Подсветка равномерная, без пятен",
        quote:
          "Парящий потолок с подсветкой в гостиной. Подсветка равномерная, без пятен. Цена как договаривались, доплат не было.",
        objectType: "Гостиная",
      },
      {
        slug: "review-04",
        authorName: "Клиент",
        sourceLabel: "Отзыв",
        resultLabel: "Световые линии",
        highlightQuote: "Реально как на рендере, только живьём",
        quote:
          "Хотели световые линии вместо обычных светильников в офисе. Предложил решение под наш бюджет. Результат — реально как на рендере, только живьём.",
        objectType: "Офис",
      },
    ],
  },

  promise: {
    sectionTitle: "Как проходит работа",
    sectionIntro:
      "Без сложной бюрократии: быстро выходим на замер, согласовываем решение, фиксируем смету и делаем монтаж в согласованный день.",

    guarantees: [
      {
        label: "Договор и гарантия",
        detail: "Фиксируем стоимость и сроки до начала работ.",
      },
      {
        label: "Лично веду объект",
        detail: "От замера до сдачи — на связи и отвечаю за результат.",
      },
      {
        label: "Аккуратный монтаж",
        detail: "Согласовываем узлы заранее, чтобы всё выглядело чисто.",
      },
    ],

    includedLine:
      "После замера фиксирую решение и смету. По желанию — подберём освещение и закладные под ваш проект.",

    closingNote:
      "Обычно монтаж занимает 1 день для стандартных объектов. По сложным проектам срок согласуем заранее.",

    processTitle: "Этапы",
    processSteps: [
      {
        stepLabel: "Шаг 1",
        title: "Заявка и консультация",
        description: "Уточняю задачу, тип помещения и желаемое решение.",
      },
      {
        stepLabel: "Шаг 2",
        title: "Бесплатный замер",
        description:
          "Снимаю размеры, смотрю геометрию, примыкания, закладные и свет.",
      },
      {
        stepLabel: "Шаг 3",
        title: "Смета и согласование",
        description:
          "Предлагаю оптимальный вариант под бюджет и фиксирую стоимость и сроки.",
      },
      {
        stepLabel: "Шаг 4",
        title: "Монтаж и сдача",
        description:
          "Делаем монтаж аккуратно и в срок. Принимаете готовый результат.",
      },
    ],

    // оставляем совместимость со старой структурой, если где-то ещё используется
    steps: [
      {
        stepLabel: "Шаг 1",
        title: "Заявка и консультация",
        description:
          "Вы оставляете заявку удобным способом. Уточняю задачу, тип помещения и желаемое решение.",
      },
      {
        stepLabel: "Шаг 2",
        title: "Бесплатный замер",
        description:
          "Приезжаю на объект, снимаю размеры, смотрю геометрию, примыкания, закладные и свет.",
      },
      {
        stepLabel: "Шаг 3",
        title: "Смета и согласование",
        description:
          "Предлагаю оптимальный вариант под ваш бюджет, фиксирую стоимость и сроки в договоре.",
      },
      {
        stepLabel: "Шаг 4",
        title: "Монтаж и сдача",
        description:
          "Выполняем монтаж аккуратно и в срок. Принимаете готовый результат и получаете гарантию.",
      },
    ],
  },

  action: {
    // ДОБАВЛЕНО: нужно для components/home/home-action.tsx
    anchorId: "action",

    sectionTitle: "Оставьте заявку на бесплатный замер",
    sectionSubtitle:
      "Перезвоню, уточню детали и предложу решение под ваш объект и бюджет.",

    formTitle: "Заявка",
    secondaryContactsTitle: "Или напишите мне",

    successTitle: "Заявка отправлена",
    errorMessage: "Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.",
    submitButtonLabel: "Записаться на замер",
    helperText:
      "Обычно отвечаю быстро. Можно указать район — так проще сориентироваться по выезду.",
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
