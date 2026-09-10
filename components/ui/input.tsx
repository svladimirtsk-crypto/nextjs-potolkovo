import type { InputHTMLAttributes } from "react";

type InputProps = {
  label: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function Input({ label, className = "", id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-medium text-slate-900"
      >
        {label}
      </label>

      <input
        id={inputId}
        {...props}
        className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:outline-none"
      />
    </div>
  );
}
