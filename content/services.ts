import { serviceLinks } from "./service-links";

export const phase2ServiceSlugs = [
  "tenevoy-profil",
  "paryashchie-potolki",
] as const;

export type Phase2ServiceSlug = (typeof phase2ServiceSlugs)[number];

export type CalculatorCeilingType = "standard" | "shadow" | "floating";
export type CalculatorCorniceType =
  | "none"
  | "built-in"
  | "hidden-niche"
  | "surface";
export type CalculatorTrackType = "none" | "built-in" | "surface";

export type ServiceCalculatorPreset = {
  ceilingType: CalculatorCeilingType;
  areaDefault?: number;
  corniceType?: CalculatorCorniceType;
  trackType?: CalculatorTrackType;
  lightsEnabled?: boolean;
  lightsCount?: number;
  introNote?: string;
};

export type ServiceProofImage = {
  src: string;
  alt: string;
  title: string;
  summary: string;
  areaLabel: string;
  timelineLabel: string;
  priceLabel: string;
};

export type ServiceFeature = {
  title: string;
  description: string;
};

export type ServiceUseCase = {
  title: string;
  description: string;
};

export type ServiceProcessStep = {
  stepLabel: string;
  title: string;
  description: string;
};

export type ServicePageContent = {
  slug: Phase2ServiceSlug;
  pathname: `/uslugi/${Phase2ServiceSlug}`;

  metadata: {
    title: string;
    description: string;
    keywords: string[];
    canonicalPath: `/uslugi/${Phase2ServiceSlug}`;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };

  hero: {
    breadcrumbLabel: string;
    badge: string;
    h1: string;
    subtitle: string;
    supportingText: string;
    priceBadge: string;
    primaryCtaLabel: string;
    secondaryPhoneCtaLabel: string;
    secondaryTelegramCtaLabel: string;
    imageSrc: string;
    imageAlt: string;
    quickFacts: string[];
  };

  proof: {
    sectionTitle: string;
    sectionIntro: string;
    items: ServiceProofImage[];
  };

  about: {
    sectionTitle: string;
    paragraphs: string[];
  };

  useCases: {
    sectionTitle: string;
    items: ServiceUseCase[];
  };

  benefits: {
    sectionTitle: string;
    sectionIntro: string;
    items: ServiceFeature[];
  };

  price: {
    sectionTitle: string;
    sectionIntro: string;
    fromLabel: string;
    note: string;
    calculatorPreset: ServiceCalculatorPreset;
  };

  trust: {
    sectionTitle: string;
    sectionIntro: string;
    bullets: ServiceFeature[];
  };

  promise: {
    sectionTitle: string;
    sectionIntro: string;
    steps: ServiceProcessStep[];
    closingNote: string;
  };

  action: {
    sectionTitle: string;
    sectionSubtitle: string;
  };

  relatedServiceSlugs: readonly string[];
};

export const servicePageContent: Record<
  Phase2ServiceSlug,
  ServicePageContent
