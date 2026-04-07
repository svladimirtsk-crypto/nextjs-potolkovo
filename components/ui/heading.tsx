type HeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function Heading({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}: HeadingProps) {
  const rootClassName = [
    align === "center" ? "text-center" : "text-left",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {eyebrow ? (
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
