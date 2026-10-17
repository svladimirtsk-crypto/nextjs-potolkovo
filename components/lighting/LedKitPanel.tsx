"use client";

/**
 * LED-панель каталога: комплектующие подсветки карниза.
 *
 * До неё в разделе «Подсветка карниза» лежала одна сетка из 72 позиций: лента,
 * блоки питания, контроллеры, пульты и наборы вперемешку, все с единицей «м».
 * Лид не мог понять, что с чем работает, а подбор питания по метражу был
 * невозможен в принципе.
 *
 * Здесь три группы комплектующих, метраж (берётся из задачи света, если она уже
 * есть) и предварительный расчёт: нагрузка → требуемая мощность БП с запасом
 * 30 % → минимальный подходящий БП → контроллер по типу ленты → пульт для RF.
 *
 * Товары не добавляются автоматически: ни одна позиция не попадает в комплект
 * без нажатия. Расчёт всегда помечен как требующий проверки по паспорту.
 */
import { useEffect, useMemo, useState } from "react";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { getDiscountedPrice } from "@/lib/feed2-products";
import { LIGHTING_ONLY_DISCOUNT_PERCENT } from "@/lib/lighting-formulas";
import {
  LED_GROUPS,
  controlStatusOf,
  ledGroupOfProduct,
  ledMetersFromQuery,
  ledMetersNote,
  ledPlanFor,
  ledStripOptions,
  type LedGroupId,
} from "@/lib/lighting/led-catalog-view";
import { resolvePriceBasis, stripPurchaseQty } from "@/lib/lighting/led-price-basis";

const METER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const STRIP_KIND_LABEL: Record<string, string> = {
  mono: "Монохром",
  cct: "CCT (тёплый–холодный)",
  rgb: "RGB",
  rgbw: "RGBW",
  "rgb-cct": "RGB + CCT",
};

const unitLabel = (product: FeedCatalogProduct) => (product.unit === "m" ? "м" : "шт");

/** Лента по умолчанию: монохром 10 Вт/м — самый частый случай подсветки. */
function defaultStripId(options: ReturnType<typeof ledStripOptions>): string {
  const ten = options.find((option) => option.spec.kind === "mono" && option.spec.wPerMeter === 10);
  return (ten ?? options[0])?.product.productId ?? "";
}

