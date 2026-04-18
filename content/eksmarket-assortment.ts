// content/eksmarket-assortment.ts

export interface Category {
  id: string;
  title: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  categoryId: string;
  priceRub: number | null;
  url: string;
  availability: string;
  specs: ProductSpec[];
  colors?: string[];
  imageUrl?: string;
  /** Длина профиля/трека в мм. Обязательна для всех товаров категорий профилей. */
  lengthMm?: number;
}

export interface Catalog {
  supplierName: string;
  supplierHomepageUrl: string;
  discountPercentForCeilingOrder: number;
  disclaimer: string;
  updatedAt: string;
  categories: Category[];
  products: Product[];
}

export const catalog: Catalog = {
  supplierName: "eksmarket.ru",
  supplierHomepageUrl: "https://eksmarket.ru",
  discountPercentForCeilingOrder: 15,
  disclaimer:
    "Цены и наличие могут меняться. Подтвердим актуальную цену при оформлении заявки. Скидка 15% действует при заказе натяжных потолков.",
  updatedAt: "2025-07-18",
  categories: [
    { id: "panels-loft",    title: "Панели LOFT" },
    { id: "gx53",           title: "GX53" },
    { id: "mr16",           title: "MR16" },
    { id: "colibri-220v",   title: "Треки COLIBRI 220V" },
    { id: "clarus-48v",     title: "Треки CLARUS 48V" },
    { id: "art-220v",       title: "Треки ART 220V" },
  ],
  products: [
    // ──────────────────────────────────────────────
    // Панели LOFT
    // ──────────────────────────────────────────────
    {
      id: "loft-circle-10w-4200k",
      title: "Панель LOFT круг 10W 4200K",
      categoryId: "panels-loft",
      priceRub: 260,
      url: "https://eksmarket.ru/catalog/paneli-loft/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "круг" },
        { label: "Мощность",    value: "10W" },
        { label: "Температура", value: "4200K" },
      ],
    },
    {
      id: "loft-square-15w-4200k",
      title: "Панель LOFT квадрат 15W 4200K",
      categoryId: "panels-loft",
      priceRub: 480,
      url: "https://eksmarket.ru/catalog/paneli-loft/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "квадрат" },
        { label: "Мощность",    value: "15W" },
        { label: "Температура", value: "4200K" },
      ],
    },
    {
      id: "loft-circle-15w-3000k",
      title: "Панель LOFT круг 15W 3000K",
      categoryId: "panels-loft",
      priceRub: 450,
      url: "https://eksmarket.ru/catalog/paneli-loft/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "круг" },
        { label: "Мощность",    value: "15W" },
        { label: "Температура", value: "3000K" },
      ],
    },
    {
      id: "loft-square-10w-6500k",
      title: "Панель LOFT квадрат 10W 6500K",
      categoryId: "panels-loft",
      priceRub: 290,
      url: "https://eksmarket.ru/catalog/paneli-loft/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "квадрат" },
        { label: "Мощность",    value: "10W" },
        { label: "Температура", value: "6500K" },
      ],
    },

    // ──────────────────────────────────────────────
    // GX53 — корпуса
    // ──────────────────────────────────────────────
    {
      id: "gx53-optima",
      title: "GX53 OPTIMA",
      categoryId: "gx53",
      priceRub: 130,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый матовый"],
      specs: [
        { label: "Тип",  value: "светильник GX53" },
        { label: "Цвет", value: "белый матовый" },
      ],
    },
    {
      id: "gx53-terra",
      title: "GX53 TERRA",
      categoryId: "gx53",
      priceRub: 620,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый", "чёрный"],
      specs: [
        { label: "Тип",      value: "светильник GX53" },
        { label: "Мощность", value: "до 12W" },
      ],
    },
    {
      id: "gx53-zoom-circle",
      title: "GX53 ZOOM круг",
      categoryId: "gx53",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый", "чёрный"],
      specs: [
        { label: "Тип",   value: "светильник GX53" },
        { label: "Форма", value: "круг" },
      ],
    },
    {
      id: "gx53-art-line",
      title: "GX53 ART LINE",
      categoryId: "gx53",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый", "серый", "чёрный"],
      specs: [
        { label: "Тип",   value: "светильник GX53" },
        { label: "Серия", value: "ART LINE" },
      ],
    },
    {
      id: "gx53-art-flip",
      title: "GX53 ART FLIP",
      categoryId: "gx53",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["серый", "чёрный"],
      specs: [
        { label: "Тип",   value: "светильник GX53" },
        { label: "Серия", value: "ART FLIP" },
      ],
    },
    {
      id: "gx53-art-glass",
      title: "GX53 ART GLASS",
      categoryId: "gx53",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый", "серый", "чёрный"],
      specs: [
        { label: "Тип",   value: "светильник GX53" },
        { label: "Серия", value: "ART GLASS" },
      ],
    },

    // ──────────────────────────────────────────────
    // GX53 — лампа
    // ──────────────────────────────────────────────
    {
      id: "gx53-lamp-8w-4200k",
      title: "Лампа GX53 8W 4200K OPTIMA PREMIUM",
      categoryId: "gx53",
      priceRub: 114,
      url: "https://eksmarket.ru/catalog/lampy-gx53/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "лампа GX53" },
        { label: "Мощность",    value: "8W" },
        { label: "Температура", value: "4200K" },
      ],
    },

    // ──────────────────────────────────────────────
    // MR16 — корпуса (встраиваемые)
    // ──────────────────────────────────────────────
    {
      id: "mr16-moon-mono",
      title: "MR16 MOON/MONO",
      categoryId: "mr16",
      priceRub: 630,
      url: "https://eksmarket.ru/catalog/svetilniki-mr16/",
      availability: "нет данных",
      colors: ["белый", "чёрный"],
      specs: [
        { label: "Тип",      value: "встраиваемый MR16" },
        { label: "Мощность", value: "до 7W" },
      ],
    },
    {
      id: "mr16-skill-circle",
      title: "MR16 SKILL круг",
      categoryId: "mr16",
      priceRub: 560,
      url: "https://eksmarket.ru/catalog/svetilniki-mr16/",
      availability: "нет данных",
      colors: ["чёрный"],
      specs: [
        { label: "Тип",   value: "встраиваемый MR16" },
        { label: "Форма", value: "круг" },
      ],
    },
    {
      id: "mr16-zoom-duo",
      title: "MR16 ZOOM DUO",
      categoryId: "mr16",
      priceRub: 500,
      url: "https://eksmarket.ru/catalog/svetilniki-mr16/",
      availability: "нет данных",
      colors: ["белый", "чёрный"],
      specs: [
        { label: "Тип",   value: "встраиваемый MR16" },
        { label: "Форма", value: "двойной" },
      ],
    },
    {
      id: "mr16-zoom-circle",
      title: "MR16 ZOOM круг",
      categoryId: "mr16",
      priceRub: 260,
      url: "https://eksmarket.ru/catalog/svetilniki-mr16/",
      availability: "нет данных",
      colors: ["чёрный", "белый"],
      specs: [
        { label: "Тип",   value: "встраиваемый MR16" },
        { label: "Форма", value: "круг" },
      ],
    },

    // ──────────────────────────────────────────────
    // MR16 — модуль
    // ──────────────────────────────────────────────
    {
      id: "mr16-module-7w-4200k",
      title: "Светодиодный модуль MR16 7W 4200K",
      categoryId: "mr16",
      priceRub: 174,
      url: "https://eksmarket.ru/catalog/moduli-mr16/",
      availability: "нет данных",
      specs: [
        { label: "Тип",         value: "светодиодный модуль MR16" },
        { label: "Мощность",    value: "7W" },
        { label: "Температура", value: "4200K" },
      ],
    },

    // ──────────────────────────────────────────────
    // COLIBRI 220V — профили (3 длины)
    // Цена 1000 мм: ~3700 ₽ (пол цены от 2000 мм × 1,1 — округление)
    // Цена 2000 мм: 7400 ₽ (исходная)
    // Цена 3000 мм: ~10500 ₽ (7400 × 1,5 — округление вверх)
    // ──────────────────────────────────────────────
    {
      id: "colibri-profile-220v-1000",
      title: "COLIBRI профиль под гарпун 220V — 1000 мм",
      categoryId: "colibri-220v",
      priceRub: 3900,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-profil-pod-garpun-220v-chyernyy-2000-62-51-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 1000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "1000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },
    {
      id: "colibri-profile-220v-2000",
      title: "COLIBRI профиль под гарпун 220V — 2000 мм",
      categoryId: "colibri-220v",
      priceRub: 7400,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-profil-pod-garpun-220v-chyernyy-2000-62-51-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 2000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "2000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },
    {
      id: "colibri-profile-220v-3000",
      title: "COLIBRI профиль под гарпун 220V — 3000 мм",
      categoryId: "colibri-220v",
      priceRub: 10500,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-profil-pod-garpun-220v-chyernyy-2000-62-51-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 3000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "3000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },

    // ──────────────────────────────────────────────
    // COLIBRI 220V — светильники (не smart)
    // ──────────────────────────────────────────────
    {
      id: "colibri-london-10w",
      title: "COLIBRI LONDON 10W 4000K",
      categoryId: "colibri-220v",
      priceRub: 1540,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-svetilnik-london-chernyy-10w-4000k-900lm-d220-25-40-30-sht-kor/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "10W" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "colibri-london-20w",
      title: "COLIBRI LONDON 20W 4000K",
      categoryId: "colibri-220v",
      priceRub: 4510,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-svetilnik-london-chernyy-20w-4000k-1800lm-d410-25-40-20-sht-kor/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "20W" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "colibri-rio-12w",
      title: "COLIBRI RIO 12W 4000K",
      categoryId: "colibri-220v",
      priceRub: 3080,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/kolibri-trekovyy-svetilnik-rio-chernyy-12w-4000k-1100lm-d50-100-20-sht-kor/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "12W" },
        { label: "Температура",value: "4000K" },
      ],
    },

    // ──────────────────────────────────────────────
    // COLIBRI 220V — светильники (smart)
    // ──────────────────────────────────────────────
    {
      id: "colibri-london-smart-20w",
      title: "COLIBRI LONDON SMART 20W 2700–6000K",
      categoryId: "colibri-220v",
      priceRub: 5676,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение",  value: "220V" },
        { label: "Мощность",    value: "20W" },
        { label: "Температура", value: "2700–6000K" },
        { label: "Управление",  value: "SMART" },
      ],
    },
    {
      id: "colibri-rio-smart-12w",
      title: "COLIBRI RIO SMART 12W 2700–6000K",
      categoryId: "colibri-220v",
      priceRub: 5170,
      url: "https://eksmarket.ru/catalog/sistema-colibri-220v/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение",  value: "220V" },
        { label: "Мощность",    value: "12W" },
        { label: "Температура", value: "2700–6000K" },
        { label: "Управление",  value: "SMART" },
      ],
    },

    // ──────────────────────────────────────────────
    // CLARUS 48V — профили (3 длины)
    // Цена 1000 мм: ~4200 ₽ (пол цены 2000 мм × 1,05)
    // Цена 2000 мм: 8000 ₽ (исходная)
    // Цена 3000 мм: ~11500 ₽ (8000 × 1,44 — округление)
    // ──────────────────────────────────────────────
    {
      id: "clarus-profile-48v-1000",
      title: "CLARUS профиль под гарпун 48V — 1000 мм",
      categoryId: "clarus-48v",
      priceRub: 4200,
      url: "https://eksmarket.ru/catalog/sistema-clarus/klarus-trekovyy-profil-pod-garpun-48v-chyernyy-2000-60-33-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 1000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "1000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },
    {
      id: "clarus-profile-48v-2000",
      title: "CLARUS профиль под гарпун 48V — 2000 мм",
      categoryId: "clarus-48v",
      priceRub: 8000,
      url: "https://eksmarket.ru/catalog/sistema-clarus/klarus-trekovyy-profil-pod-garpun-48v-chyernyy-2000-60-33-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 2000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "2000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },
    {
      id: "clarus-profile-48v-3000",
      title: "CLARUS профиль под гарпун 48V — 3000 мм",
      categoryId: "clarus-48v",
      priceRub: 11500,
      url: "https://eksmarket.ru/catalog/sistema-clarus/klarus-trekovyy-profil-pod-garpun-48v-chyernyy-2000-60-33-mm-5-sht-kor-v/",
      availability: "нет данных",
      lengthMm: 3000,
      colors: ["чёрный"],
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Тип",        value: "профиль под гарпун" },
        { label: "Длина",      value: "3000 мм" },
        { label: "Цвет",       value: "чёрный" },
      ],
    },

    // ──────────────────────────────────────────────
    // CLARUS 48V — блок питания + светильники
    // ──────────────────────────────────────────────
    {
      id: "clarus-psu-48v",
      title: "CLARUS блок питания 48V 200W",
      categoryId: "clarus-48v",
      priceRub: 1530,
      url: "https://eksmarket.ru/catalog/sistema-clarus/klarus-blok-pitaniya-dlya-skrytogo-montazha-200-w-48v-50-sht/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Мощность",   value: "200W" },
      ],
    },
    {
      id: "clarus-spot-12w-4000k",
      title: "CLARUS SPOT 12W 4000K",
      categoryId: "clarus-48v",
      priceRub: 3520,
      url: "https://eksmarket.ru/catalog/sistema-clarus/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Мощность",   value: "12W" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "clarus-nord-4000k",
      title: "CLARUS NORD 4000K",
      categoryId: "clarus-48v",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/sistema-clarus/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "48V" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "clarus-nord-smart",
      title: "CLARUS NORD SMART 2700–6000K",
      categoryId: "clarus-48v",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/sistema-clarus/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение",  value: "48V" },
        { label: "Температура", value: "2700–6000K" },
        { label: "Управление",  value: "SMART" },
      ],
    },

    // ──────────────────────────────────────────────
    // ART 220V — монолиты
    // ──────────────────────────────────────────────
    {
      id: "art-start-30w",
      title: "ART START 30W 4000K",
      categoryId: "art-220v",
      priceRub: 2090,
      url: "https://eksmarket.ru/catalog/odnofaznaya-trekovaya-sistema-220v/trekovyy-svetilnik-art-start-povorotnyy-odnofaznyy-chyernyy-30w-4000k-470-34-46-mm-25-sht-kor/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "30W" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "art-monolit-30w",
      title: "ART MONOLIT 30W 4000K",
      categoryId: "art-220v",
      priceRub: 2530,
      url: "https://eksmarket.ru/catalog/odnofaznaya-trekovaya-sistema-220v/trekovyy-svetilnik-art-monolit-povorotnyy-odnofaznyy-chyernyy-30w-4000k-470-34-46-mm-25-sht-kor/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "30W" },
        { label: "Температура",value: "4000K" },
      ],
    },
    {
      id: "art-monolit-pro-30w",
      title: "ART MONOLIT PRO 30W 4000K",
      categoryId: "art-220v",
      priceRub: 2600,
      url: "https://eksmarket.ru/catalog/odnofaznaya-trekovaya-sistema-220v/trekovyy-povorotnyy-odnofaznyy-svetilnik-art-monolit-pro-chernyy-30w-4000k-440-33-40-sht/",
      availability: "нет данных",
      specs: [
        { label: "Напряжение", value: "220V" },
        { label: "Мощность",   value: "30W" },
        { label: "Температура",value: "4000K" },
      ],
    },

    // ──────────────────────────────────────────────
    // ART 220V — GX53 трековые головы
    // ──────────────────────────────────────────────
    {
      id: "gx53-optimalight-shot-track",
      title: "GX53 OPTIMALIGHT SHOT трековый",
      categoryId: "art-220v",
      priceRub: null,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/",
      availability: "нет данных",
      colors: ["белый", "серый", "чёрный"],
      specs: [
        { label: "Тип",   value: "трековый GX53" },
        { label: "Серия", value: "OPTIMALIGHT SHOT" },
      ],
    },
    {
      id: "gx53-optimalight-glass-track",
      title: "GX53 OPTIMALIGHT GLASS трековый",
      categoryId: "art-220v",
      priceRub: 520,
      url: "https://eksmarket.ru/catalog/svetilniki-gx53/svetilnik-gx53-optimalayt-glas-trekovyy-chyornyy-c-krepleniem-80-104mm-80-65mm-50-sht-kor/",
      availability: "нет данных",
      colors: ["белый", "серый", "чёрный"],
      specs: [
        { label: "Тип",   value: "трековый GX53" },
        { label: "Серия", value: "OPTIMALIGHT GLASS" },
      ],
    },
  ],
};
