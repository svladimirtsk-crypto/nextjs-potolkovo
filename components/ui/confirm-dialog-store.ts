/**
 * PT-011 · Контроллер диалога подтверждения.
 *
 * Здесь только императивная часть: модульное состояние (один активный резолвер
 * на приложение), открытие/закрытие и сопоставление способа закрытия с
 * результатом промиса. Разметка и ловушка фокуса — в `confirm-dialog.tsx`.
 *
 * Разделение понадобилось не только из-за лимита в 600 строк: семантику
 * «чем разрешается промис» можно читать и менять независимо от вёрстки, а
 * именно в ней была ошибка PT-011 — закрытие диалога возвращало `false`,
 * то есть «выбрал вторую кнопку».
 */

/**
 * PT-004 · Результат отправки, который диалог показывает человеку.
 *
 * Диалог намеренно не знает ни про `/api/lead`, ни про zod, ни про Метрику:
 * он умеет только «успех» и «отказ с текстом». Всю работу делает обработчик,
 * переданный в `options.submit.run`.
 */
export type ConfirmDialogSubmitOutcome =
  | { ok: true }
  | { ok: false; message: string };

export type ConsentNotice = {
  prefix: string;
  href: string;
  linkLabel: string;
  suffix?: string;
};

/**
 * PT-014 · Факт согласия, который диалог передаёт обработчику отправки.
 *
 * Раньше rescue-заявка уходила с `consent: true` константой в payload: сервер и
 * база не могли отличить отмеченный чекбокс от так написанного кода. Теперь
 * диалог отдаёт и сам факт, и момент клика, а версию политики подставляет
 * `lib/lead/rescue-lead.ts`.
 */
export type ConfirmDialogConsent = {
  given: boolean;
  /** ISO-момент, когда чекбокс отметили; `null`, если согласия нет. */
  at: string | null;
};

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  /**
   * T-026 · rescue-режим: в диалоге появляется поле телефона.
   * Результат тогда — введённый номер (или `false`, если клиент просто закрыл).
   */
  phoneField?: {
    label: string;
    placeholder?: string;
    hint?: string;
    /**
     * PT-004 · Согласие на обработку персональных данных.
     *
     * Раньше rescue-заявка уходила с `consent: true` как константой: человек
     * не видел ни чекбокса, ни текста, ни ссылки на политику. Формально это
     * не согласие, а домысливание за пользователя. С этим блоком кнопка
     * отправки неактивна, пока чекбокс не отмечен.
     */
    consent?: ConsentNotice;
  };
  /**
   * PT-004 · Отправка внутри диалога.
   *
   * Без этого обработчика диалог — просто «да/нет»: он закрывается сразу и
   * ничего не знает о том, что произошло дальше. Именно так rescue-заявка и
   * терялась: модалка закрывалась с ощущением успеха при любом ответе сервера.
   *
   * С обработчиком диалог ждёт ответа, показывает «Отправляю…», а при отказе
   * остаётся открытым с причиной и кнопкой повтора. Закрыть его в этот момент
   * можно только явно — Escape и клик по подложке во время запроса игнорируются,
   * иначе человек закроет окно, так и не узнав, ушла заявка или нет.
   */
  submit?: {
    run: (phone: string, consent: ConfirmDialogConsent) => Promise<ConfirmDialogSubmitOutcome>;
    pendingLabel?: string;
    retryLabel?: string;
    /** Кнопка «уйти, не отправив» в состоянии ошибки. */
    dismissLabel?: string;
  };
};

/** `true`/`false` для обычного confirm; строка с телефоном — для rescue. */
export type ConfirmDialogResult = boolean | string;

/**
 * PT-011 · Чем разрешать промис при каждом из трёх способов закрыть диалог.
 *
 * Раньше исход был один — `boolean`, и «нажал вторую кнопку» было неотличимо от
 * «закрыл по Escape / клику по подложке». На экране выбора комплекта в каталоге
 * это означало, что закрытие диалога запускало оформление заказа «только
 * оборудование»: человек уходил из диалога, а попадал в форму заявки.
 *
 * Для обычного подтверждения ничего не меняется — дефолт тот же (`true`/`false`),
 * а закрытие по-прежнему равносильно «нет».
 */
type DialogOutcomes = {
  confirm: ConfirmDialogResult;
  cancel: ConfirmDialogResult;
  dismissed: ConfirmDialogResult;
};

const CONFIRM_OUTCOMES: DialogOutcomes = { confirm: true, cancel: false, dismissed: false };

type ConfirmResolver = (value: ConfirmDialogResult) => void;

export const EMPTY_OPTIONS: ConfirmDialogOptions = { title: "", message: "" };

let activeResolver: ConfirmResolver | null = null;
let activeOptions: ConfirmDialogOptions | null = null;
let activeOutcomes: DialogOutcomes = CONFIRM_OUTCOMES;
/** PT-011: элемент, открывший диалог, — туда возвращаем фокус при закрытии. */
let activeOpener: HTMLElement | null = null;
let setDialogState: ((state: DialogState) => void) | null = null;
let dialogToken = 0;

export type DialogState = {
  open: boolean;
  /** PT-004: ключ ремаунта панели — состояние формы не должно протекать между вызовами. */
  token: number;
  options: ConfirmDialogOptions;
  /** PT-011: показывать ли крестик — закрытие как отдельный видимый исход. */
  dismissible: boolean;
};

