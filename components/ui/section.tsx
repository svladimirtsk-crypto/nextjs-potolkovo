type SectionProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export function Section({ children, id, className = "" }: SectionProps) {
  const classes = ["py-16 sm:py-20 lg:py-24", className].filter(Boolean).join(" ");

  return (
    <section id={id} className={classes}>
      {children}
    </section>
  );
}
