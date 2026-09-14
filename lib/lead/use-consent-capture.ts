"use client";

/**
 * PT-014 · Захват согласия: факт, версия и момент.
 *
 * Согласие было `consent: true` константой в payload обеих форм: сервер не мог
 * отличить «человек отметил чекбокс» от «код так написан», а в базе не оставалось
 * ни редакции политики, ни времени. Хук возвращает три значения сразу, и форма
 * физически не может отправить одно без другого.
 *
 * Момент согласия — это клик по чекбоксу, а не отправка формы: между ними
 * человек может минуту заполнять номер, и юридически значимо именно первое
 * действие. Снял галочку — момент сбрасывается: согласию, которое отозвали,
 * нельзя оставить время.
 *
 * Один хук на обе формы (основная и rescue-диалог) ровно по той же причине, по
 * которой в PT-004 появился общий `submitLead`: согласие либо одинаковое везде,
 * либо его нет.
 */
import { useCallback, useMemo, useState } from "react";

import { PRIVACY_POLICY_VERSION } from "@/content/legal";

export type ConsentCapture = {
  /** Отмечен ли чекбокс сейчас. */
  given: boolean;
  /** Момент, когда чекбокс отметили (ISO), или `null`, если согласия нет. */
  at: string | null;
  /** Редакция политики, показанная рядом с чекбоксом. */
  version: string;
  /** Обработчик чекбокса. */
  onChange: (next: boolean) => void;
};

export function useConsentCapture(): ConsentCapture {
  const [given, setGiven] = useState(false);
  const [at, setAt] = useState<string | null>(null);

  const onChange = useCallback((next: boolean) => {
    setGiven(next);
    setAt(next ? new Date().toISOString() : null);
  }, []);

  /**
   * Объект устойчив между рендерами, пока не изменились сами значения: его
   * можно класть в зависимости `useCallback`. Без этого обработчик отправки
   * запоминал состояние согласия первого рендера и заявка уходила с
   * `consentGiven: false` при отмеченном чекбоксе (поймано E2E-тестами PT-004).
   */
  return useMemo(
    () => ({ given, at, version: PRIVACY_POLICY_VERSION, onChange }),
    [given, at, onChange]
  );
}
