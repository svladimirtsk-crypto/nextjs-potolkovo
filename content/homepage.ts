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
      { label: "Личный монтаж" },
      { label: "Без посредников" },
      { label: "Договор и гарантия" },
      { label: "Москва и МО" },
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
  fixedPriceNote:
    " ",
  noExtraChargeNote:
    " ",
  primaryCtaLabel: "Записаться на замер",
  calculator: {
    areaMin: 10,
    areaMax: 100,
    areaStep: 1,
    areaDefault: 25,

    perimeterHintMinMultiplier: 4,
    perimeterHintMaxMultiplier: 4.5,

    specialMeters: {
      min: 1,
      max: 150,
      step: 1,
    },

    corniceMeters: {
      min: 1,
      max: 50,
      step: 1,
      default: 2,
    },

    lightLineMeters: {
  min: 1,
  max: 50,
  step: 1,
  default: 2,
},
    trackMeters: {
      min: 1,
      max: 50,
      step: 1,
      default: 2,
    },

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
      {
        slug: "none",
        label: "Без карниза",
        ratePerMeter: 0,
      },
      {
        slug: "built-in",
        label: "Встроенный карниз",
        ratePerMeter: 4500,
      },
      {
        slug: "hidden-niche",
        label: "Скрытая ниша",
        ratePerMeter: 1800,
      },
      {
        slug: "surface",
        label: "Накладной карниз",
        ratePerMeter: 1000,
      },
    ],

