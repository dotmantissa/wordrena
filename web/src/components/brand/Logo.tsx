import { useId } from "react";
import clsx from "clsx";

/*
  The mark is a little sigil: a bold W drawn like a row of fangs (the creature,
  the arena crown) with a spark hovering over it (the word you write, catching
  fire). Gold melting into rune violet, the two brand colours.
*/
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  const uid = useId().replaceAll(":", "");
  const tileId = `${uid}-tile`;
  const strokeId = `${uid}-stroke`;
  const clipId = `${uid}-clip`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={clsx("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6a45" stopOpacity="0.16" />
          <stop offset="50%" stopColor="#b77bff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#38a8ff" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffcb52" />
          <stop offset="55%" stopColor="#ffb638" />
          <stop offset="100%" stopColor="#b77bff" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="48" height="48" rx="12" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="48" height="48" fill={`url(#${tileId})`} />
        <rect width="48" height="48" fill="#14121f" opacity="0.55" />

        {/* the spark of the written word */}
        <g
          style={
            animated
              ? { transformOrigin: "24px 12px", animation: "flicker 3.5s ease-in-out infinite" }
              : undefined
          }
        >
          <circle cx="24" cy="12.5" r="3" fill="#ffd07a" />
          <circle cx="24" cy="12.5" r="6.5" fill="#ffb638" opacity="0.22" />
        </g>

        {/* the fang crown / W */}
        <polyline
          points="10,17 18,35 24,24 30,35 38,17"
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeWidth="4.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* arena floor */}
        <line
          x1="12"
          y1="40"
          x2="36"
          y2="40"
          stroke="#38a8ff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-display font-bold tracking-tight", className)}>
      Word<span className="text-gradient">rena</span>
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
