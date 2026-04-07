import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost";

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonAsButtonProps = CommonProps & {
  href?: undefined;
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
      return "border border-slate-300 bg-white text-slate-950 hover:border-slate-950 hover:bg-slate-50";
    case "ghost":
      return "border border-transparent bg-transparent text-slate-950 hover:bg-slate-100";
    case "primary":
    default:
      return "border border-slate-950 bg-slate-950 text-white hover:bg-slate-800";
  }
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const baseClassName = [
    "inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    getVariantClasses(variant),
    props.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={baseClassName}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={baseClassName}
    >
      {props.children}
    </button>
  );
}