/**
 * Встроенная альтернатива window.confirm для калькулятора.
 *
 * Заменяет нативный confirm, который блокирует поток, не стилизуется
 * и выглядит чужеродно. Использует React-портал для рендера поверх
 * всех слоёв модалки.
 *
 * Использование:
 *   const confirmed = await showConfirmDialog({
 *     title: "Закрыть калькулятор?",
 *     message: "Ваш расчёт не сохранится.",
 *   });
 */
export function showConfirmDialog(options: ConfirmDialogOptions): Promise<ConfirmDialogResult> {
  return openDialog(options, CONFIRM_OUTCOMES, false);
}

/**
 * PT-011 · Диалог выбора: два явных исхода и отдельное «закрыл».
 *
 * Отличается от `showConfirmDialog` не кнопками, а семантикой результата:
 * закрытие (Escape, клик по подложке, крестик) разрешается значением
 * `"dismissed"`, а не `false`, поэтому вызывающий код обязан обработать три
 * ветки и не может случайно принять уход из диалога за выбор.
 *
 * Крестик здесь виден всегда: на мобильном Escape нет, и без явного элемента
 * закрытия человек обнаружил бы только клики по подложке.
 */
export type ChoiceDialogOptions<TChoice extends string> = {
  title: string;
  message: string;
  /** Акцентная кнопка справа. */
  primary: { id: TChoice; label: string };
  /** Спокойная кнопка слева. */
  secondary: { id: TChoice; label: string };
  variant?: "danger" | "warning" | "info";
};

export type ChoiceDialogResult<TChoice extends string> = TChoice | "dismissed";

export function showChoiceDialog<TChoice extends string>(
  options: ChoiceDialogOptions<TChoice>,
): Promise<ChoiceDialogResult<TChoice>> {
  return openDialog<ChoiceDialogResult<TChoice>>(
    {
      title: options.title,
      message: options.message,
      confirmLabel: options.primary.label,
      cancelLabel: options.secondary.label,
      variant: options.variant,
    },
    {
      confirm: options.primary.id,
      cancel: options.secondary.id,
      dismissed: "dismissed",
    },
    true,
  );
}

function openDialog<TResult extends ConfirmDialogResult>(
  options: ConfirmDialogOptions,
  outcomes: DialogOutcomes,
  dismissible: boolean,
): Promise<TResult> {
  return new Promise<TResult>((resolve) => {
    // Резолвер общий для всех вариантов, конкретный тип результата задаёт
    // `outcomes` — отсюда приведение типа.
    activeResolver = resolve as unknown as ConfirmResolver;
    activeOptions = options;
    activeOutcomes = outcomes;
    activeOpener = getActiveElement();
    dialogToken += 1;
    setDialogState?.({ open: true, token: dialogToken, options, dismissible });
  });
}

/** PT-011: как именно закрылся диалог — от этого зависит результат промиса. */
export type CloseReason = "confirm" | "cancel" | "dismiss";

export function closeDialog(reason: CloseReason, confirmValue?: ConfirmDialogResult) {
  const result =
    reason === "confirm"
      ? (confirmValue ?? activeOutcomes.confirm)
      : reason === "cancel"
        ? activeOutcomes.cancel
        : activeOutcomes.dismissed;

  setDialogState?.({
    open: false,
    token: dialogToken,
    options: activeOptions ?? EMPTY_OPTIONS,
    dismissible: false,
  });
  activeResolver?.(result);
  activeResolver = null;
  activeOptions = null;
  activeOutcomes = CONFIRM_OUTCOMES;
  restoreFocusToOpener();
}

function getActiveElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

/**
 * PT-011 · Фокус возвращается к элементу, открывшему диалог.
 *
 * Без этого после Escape фокус оказывался на `body`, и клавиатурный пользователь
 * терял место в странице — на мобильном это ещё и означало пропавшую рамку
 * вокруг кнопки «Оформить». Если элемента уже нет в DOM (страница успела
 * перерисоваться), фокус не трогаем: насильно возвращать его некуда.
 */
function restoreFocusToOpener(): void {
  const opener = activeOpener;
  activeOpener = null;
  if (!opener || !opener.isConnected) return;
  opener.focus();
}

/**
 * PT-004 · Открыт ли сейчас какой-либо диалог подтверждения.
 *
 * `showConfirmDialog` хранит один резолвер на модуль: второй вызов поверх
 * первого перезаписывает его, и прежний промис не разрешается никогда. Модалка
 * калькулятора слушает Escape на `document` так же, как и сам диалог, поэтому
 * без этой проверки Escape поверх чужого диалога (например, подтверждения
 * смены системы света в каталоге) запускал rescue-оффер и «вешал» исходный.
 */
export function isConfirmDialogOpen(): boolean {
  return activeResolver !== null;
}

/**
 * PT-011 · Реактивная часть регистрирует свой сеттер при монтировании портала.
 *
 * До регистрации (SSR, портал ещё не смонтирован) вызовы `showConfirmDialog`
 * просто не показывают панель — как и раньше, поведение не меняем.
 */
export function registerDialogStateSetter(
  setter: ((state: DialogState) => void) | null,
): void {
  setDialogState = setter;
}
