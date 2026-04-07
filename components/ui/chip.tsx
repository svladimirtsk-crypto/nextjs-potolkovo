type ChipProps = {
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
};

export function Chip({
  children,
  tone = "light",
  className = "",
}: ChipProps) {
  const toneClassName =
    tone === "dark"
      ? "border border-white/15 bg-white/10 text-white"
      : "border border-slate-200 bg-white text-slate-700";

  const classes = [
    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
    toneClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
