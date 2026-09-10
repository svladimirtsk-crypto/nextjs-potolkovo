type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: ContainerProps) {
  const classes = ["mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
