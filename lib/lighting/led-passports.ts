/**
 * T8-010/011/012 · Паспортная библиотека EKS: каркас под настоящие паспорта.
 *
 * До сих пор характеристики брались из названия позиции (`parseStripSpec`):
 * «10W» читалось как 10 Вт/м, «24V» — как напряжение. Это допустимо для
 * кандидатов и отбраковки, но не даёт проверенного BOM: в названии нет ни
 * кратности реза, ни ширины платы, ни IP, ни тепловых требований, ни
 * допустимой длины одного питания.
 *
 * Здесь заводится запись паспорта с тем же контрактом, что в ТЗ (§4):
 * **у каждого поля свой статус и источник**, а не одно общее «доверяем».
 * Статусы: `unknown` → `title_only` → `label_observed` → `datasheet_verified` →
 * `bench_verified`. Название и этикетка сами по себе verified BOM не дают —
 * это прямо записано в ТЗ, и код это соблюдает: `applyPassportToSpec` берёт
 * значения только из `datasheet_verified`/`bench_verified`.
 *
 * Отсутствующее значение не превращается в 0 или false: `value: null` — это
 * «неизвестно», и именно оно попадает в список вопросов поставщику.
 */

export type PassportStatus =
  | "unknown"
  | "title_only"
  | "label_observed"
  | "datasheet_verified"
  | "bench_verified";

/** Порядок доверия: больше — надёжнее. */
const STATUS_RANK: Record<PassportStatus, number> = {
  unknown: 0,
  title_only: 1,
  label_observed: 2,
  datasheet_verified: 3,
  bench_verified: 4,
};

export type PassportField<T> = {
  value: T | null;
  status: PassportStatus;
  /** Откуда значение: файл паспорта, фото этикетки, название позиции. */
  source: string | null;
};

export function field<T>(
  value: T | null,
  status: PassportStatus,
  source: string | null = null
): PassportField<T> {
  return { value, status, source };
}

/** Статус поля не ниже `datasheet_verified` — только такие значения идут в расчёт. */
export function isVerifiedField<T>(value: PassportField<T>): boolean {
  return STATUS_RANK[value.status] >= STATUS_RANK.datasheet_verified && value.value !== null;
}

export function fieldStatusOf<T>(value: PassportField<T>): PassportStatus {
  return value.status;
}

/** Худший статус из перечисленных: общий статус паспорта не выше самого слабого поля. */
export function worstPassportStatus(statuses: readonly PassportStatus[]): PassportStatus {
  let worst: PassportStatus = "bench_verified";
  for (const status of statuses) {
    if (STATUS_RANK[status] < STATUS_RANK[worst]) worst = status;
  }
  return statuses.length > 0 ? worst : "unknown";
}

export type StripMode = "mono" | "cct" | "rgb" | "rgbw" | "rgb-cct";

/**
 * Паспорт ленты по §4 «Обязательные поля · Лента» (плюс коммерческие поля).
 *
 * Поля сгруппированы так же, как их будет спрашивать инженер и поставщик,
 * поэтому `stripPassportGaps` сразу даёт готовый список вопросов.
 */
export type StripPassport = {
  /** Серия/модель — ключ, по которому паспорт привязывается к позициям каталога. */
  series: string;
  displayName: string;
  voltageDc: PassportField<number>;
  maxPowerWm: PassportField<number>;
  stripMode: PassportField<StripMode>;
  channelCount: PassportField<number>;
  reelLengthM: PassportField<number>;
  cutStepMm: PassportField<number>;
  widthMm: PassportField<number>;
  ipRating: PassportField<string>;
  cri: PassportField<number>;
  maxFeedLengthM: PassportField<number>;
  thermalMount: PassportField<string>;
  /** Коммерческие: за что цена, минимальная партия, кратность упаковки. */
  priceBasis: PassportField<"per_meter" | "per_reel">;
  packQty: PassportField<number>;
  moq: PassportField<number>;
};

export type PassportFieldKey = Exclude<keyof StripPassport, "series" | "displayName">;

/** Человеческие подписи и признак «без этого поля расчёт неполный». */
export const STRIP_PASSPORT_FIELDS: Record<
  PassportFieldKey,
  { label: string; required: boolean; hint: string }
