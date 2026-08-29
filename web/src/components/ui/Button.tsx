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
        "ring-focus inline-flex min-h-10 items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "border-dusk bg-dusk text-parch hover:border-dusk-raise hover:bg-dusk-raise",
        variant === "secondary" &&
          "border-line-strong bg-surface text-ink hover:border-gold hover:text-gold",
        variant === "quiet" &&
          "border-transparent bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
        variant === "danger" &&
          "border-ember/50 bg-ember/10 text-ember hover:bg-ember/20",
        className
      )}
      {...props}
    />
  );
}
