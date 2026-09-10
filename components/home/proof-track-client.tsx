"use client";

type ProofTrackClientProps = {
  children: React.ReactNode;
};

export function ProofTrackClient({ children }: ProofTrackClientProps) {
  return (
    <div
      role="region"
      aria-label="Лента выполненных работ"
      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2"
    >
      {children}
      <div className="w-4 shrink-0" />
    </div>
  );
}
