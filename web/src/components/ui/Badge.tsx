import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center border border-line px-2 py-0.5 font-mono text-[11px] uppercase text-ink-soft",
        className
      )}
      {...props}
    />
  );
}
