"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { isHashHref, scrollToAnchorTarget } from "@/lib/scroll-to-anchor";

type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * T-064: три размера вместо одной захардкоженной высоты.
 * `sm` — 44px (минимум для касания по WCAG 2.5.5), `md` — 48px (дефолт),
 * `lg` — 56px для главных CTA на широких экранах.
 */
type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Стабильный хук для e2e — не завязываться на тексты и классы (T-091). */
  "data-testid"?: string;
};

type ButtonAsButtonProps = CommonProps & {
  href?: never;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type ButtonAsLinkProps = CommonProps & {
  href: string;
};

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function getSizeClasses(size: ButtonSize) {
  switch (size) {
    case "sm":
      return "min-h-11 px-4 py-2.5 text-sm";
    case "lg":
      return "min-h-14 px-7 py-4 text-base";
    case "md":
    default:
      return "min-h-12 px-5 py-3 text-sm";
  }
}

function getVariantClasses(variant: ButtonVariant) {
  switch (variant) {
    case "secondary":
      return [
        "border border-slate-300 bg-white",
        "!text-slate-950",
        "hover:border-slate-950 hover:bg-slate-50",
      ].join(" ");
    case "ghost":
      return [
        "border border-transparent bg-transparent",
        "!text-slate-950",
        "hover:bg-slate-100",
      ].join(" ");
    case "primary":
    default:
      /*
       * T-064: primary — акцентный синий, а не чёрный. Раньше главная кнопка
       * визуально не отличалась от тёмных секций и служебных элементов,
       * поэтому «Записаться на замер» терялась среди slate-950.
       */
      return [
        "border border-[var(--color-accent)] bg-[var(--color-accent)]",
        "!text-white",
        "hover:border-[var(--color-accent-hover)] hover:bg-[var(--color-accent-hover)]",
      ].join(" ");
  }
}

function isLinkProps(props: ButtonProps): props is ButtonAsLinkProps {
  return "href" in props && typeof props.href === "string";
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";

  const baseClassName = [
    "inline-flex items-center justify-center rounded-full font-semibold",
    getSizeClasses(size),
    "transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-60",
    // чтобы вложенные элементы не утащили свой цвет
    "[&_span]:!text-inherit [&_svg]:!text-inherit [&_svg]:fill-current",
    getVariantClasses(variant),
    props.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isLinkProps(props)) {
    if (isHashHref(props.href)) {
      const handleHashClick = (event: MouseEvent<HTMLAnchorElement>) => {
        // не ломаем ctrl/cmd/shift click
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        scrollToAnchorTarget(props.href, { focus: true, highlight: true });
      };

      return (
        <a
          href={props.href}
          className={baseClassName}
          data-testid={props["data-testid"]}
          onClick={handleHashClick}
        >
          {props.children}
        </a>
      );
    }

    return (
      <Link href={props.href} className={baseClassName} data-testid={props["data-testid"]}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      className={baseClassName}
      data-testid={props["data-testid"]}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
