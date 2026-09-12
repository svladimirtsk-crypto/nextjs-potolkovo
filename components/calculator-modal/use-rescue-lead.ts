"use client";

/**
 * PT-004 · Rescue-оффер целиком: диалог, согласие, отправка, честный статус.
 *
 * Вынесено из `calculator-modal.tsx` по двум причинам. Первая — страж размера
 * файла (`scripts/check-file-size.mjs`, лимит 600 строк): модалка была на 595.
 * Вторая и главная — раньше `submitRescueLead` жил прямо в компоненте и был
 * невозможен к проверке: ни одного теста на то, что rescue отправляет полный
 * снапшот и что успех показывается только после ответа сервера.
 */
import { useCallback, useMemo } from "react";

import { showConfirmDialog } from "@/components/ui/confirm-dialog";
import { legal } from "@/content/legal";
import { trackLeadRescueAccepted, trackLeadRescueShown } from "@/lib/analytics";
import { useCalculatorStore } from "@/lib/calculator/store";
import { submitRescueLead } from "@/lib/lead/rescue-lead";

import { useCalculatorModal } from "./calculator-modal-context";

/**
 * Аварийный рубильник rescue-оффера (правило 2.8 ТЗ: новое поведение приёма
 * заявок — под флагом с безопасным дефолтом).
 *
 * Дефолт `1`. При `0` диалог не показывается вовсе: человек просто закрывает
 * калькулятор, основная форма на Шаге 2 продолжает работать. Это единственная
 * часть PT-004, которую допустимо отключать — проверка ответа сервера и
 * явное согласие не флагуемые: их «выключенное» состояние и есть тот баг,
 * который задача чинит.
 */
export function isRescueOfferEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEAD_RESCUE_ENABLED !== "0";
}

export type RescueOffer = {
  enabled: boolean;
  /**
   * Показать диалог и дождаться его закрытия.
   *
   * Резолвится в любом случае — и когда заявка отправлена, и когда человек
   * отказался, и когда сервер отказал, а пользователь закрыл диалог сам.
   * Возвращает `true`, только если сервер подтвердил приём: по этому значению
   * вызывающий код честно заполняет `lead_sent` в `calculator_close`.
   */
  request: () => Promise<boolean>;
};

export function useRescueOffer(): RescueOffer {
  const {
    options,
    grandTotal,
    ceilingEffectiveTotal,
    lightingRegularTotal,
    lightingEffectiveTotal,
    markLeadSubmitted,
  } = useCalculatorModal();
  const { snapshot } = useCalculatorStore();

  const request = useCallback(async () => {
    const source = String(options?.source ?? "modal");
    const entryMode = options?.entryMode ?? null;
    const total = grandTotal;

    let submitted = false;

    // Снимок состояния на момент открытия диалога: пока человек вводит номер,
    // расчёт уже не должен меняться.
    const snapshotAtOpen = snapshot;
    const ceilingAtOpen = ceilingEffectiveTotal;
    const lightingRegularAtOpen = lightingRegularTotal;
    const lightingEffectiveAtOpen = lightingEffectiveTotal;

    trackLeadRescueShown({ total });

    // `lead_rescue_accepted` — один раз на диалог, даже если отправку
    // пришлось повторить после отказа сервера.
    let acceptedTracked = false;

    await showConfirmDialog({
      title: "Сохранить расчёт и получить его на телефон?",
      message:
        "Пришлю расчёт и отвечу на вопросы. Если не нужно — просто закройте, ничего не отправится.",
      confirmLabel: "Отправить",
      cancelLabel: "Просто закрыть",
      variant: "info",
      phoneField: {
        label: "Телефон",
        hint: "Перезвоню в удобное время, спама не будет.",
        /**
         * PT-004: текст и ссылка — те же, что в основной форме (T-047), из
         * единого `content/legal.ts`. Придумывать отдельную формулировку для
         * «короткой» заявки нельзя: согласие либо одинаковое везде, либо его нет.
         */
        consent: {
          prefix: legal.consentTextPrefix,
          href: legal.privacyHref,
          linkLabel: legal.privacyLabel,
          suffix: legal.consentTextSuffix,
        },
      },
      submit: {
        pendingLabel: "Отправляю…",
        retryLabel: "Повторить",
        dismissLabel: "Закрыть без отправки",
        run: async (phone) => {
          if (!acceptedTracked) {
            acceptedTracked = true;
            trackLeadRescueAccepted({ total });
          }

          const outcome = await submitRescueLead({
            phone,
            source,
            entryMode,
            pagePath: typeof window !== "undefined" ? window.location.pathname : "",
            snapshot: snapshotAtOpen,
            ceilingEffectiveTotal: ceilingAtOpen,
            lightingRegularTotal: lightingRegularAtOpen,
            lightingEffectiveTotal: lightingEffectiveAtOpen,
            grandTotal: total,
          });

          if (!outcome.ok) {
            return { ok: false, message: outcome.message };
          }

          /**
           * PT-004: `markLeadSubmitted()` — только после подтверждения сервера.
           *
           * Именно этот вызов раньше стоял в `try` сразу за `fetch` и срабатывал
           * на `422/429/500`: модалка запоминала «заявка отправлена», переставала
           * переспрашивать при закрытии, а в базе было пусто.
           *
           * Черновик намеренно не стираем (`clearCalcDraft`): rescue сохраняет
           * расчёт для мастера, но не означает, что человек закончил подбор.
           * Семантику восстановления черновика задаёт PT-007.
           */
          markLeadSubmitted();
          submitted = true;
          return { ok: true };
        },
      },
    });

    return submitted;
  }, [
    ceilingEffectiveTotal,
    grandTotal,
    lightingEffectiveTotal,
    lightingRegularTotal,
    markLeadSubmitted,
    options?.entryMode,
    options?.source,
    snapshot,
  ]);

  /**
   * Объект мемоизирован: `requestClose` в модалке держит его в зависимостях
   * `useCallback`, а тот в свою очередь — в зависимостях `useEffect` на
   * `keydown`. Новый объект на каждый рендер переподписывал бы слушатель
   * клавиатуры на каждый же рендер.
   */
  return useMemo(() => ({ enabled: isRescueOfferEnabled(), request }), [request]);
}