> = {
  "tenevoy-profil": {
    slug: "tenevoy-profil",
    pathname: "/uslugi/tenevoy-profil",

    metadata: {
      title:
        "Теневой профиль для натяжных потолков в Москве и МО | ПОТОЛКОВО",
      description:
        "Теневой профиль для натяжных потолков в Москве и Московской области. Чёткая линия без плинтуса и вставок, бесплатный замер, личный монтаж, договор и гарантия.",
      keywords: [
        "теневой профиль",
        "теневой потолок",
        "натяжной потолок без плинтуса",
        "теневой зазор",
        "теневой профиль москва",
      ],
      canonicalPath: "/uslugi/tenevoy-profil",
      ogTitle: "Теневой профиль для натяжных потолков — ПОТОЛКОВО",
      ogDescription:
        "Чистый узел без плинтуса и резиновых вставок. Замер бесплатно, монтаж лично, смета фиксируется до начала работ.",
      ogImage: "/svc-shadow.jpeg",
    },

    hero: {
      breadcrumbLabel: "Теневой профиль",
      badge: "Услуга",
      h1: "Теневой профиль для натяжных потолков в Москве и МО",
      subtitle:
        "Чёткая линия примыкания без плинтуса и декоративных вставок. Решение для современных интерьеров, где важны аккуратный узел, чистые стены и визуально дорогой результат.",
      supportingText:
        "Бесплатно приеду на замер, посмотрю стены и примыкания, предложу рабочее решение и заранее зафиксирую смету.",
      priceBadge: "от 950 ₽ / м.п.",
      primaryCtaLabel: "Записаться на замер",
      secondaryPhoneCtaLabel: "Позвонить",
      secondaryTelegramCtaLabel: "Написать в Telegram",
      imageSrc: "/svc-shadow.jpeg",
      imageAlt: "Теневой профиль для натяжного потолка в современном интерьере",
      quickFacts: [
        "Без плинтуса и вставок",
        "Работаю лично",
        "Замер бесплатно",
        "Москва и МО",
      ],
    },

    proof: {
      sectionTitle: "Реальные примеры теневого профиля",
      sectionIntro:
        "Ниже — не рендеры, а реальные объекты с чистым примыканием к стене, где важны геометрия, аккуратный монтаж и читаемый визуальный эффект.",
      items: [
        {
          src: "/proj-shadow-1.jpeg",
          alt: "Теневой профиль в жилом интерьере с чистой линией примыкания",
          title: "Теневой узел в квартире",
          summary:
            "Аккуратный зазор по периметру без пластиковых элементов и лишних накладок.",
          areaLabel: "18 м²",
          timelineLabel: "1 день",
          priceLabel: "от 45 000 ₽",
        },
        {
          src: "/proj-shadow-2.jpeg",
          alt: "Натяжной потолок с теневым профилем в светлом интерьере",
          title: "Чистый контур без плинтуса",
          summary:
            "Подходит для интерьеров, где стены и потолок должны читаться как отдельные плоскости.",
          areaLabel: "24 м²",
          timelineLabel: "1 день",
          priceLabel: "от 55 000 ₽",
        },
        {
          src: "/proj-shadow-3.jpeg",
          alt: "Теневой профиль в современном интерьере квартиры в Москве",
          title: "Минималистичный интерьер",
          summary:
            "Решение для проектов, где важно убрать визуальный шум и получить ровную графичную линию.",
          areaLabel: "31 м²",
          timelineLabel: "1 день",
          priceLabel: "от 65 000 ₽",
        },
      ],
    },

    about: {
      sectionTitle: "Что получает клиент, когда выбирает теневой профиль",
      paragraphs: [
        "Теневой профиль создаёт аккуратный зазор между потолком и стеной. За счёт этого потолок выглядит современно и не требует потолочного плинтуса.",
        "Такой узел особенно хорошо работает в интерьерах с покраской, декоративной штукатуркой, крупноформатной плиткой и любыми стенами, где не хочется закрывать примыкание лишним декором.",
        "На замере я сразу смотрю геометрию помещения, кривизну стен, будущую мебель и свет, чтобы предложить решение без компромиссов по внешнему виду.",
      ],
    },

    useCases: {
      sectionTitle: "Где теневой профиль особенно уместен",
      items: [
        {
          title: "Квартиры с современным ремонтом",
          description:
            "Когда нужен визуально чистый потолок без плинтуса и лишних элементов.",
        },
        {
          title: "Дизайнерские интерьеры",
          description:
            "Когда важна графика примыкания и общий минималистичный вид помещения.",
        },
        {
          title: "Помещения с неровными стенами",
          description:
            "Теневой узел помогает аккуратно отработать примыкание и избежать спорных декоративных решений.",
        },
      ],
    },

    benefits: {
      sectionTitle: "Почему выбирают именно этот вариант",
      sectionIntro:
        "Теневой профиль — не просто модная деталь. Это практичное решение, если хочется получить действительно аккуратный результат.",
      items: [
        {
          title: "Без потолочного плинтуса",
          description:
            "Потолок выглядит чище и современнее, а примыкание не перегружено декором.",
        },
        {
          title: "Аккуратный визуальный зазор",
          description:
            "Контур читается ровно и дорого, особенно в сочетании с хорошей геометрией помещения.",
        },
        {
          title: "Подходит под разные стены",
          description:
            "Покраска, обои, декоративная штукатурка, плитка — решение универсально.",
        },
        {
          title: "Смета понятна заранее",
          description:
            "После замера фиксирую объём работ и стоимость до начала монтажа.",
        },
      ],
    },

    price: {
      sectionTitle: "Ориентир по цене на теневой профиль",
      sectionIntro:
        "Ниже можно сразу прикинуть стоимость. Калькулятор уже открыт в режиме теневого потолка, но вы можете изменить параметры под свой объект.",
      fromLabel: "от 950 ₽ / м.п.",
      note: "Точная смета зависит от геометрии помещения, длины профиля, освещения и сопутствующих работ.",
      calculatorPreset: {
        ceilingType: "shadow",
        areaDefault: 22,
        corniceType: "none",
        trackType: "none",
        lightsEnabled: false,
        introNote:
          "Для этой страницы калькулятор стартует с режимом «Теневой потолок».",
      },
    },

    trust: {
      sectionTitle: "Работаю лично и отвечаю за результат",
      sectionIntro:
        "Без менеджеров и случайных монтажников. На объект приезжаю сам, делаю замер, собираю смету и выполняю монтаж.",
      bullets: [
        {
          title: "Личный контроль на каждом этапе",
          description:
            "От замера до сдачи объекта вы общаетесь со мной напрямую.",
        },
        {
          title: "Понимание современных узлов",
          description:
            "Теневой профиль требует аккуратной подготовки, точного замера и грамотного монтажа.",
        },
        {
          title: "Без сюрпризов по цене",
          description:
            "Если состав работ не меняется, цена после замера не меняется тоже.",
        },
      ],
    },

    promise: {
      sectionTitle: "Как проходит работа",
      sectionIntro:
        "Процесс простой и понятный: сначала замер и решение, потом фиксированная смета и только после этого монтаж.",
      steps: [
        {
          stepLabel: "01",
          title: "Заявка",
          description:
            "Вы оставляете заявку, звоните или пишете в Telegram.",
        },
        {
          stepLabel: "02",
          title: "Бесплатный замер",
          description:
            "Приезжаю, смотрю стены, примыкания, свет и обсуждаю задачу.",
        },
        {
          stepLabel: "03",
          title: "Смета и дата",
          description:
            "Фиксируем решение, стоимость и удобную дату монтажа.",
        },
        {
          stepLabel: "04",
          title: "Монтаж",
          description:
            "Делаю потолок аккуратно, без лишнего шума и с понятным итогом по работам.",
        },
      ],
      closingNote:
        "Если вам нужен аккуратный теневой узел без компромиссов, лучше заложить правильное решение ещё на этапе замера.",
    },

    action: {
      sectionTitle: "Запишитесь на замер по теневому профилю",
      sectionSubtitle:
        "Оставьте имя и телефон. Я свяжусь с вами, уточню задачу и предложу удобное время для выезда.",
    },

    relatedServiceSlugs: [
      "paryashchie-potolki",
      "trekovoe-osveshchenie",
      "prostye-potolki",
    ],
  },

  "paryashchie-potolki": {
    slug: "paryashchie-potolki",
    pathname: "/uslugi/paryashchie-potolki",

    metadata: {
      title:
        "Парящие натяжные потолки с подсветкой в Москве и МО | ПОТОЛКОВО",
      description:
        "Парящие натяжные потолки с LED-подсветкой в Москве и Московской области. Эффект лёгкого отрыва от стен, личный монтаж, бесплатный замер, договор и фиксированная смета.",
      keywords: [
        "парящий потолок",
        "парящие потолки",
        "натяжной потолок с подсветкой",
        "парящий профиль",
        "парящий потолок москва",
      ],
      canonicalPath: "/uslugi/paryashchie-potolki",
      ogTitle: "Парящие натяжные потолки с подсветкой — ПОТОЛКОВО",
      ogDescription:
        "Парящий потолок с LED-контуром: современный визуальный эффект, понятная смета и личный монтаж без посредников.",
      ogImage: "/svc-floating.jpeg",
    },

    hero: {
      breadcrumbLabel: "Парящие потолки",
      badge: "Услуга",
      h1: "Парящие натяжные потолки с подсветкой в Москве и МО",
      subtitle:
        "Эффект лёгкого отрыва потолка от стен и мягкий контурный свет по периметру. Решение для интерьеров, где хочется добавить объём, атмосферу и современный характер.",
      supportingText:
        "Помогу понять, где парящий потолок действительно будет смотреться выигрышно, а где лучше предложить более рациональный вариант.",
      priceBadge: "от 2 500 ₽ / м.п.",
      primaryCtaLabel: "Записаться на замер",
      secondaryPhoneCtaLabel: "Позвонить",
      secondaryTelegramCtaLabel: "Написать в Telegram",
      imageSrc: "/svc-floating.jpeg",
      imageAlt:
        "Парящий натяжной потолок с LED-подсветкой в современном интерьере",
      quickFacts: [
        "LED-контур по периметру",
        "Эффект парения",
        "Замер бесплатно",
        "Москва и МО",
      ],
    },

    proof: {
      sectionTitle: "Реальные примеры парящих потолков",
      sectionIntro:
        "Ниже — реальные объекты с контурной подсветкой и эффектом парения. Такие решения особенно хорошо работают в спальнях, гостиных и коридорах.",
      items: [
        {
          src: "/proj-float-1.jpeg",
          alt: "Парящий потолок с мягкой LED-подсветкой в квартире",
          title: "Парящий контур в спальне",
          summary:
            "Мягкий свет по периметру создаёт спокойную вечернюю атмосферу без лишних светильников.",
          areaLabel: "16 м²",
          timelineLabel: "1 день",
          priceLabel: "от 50 000 ₽",
        },
        {
          src: "/proj-float-2.jpeg",
          alt: "Парящий натяжной потолок в современной гостиной",
          title: "Подсветка в гостиной",
          summary:
            "Потолок визуально становится легче, а помещение — объёмнее и современнее.",
          areaLabel: "24 м²",
          timelineLabel: "1 день",
          priceLabel: "от 65 000 ₽",
        },
        {
          src: "/proj-float-3.jpeg",
          alt: "Парящий потолок с LED-контуром в жилом интерьере",
          title: "Контурный свет по периметру",
          summary:
            "Решение, которое работает и как акцент, и как дополнительный сценарий освещения.",
          areaLabel: "28 м²",
          timelineLabel: "1 день",
          priceLabel: "от 75 000 ₽",
        },
      ],
    },

    about: {
      sectionTitle: "Что такое парящий потолок",
      paragraphs: [
        "Парящий потолок — это натяжной потолок со специальным профилем и контурной LED-подсветкой, которая визуально отделяет потолок от стен.",
        "Эффект особенно заметен вечером: помещение выглядит мягче, глубже и современнее, а потолок словно становится отдельной лёгкой плоскостью.",
        "На практике важно не только поставить профиль, но и правильно рассчитать свет, длину контура и общий сценарий освещения, чтобы решение было не просто красивым, а действительно удобным в жизни.",
      ],
    },

    useCases: {
      sectionTitle: "Где парящий потолок работает лучше всего",
      items: [
        {
          title: "Спальни",
          description:
            "Мягкая подсветка по периметру хорошо подходит для вечернего и фонового света.",
        },
        {
          title: "Гостиные",
          description:
            "Помогает добавить объём и сделать интерьер более выразительным без перегруза.",
        },
        {
          title: "Коридоры и проходные зоны",
          description:
            "Парящий контур делает пространство визуально глубже и интереснее.",
        },
      ],
    },

    benefits: {
      sectionTitle: "Почему выбирают парящий потолок",
      sectionIntro:
        "Это решение одновременно декоративное и функциональное: оно меняет восприятие пространства и добавляет ещё один световой сценарий.",
      items: [
        {
          title: "Эффект объёма",
          description:
            "Потолок визуально отрывается от стен и помещение кажется более лёгким.",
        },
        {
          title: "Контурный свет",
          description:
            "Можно использовать как фоновое освещение для вечера и спокойной атмосферы.",
        },
        {
          title: "Современный вид",
          description:
            "Подходит для минималистичных и дизайнерских интерьеров без лишнего визуального шума.",
        },
        {
          title: "Гибкость по сценарию",
          description:
            "Парящий контур можно сочетать с треками, светильниками и другими источниками света.",
        },
      ],
    },

    price: {
      sectionTitle: "Ориентир по цене на парящий потолок",
      sectionIntro:
        "Калькулятор ниже уже стартует в режиме парящего потолка. Можно быстро прикинуть бюджет и затем зафиксировать точную смету после замера.",
      fromLabel: "от 2 500 ₽ / м.п.",
      note: "Точная стоимость зависит от длины парящего профиля, площади, конфигурации помещения и выбранного сценария света.",
      calculatorPreset: {
        ceilingType: "floating",
        areaDefault: 24,
        corniceType: "none",
        trackType: "none",
        lightsEnabled: false,
        introNote:
          "Для этой страницы калькулятор стартует с режимом «Парящий потолок».",
      },
    },

    trust: {
      sectionTitle: "Важно не только красиво, но и технически грамотно",
      sectionIntro:
        "Парящий потолок — это не просто декоративный контур. Здесь важны профиль, свет, блоки питания, логика включения и общий монтажный узел.",
      bullets: [
        {
          title: "Подбираю решение под помещение",
          description:
            "Не каждому объекту нужен один и тот же тип подсветки и интенсивность света.",
        },
        {
          title: "Смотрю на общий сценарий освещения",
          description:
            "Чтобы парящий контур не был просто «красивой полосой», а реально работал в интерьере.",
        },
        {
          title: "Лично веду объект",
          description:
            "Вы общаетесь со мной напрямую и получаете понятную смету без посредников.",
        },
      ],
    },

    promise: {
      sectionTitle: "Как проходит работа по парящему потолку",
      sectionIntro:
        "Сначала определяем задачу и смотрим помещение, потом фиксируем смету и только после этого переходим к монтажу.",
      steps: [
        {
          stepLabel: "01",
          title: "Обсуждение задачи",
          description:
            "Понимаем, нужен ли вам акцентный контур, основной свет или комбинированное решение.",
        },
        {
          stepLabel: "02",
          title: "Замер",
          description:
            "Смотрю помещение, считаю длину контура, обсуждаю свет и нюансы монтажа.",
        },
        {
          stepLabel: "03",
          title: "Смета",
          description:
            "Фиксируем стоимость, объём работ и понятную дату монтажа.",
        },
        {
          stepLabel: "04",
          title: "Монтаж и сдача",
          description:
            "Монтирую потолок, проверяем свет и сдаю готовый результат.",
        },
      ],
      closingNote:
        "Если хотите современный эффект без случайных компромиссов по свету и монтажу, лучше сразу обсудить всё на замере.",
    },

    action: {
      sectionTitle: "Запишитесь на замер по парящему потолку",
      sectionSubtitle:
        "Оставьте имя и телефон. Я свяжусь с вами, уточню задачу и предложу удобное время для выезда.",
    },

    relatedServiceSlugs: [
      "tenevoy-profil",
      "svetovye-linii",
      "trekovoe-osveshchenie",
    ],
  },
};

export function isPhase2ServiceSlug(slug: string): slug is Phase2ServiceSlug {
  return Object.prototype.hasOwnProperty.call(servicePageContent, slug);
}

export function getServicePageBySlug(
  slug: string
): ServicePageContent | null {
  if (!isPhase2ServiceSlug(slug)) {
    return null;
  }

  return servicePageContent[slug];
}

export function getRelatedServiceLinks(slug: Phase2ServiceSlug) {
  const relatedSlugs = new Set(servicePageContent[slug].relatedServiceSlugs);

  return serviceLinks.filter((link) => relatedSlugs.has(link.slug));
}

export const phase2Services = phase2ServiceSlugs.map(
  (slug) => servicePageContent[slug]
);
