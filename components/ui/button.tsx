"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { isHashHref, scrollToAnchorTarget } from "@/lib/scroll-to-anchor";

type ButtonVariant = "primary" | "secondary" | "ghost";

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
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
      return [
        "border border-slate-950 bg-slate-950",
        "!text-white",
        "hover:border-slate-800 hover:bg-slate-800",
      ].join(" ");
  }
}

function isLinkProps(props: ButtonProps): props is ButtonAsLinkProps {
  return "href" in props && typeof props.href === "string";
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";

  const baseClassName = [
    "inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
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
        // Не ломаем: открыть в новой вкладке / системные модификаторы
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

        scrollToAnchorTarget(props.href, {
          focus: true,
          highlight: true,
        });
      };

      return (
        <a href={props.href} className={baseClassName} onClick={handleHashClick}>
          {props.children}
        </a>
      );
    }

    return (
      <Link href={props.href} className={baseClassName}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      className={baseClassName}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