export function LedKitPanel({
  products,
  cartItems,
  onAdd,
  activeGroup,
  onSelectGroup,
}: {
  products: readonly FeedCatalogProduct[];
  cartItems: Record<string, number>;
  onAdd: (product: FeedCatalogProduct, qty: number) => void;
  activeGroup: LedGroupId;
  onSelectGroup: (group: LedGroupId) => void;
}) {
  const stripOptions = useMemo(() => ledStripOptions(products), [products]);
  const counts = useMemo(() => {
    const map: Record<LedGroupId, number> = { strips: 0, power: 0, control: 0 };
    for (const product of products) {
      const group = ledGroupOfProduct(product);
      if (group) map[group] += 1;
    }
    return map;
  }, [products]);

  const [stripId, setStripId] = useState(() => defaultStripId(stripOptions));
  const [metersText, setMetersText] = useState("");
  /**
   * Часть C: ряды ленты и число независимых зон. Без рядов 6 м световой линии
   * в два ряда считались бы как 6 м ленты — вдвое меньше реальной нагрузки.
   */
  const [rowsText, setRowsText] = useState("1");
  const [zonesText, setZonesText] = useState("1");
  const [metersTouched, setMetersTouched] = useState(false);
  const [metersFromTask, setMetersFromTask] = useState(false);

  /*
   * Вход по задаче: метраж уже известен из расчёта — не спрашиваем его снова.
   *
   * Читаем адрес после монтирования, а не при первом рендере: на сервере
   * `window` нет, и предрендер каталога разошёлся бы с клиентом. Страница
   * каталога остаётся статической именно потому, что метраж не идёт через
   * `searchParams` страницы. Формальное замечание линтера о setState в эффекте
   * здесь осознанное: иначе значение из ссылки не подставить без гидрационных
   * расхождений.
   */
  useEffect(() => {
    const fromQuery = ledMetersFromQuery(window.location.search);
    if (fromQuery === null || metersTouched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- значение из URL подставляется один раз после гидратации
    setMetersText(String(fromQuery));
    setMetersFromTask(true);
  }, [metersTouched]);

  const selected =
    stripOptions.find((option) => option.product.productId === stripId) ?? stripOptions[0] ?? null;
  const meters = Number(metersText.replace(",", "."));
  const metersValue = Number.isFinite(meters) && meters > 0 ? meters : 0;
  const rowsValue = Math.min(4, Math.max(1, Math.round(Number(rowsText.replace(",", ".")) || 1)));
  const zonesValue = Math.min(6, Math.max(1, Math.round(Number(zonesText.replace(",", ".")) || 1)));
  const plan = useMemo(
    () => ledPlanFor({ products, strip: selected?.spec ?? null, meters: metersValue, rows: rowsValue, zones: zonesValue }),
    [products, selected, metersValue, rowsValue, zonesValue]
  );

  const controllerStatus = plan?.controller
    ? controlStatusOf({ role: "controller", controller: plan.controller.spec })
    : null;

  /**
   * Сколько позиции уходит в комплект при нажатии.
   * Лента — метраж, округлённый вверх до катушки поставщика: катушка не режется.
   * Питание и управление — по одной штуке, количество уточняется при заказе.
   */
  /**
   * T8-010 · Сколько уходит в комплект и в каких единицах.
   *
   * Если цена позиции — за катушку, покупаются целые катушки (шт), а не
   * «15 метров» по цене катушки за метр. Если цена за метр — берётся точный
   * установленный метраж. Базис берётся из названия/витрины с доказательством.
   */
  const basis = selected
    ? resolvePriceBasis({
        name: selected.product.name,
        unit: selected.product.unit,
        priceRub: selected.product.priceRub,
      })
    : null;
  const purchase = stripPurchaseQty({
    installedMeters: plan?.installedMeters ?? 0,
    basis: basis ?? {
      basis: "unknown",
      evidence: "none",
      reelMeters: selected?.spec.reelMeters ?? null,
      pricePerMeterRub: null,
      soldByReel: false,
      note: "",
    },
  });
  const stripQty = purchase.qty;

  const price = (product: FeedCatalogProduct) =>
    `${RUB.format(getDiscountedPrice(product.priceRub, LIGHTING_ONLY_DISCOUNT_PERCENT))} ₽`;

  const pick = (
    title: string,
    product: FeedCatalogProduct | undefined,
    detail: string,
    testId: string,
    qty = 1
  ) =>
    product ? (
      <div className="pk-led-pick" data-testid={testId}>
        <div>
          <small>{title}</small>
          <b>{product.name}</b>
          <p>{detail}</p>
        </div>
        <div className="pk-led-pick-actions">
          <strong>
            {price(product)} <small>/ {unitLabel(product)}</small>
          </strong>
          <button type="button" onClick={() => onAdd(product, qty)} data-testid={`${testId}-add`}>
            В комплект · {product.unit === "m" ? `${METER.format(qty)} м` : `${qty} шт`}
            {(cartItems[product.productId] ?? 0) > 0 ? ` · уже ${METER.format(cartItems[product.productId] ?? 0)}` : ""}
          </button>
        </div>
      </div>
    ) : (
      <div className="pk-led-pick pk-led-pick--empty" data-testid={testId}>
        <div>
          <small>{title}</small>
          <b>Нет подходящей позиции в каталоге</b>
          <p>{detail}</p>
        </div>
      </div>
    );

  return (
    <section className="pk-led-kit" data-testid="led-kit-panel" aria-label="Комплектующие подсветки карниза">
      <header className="pk-led-kit-head">
        <div>
          <p className="pk-catalog-label">ПОДСВЕТКА КАРНИЗА · КОМПЛЕКТУЮЩИЕ</p>
          <h3>Лента, питание и управление — по вашему метражу</h3>
          <p>
            Считаем нагрузку по метражу, подбираем блок питания с запасом 30 % и контроллер под тип ленты.
            Расчёт предварительный: напряжение, сечение и схему проверяем по паспорту перед заказом.
          </p>
        </div>
        <span className="pk-led-status" data-status={plan?.status ?? "needs_review"} data-testid="led-plan-status">
          {plan?.status === "ok" ? "Расчёт сошёлся" : "Нужна проверка"}
        </span>
      </header>

      <div role="tablist" aria-label="Группы комплектующих" className="pk-led-groups">
        {LED_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeGroup === group.id}
            aria-controls="catalog-panel"
            data-testid={`led-group-${group.id}`}
            onClick={() => onSelectGroup(group.id)}
          >
            <span>{group.label}</span>
            <small>{counts[group.id]}</small>
          </button>
        ))}
        <p className="pk-led-groups-hint">
          {LED_GROUPS.find((group) => group.id === activeGroup)?.hint ?? ""}
        </p>
      </div>

      <div className="pk-led-kit-body">
        <div className="pk-led-inputs">
          <label className="pk-led-field">
            <span>Метраж подсветки, м</span>
            <input
              type="text"
              inputMode="decimal"
              value={metersText}
              placeholder="Например, 12"
              data-testid="led-meters"
              aria-describedby="led-meters-note"
              onChange={(event) => {
                setMetersText(event.target.value);
                setMetersTouched(true);
              }}
            />
          </label>
          <p id="led-meters-note" className="pk-led-note">
            {metersFromTask && !metersTouched
              ? `Метраж подставлен из задачи света: ${METER.format(metersValue)} м. Можно изменить.`
              : ledMetersNote(metersValue)}
          </p>

          <div className="pk-led-pair">
            <label className="pk-led-field">
              <span>Рядов ленты</span>
              <input
                type="text"
                inputMode="numeric"
                value={rowsText}
                data-testid="led-rows"
                aria-describedby="led-rows-note"
                onChange={(event) => setRowsText(event.target.value)}
              />
            </label>
            <label className="pk-led-field">
              <span>Независимых зон</span>
              <input
                type="text"
                inputMode="numeric"
                value={zonesText}
                data-testid="led-zones"
                aria-describedby="led-rows-note"
                onChange={(event) => setZonesText(event.target.value)}
              />
            </label>
          </div>
          <p id="led-rows-note" className="pk-led-note">
            Ряды умножают длину: 6 м в два ряда — это 12 м ленты. Каждая зона управляется своим контроллером;
            блок питания может быть общим, но схему подтверждает инженер.
          </p>

          <label className="pk-led-field">
            <span>Лента</span>
            <select
              value={selected?.product.productId ?? ""}
              data-testid="led-strip"
              onChange={(event) => setStripId(event.target.value)}
            >
              {stripOptions.length === 0 ? <option value="">Нет лент с подтверждённой мощностью</option> : null}
              {stripOptions.map((option) => (
                <option key={option.product.productId} value={option.product.productId}>
                  {`${STRIP_KIND_LABEL[option.spec.kind] ?? option.spec.kind} · ${option.spec.wPerMeter} Вт/м · ${option.spec.voltage ?? "?"} В · катушка ${option.spec.reelMeters ?? "?"} м · ${price(option.product)}/${unitLabel(option.product)}`}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <ul className="pk-led-strip-facts" data-testid="led-strip-facts">
              <li>{STRIP_KIND_LABEL[selected.spec.kind] ?? selected.spec.kind}</li>
              {selected.spec.voltage ? <li>{selected.spec.voltage} В</li> : null}
              {selected.spec.wPerMeter ? <li>{selected.spec.wPerMeter} Вт/м</li> : null}
              {selected.spec.ledsPerMeter ? <li>{selected.spec.ledsPerMeter} диодов/м</li> : null}
              {selected.spec.cct ? <li>{selected.spec.cct} К</li> : null}
              {selected.spec.reelMeters ? <li>катушка {selected.spec.reelMeters} м</li> : null}
              {selected.spec.wattsPerReel ? <li>до {selected.spec.wattsPerReel} Вт на катушке</li> : null}
            </ul>
          ) : null}
          <p className="pk-led-note">
            Характеристики собраны из названий позиций в фиде поставщика, а не из паспорта: подтверждаем при заказе.
            Метраж округляем вверх до катушек — катушка не режется на части.
          </p>
        </div>

        <div className="pk-led-plan">
          <dl className="pk-led-numbers">
            <div>
              <dt>Нагрузка ленты</dt>
              <dd data-testid="led-plan-load">{plan && plan.loadW > 0 ? `${METER.format(plan.loadW)} Вт` : "—"}</dd>
            </div>
            <div>
              <dt>Нужен БП с запасом {plan?.marginPercent ?? 30} %</dt>
              <dd data-testid="led-plan-required">
                {plan && plan.requiredW > 0 ? `${METER.format(plan.requiredW)} Вт` : "—"}
              </dd>
            </div>
            <div>
              <dt>Ток нагрузки</dt>
              <dd data-testid="led-plan-current">{plan && plan.currentA > 0 ? `${METER.format(plan.currentA)} А` : "—"}</dd>
            </div>
            <div>
              <dt>Установленная длина · {plan?.rows ?? 1} ряд(а)</dt>
              <dd data-testid="led-plan-installed">
                {plan && plan.installedMeters > 0 ? `${METER.format(plan.installedMeters)} м` : "—"}
              </dd>
            </div>
            <div>
              <dt>Катушек по {selected?.spec.reelMeters ?? "?"} м</dt>
              <dd data-testid="led-plan-reels">{plan?.reels ?? "—"}</dd>
            </div>
            <div>
              <dt>Контроллеров по зонам</dt>
              <dd data-testid="led-plan-controllers">{plan ? plan.zones : "—"}</dd>
            </div>
          </dl>

          <div className="pk-led-picks">
            {selected
              ? pick(
                  "Лента",
                  selected.product,
                  `${
                    STRIP_KIND_LABEL[selected.spec.kind] ?? selected.spec.kind
                  } · ${selected.spec.wPerMeter} Вт/м · ${selected.spec.voltage} В. ${
                    purchase.unit === "pcs"
                      ? `Катушка ${selected.spec.reelMeters ?? basis?.reelMeters ?? "?"} м продаётся целой: ${METER.format(
                          plan?.installedMeters ?? 0
                        )} м установлено → ${purchase.qty} шт. Цена за катушку, не за метр.`
                      : basis?.basis === "per_meter"
                        ? "Цена за метр: покупается установленный метраж."
                        : "Единица продажи не подтверждена — метраж округлён вверх до метра."
                  }`,
                  "led-strip-pick",
                  stripQty
                )
              : null}
            {pick(
              "Блок питания",
              plan?.psu?.product,
              plan?.psu
                ? `${plan.psu.spec.watts} Вт · ${plan.psu.spec.voltage ?? "?"} В — минимальный подходящий по мощности с запасом 30 %.`
                : plan && plan.requiredW > 0
                  ? `Нужен БП на ${METER.format(plan.requiredW)} Вт: такой позиции в каталоге нет — соберём схему из нескольких блоков или подберём под заказ.`
                  : "Сначала нужны метраж и лента с подтверждённой мощностью.",
              "led-psu",
              1
            )}
            {pick(
              "Управление",
              plan?.controller?.product,
              controllerStatus
                ? `${controllerStatus.detail}${plan && plan.zones > 1 ? ` Нужно ${plan.zones} шт — по одной на зону.` : ""}`
                : "Подберём контроллер, когда будет известен тип ленты.",
              "led-controller",
              plan?.zones ?? 1
            )}
            {plan?.universalController &&
            plan.universalController.product.productId !== plan.controller?.product.productId
              ? pick(
                  "5-в-1 на любую ленту",
                  plan.universalController.product,
                  "Подходит любой ленте: монохром, CCT, RGB, RGBW и RGB+CCT — работает со всеми лентами, подтверждено владельцем на его комплекте.",
                  "led-controller-alt",
                  1
                )
              : null}
            {plan?.remote
              ? pick(
                  "Пульт",
                  plan.remote.product,
                  "RF-контроллер работает только с пультом — положили его в подбор.",
                  "led-remote",
                  1
                )
              : null}
          </div>

          {plan?.universalController ? (
            <p className="pk-led-alice" data-testid="led-alice-note">
              С Алисой любая лента работает через Wi-Fi 5-в-1 (WB5) — подтверждено владельцем на его комплекте. Один
              контроллер закрывает монохром, CCT, RGB, RGBW и RGB+CCT; ток и каналы проверяем по паспорту.
            </p>
          ) : controllerStatus?.alice === "owner-verified" ? (
            <p className="pk-led-alice" data-testid="led-alice-note">
              Wi-Fi-контроллер: управление со смартфона и голосом; работа с Алисой и умным домом подтверждена владельцем
              на его комплекте. Это не паспортная совместимость всего ассортимента — проверим на вашей модели.
            </p>
          ) : null}

          {plan && plan.warnings.length > 0 ? (
            <ul className="pk-led-warnings" data-testid="led-warnings">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <p className="pk-led-foot">
            Позиции попадают в комплект только по нажатию — автоматически мы ничего не добавляем. Метраж — геометрия
            вашего потолка, а не количество катушек; число рядов умножает длину ленты. Схему подключения, сечения и
            ограничения каналов уточняем по паспорту до заказа.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Ленты в комплект берутся метражом, округлённым вверх до катушки поставщика. */
export const LED_KIT_NOTE = "Катушка не режется: метраж округляем вверх.";