> = {
  voltageDc: { label: "Напряжение, В", required: true, hint: "DC 12/24/48 — должно совпадать с БП" },
  maxPowerWm: { label: "Макс. мощность, Вт/м", required: true, hint: "по режимам, не «в среднем»" },
  stripMode: { label: "Режим ленты", required: true, hint: "моно / CCT / RGB / RGBW / RGB+CCT" },
  channelCount: { label: "Число каналов", required: true, hint: "для CCT/RGB — реальные каналы" },
  reelLengthM: { label: "Длина катушки, м", required: true, hint: "упаковка, не электрический предел" },
  cutStepMm: { label: "Кратность реза, мм", required: true, hint: "без неё монтаж «на глаз»" },
  widthMm: { label: "Ширина платы, мм", required: true, hint: "посадка в профиль" },
  ipRating: { label: "IP", required: false, hint: "по месту монтажа, не по слову «ванная»" },
  cri: { label: "CRI", required: false, hint: "качество белого" },
  maxFeedLengthM: { label: "Макс. длина одного питания, м", required: true, hint: "падение напряжения" },
  thermalMount: { label: "Тепловые требования", required: true, hint: "профиль, рассеиватель, закрытая полость" },
  priceBasis: { label: "База цены", required: true, hint: "за метр или за катушку" },
  packQty: { label: "Кратность упаковки", required: true, hint: "сколько в коробке/катушек в упаковке" },
  moq: { label: "MOQ", required: true, hint: "минимальная партия" },
};

/**
 * Паспорт-кандидат из профиля, собранного по названиям.
 *
 * Всё, что здесь есть, — `title_only`: это не паспорт, а заготовка записи,
 * чтобы список вопросов поставщику формировался из фактических данных, а не
 * из памяти. Ни одно из этих значений не считается проверенным.
 */
export function passportFromStripProfile(profile: {
  series?: string | null;
  title: string;
  voltage?: number | null;
  wPerMeter?: number | null;
  kind?: StripMode | null;
  ledsPerMeter?: number | null;
  reelMeters?: number | null;
}): StripPassport {
  const series = profile.series?.trim() || profile.title.trim();
  const titleSource = "название позиции в фиде EKS";
  const channels = profile.kind === "cct" ? 2 : profile.kind === "rgb" ? 3 : profile.kind === "rgbw" ? 4 : profile.kind === "rgb-cct" ? 5 : profile.kind === "mono" ? 1 : null;
  return {
    series,
    displayName: profile.title,
    voltageDc: field(profile.voltage ?? null, profile.voltage ? "title_only" : "unknown", titleSource),
    maxPowerWm: field(profile.wPerMeter ?? null, profile.wPerMeter ? "title_only" : "unknown", titleSource),
    stripMode: field(profile.kind ?? null, profile.kind ? "title_only" : "unknown", titleSource),
    channelCount: field(channels, channels ? "title_only" : "unknown", titleSource),
    reelLengthM: field(profile.reelMeters ?? null, profile.reelMeters ? "title_only" : "unknown", titleSource),
    cutStepMm: field<number>(null, "unknown", null),
    widthMm: field<number>(null, "unknown", null),
    ipRating: field<string>(null, "unknown", null),
    cri: field<number>(null, "unknown", null),
    maxFeedLengthM: field<number>(null, "unknown", null),
    thermalMount: field<string>(null, "unknown", null),
    priceBasis: field<"per_meter" | "per_reel">(null, "unknown", null),
    packQty: field<number>(null, "unknown", null),
    moq: field<number>(null, "unknown", null),
  };
}

/** Поля, по которым нет даже названия: это и есть запрос поставщику. */
export function stripPassportGaps(passport: StripPassport): PassportFieldKey[] {
  return (Object.keys(STRIP_PASSPORT_FIELDS) as PassportFieldKey[]).filter((key) => {
    const meta = STRIP_PASSPORT_FIELDS[key];
    if (!meta.required) return false;
    return passport[key].status === "unknown" || passport[key].value === null;
  });
}

/** Рабочий статус паспорта: снимок самого слабого обязательного поля. */
export function passportStatus(passport: StripPassport): PassportStatus {
  const required = (Object.keys(STRIP_PASSPORT_FIELDS) as PassportFieldKey[]).filter(
    (key) => STRIP_PASSPORT_FIELDS[key].required
  );
  return worstPassportStatus(required.map((key) => passport[key].status));
}

/**
 * Готов ли паспорт заменить расчёт «по названию».
 *
 * Требуется `datasheet_verified` хотя бы по мощности, напряжению и длине
 * катушки: без них подбор питания считать не из чего.
 */
export function passportIsVerified(passport: StripPassport): boolean {
  return (
    isVerifiedField(passport.maxPowerWm) &&
    isVerifiedField(passport.voltageDc) &&
    isVerifiedField(passport.reelLengthM)
  );
}

export type PassportApplication = {
  applied: PassportFieldKey[];
  /** Что паспорт изменил бы, но не имеет права: статус ниже datasheet_verified. */
  blocked: PassportFieldKey[];
  verified: boolean;
};

