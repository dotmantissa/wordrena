import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("card p-5", className)} {...props} />;
}
