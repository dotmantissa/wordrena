import { useId } from "react";
import clsx from "clsx";

export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  const uid = useId().replaceAll(":", "");
  const clipId = `${uid}-clip`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={clsx("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="48" height="48" rx="4" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="48" height="48" fill="#30463c" />
        <path d="M0 35 12 24l8 7 10-13 18 14v16H0Z" fill="#405b4c" />

        <g
          style={
            animated
              ? { transformOrigin: "24px 11px", animation: "pulse-dot 2.2s ease-in-out infinite" }
              : undefined
          }
        >
          <circle cx="24" cy="11" r="3" fill="#f3c16c" />
          <circle cx="24" cy="11" r="6" fill="#f3c16c" opacity="0.18" />
        </g>

        <polyline
          points="9,18 17,35 24,25 31,35 39,18"
          fill="none"
          stroke="#fffaf0"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1="11"
          y1="41"
          x2="37"
          y2="41"
          stroke="#d37d4e"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display font-bold tracking-tight", className)}>
      Word<span className="text-gold">rena</span>
    </span>
  );
}

export function Logo({
  className,
  markClass = "h-9 w-9",
  textClass = "text-lg",
  animated = false,
}: {
  className?: string;
  markClass?: string;
  textClass?: string;
  animated?: boolean;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClass} animated={animated} />
      <Wordmark className={textClass} />
    </span>
  );
}
