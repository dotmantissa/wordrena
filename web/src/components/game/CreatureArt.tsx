import { useId } from "react";
import clsx from "clsx";
import { asElement, elementSoftTone, elementTone } from "./elements";

function nameSeed(name: string) {
  return Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function ElementCrest({ element }: { element: string }) {
  switch (asElement(element)) {
    case "ember":
      return <path d="M57 13c8 9 9 17 2 24 1-7-3-10-8-13 1-5 3-8 6-11Z" />;
    case "tide":
      return <path d="M45 26c8-12 19-13 28-4-8-2-13 1-17 7-4-1-8-2-11-3Z" />;
    case "gale":
      return <path d="M43 24c8-9 20-11 31-4-8 0-14 3-18 9-5 0-9-2-13-5Z" />;
    case "terra":
      return <path d="m45 25 7-14 8 12 10-8 2 18Z" />;
    case "umbra":
      return <path d="M47 26c4-12 14-17 27-14-8 3-12 8-13 16-5 1-10 0-14-2Z" />;
    case "lumen":
      return <path d="m58 10 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1Z" />;
  }
}

function Tail({ element }: { element: string }) {
  switch (asElement(element)) {
    case "ember":
      return <path d="M88 73c17-15 31-8 31 4-8-7-15-3-18 6-5-6-9-9-13-10Z" />;
    case "tide":
      return <path d="M88 72c17-8 26-2 31 9-11-3-17 1-20 10-3-9-7-15-11-19Z" />;
    case "gale":
      return <path d="M86 69c18-13 31-12 38-2-12-2-20 2-25 12-4-5-8-8-13-10Z" />;
    case "terra":
      return <path d="M88 73c13-7 24-4 32 7l-17-1-4 11-5-10-6-7Z" />;
    case "umbra":
      return <path d="M88 72c16-14 30-12 36-2-11-3-18 1-22 11-4-5-9-8-14-9Z" />;
    case "lumen":
      return <path d="M88 71c14-9 27-7 35 4-11-1-18 3-22 12-4-8-8-13-13-16Z" />;
  }
}

export function CreatureArt({
  name,
  element,
  className,
  facing = "right",
  active = false,
}: {
  name: string;
  element: string;
  className?: string;
  facing?: "left" | "right";
  active?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const tone = elementTone[asElement(element)];
  const soft = elementSoftTone[asElement(element)];
  const seed = nameSeed(name);
  const earLift = 15 + (seed % 8);
  const eyeSize = 2.5 + (seed % 3) * 0.4;
  const markings = 2 + (seed % 3);

  return (
    <svg
      viewBox="0 0 128 112"
      role="img"
      aria-label={`${name}, a ${element} creature`}
      className={clsx(
        "h-full w-full overflow-visible",
        facing === "left" && "-scale-x-100",
        active && "animate-floaty",
        className
      )}
    >
      <defs>
        <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 7 7 0" stroke={soft} strokeWidth="1" opacity=".24" />
        </pattern>
      </defs>
      <ellipse cx="64" cy="101" rx="41" ry="6" fill="#07060c" opacity=".48" />
      <g fill={tone} stroke="#0f0d18" strokeWidth="3" strokeLinejoin="round">
        <Tail element={element} />
        <path d="M28 78c0-24 16-43 40-43 22 0 37 18 37 43 0 19-15 28-39 28-23 0-38-9-38-28Z" />
        <path d={`M37 43 42 ${earLift}l16 19M80 38l15-${earLift - 4} 2 29`} />
        <ElementCrest element={element} />
      </g>
      <path
        d="M33 69c12-8 24-11 36-10 12 0 23 4 33 11v18c-11 8-23 11-36 11-13 0-24-4-33-11Z"
        fill={`url(#${id}-hatch)`}
      />
      <g fill="#100e19">
        <ellipse cx="54" cy="57" rx={eyeSize} ry={eyeSize + 1} />
        <ellipse cx="80" cy="57" rx={eyeSize} ry={eyeSize + 1} />
        <path d="M62 69c4 3 8 3 12 0-1 6-10 7-12 0Z" />
      </g>
      <g fill={soft} opacity=".7">
        {Array.from({ length: markings }).map((_, index) => (
          <path
            key={index}
            d={`M${44 + index * 12} 82l5-5 5 5-5 5Z`}
          />
        ))}
      </g>
      <path
        d="M43 99v8M88 98v9"
        stroke={tone}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