lightLines: {
  label: "Световые линии",
  ratePerMeter: 3500,
},
    tracks: [
      {
        slug: "none",
        label: "Без трека",
        ratePerMeter: 0,
      },
      {
        slug: "built-in",
        label: "Встроенный трек",
        ratePerMeter: 2500,
      },
      {
        slug: "surface",
        label: "Накладной трек",
        ratePerMeter: 1500,
      },
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
      "Без обезличенной компании и менеджеров между вами и монтажом. Я лично веду объект от замера до сдачи.",
    externalRatingLabel: "Отзывы и рейтинг",
    externalRatingValue: "5.0",
    externalRatingSource: "Авито",
    externalRatingUrl:
      "https://www.avito.ru/user/9c4e73bea5d88b91a6e6cb55a6e36574/profile?src=sharing",
    stats: [
      {
        label: "лет опыта",
        valueDisplay: "15+",
      },
      {
        label: "с 2010 года",
        valueDisplay: "Работаю",
      },
      {
        label: "рейтинг",
        valueDisplay: "5.0",
      },
    ],
    founder: {
      name: "Владимир",
      role: "Мастер по натяжным потолкам",
      responsibilityLine: "Лично веду объект и отвечаю за результат.",
      bioLines: [
        "С 2010 года занимаюсь натяжными потолками в Москве и Московской области.",
        "Специализируюсь на современных решениях: теневой профиль, парящие потолки, световые линии и встроенные треки.",
        "Делаю точный замер, составляю смету до начала работ и работаю по договору.",
        "Для меня каждый объект — это личная репутация, а не потоковая заявка.",
      ],
      portraitAssetKey: "vladimir-portrait",
      portraitAlt: "Владимир — мастер по натяжным потолкам",
      specializationLine:
        "Современные натяжные потолки для квартир, частных интерьеров и нестандартных проектов.",
      microproofLines: [
        "Личный контроль на каждом этапе",
        "Аккуратный монтаж",
        "Без посредников",
      ],
    },
    reviewsTitle: "Что говорят клиенты",
    reviews: [
      {
        slug: "review-ballonbliss",
        authorName: "BallonBliss",
        sourceLabel: "Авито",
        quote:
          "Оперативно ответил, на замер приехал в этот же день, после замера назвал стоимость работ, предоплату не брал. На монтаж приехал в назначенный день, стоимость не изменилась. Потолки не пахли сразу, материалы хорошие. Результатом довольны.",
        highlightQuote: "Стоимость не изменилась.",
        objectType: "Квартира",
        resultLabel: "Цена не изменилась после замера",
      },
      {
        slug: "review-natalya",
        authorName: "Наталья Рябинина",
        sourceLabel: "Авито",
        quote:
          "Работа выполнена качественно, быстро, цена соответствует заявленной. Владимир быстро, в этот же день, ответил на заявку. Мастер своего дела. Я очень довольна. Буду рекомендовать только его!",
        highlightQuote: "Цена соответствует заявленной.",
        objectType: "Квартира",
        resultLabel: "Быстро и без расхождения по цене",
      },
      {
        slug: "review-iiya",
        authorName: "Ия",
        sourceLabel: "Авито",
        quote:
          "Договорились быстро. Работа сделана качественно. С исполнителем было приятно пообщаться. В перспективе потолок в другой комнате. Рекомендую.",
        highlightQuote: "Работа сделана качественно.",
        objectType: "Жилая комната",
        resultLabel: "Клиент готов обращаться снова",
      },
      {
        slug: "review-yulia",
        authorName: "Юлия Кравченко",
        sourceLabel: "Авито",
        quote:
          "Всё очень понравилось, быстро и качественно сделали потолки. Минимум шума и пыли. Спасибо! Однозначно рекомендую.",
        highlightQuote: "Минимум шума и пыли.",
        objectType: "Квартира",
        resultLabel: "Аккуратный монтаж",
      },
    ],
  },

  promise: {
    sectionTitle: "Что фиксируем заранее",
    sectionIntro:
      "Перед началом работ вы понимаете, кто делает объект, сколько это стоит и что будет дальше.",
    guarantees: [
      {
        label: "Цена фиксируется после замера",
        detail: "Согласованная смета и договор до начала монтажа.",
      },
      {
        label: "Монтаж в согласованный срок",
        detail: "Для стандартных объектов работа обычно занимает один день.",
      },
      {
        label: "Гарантия по договору",
        detail: "Условия фиксируются до начала работ.",
      },
    ],
    includedLine:
      "Замер, согласование решения, смета, монтаж и сдача результата — в одном понятном процессе.",
    processTitle: "Как проходит работа",
    processSteps: [
      {
        title: "Заявка",
        description: "Вы оставляете заявку или пишете в Telegram.",
        stepLabel: "01",
      },
      {
        title: "Бесплатный замер",
        description: "Приезжаю на объект, смотрю помещение и обсуждаю задачу.",
        stepLabel: "02",
      },
      {
        title: "Точная смета",
        description: "Фиксируем стоимость, объём работ и удобную дату монтажа.",
        stepLabel: "03",
      },
      {
        title: "Монтаж",
        description: "Делаю потолок аккуратно и сдаю готовый результат.",
        stepLabel: "04",
      },
    ],
    closingNote:
      "Без длинных согласований и без ситуации, когда на объект приезжают случайные люди.",
  },

  action: {
  sectionTitle: "Запишитесь на замер — дальше всё беру на себя",
  sectionSubtitle:
    "Оставьте имя и телефон. Я свяжусь с вами, уточню задачу и предложу удобное время для замера.",
  formTitle: "Бесплатный замер и расчёт стоимости",
  nameFieldLabel: "Имя",
  nameFieldPlaceholder: "Как к вам обращаться",
  phoneFieldLabel: "Телефон",
  phoneFieldPlaceholder: "+7 (___) ___-__-__",
  addressFieldLabel: "Адрес или район",
  addressFieldPlaceholder:
    "Например: Химки, Люберцы, м. Сокол или ул. Ленина, 12",
  addressFieldHint:
    "Необязательно. Это поможет быстрее сориентироваться по выезду.",
  submitButtonLabel: "Записаться на замер",
  helperText: "Замер бесплатный. Вы ни к чему не обязаны.",
  successTitle: "Заявка отправлена",
  successMessage:
    "Спасибо. Я свяжусь с вами, чтобы уточнить задачу и договориться о замере.",
  errorMessage:
    "Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь со мной по телефону.",
  validationMessage: "Пожалуйста, заполните имя и телефон.",
  secondaryContactsTitle: "Или свяжитесь напрямую",
  phoneButtonLabel: "Позвонить",
  telegramButtonLabel: "Написать в Telegram",
  anchorId: "action",
},

  footer: {
    servicesGroupLabel: "Услуги",
    contactsGroupLabel: "Контакты",
    legalGroupLabel: "Информация",
    footerNote: "Натяжные потолки в Москве и Московской области.",
    copyrightLine: "ПОТОЛКОВО. Все права защищены.",
    privacyLinkLabelOverride: "Политика конфиденциальности",
  },
} as const;
