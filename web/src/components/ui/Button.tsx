import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      className={clsx(
        "ring-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "border-gold bg-gold text-void hover:border-gold-soft hover:bg-gold-soft",
        variant === "secondary" &&
          "border-line-strong bg-surface-2 text-parch hover:border-gold/50 hover:text-gold-soft",
        variant === "quiet" &&
          "border-transparent bg-transparent text-ink-soft hover:bg-surface-2 hover:text-parch",
        variant === "danger" &&
          "border-ember/50 bg-ember/10 text-ember hover:bg-ember/20",
        className
      )}
      {...props}
    />
  );
}