/**
 * Переносит значения паспорта в расчётный профиль ленты.
 *
 * Всё, что ниже `datasheet_verified`, попадает в `blocked` и остаётся
 * названным, а не подставленным: иначе «10W из заголовка» превратился бы в
 * паспортную мощность, и предупреждение о проверке стало бы ложью.
 */
export function applyPassportToSpec<T extends { voltage: number | null; wPerMeter: number | null; reelMeters: number | null }>(
  spec: T,
  passport: StripPassport | null | undefined
): { spec: T; application: PassportApplication } {
  const applied: PassportFieldKey[] = [];
  const blocked: PassportFieldKey[] = [];
  if (!passport) return { spec, application: { applied, blocked, verified: false } };

  const next: T = { ...spec };
  const tryApply = <K extends "voltageDc" | "maxPowerWm" | "reelLengthM", F extends keyof T>(
    passportKey: K,
    specKey: F
  ) => {
    const value = passport[passportKey];
    if (isVerifiedField(value)) {
      next[specKey] = value.value as T[F];
      applied.push(passportKey);
    } else if (value.value !== null) {
      blocked.push(passportKey);
    }
  };

  tryApply("voltageDc", "voltage");
  tryApply("maxPowerWm", "wPerMeter");
  tryApply("reelLengthM", "reelMeters");

  return {
    spec: next,
    application: { applied, blocked: [...new Set(blocked)], verified: passportIsVerified(passport) },
  };
}

/** Поиск паспорта по серии; регистр и лишние пробелы не важны. */
export function findPassport(
  passports: readonly StripPassport[] | null | undefined,
  seriesOrName: string | null | undefined
): StripPassport | null {
  if (!passports || !seriesOrName) return null;
  const needle = seriesOrName.trim().toLowerCase();
  return (
    passports.find((passport) => passport.series.trim().toLowerCase() === needle) ??
    passports.find((passport) => needle.includes(passport.series.trim().toLowerCase())) ??
    null
  );
}

/**
 * Паспорта БП, контроллеров и пультов: поля §4, которые нужны для запроса и
 * для будущей проверки. Здесь только описания — значений нет, пока нет паспортов.
 */
export const PSU_PASSPORT_FIELDS = [
  "outputMode (CV/CC)",
  "outputVoltage",
  "ratedOutputPowerW",
  "ratedOutputCurrentA",
  "acceptedInputRange",
  "deratingRule + evidence",
  "dimensions",
  "mounting / IP / temperature",
  "cooling / noise",
  "dimmingInput",
  "minLoad",
  "inrush / protection",
] as const;

export const CONTROLLER_PASSPORT_FIELDS = [
  "acceptedVoltageRange",
  "supportedStripModes",
  "outputTopology",
  "maxCurrentPerChannelA",
  "maxCurrentTotalA",
  "inputConnectorCurrentLimits",
  "thermal limits",
  "PWM characteristics",
  "localInputs",
  "RF family / protocol",
  "Wi-Fi / Bluetooth / Zigbee / Matter",
  "ecosystem / region / firmware",
  "internetDependency",
  "powerRestoreBehavior",
  "compatibleRemoteIds + evidence",
] as const;

export const REMOTE_PASSPORT_FIELDS = [
  "controlFamily",
  "compatibleControllerIds",
  "functions",
  "zones",
  "ownPowerSource",
  "pairing / maxDevices",
  "local / offline behavior",
] as const;

/**
 * Паспорта-кандидаты для всего профиля: по одной записи на серию/тип.
 *
 * Позиции без названной серии (RGB, RGBW, CCT) группируются по режиму и
 * напряжению — иначе «без серии» превратилось бы в одну свалку из разных лент.
 */
export function passportsFromStripProfiles(
  profiles: readonly {
    series?: string | null;
    title: string;
    voltage?: number | null;
    wPerMeter?: number | null;
    kind?: StripMode | null;
    reelMeters?: number | null;
  }[]
): StripPassport[] {
  const byKey = new Map<string, StripPassport>();
  for (const profile of profiles) {
    const fallback = [profile.kind?.toUpperCase() ?? "ЛЕНТА", profile.voltage ? `${profile.voltage}V` : null]
      .filter(Boolean)
      .join(" ");
    const key = profile.series?.trim() || fallback;
    if (byKey.has(key)) continue;
    if (!profile.series?.trim()) {
      byKey.set(key, passportFromStripProfile({ ...profile, series: key }));
      continue;
    }
    byKey.set(key, passportFromStripProfile(profile));
  }
  return [...byKey.values()];
}
