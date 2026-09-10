type HeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
};

export function Heading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className = "",
}: HeadingProps) {
  const rootClassName = [
    align === "center" ? "text-center" : "text-left",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const eyebrowClassName =
    tone === "dark"
      ? "mb-3 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-white/60"
      : "mb-3 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-slate-500";

  const titleClassName =
    tone === "dark"
      ? "text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
      : "text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl";

  const descriptionClassName =
    tone === "dark"
      ? "mt-4 max-w-2xl text-pretty text-base leading-7 text-white/72 sm:text-lg"
      : "mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg";

  return (
    <div className={rootClassName}>
      {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}

      <h2 className={titleClassName}>{title}</h2>

      {description ? <p className={descriptionClassName}>{description}</p> : null}
    </div>
  );
}
